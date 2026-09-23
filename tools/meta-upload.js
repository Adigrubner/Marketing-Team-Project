// 🛑 הכלי היחיד שמותר לו לכתוב ל-Meta - וזה בכוונה.
//
// בלם החירום, אכוף בקוד (לא ניתן לעקיפה דרך פרומפט):
//   1. כל מה שנוצר - נוצר PAUSED. תמיד. אין פרמטר שמשנה את זה.
//   2. תקציב מעל התקרה שב-config/safety.json - הכלי מסרב.
//   3. בלי --confirm הכלי רק מציג מה ייווצר (dry-run) ולא נוגע בכלום.
//   4. אין כאן מחיקה, אין הפעלה, אין שינוי סטטוס - הפונקציות לא קיימות.
//
// שימוש:
//   node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין>            ← dry-run
//   node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין> --confirm  ← יצירה (PAUSED)
//
// הכלי קורא plan.json מתיקיית הקמפיין. מבנה לדוגמה: ראו clients/_template/campaigns/plan.example.json

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEnv, readSafety, ROOT, ok, bad, warn, info, title } from './lib/env.js';
import { requireMetaEnv, graphPost, uploadAdImage, adAccountPath } from './lib/meta.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const dirArg = args.find((a) => !a.startsWith('--'));

function die(msg) { bad(msg); process.exit(1); }

if (!dirArg) die('שימוש: node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין> [--confirm]');

const campaignDir = resolve(ROOT, dirArg);
const planPath = join(campaignDir, 'plan.json');
if (!existsSync(planPath)) die(`לא נמצא plan.json ב-${dirArg}. הקמפיינר אמור לייצר אותו קודם.`);

loadEnv();
const safety = readSafety();

// --- קריאת התוכנית ואימותים ---
let plan;
try { plan = JSON.parse(readFileSync(planPath, 'utf8')); }
catch (e) { die(`plan.json לא תקין: ${e.message}`); }

const errors = [];
const need = (cond, msg) => { if (!cond) errors.push(msg); };

