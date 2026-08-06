# בְּתֵאָבוֹן 🍽️

יומן ארוחות בעברית עם חישוב ערכים תזונתיים — פרוטוטייפ ב־React + Vite.

הנתונים נשמרים מקומית בדפדפן (`localStorage`), ללא שרת וללא מסד נתונים.
חישוב הערכים נעשה ידנית: האפליקציה מייצרת פרומפט שאתם מעתיקים למנוע AI חיצוני,
ומדביקים בחזרה את התשובה — **ללא שימוש במפתח API**.

---

## הרצה מקומית

```bash
npm install
npm run dev
```

הפרויקט ייפתח בכתובת שמופיעה בטרמינל (בדרך כלל http://localhost:5173).

לבנייה מקומית:

```bash
npm run build     # יוצר תיקיית dist/
npm run preview   # תצוגה מקדימה של הבנייה
```

---

## העלאה ל־GitHub Pages

### שלב 1 — יצירת מאגר והעלאת הקוד

```bash
git init
git add .
git commit -m "בתיאבון - גרסה ראשונה"
git branch -M main
git remote add origin https://github.com/<שם-המשתמש>/<שם-המאגר>.git
git push -u origin main
```

### שלב 2 — הפעלת Pages

1. במאגר ב־GitHub: **Settings → Pages**.
2. תחת **Build and deployment → Source**, בחרו **GitHub Actions**.

זהו. ה־workflow שנמצא ב־`.github/workflows/deploy.yml` יבנה ויפרסם את האתר
אוטומטית בכל `push` ל־`main`. בסיום תמצאו את הכתובת תחת **Settings → Pages**
(בדרך כלל `https://<שם-המשתמש>.github.io/<שם-המאגר>/`).

> אין צורך להגדיר `base` ידנית — הפרויקט משתמש בנתיבים יחסיים (`base: "./"`),
> כך שהוא עובד תחת כל שם מאגר.

### חלופה — פרסום ידני

אם מעדיפים לא להשתמש ב־Actions:

```bash
npm run deploy
```

הפקודה בונה את הפרויקט ודוחפת את `dist/` לענף `gh-pages`.
לאחר מכן, ב־**Settings → Pages** בחרו **Deploy from a branch → gh-pages**.

---

## מבנה הפרויקט

```
beteavon/
├─ index.html              # נקודת הכניסה + טעינת פונט Heebo
├─ vite.config.js          # הגדרות Vite (base יחסי ל־Pages)
├─ package.json
├─ .github/workflows/
│  └─ deploy.yml           # פרסום אוטומטי ל־Pages
└─ src/
   ├─ main.jsx             # אתחול React
   ├─ App.jsx              # כל האפליקציה (מסכים, זרימת הוספה, לוח שנה)
   ├─ storage.js           # שכבת הנתונים היחידה (localStorage)
   └─ styles.css           # עיצוב גלובלי
```

---

## מעבר לשרת בעתיד

כל הגישה לנתונים מרוכזת ב־`src/storage.js`. כדי לעבור למסד נתונים אמיתי
(למשל ASP.NET Core + SQLite) ולאפשר גישה מכמה מכשירים — צריך להחליף רק את
`loadData` ו־`saveData` בקריאות לשרת, בלי לגעת במסכים.
