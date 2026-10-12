# קופה — תקציב מול ביצוע, מוצפן

אפליקציית ווב אישית: ייבוא קבצי אשראי (ישראכרט/אמקס, כאל/דיינרס), הזנה ידנית של תנועות בנק, תקציב מול ביצוע, דוחות.

## אבטחה במשפט אחד
הסיסמה גוזרת בדפדפן מפתח AES-256 (PBKDF2-SHA256, 600,000 סבבים). השרת (Cloudflare Worker + Durable Object) מחזיק רק ciphertext ו-hash של מפתח הרשאה נפרד. אין שחזור סיסמה.

- 10 ניסיונות שגויים לשעה לכל IP, 50 בסך הכל — ואז נעילה לשעה.
- 30 גרסאות אחרונות נשמרות בשרת (מוצפנות).
- CSP קשיח: אין סקריפטים חיצוניים, אין inline, אין iframe.
- נעילה אוטומטית אחרי חוסר פעילות.

## פריסה (פעם אחת)
1. ריפו **פרטי** חדש ב-GitHub, להעלות אליו את התיקייה הזאת.
2. Settings → Secrets and variables → Actions → להוסיף:
   - `CLOUDFLARE_API_TOKEN` — טוקן עם הרשאת *Workers Scripts: Edit* (אפשר את אותו אחד של spmo-market-bridge)
   - `CLOUDFLARE_ACCOUNT_ID`
   - `SETUP_CODE` — מחרוזת אקראית כלשהי. נדרשת רק ביצירת הכספת, כדי שאף אחד לא "יתפוס" אותה לפניך.
3. Actions → deploy → Run workflow. הכתובת תהיה `https://kupa.<subdomain>.workers.dev`.
4. להיכנס, להזין את SETUP_CODE ולבחור סיסמה.

## פיתוח מקומי
```
npm i && npm run dev        # http://localhost:8787
npm run test:parsers -- path/to/export.xlsx
```
