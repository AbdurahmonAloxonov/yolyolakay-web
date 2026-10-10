import { haversineKm } from './geo';

/**
 * YO'L GEOMETRIYASI USTIDA HISOB — «qayerda ketyapti» degan savolga javob.
 *
 * 🔴 NEGA YOZILDI (egasi, 17.09.2026): «karta noto'g'ri ishlayapti…
 * tekkis chizib qo'yyapti, safar boshlanganda qayerda ketayotganini
 * ko'rish imkoni yo'q — yana Yandex kartaga kirvolishadi».
 *
 * To'g'ri tanqid. Bizda yo'lning HAQIQIY geometriyasi bor
 * (`GET /routing/route` — Toshkent–Samarqand uchun 3204 nuqta, 322 km,
 * 4 soat 55 daqiqa; jonli o'lchandi 17.09.2026) va haydovchining jonli
 * nuqtasi ham bor. Ularni BIRLASHTIRSAK, xarita «rasm» bo'lishdan
 * chiqib javob beradigan asbobga aylanadi: qancha yurildi, qancha
 * qoldi, qachon yetadi.
 *
 * Bu fayl faqat MATEMATIKA: tarmoq ham, React ham yo'q — shuning uchun
 * uni sinov bilan qoplash oson va ikkala mijozga ko'chirish ham oson.
 */

export type Pt = [number, number];

/**
 * Chiziqni KO'RSATISH uchun siyraklashtirish.
 *
 * ⚠️ NEGA KERAK: Nukus–Andijon yo'li 11 806 nuqta (o'lchandi). Leaflet
 * har nuqtani SVG'ga chizadi va bunday chiziq arzon telefonda xaritani
 * qotirib qo'yadi. Ko'z uchun 600 nuqta yetarli — mamlakat miqyosida
 * ikki qo'shni nuqta orasi bir pikseldan kam.
 *
 * 🔑 HISOB uchun esa TO'LIQ ro'yxat ishlatiladi (`progressOnRoute`):
 * siyraklashtirilgan chiziqda «qancha qoldi» xato chiqadi.
 *
 * Boshi va oxiri DOIM qoladi.
 */
export function simplifyRoute(points: Pt[], maxPoints = 600): Pt[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return out;
}

/** Yo'l bo'ylab to'plangan masofa (km), har nuqta uchun. */
export function cumulativeKm(points: Pt[]): number[] {
  const out = new Array<number>(points.length);
  out[0] = 0;
  for (let i = 1; i < points.length; i++) {
    out[i] = out[i - 1] + haversineKm(points[i - 1], points[i]);
  }
  return out;
}

export interface RouteProgress {
  /** Yo'lning necha foizi bosib o'tilgan (0..1). */
  fraction: number;
  /** Bosib o'tilgan masofa, km. */
  doneKm: number;
  /** Qolgan masofa, km. */
  leftKm: number;
  /** Yo'ldan chetlashish, km — nuqta marshrutga qanchalik yaqin. */
  offRouteKm: number;
  /** Eng yaqin nuqtaning indeksi (chiziqni bo'lish uchun). */
  index: number;
}

/**
 * Mashina yo'lning QAYSI joyida.
 *
 * ⚠️ ENG YAQIN NUQTA usuli ATAYIN: haqiqiy proyeksiya (segmentga tushirish)
 * aniqroq, lekin marshrut nuqtalari 30–100 metr oralab yotadi va bu
 * farq odam ko'radigan raqamda (km va daqiqa) YO'QOLADI. Oddiyroq kod —
 * kamroq xato.
 *
 * ⚠️ `offRouteKm` NEGA QAYTARILADI: haydovchi boshqa yo'ldan ketayotgan
 * bo'lishi mumkin (yoki ping eski). Shunda «qancha qoldi» degan raqam
 * YOLG'ON bo'ladi va uni KO'RSATMASLIK kerak — qaror chaqiruvchida.
 */
export function progressOnRoute(points: Pt[], cum: number[], car: Pt): RouteProgress | null {
  if (points.length < 2 || cum.length !== points.length) return null;
  let best = 0;
  let bestKm = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = haversineKm(points[i], car);
    if (d < bestKm) {
      bestKm = d;
      best = i;
    }
  }
  const total = cum[cum.length - 1];
  if (!(total > 0)) return null;
  const doneKm = cum[best];
  return {
    fraction: Math.min(1, Math.max(0, doneKm / total)),
    doneKm,
    leftKm: Math.max(0, total - doneKm),
    offRouteKm: bestKm,
    index: best,
  };
}

/**
 * Qolgan vaqt (daqiqa).
 *
 * 🔑 MANBA TANLOVI: yo'lning O'Z davomiyligi (`routeSeconds`) eng
 * ishonchlisi — u OSM tezlik chegaralaridan hisoblangan va butun
 * yo'nalish uchun. Jonli tezlikka tayanish esa chalg'itadi: svetoforda
 * turgan mashina «tezlik 0» beradi va ETA cheksizlikka ketadi.
 *
 * Shuning uchun asos — yo'l davomiyligining QOLGAN ULUSHI. Jonli tezlik
 * faqat KO'RSATILADI (odam o'zi baho beradi), hisobga kirmaydi.
 */
export function remainingMinutes(routeSeconds: number | null, fraction: number): number | null {
  if (!routeSeconds || routeSeconds <= 0) return null;
  const left = routeSeconds * (1 - Math.min(1, Math.max(0, fraction)));
  return Math.max(0, Math.round(left / 60));
}

/** Yo'lni «bosib o'tilgan» va «qolgan» qismlarga ajratadi (chizish uchun). */
export function splitRoute(points: Pt[], index: number): { done: Pt[]; left: Pt[] } {
  const i = Math.min(points.length - 1, Math.max(0, index));
  return { done: points.slice(0, i + 1), left: points.slice(i) };
}
