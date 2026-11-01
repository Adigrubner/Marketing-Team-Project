// בונה את 4 המודעות של הבדיקה (גרסה 2, 29.10): כל מודעה היא קובץ אחד 1080x1920 לכל המיקומים.
//
// הרצה (מכל תיקייה):
//   node "clients/Elad Grubner Photography/campaigns/designers-text-all-placements/overlay/render.mjs"
//
// להחלפת הנוסח: עורכים את overlay/text.json (line1, line2) ומריצים שוב. זה הכל.
//
// המודעות (שמות הקבצים ב-creatives/):
//   1. תמונה בודדת + טקסט   broad-1-9x16-a.jpg (טקסט על התמונה) · broad-1-9x16-b.jpg (טקסט בפס)
//   2. תמונה בודדת, נקייה   broad-2-9x16.jpg
//   3. קולאז' 2x2 + טקסט    broad-3-9x16-a.jpg (על התמונות) · broad-3-9x16-b.jpg (בפס)
//   4. קולאז' 2x2, נקי      broad-4-9x16.jpg
//   + creatives/feed-check/<שם>-feed.jpg: מה שיראו בפיד (Meta חותכת 4:5 מהאמצע, שורות 285-1635).
//   + creatives/contact-sheet.jpg
//
// הכלל של הפורמט (הבריף, "מגבלה טכנית"): הכלי מעלה תמונה אחת לכל המיקומים. לכן כל מה שחשוב
// (התמונה או הקולאז', וגם הטקסט) נמצא ב-4:5 האמצעי, ומעל ומתחת יש רק רקע. הטקסט בחלק העליון של
// ה-4:5, מתחת לשורה 300, כי ה-35% התחתונים בריל מכוסים. הסקריפט בודק את זה בכל הרצה.
//
// העברית: כל קובץ הוא דף HTML מימין לשמאל (dir="rtl") שמצולם בכרום בלי חלון. ככה האותיות,
// סדר המילים והמספרים ("+ 3") תמיד נכונים. שורה ארוכה מדי מוקטנת אוטומטית, עם אזהרה.
//
// התמונות עצמן לא משתנות: creatives/source/ מחזיק את החיתוכים (רק חיתוך), והתבנית מוסיפה טקסט ופסים.
// single-14.jpg הוא הקובץ המקורי מהדרייב כמו שהוא (1067x1600). ברוחב 1080 הוא מוצג גדול ב-1.2%.

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const CREATIVES = join(HERE, '..', 'creatives');
const SOURCE = join(CREATIVES, 'source');
const FEED_DIR = join(CREATIVES, 'feed-check');
const TEXT = JSON.parse(readFileSync(join(HERE, 'text.json'), 'utf8'));

// ---------- הקנבס ----------
const W = 1080, H = 1920;
const FEED_TOP = 285, FEED_BOTTOM = 1635;   // ה-4:5 האמצעי: מה שנשאר בפיד
const TEXT_MIN = 300;                         // הטקסט מתחיל מתחת לשורה הזו
const REEL_SAFE_BOTTOM = Math.round(0.65 * H); // 1248: מתחת לזה הכיתוב והכפתור של הריל
const STORY_SAFE_TOP = Math.round(0.14 * H);   // 269: מעל זה השם וסרגל ההתקדמות בסטורי

// ---------- עיצוב (צבעי המותג מ-assets/brand.md) ----------
const BRAND = { charcoal: '#2A2A2A', bronze: '#7B5A2E', cream: '#F2EEE8' };
const BAND_THEME = process.env.BAND || 'cream';  // הפס: 'cream' או 'dark' (BAND=dark node render.mjs)
const BAND = BAND_THEME === 'dark'
  ? { bg: BRAND.charcoal, fg: BRAND.cream, rule: '#A8834F' }
  : { bg: BRAND.cream, fg: BRAND.charcoal, rule: BRAND.bronze };
