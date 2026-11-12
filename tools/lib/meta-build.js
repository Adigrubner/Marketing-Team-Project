// בניית הבקשות ל-Meta - פונקציות טהורות, בלי רשת ובלי קבצים.
// ה-dry-run, מצב הבדיקה (--check) והיצירה (--confirm) משתמשים באותן פונקציות,
// ולכן מה שמוצג ב-dry-run הוא בדיוק מה שנשלח.
//
// 🛑 בלם החירום כאן:
//   - כל קמפיין, אד-סט ומודעה נבנים עם status: 'PAUSED'. אין פרמטר שמשנה את זה.
//   - תקציב מעל התקרה (לכל קבוצת מודעות, וגם הסכום של כל הקבוצות), רשת שותפים, מסנג'ר
//     או מדינה שלא ב-safety.json - נעצרים בבדיקת התוכנית.
//   - קידום פוסט קיים: רק פוסט של הדף של הלקוח. והסך היומי של כל מה שרץ בחשבון + התוכנית
//     נבדק מול התקרה (judgeAccountBudget) לפני יצירה.
//   - קידום חשיפה / מעורבות (goal: "reach" / "engagement", מ-1.11.2026): רק existing_post, בלי וואטסאפ.
//     אותם בלמים בדיוק (PAUSED, תקרה לכל קבוצה ולסך הכולל, רק פייסבוק ואינסטגרם).

export const WHATSAPP_LINK = 'https://api.whatsapp.com/send';

// המיקומים המותרים. בכוונה בלי audience_network ובלי messenger.
export const ALLOWED_POSITIONS = {
  facebook: ['feed', 'story', 'facebook_reels', 'profile_feed', 'marketplace', 'video_feeds', 'search'],
  instagram: ['stream', 'story', 'reels', 'profile_feed', 'ig_search'],
};

// ברירת המחדל: פיד, סטורי וריל - בפייסבוק ובאינסטגרם.
export const DEFAULT_PLACEMENTS = {
  facebook: ['feed', 'story', 'facebook_reels'],
  instagram: ['stream', 'story', 'reels'],
};

// --- תמונה לכל מיקום (placement_images במודעה) - מ-29.10.2026 ---
//   { "name": "...", "text": "...", "placement_images": { "feed": "creatives/x-4x5.jpg", "story": "creatives/x-9x16.jpg" } }
// סטורי וריל (בשתי הרשתות) מקבלים את תמונת story. כל מיקום אחר בתוכנית (פיד, פרופיל, חיפוש...) - את תמונת feed.
// נבנה ב-asset_feed_spec עם asset_customization_rules (Placement Asset Customization), באותו מבנה
// ש-Ads Manager עצמו בונה למודעת וואטסאפ עם תמונה לכל מיקום (נקרא מהחשבון של אלעד, קריאה בלבד, 29.10.2026).
export const VERTICAL_POSITIONS = { facebook: ['story', 'facebook_reels'], instagram: ['story', 'reels'] };
export const PLACEMENT_IMAGE_KEYS = { feed: 'פיד', story: 'סטורי וריל' };
const PLACEMENT_IMAGE_SIZE = { feed: 'תמונה 4:5', story: 'תמונה 9:16' };
// השמות של התוויות (adlabels) שמחברות כל תמונה לכלל שלה. Meta שומרת אותן ברמת החשבון ומשתמשת בהן שוב.
export const PLACEMENT_LABELS = { feed: 'placement_feed', story: 'placement_story' };
export const POSITION_NAMES = {
  facebook: {
    feed: 'פיד פייסבוק', story: 'סטורי פייסבוק', facebook_reels: 'ריל פייסבוק', profile_feed: 'פרופיל פייסבוק',
    marketplace: 'מרקטפלייס', video_feeds: 'פיד וידאו פייסבוק', search: 'חיפוש פייסבוק',
  },
  instagram: {
    stream: 'פיד אינסטגרם', story: 'סטורי אינסטגרם', reels: 'ריל אינסטגרם', profile_feed: 'פרופיל אינסטגרם', ig_search: 'חיפוש אינסטגרם',
  },
};
export const positionName = (platform, pos) => POSITION_NAMES[platform]?.[pos] || `${platform}.${pos}`;
export const hasPlacementImages = (ad) => Boolean(ad && ad.placement_images !== undefined);

// השיפורים האוטומטיים של Meta שמכבים: התמונות של הלקוח נשארות כמו שנחתכו -
// בלי שינוי בהירות, בלי מוזיקה או אנימציה, בלי טקסט שנוסף ובלי סידור מחדש.
export const CREATIVE_FEATURES_OPT_OUT = [
  'adapt_to_placement',
  'image_animation',
  'image_background_gen',
  'image_templates',
  'image_touchups',
  'inline_comment',
  'multi_photo_to_video',
  'text_optimizations',
  'description_automation',
];

// פירוט טירגוט מקצועי (audience.detailed) - רק הסוגים האלה. נשלחים כקבוצה אחת ב-flexible_spec,
// כלומר מספיק שאדם עונה על אחד מהם ("או").
// המזהים נמצאים בחיפוש של Meta (קריאה בלבד): GET /search?type=adeducationmajor / adworkposition
export const DETAILED_TYPES = {
  education_majors: 'תחומי לימוד',
  work_positions: 'תפקידים',
};

// Meta הסירה את targeting_optimization באופטימיזציה לשיחות וללחיצות: הרחבת פירוט הטירגוט תמיד דלוקה.
// נבדק מול Meta ב-21.10.2026 (delivery_estimate, קריאה בלבד): code 100, subcode 1870197.
export const DETAILED_EXPANSION_FORCED_SUBCODE = 1870197;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
// מזהים של Meta ארוכים מדי למספר ב-JavaScript (120240633155310745 משתבש), ולכן רק מחרוזת של ספרות.
const isIdString = (v) => typeof v === 'string' && /^\d+$/.test(v);

// האם זו תוכנית בפורמט החדש (רשימת מודעות) או בפורמט הישן (מודעה אחת)?
export const isMultiAdPlan = (plan) => Array.isArray(plan?.ads);

// האם בתוכנית יש כמה קבוצות מודעות (ad_sets), לכל אחת קהל ותקציב משלה?
export const hasAdSets = (plan) => Array.isArray(plan?.ad_sets);

// הוספת מודעות לקבוצה שכבר רצה (מ-12.11.2026, לבקשת עדי): add_to_adset במקום תקציב וקהל.
//   { "add_to_adset": { "campaign_id": "<הקמפיין הקיים>", "adset_id": "<הקבוצה הקיימת>" }, "ads": [...] }
// לא נוצר קמפיין ולא נוצרת קבוצה, והקבוצה הקיימת לא משתנה בכלל (תקציב, קהל, תאריכים, סטטוס).
// נוצרים רק קריאייטיבים ומודעות - PAUSED, כמו תמיד. הקבוצה נבדקת מול Meta (קריאה בלבד) לפני יצירה.
export const isAddToAdSetPlan = (plan) => Boolean(plan && plan.add_to_adset !== undefined);
const ADD_TO_ADSET_FORBIDDEN = {
  daily_budget_ils: 'תקציב',
  audience: 'קהל',
  ad_sets: 'קבוצות מודעות',
  end_date: 'תאריך סיום',
  frequency_cap: 'הגבלת תדירות',
};

function validateAddToAdSet(plan) {
  const t = plan.add_to_adset;
  if (!t || typeof t !== 'object' || Array.isArray(t)) {
    return ['add_to_adset צריך להיות { "campaign_id": "...", "adset_id": "..." } - המזהים של הקמפיין והקבוצה הקיימים'];
  }
  const errors = [];
  if (!isIdString(t.campaign_id)) errors.push('add_to_adset.campaign_id - מזהה הקמפיין הקיים, כמחרוזת של ספרות (ב-upload-log.json של הקמפיין)');
  if (!isIdString(t.adset_id)) errors.push('add_to_adset.adset_id - מזהה הקבוצה הקיימת, כמחרוזת של ספרות (ב-upload-log.json של הקמפיין)');
  if (!isMultiAdPlan(plan)) errors.push('add_to_adset נתמך רק בתוכנית עם רשימת מודעות (ads)');
  for (const [k, he] of Object.entries(ADD_TO_ADSET_FORBIDDEN)) {
    if (plan[k] !== undefined) {
      errors.push(`add_to_adset: אין כאן ${k} (${he}). מוסיפים מודעות לקבוצה קיימת, והיא נשארת בדיוק כמו שהיא. שינוי בקבוצה - רק ידנית ב-Ads Manager`);
    }
  }
  if (goalOf(plan) !== 'whatsapp') errors.push('add_to_adset נתמך כרגע רק בקמפיין שיחות בוואטסאפ (בלי goal)');
  if (Array.isArray(plan.ads) && plan.ads.some(isExistingPostAd)) {
    errors.push('add_to_adset: קידום פוסט קיים (existing_post) לא נתמך כאן - רק מודעות חדשות עם תמונות וטקסט');
  }
  return errors;
}

