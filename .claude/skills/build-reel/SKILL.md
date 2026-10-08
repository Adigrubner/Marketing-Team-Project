---
name: build-reel
description: בונה רילס (MP4 אנכי 1080x1920) מתמונות סטילס בגוגל דרייב, לפי קובץ הוראות reel.json בתיקיית הפוסט. שלושה סגנונות - motion (תנועת מצלמה), soft (מעבר רך), sharp (חיתוך חד). להפעיל אחרי שבוחרת התמונות כתבה reel.json.
---

# בניית רילס

```bash
node .claude/skills/build-reel/build-reel.js "<תיקיית הפוסט>/reel.json"
```
הפלט: `reel.mp4` באותה תיקייה. דורש ffmpeg (`winget install --id Gyan.FFmpeg -e`).

## reel.json - מי כותבת ומה בו
**בוחרת התמונות** כותבת אותו לצד `selection.md`. דוגמה מלאה: `clients/Elad Grubner Photography/content/posts/2026-10-11-anat-weissberg-reels/reel.json`.

| שדה | ערכים |
|-----|-------|
| `style` | `motion` · `soft` · `sharp` - **לגוון בין רילסים** (ראי `playbook.md` של הלקוח) |
| `frames[].id` | מזהה הקובץ בדרייב |
| `frames[].keep` | `center` / `left` / `right` - איזה צד לשמור בחיתוך ל-9:16 |
| `frames[].motion` | רק ב-motion: `zin` זום פנימה · `zout` זום החוצה · `panR`/`panL` תנועה לרוחב שנעצרת בצד ימין/שמאל |
| `frames[].duration` | אופציונלי. ברירת מחדל: פתיחה 2.0 · רגיל 2.8 · סגירה 4.0 שניות |
| `frames[].blur` | אופציונלי - אזורים לטשטוש (פרטיות), בפיקסלים של המקור |

**קצב:** לאט - התמונות הן המוצר. רילס ארוך מ-35 שניות → מורידים פריימים, לא מקצרים שהייה.
**מוזיקה:** לא נצרבת בקובץ. נוספת מהספרייה של אינסטגרם בזמן התזמון במטריקול.
