/**
 * Bildirishnoma matnlarini foydalanuvchi tiliga o'giradigan YAGONA manba.
 *
 * ⚠️ 07.09.2026 da tuzatildi. Ilgari bu yerda «backend DOIM ruscha yaratadi va
 * locale'ni o'zgartirish endpointi yo'q» deb yozilgandi — IKKALASI HAM eskirgan:
 * til `PUT /users/profile` orqali yuboriladi (ilova 28.08 dan buyon yuboradi) va
 * jonli o'lchovda `GET /notifications` O'ZBEKCHA qaytdi («Yangi bron — Yo'lovchi
 * safaringizga joy bron qildi»).
 *
 * Modul SAQLANADI, chunki u endi boshqa ish qiladi: tili YOZILMAGAN akkaunt va
 * matni tayyor holda keladigan WS kadri uchun zaxira. Til aralashmasligi uchun
 * hamma joy (ro'yxat sahifasi VA WS toast) shu modul orqali o'tadi. Ikki manba bor:
 *   1) GET /notifications  -> `type` maydoni ANIQ keladi (booking_created...) — type bo'yicha o'giramiz;
 *   2) WS {type:"notification", title, body} -> semantik type YO'Q, faqat ruscha matn —
 *      ruscha matnni namuna (regex) bo'yicha aniqlab o'giramiz (fallback).
 */

import { asLang, trFor, type Lang } from './i18n';

type Triple = readonly [uz: string, ru: string, en: string];

// Kalitni normallaymiz: 'NEW_MESSAGE' | 'new_message' | 'NewMessage' -> 'newmessage'.
const norm = (t: unknown): string =>
  String(t ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

// Semantik type -> matn. Sinonimlar (booking_confirmed/booking_accepted, ride_/trip_) bir xil.
const BY_TYPE: Record<string, Triple> = {
  newmessage: ['Sizga yangi xabar keldi', 'У вас новое сообщение', 'You have a new message'],
  newbooking: [
    'Safaringizga yangi ariza keldi',
    'Новая заявка на вашу поездку',
    'A new request for your trip',
  ],
  bookingcreated: [
    'Safaringizga yangi ariza keldi',
    'Новая заявка на вашу поездку',
    'A new request for your trip',
  ],
  bookingconfirmed: ['Arizangiz qabul qilindi', 'Ваша заявка принята', 'Your request was accepted'],
  bookingaccepted: ['Arizangiz qabul qilindi', 'Ваша заявка принята', 'Your request was accepted'],
  bookingrejected: ['Arizangiz rad etildi', 'Ваша заявка отклонена', 'Your request was declined'],
  bookingcancelled: ['Ariza bekor qilindi', 'Заявка отменена', 'The request was cancelled'],
  ridestarted: ['Safar boshlandi', 'Поездка началась', 'The trip has started'],
  tripstarted: ['Safar boshlandi', 'Поездка началась', 'The trip has started'],
  ridecancelled: ['Safar bekor qilindi', 'Поездка отменена', 'The trip was cancelled'],
  tripcancelled: ['Safar bekor qilindi', 'Поездка отменена', 'The trip was cancelled'],
  ridecompleted: ['Safar yakunlandi', 'Поездка завершена', 'The trip is completed'],
  tripcompleted: ['Safar yakunlandi', 'Поездка завершена', 'The trip is completed'],
  trialactivated: [
    'Sinov tarifi faollashtirildi',
    'Пробный тариф активирован',
    'Trial plan activated',
  ],
  paymentsuccess: ["To'lov qabul qilindi", 'Оплата принята', 'Payment accepted'],
};

// Ruscha matn namunasi -> type. WS toast semantik type bermaydi — matndan aniqlaymiz.
// DIQQAT: `\w` JS regexda kirillni TANIMAYDI — stemlar orasida `.*` ishlatamiz (bir qatorli matn).
// Aniq fe'lli namunalar (принят/отклонен...) umumiy "yangi ..." dan OLDIN tekshiriladi.
const RU_HINT: ReadonlyArray<readonly [RegExp, string]> = [
  [/заявк.*принят/i, 'bookingconfirmed'],
  [/заявк.*отклонен/i, 'bookingrejected'],
  [/заявк.*отменен/i, 'bookingcancelled'],
  [/поездк.*начал/i, 'ridestarted'],
  [/поездк.*отменен/i, 'ridecancelled'],
  [/поездк.*заверш/i, 'ridecompleted'],
  [/тариф.*активирован|пробн.*тариф/i, 'trialactivated'],
  [/оплат.*принят|платеж.*успеш/i, 'paymentsuccess'],
  [/нов.*сообщени|сообщени.*получен/i, 'newmessage'],
  [/нов.*заявк/i, 'bookingcreated'],
];

/** Texnik til prefiksini ([ru]/[uz]/[en]) kesadi. */
export const stripLocalePrefix = (s: string): string =>
  s.replace(/^\s*\[(ru|uz|en)\]\s*/i, '').trim();

/** Matnda kirill harflari bormi (uz interfeysida ruscha xom matnni yashirish uchun). */
export const hasCyrillic = (s: string): boolean => /[а-яё]/i.test(s);

/**
 * Bildirishnoma sarlavhasini foydalanuvchi tiliga o'giradi.
 * @param type    GET /notifications `type` (bo'lsa) — eng ishonchli manba
 * @param rawText title yoki body — WS yoki noma'lum type uchun zaxira matn
 */
export const localizeNotification = (
  type: string | null | undefined,
  rawText: string | null | undefined,
  locale: string
): string => {
  const lang: Lang = asLang(locale);
  const idx = lang === 'ru' ? 1 : lang === 'en' ? 2 : 0;

  // 1) Aniq semantik type bo'yicha (ro'yxat sahifasi).
  const byType = BY_TYPE[norm(type)];
  if (byType) return byType[idx];

  // 2) Ruscha matndan type'ni aniqlab (WS toast — type kelmaydi).
  const text = stripLocalePrefix(String(rawText ?? ''));
  // Ruscha xom matn — uz/en interfeysida namunaga qarab o'giramiz.
  if (lang !== 'ru') {
    for (const [re, key] of RU_HINT) {
      if (re.test(text)) return BY_TYPE[key][idx];
    }
  }

  // 3) Topilmasa — xom matn (prefiks kesilgan); butunlay bo'sh bo'lsa umumiy matn.
  return text || trFor(locale)('Yangi bildirishnoma', 'Новое уведомление', 'New notification');
};

/**
 * Toast/ro'yxat uchun tavsif (ikkilamchi qator). Uz/en interfeysida hali ruscha (kirill)
 * bo'lgan xom matnni KO'RSATMAYMIZ — aks holda sarlavha bir tilda, tavsif boshqa tilda chiqardi.
 */
export const localizeNotificationDetail = (
  body: string | null | undefined,
  locale: string
): string | undefined => {
  const text = stripLocalePrefix(String(body ?? ''));
  if (!text) return undefined;
  // Uz/en interfeysida hali ruscha (kirill) bo'lgan xom matnni ko'rsatmaymiz.
  if (asLang(locale) !== 'ru' && hasCyrillic(text)) return undefined;
  return text;
};
