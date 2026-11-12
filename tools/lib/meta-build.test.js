// בדיקות לבניית הבקשות - בלי רשת. מריצים: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePlan, validateEnvForPlan, buildAll, buildAdSet, buildCreative, buildWelcomeMessage,
  assertPaused, endTimeOf, WHATSAPP_LINK, CREATIVE_FEATURES_OPT_OUT,
  adSetsOf, totalDailyBudgetIls, buildTargeting, audienceSpecOf, planWarnings, assertBudget,
  needsAudiencePreflight, customAudienceRefsOf, judgeCustomAudience, sizeRangeText,
  detailedItemsOf, describeAdvancedAudience,
} from './meta-build.js';

const safety = { maxDailyBudgetIls: 100, allowedCountries: ['IL'] };
const env = { META_PAGE_ID: '111', META_INSTAGRAM_USER_ID: '222' };
const exists = () => true;
const today = new Date('2026-10-19T10:00:00Z');

const imgs = (p) => [1, 2, 3, 4, 5].map((n) => `creatives/${p}-${n}-4x5.jpg`);
const plan = () => ({
  name: 'בדיקה',
  destination: 'whatsapp',
  daily_budget_ils: 50,
  audience: { countries: ['IL'], age_min: 25, advantage_audience: true },
  headline: 'אלעד גרובנר - צלם עיצוב פנים ואדריכלות',
  whatsapp: { autofill_message: 'היי אלעד, ראיתי את המודעה ויש לי פרויקט שאשמח לספר לך עליו', greeting: 'היי, כאן אלעד!' },
  ads: [
    { name: 'לירון', text: 'טקסט לירון', images: imgs('liron') },
    { name: 'עליא', text: 'טקסט עליא', images: imgs('alia') },
  ],
});
const fakeIds = {
  campaignId: 'C1',
  adSetId: 'S1',
  hashOf: (p) => `hash:${p}`,
  creativeIdOf: (name) => `CR:${name}`,
};

test('תוכנית תקינה עוברת', () => {
  assert.deepEqual(validatePlan(plan(), { safety, fileExists: exists, today }), []);
});

test('🛑 תקציב מעל התקרה נעצר', () => {
  const p = plan(); p.daily_budget_ils = 101;
  assert.ok(validatePlan(p, { safety, fileExists: exists, today }).some((e) => e.includes('חורג מתקרת')));
});

test('🛑 רשת שותפים ומסנג\'ר נעצרים', () => {
  for (const placements of [
    { facebook: ['feed'], audience_network: ['classic'] },
    { facebook: ['feed'], messenger: ['messenger_home'] },
    { facebook: ['feed', 'instream_video'] },
  ]) {
    const p = plan(); p.placements = placements;
    assert.ok(validatePlan(p, { safety, fileExists: exists, today }).length > 0, JSON.stringify(placements));
  }
});

test('תמונה חסרה, כפילות בשם, יותר מ-10 תמונות - נעצרים', () => {
  const p = plan();
  p.ads[1].name = 'לירון';
  p.ads[0].images = Array.from({ length: 11 }, (_, i) => `x${i}.jpg`);
  const errors = validatePlan(p, { safety, fileExists: (f) => f !== 'x3.jpg', today });
  assert.ok(errors.some((e) => e.includes('השם כבר קיים')));
  assert.ok(errors.some((e) => e.includes('עד 10 תמונות')));
  assert.ok(errors.some((e) => e.includes('x3.jpg')));
});

test('בלי הודעת ברכה - נעצר (Meta מחייבת אותה)', () => {
  const p = plan(); delete p.whatsapp.greeting;
  assert.ok(validatePlan(p, { safety, fileExists: exists, today }).some((e) => e.includes('whatsapp.greeting')));
});

test('בלי הודעה מוכנה בוואטסאפ - נעצר', () => {
  const p = plan(); delete p.whatsapp;
  assert.ok(validatePlan(p, { safety, fileExists: exists, today }).some((e) => e.includes('autofill_message')));
});

test('תאריך סיום שעבר - נעצר; תאריך עתידי - נבנה בשעון ישראל', () => {
  const p = plan(); p.end_date = '2026-10-01';
  assert.ok(validatePlan(p, { safety, fileExists: exists, today }).some((e) => e.includes('כבר עבר')));
  assert.equal(endTimeOf('2026-11-02'), '2026-11-02T23:59:00+02:00'); // שעון חורף
  assert.equal(endTimeOf('2026-07-01'), '2026-07-01T23:59:00+03:00'); // שעון קיץ
});

test('🛑 כל מה שנוצר - PAUSED', () => {
  const all = buildAll(plan(), { env, safety, ids: fakeIds });
  assertPaused(all.campaign, 'קמפיין');
  assertPaused(all.adSet, 'אד-סט');
  for (const a of all.ads) assertPaused(a.ad, 'מודעה');
  assert.throws(() => assertPaused({ status: 'ACTIVE' }, 'מודעה'), /בלם חירום/);
});

test('אד-סט: וואטסאפ, שיחות, תקציב באגורות, רק פייסבוק ואינסטגרם', () => {
  const s = buildAdSet(plan(), { campaignId: 'C1', env, safety });
  assert.equal(s.destination_type, 'WHATSAPP');
  assert.equal(s.optimization_goal, 'CONVERSATIONS');
  assert.equal(s.daily_budget, 5000);
  assert.deepEqual(s.promoted_object, { page_id: '111' });
  assert.deepEqual(s.targeting.publisher_platforms, ['facebook', 'instagram']);
  assert.deepEqual(s.targeting.facebook_positions, ['feed', 'story', 'facebook_reels']);
  assert.deepEqual(s.targeting.instagram_positions, ['stream', 'story', 'reels']);
  assert.equal(s.targeting.targeting_automation.advantage_audience, 1);
  assert.equal(s.targeting.age_min, 25);
  assert.equal('age_max' in s.targeting, false);
  assert.equal('end_time' in s, false);
});

test('קריאייטיב: קרוסלה בסדר שנבחר, וואטסאפ, אינסטגרם, בלי שיפורים אוטומטיים', () => {
  const p = plan();
  const c = buildCreative(p, p.ads[0], { hashes: ['h1', 'h2', 'h3', 'h4', 'h5'], env });
  const ld = c.object_story_spec.link_data;
  assert.equal(c.object_story_spec.instagram_user_id, '222');
  assert.equal(ld.link, WHATSAPP_LINK);
  assert.equal(ld.message, 'טקסט לירון');
  assert.deepEqual(ld.child_attachments.map((x) => x.image_hash), ['h1', 'h2', 'h3', 'h4', 'h5']);
  assert.equal(ld.multi_share_optimized, false);
  assert.equal(ld.multi_share_end_card, false);
  for (const card of ld.child_attachments) assert.equal(card.call_to_action.type, 'WHATSAPP_MESSAGE');
  assert.equal(ld.call_to_action.value.app_destination, 'WHATSAPP');
  const fs = c.degrees_of_freedom_spec.creative_features_spec;
  for (const f of CREATIVE_FEATURES_OPT_OUT) assert.equal(fs[f].enroll_status, 'OPT_OUT');
});

test('ההודעה המוכנה בוואטסאפ - אותה הודעה בכל המודעות', () => {
  const p = plan();
  const all = buildAll(p, { env, safety, ids: fakeIds });
  const msgs = all.ads.map((a) => JSON.parse(a.creative.object_story_spec.link_data.page_welcome_message));
  for (const m of msgs) {
    assert.equal(m.type, 'VISUAL_EDITOR');
    assert.equal(m.text_format.customer_action_type, 'autofill_message');
    assert.equal(m.text_format.message.autofill_message.content, p.whatsapp.autofill_message);
  }
  assert.equal(msgs[0].text_format.message.text, 'היי, כאן אלעד!');
});

