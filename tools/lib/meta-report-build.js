// החישובים של כלי הדוחות - בלי רשת, ולכן אפשר לבדוק אותם (npm test).
// הכלי tools/meta-report.js רק שולח את הבקשות שנבנות כאן ומדפיס את מה שמחושב כאן.
// הכל קריאה בלבד: אין כאן ולא יהיו כאן בקשות כתיבה ל-Meta.

// שיחה בוואטסאפ שנפתחה מהמודעה (חלון ייחוס של 7 ימים) - זה המדד של הקמפיין.
export const MESSAGING_ACTION = 'onsite_conversion.messaging_conversation_started_7d';
// "New Messaging Conversations" אצל Meta: הפונה שלחה הודעה ראשונה כאיש קשר חדש.
// לא אומר שאלעד ענה, וגם לא שהשיחה התקדמה.
export const FIRST_REPLY_ACTION = 'onsite_conversion.messaging_first_reply';
// מישהו חסם את העסק בוואטסאפ אחרי המודעה - סימן אזהרה.
export const BLOCK_ACTION = 'onsite_conversion.messaging_block';
const LEAD_ACTIONS = ['lead', 'onsite_web_lead'];

// קבוצות הגיל של Meta קבועות: 18-24, 25-34, 35-44... אין קבוצה של 25-29.
// לכן "כמה הולך על 25-29" נבדק דרך 25-34 - הקבוצה היחידה שמכילה אותם.
export const YOUNG_AGE_BUCKET = '25-34';

// inline_link_clicks = קליקים על קישור, כולל כפתור הוואטסאפ. "clicks" הם כל הקליקים (לייק, פרופיל, תמונה...).
const BASE_FIELDS = 'spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,actions';
// דירוגי האיכות של Meta - מופיעים רק ממודעה עם כ-500 חשיפות ומעלה.
const RANKING_FIELDS = 'quality_ranking,engagement_rate_ranking,conversion_rate_ranking';

// טווח התאריכים: --since (מיום ההפעלה), --days, או כל חיי הקמפיין.
export function timeParams({ since, until, days, today = new Date() } = {}) {
  const day = (d) => d.toISOString().slice(0, 10);
  if (since) return { time_range: JSON.stringify({ since, until: until || day(today) }) };
  if (days) {
    return { time_range: JSON.stringify({ since: day(new Date(today.getTime() - days * 86400000)), until: day(today) }) };
  }
  return { date_preset: 'maximum' };
}

// 7 הימים שמסתיימים בסוף הטווח (או היום). תדירות של 7 ימים לכל קבוצה - זה מה שבודקים בקהל קטן.
function last7Range(range, today) {
  const day = (d) => d.toISOString().slice(0, 10);
  const until = range?.time_range ? JSON.parse(range.time_range).until : day(today);
  const since = day(new Date(Date.parse(until) - 6 * 86400000));
  return { time_range: JSON.stringify({ since, until }) };
}

// כל הבקשות לדוח של קמפיין אחד, לפי הסדר. כל אחת היא GET בלבד.
// adsetIds (מ-upload-log.json): לכל קבוצה עוד בקשת קריאה של גודל הקהל שלה.
export function buildReportRequests(campaignId, range, { adsetIds = [], today = new Date() } = {}) {
  if (!/^\d+$/.test(String(campaignId || ''))) throw new Error('מזהה קמפיין חסר או לא תקין');
  for (const id of adsetIds) if (!/^\d+$/.test(String(id))) throw new Error('מזהה קבוצת מודעות לא תקין');
  const insights = `${campaignId}/insights`;
  return [
    { key: 'status', label: 'מצב הקמפיין והמודעות', path: String(campaignId),
      params: { fields: 'name,effective_status,ads.limit(50){name,effective_status}' } },
    { key: 'total', label: 'סה"כ', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, ...range } },
    { key: 'daily', label: 'לפי יום', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, time_increment: 1, limit: 100, ...range } },
    // reach ותדירות של קבוצה מגיעים רק מ-Meta: אסור לחבר את המספרים של המודעות (אותו אדם נספר בכל מודעה).
    { key: 'adsets', label: 'לפי קבוצה', path: insights,
      params: { level: 'adset', fields: `adset_id,adset_name,${BASE_FIELDS}`, limit: 50, ...range } },
    { key: 'adsets_7d', label: 'לפי קבוצה, 7 ימים', path: insights,
      params: { level: 'adset', fields: 'adset_id,adset_name,spend,impressions,reach,frequency', limit: 50, ...last7Range(range, today) } },
    { key: 'ads', label: 'לפי מודעה', path: insights,
      params: { level: 'ad', fields: `ad_id,ad_name,adset_id,adset_name,${BASE_FIELDS},${RANKING_FIELDS}`, limit: 100, ...range } },
    // Meta נותנת לכל כרטיס בקרוסלה רק קליקים על קישור. שיחות לפי כרטיס - אין.
    { key: 'cards', label: 'לפי כרטיס בקרוסלה', path: insights,
      params: { level: 'ad', fields: 'ad_id,ad_name,adset_name,actions', action_breakdowns: 'action_carousel_card_id', limit: 100, ...range } },
    { key: 'platform', label: 'לפי רשת', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, breakdowns: 'publisher_platform', limit: 100, ...range } },
    { key: 'position', label: 'לפי מיקום', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, breakdowns: 'publisher_platform,platform_position', limit: 100, ...range } },
    { key: 'age_gender', label: 'לפי גיל ומגדר', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, breakdowns: 'age,gender', limit: 100, ...range } },
    { key: 'device', label: 'לפי מכשיר', path: insights,
      params: { level: 'campaign', fields: BASE_FIELDS, breakdowns: 'device_platform', limit: 100, ...range } },
    ...adsetIds.map((id) => ({
      key: `audience:${id}`, label: `גודל הקהל (${id})`, path: `${id}/delivery_estimate`,
      params: { fields: 'estimate_mau_lower_bound,estimate_mau_upper_bound,estimate_ready' },
    })),
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

