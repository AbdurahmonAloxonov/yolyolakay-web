/**
 * Tashqi marshrut havolasi — OpenStreetMap (egasi 2026-08-20: "OSM
 * yo'nalishiga o'tkaz"). Ilgari Yandex Navi/Maps edi; endi butun mahsulot
 * OSM ustida (in-app xarita ham). OSM'da jonli turn-by-turn yo'q, marshrut
 * xaritada ko'rsatiladi.
 */

/** Koordinata haqiqiymi (0,0 = aniqlanmagan/standart bo'sh qiymat). */
export const hasValidCoords = (lat?: number | null, lon?: number | null): boolean =>
  typeof lat === 'number' &&
  typeof lon === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  (lat !== 0 || lon !== 0);

/**
 * OpenStreetMap marshrut havolasi: `from` -> `to`, avtomobil (OSRM car).
 * @param from [lat, lon] jo'nash
 * @param to   [lat, lon] borish
 */
export const buildOsmRouteUrl = (from: [number, number], to: [number, number]): string =>
  `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from[0]}%2C${from[1]}%3B${to[0]}%2C${to[1]}`;

/**
 * Marshrutni tashqi xaritada (OSM) ochadi. Yangi tabда — PWA/joriy sahifa
 * saqlanadi.
 */
export const openExternalRoute = (from: [number, number], to: [number, number]): void => {
  window.open(buildOsmRouteUrl(from, to), '_blank', 'noopener,noreferrer');
};
