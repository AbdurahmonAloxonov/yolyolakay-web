'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { tileAttributionText } from '@/shared/lib/mapTiles';

// Leaflet SSR'ni ko'tarmaydi (`window`) — faqat brauzerda.
// ATAYIN alohida chunk: landing birinchi ekrani xarita kodini KUTMAYDI.
const Inner = dynamic(() => import('./RouteChooserMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-bg-soft" />,
});

/**
 * Yo'nalishni xaritadan tanlash — izohi `RouteChooserMapInner` da.
 *
 * Bosish qoidasi ODDIY va bitta: bosilgan shahar bo'sh maydonga tushadi
 * («qayerdan» bo'sh bo'lsa — o'sha, aks holda «qayerga»). Ikkalasi ham
 * to'lgan bo'lsa yangi bosish «qayerga» ni ALMASHTIRADI — odam odatda
 * manzilni o'zgartirib ko'radi, jo'nash shahri esa bitta.
 *
 * 🔑 Forma maydonlarini TO'LDIRADI, o'zi qidiruvga uloqtirmaydi: bitta
 * funksiya (`handleSearch`) — bitta yo'l. Aks holda xaritadan boshlangan
 * qidiruv sana va o'rindiqni olmay ketardi.
 */
export function RouteChooserMap({
  from,
  to,
  onFrom,
  onTo,
  height = 400,
  className = '',
}: {
  from: string;
  to: string;
  onFrom: (city: string) => void;
  onTo: (city: string) => void;
  height?: number;
  className?: string;
}) {
  const pick = (city: string) => {
    // Bir xil shaharni ikkinchi marta bosish — TOZALASH (fikridan qaytdi).
    if (city === from) {
      onFrom('');
      return;
    }
    if (city === to) {
      onTo('');
      return;
    }
    if (!from.trim()) onFrom(city);
    else onTo(city);
  };

  /*
    🔴 ENI CHEKLANGAN (16.09.2026, prodda ko'z bilan ko'rildi).

    Karta forma kengligida (1100 px) va 260 px balandlikda edi, ya'ni
    nisbati ~4.2. O'zbekistonning nisbati esa ~2.6 — `fitBounds` bunday
    kadrga sig'dirish uchun BALANDLIK bo'yicha uzoqlashadi va yon
    tomonlarga Turkiya, Eron, Xitoy kirib keladi. O'zbekiston o'rtada
    kichkina bo'lib qoladi, Farg'ona vodiysidagi nuqtalar esa
    bir-biriga yopishib, Buxoro o'rniga Navoiy bosilib ketardi.

    Yechim — kadrni mamlakat SHAKLIGA moslash: eni cheklanadi (672) va
    markazga qo'yiladi.

    ⚠️ BALANDLIK ham SHART, va aynan u hal qiluvchi bo'lib chiqdi:
    `fitBounds` kadrga sig'adigan ENG KATTA zoom'ni tanlaydi va
    ikkala o'lchov bo'yicha tekshiradi. Shaharlar 5.3° kenglikni
    egallaydi, bu esa 6-zoomda ~312 px JOY (chekkalardan tashqari)
    talab qiladi. 260 px ham, 340 px ham yetmadi va Leaflet majburan
    5-zoomga tushardi — kadr ikki barobar uzoqlashardi. 400 px — 24
    px chekka bilan 6-zoom sig'adigan qiymat.

    ⚠️ Kenglik BU YERDA hal qilmaydi: mamlakat eniga 620 px da ham
    6-zoom sig'adi, cheklovchi o'lcham — BALANDLIK.
  */
  return (
    <div
      className={`relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-border ${className}`}
      style={{ height }}
    >
      <Inner from={from} to={to} onPick={pick} />
      {/* OSM litsenziyasi (ODbL) attributsiyani TALAB qiladi. Leaflet'niki
          o'chirilgan: u 14 px balandlikdagi havola yasardi (barmoq nishoni
          qoidasi 44 px). `py-[15px] -my-[15px]` — yozuv joyidan
          qimirlamaydi, maydon esa 44 px bo'ladi. */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-1 right-2 z-[500] -my-[15px] inline-flex items-center rounded-full bg-surface/90 px-2 py-[15px] text-[10px] font-semibold text-text-muted/80 hover:text-accent"
      >
        {tileAttributionText()}
      </a>
    </div>
  );
}
