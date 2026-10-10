#!/usr/bin/env node
/**
 * UZILISH KUZATUVI — prod tirikmi degan savolga javob beradi.
 *
 * 🔴 NEGA YOZILDI (08.09.2026): 07.09 da prod IKKI MARTA yiqildi —
 * avval `send-otp` 500 («i/o timeout»), keyin gateway yangi tokenlarni
 * tanimay qoldi (401). Ikkalasini ham QO'LDA payqadik: birinchisini
 * egasi aytdi, ikkinchisini o'lchov paytida tasodifan ko'rdik.
 * Ya'ni uchinchi uzilishni ham xuddi shunday — tasodifan — bilardik.
 *
 * Sentry buni TUTMAYDI: u mijoz kodidagi xatoni ko'radi, serverning
 * o'lganini emas. Kirgan odam ishlayveradi, YANGI odam esa kira
 * olmaydi va hech kim xabar bermaydi.
 *
 * ═══ NIMA TEKSHIRILADI VA NEGA AYNAN SHULAR ═══
 *
 * Har bir tekshiruv BITTA aniq savolga javob beradi va HECH QANDAY
 * yon ta'siri yo'q (SMS yubormaydi, hisob ochmaydi, pul yechmaydi).
 *
 * ═══ NEGA `send-otp` TO'LIQ SINALMAYDI ═══
 *
 * 07.09 dagi birinchi uzilish AYNAN SMS qadamida edi. Uni to'liq
 * tekshirish uchun HAQIQIY kod yuborish kerak — bu esa har 10
 * daqiqada begona raqamga SMS degani (o'lchandi: `type=register`
 * mavjud bo'lmagan raqamga ham 200 qaytaradi, ya'ni rostdan
 * yuboradi). Shuning uchun bu yerda faqat auth xizmatining TIRIKLIGI
 * tekshiriladi (`type=login`, ro'yxatda yo'q raqam → 404, SMS yo'q).
 *
 * ⚠️ HALOL CHEKLOV: 07.09 dagi uzilishda ham aynan shu javob 404
 * bo'lib turgan edi, ya'ni bu tekshiruv o'sha xatoni TUTMASDI.
 * Backenddan `/health` ga SMS provayderi holatini qo'shish so'raldi.
 * Shu bo'lgunicha SMS zanjirini `UPTIME_SMS_PHONE` bilan ixtiyoriy
 * yoqish mumkin (pastda).
 *
 * Ishlatish:
 *   node scripts/uptime-check.mjs        # yoki: pnpm uptime
 * Chiqish kodi: 0 — hammasi joyida, 1 — kamida bittasi yiqilgan.
 */

const SITE = process.env.UPTIME_SITE || 'https://yolyolakay.co.uz';
const API = process.env.UPTIME_API || 'https://api.yolyolakay.com';

/**
 * ⚠️ WAF (Cloudflare) standart skript `User-Agent` ini bloklaydi —
 * brauzer sarlavhasisiz javob 1010/403 keladi va kuzatuv «hamma narsa
 * yiqilgan» deb YOLG'ON signal berardi. Bu tuzoqqa `backend-probe`
 * bir marta tushgan, ikkinchi marta tushmaymiz.
 */
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36';

/** Sekin javob ham uzilish: 15 s dan keyin odam baribir ketib qoladi. */
const TIMEOUT_MS = 15_000;

/** Toshkent–Samarqand, keng radius — qidiruvda doim natija bo'ladigan yo'nalish. */
const SEARCH_QS =
  'origin_lat=41.2995&origin_lon=69.2401&dest_lat=39.6542&dest_lon=66.9597&radius_km=200';

