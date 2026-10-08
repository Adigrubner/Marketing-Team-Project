/**
 * הדוח השבועי של אלעד - שליחה אוטומטית במייל
 * ------------------------------------------------
 * רץ בחשבון הגוגל של עדי (script.google.com), כל ראשון בין 07:00 ל-08:00.
 * קורא את weekly-email.html שהאנליסטית כתבה לדרייב ושולח אותו לאלעד, עם עותק לעדי.
 *
 * הגנה: אם הקובץ לא מהיום (המחשב היה כבוי, ההרצה נכשלה) - אלעד לא מקבל כלום,
 * ועדי מקבלת התראה במקום.
 *
 * הגדרה חד-פעמית:
 *   1. להדביק את כל הקובץ הזה בפרויקט חדש ב-script.google.com
 *   2. FOLDER_ID כבר מולא. התיקייה בדרייב של אלעד - אם הסקריפט רץ בחשבון אחר, לשתף איתו את התיקייה
 *   3. להריץ את sendTestToMe פעם אחת → לאשר הרשאות → לבדוק את המייל שהגיע
 *   4. להריץ את createWeeklyTrigger פעם אחת
 */

const FOLDER_ID = '1ne_cEXZckyT1q2ks9K2rDgxQ0STZo85N'; // התיקייה "_דוחות אלעד" (בדרייב של אלעד)
const FILE_NAME = 'weekly-email.html';
const ELAD = 'grubnerelad@gmail.com';
const TIMEZONE = 'Asia/Jerusalem';
const SENDER_NAME = 'הדוח השבועי - אינסטגרם';

// ההרצה האוטומטית של ראשון בבוקר
function sendWeeklyReport() {
  const me = Session.getEffectiveUser().getEmail();
  const report = readReport_();

  if (!report) {
    MailApp.sendEmail(me, 'הדוח של אלעד לא נמצא', 'הקובץ ' + FILE_NAME + ' לא נמצא בתיקייה. אלעד לא קיבל מייל השבוע.');
    return;
  }
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  if (report.date !== today) {
    MailApp.sendEmail(me, 'הדוח של אלעד לא נוצר השבוע',
      'הקובץ בדרייב הוא מ-' + (report.date || 'תאריך לא ידוע') + ' ולא מהיום (' + today + ').\n' +
      'אלעד לא קיבל מייל, כדי לא לשלוח לו דוח ישן.\n' +
      'כנראה ההרצה של 06:00 לא רצה (מחשב כבוי / Claude סגור). אפשר להריץ אותה ידנית ואז להריץ כאן את sendWeeklyReport.');
    return;
  }
  MailApp.sendEmail({ to: ELAD, cc: me, subject: report.subject, htmlBody: report.html, name: SENDER_NAME });
}

// בדיקה: שולח את הדוח הנוכחי רק אלייך, בלי בדיקת תאריך
function sendTestToMe() {
  const me = Session.getEffectiveUser().getEmail();
  const report = readReport_();
  if (!report) throw new Error('הקובץ ' + FILE_NAME + ' לא נמצא בתיקייה ' + FOLDER_ID);
  MailApp.sendEmail({ to: me, subject: '[בדיקה] ' + report.subject, htmlBody: report.html, name: SENDER_NAME });
}

// טריגר שבועי: ראשון, בחלון 07:00-08:00 שעון ישראל
function createWeeklyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendWeeklyReport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendWeeklyReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(7)
    .inTimezone(TIMEZONE)
    .create();
}

function readReport_() {
  const files = DriveApp.getFolderById(FOLDER_ID).getFilesByName(FILE_NAME);
  if (!files.hasNext()) return null;
  const html = files.next().getBlob().getDataAsString('UTF-8');
  const date = (html.match(/<meta name="report-date" content="([^"]+)"/) || [])[1] || null;
  const subject = ((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || 'הדוח השבועי - אינסטגרם')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return { html: html, date: date, subject: subject };
}
