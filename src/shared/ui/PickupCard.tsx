'use client';

import React from 'react';
import { Navigation, Map as MapIcon } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';
import { osmPlaceUrl, formatDistance } from '@/shared/lib/placeLinks';

/**
 * KUTIB OLISH KARTASI — uchrashuv payti kerak bo'ladigan hamma narsa.
 *
 * 🔴 NEGA KERAK: bekatda bir vaqtda bir necha "Farg'onaga" chiqadigan
 * mashina turadi. Yo'lovchi o'zinikini DAVLAT RAQAMIDAN topadi — lekin
 * bizda raqam boshqa ma'lumot orasida, oddiy matn qatorida turardi va
 * ko'zga tashlanmasdi. inDrive/Yandex'da u ekranning yarmini egallaydi,
 * chunki aynan shu payt boshqa hech nima kerak emas.
 *
 * ⚠️ Mashina FOTOSI ATAYIN yo'q: backend media 404 beradi (xat 2026-08-20),
 * ya'ni rasm baribir ochilmaydi. Bo'sh joy qoldirgandan ko'ra umuman
 * ko'rsatmagan yaxshi.
 *
 * Hech qanday ma'lumot bo'lmasa karta CHIZILMAYDI: bo'sh ramka "ilova
 * buzuq" degandek ko'rinadi. Ilovadagi `_PickupCard` bilan bir xil.
 */
export function PickupCard({
  plate,
  carTitle,
  color,
  pickupPoint,
  lat,
  lon,
  distanceKm,
}: {
  plate?: string | null;
  carTitle?: string | null;
  color?: string | null;
  pickupPoint?: string | null;
  /** Jo'nash nuqtasi — xaritada ochish uchun (bo'lmasa tugma chizilmaydi). */
  lat?: number | null;
  lon?: number | null;
  /** Foydalanuvchidan masofa — hisoblangan bo'lsa (ixtiyoriy). */
  distanceKm?: number | null;
}) {
  const tr = useTr();
  const p = (plate ?? '').trim();
  const title = (carTitle ?? '').trim();
  const point = (pickupPoint ?? '').trim();

  if (!p && !title && !point) return null;

  return (
    <div className="rounded-2xl border border-turquoise/40 bg-turquoise/5 p-5">
      <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
        {tr('Kutib olish', 'Как вас встретят', 'Pickup')}
      </p>

      {p && (
        // Raqam KATTA va BELGILANADIGAN: odam uni uzoqdan o'qiydi yoki
        // nusxalab yaqiniga yuboradi.
        <p className="mt-2 select-text font-mono text-3xl font-black tracking-[0.15em] text-text">
          {p.toUpperCase()}
        </p>
      )}

      {(title || color) && (
        <p className="mt-0.5 text-sm font-semibold text-text-muted">
          {[title, color].filter(Boolean).join(' · ')}
        </p>
      )}

      {point && (
        <div className="mt-4 flex items-start gap-2 text-sm text-text">
          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>{point}</span>
        </div>
      )}

      {/* "Sizdan qancha uzoq" — joylashuv ruxsati bo'lsa. */}
      {typeof distanceKm === 'number' && (
        <p className="mt-1 pl-6 text-xs text-text-muted">
          {tr(
            `Sizdan ${formatDistance(distanceKm)}`,
            `От вас ${formatDistance(distanceKm)}`,
            `${formatDistance(distanceKm)} from you`
          )}
        </p>
      )}

      {/* XARITADA OCHISH — odam nuqtani ko'rib emas, YETIB BORISHI kerak.
          Saytda OSM sahifasi ochiladi (izohi `placeLinks` da). */}
      {typeof lat === 'number' && typeof lon === 'number' && (
        <a
          href={osmPlaceUrl(lat, lon)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-bold text-text transition-colors hover:border-accent hover:text-accent"
        >
          <MapIcon className="h-4 w-4 text-accent" />
          {tr('Xaritada ochish', 'Открыть на карте', 'Open on map')}
        </a>
      )}
    </div>
  );
}
