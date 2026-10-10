'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { ResultsMapPoint } from './ResultsMapInner';

// Leaflet SSR'ni ko'tarmaydi (`window`) — faqat brauzerda yuklanadi.
// Bu ATAYIN alohida chunk: xarita ochilmasa yuklanmaydi ham.
const Inner = dynamic(() => import('./ResultsMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-bg-soft" />,
});

export type { ResultsMapPoint };

export function ResultsMap({
  points,
  openLabel,
  className = '',
}: {
  points: ResultsMapPoint[];
  openLabel: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border ${className}`}>
      <Inner points={points} openLabel={openLabel} />
    </div>
  );
}