// 🛑 הקבוצה הקיימת, כפי ש-Meta מחזירה אותה (קריאה בלבד), מול התוכנית.
// meta: { name, account_id, campaign_id, effective_status, optimization_goal, destination_type, daily_budget, targeting }
// מחזיר { problems: [...חוסמות], lines: [...מידע] }
export function judgeExistingAdSet(meta, plan, { accountId }) {
  const problems = [];
  const t = plan.add_to_adset;
  const acct = String(meta?.account_id ?? '').replace(/^act_/, '');
  if (acct !== String(accountId ?? '').replace(/^act_/, '')) problems.push('הקבוצה לא נמצאת בחשבון המודעות של הלקוח');
  if (String(meta?.campaign_id) !== String(t.campaign_id)) problems.push(`הקבוצה שייכת לקמפיין אחר (${meta?.campaign_id}), לא לזה שבתוכנית (${t.campaign_id})`);
  if (meta?.destination_type !== 'WHATSAPP' || meta?.optimization_goal !== 'CONVERSATIONS') {
    problems.push(`זו לא קבוצה של שיחות בוואטסאפ (יעד: ${meta?.destination_type || '?'}, אופטימיזציה: ${meta?.optimization_goal || '?'})`);
  }
  if (['DELETED', 'ARCHIVED'].includes(meta?.effective_status)) problems.push(`הקבוצה ${meta.effective_status === 'DELETED' ? 'נמחקה' : 'בארכיון'}`);

  // המיקומים חייבים להיות זהים: לפיהם נבנה הכלל "איזו תמונה לאיזה מיקום" בקריאייטיב
  const sorted = (xs) => [...(xs || [])].sort().join(',');
  const pl = placementsOf(plan);
  const tg = meta?.targeting || {};
  const same =
    sorted(tg.publisher_platforms) === sorted(Object.keys(pl)) &&
    sorted(tg.facebook_positions) === sorted(pl.facebook) &&
    sorted(tg.instagram_positions) === sorted(pl.instagram);
  if (!same) {
    const of = (fb, ig) => `facebook: ${sorted(fb) || '-'} · instagram: ${sorted(ig) || '-'}`;
    problems.push(
      `המיקומים בתוכנית (${of(pl.facebook, pl.instagram)}) לא זהים למיקומים של הקבוצה (${of(tg.facebook_positions, tg.instagram_positions)}). ` +
      'מעתיקים לתוכנית את המיקומים של הקבוצה, כדי שכל תמונה תלך למיקום הנכון'
    );
  }
  const lines = [
    `"${meta?.name}" · ${meta?.effective_status}` +
      `${Number(meta?.daily_budget) > 0 ? ` · ${Number(meta.daily_budget) / 100}₪ ליום (לא משתנה)` : ''}`,
  ];
  return { problems, lines };
}

// קידום פוסט שכבר עלה (existing_post במודעה): הפוסט רץ כמו שהוא - אותו טקסט, אותן תמונות,
// והלייקים והתגובות נשארים עליו. אין כאן תמונות להעלות ואין טקסט לכתוב.
//   { "name": "...", "existing_post": { "platform": "facebook", "id": "<PAGE_ID>_<POST_ID>", "url": "..." } }
//   { "name": "...", "existing_post": { "platform": "instagram", "id": "<מזהה המדיה>", "url": "..." } }
// את המזהים מוצאים עם node tools/meta-posts.js (קריאה בלבד).
export const EXISTING_POST_PLATFORMS = { facebook: 'פייסבוק', instagram: 'אינסטגרם' };
export const isExistingPostAd = (ad) => Boolean(ad && ad.existing_post !== undefined);

// --- המטרה של התוכנית (goal) - מ-1.11.2026 (עדי: "כן, לשדרג" ו"כן, גם מעורבות") ---
// בלי goal: שיחות בוואטסאפ, בדיוק כמו קודם (destination: "whatsapp").
// goal: "reach" / "engagement": קידום של פוסט שכבר עלה בלבד (existing_post בכל המודעות),
//   בלי וואטסאפ, בלי הודעה מוכנה ובלי כפתור. הפוסט רץ כמו שהוא, והלייקים והתגובות נשארים עליו.
// השילובים לפי התיעוד של Marketing API (Ad Set, טבלת ההגבלות של ODAX, נבדק 1.11.2026):
//   חשיפה - OUTCOME_AWARENESS עם REACH. מעורבות - OUTCOME_ENGAGEMENT, "On Post" (ON_POST) עם POST_ENGAGEMENT.
// ⚠️ את האד-סט Meta בודקת רק ביצירה (--check לא יכול), ולכן שני הסוגים יאומתו בפעם הראשונה ב---confirm.
export const PROMOTE_GOALS = {
  reach: {
    he: 'קידום חשיפה של פוסט קיים',
    why: 'להראות את הפוסט לכמה שיותר אנשים שונים מהקהל, כמה פעמים בשבוע, בזול',
    meta: 'חשיפה - OUTCOME_AWARENESS · אופטימיזציה REACH (כמה שיותר אנשים שונים) · חיוב לפי חשיפות',
    objective: 'OUTCOME_AWARENESS',
    optimization_goal: 'REACH',
  },
  engagement: {
    he: 'קידום מעורבות של פוסט קיים',
    why: 'Meta מחפשת את מי שסביר שתעשה לייק, תגובה, שמירה או שיתוף על הפוסט. מי שעושה את זה נכנסת לקהל החם',
    meta: 'מעורבות - OUTCOME_ENGAGEMENT · אופטימיזציה POST_ENGAGEMENT (מעורבות בפוסט) · יעד ON_POST · חיוב לפי חשיפות',
    objective: 'OUTCOME_ENGAGEMENT',
    optimization_goal: 'POST_ENGAGEMENT',
    destination_type: 'ON_POST',
  },
};
export const goalOf = (plan) => plan?.goal ?? 'whatsapp';
// ההגדרות של המטרה, או null (גם ל-goal כמו "toString", שלא ייתפס כמטרה בטעות)
export const promoteGoalOf = (plan) =>
  typeof plan?.goal === 'string' && Object.hasOwn(PROMOTE_GOALS, plan.goal) ? PROMOTE_GOALS[plan.goal] : null;
export const isPromoteGoalPlan = (plan) => Boolean(promoteGoalOf(plan));

// הגבלת תדירות - רק בחשיפה. לפי Meta: frequency_control_specs נכתב רק כשהאופטימיזציה היא REACH (או THRUPLAY),
// והחשיפות והימים בין 1 ל-90 (התיעוד של Ad Set, נבדק 1.11.2026). ברירת המחדל: עד 2 חשיפות לאדם בכל 7 ימים.
//   בתוכנית (רשות): "frequency_cap": { "impressions": 2, "days": 7 }
export const DEFAULT_FREQUENCY_CAP = { impressions: 2, days: 7 };
export const frequencyCapOf = (plan) =>
  goalOf(plan) === 'reach' ? { ...DEFAULT_FREQUENCY_CAP, ...(plan.frequency_cap || {}) } : null;

// התמונות שמודעה אחת מעלה: קידום פוסט - אף אחת; תמונה לכל מיקום - פיד ואז סטורי; אחרת - images כמו שהן.
export function adImagesOf(ad) {
  if (isExistingPostAd(ad)) return [];
  if (hasPlacementImages(ad)) return [...new Set([ad.placement_images.feed, ad.placement_images.story])];
  return [...ad.images];
}
const imagesOfAds = (plan) => [...new Set(plan.ads.flatMap(adImagesOf))];

export function placementsOf(plan) {
  return plan.placements || DEFAULT_PLACEMENTS;
}

// המיקומים של התוכנית, מחולקים לשתי קבוצות: story (סטורי וריל) ו-feed (כל השאר).
// מחזיר { feed: { facebook: [...], instagram: [...] }, story: { ... } } - רק רשתות שיש להן מיקום בקבוצה.
export function placementGroupsOf(plan) {
  const groups = { feed: {}, story: {} };
  for (const [platform, positions] of Object.entries(placementsOf(plan))) {
    if (!Array.isArray(positions)) continue;
    const vertical = VERTICAL_POSITIONS[platform] || [];
    const story = positions.filter((p) => vertical.includes(p));
    const feed = positions.filter((p) => !vertical.includes(p));
    if (story.length) groups.story[platform] = story;
    if (feed.length) groups.feed[platform] = feed;
  }
  return groups;
}

const groupWhere = (group) =>
  Object.entries(group).flatMap(([platform, positions]) => positions.map((p) => positionName(platform, p))).join(', ');

// לתצוגה ב-dry-run: איזו תמונה הולכת לאיזה מיקום. [{ key, title, file, where }]
export function placementImagesOf(plan, ad) {
  const groups = placementGroupsOf(plan);
  return ['feed', 'story'].map((key) => ({
    key,
    title: PLACEMENT_IMAGE_KEYS[key],
    file: ad.placement_images[key],
    where: groupWhere(groups[key]),
  }));
}

// הקהל של קבוצת מודעות אחת, עם ברירות המחדל.
// השדות החדשים (קהלים מותאמים, פירוט טירגוט, הרחבות) מופיעים רק אם הם בתוכנית -
// ולכן תוכנית ישנה מקבלת בדיוק את אותו אובייקט כמו קודם.
export function audienceSpecOf(a = {}, safety) {
  const adv = a.advantage_audience === true;
  const out = {
    countries: a.countries || safety.allowedCountries || ['IL'],
    age_min: a.age_min || 21,
    ...(a.age_max ? { age_max: a.age_max } : {}),
    advantage_audience: adv,
  };
  if (Array.isArray(a.custom_audiences) && a.custom_audiences.length) {
    out.custom_audiences = a.custom_audiences;
    // ברירת המחדל: כמו הקהל האוטומטי. בלי קהל אוטומטי = בלי הרחבה.
    out.custom_audience_expansion = a.custom_audience_expansion ?? adv;
  }
  if (Array.isArray(a.excluded_custom_audiences) && a.excluded_custom_audiences.length) {
    out.excluded_custom_audiences = a.excluded_custom_audiences;
  }
  if (a.detailed && typeof a.detailed === 'object' && detailedItemsOf(a.detailed).length) {
    out.detailed = a.detailed;
    out.detailed_expansion = a.detailed_expansion ?? adv;
  }
  return out;
}

