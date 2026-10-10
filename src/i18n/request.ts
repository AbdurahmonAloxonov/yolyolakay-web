import { getRequestConfig } from 'next-intl/server';
import { LOCALES } from '@/shared/lib/i18n';
import { deepCyrillic } from '@/shared/lib/cyrillic';

export default getRequestConfig(async ({ requestLocale }) => {
  // We extract the locale from the requestLocale promise or directly
  let locale = await requestLocale;

  // Ensure we fall back to 'uz' if locale is not supported — asosiy bozor O'zbekiston
  // (.uz domeni), shuning uchun tili aniqlanmagan mehmon o'zbekchada ochadi.
  if (!locale || !LOCALES.includes(locale as (typeof LOCALES)[number])) {
    locale = 'uz';
  }

  /*
   * 🔑 `messages/uz-cyrl.json` YO'Q va ATAYIN yaratilmaydi: kirill
   * matn o'zbekchasidan o'giriladi. Ikkinchi fayl bo'lsa, ertaga
   * birini tuzatib ikkinchisini unutish muqarrar edi — bu loyihada
   * allaqachon bo'lgan xato (sana filtri saytda va ilovada
   * ajralib ketgandi).
   */
  if (locale === 'uz-cyrl') {
    const uz = (await import('../../messages/uz.json')).default;
    return { locale, messages: deepCyrillic(uz) };
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
