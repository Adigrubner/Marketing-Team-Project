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

test('הבקשות: 11 לקמפיין, עם כל הפילוחים', () => {
  const reqs = buildReportRequests('123', { date_preset: 'maximum' }, { today });
  assert.deepEqual(reqs.map((r) => r.key), [
    'status', 'total', 'daily', 'adsets', 'adsets_7d', 'ads', 'cards', 'platform', 'position', 'age_gender', 'device',
  ]);
  assert.ok(reqs.every((r) => r.path.startsWith('123')));
  const by = Object.fromEntries(reqs.map((r) => [r.key, r.params]));
  assert.equal(by.ads.level, 'ad');
  assert.equal(by.platform.breakdowns, 'publisher_platform');
  assert.equal(by.position.breakdowns, 'publisher_platform,platform_position');
  assert.equal(by.age_gender.breakdowns, 'age,gender');
  assert.equal(by.device.breakdowns, 'device_platform');
  assert.equal(by.daily.time_increment, 1);
  assert.match(by.total.fields, /frequency/);
  assert.equal(by.total.date_preset, 'maximum');
});

test('לפי יום: גם חשיפות, אנשים, קליקים וקליקים על הכפתור (לא רק הוצאה)', () => {
  const by = Object.fromEntries(buildReportRequests('123', { date_preset: 'maximum' }, { today }).map((r) => [r.key, r.params]));
  for (const f of ['spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks', 'actions']) {
    assert.ok(by.daily.fields.split(',').includes(f), f);
  }
});

test('לפי קבוצה: כל התקופה, ו-7 הימים האחרונים בבקשה נפרדת', () => {
  const by = Object.fromEntries(buildReportRequests('123', { date_preset: 'maximum' }, { today }).map((r) => [r.key, r.params]));
  assert.equal(by.adsets.level, 'adset');
  assert.match(by.adsets.fields, /adset_id/);
  assert.equal(by.adsets.date_preset, 'maximum');
  assert.equal(by.adsets_7d.level, 'adset');
  assert.match(by.adsets_7d.fields, /frequency/);
  assert.equal(by.adsets_7d.time_range, JSON.stringify({ since: '2026-10-21', until: '2026-10-27' }));
  // דוח היסטורי (--until): 7 הימים שמסתיימים בסוף הטווח, לא היום
  const old = Object.fromEntries(buildReportRequests('123', timeParams({ since: '2026-10-01', until: '2026-10-10' }), { today })
    .map((r) => [r.key, r.params]));
  assert.equal(old.adsets_7d.time_range, JSON.stringify({ since: '2026-10-04', until: '2026-10-10' }));
});

test('לפי מודעה: הקבוצה ודירוגי האיכות. קרוסלה: קליקים לפי כרטיס', () => {
  const by = Object.fromEntries(buildReportRequests('123', { date_preset: 'maximum' }, { today }).map((r) => [r.key, r.params]));
  for (const f of ['adset_id', 'adset_name', 'inline_link_clicks', 'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking']) {
    assert.ok(by.ads.fields.split(',').includes(f), f);
  }
  assert.equal(by.cards.level, 'ad');
  assert.equal(by.cards.action_breakdowns, 'action_carousel_card_id');
  assert.match(by.cards.fields, /actions/);
});