// כל פעולות ההודעות ש-Meta החזירה, בלי לנחש מראש אילו יופיעו:
// "onsite_conversion.messaging_block" → block, "onsite_conversion.total_messaging_connection" → total_messaging_connection.
export function messagingActions(actions) {
  const out = {};
  for (const a of actions || []) {
    const t = a.action_type || '';
    if (!t.startsWith('onsite_conversion.') || !t.includes('messaging')) continue;
    const key = t.slice('onsite_conversion.'.length).replace(/^messaging_/, '');
    out[key] = (out[key] || 0) + num(a.value);
  }
  return out;
}

// מחלקים רק כשיש במה. אין = null, לא 0.
const ratio = (part, whole, times = 1) => (whole > 0 ? round2((part / whole) * times) : null);

// שורה אחת מ-Meta → המספרים שהאנליסט צריך. העלויות מחושבות כאן (הוצאה / כמות),
// כדי שיהיו עקביות בכל פילוח. אין שיחות = null, לא 0 (0₪ לשיחה זה שקר).
export function normalizeRow(d = {}) {
  const spend = num(d.spend);
  const impressions = num(d.impressions);
  const clicks = num(d.clicks);
  const conversations = actionValue(d.actions, MESSAGING_ACTION);
  const linkClicks = d.inline_link_clicks != null ? num(d.inline_link_clicks) : actionValue(d.actions, 'link_click');
  return {
    spend_ils: round2(spend),
    impressions,
    reach: num(d.reach),
    frequency: round2(num(d.frequency)),
    clicks,
    ctr_pct: round2(num(d.ctr)),
    link_clicks: linkClicks,
    link_ctr_pct: ratio(linkClicks, impressions, 100),
    cpm_ils: ratio(spend, impressions, 1000),
    cpc_ils: ratio(spend, clicks),
    cost_per_link_click_ils: ratio(spend, linkClicks),
    conversations,
    first_replies: actionValue(d.actions, FIRST_REPLY_ACTION),
    blocks: actionValue(d.actions, BLOCK_ACTION),
    link_to_conversation_pct: ratio(conversations, linkClicks, 100),
    cost_per_conversation_ils: ratio(spend, conversations),
    leads: actionValue(d.actions, LEAD_ACTIONS),
    messaging: messagingActions(d.actions),
  };
}

