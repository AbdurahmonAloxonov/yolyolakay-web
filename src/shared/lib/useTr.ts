'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { trFor, type Tr } from './i18n';

/**
 * Komponentlar uchun tarjima funksiyasi (uz/ru/en) — `useLocale()` ustidagi yupqa qatlam.
 *
 * NEGA `useMemo`: `trFor(locale)` har renderda YANGI funksiya qaytaradi. Bu ikki narsani
 * buzadi — (1) memo qilingan bolalar har safar qayta chiziladi, (2) React Compiler'ning
 * `react-hooks/purity` qoidasi render ichidagi noma'lum chaqiruvni "nopok" deb belgilaydi
 * (lint xatosi). Til o'zgarmaguncha bitta va o'sha funksiya qaytariladi.
 *
 * React'siz joylarda (interceptor, format util, xato chegaralari) `trFor(locale)` ni
 * to'g'ridan ishlating — u hook emas.
 */
export const useTr = (): Tr => {
  const locale = useLocale();
  return useMemo(() => trFor(locale), [locale]);
};
