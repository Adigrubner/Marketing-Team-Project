// 🛑 הכלי היחיד שמותר לו לכתוב ל-Meta - וזה בכוונה.
//
// בלם החירום, אכוף בקוד (לא ניתן לעקיפה דרך פרומפט):
//   1. כל מה שנוצר - נוצר PAUSED. תמיד. אין פרמטר שמשנה את זה (ונבדק שוב לפני כל שליחה).
//   2. תקציב מעל התקרה שב-config/safety.json - הכלי מסרב. בכמה קבוצות מודעות (ad_sets):
//      התקרה נאכפת לכל קבוצה וגם על הסכום של כולן (ונבדק שוב לפני כל שליחה).
//   3. בלי --confirm הכלי לא יוצר כלום.
//   4. אין כאן מחיקה, אין הפעלה, אין שינוי סטטוס - הפונקציות לא קיימות.
//   5. רק פייסבוק ואינסטגרם - בלי רשת השותפים ובלי מסנג'ר. רק מדינות מ-safety.json.
//   6. חשבון המודעות חייב להיות במטבע של safety.json (אחרת "50" יכול להפוך ל-50$).
//   7. אחרי יצירה נשמר upload-log.json, ואם הוא קיים - הכלי מסרב לרוץ שוב (בלי קמפיינים כפולים).
//   8. קהלים מותאמים / פירוט טירגוט: לפני יצירה הכלי בודק מול Meta (קריאה בלבד) שכל קהל קיים בחשבון,
//      מוכן לשימוש, ושההגדרות מתקבלות. אם לא - עוצר לפני שנוצר משהו.
//
// שימוש:
//   node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין>            ← dry-run: מה ייווצר (בלי אינטרנט)
//   node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין> --check    ← Meta בודקת בלי ליצור (התמונות עולות לספרייה בלבד)
//   node tools/meta-upload.js clients/<לקוח>/campaigns/<קמפיין> --confirm  ← יצירה (הכל PAUSED)
//
// הכלי קורא plan.json מתיקיית הקמפיין. מבנה לדוגמה: clients/_template/campaigns/plan.whatsapp.example.json (וואטסאפ, כמה מודעות),
// plan.whatsapp.adsets.example.json (כמה קבוצות מודעות, קהלים מותאמים ופירוט טירגוט) או plan.example.json (הפורמט הישן)
// (גם הפורמט הישן, של מודעה אחת עם link_url, ממשיך לעבוד).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { loadEnv, readSafety, ROOT, ok, bad, warn, info, title } from './lib/env.js';
import { requireMetaEnv, graphGet, graphPost, uploadAdImage, adAccountPath } from './lib/meta.js';
import {
  validatePlan, validateEnvForPlan, buildAll, assertPaused, assertBudget, isMultiAdPlan, hasAdSets,
  placementsOf, audienceOf, audienceSpecOf, adSetsOf, totalDailyBudgetIls, endTimeOf,
  usesAdvancedAudience, describeAdvancedAudience, planWarnings, needsAudiencePreflight,
  customAudienceRefsOf, judgeCustomAudience, sizeRangeText, detailedItemsOf, cardDescriptionsOf,
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
const audienceLine = (a) =>
  `${a.countries.join(',')} · מגיל ${a.age_min}` +
  `${a.age_max ? ` עד ${a.age_max}` : ''}` +
  `${isMultiAdPlan(plan) ? (a.advantage_audience ? ' · קהל אוטומטי של Meta' : ' · בלי קהל אוטומטי') : ''}`;
info(`קמפיין:        ${plan.name}`);
if (hasAdSets(plan)) {
  info(`תקציב יומי:    ${totalDailyBudgetIls(plan)}₪ בסך הכל (תקרה: ${safety.maxDailyBudgetIls}₪ - לכל קבוצה וגם לסכום) ✅`);
  info(`קבוצות מודעות: ${plan.ad_sets.length}`);
  adSetsOf(plan).forEach((s, i) => {
    const a = audienceSpecOf(s.audience, safety);
    info(`  ${i + 1}. ${s.label} · ${s.daily_budget_ils}₪ ליום`);
    info(`     קהל:          ${audienceLine(a)}`);
    describeAdvancedAudience(a).forEach((l) => info(`     ${l}`));
  });
} else {
  const audience = audienceOf(plan, safety);
  info(`תקציב יומי:    ${plan.daily_budget_ils}₪ (תקרה: ${safety.maxDailyBudgetIls}₪) ✅`);
  info(`קהל:           ${audienceLine(audience)}`);
  describeAdvancedAudience(audience).forEach((l) => info(`               ${l}`));
}
if (isMultiAdPlan(plan)) {
  const pl = placementsOf(plan);
  info(`מטרה:          שיחות בוואטסאפ (OUTCOME_ENGAGEMENT)`);
  info(`איפה:          ${Object.entries(pl).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ')}`);
  info(`סיום:          ${plan.end_date ? `${plan.end_date} (${endTimeOf(plan.end_date)})` : 'בלי תאריך סיום - רץ עד שמכבים ידנית'}`);
  info(`הודעה מוכנה:   "${plan.whatsapp.autofill_message}"`);
  if (plan.whatsapp.greeting) info(`הודעת ברכה:    "${plan.whatsapp.greeting}"`);
  info(`בשם:           דף ${process.env.META_PAGE_ID ? '✅' : '(עוד לא ב-.env)'} · אינסטגרם ${process.env.META_INSTAGRAM_USER_ID ? '✅' : '(עוד לא ב-.env)'}`);
  info(
    hasAdSets(plan)
      ? `מודעות:        ${plan.ads.length} בכל קבוצה (${plan.ads.length * plan.ad_sets.length} מודעות, ${plan.ads.length} קריאייטיבים משותפים)`
      : `מודעות:        ${plan.ads.length}`
  );
  plan.ads.forEach((ad, i) => {
    info(`  ${i + 1}. ${ad.name} · ${ad.images.length === 1 ? 'תמונה אחת' : `קרוסלה של ${ad.images.length}`}: ${ad.images.map((p) => basename(p)).join(', ')}`);
    info(`     כותרת: ${ad.headline || plan.headline}`);
    const desc = cardDescriptionsOf(ad, ad.images.length);
    if (desc.some(Boolean)) info(`     תיאור: ${[...new Set(desc)].map((d) => d || '(ריק)').join(' | ')} (בפייסבוק בלבד)`);
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
planWarnings(plan, safety).forEach(warn);

// מה בדיוק יישלח - נשמר לקובץ (בלי טוקנים), עם מצייני מקום למזהים שעוד לא קיימים
const preview = buildAll(plan, {
  env: process.env,
  safety,
  ids: {
    campaignId: '<מזהה הקמפיין>',
    adSetId: '<מזהה האד-סט>',
    adSetIdOf: (name) => `<מזהה האד-סט ${name}>`,
    hashOf: (p) => `<התמונה ${p}>`,
    creativeIdOf: (name) => `<הקריאייטיב של ${name}>`,
  },
});
writeFileSync(join(campaignDir, 'dry-run.json'), JSON.stringify(preview, null, 2));
info(`הבקשות המלאות: dry-run.json בתיקיית הקמפיין`);

// כל קבוצות המודעות שנבנו, בצורה אחידה: [{ label, body }]
const adSetBodiesOf = (built) =>
  built.ad_sets ? built.ad_sets.map((s) => ({ label: s.name, body: s.adSet })) : [{ label: null, body: built.adSet }];

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

  // 🛑 בלם: קהלים מותאמים / פירוט טירגוט - בדיקה מול Meta (קריאה בלבד) לפני שנוצר משהו
  let audienceFailures = 0;
  if (check || needsAudiencePreflight(plan, safety)) {
    audienceFailures = await runAudienceCheck(preview);
    if (confirm && audienceFailures) {
      die(`בדיקת הקהלים מול Meta מצאה ${audienceFailures} בעיות - עוצרים לפני שנוצר משהו. מריצים --check לפרטים.`);
    }
  }

  // 1. תמונות → hashes (ספרייה בלבד, לא מודעות)
  const hashes = {};
  for (const p of preview.images) {
    hashes[p] = await uploadAdImage(readFileSync(imagePath(p)), p);
    ok(`תמונה עלתה לספרייה: ${basename(p)}`);
  }
  const hashOf = (p) => hashes[p];

  if (check) {
    await runCheck(hashOf, audienceFailures);
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

// --- בדיקת הקהלים מול Meta - קריאה בלבד (GET), לא נוצר ולא משתנה כלום ---
// 1. כל קהל מותאם (כולל החרגות): קיים, שייך לחשבון הזה, ומוכן לשימוש. ומה הגודל שלו.
// 2. כל קבוצת מודעות: הערכת הגודל של Meta לטירגוט המלא (delivery_estimate) - כולל ההגדרות של ההרחבות.
// 3. פירוט טירגוט: כל מזהה לבד, כדי לתפוס מזהה שגוי (Meta מחזירה 0 במקום שגיאה).
// מחזיר את מספר הבעיות החוסמות.
async function runAudienceCheck(built) {
  title('קהלים - בדיקה מול Meta (קריאה בלבד)');
  let failed = 0;
  const estimate = async (body, targeting) => {
    const r = await graphGet(adAccountPath('delivery_estimate'), {
      optimization_goal: body.optimization_goal,
      targeting_spec: JSON.stringify(targeting),
      ...(body.promoted_object ? { promoted_object: JSON.stringify(body.promoted_object) } : {}),
    });
    return r.data?.[0] || {};
  };

  for (const ref of customAudienceRefsOf(plan, safety)) {
    const where = ref.usedIn.map((u) => `${u.excluded ? 'מוחרג ב' : ''}${u.adSet ? `"${u.adSet}"` : 'קבוצה'}`).join(', ');
    try {
      const m = await graphGet(ref.id, {
        fields: 'name,account_id,subtype,operation_status,delivery_status,approximate_count_lower_bound,approximate_count_upper_bound',
      });
      const j = judgeCustomAudience(m, { accountId: process.env.META_AD_ACCOUNT_ID, expectedName: ref.name });
      const size = sizeRangeText(m.approximate_count_lower_bound, m.approximate_count_upper_bound);
      if (j.problems.length) { failed++; bad(`קהל "${m.name || ref.id}" (${ref.id}, ${where}) - ${j.problems.join(' · ')}`); }
      else ok(`קהל "${m.name}" (${ref.id}, ${where}) - קיים בחשבון ומוכן לשימוש · ${size}`);
      j.warnings.forEach((w) => warn(`   ${w}`));
    } catch (e) { failed++; bad(`קהל ${ref.id} (${where}) - ${e.message}`); }
  }

  for (const { label, body } of adSetBodiesOf(built)) {
    const name = label ? `קבוצה "${label}"` : 'הקבוצה';
    const advanced = usesAdvancedAudience(audienceSpecOf(adSetsOf(plan).find((s) => s.label === label).audience, safety));
    try {
      const d = await estimate(body, body.targeting);
      const size = sizeRangeText(d.estimate_mau_lower_bound, d.estimate_mau_upper_bound);
      if (d.estimate_ready === false) warn(`${name} - Meta עוד לא מוכנה לתת הערכה (קהל שעוד מתמלא)`);
      if (Number(d.estimate_mau_upper_bound) === 0) {
        if (advanced) failed++;
        (advanced ? bad : warn)(`${name} - הערכת הגודל של Meta: 0 איש. אף אחד לא עונה על ההגדרות`);
      } else ok(`${name} - הערכת הגודל של Meta: ${size}`);
    } catch (e) {
      if (advanced) failed++;
      (advanced ? bad : warn)(`${name} - ${e.message}`);
      // אם Meta דחתה רק את הבקשה לכבות את הרחבת פירוט הטירגוט - מה הגודל בלעדיה (ואז Meta תרחיב)
      if (body.targeting.targeting_optimization) {
        const { targeting_optimization, ...rest } = body.targeting;
        try {
          const d = await estimate(body, rest);
          info(`   בלי הבקשה לכבות את ההרחבה: ${sizeRangeText(d.estimate_mau_lower_bound, d.estimate_mau_upper_bound)} - אבל אז Meta יכולה להרחיב מעבר לזה`);
        } catch { /* רק מידע נוסף */ }
      }
    }

    // כל מזהה של פירוט טירגוט לבד (בלי targeting_optimization, כדי לבדוק רק את המזהה)
    const a = audienceSpecOf(adSetsOf(plan).find((s) => s.label === label).audience, safety);
    if (a.detailed) {
      const { targeting_optimization, flexible_spec, ...rest } = body.targeting;
      const items = detailedItemsOf(a.detailed);
      const empty = [];
      for (const it of items) {
        try {
          const d = await estimate(body, { ...rest, flexible_spec: [{ [it.type]: [{ id: String(it.id) }] }] });
          if (Number(d.estimate_mau_upper_bound) === 0) empty.push(`${it.name || it.id} (${it.type})`);
        } catch (e) { empty.push(`${it.name || it.id} (${it.type}): ${e.message}`); }
      }
      if (empty.length) warn(`${name} - מזהים בלי אף אחד (לבדוק אם המזהה נכון): ${empty.join(' · ')}`);
      else ok(`${name} - כל ${items.length} המזהים של פירוט הטירגוט נמצאו ב-Meta`);
    }
  }
  return failed;
}

// --- --check: Meta בודקת את הבקשות בלי ליצור (validate_only) ---
async function runCheck(hashOf, audienceFailures = 0) {
  const built = buildAll(plan, {
    env: process.env, safety,
    ids: { campaignId: '0', adSetId: '0', adSetIdOf: () => '0', hashOf, creativeIdOf: () => '0' },
  });
  const validateOnly = { execution_options: ['validate_only'] };
  let failed = audienceFailures;
  title('קמפיין וקריאייטיבים - Meta בודקת בלי ליצור');

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

  warn(
    'האד-סט והמודעות לא נבדקו: Meta צריכה קמפיין קיים כדי לבדוק אותם. הם ייבדקו ביצירה עצמה.' +
    (needsAudiencePreflight(plan, safety) ? ' (הקהלים וההגדרות שלהם כן נבדקו למעלה, דרך הערכת הגודל.)' : '')
  );
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

  if (!hasAdSets(plan)) {
    // קבוצת מודעות אחת - בדיוק כמו קודם
    const adSetBody = buildAll(plan, { env: process.env, safety, ids }).adSet;
    assertPaused(adSetBody, 'האד-סט');
    assertBudget(adSetBody, safety, 'האד-סט');
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
  } else {
    // כמה קבוצות מודעות: כל קבוצה, ואחריה המודעות שלה. קריאייטיב אחד לכל מודעה, משותף לכל הקבוצות.
    const adSetIds = {};
    const creativeIds = {};
    ids.adSetIdOf = (name) => adSetIds[name];
    ids.creativeIdOf = (name) => creativeIds[name];
    const build = () => buildAll(plan, { env: process.env, safety, ids });

    // 🛑 בלם: התקרה גם על הסכום, ממש לפני השליחה
    const totalAgorot = build().ad_sets.reduce((sum, s) => sum + s.adSet.daily_budget, 0);
    if (totalAgorot > Math.round(safety.maxDailyBudgetIls * 100)) {
      throw new Error('בלם חירום: סך התקציב של הקבוצות מעל התקרה - עוצרים בלי לשלוח.');
    }

    for (const { name: setName } of build().ad_sets) {
      const adSetBody = build().ad_sets.find((s) => s.name === setName).adSet;
      assertPaused(adSetBody, `האד-סט "${setName}"`);
      assertBudget(adSetBody, safety, `האד-סט "${setName}"`);
      const adSet = await graphPost(adAccountPath('adsets'), adSetBody);
      record('adset', adSetBody.name, adSet.id);
      adSetIds[setName] = adSet.id;
      ok(`אד-סט נוצר: ${setName} (${adSet.id})`);

      for (const a of plan.ads) {
        if (!creativeIds[a.name]) {
          const creativeBody = build().ads.find((x) => x.name === a.name).creative;
          const creative = await graphPost(adAccountPath('adcreatives'), creativeBody);
          record('creative', a.name, creative.id);
          creativeIds[a.name] = creative.id;
        }
        const adBody = build().ad_sets.find((s) => s.name === setName).ads.find((x) => x.name === a.name).ad;
        assertPaused(adBody, `המודעה "${a.name}"`);
        if (!adBody.adset_id || !adBody.creative?.creative_id) throw new Error(`חסר מזהה למודעה "${a.name}" - עוצרים בלי לשלוח.`);
        const ad = await graphPost(adAccountPath('ads'), adBody);
        record('ad', `${setName} · ${a.name}`, ad.id);
        ok(`מודעה נוצרה: ${setName} · ${a.name} (${ad.id})`);
      }
    }
  }

  title('הקמפיין מוכן - ומושהה');
  console.log('הכל נוצר במצב PAUSED. שום שקל לא יוצא עד שתפעילו ידנית.');
  console.log('המזהים נשמרו ב-upload-log.json בתיקיית הקמפיין.');
  console.log('➡️  הצעד הבא: ב-Ads Manager לעבור על התצוגה המקדימה של כל מיקום, ולהפעיל ידנית כשמרוצים.');
}
