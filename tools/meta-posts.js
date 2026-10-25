// הפוסטים האחרונים של הלקוח, עם המזהה שצריך כדי לקדם אותם (existing_post ב-plan.json).
// קריאה בלבד, בטוח תמיד: אין כאן graphPost. הכלי לא יוצר, לא מקדם ולא משנה כלום.
// שימוש:
//   node tools/meta-posts.js                  ← 10 הפוסטים האחרונים בדף העסקי בפייסבוק ובאינסטגרם
//   node tools/meta-posts.js --limit 25
//   node tools/meta-posts.js --find <קישור>   ← רק הפוסט עם הקישור הזה (גם קישור לאינסטגרם)
//   --json                                    ← פלט JSON (בשביל הסוכנים)
import { loadEnv, ok, bad, warn, info, title } from './lib/env.js';
import { requireMetaEnv, graphGet, graphGetAsPage } from './lib/meta.js';

loadEnv();
try { requireMetaEnv(); } catch (e) { bad(e.message); process.exit(1); }

const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const asJson = args.includes('--json');
const find = value('--find');
const limit = Math.min(100, Math.max(1, Number(value('--limit')) || (find ? 50 : 10)));

// קישורים יכולים להגיע בצורות שונות (עם / בלי סלאש, עם פרמטרים) - משווים רק את החלק הקבוע.
const norm = (u) => String(u || '').split('?')[0].replace(/\/+$/, '').replace('://www.', '://').toLowerCase();
const firstLine = (t) => String(t || '').split('\n').find((l) => l.trim())?.slice(0, 70) || '';

const out = { facebook: [], instagram: [], errors: {} };

try {
  const r = await graphGetAsPage(`${process.env.META_PAGE_ID}/published_posts`, {
    fields: 'id,permalink_url,created_time,message,is_eligible_for_promotion', limit,
  });
  out.facebook = (r.data || []).map((p) => ({
    platform: 'facebook', id: p.id, url: p.permalink_url, date: p.created_time, text: firstLine(p.message),
    can_promote: p.is_eligible_for_promotion !== false,
  }));
} catch (e) { out.errors.facebook = e.message; }

if (process.env.META_INSTAGRAM_USER_ID) {
  try {
    const r = await graphGet(`${process.env.META_INSTAGRAM_USER_ID}/media`, {
      fields: 'id,permalink,timestamp,caption,media_type', limit,
    });
    out.instagram = (r.data || []).map((p) => ({
      platform: 'instagram', id: p.id, url: p.permalink, date: p.timestamp, text: firstLine(p.caption), type: p.media_type,
    }));
  } catch (e) {
    out.errors.instagram = e.code === 10
      ? 'לחיבור חסרה ההרשאה instagram_basic - בלעדיה אי אפשר לקרוא את הפוסטים באינסטגרם. מוסיפים אותה בטוקן ושומרים אותו מחדש ב-.env.'
      : e.message;
  }
}

if (find) {
  const want = norm(find);
  for (const k of ['facebook', 'instagram']) out[k] = out[k].filter((p) => norm(p.url) === want);
}

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const [k, he] of [['facebook', 'פייסבוק - הדף העסקי'], ['instagram', 'אינסטגרם']]) {
    title(he);
    if (out.errors[k]) { bad(out.errors[k]); continue; }
    if (!out[k].length) { warn(find ? 'לא נמצא פוסט עם הקישור הזה' : 'אין פוסטים'); continue; }
    for (const p of out[k]) {
      info(`${p.date?.slice(0, 10)} · ${p.url}`);
      info(`   ${p.text || '(בלי טקסט)'}`);
      (p.can_promote === false ? warn : ok)(`   "existing_post": { "platform": "${k}", "id": "${p.id}", "url": "${p.url}" }${p.can_promote === false ? ' - Meta לא מאפשרת לקדם אותו' : ''}`);
    }
  }
}
