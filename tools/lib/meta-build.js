// בניית הבקשות ל-Meta - פונקציות טהורות, בלי רשת ובלי קבצים.
// ה-dry-run, מצב הבדיקה (--check) והיצירה (--confirm) משתמשים באותן פונקציות,
// ולכן מה שמוצג ב-dry-run הוא בדיוק מה שנשלח.
//
// 🛑 בלם החירום כאן:
//   - כל קמפיין, אד-סט ומודעה נבנים עם status: 'PAUSED'. אין פרמטר שמשנה את זה.
//   - תקציב מעל התקרה (לכל קבוצת מודעות, וגם הסכום של כל הקבוצות), רשת שותפים, מסנג'ר
//     או מדינה שלא ב-safety.json - נעצרים בבדיקת התוכנית.

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

export function placementsOf(plan) {
  return plan.placements || DEFAULT_PLACEMENTS;
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

  if (!hasAdSets(plan)) {
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
    // הפורמט הישן - הבדיקות כמו שהיו
    need(typeof plan.link_url === 'string' && /^https?:\/\//.test(plan.link_url), 'חסר link_url תקין (לאן המודעה מפנה)');
    need(Array.isArray(plan.primary_texts) && plan.primary_texts.length > 0, 'חסרים primary_texts (טקסטים ראשיים)');
    need(Array.isArray(plan.headlines) && plan.headlines.length > 0, 'חסרות headlines (כותרות)');
    need(Array.isArray(plan.images) && plan.images.length > 0, 'חסרות images (נתיבי תמונות מתוך תיקיית הקמפיין)');
    for (const p of plan.images || []) if (!fileExists(p)) errors.push(`תמונה לא נמצאה: ${p}`);
    return errors;
  }

  // --- הפורמט החדש ---
  need(plan.destination === 'whatsapp', 'destination חייב להיות "whatsapp" (כרגע זה היעד היחיד שהכלי בונה בפורמט הזה)');
  need(!plan.objective || plan.objective === 'OUTCOME_ENGAGEMENT', 'למודעת וואטסאפ המטרה היא OUTCOME_ENGAGEMENT');
  need(isNonEmptyString(plan.whatsapp?.autofill_message), 'חסרה whatsapp.autofill_message (ההודעה המוכנה שנשלחת בוואטסאפ)');
  // Meta דוחה הודעה מוכנה בלי הודעת ברכה (נבדק 19.10.2026 - בלעדיה מתקבל 'unknown error').
  need(isNonEmptyString(plan.whatsapp?.greeting), 'חסרה whatsapp.greeting (הודעת הברכה שמופיעה בוואטסאפ לפני ההודעה המוכנה - Meta מחייבת אותה)');

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
    need(isNonEmptyString(ad?.text), `${label}: חסר text (הטקסט הראשי של המודעה)`);
    need(isNonEmptyString(ad?.headline || plan.headline), `${label}: חסרה כותרת (headline במודעה או בתוכנית)`);
    const imgs = ad?.images;
    if (!Array.isArray(imgs) || imgs.length === 0) {
      errors.push(`${label}: חסרות images`);
    } else {
      if (imgs.length > 10) errors.push(`${label}: בקרוסלה מותר עד 10 תמונות (יש ${imgs.length})`);
      for (const p of imgs) if (!fileExists(p)) errors.push(`${label}: תמונה לא נמצאה: ${p}`);
    }
    // תיאור (רשות): מחרוזת אחת לכל הכרטיסים, או רשימה - אחת לכל תמונה, באותו סדר
    if (ad?.description !== undefined) {
      const d = ad.description;
      if (Array.isArray(d)) {
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
  for (const s of adSetsOf(plan)) {
    const a = audienceSpecOf(s.audience, safety);
    const where = s.label ? `קבוצה "${s.label}"` : 'הקהל';
    if (a.detailed && !a.advantage_audience && a.detailed_expansion === false) {
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
  return errors;
}

// --- הבקשות ---

export function buildCampaign(plan) {
  return {
    name: plan.name,
    objective: isMultiAdPlan(plan) ? 'OUTCOME_ENGAGEMENT' : plan.objective || 'OUTCOME_LEADS',
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
      ? { targeting_relaxation_types: { custom_audience: audience.custom_audience_expansion ? 1 : 0 } }
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
    targeting: {
      ...targeting,
      publisher_platforms: Object.keys(placements),
      ...(placements.facebook ? { facebook_positions: placements.facebook } : {}),
      ...(placements.instagram ? { instagram_positions: placements.instagram } : {}),
      device_platforms: ['mobile', 'desktop'],
    },
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
  const campaign = buildCampaign(plan);

  if (hasAdSets(plan) && isMultiAdPlan(plan)) {
    const adSetIdOf = ids.adSetIdOf || (() => ids.adSetId);
    return {
      images: [...new Set(plan.ads.flatMap((ad) => ad.images))],
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
        images: [...ad.images],
        creative: buildCreative(plan, ad, { hashes: ad.images.map((p) => ids.hashOf(p)), env }),
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

  const images = [...new Set(plan.ads.flatMap((ad) => ad.images))];
  return {
    images,
    campaign,
    adSet,
    ads: plan.ads.map((ad) => ({
      name: ad.name,
      images: [...ad.images],
      creative: buildCreative(plan, ad, { hashes: ad.images.map((p) => ids.hashOf(p)), env }),
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
