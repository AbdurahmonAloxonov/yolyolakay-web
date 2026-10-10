'use client';

import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { RouteLine } from './RouteLine';
import { useMapColors } from '@/shared/lib/mapColors';
import { fetchRoadRoute } from '@/shared/api/routing';
import { destIcon, originIcon, pickupIcon, viaIcon } from './mapIcons';
import { SmoothDriverMarker } from './SmoothDriverMarker';
import { tileAttribution, useTileUrl } from '@/shared/lib/mapTiles';

/**
 * TINCH MARSHRUT KO'RINISHI — sahifa ichida turadigan kichik xarita.
 *
 * 🔴 NEGA KERAK BO'LDI (egasi, 16.09.2026: «karta to'liq ishlatilsin»).
 * Saytda xarita BOR edi, lekin HAR DOIM tugma ortida: safar sahifasida
 * «Marshrutni ko'rish» bosilsa varaq ochilardi, posilkada esa xarita
 * umuman yo'q edi. Ya'ni yo'nalishni ko'rish uchun odam avval QAROR
 * qilishi kerak edi — «ochishga arziydimi?».
 *
 * Bu vidjet o'rtadagi yechim: xarita DOIM ko'rinadi, lekin kichik va
 * TINCH — barmoq/g'ildirak bilan boshqarib bo'lmaydi. Sabab oddiy:
 * sahifa ichidagi interaktiv xarita g'ildirak harakatini o'ziga olib,
 * odam sahifani sura olmay qoladi. Bosilsa [onOpen] to'liq xaritani
 * ochadi.
 */
function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(points as L.LatLngBoundsExpression, { padding: [28, 28] });
  }, [points, map]);
  return null;
}

export interface RoutePreviewInnerProps {
  from: [number, number];
  to: [number, number];
  via?: [number, number][];
  /**
   * UCHRASHUV NUQTASI — haydovchi xaritada belgilagan aniq joy.
   * Jo'nash nuqtasidan boshqacha belgi bilan chiziladi (izohi `mapIcons`).
   */
  pickup?: [number, number] | null;
  /**
   * HAYDOVCHINING JONLI NUQTASI — safar yo'lda bo'lsa.
   *
   * 🔴 17.09.2026 gacha bu nuqta FAQAT to'liq xarita varag'ida ko'rinardi,
   * ya'ni «mashina qayerda» degan savolga javob olish uchun odam avval
   * xaritani OCHISHI kerak edi. Sahifadagi ko'rikning o'zida esa mashina
   * yo'q edi va u «kuzatuv ishlamayapti» degan taassurot berardi.
   */
  driver?: { coord: [number, number]; heading?: number | null; updatedAt?: string | null } | null;
  /**
   * TAYYOR yo'l nuqtalari — sahifa ularni allaqachon olgan bo'lsa.
   *
   * 🔴 NEGA (17.09.2026): yo'l geometriyasi «qancha qoldi» hisobida ham
   * kerak. Ilgari uni FAQAT shu vidjet so'rardi va tashqariga bermasdi —
   * sahifa o'sha yo'lni IKKINCHI marta so'rashi kerak bo'lardi
   * (Toshkent–Samarqand: 3204 nuqta, ~800 ms).
   *
   * ⚠️ FAQAT HAQIQIY yo'l beriladi (`RoadRoute.isReal`): berilgan nuqtalar
   * yaxlit «yo'l» uslubida chiziladi.
   */
  points?: [number, number][] | null;
  /**
   * Bosib O'TILGAN qismning oxirgi nuqtasi (indeks).
   *
   * Yo'l ikki rangda chiziladi: o'tilgani so'nik, qolgani aksentda.
   * «Qancha qoldi» ni RAQAMSIZ ham ko'rsatadigan yagona usul shu.
   */
  doneIndex?: number | null;
}

