import type { RideSearchItem } from './types/ride';

/**
 * Safar detali keshi — gateway'da `GET /rides/{id}` YO'Q (404, xat v5 №5), shuning uchun
 * qidiruv natijalari sessionStorage'ga yoziladi va trip/[id] + bidding sahifalari
 * detalni SHU yerdan oladi (topilmasa /rides/my'dan urinadi, keyin "topilmadi" holati).
 * Backend GET /rides/{id} qo'shsa bu fayl butunlay olib tashlanadi.
 */
const KEY = 'ride-cache-v1';
const MAX_ENTRIES = 100;

type CacheMap = Record<string, RideSearchItem>;

function readMap(): CacheMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}') as CacheMap;
  } catch {
    return {};
  }
}

/**
 * Ikkita haydovchi ma'lumotidan to'liqrog'i — maydonma-maydon.
 * Javobda `id` kelib `name` kelmasligi ham uchraydi.
 */
/**
 * Ikkita haydovchi ma'lumotidan to'liqrog'i.
 *
 * 🔴 MAYDONLAR SANAB O'TILMAYDI (2026-08-16). Ilgari bu yerda aniq ro'yxat
 * turardi (id/name/avatar/rating) va u JIMGINA ma'lumot yo'qotardi: modelga
 * yangi maydon qo'shilsa (`phone`, `gender`), birlashtirishdan keyin u
 * yo'qolardi. Aynan shu xato Flutter tomonida topildi — safar tafsiloti
 * yangilangach jins ikonkasi umumiy "odam"ga aylanib qolardi.
 *
 * Endi qoida umumiy: eskisidan boshlaymiz, yangisidan faqat TO'LDIRILGAN
 * qiymatlarni ustiga yozamiz. Yangi maydon qo'shilganda bu yer o'zgarmaydi.
 */
function mergeDriver(
  fresh: RideSearchItem['driver'],
  older: RideSearchItem['driver']
): RideSearchItem['driver'] {
  if (!fresh) return older;
  if (!older) return fresh;
  const out: Record<string, unknown> = { ...older };
  for (const [key, value] of Object.entries(fresh)) {
    // `undefined`/`null`/`''` = "javobda kelmadi", eskisini saqlaymiz.
    // `0` va `false` esa HAQIQIY qiymat — ular o'tishi kerak (reyting 0).
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out as RideSearchItem['driver'];
}

/**
 * Yangi javobni eskisi bilan to'ldiradi (`fresh` ustun).
 *
 * NEGA: `GET /rides/{id}` javobida `driver` BO'LMASLIGI mumkin (jonli kuzatilgan
 * 2026-08-12), qidiruv va bron javoblarida esa bor. Yangisini eskining ustiga
 * shundoq qo'ysak, safar sahifasida haydovchi ismi yo'qoladi va tarixda
 * "Haydovchini baholash" tugmasi umuman chiqmaydi (u `driver.id` ga tayanadi).
 *
 * Belgilar (`has_ac`, `no_smoking`, ...) va `gender_restriction` ATAYIN
 * to'ldirilmaydi: `undefined` "kelmadi" degani ham, "o'chirildi" degani ham
 * bo'lishi mumkin. Eskisini saqlab qolsak, haydovchi olib tashlagan shartni
 * ("faqat ayollar") bor deb ko'rsatib qo'yishimiz mumkin — bu yo'qolgan
 * belgidan battar. Holat, o'rindiq va narx esa HAR DOIM yangisidan.
 */
export function mergeRide(
  fresh: RideSearchItem,
  older: RideSearchItem | null | undefined
): RideSearchItem {
  if (!older) return fresh;
  return {
    ...fresh,
    origin_address: fresh.origin_address || older.origin_address,
    destination_address: fresh.destination_address || older.destination_address,
    origin_lat: fresh.origin_lat || older.origin_lat,
    origin_lon: fresh.origin_lon || older.origin_lon,
    destination_lat: fresh.destination_lat || older.destination_lat,
    destination_lon: fresh.destination_lon || older.destination_lon,
    departure_time: fresh.departure_time || older.departure_time,
    price_per_seat: fresh.price_per_seat || older.price_per_seat,
    status: fresh.status || older.status,
    driver: mergeDriver(fresh.driver, older.driver),
    stops: fresh.stops?.length ? fresh.stops : older.stops,
    pickup_point: fresh.pickup_point ?? older.pickup_point,
    // Uchrashuv nuqtasining koordinatasi ham matn bilan BIRGA yashaydi:
    // biri yangi javobda kelib, ikkinchisi kelmasa xaritadagi nuqta
    // matndan boshqa joyni ko'rsatib qolardi.
    pickup_lat: fresh.pickup_lat ?? older.pickup_lat,
    pickup_lon: fresh.pickup_lon ?? older.pickup_lon,
    car: fresh.car ?? older.car,
    vehicle_id: fresh.vehicle_id ?? older.vehicle_id,
  };
}

export function cacheRides(rides: RideSearchItem[]): void {
  if (typeof window === 'undefined' || rides.length === 0) return;
  const map = readMap();
  for (const r of rides) {
    // ALMASHTIRMAYMIZ, birlashtiramiz: `GET /rides/{id}` dan kelgan haydovchisiz
    // javob keshdagi to'liq yozuvni yo'q qilib yuborardi — undan keyin bu safarni
    // ochgan HAR BIR sahifa haydovchisiz qolardi.
    if (r?.id) map[r.id] = mergeRide(r, map[r.id]);
  }
  // Sessiya davomida cheksiz o'smasin — eng eski yozuvlarni tashlaymiz.
  const ids = Object.keys(map);
  if (ids.length > MAX_ENTRIES) {
    for (const id of ids.slice(0, ids.length - MAX_ENTRIES)) delete map[id];
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage to'la — kesh shart emas */
  }
}

export function getCachedRide(id: string): RideSearchItem | null {
  return readMap()[id] ?? null;
}
