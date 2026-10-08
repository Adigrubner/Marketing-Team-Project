#!/usr/bin/env node
// בונה רילס (MP4, 1080x1920) מתמונות סטילס לפי קובץ הוראות reel.json.
// שימוש: node build-reel.js <path/to/reel.json> [--out reel.mp4] [--crf 20]
//
// reel.json:
// {
//   "style": "motion" | "soft" | "sharp",
//   "fade": 0.5,                       // אופציונלי - משך המעבר (motion/soft)
//   "frames": [
//     { "id": "<Drive file id>", "label": "Interior/38",
//       "duration": 2.0,               // אופציונלי. ברירת מחדל: ראשון 2.0, אחרון 4.0, אחרים 2.8
//       "keep": "center" | "left" | "right",   // איזה צד לשמור בחיתוך ל-9:16
//       "motion": "zin" | "zout" | "panR" | "panL",  // רק בסגנון motion
//       "blur": [ { "x": 610, "y": 890, "w": 95, "h": 175 } ]   // אופציונלי, בפיקסלים של המקור
//     }
//   ]
// }

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

function findFfmpeg() {
  if (process.env.FFMPEG && fs.existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  const pkgs = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(pkgs)) {
    for (const d of fs.readdirSync(pkgs).filter(n => n.startsWith('Gyan.FFmpeg'))) {
      const root = path.join(pkgs, d);
      for (const sub of fs.readdirSync(root)) {
        const p = path.join(root, sub, 'bin', 'ffmpeg.exe');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (which.status === 0) return which.stdout.split(/\r?\n/)[0].trim();
  throw new Error('ffmpeg לא נמצא. להתקנה: winget install --id Gyan.FFmpeg -e');
}

function run(ff, args) {
  const r = spawnSync(ff, ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg נכשל:\n${r.stderr}`);
}

async function download(id, dest) {
  const url = `https://drive.google.com/uc?export=download&id=${id}`;
  const res = await fetch(url, { redirect: 'follow' });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok || buf.length < 2 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error(`ההורדה של ${id} לא החזירה JPEG - ייתכן שהקובץ לא משותף בקישור.`);
  }
  fs.writeFileSync(dest, buf);
}

function args(argv) {
  const o = { crf: 20 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') o.out = argv[++i];
    else if (argv[i] === '--crf') o.crf = Number(argv[++i]);
    else o.spec = argv[i];
  }
  if (!o.spec) throw new Error('שימוש: node build-reel.js <reel.json> [--out reel.mp4] [--crf 20]');
  if (!o.out) o.out = path.join(path.dirname(o.spec), 'reel.mp4');
  return o;
}

(async () => {
  const opt = args(process.argv.slice(2));
  const spec = JSON.parse(fs.readFileSync(opt.spec, 'utf8'));
  const style = spec.style || 'motion';
  const fade = style === 'sharp' ? 0 : (spec.fade ?? 0.5);
  const frames = spec.frames;
  if (!Array.isArray(frames) || frames.length < 2) throw new Error('צריך לפחות 2 פריימים.');
  const ff = findFfmpeg();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(opt.crf), '-pix_fmt', 'yuv420p', '-r', '30'];

  const durs = frames.map((f, i) => f.duration ?? (i === 0 ? 2.0 : i === frames.length - 1 ? 4.0 : 2.8));
  const clips = [];

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const img = path.join(work, `f${i}.jpg`);
    await download(f.id, img);
    const D = durs[i];
    const N = Math.round(D * 30);
    const W = 'ih*9/16';
    const keepX = { left: '0', right: `iw-${W}`, center: `(iw-${W})/2` }[f.keep || 'center'];

    let pre = '';
    if (f.blur && f.blur.length) {
      // מטשטש אזורים (פרטיות) לפני כל עיבוד אחר
      let chain = '[0:v]';
      f.blur.forEach((b, k) => {
        const out = k === f.blur.length - 1 ? '' : `[bb${k}]`;
        chain += `split[s${k}a][s${k}b];[s${k}b]crop=${b.w}:${b.h}:${b.x}:${b.y},boxblur=14:3[bl${k}];[s${k}a][bl${k}]overlay=${b.x}:${b.y}${out}`;
        if (out) chain += `;${out}`;
      });
      pre = chain + ',';
    }

    let vf;
    if (style === 'motion') {
      const m = f.motion || 'zin';
      if (m === 'zin' || m === 'zout') {
        const z = m === 'zin' ? `1+0.08*on/${N}` : `1.08-0.08*on/${N}`;
        vf = `${pre}crop=${W}:ih:${keepX}:0,scale=2160:3840,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30`;
      } else {
        // תנועה לרוחב: מגדילים פי 4 כדי שהתנועה תהיה חלקה, ונעצרים על הצד החשוב
        const x = m === 'panR' ? `(iw-${W})*t/${D}` : `(iw-${W})*(1-t/${D})`;
        vf = `${pre}scale=iw*4:ih*4,crop=${W}:ih:'${x}':0,scale=1080:1920`;
      }
    } else {
      vf = `${pre}crop=${W}:ih:${keepX}:0,scale=1080:1920:flags=lanczos`;
    }
    const clip = path.join(work, `c${String(i).padStart(2, '0')}.mp4`);
    run(ff, ['-loop', '1', '-framerate', '30', '-i', img, '-t', String(D), '-filter_complex', `${vf},setsar=1`, ...enc, clip]);
    clips.push(clip);
    process.stdout.write(`פריים ${i + 1}/${frames.length} ✓ ${f.label || f.id}\n`);
  }

  const inputs = clips.flatMap(c => ['-i', c]);
  let filter, total;
  if (fade > 0) {
    let L = durs[0]; let prev = '[0:v]'; const parts = [];
    for (let i = 1; i < clips.length; i++) {
      const lab = i === clips.length - 1 ? '[out]' : `[x${i}]`;
      parts.push(`${prev}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${(L - fade).toFixed(3)}${lab}`);
      prev = `[x${i}]`; L += durs[i] - fade;
    }
    filter = parts.join(';'); total = L;
  } else {
    filter = clips.map((_, i) => `[${i}:v]`).join('') + `concat=n=${clips.length}:v=1:a=0[out]`;
    total = durs.reduce((a, b) => a + b, 0);
  }
  run(ff, [...inputs, '-filter_complex', filter, '-map', '[out]', ...enc, '-movflags', '+faststart', opt.out]);
  const mb = (fs.statSync(opt.out).size / 1048576).toFixed(1);
  console.log(`\nרילס מוכן: ${opt.out}\nסגנון: ${style} · ${frames.length} פריימים · ${total.toFixed(1)} שניות · ${mb}MB`);
  fs.rmSync(work, { recursive: true, force: true });
})().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