async function request(url, init = {}) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: '*/*', ...(init.headers || {}) },
    });
    const text = await res.text();
    return { ok: true, status: res.status, ms: Date.now() - started, text };
  } catch (error) {
    return { ok: false, status: 0, ms: Date.now() - started, text: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tekshiruvlar ro'yxati. Har biri `{ name, question, run }`.
 *
 * `question` — bu tekshiruv qaysi savolga javob berishi. Buni yozib
 * bo'lmasa, tekshiruv keraksiz: shovqin ichida haqiqiy signal
 * ko'rinmay qoladi.
 */
const CHECKS = [
  {
    name: 'sayt',
    question: 'Odam saytni ocha oladimi?',
    async run() {
      const r = await request(`${SITE}/uz/login`);
      if (r.status !== 200) return `kutilgan 200, keldi ${r.status || 'javob yo\'q'}`;
      // Bo'sh 200 ham uzilish: build buzilsa sahifa oq qoladi.
      if (!r.text.includes('YOLYOLAKAY') && !r.text.toLowerCase().includes('yolyolakay')) {
        return 'sahifa 200, lekin ichida brend nomi yo\'q (oq ekran?)';
      }
      return null;
    },
  },
  {
    name: 'gateway',
    question: 'Backend gateway tirikmi?',
    async run() {
      const r = await request(`${API}/health`);
      if (r.status !== 200) return `kutilgan 200, keldi ${r.status || 'javob yo\'q'}`;
      if (!r.text.includes('healthy')) return `javobda "healthy" yo'q: ${r.text.slice(0, 80)}`;
      return null;
    },
  },
  {
    name: 'qidiruv',
    question: 'Ma\'lumotlar bazasi javob beryaptimi va safarlar chiqyaptimi?',
    async run() {
      const r = await request(`${API}/api/v1/rides/search?${SEARCH_QS}`);
      if (r.status !== 200) return `kutilgan 200, keldi ${r.status || 'javob yo\'q'}`;
      try {
        const body = JSON.parse(r.text);
        const rides = Array.isArray(body) ? body : (body?.rides ?? body?.data?.rides);
        // `null` — bo'sh natija (backend shunday qaytaradi), bu XATO EMAS.
        if (rides !== null && !Array.isArray(rides)) return 'javob shakli kutilmagan';
        return null;
      } catch {
        return 'javob JSON emas';
      }
    },
  },
  {
    name: 'kirish',
    question: 'Auth xizmati tirikmi? (SMS YUBORILMAYDI — izohi faylda)',
    async run() {
      const r = await request(`${API}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Ro'yxatda YO'Q raqam + `type=login` → 404 va SMS ketmaydi.
        body: JSON.stringify({ phone_number: '+998900000001', type: 'login' }),
      });
      if (r.status === 404) return null;
      // 429 — bizning o'z chastotamiz cheklovga tushdi, bu uzilish EMAS.
      if (r.status === 429) return null;
      return `kutilgan 404, keldi ${r.status || 'javob yo\'q'}`;
    },
  },
  {
    name: 'proxy',
    question: 'Brauzer ishlatadigan ZANJIR butunmi (sayt → Vercel → tunnel → gateway)?',
    async run() {
      // 🔑 Bu eng qimmatli tekshiruv: mijoz backendga TO'G'RIDAN
      // chiqmaydi, `/api-proxy` orqali ketadi. Gateway tirik bo'lib,
      // tunnel yoki rewrite yiqilsa — odam uchun sayt O'LIK, lekin
      // yuqoridagi `gateway` tekshiruvi yashil turaveradi.
      const r = await request(`${SITE}/api-proxy/api/v1/rides/search?${SEARCH_QS}`);
      if (r.status !== 200) return `kutilgan 200, keldi ${r.status || 'javob yo\'q'}`;
      return null;
    },
  },
];

/**
 * SINOV REJIMI — ogohlantirish kanalini tekshirish uchun.
 *
 * 🔴 NEGA KERAK: xabar FAQAT uzilishda ketadi, ya'ni Telegram tokeni
 * to'g'ri qo'yilganini haqiqiy uzilish kunigacha bilmasdik. Sinalmagan
 * ogohlantirish kanali — kanal emas: uzilish bo'ladi, xabar kelmaydi
 * va buni ham hech kim payqamaydi.
 *
 * Yoqilishi: GitHub'da ishni qo'lda ishga tushirib «sinov» katagini
 * belgilash (yoki `UPTIME_FORCE_FAIL=1`).
 */
if (process.env.UPTIME_FORCE_FAIL) {
  CHECKS.push({
    name: 'SINOV',
    question: 'Ogohlantirish kanali ishlayaptimi? (atayin yiqiladi)',
    async run() {
      return 'bu ATAYIN yiqilgan sinov — prodda muammo YO\'Q';
    },
  });
}

/**
 * IXTIYORIY: haqiqiy SMS zanjiri.
 *
 * ⚠️ Yoqilsa HAR ISHGA TUSHISHDA berilgan raqamga SMS ketadi. Faqat
 * o'zingizning raqamingiz bilan va kamdan-kam (masalan soatiga bir
 * marta) ishlating: `UPTIME_SMS_PHONE=+998...`.
 */
if (process.env.UPTIME_SMS_PHONE) {
  CHECKS.push({
    name: 'sms',
    question: 'SMS provayderi ishlayaptimi? (HAQIQIY kod yuboradi)',
    async run() {
      const r = await request(`${API}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: process.env.UPTIME_SMS_PHONE, type: 'login' }),
      });
      if (r.status === 200 || r.status === 429) return null;
      return `kutilgan 200, keldi ${r.status || 'javob yo\'q'}`;
    },
  });
}

const results = [];
for (const check of CHECKS) {
  const started = Date.now();
  let problem;
  try {
    problem = await check.run();
  } catch (error) {
    problem = `tekshiruvning o'zi yiqildi: ${String(error).slice(0, 120)}`;
  }
  results.push({ ...check, problem, ms: Date.now() - started });
}

const failed = results.filter((r) => r.problem);
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

console.log(`YOLYOLAKAY · uzilish kuzatuvi · ${stamp} UTC`);
console.log('─'.repeat(64));
for (const r of results) {
  const mark = r.problem ? 'YIQILDI' : 'ishlaydi';
  console.log(`${mark.padEnd(9)} ${r.name.padEnd(9)} ${String(r.ms).padStart(5)} ms  ${r.question}`);
  if (r.problem) console.log(`${' '.repeat(10)}└─ ${r.problem}`);
}
console.log('─'.repeat(64));

if (failed.length === 0) {
  console.log(`Hammasi joyida (${results.length} tekshiruv).`);
  process.exit(0);
}

console.log(`YIQILGAN: ${failed.map((f) => f.name).join(', ')}`);
process.exit(1);
