// בדיקות לכלי הדוחות - בלי רשת. מריצים: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGING_ACTION, FIRST_REPLY_ACTION, timeParams, buildReportRequests, normalizeRow, ageShare,
  summarizeReport, isRateLimitError, runRequests, formatReport,
} from './meta-report-build.js';

const today = new Date('2026-10-27T10:00:00Z');
const row = (spend, conv, extra = {}) => ({
  spend: String(spend), impressions: '1000', reach: '600', frequency: '1.6667', clicks: '20', ctr: '2',
  actions: conv ? [{ action_type: MESSAGING_ACTION, value: String(conv) }] : undefined,
  ...extra,
});
const rateErr = (code = 17) => Object.assign(new Error('User request limit reached (code 17)'), { code });

test('טווח: since, days, או כל חיי הקמפיין', () => {
  assert.deepEqual(timeParams({ since: '2026-10-20', today }),
    { time_range: JSON.stringify({ since: '2026-10-20', until: '2026-10-27' }) });
  assert.deepEqual(timeParams({ days: 7, today }),
    { time_range: JSON.stringify({ since: '2026-10-20', until: '2026-10-27' }) });
  assert.deepEqual(timeParams({}), { date_preset: 'maximum' });
});

test('הבקשות: 7, כולן לקמפיין הנכון, עם כל הפילוחים', () => {
  const reqs = buildReportRequests('123', { date_preset: 'maximum' });
  assert.equal(reqs.length, 7);
  assert.ok(reqs.every((r) => r.path.startsWith('123')));
  const by = Object.fromEntries(reqs.map((r) => [r.key, r.params]));
  assert.equal(by.ads.level, 'ad');
  assert.equal(by.platform.breakdowns, 'publisher_platform');
  assert.equal(by.position.breakdowns, 'publisher_platform,platform_position');
  assert.equal(by.age.breakdowns, 'age');
  assert.equal(by.daily.time_increment, 1);
  assert.match(by.total.fields, /frequency/);
  assert.equal(by.total.date_preset, 'maximum');
});

test('מזהה קמפיין לא תקין - נעצר', () => {
  assert.throws(() => buildReportRequests(undefined, {}));
  assert.throws(() => buildReportRequests('act_1/../x', {}));
});

test('שיחות וואטסאפ ועלות לשיחה', () => {
  const r = normalizeRow(row(120, 4, {
    actions: [
      { action_type: MESSAGING_ACTION, value: '4' },
      { action_type: FIRST_REPLY_ACTION, value: '3' },
      { action_type: 'link_click', value: '20' },
    ],
  }));
  assert.equal(r.conversations, 4);
  assert.equal(r.first_replies, 3);
  assert.equal(r.cost_per_conversation_ils, 30);
  assert.equal(r.frequency, 1.67);
});

test('בלי שיחות: העלות לשיחה null, לא 0', () => {
  const r = normalizeRow(row(80, 0));
  assert.equal(r.conversations, 0);
  assert.equal(r.cost_per_conversation_ils, null);
  assert.equal(normalizeRow(undefined).spend_ils, 0);
});

test('גיל: כמה מהכסף והשיחות הלכו ל-25-34', () => {
  const y = ageShare([
    { age: '25-34', spend_ils: 60, conversations: 1 },
    { age: '35-44', spend_ils: 40, conversations: 3 },
  ]);
  assert.equal(y.spend_pct, 60);
  assert.equal(y.conversations_pct, 25);
  assert.equal(ageShare([]).spend_pct, null);
});

test('סיכום: מודעות לפי הוצאה, ימים עם הוצאה, מצב', () => {
  const rep = summarizeReport({
    status: { name: 'ק', effective_status: 'PAUSED', ads: { data: [{ id: '1', name: 'ק · לירון', effective_status: 'CAMPAIGN_PAUSED' }] } },
    total: { data: [row(150, 5)] },
    daily: { data: [
      { date_start: '2026-10-20', ...row(0, 0) },
      { date_start: '2026-10-21', ...row(50, 2) },
      { date_start: '2026-10-22', ...row(100, 3) },
    ] },
    ads: { data: [{ ad_name: 'ק · עליא', ...row(40, 1) }, { ad_name: 'לירון', ...row(110, 4) }] },
    age: { data: [{ age: '35-44', ...row(100, 4) }, { age: '25-34', ...row(50, 1) }] },
  });
  assert.equal(rep.status.ads[0].name, 'לירון');
  assert.equal(rep.days_with_spend, 2);
  assert.equal(rep.first_spend_date, '2026-10-21');
  assert.deepEqual(rep.ads.map((a) => a.ad), ['לירון', 'עליא']);
  assert.equal(rep.age[0].age, '25-34');
  assert.equal(rep.young_age.spend_pct, 33.3);
  assert.deepEqual(rep.platforms, []);
});

test('קמפיין מושהה (אפסים) - הדוח לא נשבר', () => {
  const rep = summarizeReport({ status: { name: 'ק', effective_status: 'PAUSED' }, total: { data: [] }, daily: { data: [] } });
  assert.equal(rep.total.spend_ils, 0);
  assert.equal(rep.total.cost_per_conversation_ils, null);
  assert.equal(rep.days_with_spend, 0);
  const text = formatReport(rep).join('\n');
  assert.match(text, /מושהה/);
  assert.match(text, /אין הוצאה/);
});

test('זיהוי הגבלת בקשות של Meta', () => {
  for (const c of [4, 17, 32, 613, 80000, 80004]) assert.ok(isRateLimitError({ code: c }), `code ${c}`);
  for (const c of [1, 100, 190, undefined]) assert.ok(!isRateLimitError({ code: c }), `code ${c}`);
});

test('הגבלה זמנית: מחכה, מנסה שוב, ומצליח', async () => {
  let calls = 0;
  const waits = [];
  const get = async (path) => { calls++; if (calls === 1) throw rateErr(); return { path }; };
  const { raw, failed } = await runRequests(
    [{ key: 'a', path: 'x' }, { key: 'b', path: 'y' }],
    { get, sleep: async (ms) => waits.push(ms), gapMs: 10, delays: [5, 6] }
  );
  assert.deepEqual(failed, []);
  assert.equal(raw.a.path, 'x');
  assert.equal(raw.b.path, 'y');
  assert.deepEqual(waits, [5, 10]);
});

test('הגבלה שלא עוברת: עוצר, לא מציף, ומחזיר מה שהספיק', async () => {
  const sent = [];
  const get = async (path) => { sent.push(path); if (path === 'y') throw rateErr(80004); return { ok: true }; };
  const { raw, failed } = await runRequests(
    [{ key: 'a', path: 'x' }, { key: 'b', path: 'y' }, { key: 'c', path: 'z' }],
    { get, sleep: async () => {}, delays: [1, 1] }
  );
  assert.ok(raw.a);
  assert.deepEqual(sent, ['x', 'y', 'y', 'y']);
  assert.deepEqual(failed.map((f) => f.key), ['b', 'c']);
  assert.ok(failed.every((f) => f.rate_limited));
});

test('שגיאה רגילה: לא מנסה שוב, ממשיך לבקשה הבאה', async () => {
  const sent = [];
  const get = async (path) => { sent.push(path); if (path === 'x') throw Object.assign(new Error('bad'), { code: 100 }); return {}; };
  const { raw, failed } = await runRequests(
    [{ key: 'a', path: 'x' }, { key: 'b', path: 'y' }],
    { get, sleep: async () => {} }
  );
  assert.deepEqual(sent, ['x', 'y']);
  assert.equal(failed.length, 1);
  assert.ok(raw.b);
});
