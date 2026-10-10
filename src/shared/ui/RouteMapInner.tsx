'use client';

import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { RouteLine } from './RouteLine';
import { useMapColors } from '@/shared/lib/mapColors';
import { destIcon, originIcon, viaIcon } from './mapIcons';
import type { MyLocationLabels } from '@/shared/lib/myLocationLabels';
import { MyLocationButton, MyLocationLayer, useMyLocationControl } from './MyLocationLayer';
import { SmoothDriverMarker } from './SmoothDriverMarker';
import { tileAttribution, useTileUrl } from '@/shared/lib/mapTiles';

/**
 * Leaflet + OSM marshrut xaritasi (Yandex multiRouter O'RNIGA). Chiziq
 * BIZNING backend `/routing/route`dan kelgan nuqtalar (`points`) bo'ylab.
 * SSR yo'q (`dynamic ssr:false`).
 */

/* Belgilar — umumiy manbadan (`mapIcons`): o'lcham, rang va bosish
   maydoni sayt bo'ylab bir xil bo'lsin. */

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(points as L.LatLngBoundsExpression, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

export interface RouteMapInnerProps {
  points: [number, number][];
  /** `points` HAQIQIY yo'lmi (`RoadRoute.isReal`) — uslubi `RouteLine` da. */
  real: boolean;
  from: [number, number];
  to: [number, number];
  via?: [number, number][];
  /**
   * Haydovchining OXIRGI MA'LUM joyi (safar boshlangach).
   *
   * 🔴 Bu 2026-08-22 gacha MUMKIN EMAS edi: backend faqat masofani
   * berardi, koordinata bermasdi va biz taxminiy nuqta chizishdan
   * ATAYIN bosh tortgandik.
   *
   * ⚠️ "Jonli kuzatuv" DEB ATALMAYDI: haydovchi ilovani yopsa ping
   * to'xtaydi va nuqta eskiradi. Shuning uchun u BOSHQA belgi bilan
   * chiziladi — marshrut nuqtalari bilan aralashib ketmasin.
   */
  driver?: [number, number] | null;
  /** Haydovchining harakat yo'nalishi (gradus) — bo'lsa belgi buriladi. */
  driverHeading?: number | null;
  /** Serverdagi ping vaqti — eskirgan ping surilmaydi. */
  driverUpdatedAt?: string | null;
  /**
   * «Men shu yerdaman» tugmasining yozuvlari.
   *
   * 🔴 NEGA AYNAN SHU XARITADA (18.09.2026): bu — uchrashuv nuqtasiga
   * BORAYOTGAN odam ochadigan xarita. «Mashina qayerda» degan savolning
   * yarmi shu yerda edi, ikkinchi yarmi — «MEN qayerdaman va unga
   * qay tomonga yurishim kerak» — yo'q edi.
   */
  meLabels?: MyLocationLabels;
}

export default function RouteMapInner({
  points,
  real,
  from,
  to,
  via,
  driver,
  driverHeading,
  driverUpdatedAt,
  meLabels,
}: RouteMapInnerProps) {
  const tiles = useTileUrl();
  /* Chiziq rangi TOKENDAN — izohi `mapColors` da. */
  const c = useMapColors();
  const center: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  /* Yozuvsiz tugma chizilmaydi: nomsiz tugma ekran o'qigich uchun
     «tugma» degan bo'sh so'z — loyiha qoidasi bo'yicha yo'l qo'yilmaydi. */
  const locCtl = useMyLocationControl(
    meLabels ?? { locate: '', locateStop: '', locateError: '', locateDenied: '' }
  );
  return (
    <MapContainer
      center={center}
      zoom={7}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom
    >
      <TileLayer attribution={tileAttribution()} url={tiles.url} className={tiles.className} />
      <RouteLine positions={points} real={real} color={c.accent} />
      {/* Nuqta ikki ping ORASIDA suriladi — izohi `SmoothDriverMarker` da. */}
      {driver && (
        <SmoothDriverMarker coord={driver} heading={driverHeading} updatedAt={driverUpdatedAt} />
      )}
      <Marker position={from} icon={originIcon} />
      {(via ?? []).map((p, i) => (
        <Marker key={i} position={p} icon={viaIcon} />
      ))}
      <Marker position={to} icon={destIcon} />
      <FitBounds points={points.length >= 2 ? points : [from, to]} />

      {/* MEN — ko'k nuqta va aniqlik doirasi (izohi `MyLocationLayer` da). */}
      {meLabels && (
        <>
          <MyLocationLayer ctl={locCtl} color={c.me} />
          <div
            className="absolute right-3 top-1/2 z-[1000] -translate-y-1/2 overflow-hidden rounded-2xl border border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <MyLocationButton
              ctl={locCtl}
              labels={meLabels}
              className="flex h-11 w-11 items-center justify-center bg-surface text-text transition-colors hover:text-accent active:scale-95"
            />
          </div>
        </>
      )}
    </MapContainer>
  );
}
