// 🛑 הכלי היחיד שמותר לו לכתוב ל-Meta - וזה בכוונה.
//
// בלם החירום, אכוף בקוד (לא ניתן לעקיפה דרך פרומפט):
//   1. כל מה שנוצר - נוצר PAUSED. תמיד. אין פרמטר שמשנה את זה (ונבדק שוב לפני כל שליחה).
//   2. תקציב מעל התקרה שב-config/safety.json - הכלי מסרב.
//   3. בלי --confirm הכלי לא יוצר כלום.
//   4. אין כאן מחיקה, אין הפעלה, אין שינוי סטטוס - הפונקציות לא קיימות.
//   5. רק פייסבוק ואינסטגרם - בלי רשת השותפים ובלי מסנג'ר.
//   6. חשבון המודעות חייב להיות במטבע של safety.json (אחרת "50" יכול להפוך ל-50$).
//   7. אחרי יצירה נשמר upload-log.json, ואם הוא קיים - הכלי מסרב לרוץ שוב (בלי קמפיינים כפולים).
//
// שימוש:
//   node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין>            ← dry-run: מה ייווצר (בלי אינטרנט)
//   node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין> --check    ← Meta בודקת בלי ליצור (התמונות עולות לספרייה בלבד)
//   node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין> --confirm  ← יצירה (הכל PAUSED)
//
// הכלי קורא plan.json מתיקיית הקמפיין. מבנה לדוגמה: clients/_template/campaigns/plan.whatsapp.example.json (וואטסאפ, כמה מודעות) או plan.example.json (הפורמט הישן)
// (גם הפורמט הישן, של מודעה אחת עם link_url, ממשיך לעבוד).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { loadEnv, readSafety, ROOT, ok, bad, warn, info, title } from './lib/env.js';
import { requireMetaEnv, graphGet, graphPost, uploadAdImage, adAccountPath } from './lib/meta.js';
import {
  validatePlan, validateEnvForPlan, buildAll, assertPaused, isMultiAdPlan,
  placementsOf, audienceOf, endTimeOf,
} from './lib/meta-build.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const check = args.includes('--check');
const dirArg = args.find((a) => !a.startsWith('--'));

function die(msg) { bad(msg); process.exit(1); }

if (!dirArg) die('שימוש: node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין> [--check | --confirm]');
if (confirm && check) die('או --check או --confirm, לא שניהם.');

const campaignDir = resolve(ROOT, dirArg);
const planPath = join(campaignDir, 'plan.json');
const logPath = join(campaignDir, 'upload-log.json');
if (!existsSync(planPath)) die(`לא נמצא plan.json ב-${dirArg}. הקמפיינר אמור לייצר אותו קודם.`);

loadEnv();
const safety = readSafety();

// --- קריאת התוכנית ואימותים ---
let plan;
try { plan = JSON.parse(readFileSync(planPath, 'utf8')); }
catch (e) { die(`plan.json לא תקין: ${e.message}`); }

const imagePath = (p) => resolve(campaignDir, p);
const errors = validatePlan(plan, { safety, fileExists: (p) => existsSync(imagePath(p)) });
if (errors.length) {
  title('התוכנית לא עוברת את הבדיקות');
  errors.forEach(bad);
  process.exit(1);
}

// --- תצוגת מה-ייווצר (תמיד) ---
const modeTitle = confirm
  ? 'יוצרים ב-Meta (הכל PAUSED)'
  : check
    ? 'בדיקה מול Meta - שום קמפיין או מודעה לא נוצרים'
    : 'Dry Run - מה עומד להיווצר (שום דבר עוד לא נוצר)';
title(modeTitle);

