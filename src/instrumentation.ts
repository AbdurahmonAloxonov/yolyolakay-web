/**
 * Sentry — SERVER va EDGE tomoni.
 *
 * `register()` ni Next server ishga tushganda bir marta chaqiradi; `onRequestError`
 * esa server komponenti / route handler ichida ushlanmagan xato bo'lganda.
 * Ikkalasi ham DSN yo'q bo'lsa hech narsa qilmaydi.
 *
 * `import()` ataylab dinamik: DSN bo'lmasa Sentry moduli umuman yuklanmaydi
 * (cold start'ga qo'shimcha vaqt qo'shilmaydi).
 */
import { isSentryEnabled, sentryBaseOptions } from '@/shared/config/sentry';

export async function register() {
  if (!isSentryEnabled) return;

  const Sentry = await import('@sentry/nextjs');
  // nodejs va edge uchun sozlama bir xil — farq faqat runtime'da.
  Sentry.init(sentryBaseOptions);
}

export async function onRequestError(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) {
  if (!isSentryEnabled) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
}
