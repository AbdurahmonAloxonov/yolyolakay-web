import type { RideSearchItem } from '@/shared/api/types/ride';

/**
 * SERVER tomonidan safarni o'qish — metadata (`generateMetadata`) va SSR uchun.
 *
 * NEGA alohida modul: `shared/api/client.ts` dagi axios brauzer uchun sozlangan —
 * uning `baseURL` i `/api-proxy` (nisbiy yo'l), server tomonda esa nisbiy yo'l
 * ma'nosiz. Bu yerda backend originiga TO'G'RIDAN chiqamiz.
 *
 * 🔓 2026-08-09 dan mumkin bo'ldi: `GET /rides/{id}` endi mehmonga ochiq
 * (tokensiz `404 "ride not found"` qaytaradi, `401` EMAS; swaggerda `security`
 * bloki yo'q). Shu kungacha safar sahifasining HTML'ida faqat "Yuklanmoqda..."
 * turardi — ya'ni Google marketpleysning ASOSIY kontentini umuman ko'rmasdi.
 */

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');

/** Gateway javobi ba'zan `{success,data}` qobig'ida keladi — ikkalasini ham qaraymiz. */
function unwrapBody(body: unknown): unknown {
  if (body && typeof body === 'object' && 'data' in body) {
    const inner = (body as { data?: unknown }).data;
    if (inner) return inner;
  }
  return body;
}

export type RideFetchResult =
  | { kind: 'ok'; ride: RideSearchItem }
  /** Backend aniq aytdi: bunday safar yo'q → sahifa 404 bo'lishi kerak. */
  | { kind: 'not-found' }
  /**
   * Backend javob bermadi (502/tarmoq/timeout). Bu "safar yo'q" degani EMAS —
   * bunda 404 ko'rsatish YOLG'ON bo'lardi va Google mavjud sahifani o'chirib
   * yuborardi. Sahifa odatdagidek chiziladi, ma'lumotni mijoz o'zi so'raydi.
   */
  | { kind: 'unavailable' };

/**
 * Safar id'si — backend UUID beradi, boshqa shakl BO'LMAYDI.
 *
 * 🔴 NEGA QAT'IY TEKSHIRUV (2026-08-31 da o'lchandi): backend endi
 * yaroqsiz id uchun `400 "invalid ride_id"` emas, `401` qaytaradi —
 * ya'ni avval autentifikatsiyani tekshiradi, keyin id shaklini.
 * `401` esa mehmon uchun HAR QANDAY safar id'sida odatiy javob
 * (`mehmon-rejimi` qoidasi), shuning uchun undan «bunday safar yo'q»
 * degan xulosa chiqarib bo'lmaydi.
 *
 * Natijada `/uz/trip/smoke-test-id` prodda `200` qaytarardi — Google
 * uchun bu YUMSHOQ 404 va u indeksga tushadi. Aynan shu holat uchun
 * yozilgan test buni ushladi.
 *
 * Yechim backendga bog'liq emas: UUID bo'lmagan id HECH QACHON
 * haqiqiy safar bo'la olmaydi, demak uni backendga umuman
 * yubormaymiz.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchRideForMetadata(id: string): Promise<RideFetchResult> {
  // Yaroqsiz id bilan backendni bezovta qilmaymiz (bot'lar har xil axlat yo'l so'raydi).
  if (!id || !UUID.test(id)) return { kind: 'not-found' };

  try {
    const res = await fetch(`${BACKEND}/api/v1/rides/${encodeURIComponent(id)}`, {
      // Safar holati (o'rinlar, status) o'zgarib turadi — lekin har bot so'roviga
      // backendni urmaymiz: 5 daqiqa kesh SEO uchun yetarli.
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });

    // 404 — "bunday safar yo'q". 400 — "id umuman yaroqsiz" (`invalid ride_id`):
    // backend UUID kutadi, bizning yuqoridagi regex esa `smoke-test-id` kabi
    // harf-defis satrlarni o'tkazib yuboradi. Ikkalasi ham "bu sahifa yo'q va
    // hech qachon bo'lmaydi" degani, ya'ni HAQIQIY 404 bo'lishi kerak.
    // Ilgari 400 `unavailable` ga tushardi va sahifa 200 qaytarardi — bu Google
    // uchun "yumshoq 404": axlat manzillar indeksga tushishi mumkin edi.
    // ⚠️ `401` bu yerda «yo'q» DEGANI EMAS: mehmonga backend har
    // qanday safar uchun 401 beradi. Yaroqsiz id yuqorida allaqachon
    // ushlangan, shuning uchun 401 → `unavailable` (sahifa ko'rinadi).
    if (res.status === 404 || res.status === 400) return { kind: 'not-found' };
    if (!res.ok) return { kind: 'unavailable' };

    const ride = unwrapBody(await res.json()) as RideSearchItem | null;
    if (!ride || typeof ride !== 'object' || !ride.id) return { kind: 'not-found' };
    return { kind: 'ok', ride };
  } catch {
    return { kind: 'unavailable' };
  }
}

/**
 * Sitemap uchun ochiq safar id'lari.
 *
 * ⚠️ Backendda "hamma safarlar" endpointi YO'Q: `GET /rides/search` jo'nash VA
 * manzil koordinatasini MAJBURIY talab qiladi (swagger 2026-08-09). Shuning uchun
 * mamlakatni qoplaydigan bir nechta keng radiusli yo'nalish so'raladi va natijalar
 * birlashtiriladi. Ideal emas, lekin ochiq ro'yxat paydo bo'lguncha yagona yo'l —
 * backenddan so'ralgan.
 */
