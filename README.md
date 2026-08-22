<p align="center">
  <img src="public/uv.png" height="150" alt="Ultraviolet Logo">
</p>

<h1 align="center">وب‌پروکسی پیشرفته Ultraviolet (آماده استقرار روی Railway)</h1>

این پروژه یک وب‌پروکسی مدرن، پرسرعت و امن بر پایه **Ultraviolet (UV)**، پروتکل **Wisp** و لایه انتقال رمزنگاری‌شده **Epoxy Transport (WebAssembly)** است که به صورت اختصاصی برای اجرا و استقرار روی سرورهای **Railway** و دریافت دامنه رایگان HTTPS (`*.up.railway.app`) آماده‌سازی و پیکربندی شده است.

---

## 🌟 ویژگی‌های کلیدی

- **پروتکل ارتباطی Wisp**: استفاده از وب‌سوکت پرسرعت به جای پروکسی‌های سنتی با تاخیر پایین.
- **انتقال رمزنگاری‌شده Epoxy**: پشتیبانی از ترنسپورت وب‌اسمبلی رمزنگاری‌شده کلاینت به سرور.
- **Service Worker و انکودینگ هوشمند**: دور زدن فیلترینگ و ریدایرکت‌های مسدودساز بدون افشای URL اصلی.
- **پیکربندی خودکار برای Railway**: سازگاری کامل با متغیرهای محیطی `PORT` و اتصال خودکار سوکت امن `wss://`.
- **هدرهای ایزولاسیون مدرن**: فعال بودن `COOP: same-origin` و `COEP: require-corp` برای بالاترین کارایی SharedArrayBuffer.

---

## 🚀 راهنمای استقرار روی Railway (مرحله به مرحله)

### روش اول: استقرار از طریق گیت‌هاب (GitHub) - پیشنهادی

1. فایل‌های این پوشه را در یک ریپازیتوری گیت‌هاب (مثلاً `my-web-proxy`) پوش (`git push`) کنید:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. وارد داشبورد [Railway.app](https://railway.app) شوید و وارد حساب کاربری خود شوید.

3. روی **New Project** کلیک کرده و گزینه **Deploy from GitHub repo** را انتخاب کنید.

4. مخزن گیت‌هاب خود را انتخاب کنید.

5. پس از ساخت سرویس، به تب **Settings** پروژه در ریل‌وی بروید:
   - در بخش **Networking**، روی **Generate Domain** کلیک کنید تا یک دامنه عمومی رایگان با SSL (مثلاً `webproxy-production.up.railway.app`) برای شما ساخته شود.
   - همچنین می‌توانید دامنه دلخواه خود (Custom Domain) را با رکورد CNAME متصل نمایید.

6. تمام! پروژه در کمتر از ۱ دقیقه با گواهی SSL و اتصال امن HTTPS / WSS بالا می‌آید و می‌توانید آدرس دامنه Railway را باز کرده و از وب‌پروکسی استفاده کنید.

---

### روش دوم: استقرار مستقیم با Railway CLI

اگر از ابزار متنی Railway استفاده می‌کنید:

```bash
# نصب ابزار
npm i -g @railway/cli

# ورود به حساب
railway login

# ایجاد و استقرار پروژه
railway init
railway up

# تولید دامنه عمومی
railway domain
```

---

## 💻 نحوه اجرای محلی (Local Development)

برای تست و اجرای پروژه روی سیستم خودتان:

```bash
# ۱. نصب پیش‌نیازها
npm install

# ۲. اجرای سرور
npm start
```

سپس در مرورگر خود آدرس زیر را باز کنید:
```
http://localhost:8080
```

> **نکته مهم**: در اجرای محلی (Localhost)، کروم و اج به طور پیش‌فرض دسترسی به Service Worker را فراهم می‌کنند. اما برای اجرای کامل روی وب، به دلیل نیاز پروتکل Service Worker به امنیت، اتصال با HTTPS الزامی است که دامنه Railway این گواهی SSL را به صورت خودکار و رایگان ارائه می‌دهد.

---

## 📁 ساختار فایل‌های پروژه

```
├── public/                 # فایل‌های فرانت‌اند و کلاینت
│   ├── index.html          # صفحه اصلی وب‌پروکسی
│   ├── index.css           # استایل‌های تم دارک و ریسپانسیو
│   ├── index.js            # راه‌اندازی BareMux و فرم جستجو
│   ├── register-sw.js      # ثبت Service Worker در مرورگر
│   ├── search.js           # تبدیل متن به موتور جستجو و URL
│   ├── error.js            # مدیریت پیام‌های خطا
│   ├── 404.html            # صفحه خطای ۴۰۴
│   └── uv/
│       └── uv.config.js    # تنظیمات پیشوند و دیکودر Ultraviolet
├── src/
│   └── index.js            # سرور Express + وب‌سوکت Wisp با پشتیبانی 0.0.0.0
├── Dockerfile              # بیلد داکر کانتینر
├── railway.json            # کانفیگ استاندارد استقرار خودکار در Railway
├── Procfile                # دستور اجرای پردازش سرور
├── package.json            # لیست وابستگی‌ها و اسکریپت‌ها
└── README.md               # راهنمای جامع پروژه
```
