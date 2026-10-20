// החישובים של כלי הדוחות - בלי רשת, ולכן אפשר לבדוק אותם (npm test).
// הכלי tools/meta-report.js רק שולח את הבקשות שנבנות כאן ומדפיס את מה שמחושב כאן.
// הכל קריאה בלבד: אין כאן ולא יהיו כאן בקשות כתיבה ל-Meta.

// שיחה בוואטסאפ שנפתחה מהמודעה (חלון ייחוס של 7 ימים) - זה המדד של הקמפיין.
export const MESSAGING_ACTION = 'onsite_conversion.messaging_conversation_started_7d';
// תשובה ראשונה של הפונה אחרי הודעת הפתיחה - סימן שהשיחה באמת התחילה.
export const FIRST_REPLY_ACTION = 'onsite_conversion.messaging_first_reply';
const LEAD_ACTIONS = ['lead', 'onsite_web_lead'];

// קבוצות הגיל של Meta קבועות: 18-24, 25-34, 35-44... אין קבוצה של 25-29.
// לכן "כמה הולך על 25-29" נבדק דרך 25-34 - הקבוצה היחידה שמכילה אותם.
export const YOUNG_AGE_BUCKET = '25-34';

const BASE_FIELDS = 'spend,impressions,reach,frequency,clicks,ctr,actions';

// טווח התאריכים: --since (מיום ההפעלה), --days, או כל חיי הקמפיין.
export function timeParams({ since, until, days, today = new Date() } = {}) {
  const day = (d) => d.toISOString().slice(0, 10);
  if (since) return { time_range: JSON.stringify({ since, until: until || day(today) }) };
  if (days) {
    return { time_range: JSON.stringify({ since: day(new Date(today.getTime() - days * 86400000)), until: day(today) }) };
  }
  return { date_preset: 'maximum' };
}

// כל הבקשות לדוח של קמפיין אחד, לפי הסדר. כל אחת היא GET בלבד.
export function buildReportRequests(campaignId, range) {
  if (!/^\d+$/.test(String(campaignId || ''))) throw new Error('מזהה קמפיין חסר או לא תקין');
  const insights = `${campaignId}/insights`;
  return [
    { key: 'status', label: 'מצב הקמפיין והמודעות', path: String(campaignId),
      params: { fields: 'name,effective_status,ads.limit(50){name,effective_status}' } },
    { key: 'total', label: 'סה"כ', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, ...range } },
    { key: 'daily', label: 'לפי יום', path: insights,
      params: { level: 'campaign', fields: 'spend,actions', time_increment: 1, limit: 100, ...range } },
    { key: 'ads', label: 'לפי מודעה', path: insights,
      params: { level: 'ad', fields: `ad_id,ad_name,${BASE_FIELDS}`, limit: 100, ...range } },
    { key: 'platform', label: 'לפי רשת', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, breakdowns: 'publisher_platform', limit: 100, ...range } },
    { key: 'position', label: 'לפי מיקום', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, breakdowns: 'publisher_platform,platform_position', limit: 100, ...range } },
    { key: 'age', label: 'לפי גיל', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, breakdowns: 'age', limit: 100, ...range } },
  ];
}

export function actionValue(actions, type) {
  const types = Array.isArray(type) ? type : [type];
  return (actions || [])
    .filter((a) => types.includes(a.action_type))
    .reduce((sum, a) => sum + Number(a.value || 0), 0);
}

const num = (v) => Number(v || 0);
const round2 = (v) => Math.round(v * 100) / 100;

// שורה אחת מ-Meta → המספרים שהאנליסט צריך. העלות לשיחה מחושבת כאן (הוצאה / שיחות),
// כדי שתהיה עקבית בכל פילוח. אין שיחות = null, לא 0 (0₪ לשיחה זה שקר).
export function normalizeRow(d = {}) {
  const spend = num(d.spend);
  const conversations = actionValue(d.actions, MESSAGING_ACTION);
  return {
    spend_ils: round2(spend),
    impressions: num(d.impressions),
    reach: num(d.reach),
    frequency: round2(num(d.frequency)),
    clicks: num(d.clicks),
    ctr_pct: round2(num(d.ctr)),
    conversations,
    first_replies: actionValue(d.actions, FIRST_REPLY_ACTION),
    cost_per_conversation_ils: conversations > 0 ? round2(spend / conversations) : null,
    leads: actionValue(d.actions, LEAD_ACTIONS),
  };
}

