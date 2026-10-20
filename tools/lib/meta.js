// גישה ל-Graph API של Meta - קריאות בלבד + יצירה מבוקרת.
// שים לב: אין כאן, ולא יהיו כאן, פונקציות מחיקה או שינוי סטטוס. זה חלק מבלם החירום.
// v26.0 - הגרסה הנוכחית (נבדק 19.10.2026). גרסאות עד v24 כבר לא נתמכות.
const V = () => process.env.META_GRAPH_VERSION || 'v26.0';

export function requireMetaEnv() {
  const missing = ['META_ADS_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    throw new Error(
      `חסרים ערכים ב-.env: ${missing.join(', ')}. ממלאים אותם בשיעורי חלק 5 (חיבור Meta).`
    );
  }
}

export async function graphGet(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${V()}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('access_token', process.env.META_ADS_ACCESS_TOKEN);
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw metaError(data?.error, res.status);
  return data;
}

export async function graphPost(path, body) {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    form.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  form.set('access_token', process.env.META_ADS_ACCESS_TOKEN);
  const res = await fetch(`https://graph.facebook.com/${V()}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw metaError(data?.error, res.status);
  return data;
}

// העלאת תמונה לספריית המודעות של החשבון - מחזיר hash לשימוש במודעה.
// מעלה לספרייה בלבד: זו לא מודעה ולא עולה כסף.
export async function uploadAdImage(imageBuffer, fileName = 'creative.png') {
  const isJpg = /\.jpe?g$/i.test(fileName);
  const fd = new FormData();
  fd.append('access_token', process.env.META_ADS_ACCESS_TOKEN);
  fd.append(
    'filename',
    new Blob([imageBuffer], { type: isJpg ? 'image/jpeg' : 'image/png' }),
    isJpg ? 'creative.jpg' : 'creative.png'
  );
  const res = await fetch(
    `https://graph.facebook.com/${V()}/act_${process.env.META_AD_ACCOUNT_ID}/adimages`,
    { method: 'POST', body: fd }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message || `העלאת תמונה נכשלה (HTTP ${res.status})`);
  }
  const first = Object.values(data?.images || {})[0];
  if (!first?.hash) throw new Error('העלאת תמונה נכשלה - לא התקבל hash');
  return first.hash;
}

export const adAccountPath = (suffix) => `act_${process.env.META_AD_ACCOUNT_ID}/${suffix}`;

// שגיאה עם ההודעה המלאה, ועם הקודים עצמם (code/subcode) - כדי שהכלים יזהו למשל הגבלת בקשות (code 17).
function metaError(err, status) {
  const e = new Error(describeError(err, status));
  e.code = err?.code;
  e.subcode = err?.error_subcode;
  e.status = status;
  return e;
}

// הודעת שגיאה מלאה: ההסבר של Meta + הקודים שצריך כדי להבין מה נדחה (בלי טוקנים).
export function describeError(err, status) {
  if (!err) return `HTTP ${status}`;
  const main = [err.error_user_title, err.error_user_msg || err.message].filter(Boolean).join(' - ');
  const codes = [
    err.code && `code ${err.code}`,
    err.error_subcode && `subcode ${err.error_subcode}`,
    err.fbtrace_id && `trace ${err.fbtrace_id}`,
  ].filter(Boolean).join(', ');
  const blame = err.error_data?.blame_field_specs
    ? ` · שדות: ${JSON.stringify(err.error_data.blame_field_specs)}`
    : '';
  return `${main}${codes ? ` (${codes})` : ''}${blame}`;
}
