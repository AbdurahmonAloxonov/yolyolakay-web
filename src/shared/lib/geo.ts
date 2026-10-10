import { ourGeocode, ourReverseGeocode } from '@/shared/api/routing';

/**
 * Geo yordamchilari — FAQAT FORWARD geocoding.
 *
 * Yangi Gateway (2026-07-18): manzil matni backend'dan tayyor keladi
 * (origin_address/destination_address), koordinata yassi raqamlar — shu sabab
 * REVERSE geocoding (koordinata -> nom, "Kashgar mahalla" muammosi) va WKB/EWKT
 * parserlari BUTUNLAY olib tashlandi. Nominatim faqat qidiruv/yaratishda matnni
 * koordinataga o'girish uchun ishlatiladi (forwardGeocode).
 */

// O'zbekcha kelishik qo'shimchalari (eng uzunidan boshlab). "toshkentdan"/"samarqandga"
// yozilsa Nominatim aynan shu so'zni topolmay noto'g'ri POI (mahalla) qaytaradi — kesamiz.
const UZ_CASE_SUFFIXES = ['gacha', 'ning', 'niki', 'dan', 'ga', 'ka', 'qa', 'da', 'ta', 'ni'];

/** So'rov oxiridagi o'zbekcha kelishik qo'shimchasini olib tashlaydi ("toshkentdan" -> "toshkent"). */
export function stripUzCase(query: string): string {
  const q = query.trim();
  const lower = q.toLowerCase();
  for (const suf of UZ_CASE_SUFFIXES) {
    if (lower.endsWith(suf) && lower.length - suf.length >= 3) {
      return q.slice(0, q.length - suf.length);
    }
  }
  return q;
}

/**
 * Matn (shahar/manzil) -> [lat, lon]. Foydalanuvchi xaritani ochmay faqat shahar
 * nomini yozganda koordinatani aniqlash uchun (Nominatim search, O'zbekistonga qaratilgan).
 * Topilmasa null.
 */
export async function forwardGeocode(query: string): Promise<[number, number] | null> {
  const q = stripUzCase(query.trim());
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=uz&accept-language=uz&q=${encodeURIComponent(q)}`
    );
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch {
    // tarmoq xatosi — pastdagi zaxiraga tushamiz
  }
  /*
   * 🔴 ZAXIRA: BIZNING GEOKODER (18.09.2026).
   *
   * Manzil qidiruvi butunlay Nominatim'ning BEPUL jamoat serveriga
   * bog'liq edi — soniyasiga 1 so'rov, istagan paytda bloklashi
   * mumkin. U o'lsa, safar e'lon qilish ham, posilka yuborish ham
   * TO'XTAYDI. Backendda esa `GET /routing/geocode` bor va
   * ishlatilmasdan yotardi (izohi `api/routing.ts` da).
   *
   * ⚠️ ALMASHTIRISH EMAS, ZAXIRA: bizning javob faqat RUSCHA keladi
   * (o'lchandi — til parametri yo'q). Ilovada ham aynan shu tartib
   * (`core/geocoder.dart`).
   */
  return ourGeocode(q);
}

/**
 * Nuqta -> manzil matni (REVERSE) — OSM Nominatim orqali.
 *
 * 🔴 Egasi (2026-08-20): Yandex O'RNIGA OSM. Ilova ham Nominatim reverse
 * ishlatadi (`lib/core/geocoder.dart`). Ehtiyot: reverse ba'zan mayda
 * ma'muriy nom beradi — shuning uchun `zoom=14` (ko'cha/tuman darajasi) va
 * `accept-language=uz`. Topilmasa/xato bo'lsa koordinata matni qaytadi
 * (foydalanuvchi o'zi tahrirlashi mumkin).
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&accept-language=uz&lat=${lat}&lon=${lon}`
    );
    const data = await res.json();
    const name: string | undefined = data?.name || data?.display_name;
    if (name && typeof name === 'string') {
      // display_name uzun bo'lishi mumkin — birinchi 2 bo'lakni olamiz.
      return name.split(',').slice(0, 2).join(',').trim();
    }
  } catch {
    // tarmoq xatosi — zaxiraga tushamiz
  }
  // ZAXIRA — bizning backend (ruscha, lekin ISHLAYDI; izohi yuqorida).
  const ours = await ourReverseGeocode(lat, lon);
  if (ours) return ours.split(',').slice(0, 2).join(',').trim();

  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/**
 * Ikki [lat, lon] nuqta orasidagi masofa (km) — haversine formulasi.
 * Qidiruv natijalarini eng yaqinidan tartiblash va "yaqin atrof · N km" belgisi uchun.
 */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