const PLATFORM_NAMES = { facebook: 'פייסבוק', instagram: 'אינסטגרם', messenger: 'מסנג\'ר', audience_network: 'רשת השותפים' };
const POSITION_NAMES = {
  feed: 'פיד', story: 'סטורי', instagram_stories: 'סטורי', facebook_stories: 'סטורי',
  instagram_reels: 'ריל', facebook_reels: 'ריל', reels: 'ריל',
  instagram_explore: 'אקספלור', instagram_explore_grid_home: 'אקספלור', marketplace: 'מרקטפלייס',
  video_feeds: 'פיד וידאו', search: 'חיפוש', instream_video: 'וידאו', profile_feed: 'פיד פרופיל',
  facebook_reels_overlay: 'ריל (שכבה)', right_hand_column: 'עמודה ימנית', instagram_profile_feed: 'פיד פרופיל',
};
export const platformName = (p) => PLATFORM_NAMES[p] || p || 'לא ידוע';
export const positionName = (p) => POSITION_NAMES[p] || p || 'לא ידוע';

// אחוז מתוך סה"כ, מעוגל. סה"כ 0 = null.
export const share = (part, total) => (total > 0 ? Math.round((part / total) * 1000) / 10 : null);

// כמה כסף ושיחות הלכו לקבוצת גיל אחת, מתוך הכל.
export function ageShare(ageRows, bucket = YOUNG_AGE_BUCKET) {
  const total = ageRows.reduce((s, r) => s + r.spend_ils, 0);
  const totalConv = ageRows.reduce((s, r) => s + r.conversations, 0);
  const row = ageRows.find((r) => r.age === bucket) || { spend_ils: 0, conversations: 0 };
  return {
    bucket,
    spend_ils: row.spend_ils,
    spend_pct: share(row.spend_ils, total),
    conversations: row.conversations,
    conversations_pct: share(row.conversations, totalConv),
  };
}

// שם מודעה בלי שם הקמפיין שלפניה: "קמפיין · לירון חפץ - נתניה" → "לירון חפץ - נתניה".
export const shortAdName = (name = '') => String(name).split(' · ').pop();

// הנתונים הגולמיים מכל הבקשות → דוח אחד מסודר.
export function summarizeReport(raw = {}) {
  const rows = (key) => (raw[key]?.data || []);
  const status = raw.status
    ? {
      name: raw.status.name,
      effective_status: raw.status.effective_status,
      ads: (raw.status.ads?.data || []).map((a) => ({ id: a.id, name: shortAdName(a.name), effective_status: a.effective_status })),
    }
    : null;
  const daily = rows('daily').map((d) => ({ date: d.date_start, ...normalizeRow(d) }));
  const age = rows('age').map((d) => ({ age: d.age, ...normalizeRow(d) }))
    .sort((a, b) => a.age.localeCompare(b.age));
  return {
    status,
    total: raw.total ? normalizeRow(rows('total')[0]) : null,
    days_with_spend: daily.filter((d) => d.spend_ils > 0).length,
    first_spend_date: daily.find((d) => d.spend_ils > 0)?.date || null,
    daily,
    ads: rows('ads').map((d) => ({ ad_id: d.ad_id, ad: shortAdName(d.ad_name), ...normalizeRow(d) }))
      .sort((a, b) => b.spend_ils - a.spend_ils),
    platforms: rows('platform').map((d) => ({ platform: d.publisher_platform, ...normalizeRow(d) })),
    positions: rows('position').map((d) => ({ platform: d.publisher_platform, position: d.platform_position, ...normalizeRow(d) }))
      .sort((a, b) => b.spend_ils - a.spend_ils),
    age,
    young_age: raw.age ? ageShare(age) : null,
  };
}

// הגבלת בקשות של Meta: code 4 (אפליקציה), 17 (משתמש), 32 (דף), 613, ו-80000-80099 (Marketing API).
export function isRateLimitError(err) {
  const c = Number(err?.code);
  return [4, 17, 32, 613].includes(c) || (c >= 80000 && c < 80100);
}

// כמה מחכים לפני ניסיון חוזר אחרי הגבלה: 30 שניות, ואז 90. אחר כך מוותרים.
export const RETRY_DELAYS_MS = [30000, 90000];

