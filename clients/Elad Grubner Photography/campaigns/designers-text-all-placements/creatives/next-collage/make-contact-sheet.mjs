// דף מגע לקולאז' הבא (גרסה 4, 11.11 - חללים שלמים: "צילום גדול + פס" (<project>-wide) וקולאז' מעורב (<project>-mix)): לכל פרויקט שתי שורות -
// (1) הסטורי, בדיקת אזורים, קובץ הפיד, ואיך הוא נראה בטלפון;
// (2) שני הצילומים המקוריים, שלמים, עם מסגרת של מה שנשאר בפיד (קו מלא) ובסטורי (מקווקו), ואחוז מה שנשאר.
// הרצה: node make-contact-sheet.mjs <תיקיית next-collage> <קובץ פלט jpg> <תיקייה זמנית> <פרויקט>=<תיקיית המקור בדרייב> ...
// (גרסה 3 של הקובץ, לקולאז' 2x2 מצילומי אורך, נפסלה יחד עם קרן וטלי. הפלט שלה לא נשמר.)
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const [NC, OUT, TMP, ...pairs] = process.argv.slice(2);
const projects = pairs.map((p) => { const i = p.indexOf('='); return { dir: p.slice(0, i), src: p.slice(i + 1) }; });
const u = (p) => pathToFileURL(p).href;
const F = `'Heebo',sans-serif`;
const k = 0.3;
const W = 324, H = 576, FH = 405;
const NAMES = { 'inbal-karako-wide': 'א. ענבל קרקו, תל אביב · צילום גדול + פס (מומלצת)', 'studio-saga-wide': 'ב. סטודיו שאגא, יקנעם · צילום גדול + פס', 'inbal-karako-mix': 'ג. ענבל קרקו, תל אביב · קולאז׳ מעורב (מומלץ מבין המעורבים)', 'lihi-levy-mix': 'ד. ליהי לוי, בת ים · קולאז׳ מעורב, עם המעצבת' };
const ROLE = { hero: 'למעלה · הצילום הגדול', strip: 'למטה · הפס', space: 'למטה מימין · חלל נוסף', portrait: 'למטה משמאל · אורך' };
const zones = (src) => `<div style="position:relative;width:${W}px;height:${H}px">
  <img src="${u(src)}" style="width:${W}px;height:${H}px;display:block">
  <div style="position:absolute;left:0;right:0;top:0;height:${200 * k}px;background:rgba(220,30,30,.35)"></div>
  <div style="position:absolute;left:0;right:0;top:${269 * k}px;border-top:2px dashed #d22"></div>
  <div style="position:absolute;left:0;right:0;top:${1248 * k}px;bottom:0;background:rgba(220,30,30,.28)"></div>
</div>`;
const phone = (src) => `<div style="width:${W}px;background:#fff;border:1px solid #ccc;font:400 13px ${F}">
  <div style="display:flex;align-items:center;gap:8px;padding:8px;direction:rtl"><div style="width:28px;height:28px;border-radius:50%;background:#bbb"></div><div><b>elad.grubner.photography</b><div style="color:#888;font-size:11px">ממומן</div></div></div>
  <img src="${u(src)}" style="width:${W}px;height:${FH}px;display:block">
  <div style="padding:8px;direction:rtl;color:#333">❤ 💬 ➤<div style="margin-top:4px;background:#25D366;color:#fff;text-align:center;padding:6px;border-radius:4px">שליחת הודעה בוואטסאפ</div></div></div>`;
