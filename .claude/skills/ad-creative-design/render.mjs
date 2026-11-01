// מרנדר מודעות ממומן עם טקסט, ברמת עיצוב גבוהה, מתוך קובץ spec (JSON).
//
// הרצה (מתיקיית הפרויקט הראשית):
//   node .claude/skills/ad-creative-design/render.mjs "<נתיב ל-spec.json>"
//
// כל מודעה היא קובץ 1080x1920. ברירת המחדל: קובץ משותף לכל המיקומים, ולצידו feed/<id>.jpg ב-4:5.
// מ-29.10 meta-upload.js יודע לשים תמונה לכל מיקום (placement_images), ואז לסטורי עושים קובץ משלו (format: "story").
// בקובץ המשותף כל מה שחשוב יושב בתוך ה-4:5 האמצעי (שורות 285-1635), שזה מה שנשאר בפיד, והטקסט בין 300 ל-1240,
// כי מעל 269 יושב השם בסטורי ומתחת ל-1248 הכיתוב והכפתור בריל. הסקריפט בודק את זה בכל הרצה.
//
// העברית: כל מודעה היא דף HTML מימין לשמאל שמצולם בכרום בלי חלון, ולכן הטקסט תמיד תקין.
// הגופן: Heebo (עדי, 29.10). הצבעים: מ-assets/brand.md של הלקוח, דרך spec.theme.
//
// פלט, בתיקייה spec.out (יחסית לקובץ ה-spec):
//   <id>.jpg            המודעה (1080x1920)
//   feed/<id>.jpg       מה שיראו בפיד (חיתוך 4:5 מהאמצע)
//   contact-sheet.jpg   כל המודעות, ומתחת לכל אחת מה שיראו בפיד

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const specPath = resolve(process.argv[2] || '');
if (!process.argv[2] || !existsSync(specPath)) throw new Error('צריך נתיב לקובץ spec.json');
const SPEC = JSON.parse(readFileSync(specPath, 'utf8'));
const BASE = dirname(specPath);
const OUT = resolve(BASE, SPEC.out || 'designs');
mkdirSync(join(OUT, 'feed'), { recursive: true });

// ---------- הקנבס והאזורים ----------
const W = 1080, H = 1920;
const FEED = { top: 285, bottom: 1635 };     // ה-4:5 האמצעי
const SAFE = { top: 300, bottom: 1240 };     // הטקסט חייב להיות כאן
const M = 64;                                 // שוליים

// ---------- ערכת העיצוב ----------
const T = {
  ink: '#1F1F1F', soft: '#5A5652', bronze: '#7B5A2E', bronzeLight: '#C8A273',
  paper: '#FFFFFF', cream: '#F4F0EA', night: '#1E1D1B',
  ...(SPEC.theme || {}),
};
const FONT = `'Heebo', 'Assistant', 'Segoe UI', sans-serif`;
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800&display=block';

