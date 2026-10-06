---
name: schedule-post
description: תזמון תוכן אורגני (פוסט, קרוסלה, רילס, סטורי, עדכון בגוגל עסקים) לרשתות החברתיות דרך Metricool - בדיקה, תצוגה מקדימה, אישור, שליחה כטיוטה ותיעוד. השתמשו כשצריך להעלות/לתזמן תוכן אורגני, למלא לוח תוכן או לבדוק מה כבר מתוזמן.
---

# תזמון פוסט אורגני ב-Metricool

הכלים: שרת ה-MCP של Metricool (`mcp__Metricool_Social_Media_Management__*`).
ההגדרות של כל לקוח: `clients/<לקוח>/publishing.json`.

## מבנה התוכן בתיקייה
כל פוסט יושב בתיקייה משלו: `clients/<לקוח>/organic/<YYYY-MM-DD>-<שם-קצר>/post.json`
(דוגמה מלאה: `clients/_template/organic/post.example.json`).
אחרי שליחה - מוסיפים שורה ל-`clients/<לקוח>/organic/publish-log.md`.

## שלב 1 - בדיקה (לפני שמראים משהו למשתמש)
עברי על כל `post.json` ובדקי:
- **מדיה:** אינסטגרם חייב תמונה/קרוסלה/וידאו; רילס וסטורי-וידאו חייבים וידאו; פייסבוק רילס חייב וידאו.
  Metricool מקבל רק **קישורים ציבוריים** (או Google Drive/Dropbox) - לא קבצים מהמחשב. יש רק קובץ מקומי? בקשי מהמשתמש להעלות לדרייב/דרופבוקס ולהדביק קישור.
- **תאריך:** לא בעבר. אין שעה? `getBestTimeToPostByNetwork` (טווח של עד שבוע, אזור הזמן מ-`publishing.json`) - והציעי את השעה הטובה ביותר.
- **התנגשויות:** `getScheduledPosts` לאותו טווח - אם יש כבר פוסט באותו יום ובאותה רשת, ציינו זאת בטבלה.
- **חוקי התוכן** (מ-`brief.md`, `style.md` ו-`publishing.json`): אישור מעצבת + קרדיט, בלי מחירים, בלי פרטים מזהים של הבית, בלי הבטחות לתוצאות, מקף רגיל בלבד, פנייה מגדר-נייטרלית.
- **גוגל עסקים** (`gmb`): "publication" = טקסט עד 1500 תווים; "photo" = מדיה בלי טקסט. לא בטוח איזה? שאלי.
משהו לא עובר? אל תתקני תוכן בעצמך - דווחי מה חסר ולמי זה שייך (קופי/קריאייטיב/המשתמש).

## שלב 2 - תצוגה מקדימה (ה-"dry-run" של האורגני)
הציגי טבלה אחת לכל הסבב:

| # | רשת | סוג | מתי (שעון ישראל) | טקסט (מלא) | מדיה | הערות |
|---|-----|-----|------------------|-------------|------|-------|

ומתחתיה במשפט: "זה יישלח ל-Metricool כ**טיוטה** בחשבון <label>. לאשר?"
**עוצרים כאן ומחכים לאישור מפורש.** "נראה טוב" על חלק מהפוסטים = שולחים רק אותם.

## שלב 3 - שליחה
`createScheduledPost` עם `blogId` מ-`publishing.json`. מבנה `info` (JSON כמחרוזת):
```json
{
  "text": "...",
  "providers": [{"network": "instagram"}, {"network": "facebook"}],
  "publicationDate": {"dateTime": "2026-10-12T19:00:00", "timezone": "Asia/Jerusalem"},
  "draft": true,
  "autoPublish": true,
  "media": ["https://..."],
  "mediaAltText": [],
  "firstCommentText": "",
  "descendants": [],
  "shortener": false,
  "smartLinkData": {"ids": []},
  "hasNotReadNotes": false,
  "instagramData": {"type": "POST", "collaborators": [], "isAiGenerated": false},
  "facebookData": {"type": "POST"}
}
```
- `draft: true` תמיד, אלא אם המשתמש ביקש במפורש תזמון אמיתי בבקשה הזו (ראו חוקי הבלם אצל רכזת הפרסום).
- `networkData` רק לרשתות שב-`providers`. **אף פעם** לא שדות `boost`.
- הרשת `gmb` צריכה `"gmbData": {"type": "publication"}` או `"photo"`.
- שגיאה מ-Metricool? מעבירים אותה למשתמש כמו שהיא, בעברית, ולא מנסים שוב עם טקסט "מתוקן" בלי לשאול.

## שלב 4 - תיעוד ודיווח
1. שורה ב-`organic/publish-log.md`: תאריך שליחה | פוסט | רשתות | מועד מתוכנן | טיוטה/מתוזמן | `plannerUrl`.
2. ב-`post.json`: `"status": "sent-draft"` (או `"scheduled"`) + `"plannerUrl"`.
3. למשתמש: מה נשלח, קישורים, ו"מה נשאר לך לעשות": לפתוח את הטיוטות ב-Metricool, לבדוק, וללחוץ "תזמן".

## בקשות נוספות
- **"מה מתוזמן?"** → `getScheduledPosts` (קריאה בלבד) והצגה בטבלה לפי ימים.
- **"תשני פוסט מתוזמן"** → `getScheduledPosts`, הצגת "לפני / אחרי", אישור, ואז `updateScheduledPost` עם **כל** התוכן המקורי ורק השינוי המבוקש.
- **מחיקה** → אין. מפנים את המשתמש למחוק ידנית ב-Metricool.
