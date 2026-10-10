import React from 'react';
import { Skeleton } from '@/shared/ui/Skeleton';

/**
 * Sahifalararo o'tishdagi kutish holati (Next `loading.tsx`).
 *
 * NEGA KERAK: bunisiz sekin tarmoqda odam havolani bosgach ekran QOTIB turadi —
 * eski sahifa ko'rinib turaveradi va bosish "ishlamagandek" tuyuladi. Odam qayta
 * bosadi. Bu eng ko'p uchraydigan "sekin ilova" hissi, va u aslida tezlik emas,
 * javob YO'QLIGIdan kelib chiqadi.
 *
 * Ataylab MAZMUNSIZ skelet: bu barcha sahifalar uchun umumiy fallback, shuning
 * uchun aniq bir ekran shaklini taqlid qilmaydi — noto'g'ri shakl ko'rsatib,
 * keyin uni almashtirish sakrashga olib keladi.
 *
 * 🔴 NEGA AYNAN `(protected)` ICHIDA, `[locale]` ILDIZIDA EMAS:
 * `loading.tsx` sahifani striming rejimiga o'tkazadi — javob `200` bilan
 * BOSHLANADI, `notFound()` esa keyin ishlaydi va HTTP kodini o'zgartira olmaydi.
 * Ildizga qo'yilganda `/trip/{id}` yumshoq 404 ga aylanib qoldi (E2E darhol
 * ushladi). Himoyalangan sahifalarda 404 statusi kerak emas — ular indekslanmaydi.
 * Bu faylni yuqoriga KO'CHIRMANG.
 */
export default function Loading() {
  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-2/5" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    </div>
  );
}
