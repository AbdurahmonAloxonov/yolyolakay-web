'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { getMyRides, getMyBookings, getDriverRides } from '@/shared/api/rides';
import { hasValidCoords } from '@/shared/lib/maps';
import { useTr } from '@/shared/lib/useTr';

// Leaflet SSR'ni ko'tarmaydi (`window`) — faqat brauzerda.
const Inner = dynamic(() => import('./MyRoadsMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-bg-soft" />,
});

type Leg = [number, number][];

/**
 * «YO'LLARIM» — bosib o'tilgan yo'nalishlar bitta xaritada.
 *
 * 🔴 NEGA KERAK BO'LDI (egasi, 16.09.2026: «karta to'liq ishlatilsin»).
 * Profilda odam haqida reyting va sharhlar bor edi, lekin u QAYERLARDA
 * bo'lgani — platformadagi eng shaxsiy narsa — hech qayerda ko'rinmasdi.
 *
 * 🔑 MA'LUMOT HAQIQIY (loyiha qoidasi: «o'lchama, ishonma»). Har chiziq —
 * `GET /rides/my` dan kelgan haqiqiy safarning jo'nash va borish
 * koordinatasi. Km ham, CO2 ham yozilmaydi: backend ularni bermaydi va
 * taxminiy raqam yolg'on bo'lardi. Faqat SAFARLAR SONI — u oddiy sanoq.
 *
 * Ilovadagi `MyRoadsMap` ning juftligi — ikkalasi bir xil ko'rinsin.
 */
export function MyRoadsMap({
  height = 220,
  driverId,
}: {
  height?: number;
  /**
   * BEGONA HAYDOVCHINING yo'llari (ochiq profil sahifasi).
   *
   * 🔴 Berilmasa — O'Z yo'llarim (ikkala rol bo'yicha). Berilsa —
   * faqat shu haydovchining ochiq safarlari: `GET /users/{id}/rides`
   * (16.09.2026 da backend ochdi, mehmonga ham 200, PII yo'q).
   *
   * Nega ikkalasi BITTA komponentda: ko'rinish AYNAN bir xil bo'lishi
   * kerak. Ikkita nusxa yasasak, ertaga biri o'zgarib ikkinchisi
   * qolib ketardi — loyihaning eski kasali.
   */
  driverId?: string | null;
}) {
  const tr = useTr();

  const { data: legs = [] } = useQuery<Leg[]>({
    queryKey: ['my-roads', driverId ?? 'me'],
    queryFn: async () => {
      /*
       * IKKALA ROL ham hisobga olinadi: odam bir safarda haydovchi,
       * boshqasida yo'lovchi bo'lishi mumkin va «yo'llarim» ikkalasini
       * ham bildiradi. Yo'lovchilik safari bronning ICHIDAN keladi.
       *
       * Ikkala so'rov ham yiqilsa bo'sh ro'yxat qaytadi va xarita
       * UMUMAN chizilmaydi — profil avvalgidek qolaveradi.
       */
      const [rides, bookings] = driverId
        ? [await getDriverRides(driverId).catch(() => []), []]
        : await Promise.all([
            getMyRides('driver').catch(() => []),
            getMyBookings().catch(() => []),
          ]);

      const seen = new Set<string>();
      const out: Leg[] = [];

      const add = (ride: Record<string, any> | null | undefined) => {
        if (!ride) return;
        const id = String(ride.id ?? ride.ID ?? '');
        if (id && seen.has(id)) return;
        if (id) seen.add(id);
        // Koordinatasiz safar TASHLAB YUBORILADI: nol nuqtaga chizilgan
        // chiziq xaritani okean o'rtasiga sudrab ketardi.
        /*
         * 🔴 MANZIL KOORDINATASI IKKI XIL NOMDA KELADI (16.09.2026 da
         * o'lchandi va tutildi):
         *
         *   /rides/my            → destination_lat / destination_lon
         *   /users/{id}/rides    → dest_lat / dest_lon      ← yangi ruchka
         *
         * Faqat birinchisini o'qisak, begona haydovchi profilidagi
         * karta JIMGINA bo'sh qolardi: koordinata `undefined` bo'lib,
         * hamma safar filtrdan tushib ketardi va xato KO'RINMASDI.
         */
        const destLat = ride.destination_lat ?? ride.dest_lat;
        const destLon = ride.destination_lon ?? ride.dest_lon;
        if (!hasValidCoords(ride.origin_lat, ride.origin_lon)) return;
        if (!hasValidCoords(destLat, destLon)) return;
        out.push([
          [ride.origin_lat, ride.origin_lon],
          ...((ride.stops ?? []) as Array<{ lat: number; lon: number }>)
            .filter((s) => hasValidCoords(s.lat, s.lon))
            .map((s) => [s.lat, s.lon] as [number, number]),
          [destLat, destLon],
        ]);
      };

      for (const ride of rides) add(ride as unknown as Record<string, any>);
      for (const booking of bookings) {
        add((booking as Record<string, any>).ride ?? (booking as Record<string, any>).Ride);
      }
      return out;
    },
  });

  // Safar bo'lmasa karta UMUMAN chizilmaydi — bo'sh xarita «buzilgan»
  // ko'rinardi va yangi foydalanuvchini bekorga xafa qilardi.
  if (legs.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-2xl border border-border" style={{ height }}>
        <Inner legs={legs} />
      </div>
      <p className="text-xs font-bold text-text-muted">
        {tr(
          `${legs.length} ta safar xaritada`,
          `Поездок на карте: ${legs.length}`,
          `${legs.length} trips on the map`
        )}
      </p>
    </div>
  );
}
