'use client';

import React from 'react';
import { Polyline } from 'react-leaflet';

/**
 * Marshrut chizig'i — BARCHA xaritalar uchun YAGONA qoida.
 *
 * 🔴 NEGA (28.09.2026, egasi: «xaritada to'g'ri chiziqlar, rasvo»).
 * Yo'l kelguncha yoki so'rov yiqilganda nuqtalar TO'G'RI CHIZIQ bilan
 * ulanardi — va u haqiqiy yo'l bilan AYNAN bir xil rang va qalinlikda
 * chizilardi. Odam tog' ustidan o'tgan chiziqni «marshrut» deb ko'rardi.
 *
 * Endi ikki xil ko'rinish:
 *   • HAQIQIY YO'L — yaxlit, to'liq rangda, oq hoshiyali (har xil plitka
 *     ustida ham o'qiladi);
 *   • TAXMINIY (to'g'ri) chiziq — UZUQ, ingichka va xira: «bu yo'nalish,
 *     yo'l emas». Yo'l kelishi bilan o'rnini bo'shatadi.
 *
 * ⚠️ Ikki holat ATAYIN har xil daraxt (bitta `Polyline` / ikkitasi
 * `Fragment` da) va `key` bilan: holat almashganda qatlam QAYTA yasaladi.
 * Leaflet `setStyle` uslubni almashtirmaydi, eskisi ustiga QO'SHADI —
 * bir qatlamda uslub almashtirilsa uzuqlik haqiqiy yo'l ustida qolib
 * ketardi (prodda ko'rilgan: `stroke-dasharray="6 6"`, 17.09).
 *
 * Ilovadagi juftligi — `lib/features/map/route_line.dart`.
 */
export function RouteLine({
  positions,
  real,
  color,
  weight = 4,
  opacity = 0.9,
}: {
  positions: [number, number][];
  /** `RoadRoute.isReal` — faqat shu belgi haqiqiy yo'lni ajratadi. */
  real: boolean;
  color: string;
  weight?: number;
  opacity?: number;
}) {
  if (positions.length < 2) return null;
  if (!real) {
    return (
      <Polyline
        key="approx"
        positions={positions}
        interactive={false}
        pathOptions={{
          color,
          weight: Math.min(3, Math.max(2, weight * 0.6)),
          opacity: 0.55,
          dashArray: '10 8',
        }}
      />
    );
  }
  return (
    <React.Fragment key="real">
      {/* Hoshiya — ostida, kengroq. */}
      <Polyline
        /* Izohi `LiveMapInner` da: Leaflet soddalashtirishi yo'lning
           burilishlarini yeb qo'yadi. */
        smoothFactor={0}
        positions={positions}
        interactive={false}
        pathOptions={{ color: '#fff', weight: weight + 3, opacity: 0.85 }}
      />
      <Polyline
        smoothFactor={0}
        positions={positions}
        interactive={false}
        pathOptions={{ color, weight, opacity }}
      />
    </React.Fragment>
  );
}