test('תמונה אחת - מודעת תמונה רגילה, לא קרוסלה', () => {
  const p = plan();
  const c = buildCreative(p, { ...p.ads[0], images: ['a.jpg'] }, { hashes: ['h1'], env });
  assert.equal(c.object_story_spec.link_data.image_hash, 'h1');
  assert.equal('child_attachments' in c.object_story_spec.link_data, false);
});

test('buildAll: כל תמונה מועלית פעם אחת, וכל מודעה מקבלת את הקריאייטיב שלה', () => {
  const p = plan(); p.ads[1].images = [...p.ads[0].images];
  const all = buildAll(p, { env, safety, ids: fakeIds });
  assert.equal(all.images.length, 5);
  assert.equal(all.ads[1].ad.creative.creative_id, 'CR:עליא');
  assert.equal(all.ads[1].ad.adset_id, 'S1');
});

test('בלי חשבון אינסטגרם ב-.env - עוצרים (אם יש מיקומים באינסטגרם)', () => {
  assert.equal(validateEnvForPlan(plan(), {}).length, 1);
  const p = plan(); p.placements = { facebook: ['feed'] };
  assert.equal(validateEnvForPlan(p, {}).length, 0);
});

test('הפורמט הישן ממשיך לעבוד', () => {
  const legacy = {
    name: 'ישן', daily_budget_ils: 50, link_url: 'https://example.com', cta: 'SIGN_UP',
    primary_texts: ['t'], headlines: ['h'], images: ['creatives/ad-1.png'],
  };
  assert.deepEqual(validatePlan(legacy, { safety, fileExists: exists, today }), []);
  const all = buildAll(legacy, { env, safety, ids: fakeIds });
  assert.equal(all.campaign.objective, 'OUTCOME_LEADS');
  assert.equal(all.adSet.optimization_goal, 'LINK_CLICKS');
  assert.equal(all.adSet.targeting.age_max, 65);
  assert.equal(all.ads.length, 1);
  assert.equal(all.ads[0].creative.object_story_spec.link_data.link, 'https://example.com');
  assertPaused(all.ads[0].ad, 'מודעה');
});

// --- תוכנית ב': כמה קבוצות מודעות, קהלים מותאמים, פירוט טירגוט ---

const IG = { id: '120240633155310745', name: 'IG Engagement 365 Days' };
const PHONES = { id: '120240633031420745', name: 'Designers Phone List - Jan 2026' };
const DETAILED = {
  education_majors: [{ id: '112517512096835', name: 'Interior design' }],
  work_positions: [{ id: '119802204737548', name: 'Interior Designer/Owner' }, { id: '545100628965172' }],
};
const multiPlan = () => {
  const p = plan();
  delete p.daily_budget_ils;
  delete p.audience;
  p.placements = { facebook: ['feed', 'facebook_reels'], instagram: ['stream', 'reels'] };
  p.ad_sets = [
    {
      name: 'מכירים את אלעד',
      daily_budget_ils: 25,
      audience: { countries: ['IL'], age_min: 25, advantage_audience: false, custom_audiences: [IG, PHONES], custom_audience_expansion: false },
    },
    {
      name: 'מעצבות לפי הפרופיל',
      daily_budget_ils: 15,
      audience: { countries: ['IL'], age_min: 25, advantage_audience: false, detailed: DETAILED, detailed_expansion: false, excluded_custom_audiences: [IG, PHONES] },
    },
  ];
  return p;
};
const v = (p) => validatePlan(p, { safety, fileExists: exists, today });

test('כמה קבוצות: תוכנית תקינה עוברת, והסכום מחושב', () => {
  assert.deepEqual(v(multiPlan()), []);
  assert.equal(totalDailyBudgetIls(multiPlan()), 40);
  assert.deepEqual(adSetsOf(multiPlan()).map((s) => s.name), ['בדיקה · מכירים את אלעד', 'בדיקה · מעצבות לפי הפרופיל']);
});

test('🛑 כמה קבוצות: התקרה נאכפת לכל קבוצה', () => {
  const p = multiPlan(); p.ad_sets[0].daily_budget_ils = 101;
  assert.ok(v(p).some((e) => e.includes('קבוצה 1') && e.includes('חורג מתקרת')));
});

test('🛑 כמה קבוצות: התקרה נאכפת גם על הסכום', () => {
  const p = multiPlan(); p.ad_sets[0].daily_budget_ils = 60; p.ad_sets[1].daily_budget_ils = 50;
  const errors = v(p);
  assert.ok(errors.some((e) => e.includes('סך התקציב') && e.includes('110')));
  assert.ok(!errors.some((e) => e.startsWith('קבוצה')), 'כל קבוצה לבד מתחת לתקרה');
});

test('כמה קבוצות: תקציב/קהל בראש התוכנית, שם כפול, בלי תקציב, בלי קהל - נעצרים', () => {
  const p = multiPlan();
  p.daily_budget_ils = 40;
  p.audience = { countries: ['IL'] };
  p.ad_sets[1].name = p.ad_sets[0].name;
  p.ad_sets.push({ name: 'שלישית' });
  const errors = v(p);
  assert.ok(errors.some((e) => e.includes('מורידים את daily_budget_ils')));
  assert.ok(errors.some((e) => e.includes('מורידים את audience')));
  assert.ok(errors.some((e) => e.includes('השם כבר קיים בקבוצה אחרת')));
  assert.ok(errors.some((e) => e.includes('קבוצה 3') && e.includes('daily_budget_ils')));
  assert.ok(errors.some((e) => e.includes('קבוצה 3') && e.includes('חסר audience')));
  const legacy = { name: 'ישן', link_url: 'https://example.com', primary_texts: ['t'], headlines: ['h'], images: ['a.png'], ad_sets: [] };
  assert.ok(v(legacy).length > 0);
});

test('🛑 מדינה שלא ב-safety.json - נעצרת (גם בתוכנית רגילה)', () => {
  const p = plan(); p.audience.countries = ['IL', 'US'];
  assert.ok(v(p).some((e) => e.includes('US') && e.includes('safety.json')));
  const m = multiPlan(); m.ad_sets[1].audience.countries = ['GB'];
  assert.ok(v(m).some((e) => e.includes('GB')));
});

test('קהלים מותאמים: מזהה חייב להיות מחרוזת, ואי אפשר לכלול ולהחריג אותו קהל', () => {
  const p = multiPlan();
  p.ad_sets[0].audience.custom_audiences = [{ id: 120240633155310745 }];
  p.ad_sets[1].audience.custom_audiences = [IG];
  const errors = v(p);
  assert.ok(errors.some((e) => e.includes('custom_audiences[0]') && e.includes('גרשיים')));
  assert.ok(errors.some((e) => e.includes('גם כלול וגם מוחרג')));
});

test('🛑 "בלי הרחבה" עם קהל אוטומטי דלוק - נעצר', () => {
  const p = multiPlan(); p.ad_sets[0].audience.advantage_audience = true;
  assert.ok(v(p).some((e) => e.includes('בלי הרחבה')));
  const q = multiPlan(); q.ad_sets[0].audience.advantage_audience = true; delete q.ad_sets[0].audience.custom_audience_expansion;
  assert.deepEqual(v(q), [], 'עם קהל אוטומטי, הקהלים הם הצעה - מותר כשלא מבקשים "בלי הרחבה"');
});

test('פירוט טירגוט: סוג לא נתמך, רשימה ריקה, הרחבה בלי מה להרחיב - נעצרים', () => {
  const p = multiPlan();
  p.ad_sets[1].audience.detailed = { interests: [{ id: '1' }], work_positions: [] };
  p.ad_sets[0].audience.detailed_expansion = false;
  const errors = v(p);
  assert.ok(errors.some((e) => e.includes('detailed.interests') && e.includes('לא נתמך')));
  assert.ok(errors.some((e) => e.includes('detailed.work_positions') && e.includes('לא ריקה')));
  assert.ok(errors.some((e) => e.includes('detailed_expansion') && e.includes('אין detailed')));
});

