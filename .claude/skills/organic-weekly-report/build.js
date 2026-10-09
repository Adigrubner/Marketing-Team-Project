// Builds the weekly page + email from one data file.
// Usage: node build.js <data.json> <page-out.html> [email-out.html]
// The page is the Artifact Elad opens; the email is picked up by Adi's Google Apps Script and sent.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [, , dataPath, pageOut, emailOut] = process.argv;
if (!dataPath || !pageOut) {
  console.error('Usage: node build.js <data.json> <page-out.html> [email-out.html]');
  process.exit(1);
}

const D = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
for (const k of ['weekStart', 'weekEnd', 'reportDate', 'headline']) {
  if (!D[k]) { console.error(`Missing field in data: ${k}`); process.exit(1); }
}

// ---- all weeks (archive) + starting point ----
// Every data file in the same folder becomes a week in the page's selector, newest first.
// Trial runs ("trial": true) are left out of the archive unless they are the week being built.
const dataDir = path.dirname(path.resolve(dataPath));
const weeks = fs.readdirSync(dataDir)
  .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map(f => path.resolve(dataDir, f) === path.resolve(dataPath) ? D : JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')))
  .filter(w => w === D || !w.trial)
  .sort((x, y) => (y.reportDate || '').localeCompare(x.reportDate || ''));
const startFile = path.join(dataDir, '..', 'start-point.json');
const start = fs.existsSync(startFile) ? JSON.parse(fs.readFileSync(startFile, 'utf8')) : null;
if (start) delete start.historySeed;

// ---- page ----
const template = fs.readFileSync(path.join(__dirname, 'page-template.html'), 'utf8');
const json = JSON.stringify({ weeks, start }).replace(/</g, '\\u003c');
fs.writeFileSync(pageOut, template.replace('__REPORT_DATA__', () => json), 'utf8');
console.log('page  ->', pageOut);

// ---- email ----
if (emailOut) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => (v == null || v === '' ? '–' : Number(v).toLocaleString('he-IL'));
  const dm = iso => { const p = iso.split('-'); return `${Number(p[2])}.${Number(p[1])}`; };
  const pct = v => (v == null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}%`);
  const a = D.account || {}, w = D.week || {};
  const subject = `הדוח השבועי - אינסטגרם · ${dm(D.weekStart)}-${dm(D.weekEnd)}`;
  const ink = '#2A2A2A', ink2 = '#5E5850', muted = '#8C857B', bronze = '#7B5A2E', panel = '#F2EEE8', line = '#E6E0D7', bg = '#FBFAF8';
  const good = '#3F6B4A', goodBg = '#E3EDE4', bad = '#9A4A2F', badBg = '#F3E2DA';
  const font = "font-family:Assistant,'Segoe UI',Arial,Helvetica,sans-serif;";
  const chip = v => {
    if (v == null) return '';
    const [c, b] = v >= 10 ? [good, goodBg] : v <= -10 ? [bad, badBg] : [ink2, panel];
    return `<span dir="ltr" style="${font}display:inline-block;font-size:12px;font-weight:700;color:${c};background:${b};padding:1px 8px;border-radius:999px;">${pct(v)}</span>`;
  };
  const h2 = t => `<tr><td style="${font}font-size:21px;font-weight:300;color:${ink};padding:30px 0 10px;">${t}</td></tr>`;

  const kpi = (label, value, sub) =>
    `<td width="25%" style="padding:4px;vertical-align:top;">
      <div style="background:#FFFFFF;border:1px solid ${line};border-radius:12px;padding:14px 12px;">
      <div style="${font}font-size:12px;font-weight:700;color:${muted};">${label}</div>
      <div style="${font}font-size:30px;font-weight:200;color:${ink};line-height:1.25;">${value}</div>
      <div style="${font}font-size:12px;color:${muted};min-height:16px;">${sub}</div></div></td>`;

  const posts = (D.posts || []).map(p => `
    <tr><td style="padding:4px 0;">
      <div style="background:#FFFFFF;border:1px solid ${line};border-radius:12px;padding:14px 16px;${font}">
      <div style="font-size:15px;font-weight:700;color:${ink};">${p.url ? `<a href="${esc(p.url)}" style="color:${ink};text-decoration:none;">${esc(p.title)}</a>` : esc(p.title)}</div>
      <div style="font-size:13px;color:${muted};padding-bottom:8px;">${dm(p.date)}${p.time ? ' · ' + esc(p.time) : ''} · ${esc(p.format)}${p.young ? ' · עוד צובר נתונים' : ''}</div>
      <div style="font-size:14px;color:${ink2};"><b style="font-size:17px;color:${ink};">${n(p.reach)}</b> חשיפה &nbsp;${chip(p.vsAvg)}&nbsp;&nbsp;·&nbsp; ${n(p.saves)} שמירות · ${n(p.shares)} שיתופים · ${n(p.comments)} תגובות</div>
      </div></td></tr>`).join('');

  const yn = (v, yes, no) => (v === true ? yes : v === false ? no : null);
  const designers = (D.designers || []).map(g => {
    const facts = [
      yn(g.commented, 'הגיבה', 'לא הגיבה'), yn(g.storyShare, 'שיתפה בסטורי', null), yn(g.collab, 'Collab אושר', null),
      g.comments != null ? `${n(g.comments)} תגובות${g.otherComments != null ? ` (${n(g.otherComments)} של אחרים)` : ''}` : null,
    ].filter(Boolean).join(' · ');
    return `
    <tr><td style="padding:4px 0;">
      <div style="background:#FFFFFF;border:1px solid ${line};border-radius:12px;padding:14px 16px;${font}">
      <div style="font-size:15px;font-weight:700;color:${ink};">${esc(g.rating || '')} ${esc(g.name)}${g.post ? ` <span style="font-weight:400;font-size:13px;color:${muted};">· ${esc(g.post)}</span>` : ''}</div>
      <div style="font-size:14px;color:${ink2};padding-top:4px;">${esc(facts)} ${chip(g.commentsVsAvg)}</div>
      ${g.note ? `<div style="font-size:13.5px;color:${ink2};padding-top:4px;">${esc(g.note)}</div>` : ''}
      </div></td></tr>`;
  }).join('');

  const sugg = (D.suggestions || []).map((s, i) => `
    <tr><td style="padding:4px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid ${line};border-radius:12px;"><tr>
        <td width="44" style="padding:14px 14px 14px 0;vertical-align:top;"><div style="${font}width:36px;height:36px;line-height:36px;text-align:center;border-radius:10px;background:${ink};color:${bg};font-size:18px;font-weight:300;">${i + 1}</div></td>
        <td style="padding:14px 12px 14px 16px;vertical-align:top;${font}">
          <div style="font-size:15px;color:${ink};line-height:1.5;">${esc(s.text)}</div>
          ${s.owner ? `<div style="font-size:12.5px;color:${muted};padding-top:2px;">מי מיישמת: <b style="color:${bronze};">${esc(s.owner)}</b></div>` : ''}
        </td></tr></table></td></tr>`).join('');

  // trends: last week vs 4 weeks earlier, and vs the starting point
  const H = (D.history || []).slice(-12);
  const lastH = H[H.length - 1] || {};
  const change = (from, to) => (from == null || to == null ? null : from === 0 ? (to > 0 ? 'מ-0' : 0) : from > 0 && to / from >= 2 ? `פי ${(to / from).toLocaleString('he-IL', { maximumFractionDigits: to / from < 10 ? 1 : 0 })}` : (to - from) / Math.abs(from) * 100);
  const chipC = v => (typeof v === 'string' ? `<span style="${font}display:inline-block;font-size:12px;font-weight:700;color:${good};background:${goodBg};padding:1px 8px;border-radius:999px;">↑ ${v}</span>` : chip(v));
  const nd = (v, dec) => (v == null ? '–' : Number(v).toLocaleString('he-IL', { maximumFractionDigits: dec }));
  const trendRows = [
    ['חשיפה לפוסט', 'avgReach', 0], ['שמירות ושיתופים לפוסט', 'avgSavesShares', 2], ['תגובות לפוסט', 'avgComments', 1], ['עוקבים', 'followers', 0],
  ].map(([label, key, dec]) => {
    const now = key === 'followers' ? (a.followers ?? lastH.followers) : lastH[key];
    if (now == null) return '';
    let ref = null;
    for (let i = H.length - 2; i >= 0; i--) if (H[i][key] != null && H.length - 1 - i >= 4) { ref = H[i]; break; }
    const vsMonth = ref ? `${chipC(change(ref[key], now))} <span style="color:${muted};">מול ${dm(ref.weekStart)}</span>` : '';
    const vsStart = start && start[key] != null ? `${chipC(change(start[key], now))} <span style="color:${muted};">מאז שהתחלנו (${nd(start[key], dec)})</span>` : '';
    return `<tr><td style="padding:9px 0;border-bottom:1px solid ${line};${font}font-size:14px;color:${ink2};">
      <b style="color:${ink};">${label}: ${nd(now, dec)}</b><br>${[vsMonth, vsStart].filter(Boolean).join(' &nbsp;·&nbsp; ')}</td></tr>`;
  }).join('');
  const trends = trendRows ? `${h2('המגמות')}<tr><td style="background:#FFFFFF;border:1px solid ${line};border-radius:12px;padding:6px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trendRows}</table></td></tr>` : '';

  const fc = a.followersChange;
  const html = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="report-date" content="${esc(D.reportDate)}">
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@200;300;400;700&display=swap" rel="stylesheet">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="max-width:620px;text-align:right;">
  <tr><td style="background:${panel};border-radius:16px;padding:28px 26px 24px;${font}">
    <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:${bronze};direction:ltr;text-align:right;">ELAD GRUBNER · INSTAGRAM</div>
    <div style="font-size:40px;font-weight:200;color:${ink};line-height:1.15;padding-top:8px;">הדוח השבועי</div>
    <div style="font-size:14px;font-weight:700;color:${ink2};padding:6px 0 14px;">${dm(D.weekStart)} – ${dm(D.weekEnd)}.${D.weekEnd.slice(0, 4)}</div>
    <div style="width:56px;border-top:1px solid ${bronze};font-size:0;line-height:0;">&nbsp;</div>
    <div style="font-size:19px;font-weight:300;line-height:1.55;color:${ink};padding-top:14px;">${esc(D.headline)}</div>
  </td></tr>
  <tr><td style="padding-top:14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${kpi('עוקבים', n(a.followers), fc == null ? '' : `${fc > 0 ? '+' : ''}${fc} השבוע`)}
    ${kpi('חשיפה לפוסט', n(w.avgReach), `${chip(w.avgReachVsBaseline)} מול הממוצע`)}
    ${kpi('שמירות ושיתופים', n(w.savesShares), '')}
    ${kpi('פוסטים', n(w.posts), '')}
  </tr></table></td></tr>
  ${trends}
  ${posts ? `${h2('הפוסטים של השבוע')}${posts}` : ''}
  ${designers ? `${h2('המעצבות שתויגו')}${designers}` : ''}
  ${D.referencesSummary ? `${h2('אצל צלמי הרפרנס')}
  <tr><td style="background:${panel};border-radius:12px;padding:16px 18px;${font}font-size:15px;line-height:1.6;color:${ink};">${esc(D.referencesSummary)}</td></tr>` : ''}
  ${sugg ? `${h2('מה כדאי לנסות')}${sugg}` : ''}
  ${D.pageUrl ? `<tr><td align="center" style="padding:30px 0 6px;"><a href="${esc(D.pageUrl)}" style="${font}display:inline-block;background:${ink};color:${bg};text-decoration:none;font-size:15px;font-weight:700;padding:13px 28px;border-radius:999px;">לדוח המלא עם הגרפים</a></td></tr>` : ''}
  <tr><td align="center" style="${font}font-size:12px;color:${muted};padding-top:24px;">הדוח נוצר אוטומטית מנתוני מטריקול · אינסטגרם, אורגני בלבד</td></tr>
</table></td></tr></table>
</body></html>`;
  fs.mkdirSync(path.dirname(emailOut), { recursive: true });
  fs.writeFileSync(emailOut, html, 'utf8');
  console.log('email ->', emailOut, '| subject:', subject);
}
