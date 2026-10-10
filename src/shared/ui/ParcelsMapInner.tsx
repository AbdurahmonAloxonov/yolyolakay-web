'use client';

import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { tileAttribution, useTileUrl } from '@/shared/lib/mapTiles';

/**
 * POSILKALAR XARITADA — haydovchi uchun.
 *
 * 🔴 NEGA KERAK BO'LDI (16.09.2026 o'lchovi): pochta sahifasida xarita
 * UMUMAN yo'q edi, holbuki posilkada to'rtta koordinata bor va qidiruv
 * `lat + lon + radius` bilan ishlaydi. Ya'ni radius qidiruvi ko'r
 * o'tkazilardi: «40 km» degan raqam nimani qamrab olishi ko'rinmasdi,
 * topilgan posilkalar esa oddiy ro'yxat edi.
 *
 * Haydovchining haqiqiy savoli ro'yxatda javobsiz qolardi: «bu posilka
 * MENING YO'LIMGA tushadimi?» — bunga faqat xarita javob beradi.
 *
 * Belgi OLIB KETISH nuqtasiga qo'yiladi (safar xaritasida ham shunday:
 * muhimi qayerdan olish, borish manzili ro'yxatda yozilgan).
 */
function parcelMarker(label: string, selected: boolean, taken: boolean) {
  // Olib ketilgan posilka SO'NIQ: ro'yxatda tugma o'chiq turardi-yu,
  // xaritada bunday farq bo'lmasa haydovchi band posilkani bosib, faqat
  // o'shanda band ekanini bilardi.
  const bg = taken ? '#9aa0a6' : selected ? '#111318' : '#C71578';
  return L.divIcon({
    className: '',
    html:
      '<div style="transform:translate(-50%,-100%);white-space:nowrap;display:flex;' +
      'align-items:center;gap:3px;' +
      `background:${bg};color:#fff;font-weight:800;font-size:11px;` +
      'padding:3px 7px;border-radius:999px;border:2px solid #fff;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.35)">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" ' +
      'fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" ' +
      'stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/>' +
      '<path d="M10 12h4"/></svg>' +
      `<span>${label}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
      return;
    }
    map.fitBounds(points as L.LatLngBoundsExpression, { padding: [48, 48] });
  }, [points, map]);
  return null;
}

export interface ParcelsMapPoint {
  id: string;
  lat: number;
  lon: number;
  label: string;
  taken?: boolean;
}

export default function ParcelsMapInner({
  points,
  center,
  radiusMeters,
  selectedId,
  onSelect,
}: {
  points: ParcelsMapPoint[];
  center?: [number, number] | null;
  radiusMeters?: number;
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const tiles = useTileUrl();
  const coords = points.map((p) => [p.lat, p.lon] as [number, number]);
  const all: [number, number][] = center ? [...coords, center] : coords;

  return (
    <MapContainer
      center={all[0] ?? [41.311081, 69.240562]}
      zoom={9}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom
    >
      <TileLayer attribution={tileAttribution()} url={tiles.url} className={tiles.className} />
      {/* QIDIRUV DOIRASI — «radius 40 km» raqamining ko'rinishi. */}
      {center && radiusMeters ? (
        <Circle
          center={center}
          radius={radiusMeters}
          pathOptions={{
            color: '#C71578',
            weight: 1.5,
            opacity: 0.45,
            fillColor: '#C71578',
            fillOpacity: 0.07,
          }}
        />
      ) : null}
      <Fit points={all} />
      {points.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lon]}
          icon={parcelMarker(p.label, p.id === selectedId, p.taken ?? false)}
          eventHandlers={{ click: () => onSelect(p.id) }}
        />
      ))}
    </MapContainer>
  );
}
