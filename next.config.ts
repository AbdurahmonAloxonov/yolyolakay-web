import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Uy katalogidagi begona lockfile'lar tufayli Turbopack root'ni noto'g'ri
  // aniqlamasligi uchun root'ni shu loyihaga qat'iy belgilaymiz.
  turbopack: {
    root: import.meta.dirname,
  },
  // MUHIM (2026-07-19 prod jonli isbot): Next default'da /api-proxy/.../rides/ (oxirgi slash)
  // ni 308 bilan slashsizga redirect qiladi; gateway esa slashsiz POST /rides'ni 307 bilan
  // NISBIY Location(/api/v1/rides/)ga qaytaradi — brauzer uni vercel.app'ga nisbatan ochib
  // 404 oladi (safar yaratish butunlay buzilardi). Redirectni o'chirsak slash saqlanadi va
  // so'rov to'g'ri /rides/ ga yetadi.
  skipTrailingSlashRedirect: true,
  headers: async () => {
    return [
      // Kanonik domen — yolyolakay.co.uz (2026-07-30 qarori). `.vercel.app` hostlari (prod
      // alias + har bir preview) ayni kontentni beradi → qidiruvda dublikat. REDIRECT
      // QILINMAYDI: mobil ilova (Capacitor, server.url = yolyolakay-frontend.vercel.app)
      // o'sha hostda yashaydi va allowNavigation sozlanmagan — boshqa hostga redirect
      // tarqatilgan APK'ni tashqi brauzerga uloqtiradi. Shuning uchun faqat indeksatsiyani
      // yopamiz; sahifalardagi <link rel="canonical"> kanonik domenni ko'rsatadi.
      {
        source: '/(.*)',
        has: [{ type: 'host', value: '.*\\.vercel\\.app' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
  redirects: async () => {
    // 2026-07-30: ikkita .uz domen bir xil kontentni berardi (qidiruvda dublikat).
    // Kanonik — yolyolakay.co.uz; eski yolyolakayco.uz butunlay unga 308 (doimiy) bilan
    // o'tadi, shunda qidiruv tizimlari ranking signallarini yangi domenga ko'chiradi.
    // DIQQAT: host ANIQ moslanadi — `.vercel.app` bu qoidaga tushmaydi (mobil APK
    // server.url o'sha hostda; yuqoridagi izohga qarang).
    const domainRedirects = ['yolyolakayco.uz', 'www.yolyolakayco.uz'].map((host) => ({
      source: '/:path*',
      has: [{ type: 'host' as const, value: host }],
      destination: 'https://yolyolakay.co.uz/:path*',
      permanent: true,
    }));

    return [
      ...domainRedirects,
      /*
       * Tariflar 2026-08-11 da BITTA sahifaga birlashtirildi. Eski manzil
       * havolalarda va foydalanuvchi bookmarklarida qolgan bo'lishi mumkin.
       *
       * NEGA SAHIFA ICHIDAGI `redirect()` EMAS: u Next'ning striming rejimida
       * HTTP kodini o'zgartira olmaydi (sarlavhalar allaqachon yuborilgan) —
       * javob `200` bo'lib, ko'chirish HTML ichiga solingan holda klient
       * tomonda bajariladi. Jonli o'lchandi: `curl` `200` oldi, HTML ichida
       * `NEXT_REDIRECT ... /uz/tariffs;307` yotardi. Brauzerda ishlaydi, lekin
       * bu "yumshoq redirect": JS'siz mijoz va qidiruv botlari uchun sahifa
       * mavjuddek ko'rinadi.
       *
       * Konfiguratsiya darajasidagi qoida esa HAQIQIY 308 beradi — JS ham,
       * striming ham qatnashmaydi.
       */
      {
        source: '/:locale(uz|ru|en)/tariffs/passenger',
        destination: '/:locale/tariffs',
        permanent: true,
      },
    ];
  },
  rewrites: async () => {
    // 2026-07-17: backend to'liq qayta yozildi — BITTA API Gateway, hamma route /api/v1 ostida.
    // Brauzer HTTPS/mixed-content va CORS sabab to'g'ridan-to'g'ri tunnelga chiqmaydi —
    // bitta same-origin proxy prefiksi (/api-proxy) barcha so'rovlarni gateway originiga o'tkazadi.
    //
    // MANZIL env orqali (server-side, NEXT_PUBLIC_ EMAS). Vercel/prod'da:
    //   BACKEND_URL=https://xxx.trycloudflare.com  (cloudflare quick-tunnel restartda o'zgaradi)
    // Lokal: http://localhost:8080
    const backend = process.env.BACKEND_URL || 'http://localhost:8080';
    return [
      // MUHIM: `:path*` oxirgi BO'SH segmentni tashlaydi — destination'da oxirgi slash
      // yo'qoladi. Gateway esa POST /rides'ni (slashsiz) 307 + NISBIY Location bilan
      // qaytaradi va brauzer uni vercel.app'ga nisbatan ochib 404 oladi (2026-07-19 prod
      // jonli isbot). Shu bitta slash-li yo'l uchun ANIQ qoida — umumiy qoidadan OLDIN.
      { source: '/api-proxy/api/v1/rides/', destination: `${backend}/api/v1/rides/` },
      { source: '/api-proxy/:path*', destination: `${backend}/:path*` },
      // Eslatma: WebSocket (NEXT_PUBLIC_WS_URL) rewrites orqali proxy QILINMAYDI — brauzer
      // wss:// URL'ga to'g'ridan-to'g'ri ulanadi. Vercel (HTTPS)'da wss:// bo'lishi SHART.
    ];
  },
};

/**
 * Sentry o'rami FAQAT DSN qo'yilgan bo'lsa qo'llanadi.
 *
 * `withSentryConfig` build'ga aralashadi (source-map yuklash, release inject,
 * webpack plugin). Monitoring yoqilmagan holatda build ARTEFAKTI o'zgarmasligi
 * kerak — shuning uchun shart. DSN qo'shilgach o'ram o'zi ishga tushadi,
 * bu faylni qayta tahrirlash kerak emas.
 *
 * `SENTRY_AUTH_TOKEN` bo'lmasa source-map yuklanmaydi (build baribir o'tadi),
 * faqat stack trace minifikatsiyalangan ko'rinadi.
 */
const config = withNextIntl(nextConfig);

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Build logini ko'mib tashlamasin — faqat haqiqiy ogohlantirishlar chiqsin.
      silent: true,
      // Klient source-map'lari serverda qolib, ochiq tarqalmasin.
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      // Reklama bloklovchilar `*.sentry.io` ni to'sadi — xatolar yo'qolmasligi
      // uchun hisobotlar o'z domenimiz orqali o'tadi.
      tunnelRoute: '/monitoring',
    })
  : config;
