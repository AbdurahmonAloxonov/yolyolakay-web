import { api } from './client';

/**
 * Yo'l marshruti — BIZNING backend OSM dvigatelidan.
 *
 * 🔴 Egasi (2026-08-20): Yandex O'RNIGA backend `/routing/route` (ilova bilan
 * bir manba). Endpoint FAQAT origin->dest oladi, shuning uchun oraliq bekatli
 * marshrutda juftlar so'raladi va geometriya ULANADI.
 *
 * ⚠️ Swagger `domain.Route` schemasida `geometry` yozilmagan, lekin jonli
 * javobda bor (o'lchandi 2026-08-20): {distance(m), duration(s),
 * geometry:[{latitude, longitude}]}.
 */
export interface RoadRoute {
  points: [number, number][]; // [lat, lon]
  distanceMeters: number | null;
  seconds: number | null;
  /**
   * HAQIQIY YO'Lmi yoki kirish nuqtalari orasidagi TO'G'RI chiziqmi.
   *
   * 🔴 NEGA (28.09.2026, egasi: «xaritada to'g'ri chiziqlar, rasvo»):
   * xato bo'lsa `points` ga kirish nuqtalarining o'zi qaytardi va
   * chaqiruvchi uni `points.length >= 2` bilan «yo'l keldi» deb o'qirdi —
   * to'g'ri chiziq haqiqiy yo'l uslubida chizilardi, `/map` dagi uzuq
   * «kutilmoqda» uslubi esa yiqilgan so'rovdan keyin HECH QACHON
   * ko'rinmasdi. Endi farqni faqat shu belgi aytadi.
   */
  isReal: boolean;
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}
interface RouteResponse {
  distance?: number;
  duration?: number;
  geometry?: GeoPoint[];
}

async function segment(
  a: [number, number],
  b: [number, number]
): Promise<{ pts: [number, number][]; dist: number; dur: number } | null> {
  try {
    const res = await api.get<RouteResponse>('/routing/route', {
      params: { origin_lat: a[0], origin_lon: a[1], dest_lat: b[0], dest_lon: b[1] },
      skipErrorToast: true,
    });
    const g = res.data?.geometry;
    if (!Array.isArray(g) || g.length < 2) return null;
    const pts = g
      .filter((p) => typeof p?.latitude === 'number' && typeof p?.longitude === 'number')
      .map((p) => [p.latitude, p.longitude] as [number, number]);
    if (pts.length < 2) return null;
    return { pts, dist: res.data?.distance ?? 0, dur: res.data?.duration ?? 0 };
  } catch {
    return null;
  }
}

const straight = (waypoints: [number, number][]): RoadRoute => ({
  points: waypoints,
  distanceMeters: null,
  seconds: null,
  isReal: false,
});

/*
 * 🔴 KESH (28.09.2026). Javob 2–4 soniya keladi (jonli: Toshkent–Samarqand
 * 2.4 s, Namangan–Toshkent 4.1 s) va shu vaqt xaritada to'g'ri chiziq
 * turadi. `useRoadRoute` react-query orqali keshlanardi, lekin safar
 * ko'rigi (`RoutePreviewInner`) va marshrut varag'i (`RouteMapSheet`)
 * `fetchRoadRoute` ni TO'G'RIDAN chaqirardi — bir sahifada bir yo'l
 * ikki marta so'ralardi. Endi kesh shu yerda: `Promise` saqlanadi (ikki
 * xarita bir vaqtda so'rasa ham bitta so'rov), faqat HAQIQIY yo'l
 * qoladi — xato keyingi safar qayta uriniladi. Ilovadagi juftligi —
 * `road_route.dart`.
 */
const CACHE_MAX = 200;
const cache = new Map<string, Promise<RoadRoute>>();

/** ~11 m aniqlik: bir markazdan chiqqan safarlar bitta yozuvga tushadi. */
export const routeKey = (pts: [number, number][]) =>
  pts.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join('|');

/**
 * [waypoints] bo'ylab marshrut. Hech qachon xato tashlamaydi: yo'l
 * topilmasa — kirish nuqtalari (`isReal: false`), xarita bo'sh qolmaydi.
 */
