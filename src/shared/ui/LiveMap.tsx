'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { LiveMapInnerProps } from './LiveMapInner';

// Leaflet SSR'ni ko'tarmaydi (`window`) — faqat brauzerda.
// ATAYIN alohida chunk: xarita kodi sahifaning birinchi bo'yog'ini kutmaydi.
const Inner = dynamic(() => import('./LiveMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-bg-soft" />,
});

export type { LiveMapCity, LiveMapResult, LiveMapRoute, LiveMapInnerProps } from './LiveMapInner';

/** «Xarita» bo'limining xaritasi — izohi `LiveMapInner` da. */
export function LiveMap(props: LiveMapInnerProps) {
  return <Inner {...props} />;
}