// כמה שורות גולמיות (למשל גיל 25-34 נשים + גברים) → שורה גולמית אחת. reach מחברים רק כשהאנשים
// בשורות שונים (כל אדם בגיל ומגדר אחד), ואז התדירות מחושבת מחדש.
export function mergeRawRows(list) {
  const sum = (k) => list.reduce((s, r) => s + num(r[k]), 0);
  const actions = {};
  for (const r of list) for (const a of r.actions || []) actions[a.action_type] = (actions[a.action_type] || 0) + num(a.value);
  const impressions = sum('impressions');
  const reach = sum('reach');
  const clicks = sum('clicks');
  return {
    spend: sum('spend'), impressions, reach, clicks,
    inline_link_clicks: sum('inline_link_clicks'),
    frequency: reach > 0 ? impressions / reach : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    actions: Object.entries(actions).map(([action_type, value]) => ({ action_type, value })),
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

// שורות לפי מפתח אחד (גיל / מגדר) מתוך פילוח של גיל ומגדר יחד.
function groupRows(list, key) {
  const groups = new Map();
  for (const r of list) groups.set(r[key], [...(groups.get(r[key]) || []), r]);
  return [...groups].map(([value, rs]) => ({ [key]: value, ...normalizeRow(mergeRawRows(rs)) }));
}

// גודל הקהל של קבוצה (delivery_estimate): טווח של Meta, או null אם אין.
function audienceSize(raw, adsetId) {
  const d = raw[`audience:${adsetId}`]?.data?.[0];
  if (!d || d.estimate_mau_upper_bound == null) return null;
  return { lower: num(d.estimate_mau_lower_bound), upper: num(d.estimate_mau_upper_bound) };
}

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
  // גיל: מפילוח גיל ומגדר (מ-27.10.2026), או מפילוח גיל בלבד בנתונים ישנים.
  const age = (raw.age_gender ? groupRows(rows('age_gender'), 'age') : rows('age').map((d) => ({ age: d.age, ...normalizeRow(d) })))
    .sort((a, b) => a.age.localeCompare(b.age));
  const week = new Map(rows('adsets_7d').map((d) => [d.adset_id, d]));
  const adsets = rows('adsets').map((d) => {
    const w = week.get(d.adset_id);
    const size = audienceSize(raw, d.adset_id);
    const r = normalizeRow(d);
    return {
      adset_id: d.adset_id,
      adset: shortAdName(d.adset_name),
      ...r,
      reach_7d: w ? num(w.reach) : null,
      frequency_7d: w ? round2(num(w.frequency)) : null,
      audience_size: size,
      // איזה חלק מהקהל כבר ראה: מהגבול העליון של הקהל (הכי נמוך) ועד התחתון (הכי גבוה).
      reach_pct_of_audience: size ? { low: share(r.reach, size.upper), high: share(r.reach, size.lower) } : null,
    };
  }).sort((a, b) => b.spend_ils - a.spend_ils);
  const cards = rows('cards').flatMap((d) => (d.actions || [])
    .filter((a) => a.action_carousel_card_id && (!a.action_type || a.action_type === 'link_click'))
    .map((a) => ({
      ad_id: d.ad_id, ad: shortAdName(d.ad_name), adset: d.adset_name ? shortAdName(d.adset_name) : null,
      card_id: String(a.action_carousel_card_id), link_clicks: num(a.value),
    })));
  return {
    status,
    total: raw.total ? normalizeRow(rows('total')[0]) : null,
    days_with_spend: daily.filter((d) => d.spend_ils > 0).length,
    first_spend_date: daily.find((d) => d.spend_ils > 0)?.date || null,
    daily,
    adsets,
    ads: rows('ads').map((d) => ({
      ad_id: d.ad_id, ad: shortAdName(d.ad_name), adset_id: d.adset_id || null,
      adset: d.adset_name ? shortAdName(d.adset_name) : null,
      ...normalizeRow(d),
      quality_ranking: d.quality_ranking || null,
      engagement_rate_ranking: d.engagement_rate_ranking || null,
      conversion_rate_ranking: d.conversion_rate_ranking || null,
    })).sort((a, b) => b.spend_ils - a.spend_ils),
    cards,
    platforms: rows('platform').map((d) => ({ platform: d.publisher_platform, ...normalizeRow(d) })),
    positions: rows('position').map((d) => ({ platform: d.publisher_platform, position: d.platform_position, ...normalizeRow(d) }))
      .sort((a, b) => b.spend_ils - a.spend_ils),
    age,
    young_age: raw.age || raw.age_gender ? ageShare(age) : null,
    gender: raw.age_gender ? groupRows(rows('age_gender'), 'gender').sort((a, b) => b.spend_ils - a.spend_ils) : [],
    devices: rows('device').map((d) => ({ device: d.device_platform, ...normalizeRow(d) }))
      .sort((a, b) => b.spend_ils - a.spend_ils),
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

const DEVICE_NAMES = { mobile_app: 'טלפון (אפליקציה)', mobile_web: 'טלפון (דפדפן)', desktop: 'מחשב' };
const GENDER_NAMES = { female: 'נשים', male: 'גברים', unknown: 'לא ידוע' };
export const deviceName = (d) => DEVICE_NAMES[d] || d || 'לא ידוע';
const genderName = (g) => GENDER_NAMES[g] || g || 'לא ידוע';
const RANKING_NAMES = {
  ABOVE_AVERAGE: 'מעל הממוצע', AVERAGE: 'ממוצע', BELOW_AVERAGE_35: 'מתחת (35% התחתונים)',
  BELOW_AVERAGE_20: 'מתחת (20% התחתונים)', BELOW_AVERAGE_10: 'מתחת (10% התחתונים)', UNKNOWN: 'אין מספיק חשיפות',
};
const rankingName = (r) => RANKING_NAMES[r] || r;

function rowLine(name, r) {
  return `${name}: ${ils(r.spend_ils)} · ${r.impressions} חשיפות · מחיר לאלף ${ils(r.cpm_ils)} · תדירות ${r.frequency} · ` +
    `${r.link_clicks} קליקים על הכפתור · ${r.conversations} שיחות · ${ils(r.cost_per_conversation_ils)} לשיחה`;
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
    out.push(`   חשיפות: ${t.impressions} · אנשים: ${t.reach} · תדירות: ${t.frequency} · מחיר לאלף: ${ils(t.cpm_ils)}`);
    out.push(`   כל הקליקים: ${t.clicks} (CTR ${t.ctr_pct}%, ${ils(t.cpc_ils)} לקליק) · ` +
      `קליקים על הכפתור: ${t.link_clicks} (${t.link_ctr_pct ?? 0}%, ${ils(t.cost_per_link_click_ils)} לקליק)`);
    out.push(`   שיחות וואטסאפ (ספירת Meta): ${t.conversations} · עלות לשיחה: ${ils(t.cost_per_conversation_ils)}` +
      ` · מקליק על הכפתור לשיחה: ${t.link_to_conversation_pct ?? '-'}% · אנשי קשר חדשים: ${t.first_replies}` +
      (t.blocks ? ` · ⚠️ חסמו: ${t.blocks}` : ''));
    if (t.spend_ils === 0) out.push('   (אין הוצאה - הקמפיין מושהה או עוד לא התחיל. זה תקין.)');
  }
  const section = (title, list, nameOf) => {
    if (!list?.length) return;
    out.push('', title);
    for (const r of list) out.push(`   ${rowLine(nameOf(r), r)}`);
  };
  if (rep.adsets?.length) {
    out.push('', '🎯 לפי קבוצה (אנשים ותדירות של הקבוצה, לא סכום של המודעות)');
    for (const a of rep.adsets) {
      out.push(`   ${rowLine(a.adset, a)}`);
      out.push(`      7 ימים: ${a.reach_7d ?? '-'} אנשים · תדירות 7 ימים ${a.frequency_7d ?? '-'}` +
        (a.audience_size ? ` · גודל הקהל ${a.audience_size.lower}-${a.audience_size.upper}` +
          ` · ראו ${a.reach_pct_of_audience.low}%-${a.reach_pct_of_audience.high}% ממנו` : ''));
    }
  }
  section('🖼️ לפי מודעה (פרויקט)', rep.ads, (r) => (r.adset ? `${r.adset} · ${r.ad}` : r.ad));
  const ranked = (rep.ads || []).filter((a) => a.quality_ranking && a.quality_ranking !== 'UNKNOWN');
  for (const a of ranked) {
    out.push(`   דירוג ${a.ad}: איכות ${rankingName(a.quality_ranking)} · מעורבות ${rankingName(a.engagement_rate_ranking)}` +
      ` · המרה ${rankingName(a.conversion_rate_ranking)}`);
  }
  if (rep.cards?.length) {
    out.push('', '🎠 קרוסלה - קליקים על הכפתור לפי כרטיס');
    for (const c of rep.cards) out.push(`   ${c.adset ? `${c.adset} · ` : ''}${c.ad} · כרטיס ${c.card_id}: ${c.link_clicks}`);
  }
  section('📱 לפי רשת', rep.platforms, (r) => platformName(r.platform));
  section('📍 לפי מיקום', rep.positions, (r) => `${platformName(r.platform)} - ${positionName(r.position)}`);
  section('💻 לפי מכשיר', rep.devices, (r) => deviceName(r.device));
  section('🚻 לפי מגדר', rep.gender, (r) => genderName(r.gender));
  section('👥 לפי גיל', rep.age, (r) => r.age);
  if (rep.young_age && rep.total?.spend_ils > 0) {
    const y = rep.young_age;
    out.push(`   ⚠️ ${y.bucket} (כולל 25-29): ${y.spend_pct ?? 0}% מהכסף, ${y.conversations_pct ?? 0}% מהשיחות.` +
      ' Meta לא מפרידה את 25-29 מ-30-34.');
  }
  return out;
}