test('טירגוט: קהלים מותאמים, החרגות, flexible_spec ("או") והרחבות - לפי שמות השדות של Meta', () => {
  const [s1, s2] = adSetsOf(multiPlan());
  const t1 = buildTargeting(audienceSpecOf(s1.audience, safety));
  assert.deepEqual(t1.custom_audiences, [{ id: IG.id }, { id: PHONES.id }]);
  assert.deepEqual(t1.targeting_relaxation_types, { lookalike: 0, custom_audience: 0 });
  assert.equal(t1.targeting_automation.advantage_audience, 0);
  assert.equal('flexible_spec' in t1, false);
  assert.equal('targeting_optimization' in t1, false);

  const t2 = buildTargeting(audienceSpecOf(s2.audience, safety));
  assert.deepEqual(t2.excluded_custom_audiences, [{ id: IG.id }, { id: PHONES.id }]);
  assert.equal(t2.flexible_spec.length, 1, 'קבוצה אחת = מספיק אחד מהם');
  assert.deepEqual(t2.flexible_spec[0].education_majors, [{ id: '112517512096835', name: 'Interior design' }]);
  assert.deepEqual(t2.flexible_spec[0].work_positions, [{ id: '119802204737548', name: 'Interior Designer/Owner' }, { id: '545100628965172' }]);
  assert.equal(t2.targeting_optimization, 'none');
  assert.equal('custom_audiences' in t2, false);
  assert.equal('targeting_relaxation_types' in t2, false);
});

test('הרחבה: ברירת המחדל כמו הקהל האוטומטי; הרחבה מפורשת נשלחת כ-1', () => {
  const a = audienceSpecOf({ advantage_audience: false, custom_audiences: [IG], detailed: DETAILED }, safety);
  assert.equal(a.custom_audience_expansion, false);
  assert.equal(a.detailed_expansion, false);
  const t = buildTargeting(audienceSpecOf({ advantage_audience: false, custom_audiences: [IG], custom_audience_expansion: true, detailed: DETAILED, detailed_expansion: true }, safety));
  assert.deepEqual(t.targeting_relaxation_types, { lookalike: 1, custom_audience: 1 });
  assert.equal('targeting_optimization' in t, false, 'הרחבה דלוקה - לא שולחים את השדה ש-Meta הסירה');
  const adv = buildTargeting(audienceSpecOf({ advantage_audience: true, custom_audiences: [IG] }, safety));
  assert.equal('targeting_relaxation_types' in adv, false, 'עם קהל אוטומטי Meta מחליטה לבד');
});

test('תוכנית ישנה: הטירגוט בדיוק אותם שדות ובאותו סדר', () => {
  const s = buildAdSet(plan(), { campaignId: 'C1', env, safety });
  assert.deepEqual(Object.keys(s.targeting), [
    'geo_locations', 'age_min', 'targeting_automation',
    'publisher_platforms', 'facebook_positions', 'instagram_positions', 'device_platforms',
  ]);
  assert.equal(s.name, 'בדיקה · Ad Set');
  assert.deepEqual(planWarnings(plan(), safety), []);
  assert.equal(needsAudiencePreflight(plan(), safety), false);
  assert.deepEqual(describeAdvancedAudience(audienceSpecOf(plan().audience, safety)), []);
});

test('⚠️ בלי הרחבה של פירוט טירגוט באופטימיזציה לשיחות - אזהרה (Meta הסירה את השדה)', () => {
  const w = planWarnings(multiPlan(), safety);
  assert.equal(w.length, 1);
  assert.ok(w[0].includes('מעצבות לפי הפרופיל') && w[0].includes('1870197'));
  assert.equal(needsAudiencePreflight(multiPlan(), safety), true);
});

test('buildAll עם קבוצות: כל קבוצה מקבלת את כל המודעות, קריאייטיב אחד משותף, הכל PAUSED', () => {
  const ids = { ...fakeIds, adSetIdOf: (n) => `S:${n}` };
  const all = buildAll(multiPlan(), { env, safety, ids });
  assert.equal('adSet' in all, false);
  assert.equal(all.ad_sets.length, 2);
  assert.equal(all.ads.length, 2, 'קריאייטיב אחד לכל מודעה');
  assert.equal(all.images.length, 10);
  assertPaused(all.campaign, 'קמפיין');
  const [g1, g2] = all.ad_sets;
  assert.equal(g1.adSet.daily_budget, 2500);
  assert.equal(g2.adSet.daily_budget, 1500);
  assert.equal(g1.adSet.name, 'בדיקה · מכירים את אלעד');
  assert.equal(g1.adSet.optimization_goal, 'CONVERSATIONS');
  assert.deepEqual(g1.adSet.targeting.facebook_positions, ['feed', 'facebook_reels']);
  for (const g of all.ad_sets) {
    assertPaused(g.adSet, 'אד-סט');
    assertBudget(g.adSet, safety, 'אד-סט');
    assert.equal(g.ads.length, 2);
    for (const a of g.ads) {
      assertPaused(a.ad, 'מודעה');
      assert.equal(a.ad.adset_id, `S:${g.name}`);
      assert.equal(a.ad.creative.creative_id, `CR:${a.name}`);
      assert.equal(a.ad.name, `בדיקה · ${g.name} · ${a.name}`);
    }
  }
});

test('🛑 assertBudget: מעל התקרה או חסר - עוצר', () => {
  assert.throws(() => assertBudget({ daily_budget: 10001 }, safety, 'אד-סט'), /בלם חירום/);
  assert.throws(() => assertBudget({}, safety, 'אד-סט'), /בלם חירום/);
  assertBudget({ daily_budget: 10000 }, safety, 'אד-סט');
});

test('קהלים לבדיקה ב---check: כל מזהה פעם אחת, עם המקומות שהוא משמש בהם', () => {
  const refs = customAudienceRefsOf(multiPlan(), safety);
  assert.deepEqual(refs.map((r) => r.id), [IG.id, PHONES.id]);
  assert.deepEqual(refs[0].usedIn, [{ adSet: 'מכירים את אלעד', excluded: false }, { adSet: 'מעצבות לפי הפרופיל', excluded: true }]);
  assert.deepEqual(detailedItemsOf(DETAILED).map((x) => x.type), ['education_majors', 'work_positions', 'work_positions']);
});

test('שיפוט קהל מותאם: חשבון אחר / לא מוכן = חוסם; "לא מעודכן" ושם שונה = אזהרה', () => {
  const good = { name: 'IG Engagement 365 Days', account_id: '123', delivery_status: { code: 200 }, operation_status: { code: 200 } };
  assert.deepEqual(judgeCustomAudience(good, { accountId: '123', expectedName: IG.name }), { problems: [], warnings: [] });
  assert.equal(judgeCustomAudience({ ...good, account_id: '999' }, { accountId: '123' }).problems.length, 1);
  assert.equal(judgeCustomAudience({ ...good, delivery_status: { code: 300, description: 'too small' } }, { accountId: '123' }).problems.length, 1);
  const stale = judgeCustomAudience({ ...good, operation_status: { code: 450, description: 'out of date' } }, { accountId: '123', expectedName: 'אחר' });
  assert.equal(stale.problems.length, 0);
  assert.equal(stale.warnings.length, 2);
});

test('הערכת גודל בעברית', () => {
  assert.equal(sizeRangeText(2600, 3100), '2,600-3,100 איש');
  assert.ok(sizeRangeText(1000, 1000).includes('עד כ-1,000'));
  assert.equal(sizeRangeText(0, 0), '0 איש');
  assert.equal(sizeRangeText(-1, -1), 'אין הערכה');
});

