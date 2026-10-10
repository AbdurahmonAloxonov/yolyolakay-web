'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { ParcelsMapPoint } from './ParcelsMapInner';

// Leaflet SSR'ni ko'tarmaydi (`window`) — faqat brauzerda.
const Inner = dynamic(() => import('./ParcelsMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-bg-soft" />,
});

export type { ParcelsMapPoint };

/** Posilkalar xaritasi — izohi `ParcelsMapInner` da. */
export function ParcelsMap({
  points,
  center,
  radiusMeters,
  selectedId,
  onSelect,
  height = 320,
  className = '',
}: {
  points: ParcelsMapPoint[];
  center?: [number, number] | null;
  radiusMeters?: number;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  height?: number;
  className?: string;
}) {
  if (points.length === 0 && !center) return null;
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border ${className}`}
      style={{ height }}
    >
      <Inner
        points={points}
        center={center}
        radiusMeters={radiusMeters}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  );
}
