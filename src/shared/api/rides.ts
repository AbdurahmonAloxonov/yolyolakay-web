import { api, unwrap } from './client';
import type {
  BookRideRequest,
  Booking,
  MyRide,
  PublishRideRequest,
  PublishRideResponse,
  RideSearchItem,
  RideSearchParams,
  DriverStatistics,
  DriverProfile,
} from './types/ride';

/**
 * Rides — safar hayot sikli: draft -> active -> in_progress -> completed.
 * ⚠ ENG MUHIM: POST /rides/ `draft` yaratadi va u qidiruvda CHIQMAYDI —
 * yaratishdan keyin DARHOL activate() chaqirilishi SHART (createAndActivate ishlating).
 * ⚠ GET /rides/{id} gateway'da YO'Q — detal ma'lumot search natijasi yoki getMyRides'dan.
 */

export async function createRide(body: PublishRideRequest): Promise<PublishRideResponse> {
  // DIQQAT: yo'l oxiridagi slash Swagger'dagidek (/rides/ — slashsiz 404/redirect bo'lishi mumkin).
  // skipErrorToast: create-trip sahifasi xatoni O'ZI tushunarli/lokalizatsiya bilan ko'rsatadi —
  // global "Tizimda xatolik" toast'i DUBLIKAT bo'lmasin (500'da ikki toast chiqardi).
  const res = await api.post('/rides/', body, { skipErrorToast: true });
  return unwrap<PublishRideResponse>(res);
}

/**
 * Bitta safar detali — backend v6 javobida qo'shilgani e'lon qilindi (GET /rides/{id});
 * 2026-07-19 stagingda HALI 404 — shuning uchun 404/xato null qaytaradi va chaqiruvchilar
 * rideCache/rides-my fallback'lariga o'tadi. Deploy bo'lishi bilan avtomatik ishlaydi.
 */
export async function getRide(rideId: string): Promise<RideSearchItem | null> {
  try {
    const res = await api.get(`/rides/${rideId}`, { skipErrorToast: true });
    const body = unwrap<RideSearchItem | { ride: RideSearchItem | null }>(res);
    const ride = (body as { ride?: RideSearchItem })?.ride ?? (body as RideSearchItem);
    return ride && (ride as RideSearchItem).id ? (ride as RideSearchItem) : null;
  } catch {
    return null;
  }
}

/** draft -> active. Bularsiz safar qidiruvda ko'rinmaydi.
 *  skipErrorToast: chaqiruvchi "yaratildi lekin faollashmadi" holatini o'zi ishlaydi. */
/**
 * Safarning TASDIQLANGAN yo'lovchilari — `GET /rides/{id}/passengers`.
 *
 * 🔒 Backend faqat HAYDOVCHIGA va TASDIQLANGAN yo'lovchilarga ochadi
 * (boshqasiga 403, o'lchandi 12.09.2026 — ilgari telefon HAR KIMGA
 * ochiq edi, RBAC bilan yopildi). Aloqasiz odam yoki xato → BO'SH
 * ro'yxat: chaqiruvchi «hamrohlar» blokini umuman chizmaydi, ekranda
 * «kirish yo'q» xatosi ko'rinmaydi. Ilovadagi juftligi:
 * `RidesRepository.passengers`.
 */
/**
 * Safarning TASDIQLANGAN yo'lovchilari — TELEFONLARI BILAN.
 *
 * ⚠️ RBAC: faqat haydovchi va o'sha safarning TASDIQLANGAN yo'lovchisi
 * ochadi. Mehmonga 401, begonaga 403, hatto bron qilib hali
 * tasdiqlanmagan (pending) odamga ham 403 — hammasi jonli o'lchandi
 * (14.09.2026). Shuning uchun BU FUNKSIYANI ochiq safar sahifasida
 * chaqirmang: u yerdagi ro'yxat `GET /rides/{id}` javobidagi
 * `passengers[]` dan olinadi (telefonsiz, lekin HAMMAGA ochiq).
 *
 * Bu funksiya haydovchi ekranlari uchun qoladi — koordinatsiya uchun
 * telefon aynan o'sha yerda kerak.
 */
