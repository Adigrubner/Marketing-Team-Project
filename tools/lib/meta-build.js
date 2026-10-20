// בניית הבקשות ל-Meta - פונקציות טהורות, בלי רשת ובלי קבצים.
// ה-dry-run, מצב הבדיקה (--check) והיצירה (--confirm) משתמשים באותן פונקציות,
// ולכן מה שמוצג ב-dry-run הוא בדיוק מה שנשלח.
//
// 🛑 בלם החירום כאן:
//   - כל קמפיין, אד-סט ומודעה נבנים עם status: 'PAUSED'. אין פרמטר שמשנה את זה.
//   - תקציב מעל התקרה, רשת שותפים או מסנג'ר - נעצרים בבדיקת התוכנית.

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

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// האם זו תוכנית בפורמט החדש (רשימת מודעות) או בפורמט הישן (מודעה אחת)?
export const isMultiAdPlan = (plan) => Array.isArray(plan?.ads);

export function placementsOf(plan) {
  return plan.placements || DEFAULT_PLACEMENTS;
}

export function audienceOf(plan, safety) {
  const a = plan.audience || {};
  return {
    countries: a.countries || safety.allowedCountries || ['IL'],
    age_min: a.age_min || 21,
    ...(a.age_max ? { age_max: a.age_max } : {}),
    advantage_audience: a.advantage_audience === true,
  };
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
  need(Number.isFinite(plan.daily_budget_ils) && plan.daily_budget_ils > 0, 'חסר daily_budget_ils (תקציב יומי בשקלים)');

  // 🛑 בלם: תקרת תקציב
  if (Number.isFinite(plan.daily_budget_ils) && plan.daily_budget_ils > safety.maxDailyBudgetIls) {
    errors.push(
      `התקציב בתוכנית (${plan.daily_budget_ils}₪/יום) חורג מתקרת בלם החירום (${safety.maxDailyBudgetIls}₪/יום). ` +
      'מקטינים את התקציב בתוכנית, או שהבעלים מעדכן ידנית את config/safety.json.'
    );
  }

  if (!isMultiAdPlan(plan)) {
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
  });

  return errors;
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

export function buildAdSet(plan, { campaignId, env, safety }) {
  const audience = audienceOf(plan, safety);
  const targeting = {
    geo_locations: { countries: audience.countries },
    age_min: audience.age_min,
    ...(audience.age_max ? { age_max: audience.age_max } : {}),
    targeting_automation: { advantage_audience: audience.advantage_audience ? 1 : 0 },
  };

  if (!isMultiAdPlan(plan)) {
    // הפורמט הישן - כמו שהיה
    const body = {
      name: `${plan.name} · Ad Set`,
      campaign_id: campaignId,
      daily_budget: Math.round(plan.daily_budget_ils * 100),
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
    name: `${plan.name} · Ad Set`,
    campaign_id: campaignId,
    daily_budget: Math.round(plan.daily_budget_ils * 100),
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

// hashes: ה-hash של כל תמונה במודעה, באותו סדר כמו ad.images
export function buildCreative(plan, ad, { hashes, env }) {
  const headline = ad.headline || plan.headline;
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
  } else {
    // קרוסלה: הסדר נשמר כמו שנבחר, ובלי כרטיס סיום אוטומטי
    linkData.child_attachments = hashes.map((hash) => ({
      link: WHATSAPP_LINK,
      image_hash: hash,
      name: headline,
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

export function buildAd(plan, ad, { adSetId, creativeId }) {
  return {
    name: isMultiAdPlan(plan) ? `${plan.name} · ${ad.name}` : `${plan.name} · Ad`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  };
}

// --- כל התוכנית, כרשימת צעדים ---
// ids: מזהים אמיתיים (ביצירה) או מצייני מקום (ב-dry-run).
// מחזיר: { images, campaign, adSet, ads: [{ name, images, creative, ad }] }
export function buildAll(plan, { env, safety, ids }) {
  const campaign = buildCampaign(plan);
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
