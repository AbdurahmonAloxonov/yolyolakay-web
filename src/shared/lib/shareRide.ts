import { formatTripDateTime, formatCurrency } from './format';
import { pickFor } from './i18n';
import { shareContent } from './share';

/**
 * Safarni ULASHISH matni — Telegramga tashlash uchun tayyor.
 *
 * 🔴 NEGA KERAK: O'zbekistonda safar odamlar orasida Telegram orqali
 * tarqaladi. Ilgari odam safarni ko'rsatish uchun ekranni SURATGA olardi —
 * suratdan havola ochilmaydi, ya'ni ko'rgan odam safarni topa olmasdi.
 *
 * Matn ILOVADAGI `rideShareText` bilan bir xil tuzilishda: bitta safar ikki
 * mijozdan ulashilganda bir xil ko'rinishi kerak.
 */
export interface ShareRideInput {
  id: string;
  from?: string | null;
  to?: string | null;
  departureTime?: string | null;
  price?: number | null;
  seats?: number | null;
}

export const rideShareUrl = (id: string, locale: string): string =>
  `${typeof window === 'undefined' ? 'https://yolyolakay.co.uz' : window.location.origin}/${locale}/trip/${id}`;

export const rideShareText = (ride: ShareRideInput, locale: string): string => {
  const pick = pickFor(locale);
  const route = [ride.from?.trim(), ride.to?.trim()].filter(Boolean).join(' → ');
  const when = formatTripDateTime(ride.departureTime);
  // `formatCurrency` valyuta qo'shimchasini O'ZI qo'shadi — bu yerda yana
  // yozilsa "100 000 so'm so'm" chiqardi.
  const price = ride.price != null ? formatCurrency(ride.price, locale) : '';
  const seats = ride.seats != null ? `${ride.seats} ${pick('joy', 'мест', 'seats')}` : '';

  // Bo'sh qatorlar tashlanadi: ma'lumot yetishmasa matnda osilib qolgan
  // chiziqcha yoki quruq qator "ma'lumot buzuq" degandek ko'rinadi.
  const lines = [route, when, [price, seats].filter(Boolean).join(' · ')].filter(
    (line) => line.length > 0
  );
  return [...lines, '', rideShareUrl(ride.id, locale)].join('\n');
};

/**
 * Ulashish oynasini ochadi; brauzer qo'llab-quvvatlamasa matnni NUSXALAYDI.
 *
 * ⚠️ `navigator.share` faqat HTTPS'da va foydalanuvchi bosishidan KEYIN
 * ishlaydi, desktop brauzerlarning bir qismida esa umuman yo'q. Shuning
 * uchun zaxira SHART — aks holda tugma ba'zi mashinalarda jim o'lardi.
 *
 * Qaytadi: `'shared' | 'copied' | 'failed'` — chaqiruvchi shunga qarab
 * xabar ko'rsatadi (ulashish oynasi ochilganda ortiqcha toast chiqmasin).
 */
export const shareRide = (
  ride: ShareRideInput,
  locale: string
): Promise<'shared' | 'copied' | 'failed'> => shareText(rideShareText(ride, locale));

/** Matnni ulashish — ikkala ulashish oqimi uchun umumiy. */
const shareText = (text: string): Promise<'shared' | 'copied' | 'failed'> => shareContent({ text });

/**
 * «SAFARIMNI KUZAT» — yaqinlariga yuboriladigan xavfsizlik xabari.
 *
 * 🔴 NEGA KERAK: SOS tugmasi bizda BOR, lekin u HODISADAN KEYIN ishlaydi.
 * Bu esa oldini oladi: onasi yoki turmush o'rtog'i kim bilan, qanaqa
 * mashinada va qayerga ketayotganini OLDINDAN biladi.
 *
 * ⚠️ Bu JONLI kuzatuv EMAS: havola safar sahifasiga olib boradi, mashina
 * harakatini ko'rsatmaydi (backend koordinata bermaydi). Matn shuni
 * yashirmaydi — «shu safarga chiqdim» deydi, «meni kuzatib turing» demaydi.
 *
 * Ilovadagi `tripWatchText` bilan bir xil tuzilishda.
 */
export interface TripWatchInput extends ShareRideInput {
  driverName?: string | null;
  plate?: string | null;
  carTitle?: string | null;
}

export const tripWatchText = (ride: TripWatchInput, locale: string): string => {
  const pick = pickFor(locale);
  const route = [ride.from?.trim(), ride.to?.trim()].filter(Boolean).join(' → ');
  const when = formatTripDateTime(ride.departureTime);
  const car = [ride.carTitle?.trim(), ride.plate?.trim().toUpperCase()].filter(Boolean).join(' · ');
  const driver = ride.driverName?.trim();

  const lines = [
    pick('Men shu safarga chiqdim:', 'Я еду этой поездкой:', "I'm taking this ride:"),
    route,
    when,
    driver ? `${pick('Haydovchi', 'Водитель', 'Driver')}: ${driver}` : '',
    car,
  ].filter((line) => line.length > 0);

  return [...lines, '', rideShareUrl(ride.id, locale)].join('\n');
};

export const shareTripWatch = (
  ride: TripWatchInput,
  locale: string
): Promise<'shared' | 'copied' | 'failed'> => shareText(tripWatchText(ride, locale));
