'use client';

import { useBigTextBoot } from '@/features/account/BigTextToggle';

/**
 * KATTAROQ MATN sozlamasini har yuklanishda tiklaydi. Hech nima chizmaydi.
 *
 * ⚠️ Sozlama `localStorage` da, ya'ni uni SERVERDA bilib bo'lmaydi.
 * Shuning uchun u birinchi kadrda emas, effektda qo'llanadi — aks holda
 * SSR va mijoz turlicha chizib, gidratatsiya buzilardi.
 */
export function BigTextBoot() {
  useBigTextBoot();
  return null;
}
