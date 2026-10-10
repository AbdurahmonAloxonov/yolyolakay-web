import { api, unwrap } from './client';

/**
 * Telematika — haydovchining oxirgi GPS ping'iga tayangan hisob-kitoblar.
 *
 * ✅ XARITADA MASHINA ENDI CHIZILADI: backend `nearby` javobiga
 * `latitude`/`longitude` qo'shdi (2026-08-22), `heading` esa `.com`
 * gateway'ida paydo bo'ldi (2026-08-27). Ilgari faqat `distance` bor edi
 * va taxminiy nuqta chizish yolg'on bo'lardi.
 *
 * 🔴 PING SAYTDAN YUBORILMAYDI: haydovchi ruldа brauzer ochib o'tirmaydi,
 * PWA esa fon rejimida joylashuv bermaydi. Ping — ILOVANING ishi
 * (`LivePing`), sayt faqat NATIJANI o'qiydi.
 */
export interface EtaInfo {
  /** Daqiqada — backend `eta_minutes` beradi. */
  minutes?: number;
  seconds?: number;
}

/**
 * Haydovchining berilgan nuqtaga yetib borish vaqti.
 *
 * Xato YUTILADI (`null`): ETA ikkinchi darajali ma'lumot va uning
 * yiqilishi safar sahifasini buzmasligi kerak.
 */
