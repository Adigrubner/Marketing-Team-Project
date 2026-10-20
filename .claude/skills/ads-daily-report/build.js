// בונה את קבצי הנתונים של דף הדוח היומי לאלעד, מתוך:
//   1. הפלט של node tools/meta-report.js <קמפיין> --json  (Meta, קריאה בלבד)
//   2. יומן השיחות - התיקייה ש-ArtifactData שמר עם out_dir (קובץ JSON לכל שיחה)
//   3. summary.json של האנליסט: {summary, warnings: [..]}
// שימוש:
//   node .claude/skills/ads-daily-report/build.js <report.json> <log-dir> <summary.json> <campaign-dir> <out-dir>
// הפלט: daily.json, ads.json, status.json ב-<out-dir>. בלי רשת, בלי טוקנים.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const [reportPath, logDir, summaryPath, campaignDir, outDir] = process.argv.slice(2);
if (!outDir) {
  console.log('שימוש: node build.js <report.json> <log-dir> <summary.json> <campaign-dir> <out-dir>');
  process.exit(1);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const report = readJson(reportPath);
const summary = existsSync(summaryPath) ? readJson(summaryPath) : {};
const campaignKey = basename(campaignDir.replace(/[\\/]+$/, ''));
// מפתח המודעה ביומן → מילה שמופיעה בשם המודעה ב-Meta (analytics/ads-map.json בתיקיית הקמפיין)
const adsMap = readJson(join(campaignDir, 'analytics', 'ads-map.json'));

// --- יומן השיחות ---
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f.endsWith('.json') ? [p] : [];
  });
}
const log = walk(logDir)
  .map((p) => { const j = readJson(p); return j && typeof j.data === 'object' && j.data ? j.data : j; })
  .filter((r) => r && r.campaign === campaignKey);
const RELEVANT = new Set(['designer', 'architect']);
const isRel = (r) => RELEVANT.has(r.who);
const amount = (r) => (r.status === 'won' ? Number(r.amount_ils) || 0 : 0);

// --- לפי יום ---
// שיחה נספרת ביום שבו פנו (date). סגירה והכנסה נספרות ביום שבו נסגר (closed_at), כי ליד יכול להימשך כמה ימים.
const round = (v) => Math.round(v * 100) / 100;
const closedOn = (r) => r.closed_at || r.date;
const metaDaily = new Map((report.daily || []).map((d) => [d.date, d]));
const dates = [...new Set([
  ...metaDaily.keys(),
  ...log.map((r) => r.date).filter(Boolean),
  ...log.filter((r) => r.status === 'won').map(closedOn).filter(Boolean),
])].sort();
// אין עדיין אף יום (קמפיין מושהה): שורה אחת של היום, באפסים - קובץ ריק הדף לא מצליח לקרוא.
if (!dates.length) dates.push(String(report.fetched_at || new Date().toISOString()).slice(0, 10));
let cumSpend = 0; let cumRel = 0; let cumRev = 0; let cumConv = 0;
const daily = dates.map((date) => {
  const m = metaDaily.get(date) || {};
  const dayLog = log.filter((r) => r.date === date);
  const dayWon = log.filter((r) => r.status === 'won' && closedOn(r) === date);
  const spend = Number(m.spend_ils) || 0;
  const relevant = dayLog.filter(isRel).length;
  const revenue = dayWon.reduce((s, r) => s + amount(r), 0);
  cumSpend += spend; cumRel += relevant; cumRev += revenue; cumConv += Number(m.conversations) || 0;
  return {
    date,
    spend_ils: round(spend),
    meta_conversations: Number(m.conversations) || 0,
    log_conversations: dayLog.length,
    relevant,
    won: dayWon.length,
    revenue_ils: revenue,
    cum_spend_ils: round(cumSpend),
    cum_meta_conversations: cumConv,
    cum_relevant: cumRel,
    cum_revenue_ils: cumRev,
    cost_per_relevant_ils: cumRel > 0 ? round(cumSpend / cumRel) : null,
  };
});

