/**
 * Sentry — BRAUZER tomoni. Next bu faylni klient bundle'ining eng boshida ishga
 * tushiradi (`instrumentation-client` konvensiyasi).
 *
 * ⚠️ `import()` DINAMIK va shart ICHIDA — bu ataylab.
 * Statik `import * as Sentry from '@sentry/nextjs'` bo'lganda SDK boshlang'ich
 * bundle'ga tushardi va DSN qo'yilmagan bo'lsa ham HAR BIR foydalanuvchi uni
 * yuklab olardi (o'lchangan: 356 KB o'lik kod). Dinamik importda esa
 * `isSentryEnabled` build vaqtida `false` ga aylanadi (NEXT_PUBLIC_* inline
 * qilinadi) va bundler butun shoxni tashlab yuboradi.
 *
 * Narxi: DSN yoqilganda init bir mikro-task kechikadi. Ilovaning eng birinchi
 * millisekundidagi xato o'tkazib yuborilishi mumkin — bu 356 KB uchun arziydigan
 * kelishuv, chunki server tomoni (instrumentation.ts) baribir yozib qoladi.
 */
import { isSentryEnabled, sentryBaseOptions } from '@/shared/config/sentry';

if (isSentryEnabled) {
  import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({
        ...sentryBaseOptions,
        /*
         * Integratsiyalar ANIQ ro'yxat bilan beriladi (standart to'plam emas).
         *
         * ⚠️ Session Replay ATAYIN YO'Q: u chat va profil ekranlaridagi shaxsiy
         * matnni yozib olardi — maxfiylik siyosatimizga zid. Uni bu ro'yxatga
         * qo'shmang.
         *
         * `browserTracing` esa KERAK: Web Vitals (INP — bosishga javob vaqti,
         * CLS — sahifa sakrashi, LCP — asosiy kontent chiqishi) faqat shu
         * integratsiya orqali yig'iladi. `tracesSampleRate` 0 bo'lsa u baribir
         * hech narsa yubormaydi, shuning uchun shartsiz qo'shsa bo'ladi.
         */
        integrations: [Sentry.browserTracingIntegration()],
      });
    })
    .catch(() => {
      /* monitoring yuklanmadi — ilova ishlashda davom etadi */
    });
}

/** Sahifalararo o'tishlarni Sentry'ga bog'lash (tracing yoqilgan bo'lsa). */
export function onRouterTransitionStart(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRouterTransitionStart>
) {
  if (!isSentryEnabled) return;

  import('@sentry/nextjs')
    .then((Sentry) => Sentry.captureRouterTransitionStart(...args))
    .catch(() => {});
}
