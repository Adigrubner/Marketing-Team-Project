// בדיקות לבניית הבקשות - בלי רשת. מריצים: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePlan, validateEnvForPlan, buildAll, buildAdSet, buildCreative, buildWelcomeMessage,
  assertPaused, endTimeOf, WHATSAPP_LINK, CREATIVE_FEATURES_OPT_OUT,
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