// --- לפי פרויקט ---
const ads = Object.entries(adsMap).map(([key, word]) => {
  const m = (report.ads || []).find((a) => String(a.ad || '').includes(word)) || {};
  const list = log.filter((r) => r.ad === key);
  const spend = Number(m.spend_ils) || 0;
  const relevant = list.filter(isRel).length;
  const statusAd = (report.status?.ads || []).find((a) => String(a.name || '').includes(word));
  return {
    ad: statusAd?.name || m.ad || word,
    spend_ils: round(spend),
    meta_conversations: Number(m.conversations) || 0,
    log_conversations: list.length,
    relevant,
    won: list.filter((r) => r.status === 'won').length,
    revenue_ils: list.reduce((s, r) => s + amount(r), 0),
    cost_per_relevant_ils: relevant > 0 ? round(spend / relevant) : null,
  };
});

// --- מה השתנה: אתמול מול שלשום ---
// הבדיקה רצה בבוקר, אז היום עוד כמעט ריק. משווים את היום המלא האחרון (אתמול) ליום שלפניו.
const fetchedDay = String(report.fetched_at || '').slice(0, 10);
const full = daily.filter((d) => d.date < fetchedDay);
const y = full[full.length - 1];
const p = full[full.length - 2];
const pick = (row, key) => (row ? row[key] : null);
const compare = {
  y_date: y?.date || null,
  p_date: p?.date || null,
  y_spend_ils: pick(y, 'spend_ils'), p_spend_ils: pick(p, 'spend_ils'),
  y_meta_conversations: pick(y, 'meta_conversations'), p_meta_conversations: pick(p, 'meta_conversations'),
  y_relevant: pick(y, 'relevant'), p_relevant: pick(p, 'relevant'),
  y_won: pick(y, 'won'), p_won: pick(p, 'won'),
  y_revenue_ils: pick(y, 'revenue_ils'), p_revenue_ils: pick(p, 'revenue_ils'),
  // עלות מצטברת לשיחה רלוונטית בסוף כל יום - ירידה היא שיפור
  y_cost_per_relevant_ils: pick(y, 'cost_per_relevant_ils'), p_cost_per_relevant_ils: pick(p, 'cost_per_relevant_ils'),
};

// --- מצב ---
const t = report.total || {};
const won = log.filter((r) => r.status === 'won');
const totalSpend = Number(t.spend_ils) || 0;
const totalRel = log.filter(isRel).length;
const revenue = won.reduce((s, r) => s + amount(r), 0);
const firstSpend = report.first_spend_date;
const dayN = firstSpend
  ? Math.floor((Date.parse(report.fetched_at.slice(0, 10)) - Date.parse(firstSpend)) / 86400000) + 1
  : 0;
const status = [{
  updated: report.fetched_at,
  day: dayN,
  campaign_status: report.status?.effective_status || '',
  spend_ils: round(totalSpend),
  meta_conversations: Number(t.conversations) || 0,
  log_conversations: log.length,
  relevant: totalRel,
  open: log.filter((r) => r.status === 'open' || r.status === 'quote').length,
  // כמה ימים בממוצע מהפנייה ועד הסגירה (רק מה שנסגר)
  avg_days_to_close: won.length
    ? round(won.reduce((s, r) => s + (Date.parse(closedOn(r)) - Date.parse(r.date)) / 86400000, 0) / won.length)
    : null,
  won: won.length,
  revenue_ils: revenue,
  cost_per_relevant_ils: totalRel > 0 ? round(totalSpend / totalRel) : null,
  cost_per_won_ils: won.length > 0 ? round(totalSpend / won.length) : null,
  return_per_ils: totalSpend > 0 ? round(revenue / totalSpend) : null,
  frequency: Number(t.frequency) || 0,
  summary: String(summary.summary || ''),
  warnings: (summary.warnings || []).map(String).join(' · '),
  missing: (report.missing || []).map((f) => f.label).join(', '),
  ...compare,
}];

mkdirSync(outDir, { recursive: true });
for (const [name, rows] of Object.entries({ daily, ads, status })) {
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(rows, null, 2));
}
console.log(`✅ נבנו daily.json (${daily.length} ימים), ads.json (${ads.length} פרויקטים), status.json ב-${outDir}`);
console.log(`   יום ${dayN} · הוצאה ${round(totalSpend)}₪ · ${totalRel} שיחות רלוונטיות · ${won.length} סגירות · ${revenue}₪`);