test('תיאור לכרטיסים: טקסט אחד לכולם, רשימה לכל כרטיס, או כלום (כמו קודם)', () => {
  const p = plan();
  const hashes = ['h1', 'h2', 'h3', 'h4', 'h5'];
  const none = buildCreative(p, p.ads[0], { hashes, env }).object_story_spec.link_data;
  for (const c of none.child_attachments) assert.equal('description' in c, false);
  const one = buildCreative(p, { ...p.ads[0], description: 'שלחו לי הודעה' }, { hashes, env }).object_story_spec.link_data;
  for (const c of one.child_attachments) assert.equal(c.description, 'שלחו לי הודעה');
  const per = buildCreative(p, { ...p.ads[0], description: ['א', '', 'ג', 'ד', 'ה'] }, { hashes, env }).object_story_spec.link_data;
  assert.equal(per.child_attachments[0].description, 'א');
  assert.equal('description' in per.child_attachments[1], false);
  const single = buildCreative(p, { ...p.ads[0], images: ['a.jpg'], description: 'ת' }, { hashes: ['h1'], env }).object_story_spec.link_data;
  assert.equal(single.description, 'ת');
  const bad = plan(); bad.ads[0].description = ['רק אחד'];
  assert.ok(v(bad).some((e) => e.includes('אחד לכל תמונה')));
  const bad2 = plan(); bad2.ads[0].description = 5;
  assert.ok(v(bad2).some((e) => e.includes('description')));
});

// --- קידום פוסט קיים (existing_post) ---
import { buildExistingPostCreative, isExistingPostAd, judgeAccountBudget, totalCapOf } from './meta-build.js';

const promotePlan = () => ({
  name: 'קידום',
  destination: 'whatsapp',
  daily_budget_ils: 25,
  audience: { countries: ['IL'], age_min: 25, advantage_audience: false },
  ads: [
    { name: 'פייסבוק', existing_post: { platform: 'facebook', id: '111_999', url: 'https://www.facebook.com/x/posts/999' } },
    { name: 'אינסטגרם', existing_post: { platform: 'instagram', id: '17890000000000001', url: 'https://www.instagram.com/p/ABC/' } },
  ],
});

test('קידום פוסט: תוכנית תקינה עוברת, גם בלי הודעת וואטסאפ', () => {
  assert.deepEqual(validatePlan(promotePlan(), { safety, fileExists: exists, today }), []);
  assert.deepEqual(validateEnvForPlan(promotePlan(), env), []);
});

test('קידום פוסט: מזהה לא תקין, פלטפורמה לא מוכרת ושדות של מודעה חדשה - נחסמים', () => {
  const p = promotePlan();
  p.ads[0].existing_post.id = '999';
  p.ads[1].existing_post.platform = 'tiktok';
  p.ads.push({ name: 'מעורב', existing_post: { platform: 'facebook', id: '111_5' }, text: 'טקסט', images: ['a.jpg'] });
  const errors = validatePlan(p, { safety, fileExists: exists, today });
  assert.ok(errors.some((e) => e.includes('<מזהה הדף>_<מזהה הפוסט>')));
  assert.ok(errors.some((e) => e.includes('"facebook" או "instagram"')));
  assert.ok(errors.some((e) => e.includes('רץ כמו שהוא')));
});

test('קידום פוסט: פוסט של דף אחר נחסם', () => {
  const p = promotePlan();
  p.ads[0].existing_post.id = '555_999';
  assert.ok(validateEnvForPlan(p, env).some((e) => e.includes('לא שייך לדף')));
});

test('קידום פוסט: הקריאייטיב מצביע על הפוסט עצמו', () => {
  const p = promotePlan();
  assert.deepEqual(buildExistingPostCreative(p, p.ads[0], { env }), { name: 'קידום · פייסבוק · Creative', object_story_id: '111_999' });
  const ig = buildExistingPostCreative(p, p.ads[1], { env });
  assert.equal(ig.source_instagram_media_id, '17890000000000001');
  assert.equal(ig.instagram_user_id, '222');
  assert.equal(ig.object_id, '111');
  assert.equal(ig.call_to_action.type, 'WHATSAPP_MESSAGE');
});

test('קידום פוסט: אין תמונות להעלות, והכל PAUSED', () => {
  const built = buildAll(promotePlan(), { env, safety, ids: fakeIds });
  assert.deepEqual(built.images, []);
  assert.equal(built.ads.length, 2);
  assertPaused(built.campaign, 'c'); assertPaused(built.adSet, 's');
  built.ads.forEach((a) => assertPaused(a.ad, a.name));
  assert.ok(isExistingPostAd(promotePlan().ads[0]));
});

test('תוכנית שמערבבת מודעה חדשה וקידום פוסט: רק התמונות של המודעה החדשה עולות', () => {
  const p = plan();
  p.ads.push({ name: 'קידום', existing_post: { platform: 'facebook', id: '111_7' } });
  assert.deepEqual(validatePlan(p, { safety, fileExists: exists, today }), []);
  const built = buildAll(p, { env, safety, ids: fakeIds });
  assert.equal(built.images.length, 10);
  assert.equal(built.ads[2].creative.object_story_id, '111_7');
});

test('תקרה על הסך הכולל: מה שרץ + התוכנית', () => {
  const running = [
    { level: 'adset', name: 'v2', daily_budget: '5000' },
    { level: 'campaign', name: 'קידום ידני', lifetime_budget: '10000' },
    { level: 'adset', name: 'בלי תקציב (CBO)' },
  ];
  const j = judgeAccountBudget(running, 25, safety);
  assert.equal(j.runningIls, 50);
  assert.equal(j.totalIls, 75);
  assert.equal(j.over, false);
  assert.equal(j.warnings.length, 1);
  assert.equal(judgeAccountBudget(running, 60, safety).over, true);
  assert.equal(totalCapOf({ maxDailyBudgetIls: 100, maxTotalDailyBudgetIls: 70 }), 70);
  assert.equal(judgeAccountBudget(running, 25, { maxDailyBudgetIls: 100, maxTotalDailyBudgetIls: 70 }).over, true);
});

test('תקרה על הסך הכולל: קידום שתאריך הסיום שלו עבר לא נספר', () => {
  const running = [
    { level: 'adset', name: 'v2', daily_budget: '5000' },
    { level: 'campaign', name: 'קידום מיוני', lifetime_budget: '9600', stop_time: '2026-06-22T10:00:00+0300' },
    { level: 'adset', name: 'נגמר', daily_budget: '9000', stop_time: '2026-06-22T10:00:00+0300' },
  ];
  const j = judgeAccountBudget(running, 25, safety, new Date('2026-10-22T10:00:00Z'));
  assert.equal(j.runningIls, 50);
  assert.equal(j.warnings.length, 0);
});

// --- תמונה לכל מיקום (placement_images) - 29.10.2026 ---
import {
  buildPlacementCreative, placementRulesOf, placementGroupsOf, placementImagesOf, hasPlacementImages,
  adImagesOf, PLACEMENT_LABELS,
} from './meta-build.js';

const FEED = 'creatives/final/feed/ad2-single-clean.jpg';
const STORY = 'creatives/final/story/story-single.jpg';
const placementPlan = () => {
  const p = plan();
  p.ads = [
    { name: 'בודדת - טקסט', text: 'טקסט ראשי', placement_images: { feed: 'creatives/final/feed/ad1-single-text.jpg', story: STORY }, description: 'אלעד גרובנר - צלם' },
    { name: 'בודדת - נקייה', text: 'טקסט ראשי', placement_images: { feed: FEED, story: STORY } },
  ];
  return p;
};

test('תמונה לכל מיקום: תוכנית תקינה עוברת, ושתי מודעות עם אותה תמונת סטורי מעלות אותה פעם אחת', () => {
  assert.deepEqual(v(placementPlan()), []);
  const all = buildAll(placementPlan(), { env, safety, ids: fakeIds });
  assert.deepEqual(all.images, ['creatives/final/feed/ad1-single-text.jpg', STORY, FEED]);
  assert.deepEqual(all.ads[1].images, [FEED, STORY]);
  assert.deepEqual(adImagesOf(placementPlan().ads[1]), [FEED, STORY]);
  assert.ok(hasPlacementImages(placementPlan().ads[0]));
  assert.equal(hasPlacementImages(plan().ads[0]), false);
});

