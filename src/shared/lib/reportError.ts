import { isSentryEnabled } from '@/shared/config/sentry';

/**
 * Xatoni monitoringga yuborish — error boundary'lar shu funksiyani chaqiradi.
 *
 * `import()` ATAYIN dinamik va shart ichida: DSN qo'shilmagan bo'lsa `@sentry/nextjs`
 * moduli klient bundle'iga umuman tushmaydi. Statik import bo'lganda SDK har bir
 * foydalanuvchiga yuklanardi — ishlatilmasa ham.
 *
 * Hech qachon `throw` qilmaydi: monitoring qulagani foydalanuvchi ko'radigan
 * xato ekranini buzib qo'yishi mumkin emas.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!isSentryEnabled) return;

  import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    })
    .catch(() => {
      /* monitoring yuklanmadi — jim o'tamiz */
    });
}
