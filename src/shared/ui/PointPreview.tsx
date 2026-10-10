'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Leaflet SSR'ni ko'tarmaydi (`window`) — faqat brauzerda.
const Inner = dynamic(() => import('./PointPreviewInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-bg-soft" />,
});

/** Bitta nuqta xaritada — izohi `PointPreviewInner` da. */
export function PointPreview({
  lat,
  lon,
  height = 130,
  className = '',
}: {
  lat: number;
  lon: number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border ${className}`}
      style={{ height }}
    >
      <Inner lat={lat} lon={lon} />
    </div>
  );
}
