import { parseBackendDate } from './format';
import { haversineKm } from './geo';

/**
 * JONLI NUQTANING SILLIQ HARAKATI — mashina SAKRAMASIN, SURILSIN.
 *
 * 🔴 NEGA YOZILDI (egasi, 18.09.2026 — «Yandex Go bilan solishtir»):
 * kuzatuvimiz jonli emas edi. Haydovchi 20 soniyada bir yuboradi
 * (`LivePing._minGap`), yo'lovchi esa 30 soniyada bir so'rardi — ya'ni
 * eng yomon holatda ekrandagi nuqta ~50 soniya eskirgan bo'lardi va har
 * safar YANGI joyga SAKRAB tushardi. Yandex Go'da mashina suzib boradi.
 *
 * Bu fayl SOF MATEMATIKA (React'siz) — chunki aynan shu yerda jimgina
 * YOLG'ON gapirish oson: nuqtani silliq surish «biz mashinani ko'rib
 * turibmiz» degan taassurot beradi. Uch qoida shuning uchun bor:
 *
 *   1. **EKSTRAPOLYATSIYA YO'Q.** Nuqta faqat ikkita KELGAN ping orasida
 *      suriladi. Ping kechiksa nuqta oxirgi kelgan joyida TO'XTAYDI —
 *      «davom etaverdi» deb chizish joyni O'YLAB TOPISH bo'lardi.
 *   2. **KATTA SAKRASH SURILMAYDI** (`MAX_SMOOTH_KM`). 3 km dan katta
 *      farq — bu harakat emas: GPS qayta ushladi, ilova qayta ochildi
 *      yoki haydovchi aloqasiz yurib kelib endi yubordi. Uni 10 soniyada
 *      silliq surib chizsak, ekranda mashina yo'q joydan o'tib ketadi.
 *   3. **ESKI PING SURILMAYDI.** Ma'lumot eskirgan bo'lsa (panel buni
 *      qizil yozuv bilan aytadi) nuqta qimirlamasligi KERAK — harakat
 *      «aloqa bor» degan signal, uni eskirgan ma'lumotga bermaymiz.
 *
 * ⚠️ Chiziqli interpolyatsiya (katta doira emas) ATAYIN: 3 km masofada
 * ikkisining farqi santimetrlarda, murakkabligi esa bir necha barobar.
 */

export interface LivePoint {
  lat: number;
  lon: number;
  /** Gradus, 0–360 (shimoldan soat strelkasi bo'yicha). Bo'lmasligi mumkin. */
  heading?: number | null;
}

/**
 * Undan katta sakrash SURILMAYDI — darhol ko'chadi.
 *
 * 3 km: trassada 100 km/soat bilan ketayotgan mashina 50 soniyada ~1.4 km
 * yuradi, ya'ni normal ping oralig'i bu chegaraga hech qachon yetmaydi.
 * Yetsa — demak bu harakat emas, uzilishdan keyingi tiklanish.
 */
export const MAX_SMOOTH_KM = 3;

/**
 * Undan eski ping — «ma'lumot eskirgan».
 *
 * 🔑 10 daqiqa IKKALA MIJOZDA AYNAN BIR XIL (ilovada `stale_ping.dart`).
 * Chegara ikki xil bo'lsa, bitta safar telefonda «yangi», saytda
 * «eskirgan» bo'lib ko'rinardi — ya'ni bir voqea haqida ikki xil hikoya.
 */
export const STALE_MS = 10 * 60_000;

/**
 * Ping necha ms oldin kelgan. Noma'lum bo'lsa `null`.
 *
 * ⚠️ Go'ning nol vaqti (`0001-01-01`) `parseBackendDate` bilan to'siladi:
 * usiz yosh MILLION daqiqa bo'lib chiqar edi va nuqta har doim
 * «eskirgan» ko'rinardi (aynan shu xato ilovada bo'lgan, 18.09.2026).
 *
 * ⚠️ Manfiy yosh NOLGA tenglashtiriladi: telefon soati oldinda bo'lsa
 * (odatiy hol) ping «kelajakdan» kelgandek ko'rinadi.
 */
export function pingAgeMs(updatedAt: string | null | undefined, now: number): number | null {
  const d = parseBackendDate(updatedAt);
  if (!d) return null;
  return Math.max(0, now - d.getTime());
}

/** 0→1 oralig'ida cheklash. */
function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Silliqlash egri chizig'i — boshi va oxiri sekin.
 *
 * 🔑 CHIZIQLI EMASLIGI MUHIM: chiziqli harakatda nuqta har ping kelganda
 * to'satdan «start» va «stop» qiladi — ko'zga aynan sakrash bo'lib
 * ko'rinadi, faqat cho'zilgani. Egri chiziq bilan u tabiiy suzadi.
 */
export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** Ikki nuqta orasidagi oraliq joy (`t` = 0 → `a`, 1 → `b`). */
export function lerpPoint(a: LivePoint, b: LivePoint, t: number): [number, number] {
  const k = clamp01(t);
  return [a.lat + (b.lat - a.lat) * k, a.lon + (b.lon - a.lon) * k];
}

/**
 * YO'NALISHNI (heading) burish — QISQA TOMONDAN.
 *
 * 🔴 Oddiy `a + (b - a) * t` bu yerda XATO: 350° dan 10° ga o'tishda
 * strelka 20 gradus o'ngga emas, 340 gradus CHAPGA aylanib ketadi —
 * ekranda mashina to'satdan g'ildirakdek aylanib qo'yadi. Farq shuning
 * uchun ±180 oralig'iga keltiriladi.
 */
export function lerpHeading(a: number | null | undefined, b: number | null | undefined, t: number) {
  if (!Number.isFinite(b as number)) return Number.isFinite(a as number) ? (a as number) : null;
  if (!Number.isFinite(a as number)) return b as number;
  const diff = (((((b as number) - (a as number)) % 360) + 540) % 360) - 180;
  const v = (a as number) + diff * clamp01(t);
  return ((v % 360) + 360) % 360;
}

/**
 * Bu ikki nuqta orasini SURIB ko'rsatsa bo'ladimi?
 *
 * `staleMs` — oxirgi ping qanchalik eski. Berilmasa (noma'lum) tekshiruv
 * o'tkazilmaydi: yoshi noma'lum ping uchun harakatni TAQIQLAMAYMIZ,
 * chunki ko'p javobda `updated_at` umuman kelmaydi.
 */
export function canSmooth(
  from: LivePoint | null | undefined,
  to: LivePoint | null | undefined,
  opts: { staleMs?: number | null; maxStaleMs?: number } = {}
): boolean {
  if (!from || !to) return false;
  const { staleMs = null, maxStaleMs = STALE_MS } = opts;
  if (staleMs != null && staleMs > maxStaleMs) return false;
  const km = haversineKm([from.lat, from.lon], [to.lat, to.lon]);
  // Nol masofada animatsiya qilishdan ma'no yo'q (kadrni behuda yoqadi).
  return km > 0 && km <= MAX_SMOOTH_KM;
}

/**
 * Bitta kadr — `t` ulushidagi joy va yo'nalish.
 *
 * `canSmooth` false bo'lsa chaqiruvchi buni umuman chaqirmaydi va
 * to'g'ridan-to'g'ri `to` ni chizadi.
 */
export function frameAt(from: LivePoint, to: LivePoint, t: number): LivePoint {
  const e = easeInOut(t);
  const [lat, lon] = lerpPoint(from, to, e);
  return { lat, lon, heading: lerpHeading(from.heading, to.heading, e) };
}