export async function getRidePassengers(rideId: string): Promise<DriverProfile[]> {
  try {
    const res = await api.get(`/rides/${rideId}/passengers`, { skipErrorToast: true });
    const body = unwrap<DriverProfile[] | { passengers: DriverProfile[] | null }>(res);
    if (Array.isArray(body)) return body;
    return body?.passengers ?? [];
  } catch {
    return [];
  }
}

export async function activateRide(rideId: string): Promise<void> {
  await api.post(`/rides/${rideId}/activate`, {}, { skipErrorToast: true });
}

export async function startRide(rideId: string): Promise<void> {
  await api.post(`/rides/${rideId}/start`);
}

export async function completeRide(rideId: string): Promise<void> {
  await api.post(`/rides/${rideId}/complete`);
}

export async function cancelRide(rideId: string, reason?: string): Promise<void> {
  // skipErrorToast: chaqiruvchilar holatga mos xabar beradi (masalan "hozir bekor qilib bo'lmaydi").
  await api.post(`/rides/${rideId}/cancel`, reason ? { reason } : {}, { skipErrorToast: true });
}

/** Radius KM — origin VA dest ikkalasidan (AND). Sana/gender filtri backend'da YO'Q — klientda. */
export async function searchRides(params: RideSearchParams): Promise<RideSearchItem[]> {
  const res = await api.get('/rides/search', { params });
  const body = unwrap<RideSearchItem[] | { rides: RideSearchItem[] | null }>(res);
  // Jonli kuzatilgan: bo'sh natija {"rides":null} shaklida ham keladi.
  if (Array.isArray(body)) return body;
  return body?.rides ?? [];
}

/**
 * O'z safarlarim (HAYDOVCHI) — jonli shakl (2026-07-18): {rides:[...]}, har ride'da
 * driver_id BOR; bronlar bo'lsa ride.bookings[]da kutiladi (bo'sh bo'lsa kalit yo'q).
 * DIQQAT: role=passenger BUTUNLAY BOSHQA shakl qaytaradi — getMyBookings'ni ishlating.
 */
/**
 * Haydovchi statistikasi/daromadi. Fon-o'qish: xatoda ekran "yuklab bo'lmadi"
 * holatini O'ZI ko'rsatadi, global "Tizimda xatolik" toasti kerak emas.
 *
 * Javob envelope bilan ham, xom ham kelishi mumkin (`unwrap` ikkalasini oladi);
 * maydonlar yo'q bo'lsa `undefined` qoladi — ekran "—" chizadi, 0 EMAS
 * (0 daromad va "ma'lumot yo'q" bir xil ko'rinmasin).
 */
export async function getDriverEarnings(): Promise<DriverStatistics> {
  const res = await api.get('/rides/earnings', { skipErrorToast: true });
  return unwrap<DriverStatistics>(res) ?? {};
}

/**
 * Tavsiyalar — `GET /rides/recommendations`.
 *
 * 🔴 2026-08-07: sxema NIHOYAT hujjatlashtirildi va u kutganimizdan BOSHQA chiqdi.
 * Ruchka SAFAR emas, YO'NALISH STATISTIKASI qaytaradi:
 *
 *   by_your_routes → RouteStats {from, to, trips_count}
 *   popular        → RouteStats {from, to, trips_count}
 *   new_directions → CityStats  {city, lat, lon}
 *
 * Ilgari bu yerda "safarga o'xshagan" elementlar izlanardi (`id` + manzil MAJBURIY
 * edi). Bu obyektlarda `id` UMUMAN yo'q — ya'ni parser DOIM bo'sh massiv qaytarardi
 * va "Siz uchun" bloki HECH QACHON chizilmasdi. Xato ko'rinmagani uchun (blok
 * shunchaki yo'q edi) bu sezilmay qolgan.
 *
 * Endi blok yo'nalish kartochkalarini ko'rsatadi va bosilganda qidiruvga o'tkazadi.
 */
