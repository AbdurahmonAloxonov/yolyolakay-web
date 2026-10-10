/**
 * «SAFARIMNI KUZAT» HAVOLASI.
 *
 * 🔴 NIMA BUZUQ EDI (16.09.2026 gacha): ilovadagi «Safarimni kuzat»
 * tugmasi onaga yoki turmush o'rtog'iga shunchaki E'LON HAVOLASINI
 * yuborardi. U yo'nalishni, haydovchini va mashinani ko'rardi —
 * lekin mashina QAYERDALIGINI ko'rmasdi. Ya'ni funksiya nomi va'da
 * bergan narsani bajarmasdi, bu esa xavfsizlik funksiyasida eng yomon
 * holat.
 *
 * Sabab: `GET /rides/{id}/location` begonaga 403 beradi — va bu
 * TO'G'RI, biz uni o'zgartirishni so'ramadik.
 *
 * ✅ Backend 16.09.2026 da KUZATUV TOKENINI qo'shdi va biz uni prodda
 * o'lchadik:
 *
 *   POST /rides/{id}/watch-token      (haydovchi yoki TASDIQLANGAN
 *                                      yo'lovchi) → 201 {token, expires_at}
 *   GET  /rides/{id}/location?watch_token=...     → 200 {lat, lon, heading}
 *                                                   TOKENSIZ ham ishlaydi
 *
 * Xavfsizligi o'lchandi: axlat token 403, bekor qilingach 403, o'sha
 * token BOSHQA safarga 403, KUTAYOTGAN yo'lovchi token ololmaydi.
 *
 * Havola shakli: `/{lang}/trip/{id}?watch=wt_...`
 * Ya'ni odatdagi safar sahifasi — faqat `watch` parametri bilan u
 * mashinani ham ko'rsatadi.
 */

/** Havoladagi parametr nomi — ikkala mijozda AYNAN bir xil bo'lishi shart. */
export const WATCH_PARAM = 'watch';

/** Kuzatuv havolasini yig'adi. */
export function buildWatchUrl(origin: string, locale: string, rideId: string, token: string) {
  return `${origin}/${locale}/trip/${rideId}?${WATCH_PARAM}=${encodeURIComponent(token)}`;
}

/**
 * Havoladan tokenni oladi.
 *
 * ⚠️ Shakl TEKSHIRILADI (`wt_` + 16-bayt hex): manzil qatoridan kelgan
 * har qanday matnni serverga yuborish shart emas. Yaroqsiz bo'lsa
 * `null` — sahifa oddiy e'lon bo'lib ochiladi.
 */
export function readWatchToken(value: string | null | undefined): string | null {
  const t = (value ?? '').trim();
  if (!/^wt_[a-f0-9]{16,64}$/i.test(t)) return null;
  return t;
}