export function fetchRoadRoute(waypoints: [number, number][]): Promise<RoadRoute> {
  if (waypoints.length < 2) return Promise.resolve(straight(waypoints));
  const key = routeKey(waypoints);
  const hit = cache.get(key);
  if (hit) return hit;

  const p = load(waypoints);
  cache.set(key, p);
  p.then((r) => {
    if (!r.isReal) cache.delete(key);
  });
  // Cheksiz o'smasin: Map qo'shilish tartibini saqlaydi — eng eskisi chiqadi.
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return p;
}

async function load(waypoints: [number, number][]): Promise<RoadRoute> {
  /*
   * Endpoint FAQAT ikki nuqta oladi — bekatli marshrut bo'laklarga
   * bo'linadi. Bo'laklar PARALLEL so'raladi: ilgari ketma-ket edi va
   * uch bekatli safarda to'g'ri chiziq 10 soniyadan ortiq turardi.
   */
  const segs = await Promise.all(
    waypoints.slice(0, -1).map((a, i) => segment(a, waypoints[i + 1]))
  );
  // Bitta bo'lak ham yiqilsa marshrut HAQIQIY YO'L emas: yarmi yo'l,
  // yarmi chizg'ich izi bo'lgan chiziq va chala masofa — ikkalasi ham
  // yolg'on. Butunicha taxminiy ko'rsatiladi.
  if (segs.some((s) => !s)) return straight(waypoints);

  const all: [number, number][] = [];
  let dist = 0;
  let dur = 0;
  for (const seg of segs) {
    // Takroriy ulanish nuqtasi bo'lmasin.
    all.push(...(all.length > 0 ? seg!.pts.slice(1) : seg!.pts));
    dist += seg!.dist;
    dur += seg!.dur;
  }
  if (all.length < 2) return straight(waypoints);
  return {
    points: all,
    distanceMeters: dist > 0 ? dist : null,
    seconds: dur > 0 ? Math.round(dur) : null,
    isReal: true,
  };
}

/**
 * BIZNING GEOKODER — `GET /routing/geocode` (18.09.2026 da ULANDI).
 *
 * 🔴 NEGA: manzil qidiruvi shu paytgacha butunlay Nominatim'ning BEPUL
 * jamoat serveriga bog'liq edi (soniyasiga 1 so'rov, istagan paytda
 * bloklashi mumkin). Bu — xuddi xarita plitkalaridagi xavfning o'zi,
 * u 18.09 da yopilgandi. Bizning ruchkamiz esa bor edi va
 * ishlatilmasdan yotardi.
 *
 * Jonli o'lchandi (tokensiz — MEHMONGA OCHIQ):
 *   GET /routing/geocode?q=Samarqand → 200
 *   [{display_name, coordinate:{latitude, longitude}}]
 *
 * ⚠️ JAVOB HAR DOIM RUSCHA: «Самарканд, Самаркандская область». Til
 * parametri YO'Q (`accept-language`, `lang`, `locale` uchalasi ham jim
 * yutiladi — o'lchandi). Nominatim esa o'zbekcha beradi. Shuning uchun
 * bu ALMASHTIRISH emas, ZAXIRA: til parametri qo'shilsa tartib
 * almashtiriladi (backendga xat: `BACKEND_XAT_2026-09-18.txt`).
 *
 * 🔑 Koordinata ICHKI obyektda (`coordinate`), Nominatim'dagidek tekis
 * `lat`/`lon` da EMAS — shakli xato o'qilsa zaxira «ishladi» deb
 * ko'rinib, natija jimgina bo'sh chiqardi.
 */
interface OurGeoRow {
  display_name?: string;
  coordinate?: { latitude?: number; longitude?: number };
}

export async function ourGeocode(query: string): Promise<[number, number] | null> {
  try {
    const res = await api.get<OurGeoRow[]>('/routing/geocode', {
      params: { q: query, limit: 1 },
      skipErrorToast: true,
    });
    const row = Array.isArray(res.data) ? res.data[0] : null;
    const lat = row?.coordinate?.latitude;
    const lon = row?.coordinate?.longitude;
    if (typeof lat === 'number' && typeof lon === 'number') return [lat, lon];
  } catch {
    // Zaxira ham yiqildi — chaqiruvchi o'z yo'lidan ketadi.
  }
  return null;
}

/** Teskari geokod — zaxira (izohi [ourGeocode] da). */
export async function ourReverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await api.get<OurGeoRow>('/routing/reverse-geocode', {
      params: { lat, lon },
      skipErrorToast: true,
    });
    const name = res.data?.display_name;
    return typeof name === 'string' && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}