export interface RecommendedRoute {
  from: string;
  to: string;
  /** Shu yo'nalishdagi safarlar soni — faqat musbat bo'lsa ko'rsatiladi. */
  tripsCount?: number;
}

export interface RecommendedCity {
  city: string;
  lat?: number;
  lon?: number;
}

export interface RideRecommendations {
  byYourRoutes: RecommendedRoute[];
  popular: RecommendedRoute[];
  newDirections: RecommendedCity[];
}

const EMPTY_RECOMMENDATIONS: RideRecommendations = {
  byYourRoutes: [],
  popular: [],
  newDirections: [],
};

const asRoute = (x: unknown): RecommendedRoute | null => {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const from = typeof r.from === 'string' ? r.from.trim() : '';
  const to = typeof r.to === 'string' ? r.to.trim() : '';
  if (!from || !to) return null;
  const n = Number(r.trips_count ?? r.tripsCount);
  return { from, to, tripsCount: Number.isFinite(n) && n > 0 ? n : undefined };
};

const asCity = (x: unknown): RecommendedCity | null => {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const city = typeof r.city === 'string' ? r.city.trim() : '';
  if (!city) return null;
  const lat = Number(r.lat);
  const lon = Number(r.lon);
  return {
    city,
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
  };
};

/** Javobni hujjatlashtirilgan sxemaga ajratadi (eksport — testlash uchun). */
export function normalizeRecommendations(body: unknown): RideRecommendations {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return EMPTY_RECOMMENDATIONS;

  // `{data:{...}}` / `{recommendations:{...}}` o'ramidan chiqamiz — gateway ba'zi
  // ruchkalarda javobni shunday o'raydi.
  let root = body as Record<string, unknown>;
  for (const key of ['data', 'recommendations']) {
    const inner = root[key];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      root = inner as Record<string, unknown>;
    }
  }

  const arr = (key: string): unknown[] =>
    Array.isArray(root[key]) ? (root[key] as unknown[]) : [];

  return {
    byYourRoutes: arr('by_your_routes')
      .map(asRoute)
      .filter((r): r is RecommendedRoute => r !== null),
    popular: arr('popular')
      .map(asRoute)
      .filter((r): r is RecommendedRoute => r !== null),
    newDirections: arr('new_directions')
      .map(asCity)
      .filter((c): c is RecommendedCity => c !== null),
  };
}

/**
 * Shaxsiy tavsiyalar. Fon-o'qish: xato bo'lsa blok chizilmaydi, global toast kerak emas
 * (foydalanuvchi buni so'ramagan — qidiruv sahifasi baribir ishlaydi).
 */
export async function getRideRecommendations(): Promise<RideRecommendations> {
  const res = await api.get('/rides/recommendations', { skipErrorToast: true });
  return normalizeRecommendations(unwrap<unknown>(res));
}

export async function getMyRides(role: 'driver' | 'passenger', status?: string): Promise<MyRide[]> {
  // Fon-o'qish — sahifa (tarix) xatoda bo'sh holatni ko'rsatadi; global "Tizimda xatolik"
  // toast'i CHIQMASIN (foydalanuvchi shunchaki sahifani ochганда qo'rqitmaydi).
  const res = await api.get('/rides/my', {
    params: { role, ...(status ? { status } : {}) },
    skipErrorToast: true,
  });
  const body = unwrap<MyRide[] | { rides: MyRide[] | null }>(res);
  if (Array.isArray(body)) return body;
  return body?.rides ?? [];
}

/**
 * O'z bronlarim (YO'LOVCHI) — jonli shakl (2026-07-18): GET /rides/my?role=passenger
 * SAFARLARNI EMAS, {bookings:[...]} qaytaradi. Maydonlar PascalCase (ID, RideID,
 * PassengerID, SeatsBooked, OfferedPrice(null bo'lishi mumkin), Status) — chaqiruvchi
 * normalizeBooking (shared/lib/format) bilan bir shaklga keltiradi.
 * Safar detali (marshrut/narx) BU javobda YO'Q — rideCache'dan olinadi.
 */