test('תמונה לכל מיקום: הכללים נגזרים מהמיקומים - סטורי וריל לתמונת story, השאר לתמונת feed, וברירת מחדל ל-feed', () => {
  const rules = placementRulesOf(placementPlan());
  assert.equal(rules.length, 3);
  assert.deepEqual(rules.map((r) => r.priority), [1, 2, 3]);
  assert.deepEqual(rules[0].customization_spec, {
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['story', 'facebook_reels'],
    instagram_positions: ['story', 'reels'],
  });
  assert.deepEqual(rules[1].customization_spec, {
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed'],
    instagram_positions: ['stream'],
  });
  assert.deepEqual(rules[2].customization_spec, {});
  for (const [r, key] of [[rules[0], 'story'], [rules[1], 'feed'], [rules[2], 'feed']]) {
    for (const l of ['image_label', 'body_label', 'title_label', 'link_url_label']) assert.deepEqual(r[l], { name: PLACEMENT_LABELS[key] });
  }
  // רק המיקומים שבתוכנית, ופרופיל הולך עם הפיד
  const p = placementPlan(); p.placements = { facebook: ['feed', 'profile_feed', 'story'], instagram: ['stream', 'reels'] };
  assert.deepEqual(placementGroupsOf(p), {
    feed: { facebook: ['feed', 'profile_feed'], instagram: ['stream'] },
    story: { facebook: ['story'], instagram: ['reels'] },
  });
  assert.deepEqual(placementRulesOf(p)[0].customization_spec, { publisher_platforms: ['facebook', 'instagram'], facebook_positions: ['story'], instagram_positions: ['reels'] });
  // סטורי רק באינסטגרם - בכלל של הסטורי אין פייסבוק בכלל
  const q = placementPlan(); q.placements = { facebook: ['feed'], instagram: ['stream', 'story'] };
  assert.deepEqual(placementRulesOf(q)[0].customization_spec, { publisher_platforms: ['instagram'], instagram_positions: ['story'] });
});

test('תמונה לכל מיקום: הקריאייטיב - שתי תמונות עם תוויות, וכל מה שיש במודעת וואטסאפ רגילה', () => {
  const p = placementPlan();
  const c = buildPlacementCreative(p, p.ads[0], { feedHash: 'hF', storyHash: 'hS', env });
  assert.equal(c.name, 'בדיקה · בודדת - טקסט · Creative');
  assert.deepEqual(c.object_story_spec, { page_id: '111', instagram_user_id: '222' }, 'בלי link_data - הכל ב-asset_feed_spec');
  const a = c.asset_feed_spec;
  assert.deepEqual(a.images, [
    { hash: 'hF', adlabels: [{ name: PLACEMENT_LABELS.feed }] },
    { hash: 'hS', adlabels: [{ name: PLACEMENT_LABELS.story }] },
  ]);
  const both = [{ name: PLACEMENT_LABELS.feed }, { name: PLACEMENT_LABELS.story }];
  assert.deepEqual(a.bodies, [{ text: 'טקסט ראשי', adlabels: both }]);
  assert.deepEqual(a.titles, [{ text: p.headline, adlabels: both }]);
  assert.deepEqual(a.descriptions, [{ text: 'אלעד גרובנר - צלם' }]);
  // הכפתור לוואטסאפ והקישור - כמו במודעה רגילה
  assert.deepEqual(a.link_urls, [{ website_url: WHATSAPP_LINK, adlabels: both }]);
  assert.deepEqual(a.call_to_action_types, ['WHATSAPP_MESSAGE']);
  assert.deepEqual(a.call_to_actions, [{ type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } }]);
  assert.deepEqual(a.ad_formats, ['SINGLE_IMAGE']);
  assert.equal(a.optimization_type, 'PLACEMENT');
  assert.deepEqual(a.asset_customization_rules, placementRulesOf(p));
  // ההודעה המוכנה והברכה - בדיוק אותו JSON כמו ב-link_data של מודעה רגילה
  assert.equal(a.additional_data.page_welcome_message, JSON.stringify(buildWelcomeMessage(p)));
  const wm = JSON.parse(a.additional_data.page_welcome_message);
  assert.equal(wm.text_format.message.autofill_message.content, p.whatsapp.autofill_message);
  assert.equal(wm.text_format.message.text, p.whatsapp.greeting);
  // בלי שיפורים אוטומטיים - כמו במודעה רגילה
  for (const f of CREATIVE_FEATURES_OPT_OUT) assert.equal(c.degrees_of_freedom_spec.creative_features_spec[f].enroll_status, 'OPT_OUT');
  // בלי תיאור - לא נשלח descriptions
  assert.equal('descriptions' in buildPlacementCreative(p, p.ads[1], { feedHash: 'a', storyHash: 'b', env }).asset_feed_spec, false);
});

test('תמונה לכל מיקום: buildAll - כל מודעה מקבלת את ה-hash הנכון לכל מיקום, והכל PAUSED', () => {
  const all = buildAll(placementPlan(), { env, safety, ids: fakeIds });
  const imgsOf = all.ads[1].creative.asset_feed_spec.images;
  assert.equal(imgsOf.find((x) => x.adlabels[0].name === PLACEMENT_LABELS.feed).hash, `hash:${FEED}`);
  assert.equal(imgsOf.find((x) => x.adlabels[0].name === PLACEMENT_LABELS.story).hash, `hash:${STORY}`);
  assertPaused(all.campaign, 'קמפיין');
  assertPaused(all.adSet, 'אד-סט');
  for (const a of all.ads) assertPaused(a.ad, 'מודעה');
  assert.equal(all.ads[0].ad.creative.creative_id, 'CR:בודדת - טקסט');
});

test('תמונה לכל מיקום: תוכנית שמערבבת מודעה רגילה ומודעה עם תמונה לכל מיקום', () => {
  const p = plan();
  p.ads.push({ name: 'מיקומים', text: 'ט', placement_images: { feed: FEED, story: STORY } });
  assert.deepEqual(v(p), []);
  const all = buildAll(p, { env, safety, ids: fakeIds });
  assert.equal(all.images.length, 12);
  assert.ok(all.ads[0].creative.object_story_spec.link_data, 'המודעה הרגילה לא השתנתה');
  assert.equal('asset_feed_spec' in all.ads[0].creative, false);
  assert.ok(all.ads[2].creative.asset_feed_spec);
});

test('🛑 תמונה לכל מיקום: מיקום בלי תמונה מתאימה - נעצר כבר בבדיקת התוכנית', () => {
  // יש סטורי וריל במיקומים, ואין תמונת story
  const a = placementPlan(); delete a.ads[0].placement_images.story;
  assert.ok(v(a).some((e) => e.includes('חסר placement_images.story') && e.includes('סטורי פייסבוק') && e.includes('ריל אינסטגרם')));
  // יש פיד במיקומים, ואין תמונת feed
  const b = placementPlan(); delete b.ads[1].placement_images.feed;
  assert.ok(v(b).some((e) => e.includes('חסר placement_images.feed') && e.includes('פיד פייסבוק') && e.includes('פיד אינסטגרם')));
  // תמונת story בלי שום סטורי או ריל במיקומים - לא תופיע
  const c = placementPlan(); c.placements = { facebook: ['feed'], instagram: ['stream'] };
  assert.ok(v(c).some((e) => e.includes('placement_images.story') && e.includes('לא תופיע')));
  // תמונת feed בלי שום פיד במיקומים - לא תופיע
  const d = placementPlan(); d.placements = { facebook: ['story'], instagram: ['reels'] };
  assert.ok(v(d).some((e) => e.includes('placement_images.feed') && e.includes('לא תופיע')));
  // תמונה אחת בלבד, כשלשנייה אין מיקום - שתי תמונות, או images
  const e1 = placementPlan(); e1.placements = { facebook: ['feed'] }; delete e1.ads[0].placement_images.story;
  assert.ok(v(e1).some((e) => e.includes('צריך שתי תמונות')));
});

