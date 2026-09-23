// גישה ל-Graph API של Meta - קריאות בלבד + יצירה מבוקרת.
// שים לב: אין כאן, ולא יהיו כאן, פונקציות מחיקה או שינוי סטטוס. זה חלק מבלם החירום.
const V = () => process.env.META_GRAPH_VERSION || 'v21.0';

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
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.error_user_msg || data?.error?.message || `HTTP ${res.status}`);
  }
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
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.error_user_msg || data?.error?.message || `HTTP ${res.status}`);
  }
  return data;
}

// העלאת תמונה לספריית המודעות של החשבון - מחזיר hash לשימוש במודעה.
export async function uploadAdImage(imageBuffer) {
  const fd = new FormData();
  fd.append('access_token', process.env.META_ADS_ACCESS_TOKEN);
  fd.append('filename', new Blob([imageBuffer], { type: 'image/png' }), 'creative.png');
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