export async function getEta(
  driverId: string,
  targetLat: number,
  targetLon: number
): Promise<EtaInfo | null> {
  try {
    const res = await api.get('/telematics/eta', {
      params: { driver_id: driverId, target_lat: targetLat, target_lon: targetLon },
      skipErrorToast: true,
    });
    const raw = unwrap<Record<string, unknown>>(res);
    const minutes = Number(raw?.eta_minutes);
    const seconds = Number(raw?.eta_seconds);
    if (!Number.isFinite(minutes) && !Number.isFinite(seconds)) return null;
    return {
      minutes: Number.isFinite(minutes) ? minutes : undefined,
      seconds: Number.isFinite(seconds) ? seconds : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * HAYDOVCHINING OXIRGI MA'LUM JOYI — safar boshlangach xaritada.
 *
 * 🔴 NEGA ENDI MUMKIN: `GET /telematics/nearby` 2026-08-22 dan
 * `latitude`/`longitude` qaytaradi. Ilgari faqat `distance` bor edi va
 * biz mashinani xaritaga QO'YMAGANDIK — taxminiy nuqta chizish yolg'on
 * bo'lardi.
 *
 * ⚠️ `nearby` berilgan NUQTA ATROFIDA qidiradi, shuning uchun safar
 * boshlanish nuqtasi atrofida katta radius bilan so'raymiz. Radius
 * METRDA (o'lchandi).
 *
 * ⚠️ "Jonli kuzatuv" DEB ATALMAYDI: haydovchi ilovani yopsa ping
 * to'xtaydi va nuqta eskiradi.
 */
export interface DriverPosition {
  lat: number;
  lon: number;
  /**
   * Jonli tezlik (km/soat) — javobda bor, lekin 17.09.2026 gacha
   * O'QILMASDAN tashlanardi.
   *
   * ⚠️ ETA hisobida ISHLATILMAYDI (svetoforda turgan mashina «0» beradi
   * va vaqt cheksizlikka ketadi) — faqat KO'RSATILADI.
   */
  speedKmh?: number;
  /**
   * Oxirgi ping VAQTI (ISO).
   *
   * 🔑 Bu ma'lumotning ENG MUHIM qismi: haydovchi ilovani yopsa nuqta
   * joyida qotib qoladi va xarita «hammasi joyida» deb ko'rsataveradi.
   * Vaqtni ko'rsatmasdan jonli kuzatuv YOLG'ON bo'ladi.
   */
  updatedAt?: string;
  /**
   * 🔴 METRDA, kilometrda EMAS (30.08.2026 da o'lchandi: ping nuqtasidan
   * 1 km narida javob `1000.99`, 10 km da `10010.4`).
   *
   * ⚠️ `GET /rides/{id}/location` bu maydonni BERMAYDI — u faqat
   * `nearby` javobida bor edi. Masofa mijozda hisoblanadi.
   */
  distanceMeters?: number;
  /**
   * Harakat yo'nalishi — shimoldan soat strelkasi bo'yicha, gradusda.
   *
   * Qizig'i: ilova buni ALLAQACHON yuborardi (`POST /telematics/ping`),
   * lekin hech kim qaytib o'qimasdi. Ishonchsiz qiymat (qurilma kompasi
   * bermasa Android `-1` beradi) O'TKAZILMAYDI — mashinani noto'g'ri
   * burgandan ko'ra burmagan yaxshi.
   */
  heading?: number;
}

/**
 * SAFAR BO'YICHA haydovchining joyi — `GET /rides/{id}/location`.
 *
 * 🔴 NEGA `nearby` EMAS (2026-09-04): biz backenddan `nearby` ni
 * yopishni so'ragandik va u YOPILDI — endi u faqat haydovchiga ochiq,
 * yo'lovchi 403 oladi:
 *   «nearby driver telemetry is restricted to drivers.
 *    Passengers must use /api/v1/rides/{id}/location»
 * Ya'ni eski chaqiruv jimgina `null` qaytarib, xaritada mashina
 * UMUMAN chizilmay qolardi. O'lchandi: yo'lovchi 403, haydovchi 200.
 *
 * 🔑 Yangi manzil to'g'ri narsani ham qiladi: u AYNAN shu safarning
 * haydovchisini beradi (ilgari butun shahar ro'yxatidan `driver_id`
 * bo'yicha izlardik) va ruxsatni serverning o'zi tekshiradi —
 * tasdiqlanmagan bron ham, begona odam ham 403 oladi (o'lchandi).
 *
 * ⚠️ Javobda `distance` YO'Q — masofa mijozda hisoblanadi.
 */
/**
 * Natija — nuqta VA nega yo'qligi.
 *
 * 🔴 NEGA SABAB KERAK (17.09.2026): mehmon safar sahifasini ochganda
 * server 403 qaytaradi (bu TO'G'RI: jonli joy faqat haydovchi,
 * tasdiqlangan yo'lovchi va kuzatuv havolasi uchun). Ekran esa
 * «haydovchi joylashuvni hali yubormagan» deb yozardi — YOLG'ON:
 * haydovchi yuborgan, shunchaki bu odamga ko'rsatilmaydi.
 */
export interface DriverPositionResult {
  pos: DriverPosition | null;
  /** Server RUXSAT bermadi (403/401) — ma'lumot bor, lekin bu odamga emas. */
  forbidden: boolean;
}

export async function getRideDriverPosition(
  rideId: string,
  /**
   * KUZATUV TOKENI — oila a'zosi uchun (`?watch=` havolasi).
   *
   * Berilsa so'rov TOKENSIZ ham ishlaydi: server ruxsatni shu token
   * bo'yicha tekshiradi. Izohi `shared/lib/watchLink.ts` da.
   */
  watchToken?: string | null
): Promise<DriverPositionResult> {
  try {
    const res = await api.get(`/rides/${rideId}/location`, {
      skipErrorToast: true,
      ...(watchToken ? { params: { watch_token: watchToken } } : {}),
    });
    const row = unwrap<Record<string, unknown>>(res);
    /*
     * 🔴 BITTA ENDPOINT — IKKI XIL SHAKL (16.09.2026 da o'lchandi):
     *
     *   tokenli   → {driver_id, latitude, longitude, speed, heading}
     *   watch_token → {lat, lon, heading}          ← PII kamaytirilgan
     *
     * Ikkinchisida maydon nomlari QISQA. Faqat `latitude` ni o'qisak,
     * kuzatuv havolasi orqali kelgan javob jimgina `null` bo'lib,
     * oila a'zosi mashinani KO'RMAY qolardi.
     */
    const lat = Number(row?.latitude ?? row?.lat);
    const lon = Number(row?.longitude ?? row?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { pos: null, forbidden: false };
    const heading = Number(row?.heading);
    const speed = Number(row?.speed);
    const updatedAt = typeof row?.updated_at === 'string' ? row.updated_at : undefined;
    return {
      pos: {
        lat,
        lon,
        heading: Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : undefined,
        // ⚠️ Manfiy yoki aql bovar qilmaydigan tezlik o'tkazilmaydi.
        speedKmh: Number.isFinite(speed) && speed >= 0 && speed < 300 ? speed : undefined,
        updatedAt,
      },
      forbidden: false,
    };
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    return { pos: null, forbidden: status === 403 || status === 401 };
  }
}