const short = (t, n = 70) => (t.length > n ? `${t.slice(0, n).replace(/\s+$/, '')}…` : t);
const audience = audienceOf(plan, safety);
info(`קמפיין:        ${plan.name}`);
info(`תקציב יומי:    ${plan.daily_budget_ils}₪ (תקרה: ${safety.maxDailyBudgetIls}₪) ✅`);
info(
  `קהל:           ${audience.countries.join(',')} · מגיל ${audience.age_min}` +
  `${audience.age_max ? ` עד ${audience.age_max}` : ''}` +
  `${isMultiAdPlan(plan) ? (audience.advantage_audience ? ' · קהל אוטומטי של Meta' : ' · בלי קהל אוטומטי') : ''}`
);
if (isMultiAdPlan(plan)) {
  const pl = placementsOf(plan);
  info(`מטרה:          שיחות בוואטסאפ (OUTCOME_ENGAGEMENT)`);
  info(`איפה:          ${Object.entries(pl).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ')}`);
  info(`סיום:          ${plan.end_date ? `${plan.end_date} (${endTimeOf(plan.end_date)})` : 'בלי תאריך סיום - רץ עד שמכבים ידנית'}`);
  info(`הודעה מוכנה:   "${plan.whatsapp.autofill_message}"`);
  if (plan.whatsapp.greeting) info(`הודעת ברכה:    "${plan.whatsapp.greeting}"`);
  info(`בשם:           דף ${process.env.META_PAGE_ID ? '✅' : '(עוד לא ב-.env)'} · אינסטגרם ${process.env.META_INSTAGRAM_USER_ID ? '✅' : '(עוד לא ב-.env)'}`);
  info(`מודעות:        ${plan.ads.length}`);
  plan.ads.forEach((ad, i) => {
    info(`  ${i + 1}. ${ad.name} · ${ad.images.length === 1 ? 'תמונה אחת' : `קרוסלה של ${ad.images.length}`}: ${ad.images.map((p) => basename(p)).join(', ')}`);
    info(`     כותרת: ${ad.headline || plan.headline}`);
    const lines = ad.text.split('\n').filter((l) => l.trim());
    info(`     טקסט:  ${short(lines[0])}`);
    if (lines.length > 1) info(`     ...    ${short(lines[lines.length - 1])}`);
  });
} else {
  info(`מטרה:          ${plan.objective || 'OUTCOME_LEADS'}`);
  info(`לינק יעד:      ${plan.link_url}`);
  info(`טקסטים:        ${plan.primary_texts.length} · כותרות: ${plan.headlines.length} · תמונות: ${plan.images.length}`);
  if (plan.url_tags) info(`UTM:           ${plan.url_tags}`);
}
info(`סטטוס יצירה:   PAUSED (קבוע - אי אפשר אחרת דרך הכלי הזה)`);

// מה בדיוק יישלח - נשמר לקובץ (בלי טוקנים), עם מצייני מקום למזהים שעוד לא קיימים
const preview = buildAll(plan, {
  env: process.env,
  safety,
  ids: {
    campaignId: '<מזהה הקמפיין>',
    adSetId: '<מזהה האד-סט>',
    hashOf: (p) => `<התמונה ${p}>`,
    creativeIdOf: (name) => `<הקריאייטיב של ${name}>`,
  },
});
writeFileSync(join(campaignDir, 'dry-run.json'), JSON.stringify(preview, null, 2));
info(`הבקשות המלאות: dry-run.json בתיקיית הקמפיין`);

const envErrors = validateEnvForPlan(plan, process.env);

if (!confirm && !check) {
  envErrors.forEach(warn);
  console.log('\n👀 זה היה dry-run בלבד. הצעד הבא: --check (Meta בודקת בלי ליצור), ואחרי אישור - --confirm');
  process.exit(0);
}

// --- מכאן: עבודה מול Meta ---
if (envErrors.length) { envErrors.forEach(bad); process.exit(1); }
try { requireMetaEnv(); } catch (e) { die(e.message); }

if (confirm && existsSync(logPath)) {
  die(
    'כבר נוצר קמפיין מהתיקייה הזו (יש upload-log.json). כדי לא ליצור כפול, הכלי עוצר. ' +
    'בודקים ב-Ads Manager מה קיים. אם באמת צריך ליצור מחדש - הבעלים מעביר את upload-log.json לתיקייה אחרת בעצמו.'
  );
}

try {
  // 🛑 בלם: המטבע של חשבון המודעות
  const acct = await graphGet(`act_${process.env.META_AD_ACCOUNT_ID}`, { fields: 'currency' });
  if (acct.currency !== safety.currency) {
    die(`חשבון המודעות במטבע ${acct.currency}, ותקרת הבטיחות מוגדרת ב-${safety.currency}. עוצרים כדי שהתקציב לא יתפרש לא נכון.`);
  }
  ok(`חשבון המודעות במטבע ${acct.currency}`);

  // 1. תמונות → hashes (ספרייה בלבד, לא מודעות)
  const hashes = {};
  for (const p of preview.images) {
    hashes[p] = await uploadAdImage(readFileSync(imagePath(p)), p);
    ok(`תמונה עלתה לספרייה: ${basename(p)}`);
  }
  const hashOf = (p) => hashes[p];

  if (check) {
    await runCheck(hashOf);
  } else {
    await runCreate(hashOf);
  }
} catch (e) {
  bad(`נעצר: ${e.message}`);
  if (confirm && existsSync(logPath)) {
    console.log('מה שכבר נוצר (הכל PAUSED) רשום ב-upload-log.json. לא מריצים שוב - קודם בודקים ב-Ads Manager.');
  }
  console.log('טיפ: הדביקו את השגיאה הזו לקלוד ובקשו עזרה, או הריצו npm run doctor.');
  process.exit(1);
}

