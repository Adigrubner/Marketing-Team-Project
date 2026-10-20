// הידיים של האנליסט - שליפת נתוני ביצועים מ-Meta. קריאה בלבד, בטוח תמיד.
// אין כאן graphPost: הכלי לא יוצר, לא משנה, לא מפעיל ולא משהה כלום.
// שימוש:
//   node tools/meta-report.js                                        ← כל הקמפיינים בחשבון (30 יום אחרונים)
//   node tools/meta-report.js clients/<לקוח>/campaigns/<קמפיין>     ← דוח מלא על קמפיין אחד (המזהה מ-upload-log.json)
//   node tools/meta-report.js --campaign <מזהה>                      ← אותו דוח, לפי מזהה
//   --days 7 | --since 2026-10-20 [--until 2026-10-27]               ← טווח (ברירת מחדל בקמפיין: כל חייו)
//   --json                                                           ← פלט JSON (בשביל האנליסט)
//   --save                                                           ← שומר את הנתונים ב-<קמפיין>/analytics/data/<תאריך>.json
//
// הדוח המלא שולח 7 בקשות, עם הפסקה ביניהן. Meta מגבילה בקשות (code 17 ודומיו):
// הכלי מחכה ומנסה שוב (30 שניות ואז 90), ואם זה לא עובר - מציג מה שהספיק ומה חסר.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEnv, ROOT, ok, bad, warn, info, title } from './lib/env.js';
import { requireMetaEnv, graphGet, adAccountPath } from './lib/meta.js';
import {
  timeParams, buildReportRequests, runRequests, summarizeReport, formatReport, normalizeRow, isRateLimitError,
} from './lib/meta-report-build.js';

loadEnv();
try { requireMetaEnv(); } catch (e) { bad(e.message); process.exit(1); }

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const asJson = flag('--json');
const save = flag('--save');
const days = value('--days') ? Math.max(1, Number(value('--days')) || 30) : undefined;
const since = value('--since');
const until = value('--until');
const valueArgs = ['--days', '--since', '--until', '--campaign'].map(value);
const dirArg = args.find((a) => !a.startsWith('--') && !valueArgs.includes(a));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
if ((since && !dateRe.test(since)) || (until && !dateRe.test(until))) {
  bad('תאריך צריך להיות בפורמט 2026-10-20'); process.exit(1);
}

// --- איזה קמפיין? ---
let campaignId = value('--campaign');
let campaignDir;
if (dirArg) {
  campaignDir = resolve(ROOT, dirArg);
  const logPath = join(campaignDir, 'upload-log.json');
  if (!existsSync(logPath)) {
    bad(`אין upload-log.json ב-${dirArg} - הקמפיין הזה עוד לא נוצר ב-Meta (או שהנתיב לא נכון).`);
    process.exit(1);
  }
  const log = JSON.parse(readFileSync(logPath, 'utf8'));
  campaignId = (log.created || []).find((c) => c.type === 'campaign')?.id;
  if (!campaignId) { bad('לא מצאתי מזהה קמפיין ב-upload-log.json.'); process.exit(1); }
}
if (save && !campaignDir) { bad('--save עובד רק עם נתיב של תיקיית קמפיין.'); process.exit(1); }

try {
  if (campaignId) await campaignReport();
  else await accountReport();
} catch (e) {
  bad(`שליפת הדוח נכשלה: ${e.message}`);
  if (isRateLimitError(e)) info('Meta הגבילה זמנית את מספר הבקשות. מנסים שוב בעוד כמה דקות (לפעמים שעה).');
  else console.log('טיפ: הריצו npm run doctor, או הדביקו את השגיאה לקלוד.');
  process.exit(1);
}

// --- דוח מלא על קמפיין אחד ---
async function campaignReport() {
  const range = timeParams({ since, until, days });
  const rangeText = range.date_preset ? 'כל חיי הקמפיין' : Object.values(JSON.parse(range.time_range)).join(' עד ');
  const requests = buildReportRequests(campaignId, range);
  const { raw, failed } = await runRequests(requests, {
    get: graphGet,
    sleep,
    onWait: (r, ms) => !asJson && warn(`Meta הגבילה בקשות (${r.label}). מחכה ${ms / 1000} שניות ומנסה שוב...`),
  });
  const report = summarizeReport(raw);
  const result = {
    campaign_id: campaignId,
    range: range.date_preset ? { preset: 'maximum' } : JSON.parse(range.time_range),
    fetched_at: new Date().toISOString(),
    ...report,
    missing: failed,
  };

  if (save) {
    const dir = join(campaignDir, 'analytics', 'data');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${result.fetched_at.slice(0, 10)}.json`);
    writeFileSync(file, JSON.stringify(result, null, 2));
    if (!asJson) ok(`הנתונים נשמרו: ${file.slice(ROOT.length + 1)}`);
  }

  if (asJson) { console.log(JSON.stringify(result, null, 2)); return; }

  title('דוח קמפיין · קריאה בלבד');
  for (const line of formatReport(report, { range: rangeText })) console.log(line);
  if (failed.length) {
    console.log('');
    warn('חסרים חלקים בדוח:');
    for (const f of failed) info(`${f.label}: ${f.message}`);
    if (failed.some((f) => f.rate_limited)) info('Meta הגבילה בקשות. מריצים שוב בעוד כמה דקות.');
  }
  console.log('');
  info('השיחות כאן הן הספירה של Meta. מי פנה ומה נסגר - ביומן השיחות של אלעד.');
}

// --- כל הקמפיינים בחשבון (המצב הישן) ---
async function accountReport() {
  const range = timeParams({ since, until, days: days || 30 });
  const res = await graphGet(adAccountPath('insights'), {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,reach,frequency,clicks,ctr,actions',
    limit: 50,
    ...range,
  });
  const span = JSON.parse(range.time_range);
  const rows = (res.data || []).map((d) => ({ campaign_id: d.campaign_id, campaign: d.campaign_name, ...normalizeRow(d) }));

  if (asJson) { console.log(JSON.stringify({ ...span, campaigns: rows }, null, 2)); return; }
  title(`דוח ביצועים · ${span.since} עד ${span.until}`);
  if (!rows.length) info('אין עדיין נתונים בטווח הזה (קמפיין מושהה או חדש = 0 הוצאה, וזה תקין).');
  for (const r of rows) {
    console.log(`\n📣 ${r.campaign}`);
    info(`הוצאה: ${r.spend_ils.toFixed(2)}₪ · חשיפות: ${r.impressions} · תדירות: ${r.frequency} · קליקים: ${r.clicks} · CTR: ${r.ctr_pct}%`);
    info(`שיחות וואטסאפ: ${r.conversations}` +
      (r.cost_per_conversation_ils != null ? ` · עלות לשיחה: ${r.cost_per_conversation_ils.toFixed(2)}₪` : '') +
      (r.leads ? ` · לידים: ${r.leads}` : ''));
  }
  console.log('');
  ok('לדוח מלא על קמפיין אחד: node tools/meta-report.js clients/<לקוח>/campaigns/<קמפיין>');
}
