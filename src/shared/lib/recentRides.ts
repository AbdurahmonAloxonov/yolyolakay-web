/**
 * SO'NGGI KO'RILGAN SAFARLAR — odam qayerda qolganini eslasin.
 *
 * 🔴 NEGA KERAK: qidiruv bosh sahifasi har safar NOLDAN boshlanadi. Odam
 * kecha safarni ochib ko'rgan, o'ylab qolgan, bugun qaytdi — va hech
 * qanday iz yo'q. Yo'nalishni qaytadan yozishi kerak.
 *
 * Ilovada bu 2026-08-25 dan beri bor (`recentRidesProvider`), saytda
 * YO'Q edi.
 *
 * ⚠️ FAQAT `localStorage` — serverga hech nima yuborilmaydi. Bu shaxsiy
 * qulaylik, ma'lumot emas: boshqa qurilmada ko'rinmasligi TABIIY va
 * shuning uchun sinxronlash ham kerak emas.
 *
 * ⚠️ Narx va joy soni SAQLANMAYDI — ular tez eskiradi va eski raqamni
 * ko'rsatish yolg'on bo'lardi. Faqat yo'nalish va safar id'si: odam
 * bosganda joriy holat serverdan o'qiladi.
 */
export interface RecentRide {
  id: string;
  from: string;
  to: string;
  /** Ko'rilgan vaqt — tartib va eskirish uchun. */
  at: number;
}

const KEY = 'recent_rides';
/** Ko'pi bilan shuncha — uzun ro'yxat bosh sahifani bosib qo'yadi. */
const MAX = 4;
/** Shu muddatdan eskisi ko'rsatilmaydi: safar allaqachon o'tib ketgan. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function readRecentRides(): RecentRide[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw
      .filter(
        (r): r is RecentRide =>
          !!r &&
          typeof r.id === 'string' &&
          typeof r.from === 'string' &&
          typeof r.to === 'string' &&
          typeof r.at === 'number' &&
          now - r.at < TTL_MS
      )
      .slice(0, MAX);
  } catch {
    // Buzuq yozuv butun ro'yxatni yiqitmasin.
    return [];
  }
}

export function rememberRide(ride: { id?: string; from?: string; to?: string }) {
  const id = (ride.id ?? '').trim();
  const from = (ride.from ?? '').trim();
  const to = (ride.to ?? '').trim();
  // Yo'nalishsiz yozuv ro'yxatda «— → —» bo'lib turadi — foydasi yo'q.
  if (!id || !from || !to) return;

  try {
    const next = [
      { id, from, to, at: Date.now() },
      ...readRecentRides().filter((r) => r.id !== id),
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* xotira to'la yoki bloklangan — bu qulaylik, to'sar emas */
  }
}