export async function getMyBookings(): Promise<Record<string, unknown>[]> {
  // Fon-o'qish — global xato-toast'siz (tarix sahifasi bo'sh holatni ko'rsatadi).
  const res = await api.get('/rides/my', {
    params: { role: 'passenger' },
    skipErrorToast: true,
  });
  const body = unwrap<{ bookings: Record<string, unknown>[] | null }>(res);
  return body?.bookings ?? [];
}

// ===== Booking =====

/**
 * Yo'lovchi bron qiladi. Maydon `seats` (seats_booked EMAS).
 * Jonli javob (2026-07-18): {booking:{...PascalCase...}, message} — booking'ni ochamiz.
 * Status: narx haydovchinikidan farq qilsa `pending_negotiation`, aks holda `pending`.
 */
export async function bookRide(rideId: string, body: BookRideRequest): Promise<Booking> {
  const res = await api.post(`/rides/${rideId}/book`, body);
  const raw = unwrap<{ booking?: Booking } | Booking>(res);
  return ((raw as { booking?: Booking })?.booking ?? raw) as Booking;
}

/** Haydovchi qabul qiladi -> bron statusi `confirmed` (accepted EMAS). */
export async function acceptBooking(rideId: string, bookingId: string): Promise<void> {
  await api.post(`/rides/${rideId}/bookings/${bookingId}/accept`);
}

export async function rejectBooking(rideId: string, bookingId: string): Promise<void> {
  await api.post(`/rides/${rideId}/bookings/${bookingId}/reject`);
}

/**
 * YO'LOVCHI o'z bronini bekor qiladi.
 *
 * 🔴 SAYTDA BU UMUMAN YO'Q EDI. Sabab: gateway'da yo'lovchi uchun bekor
 * qilish ruchkasi bo'lmagan — faqat `reject` (HAYDOVCHI rad etadi) va
 * `rides/{id}/cancel` (haydovchi safarni bekor qiladi). Ya'ni fikri
 * o'zgargan yo'lovchining yagona yo'li — kelmay qo'yish edi. Haydovchi esa
 * uni kutib, o'rindiqni boshqaga bermay turardi.
 *
 * ✅ 2026-08-27: backend ikkala yo'lni ochdi (jonli sxema bilan sverka
 * qilindi, `http.CancelBookingRequest`, `reason` IXTIYORIY):
 *   `POST /rides/{id}/bookings/{booking_id}/cancel`  ← shu ishlatiladi
 *   `POST /bookings/{id}/cancel`                     ← gateway proksisi
 * Safar kontekstidagisi tanlandi: qolgan hamma bron amali (`accept`,
 * `reject`, `no-show`, `counter`) aynan shu shaklda.
 *
 * skipErrorToast: chaqiruvchi o'z xabarini ko'rsatadi.
 */
export async function cancelBooking(
  rideId: string,
  bookingId: string,
  reason?: string
): Promise<void> {
  await api.post(`/rides/${rideId}/bookings/${bookingId}/cancel`, reason ? { reason } : {}, {
    skipErrorToast: true,
  });
}

/**
 * Haydovchi O'Z narxini qaytaradi (savdolashish).
 *
 * ✅ 2026-08-13: endpoint backendda PAYDO BO'LDI va aynan biz taklif qilgan
 * shaklda (`BACKEND_XAT_SAVDOLASHISH_2026-08-10.txt`). Jonli swaggerda
 * tekshirildi: `http.CounterBookingRequest`, majburiy maydon `new_price`.
 * Shuning uchun UI bayrog'i endi standart YOQILGAN.
 */
export async function counterOffer(
  rideId: string,
  bookingId: string,
  newPrice: number
): Promise<void> {
  await api.post(
    `/rides/${rideId}/bookings/${bookingId}/counter`,
    { new_price: newPrice },
    { skipErrorToast: true }
  );
}

export async function markNoShow(rideId: string, bookingId: string): Promise<void> {
  // skipErrorToast: chaqiruvchi o'z xabarini ko'rsatadi (404 = funksiya hali yo'q).
  await api.post(`/rides/${rideId}/bookings/${bookingId}/no-show`, {}, { skipErrorToast: true });
}