test('תמונה לכל מיקום: שדות לא תקינים - נעצרים', () => {
  const p = placementPlan();
  p.ads[0].images = ['a.jpg'];
  p.ads[1].placement_images = { feed: FEED, story: STORY, reels: 'x.jpg' };
  const errors = validatePlan(p, { safety, fileExists: (f) => f !== STORY, today });
  assert.ok(errors.some((e) => e.includes('גם images וגם placement_images')));
  assert.ok(errors.some((e) => e.includes('placement_images.reels') && e.includes('לא מוכר')));
  assert.ok(errors.some((e) => e.includes(`תמונה לא נמצאה: ${STORY}`)));
  const q = placementPlan();
  q.ads[0].placement_images = { feed: FEED, story: FEED };
  q.ads[1].placement_images = ['a.jpg', 'b.jpg'];
  const eq = v(q);
  assert.ok(eq.some((e) => e.includes('אותה תמונה לפיד ולסטורי')));
  assert.ok(eq.some((e) => e.includes('צריך להיות אובייקט')));
  const r = placementPlan(); r.ads[0].description = ['א', 'ב'];
  assert.ok(v(r).some((e) => e.includes('טקסט אחד, לא רשימה')));
  const s = placementPlan(); s.ads[0].placement_images.feed = '';
  assert.ok(v(s).some((e) => e.includes('placement_images.feed') && e.includes('נתיב')));
  // בקידום פוסט קיים אין תמונות משלנו
  const t = promotePlan(); t.ads[0].placement_images = { feed: FEED, story: STORY };
  assert.ok(v(t).some((e) => e.includes('רץ כמו שהוא') && e.includes('placement_images')));
});

test('תמונה לכל מיקום: התצוגה ב-dry-run - איזו תמונה לאיזה מיקום, בעברית', () => {
  const p = placementPlan();
  assert.deepEqual(placementImagesOf(p, p.ads[1]), [
    { key: 'feed', title: 'פיד', file: FEED, where: 'פיד פייסבוק, פיד אינסטגרם' },
    { key: 'story', title: 'סטורי וריל', file: STORY, where: 'סטורי פייסבוק, ריל פייסבוק, סטורי אינסטגרם, ריל אינסטגרם' },
  ]);
});

test('תוכנית בלי placement_images לא השתנתה: אותו קריאייטיב, אותן תמונות, אותן שגיאות', () => {
  const p = plan();
  const all = buildAll(p, { env, safety, ids: fakeIds });
  for (const [i, a] of all.ads.entries()) {
    assert.deepEqual(a.creative, buildCreative(p, p.ads[i], { hashes: p.ads[i].images.map(fakeIds.hashOf), env }));
    assert.equal('asset_feed_spec' in a.creative, false);
    assert.deepEqual(a.images, p.ads[i].images);
  }
  assert.deepEqual(all.images, [...imgs('liron'), ...imgs('alia')]);
  assert.deepEqual(Object.keys(all.ads[0].creative.object_story_spec.link_data), [
    'link', 'message', 'call_to_action', 'page_welcome_message', 'child_attachments', 'multi_share_optimized', 'multi_share_end_card',
  ]);
  const bad = plan(); delete bad.ads[0].images;
  assert.deepEqual(v(bad), ['מודעה 1 (לירון): חסרות images']);
});

// --- קידום חשיפה / מעורבות של פוסט קיים (goal) - 1.11.2026 ---
import {
  PROMOTE_GOALS, goalOf, promoteGoalOf, isPromoteGoalPlan, frequencyCapOf, DEFAULT_FREQUENCY_CAP, buildCampaign,
} from './meta-build.js';

const IG_POST = { platform: 'instagram', id: '17890000000000001', url: 'https://www.instagram.com/p/ABC/' };
const goalPlan = (goal) => ({
  name: `קידום ${goal}`,
  goal,
  daily_budget_ils: 12,
  audience: { countries: ['IL'], age_min: 25, advantage_audience: false, custom_audiences: [IG, PHONES], custom_audience_expansion: false },
  placements: { instagram: ['stream'] },
  ads: [{ name: 'פוסט', existing_post: { ...IG_POST } }],
});

test('קידום חשיפה ומעורבות: תוכנית תקינה עוברת, בלי וואטסאפ ובלי destination', () => {
  for (const g of ['reach', 'engagement']) {
    assert.deepEqual(v(goalPlan(g)), [], g);
    assert.deepEqual(validateEnvForPlan(goalPlan(g), env), [], g);
    assert.deepEqual(planWarnings(goalPlan(g), safety), [], g);
    assert.equal(goalOf(goalPlan(g)), g);
    assert.ok(isPromoteGoalPlan(goalPlan(g)));
  }
  // destination: "none" מותר, כמו בלי destination
  const p = goalPlan('reach'); p.destination = 'none';
  assert.deepEqual(v(p), []);
  assert.equal(goalOf(plan()), 'whatsapp');
  assert.equal(isPromoteGoalPlan(plan()), false);
});

test('קידום חשיפה: OUTCOME_AWARENESS, REACH, חיוב לפי חשיפות, הגבלת תדירות 2 ב-7 ימים, הכל PAUSED', () => {
  const all = buildAll(goalPlan('reach'), { env, safety, ids: fakeIds });
  assert.equal(all.campaign.objective, 'OUTCOME_AWARENESS');
  assert.equal(all.campaign.is_adset_budget_sharing_enabled, false);
  const s = all.adSet;
  assert.equal(s.optimization_goal, 'REACH');
  assert.equal(s.billing_event, 'IMPRESSIONS');
  assert.equal(s.bid_strategy, 'LOWEST_COST_WITHOUT_CAP');
  assert.equal(s.daily_budget, 1200);
  assert.equal('destination_type' in s, false, 'בחשיפה אין יעד');
  assert.deepEqual(s.promoted_object, { page_id: '111' });
  assert.deepEqual(s.frequency_control_specs, [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 2 }]);
  assert.deepEqual(DEFAULT_FREQUENCY_CAP, { impressions: 2, days: 7 });
  assert.deepEqual(s.targeting.publisher_platforms, ['instagram']);
  assert.deepEqual(s.targeting.instagram_positions, ['stream']);
  assert.equal('facebook_positions' in s.targeting, false);
  assert.deepEqual(s.targeting.custom_audiences, [{ id: IG.id }, { id: PHONES.id }]);
  assert.deepEqual(s.targeting.targeting_relaxation_types, { lookalike: 0, custom_audience: 0 });
  assert.equal('end_time' in s, false);
  assertPaused(all.campaign, 'קמפיין'); assertPaused(s, 'אד-סט'); assertBudget(s, safety, 'אד-סט');
  for (const a of all.ads) assertPaused(a.ad, 'מודעה');
  assert.deepEqual(all.images, [], 'אין תמונות להעלות');
});

test('קידום מעורבות: OUTCOME_ENGAGEMENT, POST_ENGAGEMENT על הפוסט (ON_POST), בלי הגבלת תדירות ובלי וואטסאפ', () => {
  const all = buildAll(goalPlan('engagement'), { env: { ...env, META_WHATSAPP_NUMBER: '972500000000' }, safety, ids: fakeIds });
  assert.equal(all.campaign.objective, 'OUTCOME_ENGAGEMENT');
  const s = all.adSet;
  assert.equal(s.optimization_goal, 'POST_ENGAGEMENT');
  assert.equal(s.destination_type, 'ON_POST');
  assert.equal(s.billing_event, 'IMPRESSIONS');
  assert.deepEqual(s.promoted_object, { page_id: '111' }, 'בלי מספר הוואטסאפ');
  assert.equal('frequency_control_specs' in s, false);
  assert.equal(frequencyCapOf(goalPlan('engagement')), null);
  assertPaused(all.campaign, 'קמפיין'); assertPaused(s, 'אד-סט');
  for (const a of all.ads) assertPaused(a.ad, 'מודעה');
});

