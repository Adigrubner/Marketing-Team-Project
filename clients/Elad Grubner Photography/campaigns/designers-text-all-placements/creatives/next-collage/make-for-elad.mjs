// קבצים פשוטים לאלעד בוואטסאפ (עדי, 11.11): לכל אפשרות הפיד והסטורי זה לצד זה, עם האות ושם הפרויקט. בלי מספרים ובלי הסברים.
// הרצה: node make-for-elad.mjs <תיקיית next-collage> <תיקייה זמנית>
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const [NC, TMP] = process.argv.slice(2);
const u = (p) => pathToFileURL(p).href;
const F = `'Heebo',sans-serif`;
const OPTS = [
  ['a', 'א', 'ענבל קרקו, תל אביב', 'inbal-karako-wide'],
  ['b', 'ב', 'סטודיו שאגא, יקנעם', 'studio-saga-wide'],
  ['c', 'ג', 'ענבל קרקו, תל אביב', 'inbal-karako-mix'],
  ['d', 'ד', 'ליהי לוי, בת ים', 'lihi-levy-mix'],
];
const H = 716, FW = Math.round(H * 0.8), SW = Math.round(H * 9 / 16);
const block = ([, letter, name, dir]) => `<div style="padding:44px 40px 40px;background:#fff">
  <div style="font:800 54px/1.1 ${F};color:#1F1F1F;margin-bottom:26px">${letter} · ${name}</div>
  <div style="display:flex;gap:24px;justify-content:flex-start">
    <div><img src="${u(join(NC, dir, 'feed', 'collage-clean.jpg'))}" style="width:${FW}px;height:${H}px;display:block;box-shadow:0 2px 10px rgba(0,0,0,.18)">
      <div style="font:500 26px ${F};color:#6A6560;margin-top:12px">בפיד</div></div>
    <div><img src="${u(join(NC, dir, 'story-collage.jpg'))}" style="width:${SW}px;height:${H}px;display:block;box-shadow:0 2px 10px rgba(0,0,0,.18)">
      <div style="font:500 26px ${F};color:#6A6560;margin-top:12px">בסטורי ובריל</div></div>
  </div></div>`;
const shot = (html, out, hgt) => {
  const hp = join(TMP, 'elad.html'); writeFileSync(hp, `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;800&display=block"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:1080px;background:#EFEDE9}</style></head><body>${html}</body></html>`);
  const png = join(TMP, 'elad.png');
  execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=20000', `--window-size=1080,${hgt}`, `--screenshot=${png}`, u(hp)], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', out]);
};
const BH = 44 + 60 + 26 + H + 12 + 38 + 40; // גובה בלוק אחד
for (const o of OPTS) shot(block(o), join(NC, 'for-elad', `option-${o[0]}.jpg`), BH);
shot(OPTS.map(block).join('<div style="height:14px"></div>'), join(NC, 'for-elad', 'options-for-elad.jpg'), OPTS.length * BH + 3 * 14);
console.log('ok', BH);