export function audienceOf(plan, safety) {
  return audienceSpecOf(plan.audience || {}, safety);
}

// האם הקהל משתמש ביכולות החדשות (קהלים מותאמים / החרגות / פירוט טירגוט)?
export const usesAdvancedAudience = (aud) =>
  Boolean(aud.custom_audiences || aud.excluded_custom_audiences || aud.detailed);

// כל הפריטים של פירוט הטירגוט, ברשימה אחת: [{ type, id, name }]
export function detailedItemsOf(detailed) {
  if (!detailed || typeof detailed !== 'object') return [];
  return Object.keys(DETAILED_TYPES).flatMap((type) =>
    (Array.isArray(detailed[type]) ? detailed[type] : []).map((x) => ({ type, id: x?.id, name: x?.name }))
  );
}

// קבוצות המודעות של התוכנית, בצורה אחידה.
// תוכנית בלי ad_sets = קבוצה אחת, בדיוק כמו קודם (אותו שם, אותו תקציב, אותו קהל).
export function adSetsOf(plan) {
  // מוסיפים לקבוצה קיימת: אין כאן קבוצה חדשה, אין תקציב חדש ואין קהל חדש
  if (isAddToAdSetPlan(plan)) return [];
  if (!hasAdSets(plan)) {
    return [{
      label: null,
      name: `${plan.name} · Ad Set`,
      daily_budget_ils: plan.daily_budget_ils,
      audience: plan.audience || {},
    }];
  }
  return plan.ad_sets.map((s) => ({
    label: s?.name,
    name: `${plan.name} · ${s?.name}`,
    daily_budget_ils: s?.daily_budget_ils,
    audience: s?.audience || {},
  }));
}

export const totalDailyBudgetIls = (plan) =>
  adSetsOf(plan).reduce((sum, s) => sum + (Number.isFinite(s.daily_budget_ils) ? s.daily_budget_ils : 0), 0);

// האם צריך לבדוק את הקהלים מול Meta (קריאה בלבד) לפני יצירה?
export const needsAudiencePreflight = (plan, safety) =>
  hasAdSets(plan) || adSetsOf(plan).some((s) => usesAdvancedAudience(audienceSpecOf(s.audience, safety)));

// כל הקהלים המותאמים בתוכנית (כולל החרגות), כל מזהה פעם אחת.
export function customAudienceRefsOf(plan, safety) {
  const refs = new Map();
  for (const s of adSetsOf(plan)) {
    const a = audienceSpecOf(s.audience, safety);
    for (const [list, excluded] of [[a.custom_audiences, false], [a.excluded_custom_audiences, true]]) {
      for (const x of list || []) {
        const r = refs.get(x.id) || { id: x.id, name: x.name, usedIn: [] };
        r.usedIn.push({ adSet: s.label, excluded });
        if (!r.name && x.name) r.name = x.name;
        refs.set(x.id, r);
      }
    }
  }
  return [...refs.values()];
}

// הערכת גודל בעברית. Meta לא מראה מספר מדויק מתחת ל-1,000.
export function sizeRangeText(lo, hi) {
  const n = (x) => Number(x).toLocaleString('en-US');
  if (!Number.isFinite(Number(hi)) || Number(hi) < 0) return 'אין הערכה';
  if (Number(hi) === 0) return '0 איש';
  if (Number(hi) <= 1000) return 'עד כ-1,000 איש (מתחת ל-1,000 Meta לא מראה מספר מדויק)';
  return Number(lo) === Number(hi) ? `כ-${n(hi)} איש` : `${n(lo)}-${n(hi)} איש`;
}

// שיפוט של קהל מותאם לפי מה ש-Meta מחזירה (GET /{id}). מחזיר בעיות (חוסמות) ואזהרות.
export function judgeCustomAudience(meta, { accountId, expectedName } = {}) {
  const problems = [];
  const warnings = [];
  if (accountId && String(meta?.account_id) !== String(accountId)) {
    problems.push('הקהל לא שייך לחשבון המודעות הזה');
  }
  const ds = meta?.delivery_status;
  if (ds?.code !== 200) {
    problems.push(`Meta: אי אפשר להשתמש בו במודעות (${ds?.code ?? 'בלי סטטוס'}${ds?.description ? ` - ${ds.description}` : ''})`);
  }
  const os = meta?.operation_status;
  if (os?.code === 441) warnings.push('הקהל עוד מתמלא. אפשר לפרסם, והגודל יגדל.');
  else if (os?.code === 450) warnings.push(`"לא מעודכן" (450): ${(os.description || 'לא שימש במודעה זמן רב').replace(/\.\s*$/, '')}. Meta עדיין מסמנת אותו מוכן לשימוש.`);
  else if (Number.isFinite(os?.code) && os.code >= 400) warnings.push(`Meta: ${os.code} - ${os.description || ''}`.trim());
  if (expectedName && meta?.name && meta.name !== expectedName) {
    warnings.push(`השם ב-Meta ("${meta.name}") שונה מהשם בתוכנית ("${expectedName}") - לוודא שזה המזהה הנכון`);
  }
  return { problems, warnings };
}

// "2026-11-05" → סוף היום בשעון ישראל, בפורמט ש-Meta מקבלת.
export function endTimeOf(endDate) {
  const probe = new Date(`${endDate}T12:00:00Z`);
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', timeZoneName: 'longOffset' })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName').value; // "GMT+02:00"
  const offset = tz.replace('GMT', '') || '+00:00';
  return `${endDate}T23:59:00${offset}`;
}

