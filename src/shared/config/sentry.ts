/**
 * Sentry uchun yagona sozlama manbai — klient, server va edge konfiglari SHU
 * yerdan o'qiydi (uchta faylda uchta ro'yxat bo'lsa, biri yangilanmay qolardi).
 *
 * ⚠️ ASOSIY QOIDA: DSN bo'lmasa Sentry UMUMAN ishga tushirilmaydi.
 * `Sentry.init({dsn: undefined})` ham "jim" rejimda ishlaydi, lekin baribir
 * integratsiyalarni o'rnatadi va global handler'larga yopishadi. Bizga bu kerak
 * emas: DSN qo'shilmagunicha ilova xatti-harakati MUTLAQO o'zgarmasin.
 *
 * Yoqish uchun (Vercel env):
 *   NEXT_PUBLIC_SENTRY_DSN=https://…@…ingest.de.sentry.io/…
 * Ixtiyoriy:
 *   NEXT_PUBLIC_SENTRY_ENV        — muhit nomi (default: NODE_ENV)
 *   NEXT_PUBLIC_SENTRY_TRACES     — tracing ulushi 0..1 (default: 0 = o'chiq)
 *   SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN — source-map yuklash uchun
 *     (bo'lmasa build baribir o'tadi, faqat stack trace minifikatsiyalangan qoladi)
 */

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

/** DSN yo'q bo'lsa hech narsa ishga tushmaydi — barcha konfiglar shu bilan boshlanadi. */
export const isSentryEnabled = Boolean(SENTRY_DSN);

export const sentryBaseOptions = {
  dsn: SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,

  // Tracing ATAYIN default'da o'chiq: bepul tarifda tranzaksiyalar kvotani
  // xatolardan tezroq yeb qo'yadi. Kerak bo'lsa env orqali 0.1 qiling.
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES || 0),

  // Foydalanuvchi ma'lumotlari (cookie, IP, sarlavhalar) YUBORILMAYDI.
  // Bu shaxsiy ma'lumotlar bilan ishlash siyosatimizga mos (privacy sahifasi)
  // va Play moderatsiyasida ortiqcha savol tug'dirmaydi.
  sendDefaultPii: false,

  /**
   * Shovqinni kesish. Bular ilova xatosi EMAS va kvotani behuda yeydi:
   *  - tarmoq uzilishi / backend 502 (client.ts allaqachon foydalanuvchiga aytadi),
   *  - brauzer kengaytmalari va tashqi skriptlar (Yandex Maps CDN),
   *  - foydalanuvchi sahifani tashlab ketganda uzilgan so'rovlar.
   */
  ignoreErrors: [
    'Network Error',
    'NetworkError',
    'Failed to fetch',
    'Load failed',
    'AbortError',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    /^Non-Error promise rejection captured/,
  ],
};
