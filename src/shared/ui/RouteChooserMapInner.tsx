'use client';

import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { useMapColors } from '@/shared/lib/mapColors';
import { majorCities } from '@/shared/data/uzCities';
import { cityIcon } from './mapIcons';
import { useTileUrl } from '@/shared/lib/mapTiles';

/**
 * YO'NALISHNI XARITADAN TANLASH — landing sahifasi uchun.
 *
 * 🔴 NEGA KERAK BO'LDI (egasi, 16.09.2026: «karta to'liq ishlatilsin»).
 * Landingda xarita UMUMAN yo'q edi: birinchi ekranda ikkita bo'sh matn
 * maydoni turardi («Qayerdan», «Qayerga»). Yangi odam uchun bu eng qiyin
 * qadam — u platformada QAYSI shaharlar borligini bilmaydi va bo'sh
 * maydonga nima yozishni tushunmaydi.
 *
 * ⚠️ BU YERDA HAQIQIY SAFARLAR KO'RSATILMAYDI. O'ylab topilgan nuqta
 * chizish oson bo'lardi-yu, u YOLG'ON bo'lardi: `GET /rides/search`
 * jo'nash VA borish koordinatasini birga talab qiladi (ya'ni «bugungi
 * hamma safar» degan so'rov yo'q), `GET /rides/recommendations` esa
 * mehmonga 401 qaytaradi (16.09.2026 da o'lchandi). Shuning uchun xarita
 * ma'lumot emas, KIRISH NUQTASI: ikki shahar bosiladi va HAQIQIY qidiruv
 * ishga tushadi.
 */
/*
 * Shahar nuqtasi — umumiy belgilar manbasidan (`mapIcons`).
 *
 * 🔴 BOSISH MAYDONI KO'RINADIGAN NUQTADAN KATTA (16.09.2026): 11 px
 * nuqta xaritada to'g'ri o'lcham, lekin BARMOQ uchun kichik — telefon
 * enida Farg'ona vodiysidagi shaharlar bir-biriga yaqin tushadi va
 * noto'g'ri shahar bosilardi (Buxoro o'rniga Navoiy).
 *
 * 🔑 17.09.2026: belgi endi shu faylda YASALMAYDI. Saytdagi oltita
 * xarita har biri o'z nuqtasini chizardi — o'lchamlari ham, ranglari
 * ham har xil edi. Endi manba bitta va u TEMA TOKENLARIDAN o'qiydi.
 */

/**
 * Kadrni shaharlarga moslaydi.
 *
 * 🔴 `MapContainer` ning `bounds` propi ISHLAMADI (16.09.2026, lokalda
 * ko'z bilan ko'rildi: kadr qanday bo'lsa shundayligicha qoldi). Sayt
 * bo'ylab qolgan hamma xarita `useMap` + `fitBounds` naqshini ishlatadi
 * (`ResultsMapInner`, `RoutePreviewInner`, `MyRoadsMapInner`) — bu yerda
 * ham o'shani ishlatamiz. Bitta naqsh, bitta xatti-harakat.
 */
function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(points as L.LatLngBoundsExpression, { padding: [24, 24] });
  }, [points, map]);
  return null;
}

export default function RouteChooserMapInner({
  from,
  to,
  onPick,
}: {
  from: string;
  to: string;
  onPick: (city: string) => void;
}) {
  const tiles = useTileUrl();
  const cities = React.useMemo(() => majorCities(), []);
  /* Chiziq rangi TOKENDAN — izohi `mapColors` da. */
  const c = useMapColors();
  // Kadrga beriladigan nuqtalar — `Fit` ning bog'liqligi. Har renderda
  // yangi massiv yasalsa `fitBounds` qayta ishga tushib, shahar
  // bosilganda kadr sakrab ketardi.
  const points = React.useMemo(() => cities.map((c) => c.coord), [cities]);
  const norm = (s: string) => s.trim().toLowerCase();

  const fromCity = cities.find((c) => norm(c.name) === norm(from));
  const toCity = cities.find((c) => norm(c.name) === norm(to));

  return (
    <MapContainer
      /*
        Bu faqat BOSHLANG'ICH qiymat — haqiqiy kadrni pastdagi `Fit`
        shaharlar ro'yxatidan hisoblaydi va ustidan yozadi.

        🔴 NEGA SHART (16.09.2026, prodda ko'z bilan ko'rildi): ilgari
        bu yerda faqat qotirilgan `zoom={5}` turardi — men uni qo'lda
        tanlagandim. Natijada kadrga Turkiya, Eron, Xitoy va
        Qozog'iston kirib, O'zbekiston o'rtada kichkina bo'lib
        qolardi: Farg'ona vodiysidagi nuqtalar bir-biriga yopishib,
        Buxoro o'rniga Navoiy bosilib ketardi.

        Endi ro'yxatga yangi shahar qo'shilsa kadr O'ZI moslashadi va
        bu yerga qaytib tegish kerak emas.
      */
      center={[41.5, 64.5]}
      zoom={5}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={false}
      zoomControl={false}
      /* Leaflet'ning O'Z yozuvi 14 px balandlikdagi HAVOLA yasaydi —
         barmoq nishoni qoidasidan (44 px) kichik va uni audit
         «mayda nishon» deb tutadi. Attributsiya SHART, shuning uchun
         uni o'rovchi (`RouteChooserMap`) o'zi chizadi. */
      attributionControl={false}
    >
      <TileLayer url={tiles.url} className={tiles.className} />
      <Fit points={points} />
      {/* Tanlangan juftlik orasidagi chiziq — «shu ikkitasi tanlandi»
          degan javob. Usiz ikki nuqta orasidagi bog'liqlik ko'rinmasdi. */}
      {fromCity && toCity && (
        <Polyline
          positions={[fromCity.coord, toCity.coord]}
          pathOptions={{ color: c.accent, weight: 3, opacity: 0.85, dashArray: '6 6' }}
        />
      )}
      {cities.map((c) => {
        const state = fromCity?.name === c.name ? 'from' : toCity?.name === c.name ? 'to' : null;
        return (
          <Marker
            key={c.name}
            position={c.coord}
            icon={cityIcon(state)}
            // Ekran o'qigich uchun ham nom bo'lsin: nuqtaning o'zi
            // hech nima aytmaydi.
            title={c.name}
            alt={c.name}
            eventHandlers={{ click: () => onPick(c.name) }}
          />
        );
      })}
    </MapContainer>
  );
}
