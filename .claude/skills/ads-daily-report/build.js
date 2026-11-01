// בונה את קבצי הנתונים של דף הדוח היומי לאלעד, מתוך:
//   1. הפלט של node tools/meta-report.js <קמפיין> --json  (Meta, קריאה בלבד)
//   2. יומן השיחות - התיקייה ש-ArtifactData שמר עם out_dir (קובץ JSON לכל שיחה)
//   3. summary.json של האנליסט: {summary, warnings: [..]}
// שימוש:
//   node .claude/skills/ads-daily-report/build.js <report.json> <log-dir> <summary.json> <campaign-dir> <out-dir>
// הפלט: daily.json, ads.json, status.json ב-<out-dir>. בלי רשת, בלי טוקנים.
// מ-1.11.2026 גם variants.json (כל מודעה ב-Meta לבד) ו-placements.json (פיד / סטורי / ריל),
// לכרטיסים "4 המודעות" ו"לפי מיקום" בדף (datasets/variants, datasets/placements). מעלים את כל החמישה.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { positionName } from '../../../tools/lib/meta-report-build.js';

const [reportPath, logDir, summaryPath, campaignDir, outDir] = process.argv.slice(2);
if (!outDir) {
  console.log('שימוש: node build.js <report.json> <log-dir> <summary.json> <campaign-dir> <out-dir>');
  process.exit(1);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const report = readJson(reportPath);
const summary = existsSync(summaryPath) ? readJson(summaryPath) : {};
const campaignKey = basename(campaignDir.replace(/[\\/]+$/, ''));
// מפתח המודעה ביומן → מילה שמופיעה בשם המודעה ב-Meta (analytics/ads-map.json בתיקיית הקמפיין).
// הערך הוא מחרוזת (המילה), או מ-1.11 {match, label}: label הוא השם בדף. מפתח שמתחיל ב-"_" הוא הערה.
// מפתח אחד יכול להתאים לכמה מודעות ב-Meta (למשל "single" = בודדת עם טקסט + בודדת נקייה), והן מסוכמות.
const adsMap = Object.entries(readJson(join(campaignDir, 'analytics', 'ads-map.json')))
  .filter(([key]) => !key.startsWith('_'))
  .map(([key, v]) => (typeof v === 'string' ? { key, match: v, label: null } : { key, match: String(v.match), label: v.label || null }));
const logKeyOf = (adName) => (adsMap.find((m) => String(adName || '').includes(m.match)) || {}).key || null;

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
// "לא ענתה" (no_reply) לא נספרת כשיחה רלוונטית, גם כשסומנה מעצבת (ads-analyst.md, עדי 26.10). תוקן 1.11.
const isRel = (r) => RELEVANT.has(r.who) && r.status !== 'no_reply';
// via: 'private' = ראתה את המודעה ופנתה בפרטי (מ-21.10). Meta לא סופרת אותה, ולכן בהשוואה ל-Meta מורידים אותה.
// בלי השדה = דרך הכפתור במודעה.
const isPrivate = (r) => r.via === 'private';
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
    impressions: Number(m.impressions) || 0,
    link_clicks: Number(m.link_clicks) || 0,
    meta_conversations: Number(m.conversations) || 0,
    log_conversations: dayLog.length,
    private_conversations: dayLog.filter(isPrivate).length,
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
// מ-22.10 אותה מודעה רצה בכמה קבוצות מודעות (שם המודעה כולל את שם הקבוצה), ולכן מסכמים את כל המודעות של הפרויקט.
const ads = adsMap.map(({ key, match: word, label: mapLabel }) => {
  const matches = (report.ads || []).filter((a) => String(a.ad || '').includes(word));
  const list = log.filter((r) => r.ad === key);
  const spend = matches.reduce((s, a) => s + (Number(a.spend_ils) || 0), 0);
  const relevant = list.filter(isRel).length;
  // שם לתצוגה: החלק שאחרי "·" האחרון, בלי " - A"/" - B" (למשל "לירון חפץ - נתניה").
  const named = matches[0] || (report.status?.ads || []).find((a) => String(a.name || '').includes(word));
  const label = mapLabel || (named ? String(named.ad || named.name).split('·').pop().trim().replace(/\s-\s[AB]$/, '') : word);
  return {
    ad: label,
    groups: matches.length,
    spend_ils: round(spend),
    link_clicks: matches.reduce((s, a) => s + (Number(a.link_clicks) || 0), 0),
    meta_conversations: matches.reduce((s, a) => s + (Number(a.conversations) || 0), 0),
    log_conversations: list.length,
    private_conversations: list.filter(isPrivate).length,
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
// כרטיס המשפך (עדי, 26.10): הגיעו להצעת מחיר = עכשיו בהצעה, נסגרו, או שהייתה הצעה בהיסטוריה.
const reachedQuote = (r) => r.status === 'quote' || r.status === 'won' || (r.history || []).some((h) => h.status === 'quote');
// הקבוצה עם הקהל הכי קטן לפי Meta היא הקהל החם ("מכירים את אלעד"). אין גודל קהל = אין שדות warm_.
// מ-1.11: רק כשיש יותר מקבוצה אחת. בקמפיין של קבוצה אחת (designers-text-all-placements, קהל רחב)
// אין קהל חם נפרד, ולכן warm_ ריקים והדף מסתיר את השורה - אחרת הקהל הרחב היה מוצג כ"קהל חם".
const warm = (report.adsets || []).length > 1
  ? (report.adsets || []).filter((a) => a.audience_size)
    .sort((a, b) => a.audience_size.upper - b.audience_size.upper)[0]
  : undefined;
const num = (v) => (v == null ? null : Number(v));
const status = [{
  updated: report.fetched_at,
  day: dayN,
  campaign_status: report.status?.effective_status || '',
  spend_ils: round(totalSpend),
  impressions: Number(t.impressions) || 0,
  reach: Number(t.reach) || 0,
  link_clicks: num(t.link_clicks),
  cpm_ils: num(t.cpm_ils),
  cost_per_link_click_ils: num(t.cost_per_link_click_ils),
  link_to_conversation_pct: num(t.link_to_conversation_pct),
  meta_conversations: Number(t.conversations) || 0,
  log_conversations: log.length,
  private_conversations: log.filter(isPrivate).length,
  relevant: totalRel,
  quotes: log.filter(reachedQuote).length,
  // "לא ענתה" (מ-26.10) - נפרד מ"לא רלוונטי"
  no_reply: log.filter((r) => r.status === 'no_reply').length,
  warm_adset: warm ? warm.adset : null,
  warm_reach: warm ? warm.reach : null,
  warm_reach_pct_low: warm?.reach_pct_of_audience?.low ?? null,
  warm_reach_pct_high: warm?.reach_pct_of_audience?.high ?? null,
  warm_frequency_7d: warm ? warm.frequency_7d : null,
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

// --- כל מודעה ב-Meta לבד (מ-1.11) ---
// ביומן אלעד בוחר רק "צילום אחד" או "קולאז'", ולכן שיחות רלוונטיות אין כאן - רק מה ש-Meta יודעת.
// log_key אומר לאיזו שורה ב-ads.json המודעה שייכת. לא מחברים reach בין מודעות.
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
const adsSpend = (report.ads || []).reduce((s, a) => s + (Number(a.spend_ils) || 0), 0);
const adStatus = new Map((report.status?.ads || []).map((a) => [a.id, a.effective_status]));
const variants = (report.ads || []).map((a) => ({
  ad_id: a.ad_id,
  ad: a.ad,
  adset: a.adset || null,
  log_key: logKeyOf(a.ad),
  status: adStatus.get(a.ad_id) || null,
  spend_ils: round(Number(a.spend_ils) || 0),
  spend_pct: pct(Number(a.spend_ils) || 0, adsSpend),
  impressions: Number(a.impressions) || 0,
  cpm_ils: num(a.cpm_ils),
  link_clicks: Number(a.link_clicks) || 0,
  link_ctr_pct: num(a.link_ctr_pct),
  meta_conversations: Number(a.conversations) || 0,
  link_to_conversation_pct: num(a.link_to_conversation_pct),
}));

// --- לפי מיקום: פיד / סטורי / ריל, פייסבוק ואינסטגרם יחד (מ-1.11) ---
// מ-Meta בלבד: היומן לא יודע מאיזה מיקום הגיעה פנייה. reach לא מחברים, ולכן אין כאן אנשים.
const posGroups = new Map();
for (const p of report.positions || []) {
  const name = positionName(p.position);
  const g = posGroups.get(name) || { placement: name, spend_ils: 0, impressions: 0, link_clicks: 0, meta_conversations: 0, platforms: new Set() };
  g.spend_ils += Number(p.spend_ils) || 0;
  g.impressions += Number(p.impressions) || 0;
  g.link_clicks += Number(p.link_clicks) || 0;
  g.meta_conversations += Number(p.conversations) || 0;
  if (p.platform) g.platforms.add(p.platform);
  posGroups.set(name, g);
}
const posSpend = [...posGroups.values()].reduce((s, g) => s + g.spend_ils, 0);
const placements = [...posGroups.values()].map((g) => ({
  placement: g.placement,
  platforms: [...g.platforms].sort().join(', '),
  spend_ils: round(g.spend_ils),
  spend_pct: pct(g.spend_ils, posSpend),
  impressions: g.impressions,
  cpm_ils: g.impressions > 0 ? round((g.spend_ils / g.impressions) * 1000) : null,
  link_clicks: g.link_clicks,
  link_ctr_pct: g.impressions > 0 ? round((g.link_clicks / g.impressions) * 100) : null,
  meta_conversations: g.meta_conversations,
  link_to_conversation_pct: g.link_clicks > 0 ? round((g.meta_conversations / g.link_clicks) * 100) : null,
})).sort((a, b) => b.spend_ils - a.spend_ils);

mkdirSync(outDir, { recursive: true });
for (const [name, rows] of Object.entries({ daily, ads, status, variants, placements })) {
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(rows, null, 2));
}
console.log(`✅ נבנו daily.json (${daily.length} ימים), ads.json (${ads.length} שורות), status.json ב-${outDir}`);
console.log(`   ועוד variants.json (${variants.length} מודעות) ו-placements.json (${placements.length} מיקומים) - מעלים את כל החמישה`);
console.log(`   יום ${dayN} · הוצאה ${round(totalSpend)}₪ · ${totalRel} שיחות רלוונטיות · ${won.length} סגירות · ${revenue}₪`);
