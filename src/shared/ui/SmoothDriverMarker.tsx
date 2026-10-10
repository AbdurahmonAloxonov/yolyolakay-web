'use client';

import React from 'react';
import { Marker } from 'react-leaflet';

import { useLivePoint } from '@/shared/lib/useLivePoint';
import { driverIcon } from './mapIcons';

/**
 * HAYDOVCHI NUQTASI — ikki ping ORASIDA suriladi, sakramaydi.
 *
 * 🔴 NEGA (egasi, 18.09.2026 — «Yandex Go bilan solishtir»): haydovchi
 * 20 soniyada bir yuboradi, yo'lovchi 10 soniyada bir so'raydi, ya'ni
 * ekrandagi nuqta har safar bir necha yuz metrga SAKRAB tushardi. Nuqta
 * sakraganda odam «kuzatuv uzilib-uzilib ishlayapti» deb o'qiydi —
 * holbuki ma'lumot joyida, faqat chizilishi qo'pol edi.
 *
 * 🔑 YAGONA MANBA: saytda haydovchi nuqtasi UCH xaritada chiziladi
 * (`LiveMapInner`, `RoutePreviewInner`, `RouteMapInner`). Silliqlashni
 * har birida alohida yozsak, ertaga biri tuzatilib ikkitasi eski
 * qolardi — belgilar bilan aynan shunday bo'lgan edi (`mapIcons`).
 *
 * 🔑 ALOHIDA KOMPONENT bo'lishi ham shart: animatsiya kadrlari
 * (soniyasiga ~25) faqat SHU nuqtani qayta chizadi. Xaritaning o'zida
 * qilinganda har kadrda butun xarita — shaharlar, narx belgilari,
 * 3000 nuqtali yo'l — qayta chizilardi.
 *
 * Silliqlashning qoidalari (katta sakrash surilmaydi, eskirgan ping
 * qimirlamaydi, ekstrapolyatsiya YO'Q) `shared/lib/livePosition.ts` da
 * yozilgan va `pnpm test:live-point` bilan o'lchanadi.
 */
export function SmoothDriverMarker({
  coord,
  heading,
  updatedAt,
}: {
  coord: [number, number];
  heading?: number | null;
  /** Serverdagi ping vaqti — eskirgan ping SURILMAYDI. */
  updatedAt?: string | null;
}) {
  const live = useLivePoint(
    { lat: coord[0], lon: coord[1], heading: heading ?? null },
    { updatedAt: updatedAt ?? null }
  );
  if (!live) return null;
  return <Marker position={[live.lat, live.lon]} icon={driverIcon(live.heading)} />;
}