test('קידום חשיפה / מעורבות: הקריאייטיב של פוסט אינסטגרם - בלי כפתור; פוסט פייסבוק - הפוסט עצמו', () => {
  for (const g of ['reach', 'engagement']) {
    const p = goalPlan(g);
    assert.deepEqual(buildExistingPostCreative(p, p.ads[0], { env }), {
      name: `קידום ${g} · פוסט · Creative`, object_id: '111', instagram_user_id: '222', source_instagram_media_id: IG_POST.id,
    });
    const f = goalPlan(g); f.placements = { facebook: ['feed'] };
    f.ads[0].existing_post = { platform: 'facebook', id: '111_999' };
    assert.deepEqual(buildExistingPostCreative(f, f.ads[0], { env }), { name: `קידום ${g} · פוסט · Creative`, object_story_id: '111_999' });
  }
  // קידום וואטסאפ של פוסט אינסטגרם לא השתנה: עם כפתור וואטסאפ
  const w = promotePlan();
  assert.deepEqual(Object.keys(buildExistingPostCreative(w, w.ads[1], { env })),
    ['name', 'object_id', 'instagram_user_id', 'source_instagram_media_id', 'call_to_action']);
});

test('קידום חשיפה / מעורבות של קרוסלה: existing_post.cta מוסיף כפתור עם קישור (Meta דורשת בהדלקה, 8.11.2026)', () => {
  for (const g of ['reach', 'engagement']) {
    const p = goalPlan(g);
    p.ads[0].existing_post.cta = { type: 'LEARN_MORE', link: 'https://example.com/' };
    assert.deepEqual(v(p), []);
    assert.deepEqual(buildExistingPostCreative(p, p.ads[0], { env }), {
      name: `קידום ${g} · פוסט · Creative`, object_id: '111', instagram_user_id: '222', source_instagram_media_id: IG_POST.id,
      call_to_action: { type: 'LEARN_MORE', value: { link: 'https://example.com/' } },
    });
  }
});

test('existing_post.cta: חייב type באותיות גדולות ו-link מלא', () => {
  for (const bad of [{ type: 'learn more', link: 'https://x.co' }, { type: 'LEARN_MORE' }, { type: 'LEARN_MORE', link: 'x.co' }, 'LEARN_MORE']) {
    const p = goalPlan('reach'); p.ads[0].existing_post.cta = bad;
    assert.ok(v(p).some((e) => e.includes('existing_post.cta')), JSON.stringify(bad));
  }
});

test('הגבלת תדירות: אפשר לשנות בתוכנית, גם רק חלק ממנה', () => {
  const p = goalPlan('reach'); p.frequency_cap = { impressions: 3, days: 7 };
  assert.deepEqual(v(p), []);
  assert.deepEqual(buildAdSet(p, { campaignId: 'C1', env, safety }).frequency_control_specs,
    [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }]);
  const q = goalPlan('reach'); q.frequency_cap = { days: 14 };
  assert.deepEqual(frequencyCapOf(q), { impressions: 2, days: 14 });
});

test('🛑 הגבלת תדירות לא תקינה, או לא בחשיפה - נעצרת בעברית', () => {
  for (const [fc, what] of [[{ impressions: 0 }, 'impressions'], [{ days: 91 }, 'days'], [{ impressions: 1.5 }, 'impressions'], [{ impressions: '2' }, 'impressions']]) {
    const p = goalPlan('reach'); p.frequency_cap = fc;
    assert.ok(v(p).some((e) => e.includes(`frequency_cap.${what}`) && e.includes('בין 1 ל-90')), JSON.stringify(fc));
  }
  const k = goalPlan('reach'); k.frequency_cap = { impressions: 2, weeks: 1 };
  assert.ok(v(k).some((e) => e.includes('frequency_cap.weeks') && e.includes('לא מוכר')));
  const arr = goalPlan('reach'); arr.frequency_cap = [2, 7];
  assert.ok(v(arr).some((e) => e.includes('frequency_cap צריך להיות אובייקט')));
  const eng = goalPlan('engagement'); eng.frequency_cap = { impressions: 2, days: 7 };
  assert.ok(v(eng).some((e) => e.includes('frequency_cap') && e.includes('רק בקידום חשיפה')));
  const wa = plan(); wa.frequency_cap = { impressions: 2, days: 7 };
  assert.ok(v(wa).some((e) => e.includes('frequency_cap') && e.includes('רק בקידום חשיפה')));
});

test('🛑 חשיפה / מעורבות עם תמונות חדשות - נעצרת: רק פוסט שכבר עלה', () => {
  for (const g of ['reach', 'engagement']) {
    const p = goalPlan(g);
    p.ads.push({ name: 'חדשה', text: 'טקסט', images: ['creatives/a.jpg'] });
    p.ads.push({ name: 'מיקומים', text: 'טקסט', placement_images: { feed: FEED, story: STORY } });
    const errors = v(p);
    assert.ok(errors.some((e) => e.includes('מודעה 2 (חדשה)') && e.includes(PROMOTE_GOALS[g].he) && e.includes('existing_post')), g);
    assert.ok(errors.some((e) => e.includes('מודעה 3 (מיקומים)') && e.includes('existing_post')), g);
    assert.equal(errors.length, 2, 'רק השגיאה של "רק פוסט קיים" לכל מודעה, בלי שגיאות טקסט/כותרת');
    // גם תמונות בתוך מודעת הקידום עצמה - נעצרות כמו קודם
    const q = goalPlan(g); q.ads[0].images = ['creatives/a.jpg'];
    assert.ok(v(q).some((e) => e.includes('רץ כמו שהוא') && e.includes('images')), g);
  }
});

test('🛑 חשיפה / מעורבות עם וואטסאפ - נעצרת בעברית', () => {
  for (const g of ['reach', 'engagement']) {
    const p = goalPlan(g); p.destination = 'whatsapp';
    assert.ok(v(p).some((e) => e.includes('אין וואטסאפ') && e.includes('destination')), g);
    const q = goalPlan(g); q.whatsapp = { autofill_message: 'היי', greeting: 'שלום' };
    assert.ok(v(q).some((e) => e.includes('אין וואטסאפ') && e.includes('whatsapp')), g);
    const h = goalPlan(g); h.headline = 'כותרת';
    assert.ok(v(h).some((e) => e.includes('headline')), g);
    const o = goalPlan(g); o.objective = 'OUTCOME_LEADS';
    assert.ok(v(o).some((e) => e.includes(PROMOTE_GOALS[g].objective)), g);
    const d = goalPlan(g); d.destination = 'website';
    assert.ok(v(d).some((e) => e.includes('destination "website"')), g);
  }
});

test('🛑 goal לא מוכר, או goal בפורמט הישן - נעצר', () => {
  for (const goal of ['awareness', 'toString', 'constructor', 5]) {
    const p = goalPlan('reach'); p.goal = goal;
    assert.ok(v(p).some((e) => e.includes('לא מוכר') && e.includes('"reach"')), String(goal));
    assert.equal(promoteGoalOf(p), null, String(goal));
    assert.equal(buildCampaign(p).objective, 'OUTCOME_ENGAGEMENT', 'goal לא מוכר לא הופך למטרה אחרת בשקט');
  }
  const legacy = { name: 'ישן', link_url: 'https://example.com', primary_texts: ['t'], headlines: ['h'], images: ['a.png'], daily_budget_ils: 10, goal: 'reach' };
  assert.ok(v(legacy).some((e) => e.includes('goal') && e.includes('בפורמט הישן')));
});