// --- בדיקת התוכנית ---
// מחזיר רשימת שגיאות בעברית. רשימה ריקה = התוכנית תקינה.
// fileExists: (נתיב יחסי לתיקיית הקמפיין) => boolean
export function validatePlan(plan, { safety, fileExists, today = new Date() }) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };

  need(isNonEmptyString(plan.name), 'חסר name (שם הקמפיין)');

  if (isAddToAdSetPlan(plan)) {
    // בלי תקציב ובלי קהל - הקבוצה הקיימת לא משתנה
    errors.push(...validateAddToAdSet(plan));
    if (!isMultiAdPlan(plan)) return errors;
  } else if (!hasAdSets(plan)) {
    need(Number.isFinite(plan.daily_budget_ils) && plan.daily_budget_ils > 0, 'חסר daily_budget_ils (תקציב יומי בשקלים)');

    // 🛑 בלם: תקרת תקציב
    if (Number.isFinite(plan.daily_budget_ils) && plan.daily_budget_ils > safety.maxDailyBudgetIls) {
      errors.push(
        `התקציב בתוכנית (${plan.daily_budget_ils}₪/יום) חורג מתקרת בלם החירום (${safety.maxDailyBudgetIls}₪/יום). ` +
        'מקטינים את התקציב בתוכנית, או שהבעלים מעדכן ידנית את config/safety.json.'
      );
    }
    if (plan.audience !== undefined) errors.push(...validateAudience(plan.audience, 'audience', safety));
  } else {
    errors.push(...validateAdSets(plan, safety));
  }

  if (!isMultiAdPlan(plan)) {
    if (hasAdSets(plan)) errors.push('ad_sets נתמך רק בתוכנית עם רשימת מודעות (ads), לא בפורמט הישן');
    if (plan.goal !== undefined || plan.frequency_cap !== undefined) {
      errors.push('goal ו-frequency_cap נתמכים רק בתוכנית עם רשימת מודעות (ads), לא בפורמט הישן');
    }
    // הפורמט הישן - הבדיקות כמו שהיו
    need(typeof plan.link_url === 'string' && /^https?:\/\//.test(plan.link_url), 'חסר link_url תקין (לאן המודעה מפנה)');
    need(Array.isArray(plan.primary_texts) && plan.primary_texts.length > 0, 'חסרים primary_texts (טקסטים ראשיים)');
    need(Array.isArray(plan.headlines) && plan.headlines.length > 0, 'חסרות headlines (כותרות)');
    need(Array.isArray(plan.images) && plan.images.length > 0, 'חסרות images (נתיבי תמונות מתוך תיקיית הקמפיין)');
    for (const p of plan.images || []) if (!fileExists(p)) errors.push(`תמונה לא נמצאה: ${p}`);
    return errors;
  }

  // --- הפורמט החדש ---
  const goal = goalOf(plan);
  const promote = promoteGoalOf(plan);
  if (goal !== 'whatsapp' && !promote) {
    errors.push(`goal "${plan.goal}" לא מוכר. מותר: "reach" (קידום חשיפה של פוסט קיים), "engagement" (קידום מעורבות של פוסט קיים), או בלי goal (שיחות בוואטסאפ)`);
  } else if (promote) {
    errors.push(...validatePromoteGoal(plan, promote));
  } else {
    need(
      plan.destination === 'whatsapp',
      'destination חייב להיות "whatsapp" (שיחות בוואטסאפ). לקידום פוסט קיים בלי וואטסאפ: goal "reach" (חשיפה) או "engagement" (מעורבות)'
    );
    need(!plan.objective || plan.objective === 'OUTCOME_ENGAGEMENT', 'למודעת וואטסאפ המטרה היא OUTCOME_ENGAGEMENT');
    if (plan.frequency_cap !== undefined) {
      errors.push('frequency_cap (הגבלת תדירות) אפשרי רק בקידום חשיפה (goal: "reach"). Meta לא מקבלת אותו באופטימיזציה לשיחות');
    }
    // ההודעה המוכנה והברכה נבנות רק במודעה חדשה (תמונות + טקסט). קידום פוסט קיים רץ כמו שהוא.
    const hasNewAds = Array.isArray(plan.ads) && plan.ads.some((ad) => !isExistingPostAd(ad));
    if (hasNewAds) {
      need(isNonEmptyString(plan.whatsapp?.autofill_message), 'חסרה whatsapp.autofill_message (ההודעה המוכנה שנשלחת בוואטסאפ)');
      // Meta דוחה הודעה מוכנה בלי הודעת ברכה (נבדק 19.10.2026 - בלעדיה מתקבל 'unknown error').
      need(isNonEmptyString(plan.whatsapp?.greeting), 'חסרה whatsapp.greeting (הודעת הברכה שמופיעה בוואטסאפ לפני ההודעה המוכנה - Meta מחייבת אותה)');
    }
  }

  // 🛑 בלם: רק פייסבוק ואינסטגרם, ורק מיקומים מהרשימה
  const placements = placementsOf(plan);
  for (const [platform, positions] of Object.entries(placements)) {
    if (!ALLOWED_POSITIONS[platform]) {
      errors.push(`מיקום אסור: ${platform}. מותר רק facebook ו-instagram (בלי רשת השותפים ובלי מסנג'ר).`);
      continue;
    }
    if (!Array.isArray(positions) || positions.length === 0) {
      errors.push(`ב-placements.${platform} צריך רשימה של מיקומים`);
      continue;
    }
    for (const pos of positions) {
      if (!ALLOWED_POSITIONS[platform].includes(pos)) errors.push(`מיקום לא מוכר או אסור: ${platform}.${pos}`);
    }
  }

  if (plan.end_date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.end_date)) {
      errors.push('end_date צריך להיות בפורמט YYYY-MM-DD');
    } else if (new Date(`${plan.end_date}T23:59:00Z`) <= today) {
      errors.push(`end_date (${plan.end_date}) כבר עבר`);
    }
  }

  need(plan.ads.length > 0, 'ads ריק - אין מודעות בתוכנית');
  const names = new Set();
  plan.ads.forEach((ad, i) => {
    const label = `מודעה ${i + 1}${ad?.name ? ` (${ad.name})` : ''}`;
    need(isNonEmptyString(ad?.name), `${label}: חסר name`);
    if (ad?.name) {
      if (names.has(ad.name)) errors.push(`${label}: השם כבר קיים במודעה אחרת`);
      names.add(ad.name);
    }
    if (isExistingPostAd(ad)) {
      errors.push(...validateExistingPost(ad, label));
      return;
    }
    // 🛑 קידום חשיפה / מעורבות: רק פוסט שכבר עלה. מודעה חדשה (תמונות + טקסט) - רק בקמפיין וואטסאפ.
    if (promote) {
      errors.push(
        `${label}: ב${promote.he} מקדמים רק פוסט שכבר עלה (existing_post), בלי תמונות חדשות ובלי טקסט. ` +
        'מודעה חדשה עם תמונות - רק בקמפיין שיחות בוואטסאפ (בלי goal)'
      );
      return;
    }
    need(isNonEmptyString(ad?.text), `${label}: חסר text (הטקסט הראשי של המודעה)`);
    need(isNonEmptyString(ad?.headline || plan.headline), `${label}: חסרה כותרת (headline במודעה או בתוכנית)`);
    const imgs = ad?.images;
    if (hasPlacementImages(ad)) {
      errors.push(...validatePlacementImages(plan, ad, label, fileExists));
    } else if (!Array.isArray(imgs) || imgs.length === 0) {
      errors.push(`${label}: חסרות images`);
    } else {
      if (imgs.length > 10) errors.push(`${label}: בקרוסלה מותר עד 10 תמונות (יש ${imgs.length})`);
      for (const p of imgs) if (!fileExists(p)) errors.push(`${label}: תמונה לא נמצאה: ${p}`);
    }
    // תיאור (רשות): מחרוזת אחת לכל הכרטיסים, או רשימה - אחת לכל תמונה, באותו סדר
    if (ad?.description !== undefined) {
      const d = ad.description;
      if (hasPlacementImages(ad)) {
        // תמונה לכל מיקום: Meta מקבלת תיאור אחד בלבד (אי אפשר להתאים אותו למיקום)
        if (typeof d !== 'string') errors.push(`${label}: במודעה עם placement_images התיאור (description) הוא טקסט אחד, לא רשימה`);
      } else if (Array.isArray(d)) {
        if (!d.every((x) => typeof x === 'string')) errors.push(`${label}: description - כל פריט ברשימה צריך להיות טקסט`);
        if (Array.isArray(imgs) && d.length !== imgs.length) {
          errors.push(`${label}: ב-description יש ${d.length} תיאורים ו-${imgs.length} תמונות - צריך אחד לכל תמונה (או טקסט אחד לכולן)`);
        }
      } else if (typeof d !== 'string') {
        errors.push(`${label}: description צריך להיות טקסט, או רשימה של טקסט אחד לכל תמונה`);
      }
    }
  });

  return errors;
}

// קידום חשיפה / מעורבות (goal): בלי וואטסאפ, בלי כותרת, המטרה תואמת, והגבלת תדירות תקינה (רק בחשיפה).
function validatePromoteGoal(plan, promote) {
  const errors = [];
  if (plan.destination !== undefined && plan.destination !== 'none') {
    errors.push(
      plan.destination === 'whatsapp'
        ? `ב${promote.he} אין וואטסאפ. מורידים את destination (או כותבים "none"). לשיחות בוואטסאפ - בלי goal`
        : `destination "${plan.destination}" לא מתאים ל${promote.he}. מורידים אותו (או כותבים "none")`
    );
  }
  if (plan.whatsapp !== undefined) {
    errors.push(`ב${promote.he} אין וואטסאפ: אין כפתור, אין הודעה מוכנה ואין ברכה. מורידים את whatsapp מהתוכנית`);
  }
  if (plan.headline !== undefined) {
    errors.push(`ב${promote.he} הפוסט רץ כמו שהוא, בלי כותרת משלנו. מורידים את headline מהתוכנית`);
  }
  if (plan.objective !== undefined && plan.objective !== promote.objective) {
    errors.push(`ב${promote.he} המטרה ב-Meta היא ${promote.objective}. מורידים את objective (הכלי קובע אותה לפי goal)`);
  }
  const fc = plan.frequency_cap;
  if (fc !== undefined) {
    if (plan.goal !== 'reach') {
      errors.push('frequency_cap (הגבלת תדירות) אפשרי רק בקידום חשיפה (goal: "reach"). Meta מקבלת אותו רק באופטימיזציה לחשיפה (REACH)');
    } else if (!fc || typeof fc !== 'object' || Array.isArray(fc)) {
      errors.push('frequency_cap צריך להיות אובייקט, למשל { "impressions": 2, "days": 7 } (עד 2 חשיפות לאדם בכל 7 ימים)');
    } else {
      for (const k of Object.keys(fc)) {
        if (!(k in DEFAULT_FREQUENCY_CAP)) errors.push(`frequency_cap.${k} לא מוכר. מותר רק impressions (כמה חשיפות לאדם) ו-days (בכמה ימים)`);
      }
      for (const [k, he] of [['impressions', 'כמה חשיפות לאדם'], ['days', 'בכמה ימים']]) {
        const n = fc[k];
        if (n !== undefined && !(Number.isInteger(n) && n >= 1 && n <= 90)) {
          errors.push(`frequency_cap.${k} (${he}) צריך להיות מספר שלם בין 1 ל-90 - זה הטווח ש-Meta מקבלת`);
        }
      }
    }
  }
  return errors;
}