/**
 * YO'NALISH OBUNASI — «shu yo'nalishda safar chiqsa xabar bering».
 *
 * 🔴 NEGA KERAK: qidiruv bo'sh chiqsa odam ketadi va uni QAYTARIB
 * chaqirishning yo'li yo'q edi. Ayni holat bugun ommaviy: prodda
 * haydovchi safar e'lon qila olmayapti (backend migratsiyasi), ya'ni
 * qidiruv hammaga bo'sh chiqadi.
 *
 * ✅ Backend `/rides/route-subscriptions` ni 2026-08-27 da ochdi va
 * jonli sxema bilan sverka qilindi: koordinatalar MAJBURIY,
 * `departure_date` ixtiyoriy. Ilovada allaqachon ulangan
 * (`RidesRepository.createRouteSubscription`), saytda YO'Q edi.
 *
 * ⚠️ Obuna FAQAT koordinatani saqlaydi — shahar nomi ham, radius ham
 * yo'q. Shuning uchun ro'yxatni ko'rsatishda nomlar mahalliy saqlanadi.
 *
 * Xato bo'lsa `null` — chaqiruvchi uchun bu to'sar emas.
 */
export async function createRouteSubscription(body: {
  origin_lat: number;
  origin_lon: number;
  dest_lat: number;
  dest_lon: number;
  departure_date?: string;
}): Promise<string | null> {
  try {
    const res = await api.post('/rides/route-subscriptions', body, { skipErrorToast: true });
    const raw = unwrap<{ id?: string }>(res);
    return raw?.id || null;
  } catch {
    return null;
  }
}

export async function deleteRouteSubscription(id: string): Promise<void> {
  // Obuna serverda qolib ketsa eng yomoni — ortiqcha xabar. Odamni
  // xato bilan bezovta qilmaymiz.
  await api.delete(`/rides/route-subscriptions/${id}`, { skipErrorToast: true }).catch(() => {});
}

/**
 * KUZATUV TOKENI — «Safarimni kuzat» havolasi uchun.
 *
 * Faqat haydovchi yoki TASDIQLANGAN yo'lovchi ola oladi; kutayotgan
 * bron ham, begona odam ham 403 oladi (16.09.2026 da prodda
 * o'lchandi). Izohi `shared/lib/watchLink.ts` da.
 *
 * Xato bo'lsa `null` — chaqiruvchi sababni odamga AYTADI, jimgina
 * yutmaydi.
 */
export async function createWatchToken(rideId: string): Promise<string | null> {
  try {
    const res = await api.post(`/rides/${rideId}/watch-token`, {}, { skipErrorToast: true });
    const raw = unwrap<{ token?: string }>(res);
    return raw?.token || null;
  } catch {
    return null;
  }
}

/**
 * HAYDOVCHINING OCHIQ SAFARLARI — begona odam profilida ko'rsatish uchun.
 *
 * ✅ 16.09.2026 da backend ochdi va biz o'lchadik: mehmonga ham 200,
 * javobda faqat marshrut/vaqt/narx/holat — yo'lovchi, telefon va bron
 * YO'Q. Ilgari bunday ruchka umuman yo'q edi (404/404/400).
 *
 * Ikkinchi manzil (`/rides/driver/{id}`) ZAXIRA: ikkalasi ham bor
 * deb aytilgan, lekin biri o'chsa profil buzilmasin.
 */
export async function getDriverRides(driverId: string): Promise<MyRide[]> {
  const read = async (path: string) => {
    const res = await api.get(path, { skipErrorToast: true });
    const body = unwrap<MyRide[] | { rides: MyRide[] | null }>(res);
    return Array.isArray(body) ? body : (body?.rides ?? []);
  };
  try {
    return await read(`/users/${driverId}/rides`);
  } catch {
    try {
      return await read(`/rides/driver/${driverId}`);
    } catch {
      return [];
    }
  }
}
