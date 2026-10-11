/**
 * הדוח השבועי של אלעד - שליחה אוטומטית במייל
 * ------------------------------------------------
 * רץ בחשבון הגוגל של עדי (script.google.com), כל שעה (11.10.2026 - במקום חלון קבוע של 07:00-08:00).
 * ביום ראשון, מ-07:00 ועד 21:00: בודק אם weekly-email.html בדרייב הוא מהיום.
 * ברגע שכן - שולח אותו לאלעד (עותק לעדי), פעם אחת בלבד. ככה גם אם המחשב נדלק מאוחר
 * והדוח נוצר ב-10:00, המייל יוצא לבד תוך שעה.
 *
 * הגנה: אלעד אף פעם לא מקבל דוח ישן. אם עד 21:00 בראשון לא נוצר דוח של היום -
 * עדי מקבלת התראה אחת, ואלעד לא מקבל כלום.
 *
 * הגדרה חד-פעמית (או החלפת גרסה קודמת):
 *   1. להדביק את כל הקובץ הזה בפרויקט ב-script.google.com (במקום הקוד הקודם)
 *   2. FOLDER_ID כבר מולא. התיקייה בדרייב של אלעד - אם הסקריפט רץ בחשבון אחר, לשתף איתו את התיקייה
 *   3. (בהתקנה ראשונה) להריץ את sendTestToMe פעם אחת → לאשר הרשאות → לבדוק את המייל שהגיע
 *   4. להריץ את createWeeklyTrigger פעם אחת. הוא מוחק את הטריגר הישן, יוצר טריגר שעתי,
 *      ואם כבר יש דוח של היום - מסמן אותו כ"נשלח" כדי שלא יישלח שוב.
 */

const FOLDER_ID = '1ne_cEXZckyT1q2ks9K2rDgxQ0STZo85N'; // התיקייה "_דוחות אלעד" (בדרייב של אלעד)
const FILE_NAME = 'weekly-email.html';
const ELAD = 'grubnerelad@gmail.com';
const TIMEZONE = 'Asia/Jerusalem';
const SENDER_NAME = 'הדוח השבועי - אינסטגרם';
const FIRST_HOUR = 7;  // מתי מתחילים לבדוק ביום ראשון
const LAST_HOUR = 21;  // אחרי השעה הזו - אם אין דוח, התראה לעדי

// רץ כל שעה. עושה משהו רק ביום ראשון בין FIRST_HOUR ל-LAST_HOUR
function sendWeeklyReport() {
  const now = new Date();
  const day = Utilities.formatDate(now, TIMEZONE, 'u'); // 7 = ראשון
  const hour = Number(Utilities.formatDate(now, TIMEZONE, 'H'));
  if (day !== '7' || hour < FIRST_HOUR) return;

  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');
  if (props.getProperty('lastSent') === today || props.getProperty('lastAlert') === today) return;

  const me = Session.getEffectiveUser().getEmail();
  const report = readReport_();

  if (report && report.date === today) {
    MailApp.sendEmail({ to: ELAD, cc: me, subject: report.subject, htmlBody: report.html, name: SENDER_NAME });
    props.setProperty('lastSent', today);
    return;
  }

  // עוד אין דוח של היום - מחכים לשעה הבאה, ורק בסוף היום מתריעים
  if (hour >= LAST_HOUR) {
    MailApp.sendEmail(me, 'הדוח של אלעד לא נוצר היום',
      (report ? 'הקובץ בדרייב הוא מ-' + (report.date || 'תאריך לא ידוע') : 'הקובץ ' + FILE_NAME + ' לא נמצא בתיקייה') +
      ' ולא מהיום (' + today + ').\n' +
      'אלעד לא קיבל מייל, כדי לא לשלוח לו דוח ישן.\n' +
      'כנראה ההרצה של 06:00 לא רצה (מחשב כבוי / Claude סגור / נתקעה על אישור). ' +
      'אפשר להריץ אותה ידנית ואז להריץ כאן את sendNow.');
    props.setProperty('lastAlert', today);
  }
}

// שליחה ידנית לאלעד עכשיו - רק אם הדוח מהיום, ובלי לשלוח פעמיים באותו יום
function sendNow() {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const report = readReport_();
  if (!report || report.date !== today) throw new Error('הדוח בדרייב לא מהיום (' + (report && report.date) + ') - לא נשלח');
  if (props.getProperty('lastSent') === today) throw new Error('הדוח של היום כבר נשלח לאלעד');
  MailApp.sendEmail({ to: ELAD, cc: Session.getEffectiveUser().getEmail(), subject: report.subject, htmlBody: report.html, name: SENDER_NAME });
  props.setProperty('lastSent', today);
}

// בדיקה: שולח את הדוח הנוכחי רק אלייך, בלי בדיקת תאריך
function sendTestToMe() {
  const me = Session.getEffectiveUser().getEmail();
  const report = readReport_();
  if (!report) throw new Error('הקובץ ' + FILE_NAME + ' לא נמצא בתיקייה ' + FOLDER_ID);
  MailApp.sendEmail({ to: me, subject: '[בדיקה] ' + report.subject, htmlBody: report.html, name: SENDER_NAME });
}

// טריגר שעתי (הפונקציה עצמה מחליטה אם זה ראשון ואם יש מה לשלוח)
function createWeeklyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendWeeklyReport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendWeeklyReport')
    .timeBased()
    .everyHours(1)
    .create();

  // דוח של היום כבר קיים (למשל נשלח ידנית) - לא לשלוח אותו שוב
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const report = readReport_();
  if (report && report.date === today) PropertiesService.getScriptProperties().setProperty('lastSent', today);
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
