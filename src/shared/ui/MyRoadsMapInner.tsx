'use client';

import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { useQueries } from '@tanstack/react-query';
import { useMapColors } from '@/shared/lib/mapColors';
import { fetchRoadRoute, routeKey, type RoadRoute } from '@/shared/api/routing';
import { RouteLine } from './RouteLine';
import { tileAttribution, useTileUrl } from '@/shared/lib/mapTiles';

/**
 * «YO'LLARIM» — bosib o'tilgan yo'nalishlar bitta xaritada.
 *
 * ✅ CHIZIQ ENDI YO'L BO'YLAB (28.09.2026, egasi: «to'g'ri chiziqlarmi,
 * rasvo»). Ilgari ataylab to'g'ri edi — «ellik safar = ellik so'rov» deb.
 * O'lchov bu qo'rquvni rad etdi: test akkauntdagi 49 safar atigi 3 ta
 * TURLI yo'nalish. Yo'nalishlar birlashtiriladi va har biri BIR MARTA
 * so'raladi (kesh `routing.ts` da, `useRoadRoute` bilan umumiy); ko'p
 * yurilgan yo'l QALINROQ. Eng ko'p yurilgan [MAX_ROADS] tasidan
 * tashqarisi so'ralmaydi. Ilovadagi juftligi — `my_roads_map.dart`.
 */
const MAX_ROADS = 12;

const cityDot = L.divIcon({
  className: '',
  html:
    '<div style="width:9px;height:9px;border-radius:50%;background:var(--turquoise);' +
    'border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2);' +
    'transform:translate(-50%,-50%)"></div>',
  iconSize: [9, 9],
  iconAnchor: [0, 0],
});

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(points as L.LatLngBoundsExpression, { padding: [28, 28] });
  }, [points, map]);
  return null;
}

export default function MyRoadsMapInner({ legs }: { legs: [number, number][][] }) {
  const tiles = useTileUrl();
  /* Chiziq rangi TOKENDAN — izohi `mapColors` da. */
  const c = useMapColors();
  const points = React.useMemo(() => legs.flat(), [legs]);

  // Bir xil yo'nalish BITTA chiziq — nechta safar bo'lsa, shuncha qalin.
  const roads = React.useMemo(() => {
    const byKey = new Map<string, { points: [number, number][]; trips: number }>();
    for (const leg of legs) {
      const k = routeKey(leg);
      const hit = byKey.get(k);
      if (hit) hit.trips += 1;
      else byKey.set(k, { points: leg, trips: 1 });
    }
    return [...byKey.entries()]
      .sort((a, b) => b[1].trips - a[1].trips)
      .slice(0, MAX_ROADS)
      .map(([key, v]) => ({ key, ...v }));
  }, [legs]);

  /* `queryKey` `useRoadRoute` bilan BIR XIL — sayt bo'ylab bitta kesh. */
  const routes = useQueries({
    queries: roads.map((r) => ({
      queryKey: ['road-route', r.key],
      staleTime: (q: { state: { data?: RoadRoute } }) => (q.state.data?.isReal ? Infinity : 30_000),
      gcTime: 60 * 60 * 1000,
      retry: 1,
      queryFn: () => fetchRoadRoute(r.points),
    })),
  });
  return (
    <MapContainer
      center={[41.5, 64.5]}
      zoom={5}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      zoomControl={false}
      touchZoom={false}
      keyboard={false}
    >
      <TileLayer attribution={tileAttribution()} url={tiles.url} className={tiles.className} />
      {roads.map((r, i) => {
        const road = routes[i]?.data;
        return (
          <RouteLine
            key={r.key}
            real={!!road?.isReal}
            positions={road?.isReal ? road.points : r.points}
            color={c.accent}
            // Ko'p yurilgan yo'l ko'zga birinchi tashlansin.
            weight={2.5 + (Math.min(5, r.trips) - 1) * 0.75}
            opacity={0.75}
          />
        );
      })}
      {legs.map((leg, i) => (
        <React.Fragment key={`d${i}`}>
          <Marker position={leg[0]} icon={cityDot} />
          <Marker position={leg[leg.length - 1]} icon={cityDot} />
        </React.Fragment>
      ))}
      <Fit points={points} />
    </MapContainer>
  );
}
