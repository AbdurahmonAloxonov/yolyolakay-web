/**
 * Safar boshlanish vaqtini lokal saqlaydi — backend `started_at` bermaydi (MyRide'da yo'q),
 * shuning uchun haydovchi "Boshlash"ni bosgan lahzani localStorage'ga yozamiz.
 * DIQQAT: boshqa qurilmada boshlangan bo'lsa lokal belgi bo'lmaydi — bunda 0 qaytadi va
 * taymer/hisobot KO'RSATILMAYDI (reja vaqtidan hisoblab NOTO'G'RI vaqt ko'rsatgandan ko'ra).
 */
const key = (rideId: string) => `trip_started_${rideId}`;

export const markTripStarted = (rideId: string): void => {
  if (typeof window !== 'undefined' && rideId)
    localStorage.setItem(key(rideId), String(Date.now()));
};

export const clearTripStarted = (rideId: string): void => {
  if (typeof window !== 'undefined' && rideId) localStorage.removeItem(key(rideId));
};

/** Boshlanishdan hozirgacha o'tgan vaqt (ms). Lokal belgi yo'q bo'lsa 0 (hisoblanmaydi).
 *  Date.now() shu modulda (komponent render'ida emas) — react-hooks/purity uchun. */
export const getElapsedSinceStart = (rideId: string): number => {
  const started = getTripStartedMs(rideId);
  return started ? Date.now() - started : 0;
};

/** Boshlanish vaqti (ms) — FAQAT lokal "Boshlash" belgisidan; yo'q bo'lsa 0. */
export const getTripStartedMs = (rideId: string): number => {
  if (typeof window === 'undefined' || !rideId) return 0;
  const stored = localStorage.getItem(key(rideId));
  return stored ? Number(stored) || 0 : 0;
};
