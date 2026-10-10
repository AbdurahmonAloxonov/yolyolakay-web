'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Maximize2 } from 'lucide-react';

// Leaflet SSR'ni ko'tarmaydi (`window`) — faqat brauzerda yuklanadi.
// ATAYIN alohida chunk: ko'rik chizilmasa yuklanmaydi ham.
const Inner = dynamic(() => import('./RoutePreviewInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-bg-soft" />,
});

/**
 * Marshrutning TINCH ko'rinishi — izohi `RoutePreviewInner` da.
 *
 * `onOpen` berilsa butun blok bosiladigan bo'ladi va ustida «kattalashtirish»
 * yozuvi chiqadi. Yozuvsiz xarita oddiy rasmdek ko'rinadi va hech kim uni
 * bosmaydi (jonli o'lchovda ko'rilgan naqsh).
 */
export function RoutePreview({
  from,
  to,
  via,
  pickup,
  driver,
  points,
  doneIndex,
  onOpen,
  openLabel,
  height = 180,
  className = '',
}: {
  from: [number, number];
  to: [number, number];
  via?: [number, number][];
  /** Uchrashuv nuqtasi — haydovchi xaritada belgilagan aniq joy. */
  pickup?: [number, number] | null;
  /** Haydovchining jonli nuqtasi — izohi `RoutePreviewInner` da. */
  driver?: { coord: [number, number]; heading?: number | null; updatedAt?: string | null } | null;
  /** Tayyor yo'l nuqtalari (sahifa olgan bo'lsa) — izohi ichkarida. */
  points?: [number, number][] | null;
  /** Bosib o'tilgan qismning indeksi — yo'l ikki rangda chiziladi. */
  doneIndex?: number | null;
  onOpen?: () => void;
  openLabel?: string;
  height?: number;
  className?: string;
}) {
  // Koordinatasiz (0,0) yoki ikkala nuqtasi bir xil marshrut chizilmaydi:
  // birinchisi xaritani okean o'rtasiga sudrardi, ikkinchisi chegara
  // yasay olmay yiqilardi.
  const valid =
    Number.isFinite(from[0]) &&
    Number.isFinite(to[0]) &&
    (from[0] !== 0 || from[1] !== 0) &&
    (to[0] !== 0 || to[1] !== 0) &&
    (from[0] !== to[0] || from[1] !== to[1]);
  if (!valid) return null;

  const map = (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border ${className}`}
      style={{ height }}
    >
      <Inner
        from={from}
        to={to}
        via={via}
        pickup={pickup}
        driver={driver}
        points={points}
        doneIndex={doneIndex}
      />
      {onOpen && openLabel && (
        <span className="pointer-events-none absolute bottom-2 left-2 z-[500] inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-[11px] font-bold text-foreground shadow-sm">
          <Maximize2 className="h-3 w-3 shrink-0" aria-hidden />
          {openLabel}
        </span>
      )}
    </div>
  );

  if (!onOpen) return map;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={openLabel}
      className="block w-full text-left"
    >
      {map}
    </button>
  );
}
