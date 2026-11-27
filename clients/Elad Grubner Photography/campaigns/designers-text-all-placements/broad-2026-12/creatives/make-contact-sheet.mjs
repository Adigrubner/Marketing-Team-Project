// דף מגע: שני המועמדים לקולאז' של דצמבר (קהל רחב) ליד הקולאז' של סוניה וספיר, להשוואה.
// בכל עמודה: הפיד (4:5) והסטורי (9:16) בגודל אחיד, ומתחת הפיד ברוחב 400 פיקסלים - כמו בטלפון.
// הרצה (מכל מקום): node "<הנתיב לקובץ הזה>"  ·  צריך כרום/אדג' ו-ffmpeg, ואינטרנט בשביל הגופן Heebo.
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAMP = resolve(HERE, '../..');
const url = (p) => pathToFileURL(p).href;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
if (!CHROME) throw new Error('לא נמצא כרום או אדג׳');

const COLS = [
  { title: 'הקולאז\' שעבד: סוניה וספיר', sub: 'להשוואה בלבד · רץ מ-1.11',
    feed: join(CAMP, 'creatives/final/feed/ad4-collage-clean.jpg'), feedName: 'creatives/final/feed/ad4-collage-clean.jpg',
    story: join(CAMP, 'warm-2026-11-15/sonia-story/story-collage.jpg'), storyName: 'warm-2026-11-15/sonia-story/story-collage.jpg' },
  { title: 'א\' · חן אברהמוף, חיפה', sub: 'ההמלצה',
    feed: join(HERE, 'chen-avrahamov/feed-collage-clean.jpg'), feedName: 'chen-avrahamov/feed-collage-clean.jpg',
    story: join(HERE, 'chen-avrahamov/story-collage.jpg'), storyName: 'chen-avrahamov/story-collage.jpg' },
  { title: 'ב\' · ענת זיו, חצרים', sub: 'חלופה',
    feed: join(HERE, 'anat-ziv/feed-collage-clean.jpg'), feedName: 'anat-ziv/feed-collage-clean.jpg',
    story: join(HERE, 'anat-ziv/story-collage.jpg'), storyName: 'anat-ziv/story-collage.jpg' },
];
// השורה השנייה: מועמד ג' (מיימונה טאהא) - המודעה השלישית, שבודקת את הרעיון של אלעד (צילומים שעבדו באורגני)
const COLS2 = [
  { title: 'ג1 · מיימונה טאהא, כפר קאסם', sub: 'שני צילומי רוחב, שניהם מהפוסט של 15.11',
    feed: join(HERE, 'maymuna-taha/feed-collage-clean.jpg'), feedName: 'maymuna-taha/feed-collage-clean.jpg',
    story: join(HERE, 'maymuna-taha/story-collage.jpg'), storyName: 'maymuna-taha/story-collage.jpg' },
  { title: 'ג2 · מיימונה טאהא, כפר קאסם', sub: 'פאזל: סלון ברוחב, ומתחת שני צילומי אורך',
    feed: join(HERE, 'maymuna-taha-2/feed-collage-clean.jpg'), feedName: 'maymuna-taha-2/feed-collage-clean.jpg',
    story: join(HERE, 'maymuna-taha-2/story-collage.jpg'), storyName: 'maymuna-taha-2/story-collage.jpg' },
];

const FONT = `'Heebo', 'Segoe UI', sans-serif`;
const FH = 640, FW = 512, SW = 360;             // פיד 512x640, סטורי 360x640
const COLW = FW + 20 + SW;
const W = 60 + COLS.length * COLW + (COLS.length - 1) * 50 + 60;
const H = 1640 + 1440;
const col = (c) => `
  <div style="width:${COLW}px">
    <div style="font:800 30px/1.2 ${FONT}">${c.title}</div>
    <div style="font:400 20px/1.4 ${FONT};color:#7B5A2E;margin:4px 0 16px">${c.sub}</div>
    <div style="display:flex;gap:20px;align-items:flex-start">
      <div><img src="${url(c.feed)}" style="width:${FW}px;height:${FH}px;display:block;box-shadow:0 2px 10px rgba(0,0,0,.15)">
        <div style="font:500 16px ${FONT};color:#555;margin-top:8px;direction:ltr;text-align:right">${c.feedName}</div>
        <div style="font:400 16px ${FONT};color:#888">פיד 4:5, נקי</div></div>
      <div><img src="${url(c.story)}" style="width:${SW}px;height:${FH}px;display:block;box-shadow:0 2px 10px rgba(0,0,0,.15)">
        <div style="font:500 16px ${FONT};color:#555;margin-top:8px;direction:ltr;text-align:right">${c.storyName}</div>
        <div style="font:400 16px ${FONT};color:#888">סטורי וריל 9:16, עם טקסט</div></div>
    </div>
    <div style="font:700 20px ${FONT};margin:34px 0 10px">בגודל של טלפון (400 פיקסלים)</div>
    <img src="${url(c.feed)}" style="width:400px;height:500px;display:block;box-shadow:0 2px 10px rgba(0,0,0,.15)">
  </div>`;

const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=block">
<style>*{margin:0;padding:0;box-sizing:border-box} body{background:#EDEBE7;width:${W}px;height:${H}px;font-family:${FONT};color:#1F1F1F}</style></head>
<body><div style="padding:40px 60px">
  <div style="font:800 38px ${FONT}">קולאז' חדש לקהל הרחב · דצמבר</div>
  <div style="font:400 22px ${FONT};color:#666;margin:6px 0 34px">א' וב': באותה פריסה כמו הקולאז' הנקי של סוניה וספיר (4 תאים שווים, רווח לבן של 8 פיקסלים). ג': פריסה שמתאימה לצילומי רוחב. כל הסטוריז באותו עיצוב, עם תיקון הפס הלבן.</div>
  <div style="display:flex;gap:50px">${COLS.map(col).join('')}</div>
  <div style="height:3px;background:#D6D1C8;margin:50px 0 40px"></div>
  <div style="font:800 30px ${FONT};margin-bottom:24px">מועמד ג' - המודעה השלישית: צילומים מהפוסט האורגני החזק של אלעד</div>
  <div style="display:flex;gap:50px">${COLS2.map(col).join('')}</div>
</div></body></html>`;

const tmp = mkdtempSync(join(tmpdir(), 'sheet-'));
try {
  const page = join(tmp, 'sheet.html'), png = join(tmp, 'sheet.png');
  writeFileSync(page, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--virtual-time-budget=15000', `--window-size=${W},${H}`, `--screenshot=${png}`, url(page)], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', join(HERE, 'contact-sheet.jpg')]);
} finally { rmSync(tmp, { recursive: true, force: true }); }
console.log('נוצר:', join(HERE, 'contact-sheet.jpg'));