const FONT_L1 = `'Frank Ruhl Libre', 'Gisha', serif`;           // שורה 1: הסריף של המותג
const FONT_L2 = `'Assistant', 'Gisha', 'Segoe UI', sans-serif`;  // שורה 2: סנס נקי, קריא בקטן
const L1_WEIGHT = Number(process.env.L1W || 500);
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Assistant:wght@600;700&family=Frank+Ruhl+Libre:wght@500;700&display=block';
const SIZE = { l1: 0.073 * W, l2: 0.045 * W };   // 79 ו-49 פיקסלים
const SIDE = 0.065 * W;                          // שוליים מימין ומשמאל לטקסט
const GAP = 10;                                   // הרווח בין תמונות הקולאז'

// ---------- התמונות ----------
// הבודדת: הקובץ המלא, ברוחב 1080. מיקום: מתחיל בשורה 210, כדי שב-4:5 האמצעי ייכנסו הקיר הלבן שמעל
// פס התאורה (שם יושב הטקסט) וגם רגלי הכיסאות. בפריסה ב' התמונה מתחילה מתחת לספוטים (שורה 372 במקור).
const SINGLE = { file: 'single-14.jpg', top: 210, bTopSrc: 372 };
// הקולאז', לפי סדר הקריאה מימין לשמאל: 1 למעלה מימין (החזקה), 2 למעלה משמאל, 3 למטה מימין, 4 למטה משמאל.
// focusY = איזה חלק מהתמונה נשאר כשהתא נמוך יותר מ-4:5 (בפריסה ב'): 0% למעלה, 100% למטה.
const CELLS = [
  { file: 'cell-1-14.jpg', focusY: 100 }, // המטבח (בתא נמוך נשמרות רגלי הכיסאות, והתקרה יורדת)
  { file: 'cell-2-06.jpg', focusY: 45 },  // כל הקומה עד הגינה
  { file: 'cell-3-04.jpg', focusY: 30 },  // הסלון אל הגינה
  { file: 'cell-4-05.jpg', focusY: 55 },  // הסלון עם המדרגות, והמטבח ברקע
];

// ---------- הגרסאות ----------
const ADS = [
  { out: 'broad-1-9x16-a.jpg', kind: 'single', style: 'a', label: 'מודעה 1 · בודדת + טקסט (א) על התמונה' },
  { out: 'broad-1-9x16-b.jpg', kind: 'single', style: 'b', label: 'מודעה 1 · בודדת + טקסט (ב) בפס' },
  { out: 'broad-2-9x16.jpg',   kind: 'single', style: null, label: 'מודעה 2 · בודדת נקייה' },
  { out: 'broad-3-9x16-a.jpg', kind: 'collage', style: 'a', label: "מודעה 3 · קולאז' + טקסט (א) על התמונות" },
  { out: 'broad-3-9x16-b.jpg', kind: 'collage', style: 'b', label: "מודעה 3 · קולאז' + טקסט (ב) בפס" },
  { out: 'broad-4-9x16.jpg',   kind: 'collage', style: null, label: "מודעה 4 · קולאז' נקי" },
];
const B_BAND_END = 520;   // פריסה ב': הפס העליון נגמר כאן (ב-4:5 רואים ממנו 285-520, עם שתי השורות)

// ---------- כלים ----------
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => existsSync(p));
if (!CHROME) throw new Error('לא נמצא כרום או אדג׳ במחשב');

function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const url = f => pathToFileURL(f).href;

