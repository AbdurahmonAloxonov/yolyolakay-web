'use client';

import { useMemo } from 'react';

import { useTr } from './useTr';

/**
 * «MEN SHU YERDAMAN» TUGMASINING YOZUVLARI.
 *
 * 🔴 NEGA ALOHIDA FAYLDA, komponent yonida EMAS (18.09.2026, jonli
 * sinovda tutildi): yozuvlar avval `MyLocationLayer.tsx` da edi va
 * `map/page.tsx` ularni o'shandan import qilardi. O'sha fayl esa
 * `react-leaflet` ni tortib keladi — natijada Leaflet SERVER paketiga
 * tushib, sahifa `ReferenceError: window is not defined` bilan
 * yiqilardi. Xarita komponentlari ATAYIN `dynamic(ssr:false)` bilan
 * yuklanadi, bu esa o'sha qoidani ORQA ESHIKDAN buzgan edi.
 *
 * 🔑 QOIDA: xarita komponentidan HECH NARSA (matn ham) to'g'ridan
 * import qilinmaydi. Leafletsiz kerak bo'lgan narsa shu faylga chiqadi.
 *
 * ⚠️ Xato sinovsiz KO'RINMAS edi: sahifa mijozda baribir chizilardi,
 * faqat server logida xato turardi (va SSR yo'qolgani uchun sahifa
 * sekinlashardi).
 */
export interface MyLocationLabels {
  locate: string;
  locateStop: string;
  locateError: string;
  locateDenied: string;
}

/**
 * Yozuvlarning YAGONA nusxasi — ikki xarita ham shundan oladi
 * («Xarita» bo'limi va safar marshruti varag'i).
 *
 * ⚠️ «Ruxsat berilmagan» matni «aniqlab bo'lmadi» dan ATAYIN boshqa:
 * birinchisida javob odamning O'Z brauzeri sozlamasida, ikkinchisida
 * esa kutish kerak. Bitta matn bilan aytilsa, odam bekorga kutib
 * o'tirardi.
 */
export function useMyLocationLabels(): MyLocationLabels {
  const tr = useTr();
  return useMemo(
    () => ({
      locate: tr('Men shu yerdaman', 'Я здесь', 'I am here'),
      locateStop: tr(
        "Joylashuvni kuzatishni to'xtatish",
        'Остановить отслеживание местоположения',
        'Stop following my location'
      ),
      locateError: tr(
        "Joylashuvni aniqlab bo'lmadi",
        'Не удалось определить местоположение',
        'Could not determine your location'
      ),
      locateDenied: tr(
        'Joylashuvga ruxsat berilmagan — brauzer sozlamasidan yoqing',
        'Доступ к местоположению запрещён — включите его в настройках браузера',
        'Location access is blocked — enable it in your browser settings'
      ),
    }),
    [tr]
  );
}
