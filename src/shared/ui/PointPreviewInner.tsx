'use client';

import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { tileAttribution, useTileUrl } from '@/shared/lib/mapTiles';

/**
 * BITTA NUQTA xaritada — chatda ulashilgan joy uchun.
 *
 * `RoutePreview` dan farqi: u YO'LNI ko'rsatadi (ikki nuqta orasida),
 * bu esa BITTA joyni. Shakli ham boshqacha: chiziq emas, nishon — bu
 * «shu yerga kel» degani, «shu yo'ldan boramiz» emas.
 *
 * Tinch: g'ildirak va sudrash o'chiq, chunki u suhbat ro'yxati ichida
 * turadi va yozishmani sura olmay qolardik.
 */
const pin = L.divIcon({
  className: '',
  html:
    '<div style="transform:translate(-50%,-100%)">' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" ' +
    'fill="#C71578" stroke="#fff" stroke-width="1.6" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>' +
    '<circle cx="12" cy="10" r="2.6" fill="#fff" stroke="none"/></svg></div>',
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

export default function PointPreviewInner({ lat, lon }: { lat: number; lon: number }) {
  const tiles = useTileUrl();
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={15}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      zoomControl={false}
      touchZoom={false}
      keyboard={false}
    >
      <TileLayer attribution={tileAttribution()} url={tiles.url} className={tiles.className} />
      <Marker position={[lat, lon]} icon={pin} />
    </MapContainer>
  );
}