// מודעה שמקדמת פוסט קיים: פלטפורמה, מזהה, ובלי שדות של מודעה חדשה (שלא ייראה כאילו הם נשלחים).
function validateExistingPost(ad, label) {
  const errors = [];
  const p = ad.existing_post;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return [`${label}: existing_post צריך להיות אובייקט { platform, id, url }`];
  if (!EXISTING_POST_PLATFORMS[p.platform]) {
    errors.push(`${label}: existing_post.platform צריך להיות "facebook" או "instagram"`);
  } else if (p.platform === 'facebook' && !(typeof p.id === 'string' && /^\d+_\d+$/.test(p.id))) {
    errors.push(`${label}: existing_post.id של פוסט בפייסבוק נראה כך: "<מזהה הדף>_<מזהה הפוסט>" (בגרשיים). מוצאים אותו עם node tools/meta-posts.js`);
  } else if (p.platform === 'instagram' && !isIdString(p.id)) {
    errors.push(`${label}: existing_post.id של פוסט באינסטגרם הוא מספר בתוך גרשיים. מוצאים אותו עם node tools/meta-posts.js`);
  }
  if (p.url !== undefined && !(typeof p.url === 'string' && /^https:\/\//.test(p.url))) {
    errors.push(`${label}: existing_post.url צריך להיות קישור (https://...)`);
  }
  if (p.cta !== undefined) {
    const c = p.cta;
    const okCta = c && typeof c === 'object' && !Array.isArray(c) &&
      typeof c.type === 'string' && /^[A-Z_]+$/.test(c.type) &&
      typeof c.link === 'string' && /^https:\/\//.test(c.link);
    if (!okCta) errors.push(`${label}: existing_post.cta נראה כך: { "type": "LEARN_MORE", "link": "https://..." } (סוג הכפתור באותיות גדולות, וקישור מלא)`);
  }
  const extra = ['images', 'text', 'headline', 'description', 'placement_images'].filter((k) => ad[k] !== undefined);
  if (extra.length) {
    errors.push(`${label}: בקידום פוסט קיים הפוסט רץ כמו שהוא, בלי ${extra.join(', ')}. מורידים אותם מהמודעה (או בונים מודעה חדשה בלי existing_post)`);
  }
  return errors;
}

// תמונה לכל מיקום: שתי תמונות (feed ו-story), ולכל אחת יש מיקום בתוכנית. אסור שמיקום יישאר בלי תמונה מתאימה.
function validatePlacementImages(plan, ad, label, fileExists) {
  const pi = ad.placement_images;
  if (!pi || typeof pi !== 'object' || Array.isArray(pi)) {
    return [`${label}: placement_images צריך להיות אובייקט { "feed": "<${PLACEMENT_IMAGE_SIZE.feed}>", "story": "<${PLACEMENT_IMAGE_SIZE.story}>" }`];
  }
  const errors = [];
  if (ad.images !== undefined) {
    errors.push(`${label}: יש גם images וגם placement_images. בוחרים אחד: images (אותה תמונה או קרוסלה בכל המיקומים) או placement_images (תמונה לפיד ותמונה לסטורי ולריל)`);
  }
  for (const k of Object.keys(pi)) {
    if (!PLACEMENT_IMAGE_KEYS[k]) errors.push(`${label}: placement_images.${k} לא מוכר. מותר רק feed (פיד) ו-story (סטורי וריל)`);
  }
  const groups = placementGroupsOf(plan);
  for (const key of Object.keys(PLACEMENT_IMAGE_KEYS)) {
    const used = Object.keys(groups[key]).length > 0;
    const p = pi[key];
    if (p === undefined) {
      errors.push(
        used
          ? `${label}: במיקומים יש ${groupWhere(groups[key])}, ואין להם תמונה - חסר placement_images.${key} (${PLACEMENT_IMAGE_SIZE[key]})`
          : `${label}: placement_images צריך שתי תמונות, feed ו-story. לתמונה אחת בכל המיקומים משתמשים ב-images`
      );
      continue;
    }
    if (!isNonEmptyString(p)) { errors.push(`${label}: placement_images.${key} צריך להיות נתיב לתמונה מתוך תיקיית הקמפיין`); continue; }
    if (!fileExists(p)) errors.push(`${label}: תמונה לא נמצאה: ${p}`);
    if (!used) {
      errors.push(
        `${label}: placement_images.${key} לא תופיע באף מיקום - אין ב-placements ${key === 'story' ? 'סטורי או ריל' : 'פיד (או מיקום אחר שהוא לא סטורי או ריל)'}. ` +
        'מוסיפים את המיקום, או משתמשים ב-images'
      );
    }
  }
  if (isNonEmptyString(pi.feed) && pi.feed === pi.story) {
    errors.push(`${label}: אותה תמונה לפיד ולסטורי. במקרה כזה משתמשים ב-images`);
  }
  return errors;
}

// בדיקת הקהל של קבוצת מודעות אחת (או של התוכנית כולה, כשאין ad_sets).
export function validateAudience(a, label, safety) {
  const errors = [];
  if (!a || typeof a !== 'object' || Array.isArray(a)) return [`${label}: צריך להיות אובייקט של קהל`];

  // 🛑 בלם: רק מדינות מ-config/safety.json
  const allowed = safety.allowedCountries || ['IL'];
  if (a.countries !== undefined) {
    if (!Array.isArray(a.countries) || a.countries.length === 0) {
      errors.push(`${label}.countries: צריך רשימה של מדינות`);
    } else {
      const outside = a.countries.filter((c) => !allowed.includes(c));
      if (outside.length) errors.push(`${label}.countries: ${outside.join(', ')} לא ברשימת המדינות המותרות (${allowed.join(', ')}) ב-config/safety.json`);
    }
  }

  const checkList = (key) => {
    const list = a[key];
    if (list === undefined) return [];
    if (!Array.isArray(list) || list.length === 0) { errors.push(`${label}.${key}: צריך רשימה של קהלים ({ "id": "...", "name": "..." })`); return []; }
    list.forEach((x, i) => {
      if (!isIdString(x?.id)) errors.push(`${label}.${key}[${i}]: id צריך להיות מספר בתוך גרשיים ("1202..."), אחרת המספר הארוך משתבש`);
      if (x?.name !== undefined && typeof x.name !== 'string') errors.push(`${label}.${key}[${i}]: name צריך להיות טקסט`);
    });
    return list.map((x) => x?.id);
  };
  const inc = checkList('custom_audiences');
  const exc = checkList('excluded_custom_audiences');
  const both = inc.filter((id) => id && exc.includes(id));
  if (both.length) errors.push(`${label}: אותו קהל גם כלול וגם מוחרג (${both.join(', ')})`);
  if (new Set(inc).size !== inc.length) errors.push(`${label}.custom_audiences: יש קהל שמופיע פעמיים`);

  if (a.detailed !== undefined) {
    const d = a.detailed;
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      errors.push(`${label}.detailed: צריך אובייקט, למשל { "education_majors": [...], "work_positions": [...] }`);
    } else {
      for (const key of Object.keys(d)) {
        if (!DETAILED_TYPES[key]) errors.push(`${label}.detailed.${key}: סוג לא נתמך. נתמכים: ${Object.keys(DETAILED_TYPES).join(', ')}`);
      }
      for (const key of Object.keys(DETAILED_TYPES)) {
        if (d[key] === undefined) continue;
        if (!Array.isArray(d[key]) || d[key].length === 0) { errors.push(`${label}.detailed.${key}: צריך רשימה לא ריקה`); continue; }
        d[key].forEach((x, i) => {
          if (!isIdString(x?.id)) errors.push(`${label}.detailed.${key}[${i}]: id צריך להיות מספר בתוך גרשיים`);
        });
      }
      if (!detailedItemsOf(d).length) errors.push(`${label}.detailed: ריק - אין תחומי לימוד או תפקידים`);
    }
  }

  for (const key of ['advantage_audience', 'custom_audience_expansion', 'detailed_expansion']) {
    if (a[key] !== undefined && typeof a[key] !== 'boolean') errors.push(`${label}.${key}: צריך true או false`);
  }
  if (a.custom_audience_expansion !== undefined && a.custom_audiences === undefined) {
    errors.push(`${label}.custom_audience_expansion: אין custom_audiences להרחיב`);
  }
  if (a.detailed_expansion !== undefined && a.detailed === undefined) {
    errors.push(`${label}.detailed_expansion: אין detailed להרחיב`);
  }
  // כשהקהל האוטומטי דלוק, Meta מתייחסת לקהלים כ"הצעה" ומתרחבת בכל מקרה
  if (a.advantage_audience === true && (a.custom_audience_expansion === false || a.detailed_expansion === false)) {
    errors.push(`${label}: "בלי הרחבה" אפשרי רק בלי הקהל האוטומטי (advantage_audience: false). כשהוא דלוק, Meta מתייחסת לקהלים כהצעה ומתרחבת`);
  }
  return errors;
}

function validateAdSets(plan, safety) {
  const errors = [];
  const cap = safety.maxDailyBudgetIls;
  if (plan.ad_sets.length === 0) return ['ad_sets ריק - אין קבוצות מודעות'];
  if (plan.daily_budget_ils !== undefined) {
    errors.push('כשיש ad_sets, התקציב נקבע בכל קבוצה. מורידים את daily_budget_ils מראש התוכנית');
  }
  if (plan.audience !== undefined) {
    errors.push('כשיש ad_sets, הקהל נקבע בכל קבוצה. מורידים את audience מראש התוכנית');
  }
  const names = new Set();
  plan.ad_sets.forEach((s, i) => {
    const label = `קבוצה ${i + 1}${s?.name ? ` (${s.name})` : ''}`;
    if (!isNonEmptyString(s?.name)) errors.push(`${label}: חסר name`);
    else if (names.has(s.name)) errors.push(`${label}: השם כבר קיים בקבוצה אחרת`);
    else names.add(s.name);
    const b = s?.daily_budget_ils;
    if (!(Number.isFinite(b) && b > 0)) errors.push(`${label}: חסר daily_budget_ils (תקציב יומי בשקלים)`);
    // 🛑 בלם: תקרת תקציב - לכל קבוצה
    else if (b > cap) {
      errors.push(
        `${label}: התקציב (${b}₪/יום) חורג מתקרת בלם החירום (${cap}₪/יום). ` +
        'מקטינים את התקציב בתוכנית, או שהבעלים מעדכן ידנית את config/safety.json.'
      );
    }
    if (s?.audience === undefined) errors.push(`${label}: חסר audience (הקהל של הקבוצה)`);
    else errors.push(...validateAudience(s.audience, `${label}.audience`, safety));
  });
  // 🛑 בלם: תקרת תקציב - גם על הסכום של כל הקבוצות
  const total = totalDailyBudgetIls(plan);
  if (total > cap) {
    errors.push(
      `סך התקציב של כל הקבוצות (${total}₪/יום) חורג מתקרת בלם החירום (${cap}₪/יום). ` +
      'מקטינים את התקציבים בתוכנית, או שהבעלים מעדכן ידנית את config/safety.json.'
    );
  }
  return errors;
}