test('🛑 חשיפה / מעורבות: התקרה נאכפת כמו תמיד - לכל קבוצה ולסכום', () => {
  const p = goalPlan('reach'); p.daily_budget_ils = 101;
  assert.ok(v(p).some((e) => e.includes('חורג מתקרת')));
  const m = goalPlan('engagement');
  delete m.daily_budget_ils; delete m.audience;
  m.ad_sets = [
    { name: 'דומה 1%', daily_budget_ils: 60, audience: { countries: ['IL'], age_min: 25, advantage_audience: false, custom_audiences: [{ id: '120254805380880745', name: 'Lookalike 1%' }] } },
    { name: 'אוטומטי', daily_budget_ils: 50, audience: { countries: ['IL'], age_min: 25, advantage_audience: true } },
  ];
  assert.ok(v(m).some((e) => e.includes('סך התקציב') && e.includes('110')));
  m.ad_sets[0].daily_budget_ils = 10; m.ad_sets[1].daily_budget_ils = 5;
  assert.deepEqual(v(m), []);
  const built = buildAll(m, { env, safety, ids: { ...fakeIds, adSetIdOf: (n) => `S:${n}` } });
  for (const g of built.ad_sets) {
    assert.equal(g.adSet.optimization_goal, 'POST_ENGAGEMENT');
    assertPaused(g.adSet, 'אד-סט'); assertBudget(g.adSet, safety, 'אד-סט');
    for (const a of g.ads) assertPaused(a.ad, 'מודעה');
  }
  const r = goalPlan('reach'); delete r.daily_budget_ils; delete r.audience;
  r.ad_sets = [{ name: 'חם', daily_budget_ils: 12, audience: goalPlan('reach').audience }];
  assert.deepEqual(buildAll(r, { env, safety, ids: { ...fakeIds, adSetIdOf: () => 'S' } }).ad_sets[0].adSet.frequency_control_specs,
    [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 2 }]);
});

test('⚠️ חשיפה / מעורבות: פוסט מרשת אחת שרץ גם ברשת השנייה - אזהרה (ההחלטה של עדי, 25.10)', () => {
  const p = goalPlan('reach'); p.placements = { instagram: ['stream'], facebook: ['feed'] };
  const w = planWarnings(p, safety);
  assert.equal(w.length, 1);
  assert.ok(w[0].includes('הפוסט מאינסטגרם') && w[0].includes('פייסבוק') && w[0].includes('"instagram": ["stream"]'));
  const d = goalPlan('engagement'); delete d.placements;
  assert.ok(planWarnings(d, safety)[0].includes('ברירת המחדל'));
  // קידום וואטסאפ - בלי האזהרה החדשה (כמו קודם)
  assert.deepEqual(planWarnings(promotePlan(), safety), []);
});

test('תוכנית וואטסאפ לא השתנתה: אותם שדות באד-סט, באותו סדר', () => {
  const s = buildAdSet(plan(), { campaignId: 'C1', env: { ...env, META_WHATSAPP_NUMBER: '972500000000' }, safety });
  assert.deepEqual(Object.keys(s), [
    'name', 'campaign_id', 'daily_budget', 'billing_event', 'optimization_goal', 'bid_strategy',
    'destination_type', 'promoted_object', 'targeting', 'status',
  ]);
  assert.deepEqual(s.promoted_object, { page_id: '111', whatsapp_phone_number: '972500000000' });
  assert.equal(buildCampaign(plan()).objective, 'OUTCOME_ENGAGEMENT');
  assert.equal(buildCampaign(promotePlan()).objective, 'OUTCOME_ENGAGEMENT');
  assert.ok(v({ ...plan(), destination: undefined }).some((e) => e.includes('destination חייב להיות "whatsapp"')));
});

// --- הוספת מודעות לקבוצה קיימת (add_to_adset) - 12.11.2026 ---
import { isAddToAdSetPlan, judgeExistingAdSet } from './meta-build.js';

const PL = { facebook: ['feed', 'story', 'facebook_reels'], instagram: ['stream', 'story', 'reels'] };
const addPlan = () => {
  const p = placementPlan();
  delete p.daily_budget_ils;
  delete p.audience;
  p.placements = PL;
  p.add_to_adset = { campaign_id: '120254957888520745', adset_id: '120254957889790745' };
  return p;
};
const adSetMeta = (over = {}) => ({
  name: 'הקבוצה', account_id: 'act_999', campaign_id: '120254957888520745', effective_status: 'ACTIVE',
  optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP', daily_budget: '5000',
  targeting: { publisher_platforms: ['instagram', 'facebook'], facebook_positions: ['story', 'feed', 'facebook_reels'], instagram_positions: ['stream', 'story', 'reels'] },
  ...over,
});

test('הוספה לקבוצה קיימת: תוכנית תקינה עוברת, בלי תקציב ובלי קהל', () => {
  assert.ok(isAddToAdSetPlan(addPlan()));
  assert.deepEqual(v(addPlan()), []);
  assert.equal(totalDailyBudgetIls(addPlan()), 0);
  assert.deepEqual(adSetsOf(addPlan()), []);
  assert.equal(needsAudiencePreflight(addPlan(), safety), false);
});

test('הוספה לקבוצה קיימת: אין קמפיין ואין קבוצה בבקשות, והמודעות PAUSED ומכוונות לקבוצה שבתוכנית', () => {
  const all = buildAll(addPlan(), { env, safety, ids: fakeIds });
  assert.equal(all.campaign, undefined);
  assert.equal(all.adSet, undefined);
  assert.equal(all.ad_sets, undefined);
  assert.equal(all.ads.length, 2);
  for (const a of all.ads) {
    assert.equal(a.ad.adset_id, '120254957889790745');
    assert.equal(a.ad.status, 'PAUSED');
    assert.ok(a.creative);
  }
});

test('הוספה לקבוצה קיימת: אסור תקציב, קהל, קבוצות, תאריך סיום או הגבלת תדירות', () => {
  for (const [k, val] of [['daily_budget_ils', 50], ['audience', { countries: ['IL'], age_min: 25 }], ['ad_sets', []], ['end_date', '2030-01-01'], ['frequency_cap', { impressions: 2, days: 7 }]]) {
    const p = addPlan(); p[k] = val;
    assert.ok(v(p).some((e) => e.includes(k)), `צריכה להיות שגיאה על ${k}`);
  }
});

test('הוספה לקבוצה קיימת: מזהים חייבים להיות מחרוזת ספרות, ורק וואטסאפ', () => {
  const a = addPlan(); a.add_to_adset.adset_id = 120254957889790745;
  assert.ok(v(a).some((e) => e.includes('adset_id')));
  const b = addPlan(); delete b.add_to_adset.campaign_id;
  assert.ok(v(b).some((e) => e.includes('campaign_id')));
  const c = addPlan(); c.add_to_adset = 'x';
  assert.ok(v(c).length > 0);
  const d = addPlan(); d.goal = 'reach';
  assert.ok(v(d).some((e) => e.includes('add_to_adset')));
});

test('הקבוצה הקיימת מול Meta: תקינה עוברת', () => {
  const j = judgeExistingAdSet(adSetMeta(), addPlan(), { accountId: '999' });
  assert.deepEqual(j.problems, []);
  assert.ok(j.lines[0].includes('50₪'));
});

test('הקבוצה הקיימת מול Meta: חשבון אחר, קמפיין אחר, לא וואטסאפ, נמחקה, או מיקומים שונים - נחסם', () => {
  const plan = addPlan();
  assert.equal(judgeExistingAdSet(adSetMeta({ account_id: 'act_1' }), plan, { accountId: '999' }).problems.length, 1);
  assert.equal(judgeExistingAdSet(adSetMeta({ campaign_id: '1' }), plan, { accountId: '999' }).problems.length, 1);
  assert.equal(judgeExistingAdSet(adSetMeta({ destination_type: 'WEBSITE' }), plan, { accountId: '999' }).problems.length, 1);
  assert.equal(judgeExistingAdSet(adSetMeta({ effective_status: 'DELETED' }), plan, { accountId: '999' }).problems.length, 1);
  const t = adSetMeta(); t.targeting.instagram_positions = ['stream'];
  assert.equal(judgeExistingAdSet(t, plan, { accountId: '999' }).problems.length, 1);
  const noTg = adSetMeta({ targeting: {} });
  assert.equal(judgeExistingAdSet(noTg, plan, { accountId: '999' }).problems.length, 1);
});