// --- --check: Meta בודקת את הבקשות בלי ליצור (validate_only) ---
async function runCheck(hashOf) {
  const built = buildAll(plan, {
    env: process.env, safety,
    ids: { campaignId: '0', adSetId: '0', hashOf, creativeIdOf: () => '0' },
  });
  const validateOnly = { execution_options: ['validate_only'] };
  let failed = 0;

  try {
    await graphPost(adAccountPath('campaigns'), { ...built.campaign, ...validateOnly });
    ok('קמפיין - Meta אישרה את הבקשה');
  } catch (e) { failed++; bad(`קמפיין - ${e.message}`); }

  for (const a of built.ads) {
    try {
      await graphPost(adAccountPath('adcreatives'), { ...a.creative, ...validateOnly });
      ok(`קריאייטיב "${a.name}" - Meta אישרה את הבקשה`);
    } catch (e) { failed++; bad(`קריאייטיב "${a.name}" - ${e.message}`); }
  }

  warn('האד-סט והמודעות לא נבדקו: Meta צריכה קמפיין קיים כדי לבדוק אותם. הם ייבדקו ביצירה עצמה.');
  title(failed ? `נמצאו ${failed} בעיות - לא ממשיכים ל---confirm` : 'הבדיקה עברה - שום דבר לא נוצר');
  if (!failed) console.log('אם הכל נראה טוב, מריצים שוב עם --confirm');
  if (failed) process.exit(1);
}

// --- --confirm: יצירה, הכל PAUSED, עם יומן ---
async function runCreate(hashOf) {
  const log = { plan: plan.name, started_at: new Date().toISOString(), created: [] };
  const record = (type, name, id) => {
    log.created.push({ type, name, id });
    writeFileSync(logPath, JSON.stringify(log, null, 2));
  };
  const ids = { campaignId: null, adSetId: null, hashOf, creativeIdOf: () => null };

  const campaignBody = buildAll(plan, { env: process.env, safety, ids }).campaign;
  assertPaused(campaignBody, 'הקמפיין');
  const campaign = await graphPost(adAccountPath('campaigns'), campaignBody);
  record('campaign', plan.name, campaign.id);
  ok(`קמפיין נוצר: ${campaign.id}`);

  ids.campaignId = campaign.id;
  const adSetBody = buildAll(plan, { env: process.env, safety, ids }).adSet;
  assertPaused(adSetBody, 'האד-סט');
  const adSet = await graphPost(adAccountPath('adsets'), adSetBody);
  record('adset', adSetBody.name, adSet.id);
  ok(`אד-סט נוצר: ${adSet.id}`);

  ids.adSetId = adSet.id;
  const creativeIds = {};
  ids.creativeIdOf = (name) => creativeIds[name];
  for (const a of buildAll(plan, { env: process.env, safety, ids }).ads) {
    const creative = await graphPost(adAccountPath('adcreatives'), a.creative);
    record('creative', a.name, creative.id);
    creativeIds[a.name] = creative.id;

    const adBody = buildAll(plan, { env: process.env, safety, ids }).ads.find((x) => x.name === a.name).ad;
    assertPaused(adBody, `המודעה "${a.name}"`);
    const ad = await graphPost(adAccountPath('ads'), adBody);
    record('ad', a.name, ad.id);
    ok(`מודעה נוצרה: ${a.name} (${ad.id})`);
  }

  title('הקמפיין מוכן - ומושהה');
  console.log('הכל נוצר במצב PAUSED. שום שקל לא יוצא עד שתפעילו ידנית.');
  console.log('המזהים נשמרו ב-upload-log.json בתיקיית הקמפיין.');
  console.log('➡️  הצעד הבא: ב-Ads Manager לעבור על התצוגה המקדימה של כל מיקום, ולהפעיל ידנית כשמרוצים.');
}
