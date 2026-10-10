import { toCyrillic } from './cyrillic';

/**
 * Uch tilli matn — loyihaning YAGONA tarjima mexanizmi.
 *
 * TARIXI: ilgari hamma joyda `isUz ? 'uz matn' : 'ru matn'` yozilardi. Uchinchi til
 * (ingliz) qo'shilganda bu shakl ishlamay qoldi: `isUz` false bo'lsa ruscha chiqardi,
 * ya'ni inglizcha interfeys ruschaga aylanardi. Shuning uchun har bir matn endi
 * UCHTA variant bilan yoziladi va til `locale` dan hisoblanadi.
 *
 * `en` MAJBURIY (ixtiyoriy emas) — atayin: TypeScript yangi matnda inglizchasi
 * unutilganini kompilyatsiya vaqtida ushlaydi, aks holda til jimgina "yarim"
 * qolgan bo'lardi.
 *
 * Foydalanish:
 *   const tr = trFor(locale);        // komponentda (useLocale() dan)
 *   tr('Bekor qilish', 'Отмена', 'Cancel')
 */

/**
 * Saytdagi tillar. URL prefiksi DOIM bor (`localePrefix: 'always'`, proxy.ts).
 *
 * 🔑 `uz-cyrl` — O'ZBEK KIRILI (2026-09-08). U alohida matnlar to'plami
 * EMAS: lotincha matn `toCyrillic` bilan o'giriladi (izohi
 * `shared/lib/cyrillic.ts` da). Ilovada ham aynan shu yondashuv.
 *
 * ⚠️ URL'da KICHIK HARF (`/uz-cyrl/...`): manzilni odam qo'lda ham
 * yozadi va `uz-Cyrl` katta harfi bilan 404 olardi. Backendga va
 * hreflang'ga esa BCP-47 shakli (`uz-Cyrl`) ketadi — `bcp47` ga qarang.
 */
export const LOCALES = ['uz', 'uz-cyrl', 'ru', 'en'] as const;
export type Lang = (typeof LOCALES)[number];

/** Ixtiyoriy satrni qo'llab-quvvatlanadigan tilga keltiradi (noma'lum -> uz). */
export const asLang = (locale?: string | null): Lang => {
  const v = (locale ?? '').toLowerCase();
  if (v === 'ru') return 'ru';
  if (v === 'en') return 'en';
  if (v === 'uz-cyrl' || v === 'uz_cyrl') return 'uz-cyrl';
  return 'uz';
};

/**
 * Sayt kodidan BCP-47 shakli — hreflang, `<html lang>`, backend va
 * `Intl` uchun.
 *
 * `Intl` `uz-Cyrl-UZ` ni O'ZI biladi (o'lchandi: «9 сентябр»), ya'ni
 * sana nomlari uchun qo'shimcha jadval kerak emas.
 */
export const bcp47 = (locale?: string | null): string =>
  asLang(locale) === 'uz-cyrl' ? 'uz-Cyrl' : asLang(locale);

/**
 * `Intl` uchun to'liq teg — sana va son formatlash.
 *
 * 🔑 `Intl` `uz-Cyrl-UZ` ni O'ZI biladi (o'lchandi: «9 сентябр»), ya'ni
 * oy nomlari uchun bizda jadval kerak emas. Ilovada esa u yo'q va
 * o'sha 12 so'z qo'lda yozilgan (`core/format.dart`).
 */
export const intlTag = (locale?: string | null): string =>
  ({
    uz: 'uz-UZ',
    'uz-cyrl': 'uz-Cyrl-UZ',
    ru: 'ru-RU',
    en: 'en-US',
  })[asLang(locale)];

export type Tr = (uz: string, ru: string, en: string) => string;

/** Locale bo'yicha tarjima funksiyasi. React'ga bog'liq EMAS — server, util va
 *  komponent — hammasida bir xil ishlaydi. */
export const trFor = (locale?: string | null): Tr => {
  const lang = asLang(locale);
  // 🔑 Kirill uchun TO'RTINCHI argument YO'Q: 1005 ta chaqiruv joyini
  // tahrirlash o'rniga lotincha matn o'giriladi (izohi `cyrillic.ts` da).
  if (lang === 'uz-cyrl') return (uz) => toCyrillic(uz);
  return (uz, ru, en) => (lang === 'ru' ? ru : lang === 'en' ? en : uz);
};

/** Matn emas, QIYMAT tanlash uchun (massiv, obyekt, komponent va h.k.). */
export const pickFor =
  (locale?: string | null) =>
  <T>(uz: T, ru: T, en: T): T => {
    const lang = asLang(locale);
    // ⚠️ Kirill uchun O'ZBEKCHA qiymat qaytadi: bu yerda matn emas,
    // QIYMAT tanlanadi (massiv, komponent, sana formati) va uni
    // o'girib bo'lmaydi. Matn kerak bo'lsa `trFor` ishlatiladi.
    return lang === 'ru' ? ru : lang === 'en' ? en : uz;
  };