test('גודל הקהל: בקשת קריאה לכל קבוצה שמזהה שלה ידוע', () => {
  const reqs = buildReportRequests('123', { date_preset: 'maximum' }, { today, adsetIds: ['55', '66'] });
  const aud = reqs.filter((r) => r.key.startsWith('audience:'));
  assert.deepEqual(aud.map((r) => r.path), ['55/delivery_estimate', '66/delivery_estimate']);
  assert.match(aud[0].params.fields, /estimate_mau_upper_bound/);
  assert.throws(() => buildReportRequests('123', {}, { adsetIds: ['55/../x'] }));
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

test('קליקים על הכפתור, מחיר לאלף, עלות לקליק, ומעבר מקליק לשיחה', () => {
  const r = normalizeRow(row(120, 4, { inline_link_clicks: '10' }));
  assert.equal(r.link_clicks, 10);
  assert.equal(r.link_ctr_pct, 1);
  assert.equal(r.cpm_ils, 120);
  assert.equal(r.cpc_ils, 6);
  assert.equal(r.cost_per_link_click_ils, 12);
  assert.equal(r.link_to_conversation_pct, 40);
});

test('בלי inline_link_clicks: לוקחים את link_click מתוך actions', () => {
  const r = normalizeRow(row(50, 0, { actions: [{ action_type: 'link_click', value: '7' }] }));
  assert.equal(r.link_clicks, 7);
});

test('בלי חשיפות או קליקים: המדדים המחושבים null, לא 0', () => {
  const r = normalizeRow({ spend: '0' });
  assert.equal(r.cpm_ils, null);
  assert.equal(r.cpc_ils, null);
  assert.equal(r.link_ctr_pct, null);
  assert.equal(r.cost_per_link_click_ils, null);
  assert.equal(r.link_to_conversation_pct, null);
});

test('כל פעולות הוואטסאפ נאספות, כולל חסימות', () => {
  const r = normalizeRow(row(100, 3, {
    actions: [
      { action_type: MESSAGING_ACTION, value: '3' },
      { action_type: FIRST_REPLY_ACTION, value: '2' },
      { action_type: 'onsite_conversion.messaging_block', value: '1' },
      { action_type: 'onsite_conversion.total_messaging_connection', value: '4' },
      { action_type: 'post_engagement', value: '30' },
    ],
  }));
  assert.deepEqual(r.messaging, {
    conversation_started_7d: 3, first_reply: 2, block: 1, total_messaging_connection: 4,
  });
  assert.equal(r.blocks, 1);
  assert.deepEqual(normalizeRow(row(10, 0)).messaging, {});
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

test('סיכום: קבוצות עם 7 ימים וגודל קהל, מודעות עם קבוצה ודירוג, כרטיסים, גיל, מגדר ומכשיר', () => {
  const rep = summarizeReport({
    total: { data: [row(150, 5)] },
    adsets: { data: [
      { adset_id: '55', adset_name: 'ק · מכירים את אלעד', ...row(50, 1, { reach: '400', frequency: '2.5' }) },
      { adset_id: '66', adset_name: 'ק · קהל חדש', ...row(100, 4) },
    ] },
    adsets_7d: { data: [{ adset_id: '55', reach: '300', frequency: '2.1', impressions: '630', spend: '35' }] },
    'audience:55': { data: [{ estimate_mau_lower_bound: 2800, estimate_mau_upper_bound: 3300, estimate_ready: true }] },
    ads: { data: [{
      ad_id: '9', ad_name: 'מכירים את אלעד · לירון', adset_id: '55', adset_name: 'ק · מכירים את אלעד',
      quality_ranking: 'AVERAGE', engagement_rate_ranking: 'UNKNOWN', ...row(40, 1),
    }] },
    cards: { data: [{
      ad_id: '9', ad_name: 'מכירים את אלעד · לירון', adset_name: 'ק · מכירים את אלעד',
      actions: [
        { action_type: 'link_click', action_carousel_card_id: '111', value: '5' },
        { action_type: 'link_click', action_carousel_card_id: '222', value: '2' },
      ],
    }] },
    age_gender: { data: [
      { age: '25-34', gender: 'female', ...row(30, 1, { impressions: '400', reach: '200', clicks: '8', inline_link_clicks: '3' }) },
      { age: '25-34', gender: 'male', ...row(10, 0, { impressions: '100', reach: '50', clicks: '2', inline_link_clicks: '1' }) },
      { age: '35-44', gender: 'female', ...row(60, 2, { impressions: '500', reach: '300', clicks: '10', inline_link_clicks: '4' }) },
    ] },
    device: { data: [{ device_platform: 'desktop', ...row(20, 0) }, { device_platform: 'mobile_app', ...row(130, 5) }] },
  });
  const warm = rep.adsets.find((a) => a.adset_id === '55');
  assert.equal(warm.adset, 'מכירים את אלעד');
  assert.equal(warm.reach, 400);
  assert.equal(warm.frequency_7d, 2.1);
  assert.equal(warm.reach_7d, 300);
  assert.deepEqual(warm.audience_size, { lower: 2800, upper: 3300 });
  assert.deepEqual(warm.reach_pct_of_audience, { low: 12.1, high: 14.3 }); // 400 מתוך 3,300 עד 2,800
  assert.equal(rep.adsets.find((a) => a.adset_id === '66').audience_size, null);
  assert.equal(rep.ads[0].adset, 'מכירים את אלעד');
  assert.equal(rep.ads[0].quality_ranking, 'AVERAGE');
  assert.equal(rep.ads[0].conversion_rate_ranking, null);
  assert.deepEqual(rep.cards, [
    { ad_id: '9', ad: 'לירון', adset: 'מכירים את אלעד', card_id: '111', link_clicks: 5 },
    { ad_id: '9', ad: 'לירון', adset: 'מכירים את אלעד', card_id: '222', link_clicks: 2 },
  ]);
  const young = rep.age.find((a) => a.age === '25-34');
  assert.equal(young.spend_ils, 40);
  assert.equal(young.impressions, 500);
  assert.equal(young.reach, 250);
  assert.equal(young.frequency, 2);
  assert.equal(young.link_clicks, 4);
  assert.equal(young.conversations, 1);
  assert.equal(rep.young_age.spend_pct, 40);
  assert.deepEqual(rep.gender.map((g) => [g.gender, g.spend_ils]), [['female', 90], ['male', 10]]);
  assert.deepEqual(rep.devices.map((d) => d.device), ['mobile_app', 'desktop']);
});

test('הדפסה: קליקים על הכפתור, מחיר לאלף, קבוצות עם 7 ימים וכרטיסים', () => {
  const rep = summarizeReport({
    total: { data: [row(150, 5, { inline_link_clicks: '30' })] },
    adsets: { data: [{ adset_id: '55', adset_name: 'ק · מכירים את אלעד', ...row(50, 1) }] },
    adsets_7d: { data: [{ adset_id: '55', reach: '300', frequency: '2.1' }] },
    cards: { data: [{ ad_id: '9', ad_name: 'לירון', actions: [{ action_type: 'link_click', action_carousel_card_id: '111', value: '5' }] }] },
    device: { data: [{ device_platform: 'desktop', ...row(20, 0) }] },
  });
  const text = formatReport(rep).join('\n');
  assert.match(text, /קליקים על הכפתור: 30/);
  assert.match(text, /מחיר לאלף: 150\.00₪/);
  assert.match(text, /מכירים את אלעד/);
  assert.match(text, /תדירות 7 ימים 2\.1/);
  assert.match(text, /כרטיס 111: 5/);
  assert.match(text, /מחשב/);
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