// מריץ את הבקשות אחת אחרי השנייה. הגבלת בקשות → מחכה ומנסה שוב.
// אם ההגבלה לא עוברת - עוצר, ומחזיר את מה שהספיק + מה חסר (בלי לזרוק).
// get ו-sleep מוזרקים, כדי לבדוק בלי רשת ובלי לחכות באמת.
export async function runRequests(requests, { get, sleep, gapMs = 1500, delays = RETRY_DELAYS_MS, onWait } = {}) {
  const raw = {};
  const failed = [];
  for (let i = 0; i < requests.length; i++) {
    const r = requests[i];
    if (i > 0 && gapMs) await sleep(gapMs);
    for (let attempt = 0; ; attempt++) {
      try {
        raw[r.key] = await get(r.path, r.params);
        break;
      } catch (e) {
        if (isRateLimitError(e) && attempt < delays.length) {
          onWait?.(r, delays[attempt], e);
          await sleep(delays[attempt]);
          continue;
        }
        failed.push({ key: r.key, label: r.label, message: e.message, rate_limited: isRateLimitError(e) });
        if (isRateLimitError(e)) {
          // אין טעם להמשיך להציף - שאר הבקשות יחכו להרצה הבאה.
          for (const rest of requests.slice(i + 1)) {
            failed.push({ key: rest.key, label: rest.label, message: 'לא נשלחה - Meta הגבילה בקשות', rate_limited: true });
          }
          return { raw, failed };
        }
        break;
      }
    }
  }
  return { raw, failed };
}

// --- הדפסה ---
const ils = (v) => (v == null ? '-' : `${v.toFixed(2)}₪`);
const STATUS_NAMES = {
  ACTIVE: 'פעיל', PAUSED: 'מושהה', CAMPAIGN_PAUSED: 'מושהה (הקמפיין)', ADSET_PAUSED: 'מושהה (האד-סט)',
  PENDING_REVIEW: 'בבדיקה של Meta', DISAPPROVED: 'נדחה', WITH_ISSUES: 'עם בעיה', IN_PROCESS: 'בתהליך',
  ARCHIVED: 'בארכיון', DELETED: 'נמחק',
};
export const statusName = (s) => STATUS_NAMES[s] || s || 'לא ידוע';

function rowLine(name, r) {
  return `${name}: ${ils(r.spend_ils)} · ${r.impressions} חשיפות · תדירות ${r.frequency} · ` +
    `${r.conversations} שיחות · ${ils(r.cost_per_conversation_ils)} לשיחה`;
}

// הדוח כשורות טקסט בעברית (בלי צבעים ובלי טוקנים).
export function formatReport(rep, { range = '' } = {}) {
  const out = [];
  if (rep.status) {
    out.push(`📣 ${rep.status.name} · ${statusName(rep.status.effective_status)}`);
    for (const a of rep.status.ads) out.push(`   מודעה: ${a.name} · ${statusName(a.effective_status)}`);
  }
  if (range) out.push(`   טווח: ${range}`);
  if (rep.total) {
    const t = rep.total;
    out.push('', '💰 סה"כ');
    out.push(`   הוצאה: ${ils(t.spend_ils)} · ימים עם הוצאה: ${rep.days_with_spend}` +
      (rep.first_spend_date ? ` (מ-${rep.first_spend_date})` : ''));
    out.push(`   חשיפות: ${t.impressions} · אנשים: ${t.reach} · תדירות: ${t.frequency}`);
    out.push(`   קליקים: ${t.clicks} · CTR: ${t.ctr_pct}%`);
    out.push(`   שיחות וואטסאפ (ספירת Meta): ${t.conversations} · עלות לשיחה: ${ils(t.cost_per_conversation_ils)}` +
      ` · ענו להודעת הפתיחה: ${t.first_replies}`);
    if (t.spend_ils === 0) out.push('   (אין הוצאה - הקמפיין מושהה או עוד לא התחיל. זה תקין.)');
  }
  const section = (title, list, nameOf) => {
    if (!list.length) return;
    out.push('', title);
    for (const r of list) out.push(`   ${rowLine(nameOf(r), r)}`);
  };
  section('🖼️ לפי מודעה (פרויקט)', rep.ads, (r) => r.ad);
  section('📱 לפי רשת', rep.platforms, (r) => platformName(r.platform));
  section('📍 לפי מיקום', rep.positions, (r) => `${platformName(r.platform)} - ${positionName(r.position)}`);
  section('👥 לפי גיל', rep.age, (r) => r.age);
  if (rep.young_age && rep.total?.spend_ils > 0) {
    const y = rep.young_age;
    out.push(`   ⚠️ ${y.bucket} (כולל 25-29): ${y.spend_pct ?? 0}% מהכסף, ${y.conversations_pct ?? 0}% מהשיחות.` +
      ' Meta לא מפרידה את 25-29 מ-30-34.');
  }
  return out;
}
