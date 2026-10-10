'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Navigation, Route } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { openExternalRoute } from '@/shared/lib/maps';
import { useTr } from '@/shared/lib/useTr';
/* Leafletsiz fayldan — sabab `myLocationLabels.ts` da. */
import { useMyLocationLabels } from '@/shared/lib/myLocationLabels';
import { fetchRoadRoute } from '@/shared/api/routing';

// Leaflet SSR'ni ko'tarmaydi — faqat brauzerда.
const RouteMapInner = dynamic(() => import('./RouteMapInner'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-bg-soft animate-pulse" />,
});

interface RouteMapSheetProps {
  isOpen: boolean;
  onClose: () => void;
  from: [number, number]; // [lat, lon]
  to: [number, number];
  /** Oraliq nuqtalar (yo'l-yo'lakay shaharlar) — marshrut shular orqali chiziladi */
  via?: [number, number][];
  fromLabel?: string;
  toLabel?: string;
  /** Haydovchining oxirgi ma'lum joyi — izohi `RouteMapInner` da. */
  driver?: [number, number] | null;
  /** Haydovchining harakat yo'nalishi (gradus) — bo'lsa belgi buriladi. */
  driverHeading?: number | null;
  /** Serverdagi ping vaqti — eskirgan ping surilmaydi. */
  driverUpdatedAt?: string | null;
}

function fmtDistance(m: number | null): string | null {
  if (!m) return null;
  const km = m / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}
function fmtDuration(s: number | null): string | null {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const min = Math.round((s % 3600) / 60);
  if (h > 0) return `${h} soat ${min} daq`;
  return `${min} daq`;
}

/**
 * Marshrutni ILOVA ICHIDA ko'rsatadigan BottomSheet — OSM (Leaflet) xarita.
 *
 * 🔴 Egasi (2026-08-20): Yandex OLIB TASHLANDI. Chiziq BIZNING backend
 * `/routing/route` (OSM) nuqtalari bo'ylab; masofa/vaqt o'sha javobdan.
 * Pastda "Yandex Navigator'da ochish" — bu XARITA emas, ONGLI tashqi
 * navigatsiya deep-linki (haydovchi jonli yo'l ko'rsatishni xohlasagina),
 * shuning uchun qoldirildi.
 */
export const RouteMapSheet: React.FC<RouteMapSheetProps> = ({
  isOpen,
  onClose,
  from,
  to,
  via,
  fromLabel,
  toLabel,
  driver,
  driverHeading,
  driverUpdatedAt,
}) => {
  const tr = useTr();
  const meLabels = useMyLocationLabels();
  const [points, setPoints] = useState<[number, number][]>([from, to]);
  const [real, setReal] = useState(false);
  const [info, setInfo] = useState<{ distance: string | null; duration: string | null } | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const waypoints: [number, number][] = [from, ...(via ?? []), to];
    // Yo'l kelguncha to'g'ri chiziq ko'rinadi — xarita bo'sh qolmaydi.
    setPoints(waypoints);
    setReal(false);
    fetchRoadRoute(waypoints).then((r) => {
      if (cancelled) return;
      setPoints(r.points);
      setReal(r.isReal);
      setInfo({ distance: fmtDistance(r.distanceMeters), duration: fmtDuration(r.seconds) });
    });
    return () => {
      cancelled = true;
    };
    // massiv referensi har renderда yangi bo'lishi mumkin — qiymat bo'yicha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, from[0], from[1], to[0], to[1], JSON.stringify(via)]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={tr('Marshrut', 'Маршрут', 'Route')}>
      <div className="space-y-4 pb-2">
        {(fromLabel || toLabel) && (
          <p className="text-sm font-bold text-text text-center">
            {fromLabel || '—'} <span className="text-accent">→</span> {toLabel || '—'}
          </p>
        )}

        <div className="w-full h-[300px] rounded-2xl overflow-hidden border border-border shadow-sm">
          {isOpen && (
            <RouteMapInner
              points={points}
              real={real}
              from={from}
              to={to}
              via={via}
              driver={driver}
              driverHeading={driverHeading}
              driverUpdatedAt={driverUpdatedAt}
              /* «Men shu yerdaman» — uchrashuv nuqtasiga borayotgan
                 odam uchun (izohi `MyLocationLayer` da). */
              meLabels={meLabels}
            />
          )}
        </div>

        {info && (info.distance || info.duration) && (
          <p className="text-xs font-bold text-text-muted text-center">
            {info.distance && (
              <span className="inline-flex items-center gap-1">
                <Route className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {info.distance}
              </span>
            )}
            {info.distance && info.duration && <span> · </span>}
            {info.duration && <span>⏱ {info.duration}</span>}
          </p>
        )}

        <Button onClick={() => openExternalRoute(from, to)} className="w-full">
          <Navigation className="h-4 w-4 mr-1.5" />
          {tr('Navigatorda ochish', 'Открыть в Навигаторе', 'Open in Navigator')}
        </Button>
        <p className="text-[11px] text-text-muted text-center leading-snug">
          {tr(
            'Marshrut OpenStreetMap xaritasida ochiladi',
            'Маршрут откроется на карте OpenStreetMap',
            'The route opens on the OpenStreetMap map'
          )}
        </p>
      </div>
    </BottomSheet>
  );
};
