'use client';

import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { tileAttribution, useTileUrl } from '@/shared/lib/mapTiles';

/**
 * Leaflet + OSM asosidagi joy tanlash xaritasi (Yandex O'RNIGA).
 * Egasi (2026-08-20): OSM. Ilova bilan bir manba (OSM plitkalar).
 *
 * SSR YO'Q: `MapPicker` buni `dynamic(..., { ssr:false })` bilan yuklaydi,
 * chunki Leaflet `window`ga tayanadi.
 */

// Brend pushti pin — leaflet'ning default ikonka assetlari bundlerда buziladi,
// shuning uchun o'z divIcon'imiz.
const pinIcon = L.divIcon({
  className: '',
  html:
    '<div style="transform:translate(-50%,-100%)">' +
    '<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M15 0C6.7 0 0 6.7 0 15c0 10 15 27 15 27s15-17 15-27C30 6.7 23.3 0 15 0z" fill="#C71578"/>' +
    '<circle cx="15" cy="15" r="6" fill="#fff"/></svg></div>',
  iconSize: [30, 42],
  iconAnchor: [0, 0],
});

function ClickCapture({ onPick }: { onPick: (c: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

/** Tashqaridan koordinata o'zgarsa (autolokatsiya) xaritani markazlaydi. */
function Recenter({ coords }: { coords: [number, number] }) {
  const map = useMap();
  const last = React.useRef<string>('');
  React.useEffect(() => {
    const key = coords.join(',');
    if (key !== last.current) {
      last.current = key;
      map.setView(coords, map.getZoom() < 13 ? 14 : map.getZoom());
    }
  }, [coords, map]);
  return null;
}

export interface MapPickerInnerProps {
  coords: [number, number];
  onPick: (coords: [number, number]) => void;
}

export default function MapPickerInner({ coords, onPick }: MapPickerInnerProps) {
  const tiles = useTileUrl();
  return (
    <MapContainer
      center={coords}
      zoom={12}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom
    >
      <TileLayer attribution={tileAttribution()} url={tiles.url} className={tiles.className} />
      <Marker position={coords} icon={pinIcon} />
      <ClickCapture onPick={onPick} />
      <Recenter coords={coords} />
    </MapContainer>
  );
}