function chrome(args) {
  return execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--virtual-time-budget=15000', ...args],
    { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
}

// סקריפט שרץ בדף: מחכה לגופנים, מקטין שורה שלא נכנסת, ומדווח איפה הטקסט.
const PAGE_SCRIPT = `
(async () => {
  await document.fonts.ready;
  const rep = { lines: [], blocks: [] };
  for (const el of document.querySelectorAll('.fit')) {
    const base = parseFloat(getComputedStyle(el).fontSize);
    let fs = base;
    while (el.scrollWidth > el.clientWidth + 0.5 && fs > base * 0.6) { fs -= 0.5; el.style.fontSize = fs + 'px'; }
    const span = el.querySelector('span');
    const tw = span.getBoundingClientRect().width, n = span.textContent.length;
    rep.lines.push({ line: el.dataset.line, base, final: fs, boxWidth: el.clientWidth, textWidth: Math.round(tw),
      chars: n, maxCharsApprox: Math.floor(el.clientWidth / (tw / n)) });
  }
  const ad = document.querySelector('.ad').getBoundingClientRect();
  for (const b of document.querySelectorAll('.txt')) {
    const r = b.getBoundingClientRect();
    rep.blocks.push({ top: Math.round(r.top - ad.top), bottom: Math.round(r.bottom - ad.top) });
  }
  rep.fontsOk = document.fonts.check('700 40px "Assistant"', 'מעצבות') && document.fonts.check('${L1_WEIGHT} 40px "Frank Ruhl Libre"', 'מעצבות');
  document.getElementById('report').textContent = JSON.stringify(rep);
})();`;

// ---------- חלקי העיצוב ----------
const lines = (align, withRule, color) => `
  ${withRule ? `<div style="width:${Math.round(0.06 * W)}px;height:3px;background:${BAND.rule};margin:0 ${align === 'center' ? 'auto' : '0 0 auto'} 18px"></div>` : ''}
  <div style="font:${L1_WEIGHT} ${Math.round(SIZE.l1)}px/1.12 ${FONT_L1};color:${color}"><div class="fit" data-line="1"><span>${esc(TEXT.line1)}</span></div></div>
  <div style="font:700 ${Math.round(SIZE.l2)}px/1.3 ${FONT_L2};color:${color};margin-top:9px"><div class="fit" data-line="2"><span>${esc(TEXT.line2)}</span></div></div>`;

// (א) טקסט על התמונה: הילה בהירה ורכה סביב האותיות, ופס הצללה בהיר ושקוף רק מאחורי הטקסט.
const overlayText = (veilA) => `
  <div style="position:absolute;left:0;right:0;top:${TEXT_MIN - 40}px;height:270px;
    background:linear-gradient(180deg, rgba(242,238,232,0) 0%, rgba(242,238,232,${veilA}) 25%, rgba(242,238,232,${veilA}) 70%, rgba(242,238,232,0) 100%)"></div>
  <div class="txt" style="position:absolute;top:${TEXT_MIN + 5}px;right:${SIDE}px;left:${SIDE}px;text-align:right;
    text-shadow:0 0 17px rgba(242,238,232,.95), 0 0 5px rgba(242,238,232,.9)">${lines('right', false, BRAND.charcoal)}</div>`;

// (ב) פס עליון בצבע המותג, עם שתי השורות במרכז החלק שרואים בפיד (285-520).
const bandText = () => `
  <div style="position:absolute;left:0;right:0;top:0;height:${B_BAND_END}px;background:${BAND.bg}"></div>
  <div style="position:absolute;left:${SIDE}px;right:${SIDE}px;top:${FEED_TOP}px;height:${B_BAND_END - FEED_TOP}px;
    display:flex;flex-direction:column;justify-content:center;text-align:center"><div class="txt">${lines('center', true, BAND.fg)}</div></div>`;

function singleBody(ad) {
  const { w: sw, h: sh } = probe(join(SOURCE, SINGLE.file));
  const scale = W / sw, ph = Math.round(sh * scale);
  const img = url(join(SOURCE, SINGLE.file));
  if (ad.style === 'b') {
    const top = B_BAND_END, off = Math.round(SINGLE.bTopSrc * scale);
    return `<div style="position:absolute;left:0;top:${top}px;width:${W}px;height:${ph - off}px;overflow:hidden">
        <img src="${img}" style="position:absolute;left:0;top:${-off}px;width:${W}px;height:${ph}px"></div>${bandText()}`;
  }
  const photo = `<img src="${img}" style="position:absolute;left:0;top:${SINGLE.top}px;width:${W}px;height:${ph}px">`;
  return photo + (ad.style === 'a' ? overlayText(0.38) : '');
}

function collageBody(ad) {
  const top = ad.style === 'b' ? B_BAND_END : FEED_TOP, bottom = FEED_BOTTOM;
  const cw = (W - GAP) / 2, ch = (bottom - top - GAP) / 2;
  // מימין לשמאל: תא 1 למעלה מימין
  const pos = [[W - cw, top], [0, top], [W - cw, top + ch + GAP], [0, top + ch + GAP]];
  const cells = CELLS.map((c, i) => `<div style="position:absolute;left:${pos[i][0]}px;top:${pos[i][1]}px;width:${cw}px;height:${ch}px;overflow:hidden">
      <img src="${url(join(SOURCE, c.file))}" style="width:100%;height:100%;object-fit:cover;object-position:50% ${c.focusY}%"></div>`).join('');
  if (ad.style === 'b') return cells + bandText();
  return cells + (ad.style === 'a' ? overlayText(0.5) : '');
}

function page(ad) {
  const body = ad.kind === 'single' ? singleBody(ad) : collageBody(ad);
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS_CSS}">
<style>
  html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden;background:${BAND.bg}}
  .ad{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${BAND.bg}}
  .fit{white-space:nowrap;overflow:visible;width:100%}
  img{display:block}