// אזהרות (לא חוסמות ב-dry-run): דברים שידוע ש-Meta לא תקבל או תשנה. --check בודק אותם מול Meta,
// ו---confirm בודק לפני שנוצר משהו.
export function planWarnings(plan, safety) {
  const warnings = [];
  if (isPromoteGoalPlan(plan) && isMultiAdPlan(plan)) {
    // ההחלטה של עדי (25.10.2026): כל קידום רץ רק ברשת של הפוסט. לא חוסם - רק מזכיר.
    const networks = Object.keys(placementsOf(plan));
    for (const ad of plan.ads.filter(isExistingPostAd)) {
      const own = ad.existing_post?.platform;
      const other = networks.filter((n) => n !== own);
      if (EXISTING_POST_PLATFORMS[own] && other.length) {
        warnings.push(
          `מודעה "${ad.name}": הפוסט מ${EXISTING_POST_PLATFORMS[own]}, והמיקומים כוללים גם ${other.map((n) => EXISTING_POST_PLATFORMS[n] || n).join(', ')}` +
          `${plan.placements ? '' : ' (אין placements בתוכנית, וברירת המחדל היא פיד, סטורי וריל בשתי הרשתות)'}. ` +
          `לפי ההחלטה של עדי (25.10) כל קידום רץ רק ברשת של הפוסט - למשל placements: { "${own}": ["${own === 'instagram' ? 'stream' : 'feed'}"] }`
        );
      }
    }
  }
  for (const s of adSetsOf(plan)) {
    const a = audienceSpecOf(s.audience, safety);
    const where = s.label ? `קבוצה "${s.label}"` : 'הקהל';
    // נבדק רק באופטימיזציה לשיחות. בחשיפה ובמעורבות --check בודק את זה מול Meta (הערכת הגודל).
    if (goalOf(plan) === 'whatsapp' && a.detailed && !a.advantage_audience && a.detailed_expansion === false) {
      warnings.push(
        `${where}: ביקשנו בלי הרחבה של פירוט הטירגוט, אבל לפי Meta (נבדק 21.10.2026) באופטימיזציה לשיחות אי אפשר לכבות אותה - ` +
        `"The targeting_optimization field has been removed... Advantage detailed targeting will be applied" (subcode ${DETAILED_EXPANSION_FORCED_SUBCODE}). ` +
        'ב---check זה נבדק מול Meta, ו---confirm ייעצר לפני שנוצר משהו.'
      );
    }
  }
  return warnings;
}

// תיאור הקהל בעברית, לתצוגה ב-dry-run. רק השורות של היכולות החדשות (השורה הבסיסית נשארת כמו שהייתה).
export function describeAdvancedAudience(a) {
  const lines = [];
  const list = (xs) => xs.map((x) => (x.name ? `${x.name} (${x.id})` : x.id)).join(', ');
  if (a.custom_audiences) lines.push(`רק מי שבקהלים: ${list(a.custom_audiences)}`);
  if (a.excluded_custom_audiences) lines.push(`מחריגים:       ${list(a.excluded_custom_audiences)}`);
  if (a.detailed) {
    const parts = Object.entries(DETAILED_TYPES)
      .filter(([k]) => Array.isArray(a.detailed[k]) && a.detailed[k].length)
      .map(([k, he]) => `${he} (${a.detailed[k].length}): ${a.detailed[k].map((x) => x.name || x.id).join(', ')}`);
    lines.push(`לפי הפרופיל, מספיק אחד מאלה - ${parts.join(' · ')}`);
  }
  const exp = [];
  if (a.custom_audiences) exp.push(`קהלים מותאמים - ${a.custom_audience_expansion ? 'דלוקה' : 'כבויה'}`);
  if (a.detailed) exp.push(`פירוט טירגוט - ${a.detailed_expansion ? 'דלוקה' : 'כבויה'}`);
  if (exp.length) lines.push(`הרחבה:         ${exp.join(' · ')}`);
  return lines;
}

// 🛑 בדיקה אחרונה לפני שליחה של אד-סט: התקציב (באגורות) מתחת לתקרה.
export function assertBudget(body, safety, what) {
  const capAgorot = Math.round(safety.maxDailyBudgetIls * 100);
  if (!(Number.isFinite(body?.daily_budget) && body.daily_budget > 0 && body.daily_budget <= capAgorot)) {
    throw new Error(`בלם חירום: התקציב של ${what} לא תקין או מעל התקרה - עוצרים בלי לשלוח.`);
  }
}

// בדיקות שתלויות בחיבור (.env) - נפרדות, כי ב-dry-run מותר שהחיבור עוד לא מוכן.
export function validateEnvForPlan(plan, env) {
  const errors = [];
  if (!isMultiAdPlan(plan)) return errors;
  if (placementsOf(plan).instagram && !env.META_INSTAGRAM_USER_ID) {
    errors.push(
      'חסר META_INSTAGRAM_USER_ID ב-.env. בלי זה המודעה באינסטגרם לא תופיע בשם החשבון של הלקוח. ' +
      'מוסיפים אותו (npm run doctor מראה את המספר), או מורידים את instagram מ-placements.'
    );
  }
  for (const ad of plan.ads.filter(isExistingPostAd)) {
    const p = ad.existing_post || {};
    // 🛑 בלם: מקדמים רק פוסט של הדף של הלקוח (המזהה של פוסט בפייסבוק מתחיל במזהה הדף)
    if (p.platform === 'facebook' && env.META_PAGE_ID && typeof p.id === 'string' && !p.id.startsWith(`${env.META_PAGE_ID}_`)) {
      errors.push(`מודעה "${ad.name}": הפוסט ${p.id} לא שייך לדף של הלקוח (META_PAGE_ID). מקדמים רק פוסטים של הדף שלו.`);
    }
    if (p.platform === 'instagram' && !env.META_INSTAGRAM_USER_ID) {
      errors.push(`מודעה "${ad.name}": לקידום פוסט מאינסטגרם חסר META_INSTAGRAM_USER_ID ב-.env.`);
    }
  }
  return errors;
}

// 🛑 תקרה על הסך הכולל בחשבון: כל מה שרץ עכשיו (ACTIVE) + התוכנית החדשה, כאילו כבר הופעלה.
// כולל גם מה שנוצר ידנית ב-Ads Manager או בכפתור "קידום" - לכן נמשך מ-Meta ולא מהתיקיות שלנו.
// running: [{ level: 'campaign'|'adset', name, daily_budget (אגורות, מחרוזת או מספר), lifetime_budget }]
// התקרה: safety.maxTotalDailyBudgetIls, ואם אין - אותה תקרה של maxDailyBudgetIls.
export const totalCapOf = (safety) => safety.maxTotalDailyBudgetIls ?? safety.maxDailyBudgetIls;

// Meta משאירה "ACTIVE" גם קידום שתאריך הסיום שלו עבר (נמצא 22.10.2026: קידומים ממאי-יוני) - אותם לא סופרים.
export function judgeAccountBudget(running, planTotalIls, safety, now = new Date()) {
  const capIls = totalCapOf(safety);
  const live = running.filter((r) => !(r.stop_time && new Date(r.stop_time) <= now));
  const daily = live.filter((r) => Number(r.daily_budget) > 0);
  const lifetime = live.filter((r) => !(Number(r.daily_budget) > 0) && Number(r.lifetime_budget) > 0);
  const runningIls = daily.reduce((sum, r) => sum + Number(r.daily_budget) / 100, 0);
  const totalIls = Math.round((runningIls + planTotalIls) * 100) / 100;
  return {
    capIls,
    runningIls: Math.round(runningIls * 100) / 100,
    totalIls,
    over: totalIls > capIls,
    lines: daily.map((r) => `${r.name}: ${Number(r.daily_budget) / 100}₪ ליום`),
    warnings: lifetime.map((r) => `"${r.name}" רץ עם תקציב כולל (לא יומי) - לא נספר בסכום. לבדוק ב-Ads Manager כמה הוא מוציא ביום`),
  };
}

// --- הבקשות ---

export function buildCampaign(plan) {
  return {
    name: plan.name,
    objective: isMultiAdPlan(plan) ? promoteGoalOf(plan)?.objective || 'OUTCOME_ENGAGEMENT' : plan.objective || 'OUTCOME_LEADS',
    special_ad_categories: plan.special_ad_categories || [],
    // התקציב יושב באד-סט, וכל אד-סט שומר על התקציב שלו (בלי העברה בין אד-סטים).
    is_adset_budget_sharing_enabled: false,
    status: 'PAUSED',
  };
}

// הטירגוט של קבוצת מודעות. תוכנית בלי השדות החדשים מקבלת בדיוק את אותם שדות, באותו סדר, כמו קודם.
// שמות השדות לפי התיעוד של Marketing API (v26.0, נבדק 21.10.2026):
//   custom_audiences / excluded_custom_audiences - [{ id }]
//   flexible_spec - [{ education_majors: [{id,name}], work_positions: [{id,name}] }]  ("או" בתוך הקבוצה)
//   targeting_relaxation_types.custom_audience - 0 = בלי הרחבה של קהלים מותאמים (Advantage custom audience)
//   targeting_relaxation_types.lookalike - 0 = בלי הרחבה של קהל דומה. בלי השדה Meta משאירה אותה דלוקה (נמצא 1.11.2026)
//   targeting_optimization: 'none' - בלי הרחבה של פירוט הטירגוט. ⚠️ Meta דוחה אותו באופטימיזציה לשיחות (ראו planWarnings)
export function buildTargeting(audience) {
  const ids = (list) => list.map((x) => ({ id: String(x.id) }));
  const detailed = audience.detailed
    ? Object.fromEntries(
        Object.keys(DETAILED_TYPES)
          .filter((k) => Array.isArray(audience.detailed[k]) && audience.detailed[k].length)
          .map((k) => [k, audience.detailed[k].map((x) => (x.name ? { id: String(x.id), name: x.name } : { id: String(x.id) }))])
      )
    : null;
  const manual = !audience.advantage_audience;
  return {
    geo_locations: { countries: audience.countries },
    age_min: audience.age_min,
    ...(audience.age_max ? { age_max: audience.age_max } : {}),
    targeting_automation: { advantage_audience: audience.advantage_audience ? 1 : 0 },
    ...(audience.custom_audiences ? { custom_audiences: ids(audience.custom_audiences) } : {}),
    ...(audience.excluded_custom_audiences ? { excluded_custom_audiences: ids(audience.excluded_custom_audiences) } : {}),
    ...(detailed ? { flexible_spec: [detailed] } : {}),
    ...(audience.custom_audiences && manual
      ? { targeting_relaxation_types: { lookalike: audience.custom_audience_expansion ? 1 : 0, custom_audience: audience.custom_audience_expansion ? 1 : 0 } }
      : {}),
    ...(detailed && manual && audience.detailed_expansion === false ? { targeting_optimization: 'none' } : {}),
  };
}

