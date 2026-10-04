# تطبيق أثر وإدارته

أضيف تطبيق iOS وخدمات الربط وإدارة المتجر والمسابقات إلى هذا المستودع. راجع [دليل الربط والتشغيل](docs/ATHAR_LAUNCH_AR.md). الإدارة: `/admin/athar` بعد تسجيل دخول المشرف.

# نقاط الأثر - Athr Points

نظام حوافز سفراء جمعية مدكر لتحفيظ القرآن الكريم.

## التقنيات
- Node.js + Express
- EJS (server-side views)
- MongoDB + Mongoose
- express-session + connect-mongo
- node-cron
- bcryptjs

## التشغيل
```bash
npm install
npm start
```
افتح: http://localhost:3000

## متغيرات البيئة (.env)
- `PORT` (3000)
- `MONGO_URI`
- `SESSION_SECRET`
- `ADMIN_PHONE` / `ADMIN_PASSWORD` (يُنشأ الأدمن تلقائياً)

## الصفحات
- `/` — الرئيسية
- `/signup` — تسجيل سفير
- `/login` — دخول سفير
- `/ambassador/home` — الصفحة الترحيبية + بروقرس بار
- `/ambassador/prizes` — صرف الجوائز
- `/admin/login` — دخول الإدارة
- `/admin/dashboard` — لوحة الإحصائيات
- `/admin/requests` — متابعة الطلبات
- `/r/:code` — **رابط السفير: يسجّل الدخول تلقائياً بحساب السفير ويحوّل إلى `/ambassador/home`**

## API
- `GET /ambassador/me`, `GET /ambassador/requests`, `POST /ambassador/requests`
- `GET /admin/stats`, `GET /admin/requests-api`, `POST /admin/requests/:id/approve|reject`
- `GET /api/donations/:referralCode` — **بيانات تبرعات وهمية**، عدّل `MOCK_DONATIONS` في [routes/api.js](routes/api.js).