const SITEMAP_PROBES: Array<[[number, number], [number, number]]> = [
  [
    [41.311081, 69.240562],
    [39.6542, 66.9597],
  ], // Toshkent ↔ Samarqand (markaz)
  [
    [41.311081, 69.240562],
    [40.7821, 72.3442],
  ], // Toshkent ↔ Andijon (Farg'ona vodiysi)
  [
    [41.311081, 69.240562],
    [42.4611, 59.6111],
  ], // Toshkent ↔ Nukus (g'arb)
  [
    [39.6542, 66.9597],
    [37.2242, 67.2783],
  ], // Samarqand ↔ Termiz (janub)
];

const SITEMAP_RADIUS_KM = 400;
/** Sitemap'da bitta tilga maksimum safar (3 til = 3× URL). */
const SITEMAP_MAX_RIDES = 400;

export async function fetchOpenRideIds(): Promise<string[]> {
  const search = async (
    [oLat, oLon]: [number, number],
    [dLat, dLon]: [number, number]
  ): Promise<string[]> => {
    const qs = new URLSearchParams({
      origin_lat: String(oLat),
      origin_lon: String(oLon),
      dest_lat: String(dLat),
      dest_lon: String(dLon),
      radius_km: String(SITEMAP_RADIUS_KM),
    });
    try {
      const res = await fetch(`${BACKEND}/api/v1/rides/search?${qs}`, {
        next: { revalidate: 3600 },
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      // Bo'sh natijada backend `{"rides": null}` qaytaradi (jonli kuzatilgan) —
      // `?? []` shart, aks holda `.filter` yiqiladi.
      const body = unwrapBody(await res.json()) as { rides?: Array<{ id?: string }> | null };
      const list = Array.isArray(body) ? body : (body?.rides ?? []);
      return (list ?? [])
        .map((r) => (r && typeof r.id === 'string' ? r.id : ''))
        .filter((id): id is string => id.length > 0);
    } catch {
      return [];
    }
  };

  // Ikki yo'nalishda ham (A→B va B→A) — qidiruv yo'nalishga bog'liq.
  const probes = SITEMAP_PROBES.flatMap(([a, b]) => [search(a, b), search(b, a)]);
  const results = await Promise.all(probes);
  return [...new Set(results.flat())].slice(0, SITEMAP_MAX_RIDES);
}
