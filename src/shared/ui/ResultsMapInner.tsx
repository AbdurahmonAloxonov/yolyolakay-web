'use client';

import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { priceIcon } from './mapIcons';
import { tileAttribution, useTileUrl } from '@/shared/lib/mapTiles';

/**
 * Qidiruv natijalari XARITADA — har safar o'z JO'NASH nuqtasida.
 *
 * 🔴 NEGA KERAK: bizda uchrashuv nuqtasi hal qiluvchi ahamiyatga ega.
 * Ro'yxatda "Chortoq" deb yozilgan safar aslida shaharning qaysi chetidan
 * chiqishini odam BILMASDI — manzil matni haydovchi yozgan erkin matn
 * ("Chortoq, 3-mavze"). Xaritada esa u bir qarashda ko'rinadi va odam
 * o'ziga qulayini tanlaydi.
 *
 * Belgi MANZIL emas, JO'NASH nuqtasiga qo'yiladi: yo'lovchi uchun muhimi
 * — qayerdan chiqish, chunki manzil allaqachon u so'ragan shahar.
 */
/* Narx belgisi — umumiy manbadan (`mapIcons.priceIcon`): bosish
   maydoni 44 px va rang tema bilan o'zgaradi. */

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
      return;
    }
    map.fitBounds(points as L.LatLngBoundsExpression, { padding: [48, 48] });
  }, [points, map]);
  return null;
}

export interface ResultsMapPoint {
  id: string;
  lat: number;
  lon: number;
  priceLabel: string;
  title: string;
  subtitle?: string;
  href: string;
}

export default function ResultsMapInner({
  points,
  openLabel,
}: {
  points: ResultsMapPoint[];
  openLabel: string;
}) {
  const tiles = useTileUrl();
  const coords = points.map((p) => [p.lat, p.lon] as [number, number]);
  return (
    <MapContainer
      center={coords[0] ?? [41.311081, 69.240562]}
      zoom={7}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom
    >
      <TileLayer attribution={tileAttribution()} url={tiles.url} className={tiles.className} />
      <FitAll points={coords} />
      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lon]} icon={priceIcon(p.priceLabel)}>
          <Popup>
            <div style={{ minWidth: 150 }}>
              <strong>{p.title}</strong>
              {p.subtitle ? <div style={{ fontSize: 12, opacity: 0.75 }}>{p.subtitle}</div> : null}
              <a href={p.href} style={{ display: 'inline-block', marginTop: 6, fontWeight: 700 }}>
                {openLabel}
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