export default function RoutePreviewInner({
  from,
  to,
  via,
  pickup,
  driver,
  points: external,
  doneIndex,
}: RoutePreviewInnerProps) {
  const tiles = useTileUrl();
  // Massiv referensi har renderda yangi bo'lishi mumkin — qiymat bo'yicha
  // solishtiramiz, aks holda marshrut cheksiz qayta so'ralardi.
  /* Chiziq rangi TOKENDAN (izohi `mapColors` da). */
  const c = useMapColors();

  const key = JSON.stringify([from, via ?? [], to]);
  const waypoints = React.useMemo<[number, number][]>(() => {
    const [f, v, t] = JSON.parse(key) as [[number, number], [number, number][], [number, number]];
    return [f, ...v, t];
  }, [key]);

  // Yo'l kelguncha TO'G'RI CHIZIQ turadi — xarita hech qachon "bo'sh va
  // tushunarsiz" ko'rinmasin (`RouteMapSheet` bilan bir xil qaror).
  const [points, setPoints] = React.useState<[number, number][]>(waypoints);
  const [real, setReal] = React.useState(false);

  /*
   * KADRGA nima kiradi: yo'lning o'zi + uchrashuv nuqtasi + mashina.
   *
   * ⚠️ `useMemo` SHART: massiv har renderda yangi bo'lsa `Fit` ning
   * effekti qayta ishga tushadi va xarita muttasil o'ziga tortib turadi
   * (jonli nuqta 30 soniyada yangilanadi — bu ayniqsa sezilardi).
   */
  const frame = React.useMemo<[number, number][]>(() => {
    const base = points.length >= 2 ? points : waypoints;
    const extra: [number, number][] = [];
    if (pickup) extra.push(pickup);
    if (driver) extra.push(driver.coord);
    return extra.length ? [...base, ...extra] : base;
    // Qiymat bo'yicha: massiv referensi emas, ICHIDAGI sonlar muhim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, waypoints, pickup?.[0], pickup?.[1], driver?.coord[0], driver?.coord[1]]);

  React.useEffect(() => {
    // Tashqaridan tayyor yo'l berilgan — qayta so'ramaymiz.
    if (external && external.length >= 2) {
      setPoints(external);
      setReal(true);
      return;
    }
    let cancelled = false;
    setPoints(waypoints);
    setReal(false);
    fetchRoadRoute(waypoints).then((r) => {
      if (cancelled) return;
      setPoints(r.points);
      setReal(r.isReal);
    });
    return () => {
      cancelled = true;
    };
  }, [waypoints, external]);

  return (
    <MapContainer
      center={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]}
      zoom={7}
      style={{ width: '100%', height: '100%' }}
      /* TINCH: g'ildirak, sudrash, ikki marta bosish — hammasi o'chiq.
         Sahifa ichidagi xarita boshqaruvni o'ziga olsa, odam sahifani
         sura olmay qoladi. */
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      zoomControl={false}
      touchZoom={false}
      keyboard={false}
      attributionControl
    >
      <TileLayer attribution={tileAttribution()} url={tiles.url} className={tiles.className} />
      {/* YO'L IKKI RANGDA: bosib o'tilgani so'nik, qolgani aksentda.
          Safar ketayotganda «qayergacha yetdi» degan savolga xarita
          RAQAMSIZ ham javob beradi. */}
      {real && points.length >= 2 && typeof doneIndex === 'number' && doneIndex > 0 && (
        <Polyline
          smoothFactor={0}
          positions={points.slice(0, Math.min(points.length, doneIndex + 1))}
          pathOptions={{ color: c.muted, weight: 4, opacity: 0.45 }}
        />
      )}
      {/* Uslub (yaxlit yo'l / uzuq taxmin) — `RouteLine` da. */}
      <RouteLine
        real={real}
        color={c.accent}
        positions={
          real && typeof doneIndex === 'number' && doneIndex > 0
            ? points.slice(Math.min(points.length - 1, doneIndex))
            : points
        }
      />
      <Marker position={from} icon={originIcon} />
      {(via ?? []).map((p, i) => (
        <Marker key={i} position={p} icon={viaIcon} />
      ))}
      <Marker position={to} icon={destIcon} />
      {pickup && <Marker position={pickup} icon={pickupIcon()} />}
      {/* Nuqta ikki ping ORASIDA suriladi — izohi `SmoothDriverMarker` da. */}
      {driver && (
        <SmoothDriverMarker
          coord={driver.coord}
          heading={driver.heading}
          updatedAt={driver.updatedAt}
        />
      )}
      <Fit points={frame} />
    </MapContainer>
  );
}