</style></head><body>
<div class="ad">${body}</div>
<pre id="report" style="display:none"></pre>
<script>${PAGE_SCRIPT}</script>
</body></html>`;
}

// ---------- ריצה ----------
mkdirSync(FEED_DIR, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'ad-overlay-'));
let problems = 0;
try {
  for (const ad of ADS) {
    const htmlFile = join(tmp, ad.out.replace('.jpg', '.html'));
    writeFileSync(htmlFile, page(ad));
    const u = url(htmlFile);

    const warn = [];
    if (ad.style) {
      const dom = chrome([`--window-size=${W},${H}`, '--dump-dom', u]);
      const m = dom.match(/<pre id="report"[^>]*>([\s\S]*?)<\/pre>/);
      const rep = m ? JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : null;
      if (!rep) warn.push('לא התקבל דוח מהדף');
      else {
        if (!rep.fontsOk) warn.push('הגופנים לא נטענו (נבחר גופן חלופי)');
        for (const l of rep.lines) if (l.final < l.base) warn.push(`שורה ${l.line} הוקטנה מ-${l.base} ל-${l.final} פיקסלים כדי להיכנס`);
        for (const b of rep.blocks) {
          if (b.top < TEXT_MIN || b.top < STORY_SAFE_TOP) warn.push(`הטקסט מתחיל גבוה מדי (שורה ${b.top})`);
          if (b.bottom > FEED_BOTTOM) warn.push(`הטקסט יוצא מה-4:5 של הפיד (שורה ${b.bottom})`);
          if (b.bottom > REEL_SAFE_BOTTOM) warn.push(`הטקסט נכנס לאזור הכיתוב של הריל (שורה ${b.bottom})`);
        }
        console.log(`   ${JSON.stringify(rep)}`);
      }
    }
    const png = join(tmp, ad.out.replace('.jpg', '.png'));
    chrome([`--window-size=${W},${H}`, `--screenshot=${png}`, u]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', join(CREATIVES, ad.out)]);
    // תצוגת הפיד: 4:5 מהאמצע
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', `crop=${W}:${FEED_BOTTOM - FEED_TOP}:0:${FEED_TOP}`, '-q:v', '2',
      join(FEED_DIR, ad.out.replace('.jpg', '-feed.jpg'))]);
    const { w, h } = probe(join(CREATIVES, ad.out));
    if (w !== W || h !== H) warn.push(`גודל ${w}x${h} במקום ${W}x${H}`);
    problems += warn.length;
    console.log(`${ad.out}  ${w}x${h}  ${warn.length ? 'אזהרות: ' + warn.join(' | ') : 'תקין'}`);
  }

  // ---------- דף מגע ----------
  const TH = 720, TW = Math.round(TH * W / H), FH = Math.round(TW * (FEED_BOTTOM - FEED_TOP) / W);
  const hatch = 'repeating-linear-gradient(45deg,rgba(200,40,40,.45) 0 10px,rgba(200,40,40,.18) 10px 20px)';
  const k = TH / H;
  const col = ad => `<div style="display:flex;flex-direction:column;align-items:center;gap:14px;width:${TW}px">
    <div style="font:700 21px/1.3 'Assistant';text-align:center;min-height:56px">${esc(ad.label)}</div>
    <img src="${url(join(CREATIVES, ad.out))}" style="width:${TW}px;height:${TH}px;display:block;box-shadow:0 0 0 1px #bbb">
    <div style="position:relative;width:${TW}px;height:${TH}px;box-shadow:0 0 0 1px #bbb">
      <img src="${url(join(CREATIVES, ad.out))}" style="width:${TW}px;height:${TH}px;display:block">
      <div style="position:absolute;left:0;right:0;top:0;height:${Math.round(STORY_SAFE_TOP * k)}px;background:${hatch}"></div>
      <div style="position:absolute;left:0;right:0;top:${Math.round(REEL_SAFE_BOTTOM * k)}px;bottom:0;background:${hatch}"></div>
      <div style="position:absolute;left:0;right:0;top:${Math.round(FEED_TOP * k)}px;height:${Math.round((FEED_BOTTOM - FEED_TOP) * k)}px;border:3px dashed #1F5FBF;box-sizing:border-box"></div>
    </div>
    <img src="${url(join(FEED_DIR, ad.out.replace('.jpg', '-feed.jpg')))}" style="width:${TW}px;height:${FH}px;display:block;box-shadow:0 0 0 1px #bbb">
    <div dir="ltr" style="font:500 17px/1.35 Consolas,monospace;color:#444;text-align:center">${ad.out}<br>feed-check/${ad.out.replace('.jpg', '-feed.jpg')}</div>
  </div>`;
  const rowLabel = (t, h) => `<div style="height:${h}px;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;transform:rotate(180deg);font:700 22px 'Assistant';color:#555">${t}</div>`;
  const SW = 6 * TW + 5 * 34 + 190, SH = 200 + 70 + TH * 2 + FH + 3 * 14 + 70;
  const sheet = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS_CSS}">
<style>html,body{margin:0;width:${SW}px;height:${SH}px;background:#ECE9E4;font-family:'Assistant',sans-serif;color:#2A2A2A}</style></head><body>
<div style="padding:30px 50px 10px">
  <div style="font:700 38px/1.2 'Assistant'">4 מודעות לבדיקה · סוניה וספיר, תל מונד · כל מודעה קובץ אחד 1080x1920 לכל המיקומים</div>
  <div style="font:500 22px/1.45 'Assistant';color:#555">טקסט דמה לבדיקת פריסה בלבד: "${esc(TEXT.line1)}" / "${esc(TEXT.line2)}". שורה 1: הקובץ. שורה 2: באדום מה שהממשק מכסה (למעלה בסטורי, למטה בריל), ובכחול ה-4:5 שנשאר בפיד. שורה 3: מה שיראו בפיד.</div>
</div>
<div style="display:flex;gap:20px;padding:10px 40px">
  <div style="display:flex;flex-direction:column;gap:14px;padding-top:70px">${rowLabel('הקובץ', TH)}${rowLabel('בדיקת אזורים', TH)}${rowLabel('בפיד', FH)}</div>
  <div style="display:flex;gap:34px">${ADS.map(col).join('')}</div>
</div>
</body></html>`;
  const sheetHtml = join(tmp, 'contact-sheet.html');
  writeFileSync(sheetHtml, sheet);
  const sheetPng = join(tmp, 'contact-sheet.png');
  chrome([`--window-size=${SW},${SH}`, `--screenshot=${sheetPng}`, url(sheetHtml)]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', sheetPng, '-q:v', '3', join(CREATIVES, 'contact-sheet.jpg')]);
  console.log(`contact-sheet.jpg  נבנה (${SW}x${SH})`);
  console.log(problems ? `סה"כ ${problems} אזהרות - לבדוק לפני שממשיכים` : 'הכל תקין');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