const box = (title, inner) => `<div><div style="font:700 17px ${F};margin-bottom:8px;height:24px">${title}</div>${inner}</div>`;
const originals = (p, crops) => {
  const OH = crops.length > 2 ? 300 : 420;
  return `<div style="display:flex;gap:28px;margin-top:18px">${crops.map((c) => {
    const s = OH / c.H, w = Math.round(c.W * s);
    const r = (q, st) => `<div style="position:absolute;left:${q.x * s}px;top:${q.y * s}px;width:${q.w * s}px;height:${q.h * s}px;border:3px ${st} #e0262c;box-sizing:border-box"></div>`;
    return `<div style="width:${w}px"><div style="position:relative;width:${w}px;height:${OH}px">
      <img src="${u(c.path || join(p.src, c.file + '.jpg'))}" style="width:${w}px;height:${OH}px;display:block">${(c.feed.keepW < 100 || c.feed.keepH < 100 || c.story.keepW < 100 || c.story.keepH < 100) && c.feed.keepW < 99.5 ? r(c.feed, 'solid') + r(c.story, 'dashed') : ''}</div>
      <div style="font:700 15px ${F};margin-top:6px">${c.path && c.path.includes('/Designer/') ? 'Designer' : 'Interior'}/${c.file} · ${ROLE[c.role]}</div>
      <div style="font:400 14px ${F};color:#555;line-height:1.4">פיד: ${c.feed.keepW}% רוחב · ${c.feed.keepH}% גובה · סטורי: ${c.story.keepW}% רוחב · ${c.story.keepH}% גובה</div></div>`;
  }).join('')}</div>`;
};
const row = (p) => {
  const dir = join(NC, p.dir);
  const crops = JSON.parse(readFileSync(join(dir, 'source', 'crops.json'), 'utf8'));
  return `<div style="margin-top:40px;background:#F6F5F2;padding:20px 22px;border-radius:6px"><div style="font:800 26px ${F};margin-bottom:14px">${NAMES[p.dir] || p.dir}</div><div style="display:flex;gap:28px">
  ${box('סטורי וריל · הקובץ', `<img src="${u(join(dir, 'story-collage.jpg'))}" style="width:${W}px;height:${H}px;display:block;box-shadow:0 2px 8px rgba(0,0,0,.15)">`)}
  ${box('סטורי · בדיקת אזורים', zones(join(dir, 'story-collage.jpg')))}
  ${box('פיד · הקובץ (1080x1350)', `<img src="${u(join(dir, 'feed', 'collage-clean.jpg'))}" style="width:${W}px;height:${FH}px;display:block;box-shadow:0 2px 8px rgba(0,0,0,.15)">`)}
  ${box('פיד · כך זה ייראה בטלפון', phone(join(dir, 'feed', 'collage-clean.jpg')))}
</div>
<div style="font:700 19px ${F};margin-top:22px">הצילומים המקוריים, שלמים · <span style="color:#e0262c">קו מלא</span> - מה שנשאר בפיד · <span style="color:#e0262c">מקווקו</span> - בסטורי · בלי מסגרת - הצילום נכנס שלם</div>
${originals(p, crops)}</div>`;
};
const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800&display=block">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#EDEBE7;width:1500px;font-family:${F};padding:36px 40px;color:#222}</style></head><body>
<div style="font:800 34px ${F}">הקולאז' הבא · גרסה 4 · חללים שלמים</div>
<div style="font:400 19px ${F};color:#555;margin-top:6px;line-height:1.5">א-ב: שני צילומי רוחב של החלל המרכזי מאותו פרויקט (למעלה צילום שלם, מתחת פס רחב מזווית אחרת). ג-ד: קולאז' מעורב - למעלה החלל המרכזי ברוחב מלא, למטה מימין חלל נוסף לרוחב, למטה משמאל צילום אורך שלם (דיטייל או המעצבת). אותו טקסט בסטורי כמו "קולאז' - נקי". לא עלה ל-Meta ולא לדף של אלעד.<br>
קרן טויטו וטלי נחמיאס (גרסה 3) - נפסלו ("סתם תמונות כאלה"), ונמצאות ב-<span style="direction:ltr;unicode-bidi:embed">_rejected/</span>.<br>
בבדיקת האזורים: <span style="color:#c22">אדום למעלה</span> - עד סוף השם של החשבון בטלפון (כ-200), והמקווקו הוא הגבול הזהיר של Meta (269) · <span style="color:#c22">אדום למטה</span> - מה שהכיתוב והכפתור מכסים בריל. ב-א-ב הצילום הגדול נגמר ב-1250 (כולו מעל הקו), ב-ג-ד ב-1382 (רק הרצפה מתחת לקו).</div>
${projects.map(row).join('')}
<div style="height:30px"></div></body></html>`;
const hp = join(TMP, 'next-sheet.html'); writeFileSync(hp, html);
const png = join(TMP, 'next-sheet.png');
const HGT = 300 + projects.length * 1240;
execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=20000', `--window-size=1500,${HGT}`, `--screenshot=${png}`, u(hp)], { stdio: 'ignore' });
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', OUT]);
console.log('ok', OUT);
