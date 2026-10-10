'use client';

import { useEffect } from 'react';

import { captureReferral } from '@/shared/lib/referral';

/**
 * TAKLIF KODINI USHLAB QOLADI — `?r=...` bilan kelgan odamda.
 *
 * 🔴 NEGA ALOHIDA KOMPONENT: kodni ushlash BIRINCHI ochilishda, ya'ni
 * odam qaysi sahifaga tushishidan qat'i nazar bo'lishi kerak. Taklif
 * havolasi bosh sahifaga boradi, lekin odam uni tahrirlab yoki
 * qidiruvdan boshqa yerga o'tib ketishi mumkin. Ildiz maketiga
 * qo'yilgani uchun u har yo'lda bir marta ishlaydi.
 *
 * Hech nima chizmaydi. Butun mantiq `shared/lib/referral.ts` da —
 * u yerda nega backendga yuborilmasligi ham yozilgan.
 */
export function ReferralCapture() {
  useEffect(() => {
    captureReferral();
  }, []);
  return null;
}
