// npm run doctor - בודק שהכל מחובר ותקין, ואומר בעברית מה לתקן.
// בטוח להריץ תמיד: קורא בלבד, לא יוצר ולא משנה כלום.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, readSafety, ROOT, ok, bad, warn, info, title } from './lib/env.js';
import { graphGet } from './lib/meta.js';

let problems = 0;
const fix = (msg) => { problems++; info(`   🔧 איך מתקנים: ${msg}`); };

title('בדיקת מערכת - מכונת הקמפיינים');

// 1. Node
const major = Number(process.versions.node.split('.')[0]);
if (major >= 20) ok(`Node ${process.versions.node} - תקין`);
else { bad(`Node ${process.versions.node} - ישן מדי`); fix('מתקינים Node 20 ומעלה (שיעור 1.2)'); }

// 2. קבצי הבסיס
for (const f of ['CLAUDE.md', 'config/safety.json', 'clients']) {
  if (existsSync(join(ROOT, f))) ok(`${f} - קיים`);
  else { bad(`${f} - חסר!`); fix('נראה שחסרים קבצים מה-Starter - הורידו אותו מחדש או שחזרו מ-Checkpoint'); }
}

// 3. בלם החירום
try {
  const s = readSafety();
  if (Number.isFinite(s.maxDailyBudgetIls) && s.maxDailyBudgetIls > 0) {
    ok(`בלם החירום פעיל - תקרת תקציב יומית: ${s.maxDailyBudgetIls}₪`);
  } else {
    bad('config/safety.json - תקרת התקציב לא מוגדרת כמספר תקין');
    fix('ודאו ש-maxDailyBudgetIls הוא מספר, למשל 100');
  }
} catch (e) {
  bad(`config/safety.json - לא נקרא (${e.message})`);
  fix('שחזרו את הקובץ מה-Starter');
}

// 4. לקוחות
const clientsDir = join(ROOT, 'clients');
const clients = existsSync(clientsDir)
  ? readdirSync(clientsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== '_template')
      .map((d) => d.name)
  : [];
if (clients.length === 0) warn('עדיין אין תיקיית לקוח - נקים אותה בשיעור 2.4 (זה בסדר בשלב הזה)');
else ok(`לקוחות מוגדרים: ${clients.join(', ')}`);

// 5. הכספת (.env)
const hasEnv = loadEnv();
if (!hasEnv) {
  warn('אין עדיין קובץ .env - יוקם בשיעור 4.2 (זה בסדר עד אז)');
} else {
  ok('קובץ .env קיים');
}

// 6. OpenAI (חלק 4)
if (!process.env.OPENAI_API_KEY) {
  warn('OPENAI_API_KEY עוד לא מוגדר - הקריאייטיבית תתחבר בשיעור 4.2');
} else {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    if (res.ok) ok('OpenAI - המפתח תקין, הקריאייטיבית מחוברת');
    else { bad(`OpenAI - המפתח נדחה (HTTP ${res.status})`); fix('בדקו שהעתקתם את המפתח במלואו, או צרו מפתח חדש (שיעור 4.2)'); }
  } catch { bad('OpenAI - אין תקשורת'); fix('בדקו חיבור אינטרנט ונסו שוב'); }
}

// 7. Meta (חלק 5)
const metaKeys = ['META_ADS_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID'];
const missingMeta = metaKeys.filter((k) => !process.env[k]);
if (missingMeta.length === metaKeys.length) {
  warn('חיבור Meta עוד לא הוגדר - נעשה את זה יחד בחלק 5');
} else if (missingMeta.length) {
  bad(`חיבור Meta חלקי - חסרים: ${missingMeta.join(', ')}`);
  fix('השלימו את הערכים החסרים ב-.env לפי שיעורי חלק 5');
} else {
  try {
    const acct = await graphGet(`act_${process.env.META_AD_ACCOUNT_ID}`, { fields: 'name,account_status,currency' });
    ok(`חשבון המודעות מחובר: "${acct.name}" (מטבע: ${acct.currency})`);
    if (acct.account_status !== 1) { bad('שימו לב: חשבון המודעות אינו במצב פעיל'); fix('בדקו את סטטוס החשבון ב-Ads Manager (חיוב/אימות)'); }
    const page = await graphGet(process.env.META_PAGE_ID, { fields: 'name' });
    ok(`הדף מחובר: "${page.name}"`);
    if (process.env.META_PIXEL_ID) {
      try {
        const px = await graphGet(process.env.META_PIXEL_ID, { fields: 'name' });
        ok(`הפיקסל מחובר: "${px.name}"`);
      } catch { warn('הפיקסל לא נגיש לטוקן - בדקו הצמדת נכסים (שיעור 5.4). לא חוסם יצירת מודעות.'); }
    } else {
      warn('META_PIXEL_ID לא מוגדר - לא חובה, אבל מומלץ למדידת המרות');
    }
  } catch (e) {
    bad(`חיבור Meta נכשל: ${e.message}`);
    fix('לרוב זו בעיית טוקן או הצמדת נכסים - חזרו על שיעורים 5.3-5.4, או הדביקו את השגיאה הזו לקלוד');
  }
}

// סיכום
title('סיכום');
if (problems === 0) {
  console.log('🎉 הכל תקין! המכונה מוכנה לעבודה.');
} else {
  console.log(`נמצאו ${problems} דברים לתקן (מסומנים ב-❌ למעלה, עם הסבר איך).`);
  console.log('טיפ: אפשר פשוט להדביק את כל הפלט הזה לקלוד ולבקש "תעזור לי לתקן".');
}
