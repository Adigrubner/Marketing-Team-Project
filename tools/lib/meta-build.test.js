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
  assert.deepEqual(t1.targeting_relaxation_types, { custom_audience: 0 });
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
  assert.deepEqual(t.targeting_relaxation_types, { custom_audience: 1 });
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