need(plan.name, 'חסר name (שם הקמפיין)');
need(Number.isFinite(plan.daily_budget_ils) && plan.daily_budget_ils > 0, 'חסר daily_budget_ils (תקציב יומי בשקלים)');
need(typeof plan.link_url === 'string' && /^https?:\/\//.test(plan.link_url), 'חסר link_url תקין (לאן המודעה מפנה)');
need(Array.isArray(plan.primary_texts) && plan.primary_texts.length > 0, 'חסרים primary_texts (טקסטים ראשיים)');
need(Array.isArray(plan.headlines) && plan.headlines.length > 0, 'חסרות headlines (כותרות)');
need(Array.isArray(plan.images) && plan.images.length > 0, 'חסרות images (נתיבי תמונות מתוך תיקיית הקמפיין)');

// 🛑 בלם: תקרת תקציב
if (Number.isFinite(plan.daily_budget_ils) && plan.daily_budget_ils > safety.maxDailyBudgetIls) {
  errors.push(
    `התקציב בתוכנית (${plan.daily_budget_ils}₪/יום) חורג מתקרת בלם החירום (${safety.maxDailyBudgetIls}₪/יום). ` +
    'מקטינים את התקציב בתוכנית, או שהבעלים מעדכן ידנית את config/safety.json.'
  );
}

// תמונות קיימות?
const imagePaths = (plan.images || []).map((p) => join(campaignDir, p));
for (const p of imagePaths) if (!existsSync(p)) errors.push(`תמונה לא נמצאה: ${p}`);

if (errors.length) {
  title('התוכנית לא עוברת את הבדיקות');
  errors.forEach(bad);
  process.exit(1);
}

const audience = {
  countries: plan.audience?.countries || safety.allowedCountries || ['IL'],
  age_min: plan.audience?.age_min || 21,
  age_max: plan.audience?.age_max || 65,
};

// --- תצוגת מה-ייווצר (תמיד) ---
title(confirm ? 'יוצרים ב-Meta (הכל PAUSED)' : 'Dry Run - מה עומד להיווצר (שום דבר עוד לא נוצר)');
info(`קמפיין:        ${plan.name}`);
info(`מטרה:          ${plan.objective || 'OUTCOME_LEADS'}`);
info(`תקציב יומי:    ${plan.daily_budget_ils}₪ (תקרה: ${safety.maxDailyBudgetIls}₪) ✅`);
info(`קהל:           ${audience.countries.join(',')} · גילאי ${audience.age_min}-${audience.age_max}`);
info(`לינק יעד:      ${plan.link_url}`);
info(`טקסטים:        ${plan.primary_texts.length} · כותרות: ${plan.headlines.length} · תמונות: ${plan.images.length}`);
if (plan.url_tags) info(`UTM:           ${plan.url_tags}`);
info(`סטטוס יצירה:   PAUSED (קבוע - אי אפשר אחרת דרך הכלי הזה)`);

if (!confirm) {
  console.log('\n👀 זה היה dry-run בלבד. אם הכל נראה טוב, מריצים שוב עם --confirm');
  process.exit(0);
}

// --- יצירה בפועל ---
try {
  requireMetaEnv();
} catch (e) {
  die(e.message);
}

try {
  // 1. תמונות → hashes
  const hashes = [];
  for (const p of imagePaths) {
    const hash = await uploadAdImage(readFileSync(p));
    hashes.push(hash);
    ok(`הועלתה תמונה (${hash.slice(0, 10)}…)`);
  }

  // 2. קמפיין (PAUSED)
  const campaign = await graphPost(adAccountPath('campaigns'), {
    name: plan.name,
    objective: plan.objective || 'OUTCOME_LEADS',
    special_ad_categories: plan.special_ad_categories || [],
    status: 'PAUSED',
  });
  ok(`קמפיין נוצר: ${campaign.id}`);

  // 3. אד-סט (PAUSED, תקציב אחרי בלם)
  const adSetBody = {
    name: `${plan.name} · Ad Set`,
    campaign_id: campaign.id,
    daily_budget: Math.round(plan.daily_budget_ils * 100),
    billing_event: 'IMPRESSIONS',
    optimization_goal: plan.optimization_goal || (process.env.META_PIXEL_ID ? 'OFFSITE_CONVERSIONS' : 'LINK_CLICKS'),
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: {
      geo_locations: { countries: audience.countries },
      age_min: audience.age_min,
      age_max: audience.age_max,
      targeting_automation: { advantage_audience: 0 },
    },
    status: 'PAUSED',
    ...(plan.is_dynamic_creative ? { is_dynamic_creative: true } : {}),
  };
  if (process.env.META_PIXEL_ID && (adSetBody.optimization_goal === 'OFFSITE_CONVERSIONS')) {
    adSetBody.promoted_object = { pixel_id: process.env.META_PIXEL_ID, custom_event_type: plan.conversion_event || 'LEAD' };
  }
  const adSet = await graphPost(adAccountPath('adsets'), adSetBody);
  ok(`אד-סט נוצר: ${adSet.id}`);

  // 4. קריאייטיב
  const creativeBody = plan.is_dynamic_creative
    ? {
        name: `${plan.name} · Creative`,
        object_story_spec: { page_id: process.env.META_PAGE_ID },
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
          page_id: process.env.META_PAGE_ID,
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
  if (plan.url_tags) creativeBody.url_tags = plan.url_tags;

  const creative = await graphPost(adAccountPath('adcreatives'), creativeBody);
  ok(`קריאייטיב נוצר: ${creative.id}`);

  // 5. מודעה (PAUSED)
  const ad = await graphPost(adAccountPath('ads'), {
    name: `${plan.name} · Ad`,
    adset_id: adSet.id,
    creative: { creative_id: creative.id },
    status: 'PAUSED',
  });
  ok(`מודעה נוצרה: ${ad.id}`);

  title('הקמפיין מוכן - ומושהה');
  console.log('הכל נוצר במצב PAUSED. שום שקל לא יוצא עד שתפעילו ידנית.');
  console.log('➡️  הצעד הבא: פתחו את Ads Manager, עברו על הקמפיין עם הצ\'קליסט, והפעילו כשאתם מרוצים.');
} catch (e) {
  bad(`היצירה נעצרה: ${e.message}`);
  console.log('טיפ: הדביקו את השגיאה הזו לקלוד ובקשו עזרה, או הריצו npm run doctor.');
  process.exit(1);
}