// adSet: אחת מ-adSetsOf(plan). בלי - הקבוצה היחידה של תוכנית בלי ad_sets (כמו קודם).
export function buildAdSet(plan, { campaignId, env, safety, adSet = adSetsOf(plan)[0] }) {
  const audience = audienceSpecOf(adSet.audience, safety);
  const targeting = buildTargeting(audience);

  if (!isMultiAdPlan(plan)) {
    // הפורמט הישן - כמו שהיה
    const body = {
      name: adSet.name,
      campaign_id: campaignId,
      daily_budget: Math.round(adSet.daily_budget_ils * 100),
      billing_event: 'IMPRESSIONS',
      optimization_goal: plan.optimization_goal || (env.META_PIXEL_ID ? 'OFFSITE_CONVERSIONS' : 'LINK_CLICKS'),
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: { ...targeting, age_max: plan.audience?.age_max || 65 },
      status: 'PAUSED',
      ...(plan.is_dynamic_creative ? { is_dynamic_creative: true } : {}),
    };
    if (env.META_PIXEL_ID && body.optimization_goal === 'OFFSITE_CONVERSIONS') {
      body.promoted_object = { pixel_id: env.META_PIXEL_ID, custom_event_type: plan.conversion_event || 'LEAD' };
    }
    return body;
  }

  const placements = placementsOf(plan);
  const placedTargeting = {
    ...targeting,
    publisher_platforms: Object.keys(placements),
    ...(placements.facebook ? { facebook_positions: placements.facebook } : {}),
    ...(placements.instagram ? { instagram_positions: placements.instagram } : {}),
    device_platforms: ['mobile', 'desktop'],
  };

  // קידום חשיפה / מעורבות של פוסט קיים: בלי וואטסאפ. חשיפה - עם הגבלת תדירות.
  const promote = promoteGoalOf(plan);
  if (promote) {
    const fc = frequencyCapOf(plan);
    return {
      name: adSet.name,
      campaign_id: campaignId,
      daily_budget: Math.round(adSet.daily_budget_ils * 100),
      billing_event: 'IMPRESSIONS',
      optimization_goal: promote.optimization_goal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      ...(promote.destination_type ? { destination_type: promote.destination_type } : {}),
      // הפוסט רץ בשם הדף והחשבון של הלקוח
      promoted_object: { page_id: env.META_PAGE_ID },
      ...(fc ? { frequency_control_specs: [{ event: 'IMPRESSIONS', interval_days: fc.days, max_frequency: fc.impressions }] } : {}),
      targeting: placedTargeting,
      ...(plan.end_date ? { end_time: endTimeOf(plan.end_date) } : {}),
      status: 'PAUSED',
    };
  }

  return {
    name: adSet.name,
    campaign_id: campaignId,
    daily_budget: Math.round(adSet.daily_budget_ils * 100),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'CONVERSATIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    destination_type: 'WHATSAPP',
    promoted_object: {
      page_id: env.META_PAGE_ID,
      ...(env.META_WHATSAPP_NUMBER ? { whatsapp_phone_number: env.META_WHATSAPP_NUMBER } : {}),
    },
    targeting: placedTargeting,
    ...(plan.end_date ? { end_time: endTimeOf(plan.end_date) } : {}),
    status: 'PAUSED',
  };
}

export function buildWelcomeMessage(plan) {
  const wa = plan.whatsapp || {};
  return {
    type: 'VISUAL_EDITOR',
    version: 2,
    landing_screen_type: 'welcome_message',
    media_type: 'text',
    text_format: {
      customer_action_type: 'autofill_message',
      message: {
        autofill_message: { content: wa.autofill_message },
        text: wa.greeting,
      },
    },
  };
}

// התוכנית יכולה להחליף את הרשימה (creative_features_opt_out), למשל אם Meta דוחה שיפור שלא מתאים לפורמט.
const optOutSpec = (plan) => {
  const features = plan.creative_features_opt_out ?? CREATIVE_FEATURES_OPT_OUT;
  if (!features.length) return null;
  return {
    creative_features_spec: Object.fromEntries(features.map((f) => [f, { enroll_status: 'OPT_OUT' }])),
  };
};

// התיאור של כל כרטיס (רשות): ad.description - טקסט אחד לכולם, או רשימה אחת לכל תמונה.
// לפי Meta: מופיע בפייסבוק, לא באינסטגרם. ריק = לא נשלח (כמו קודם).
export function cardDescriptionsOf(ad, count) {
  const d = ad?.description;
  if (typeof d === 'string') return Array.from({ length: count }, () => d.trim());
  if (Array.isArray(d)) return Array.from({ length: count }, (_, i) => (typeof d[i] === 'string' ? d[i].trim() : ''));
  return Array.from({ length: count }, () => '');
}

// hashes: ה-hash של כל תמונה במודעה, באותו סדר כמו ad.images
export function buildCreative(plan, ad, { hashes, env }) {
  const headline = ad.headline || plan.headline;
  const descriptions = cardDescriptionsOf(ad, hashes.length);
  const cta = { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } };
  const linkData = {
    link: WHATSAPP_LINK,
    message: ad.text,
    call_to_action: cta,
    page_welcome_message: JSON.stringify(buildWelcomeMessage(plan)),
  };

  if (hashes.length === 1) {
    linkData.image_hash = hashes[0];
    linkData.name = headline;
    if (descriptions[0]) linkData.description = descriptions[0];
  } else {
    // קרוסלה: הסדר נשמר כמו שנבחר, ובלי כרטיס סיום אוטומטי
    linkData.child_attachments = hashes.map((hash, i) => ({
      link: WHATSAPP_LINK,
      image_hash: hash,
      name: headline,
      ...(descriptions[i] ? { description: descriptions[i] } : {}),
      call_to_action: cta,
    }));
    linkData.multi_share_optimized = false;
    linkData.multi_share_end_card = false;
  }

  const dof = optOutSpec(plan);
  return {
    name: `${plan.name} · ${ad.name} · Creative`,
    object_story_spec: {
      page_id: env.META_PAGE_ID,
      ...(env.META_INSTAGRAM_USER_ID ? { instagram_user_id: env.META_INSTAGRAM_USER_ID } : {}),
      link_data: linkData,
    },
    ...(dof ? { degrees_of_freedom_spec: dof } : {}),
  };
}

// הכללים של "תמונה לכל מיקום", נגזרים מ-placements של התוכנית:
//   1. סטורי וריל (מה שיש מהם בתוכנית) ← תמונת story
//   2. כל שאר המיקומים בתוכנית (פיד וכו') ← תמונת feed
//   3. ברירת מחדל (customization_spec ריק): מיקום שלא ברשימות ← תמונת feed. האד-סט מוגבל למיקומים של התוכנית,
//      אז זו רק רשת ביטחון - כך גם Ads Manager בונה (הכלל האחרון שלו ריק).
// כל כלל מחבר את התמונה שלו, ואת הטקסט, הכותרת והקישור (שזהים בשני המקרים) - כמו ב-Ads Manager.
export function placementRulesOf(plan) {
  const groups = placementGroupsOf(plan);
  const specOf = (g) => ({
    publisher_platforms: Object.keys(g),
    ...(g.facebook ? { facebook_positions: g.facebook } : {}),
    ...(g.instagram ? { instagram_positions: g.instagram } : {}),
  });
  const labels = (key) => ({
    image_label: { name: PLACEMENT_LABELS[key] },
    body_label: { name: PLACEMENT_LABELS[key] },
    title_label: { name: PLACEMENT_LABELS[key] },
    link_url_label: { name: PLACEMENT_LABELS[key] },
  });
  return [
    { customization_spec: specOf(groups.story), ...labels('story'), priority: 1 },
    { customization_spec: specOf(groups.feed), ...labels('feed'), priority: 2 },
    { customization_spec: {}, ...labels('feed'), priority: 3 },
  ];
}