// ---------- כלים ----------
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('לא נמצא כרום או אדג׳ במחשב');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const url = (f) => pathToFileURL(f).href;
const img = (p) => url(resolve(BASE, p));
const chrome = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--virtual-time-budget=15000', ...args],
  { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString();

// מדגיש חלק מהשורה (למשל "3 רילסים במתנה"), בלי לשנות את הנוסח
function withHighlight(text, hl, cls = 'hl') {
  const t = esc(text);
  if (!hl || !text.includes(hl)) return t;
  return t.replace(esc(hl), `<span class="${cls}">${esc(hl)}</span>`);
}

// ---------- התמונות ----------
// single: תמונה אחת שממלאת אזור. collage: 2x2 עם רווח דק.
function photos(ad, box, gap = 8) {
  const st = `position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px`;
  if (ad.images.length === 1) {
    const i = ad.images[0];
    return `<div style="${st};overflow:hidden"><img src="${img(i.src)}" style="width:100%;height:100%;object-fit:cover;object-position:${i.pos || '50% 50%'}"></div>`;
  }
  const cells = ad.images.slice(0, 4).map((i) =>
    `<div style="overflow:hidden"><img src="${img(i.src)}" style="width:100%;height:100%;object-fit:cover;object-position:${i.pos || '50% 50%'}"></div>`).join('');
  return `<div style="${st};display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:${gap}px;background:${ad.gapColor || T.paper}">${cells}</div>`;
}

// ---------- בלוק הטקסט (משותף לכל הפריסות) ----------
// eyebrow: שורה קטנה מעל (מי מדבר) · headline: הכותרת · sub: ההצעה, עם הדגשה · rule: קו ברונזה קצר
function textBlock(ad, { dark = false, size = 1 } = {}) {
  const x = ad.text;
  const ink = dark ? '#FFFFFF' : T.ink;
  const soft = dark ? 'rgba(255,255,255,.82)' : T.soft;
  const acc = dark ? T.bronzeLight : T.bronze;
  return `
  <div class="txt">
    ${x.eyebrow ? `<div style="font:500 ${Math.round(29 * size)}px/1.2 ${FONT};letter-spacing:.03em;color:${acc};margin-bottom:${Math.round(20 * size)}px">${esc(x.eyebrow)}</div>` : ''}
    <div class="fit" style="font:700 ${Math.round(84 * size)}px/1.04 ${FONT};letter-spacing:-.015em;color:${ink}"><span>${esc(x.headline)}</span></div>
    <div style="width:${Math.round(64 * size)}px;height:4px;background:${acc};margin:${Math.round(26 * size)}px 0 ${Math.round(24 * size)}px"></div>
    <div class="fit" style="font:400 ${Math.round(40 * size)}px/1.3 ${FONT};color:${soft}"><span>${withHighlight(x.sub, x.highlight)}</span></div>
  </div>
  <style>.hl{font-weight:700;color:${ink};}</style>`;
}

const signature = (ad, color, top) => ad.text.signature ? `
  <div style="position:absolute;right:${M}px;left:${M}px;top:${top}px;font:400 24px/1 ${FONT};letter-spacing:.08em;color:${color};text-align:right">${esc(ad.text.signature)}</div>` : '';

// הטקסט בפאנל העליון, ממורכז לגובה. בקובץ משותף (ברירת המחדל) - בחלק שרואים בפיד (מ-285).
// בקובץ לסטורי בלבד (format: "story") - מתחת לשם החשבון של הסטורי (מ-269), והתמונה ממלאת עד למטה.
const STORY_TOP = 269;
const isStory = (ad) => ad.format === 'story';
const headerText = (ad, hb, block) => {
  const top = isStory(ad) ? STORY_TOP : FEED.top;
  return `
  <div style="position:absolute;right:${M}px;left:${M}px;top:${top}px;height:${hb - top}px;display:flex;flex-direction:column;justify-content:center">${block}</div>`;
};

// ---------- הפריסות ----------
const LAYOUTS = {
  // נקייה: רק התמונה או הקולאז', על כל המסך, בלי טקסט (הגרסה "בלי טקסט" בבדיקת ווריאציות)
  clean(ad) {
    return photos(ad, { left: 0, top: 0, width: W, height: H }, 8);
  },

  // מגזין: פאנל לבן למעלה, טקסט מיושר לימין, התמונה מתחתיו עד הסוף
  editorial(ad) {
    const hb = ad.headerBottom || 640;
    const isCollage = ad.images.length > 1;
    const photoBox = isCollage && !isStory(ad)
      ? { left: 0, top: hb, width: W, height: FEED.bottom - hb }
      : { left: 0, top: hb, width: W, height: H - hb };
    return `
      <div style="position:absolute;inset:0;background:${T.paper}"></div>
      ${photos(ad, photoBox, 8)}
      ${headerText(ad, hb, textBlock(ad))}
      ${isCollage ? signature(ad, T.soft, FEED.bottom + 36) : ''}`;
  },

  // כרטיס צף: התמונה ממלאת הכל, וכרטיס לבן למעלה מימין
  card(ad) {
    const cardW = ad.cardWidth || 830;
    return `
      ${photos(ad, { left: 0, top: 0, width: W, height: H }, 8)}
      <div style="position:absolute;top:${ad.cardTop || SAFE.top + 30}px;right:${M - 16}px;width:${cardW}px;background:${T.paper};
        padding:50px 54px 52px;box-shadow:0 18px 50px rgba(0,0,0,.18)">${textBlock(ad, { size: 0.86 })}</div>`;
  },

  // לילה: פאנל כהה למעלה, טקסט לבן והדגשה בברונזה בהירה
  night(ad) {
    const hb = ad.headerBottom || 640;
    const isCollage = ad.images.length > 1;
    const photoBox = isCollage && !isStory(ad)
      ? { left: 0, top: hb, width: W, height: FEED.bottom - hb }
      : { left: 0, top: hb, width: W, height: H - hb };
    return `
      <div style="position:absolute;inset:0;background:${T.night}"></div>
      ${photos(ad, { ...photoBox }, 8).replace(`background:${ad.gapColor || T.paper}`, `background:${T.night}`)}
      ${headerText(ad, hb, textBlock(ad, { dark: true }))}
      ${isCollage ? signature(ad, 'rgba(255,255,255,.6)', FEED.bottom + 36) : ''}
      <style>.hl{color:${T.bronzeLight} !important}</style>`;
  },
};

// ---------- הדף ----------
const PAGE_SCRIPT = `
(async () => {
  await document.fonts.ready;
  for (const el of document.querySelectorAll('.fit')) {
    const base = parseFloat(getComputedStyle(el).fontSize); let fs = base;
    el.style.whiteSpace = 'nowrap';
    while (el.scrollWidth > el.clientWidth + 0.5 && fs > base * 0.7) { fs -= 0.5; el.style.fontSize = fs + 'px'; el.dataset.shrunk = '1'; }
  }
  const rep = { fontsOk: !document.querySelector('.txt') || document.fonts.check('700 40px "Heebo"', 'מעצבות'), blocks: [], shrunk: [] };
  for (const b of document.querySelectorAll('.txt')) { const r = b.getBoundingClientRect(); rep.blocks.push({ top: Math.round(r.top), bottom: Math.round(r.bottom) }); }
  for (const el of document.querySelectorAll('.fit')) if (el.dataset.shrunk) rep.shrunk.push(el.textContent.trim());
  document.getElementById('report').textContent = JSON.stringify(rep);
})();`;

function page(ad) {
  const body = LAYOUTS[ad.layout](ad);
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
  <link rel="stylesheet" href="${FONTS_CSS}">
  <style>*{box-sizing:border-box;margin:0;padding:0} html,body{width:${W}px;height:${H}px;overflow:hidden;background:#fff}
  .ad{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:${FONT};text-align:right}
  .fit{overflow:hidden}</style></head>
  <body><div class="ad">${body}</div><pre id="report" style="display:none"></pre><script>${PAGE_SCRIPT}</script></body></html>`;
}

// ---------- הרצה ----------
const tmp = mkdtempSync(join(tmpdir(), 'ad-design-'));
const problems = [];
try {
  for (const ad of SPEC.ads) {
    const html = join(tmp, `${ad.id}.html`);
    writeFileSync(html, page(ad));
    const dom = chrome([`--window-size=${W},${H}`, '--dump-dom', url(html)]);
    const rep = JSON.parse((dom.match(/<pre id="report"[^>]*>([^<]*)<\/pre>/) || [])[1] || '{}');
    if (!rep.fontsOk) problems.push(`${ad.id}: הגופן Heebo לא נטען (צריך אינטרנט)`);
    for (const b of rep.blocks || []) if (b.top < SAFE.top || b.bottom > SAFE.bottom) problems.push(`${ad.id}: הטקסט ב-${b.top}-${b.bottom}, מחוץ ל-${SAFE.top}-${SAFE.bottom}`);
    for (const s of rep.shrunk || []) problems.push(`${ad.id}: השורה הוקטנה כדי להיכנס - "${s}". עדיף לקצר`);
    const png = join(tmp, `${ad.id}.png`);
    chrome([`--window-size=${W},${H}`, `--screenshot=${png}`, url(html)]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', join(OUT, `${ad.id}.jpg`)]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', `crop=${W}:${FEED.bottom - FEED.top}:0:${FEED.top}`, '-q:v', '2', join(OUT, 'feed', `${ad.id}.jpg`)]);
  }

  // דף מגע: לכל מודעה עמודה - הקובץ המלא, ומתחתיו מה שרואים בפיד
  const colW = 360, fullH = Math.round(colW * H / W), feedH = Math.round(colW * (FEED.bottom - FEED.top) / W);
  const cols = SPEC.ads.map((ad) => `
    <div style="width:${colW}px">
      <div style="font:700 22px/1.3 ${FONT};margin-bottom:10px;height:58px">${esc(ad.label || ad.id)}</div>
      <img src="${url(join(OUT, `${ad.id}.jpg`))}" style="width:${colW}px;height:${fullH}px;display:block;box-shadow:0 2px 10px rgba(0,0,0,.15)">
      <div style="font:400 18px ${FONT};color:#777;margin:14px 0 6px">בפיד</div>
      <img src="${url(join(OUT, 'feed', `${ad.id}.jpg`))}" style="width:${colW}px;height:${feedH}px;display:block;box-shadow:0 2px 10px rgba(0,0,0,.15)">
    </div>`).join('');
  const SW = 60 + SPEC.ads.length * (colW + 40), SH = 180 + fullH + feedH + 120;
  const sheet = join(tmp, 'sheet.html');
  writeFileSync(sheet, `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS_CSS}">
    <style>*{margin:0;padding:0;box-sizing:border-box} body{background:#EDEBE7;width:${SW}px;height:${SH}px;font-family:${FONT}}</style></head>
    <body><div style="padding:36px 40px">
      <div style="font:800 34px ${FONT};margin-bottom:6px">${esc(SPEC.title || 'מודעות')}</div>
      <div style="font:400 20px ${FONT};color:#666;margin-bottom:28px">${esc(SPEC.subtitle || 'למעלה הקובץ (סטורי וריל), למטה מה שיראו בפיד')}</div>
      <div style="display:flex;gap:40px">${cols}</div></div></body></html>`);
  const sheetPng = join(tmp, 'sheet.png');
  chrome([`--window-size=${SW},${SH}`, `--screenshot=${sheetPng}`, url(sheet)]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', sheetPng, '-q:v', '3', join(OUT, 'contact-sheet.jpg')]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(problems.length ? `⚠️ בעיות:\n- ${problems.join('\n- ')}` : '✅ הכל תקין: הגופן נטען, והטקסט בתוך האזור המותר בכל המודעות.');
console.log(`הקבצים ב: ${OUT}`);