// מודעת וואטסאפ עם תמונה לכל מיקום (placement_images). אותו תוכן כמו buildCreative עם תמונה אחת:
// הטקסט הראשי (bodies), הכותרת (titles), התיאור (descriptions), הקישור לוואטסאפ (link_urls),
// הכפתור לוואטסאפ (call_to_actions, עם app_destination: WHATSAPP), וההודעה המוכנה והברכה (additional_data.page_welcome_message).
// המבנה: התיעוד של Meta (Placement Asset Customization; AdAssetFeedAdditionalData.page_welcome_message)
// + קריאה של מודעת וואטסאפ עם תמונה לכל מיקום שנבנתה ב-Ads Manager בחשבון של אלעד (ינואר 2026).
export function buildPlacementCreative(plan, ad, { feedHash, storyHash, env }) {
  const headline = ad.headline || plan.headline;
  const description = typeof ad.description === 'string' ? ad.description.trim() : '';
  const both = () => [{ name: PLACEMENT_LABELS.feed }, { name: PLACEMENT_LABELS.story }];
  const dof = optOutSpec(plan);
  return {
    name: `${plan.name} · ${ad.name} · Creative`,
    object_story_spec: {
      page_id: env.META_PAGE_ID,
      ...(env.META_INSTAGRAM_USER_ID ? { instagram_user_id: env.META_INSTAGRAM_USER_ID } : {}),
    },
    asset_feed_spec: {
      images: [
        { hash: feedHash, adlabels: [{ name: PLACEMENT_LABELS.feed }] },
        { hash: storyHash, adlabels: [{ name: PLACEMENT_LABELS.story }] },
      ],
      bodies: [{ text: ad.text, adlabels: both() }],
      titles: [{ text: headline, adlabels: both() }],
      ...(description ? { descriptions: [{ text: description }] } : {}),
      link_urls: [{ website_url: WHATSAPP_LINK, adlabels: both() }],
      call_to_action_types: ['WHATSAPP_MESSAGE'],
      call_to_actions: [{ type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } }],
      ad_formats: ['SINGLE_IMAGE'],
      asset_customization_rules: placementRulesOf(plan),
      optimization_type: 'PLACEMENT',
      additional_data: { page_welcome_message: JSON.stringify(buildWelcomeMessage(plan)) },
    },
    ...(dof ? { degrees_of_freedom_spec: dof } : {}),
  };
}

// קידום פוסט קיים: הקריאייטיב מצביע על הפוסט עצמו, ולכן הלייקים והתגובות של המודעה נצברים עליו.
//   פייסבוק: object_story_id = "<PAGE_ID>_<POST_ID>"
//   אינסטגרם: source_instagram_media_id + החשבון והדף שבשמם הוא רץ, עם כפתור וואטסאפ
//   קידום חשיפה / מעורבות (goal): בלי כפתור - הפוסט נראה כמו בפרופיל, עם "ממומן". אין לאן לשלוח,
//     והכפתור לא עוזר למטרה (חשיפה / לייקים ושמירות). ברילס ובתמונה בודדת Meta לא מחייבת כפתור.
//     חריג: קרוסלה - Meta דורשת כפתור עם קישור בהדלקה, ולכן existing_post.cta = { type, link } (8.11.2026).
// בשני המקרים הקידום יכול לרוץ גם בפייסבוק וגם באינסטגרם (לפי placements).
export function buildExistingPostCreative(plan, ad, { env }) {
  const p = ad.existing_post;
  const name = `${plan.name} · ${ad.name} · Creative`;
  if (p.platform === 'facebook') return { name, object_story_id: p.id };
  const base = {
    name,
    object_id: env.META_PAGE_ID,
    instagram_user_id: env.META_INSTAGRAM_USER_ID,
    source_instagram_media_id: p.id,
  };
  if (isPromoteGoalPlan(plan)) {
    // קרוסלה: Meta דורשת כפתור עם קישור בכל כרטיס - לא ביצירה אלא רק בהדלקה
    // ("Image card must have CTA link", 8.11.2026). לכן בקרוסלה existing_post.cta חובה (נבדק מול Meta ב---check).
    return p.cta ? { ...base, call_to_action: { type: p.cta.type, value: { link: p.cta.link } } } : base;
  }
  return {
    ...base,
    // Meta מחייבת link בכפתור (נבדק 22.10.2026: subcode 2061015 בלעדיו) - אותו קישור כמו במודעה חדשה
    call_to_action: { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP', link: WHATSAPP_LINK } },
  };
}

const creativeOf = (plan, ad, { ids, env }) => {
  if (isExistingPostAd(ad)) return buildExistingPostCreative(plan, ad, { env });
  if (hasPlacementImages(ad)) {
    const { feed, story } = ad.placement_images;
    return buildPlacementCreative(plan, ad, { feedHash: ids.hashOf(feed), storyHash: ids.hashOf(story), env });
  }
  return buildCreative(plan, ad, { hashes: ad.images.map((p) => ids.hashOf(p)), env });
};

// הפורמט הישן: קריאייטיב אחד, כמו שהיה
export function buildLegacyCreative(plan, { hashes, env }) {
  const body = plan.is_dynamic_creative
    ? {
        name: `${plan.name} · Creative`,
        object_story_spec: { page_id: env.META_PAGE_ID },
        asset_feed_spec: {
          images: hashes.map((hash) => ({ hash })),
          bodies: plan.primary_texts.map((text) => ({ text })),
          titles: plan.headlines.map((text) => ({ text })),
          ...(plan.descriptions?.length ? { descriptions: plan.descriptions.map((text) => ({ text })) } : {}),
          ad_formats: ['SINGLE_IMAGE'],
          call_to_action_types: [plan.cta || 'LEARN_MORE'],
          link_urls: [{ website_url: plan.link_url }],
        },
      }
    : {
        name: `${plan.name} · Creative`,
        object_story_spec: {
          page_id: env.META_PAGE_ID,
          link_data: {
            link: plan.link_url,
            message: plan.primary_texts[0],
            name: plan.headlines[0],
            ...(plan.descriptions?.[0] ? { description: plan.descriptions[0] } : {}),
            image_hash: hashes[0],
            call_to_action: { type: plan.cta || 'LEARN_MORE', value: { link: plan.link_url } },
          },
        },
      };
  // UTM דינמי (רשות): Meta ממלאת את {{...}} לבד בכל קליק.
  if (plan.url_tags) body.url_tags = plan.url_tags;
  return body;
}

// adSetLabel: שם הקבוצה, רק בתוכנית עם ad_sets (כדי שאותה מודעה בשתי קבוצות תקבל שמות שונים)
export function buildAd(plan, ad, { adSetId, creativeId, adSetLabel = null }) {
  const multiName = adSetLabel ? `${plan.name} · ${adSetLabel} · ${ad.name}` : `${plan.name} · ${ad.name}`;
  return {
    name: isMultiAdPlan(plan) ? multiName : `${plan.name} · Ad`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  };
}

// --- כל התוכנית, כרשימת צעדים ---
// ids: מזהים אמיתיים (ביצירה) או מצייני מקום (ב-dry-run).
//      adSetIdOf(שם הקבוצה) - רשות, רק בתוכנית עם ad_sets.
// מחזיר (בלי ad_sets, כמו קודם): { images, campaign, adSet, ads: [{ name, images, creative, ad }] }
// מחזיר (עם ad_sets): { images, campaign, ad_sets: [{ name, adSet, ads: [{ name, ad }] }], ads: [{ name, images, creative }] }
//   - קריאייטיב אחד לכל מודעה, משותף לכל הקבוצות (אותו פוסט, אותן תגובות ולייקים)
export function buildAll(plan, { env, safety, ids }) {
  // מוסיפים לקבוצה קיימת: רק קריאייטיבים ומודעות. בלי קמפיין ובלי קבוצה.
  // מחזיר { images, add_to_adset, ads: [{ name, images, creative, ad }] }
  if (isAddToAdSetPlan(plan)) {
    const adSetId = plan.add_to_adset.adset_id;
    return {
      images: imagesOfAds(plan),
      add_to_adset: { ...plan.add_to_adset },
      ads: plan.ads.map((ad) => ({
        name: ad.name,
        images: adImagesOf(ad),
        creative: creativeOf(plan, ad, { ids, env }),
        ad: buildAd(plan, ad, { adSetId, creativeId: ids.creativeIdOf(ad.name) }),
      })),
    };
  }

  const campaign = buildCampaign(plan);

  if (hasAdSets(plan) && isMultiAdPlan(plan)) {
    const adSetIdOf = ids.adSetIdOf || (() => ids.adSetId);
    return {
      images: imagesOfAds(plan),
      campaign,
      ad_sets: adSetsOf(plan).map((s) => ({
        name: s.label,
        adSet: buildAdSet(plan, { campaignId: ids.campaignId, env, safety, adSet: s }),
        ads: plan.ads.map((ad) => ({
          name: ad.name,
          ad: buildAd(plan, ad, { adSetId: adSetIdOf(s.label), creativeId: ids.creativeIdOf(ad.name), adSetLabel: s.label }),
        })),
      })),
      ads: plan.ads.map((ad) => ({
        name: ad.name,
        images: adImagesOf(ad),
        creative: creativeOf(plan, ad, { ids, env }),
      })),
    };
  }

  const adSet = buildAdSet(plan, { campaignId: ids.campaignId, env, safety });

  if (!isMultiAdPlan(plan)) {
    const hashes = plan.images.map((p) => ids.hashOf(p));
    return {
      images: [...plan.images],
      campaign,
      adSet,
      ads: [{
        name: 'Ad',
        images: [...plan.images],
        creative: buildLegacyCreative(plan, { hashes, env }),
        ad: buildAd(plan, {}, { adSetId: ids.adSetId, creativeId: ids.creativeIdOf('Ad') }),
      }],
    };
  }

  const images = imagesOfAds(plan);
  return {
    images,
    campaign,
    adSet,
    ads: plan.ads.map((ad) => ({
      name: ad.name,
      images: adImagesOf(ad),
      creative: creativeOf(plan, ad, { ids, env }),
      ad: buildAd(plan, ad, { adSetId: ids.adSetId, creativeId: ids.creativeIdOf(ad.name) }),
    })),
  };
}

// 🛑 הבדיקה האחרונה לפני כל שליחה: מה שנוצר חייב להיות PAUSED.
export function assertPaused(body, what) {
  if (body?.status !== 'PAUSED') {
    throw new Error(`בלם חירום: ${what} לא במצב PAUSED - עוצרים בלי לשלוח.`);
  }
}
