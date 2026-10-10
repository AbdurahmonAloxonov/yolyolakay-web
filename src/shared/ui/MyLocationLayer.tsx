'use client';

import React from 'react';
import { Circle, Marker, useMapEvents, useMap } from 'react-leaflet';
import { Locate, LocateFixed, LocateOff } from 'lucide-react';
import { toast } from 'sonner';

import type { MyLocationLabels } from '@/shared/lib/myLocationLabels';
import { useMyLocation, type MyLocationStatus } from '@/shared/lib/useMyLocation';
import { myLocationIcon } from './mapIcons';

/**
 * «MEN SHU YERDAMAN» — XARITADAGI KO'K NUQTA (18.09.2026).
 *
 * 🔴 NEGA (egasi: «karta ishlashi bo'yicha solishtirish kerak edi»):
 * Yandex Go'da xaritada odamning O'ZI turadi — u yurganda nuqta ham
 * yuradi. Bizda esa joylashuv BIR MARTA olinardi va undan faqat eng
 * yaqin shahar nomi chiqarilardi. Ya'ni «uchrashuv nuqtasiga qancha
 * qoldi, qay tomonga yurishim kerak» degan savolga xarita javob
 * bermasdi, holbuki javob barmoq ostida edi.
 *
 * 🔑 UCH HOLATLI TUGMA (Yandex Go va xaritalarning umumiy qoidasi):
 *
 *   o'chiq        → bosilsa: GPS yoqiladi, nuqta chiziladi, kadr ergashadi
 *   ergashmoqda   → bosilsa: butunlay o'chadi
 *   yoqiq, lekin kadr qochgan (odam xaritani surgan) → bosilsa: qaytadi
 *
 * Uchinchi holat SHART: xaritani surgan odamning kadri darhol orqaga
 * sakrab kelsa, xaritani umuman ko'rib bo'lmaydi. Lekin nuqta QOLADI —
 * aks holda odam o'z joyini yo'qotib, GPS'ni qaytadan yoqishi kerak
 * bo'lardi.
 *
 * 🔑 YAGONA MANBA: bu qatlam ikki xaritada ishlatiladi («Xarita» bo'limi
 * va safar marshruti varag'i). Har birida alohida yozilganda ertaga
 * biri tuzatilib ikkinchisi eski qolardi — belgilar bilan aynan shunday
 * bo'lgan (`mapIcons`).
 */

export interface MyLocationControl {
  tracking: boolean;
  following: boolean;
  status: MyLocationStatus;
  toggle: () => void;
  stopFollow: () => void;
  setStatus: (s: MyLocationStatus) => void;
}

/** Uch holatli tugmaning MANTIG'I (ko'rinishi — `MyLocationButton`). */
export function useMyLocationControl(labels: MyLocationLabels): MyLocationControl {
  const [tracking, setTracking] = React.useState(false);
  const [following, setFollowing] = React.useState(false);
  const [status, setStatus] = React.useState<MyLocationStatus>('off');

  /* Ruxsat berilmagani TUSHUNTIRILADI: tugma jimgina ishlamasa, odam
     uni buzuq deb o'ylaydi — javob esa uning O'Z brauzeri sozlamasida. */
  React.useEffect(() => {
    if (status === 'denied') toast.error(labels.locateDenied);
    else if (status === 'error') toast.error(labels.locateError);
  }, [status, labels.locateDenied, labels.locateError]);

  const toggle = React.useCallback(() => {
    if (!tracking) {
      setTracking(true);
      setFollowing(true);
    } else if (!following) {
      setFollowing(true);
    } else {
      setTracking(false);
      setFollowing(false);
    }
  }, [tracking, following]);

  const stopFollow = React.useCallback(() => setFollowing(false), []);

  return { tracking, following, status, toggle, stopFollow, setStatus };
}

/** Tugmaning O'ZI — joylashuvini chaqiruvchi hal qiladi. */
export function MyLocationButton({
  ctl,
  labels,
  className = '',
}: {
  ctl: MyLocationControl;
  labels: MyLocationLabels;
  className?: string;
}) {
  const denied = ctl.status === 'denied' || ctl.status === 'error';
  const Icon = denied ? LocateOff : ctl.following ? LocateFixed : Locate;
  return (
    <button
      type="button"
      /* Yozuv HOLATNI aytadi: yoqiq tugmaning nomi o'zgarmasa,
         ko'rmaydigan odam uni qayta bosib o'chirish mumkinligini
         bilmaydi. */
      aria-label={ctl.tracking ? labels.locateStop : labels.locate}
      aria-pressed={ctl.tracking}
      className={`${className} ${ctl.tracking && !denied ? 'text-accent' : ''}`}
      onClick={ctl.toggle}
    >
      <Icon className={`h-5 w-5 ${ctl.status === 'asking' ? 'animate-pulse' : ''}`} aria-hidden />
    </button>
  );
}

/**
 * Xaritadagi qatlam: ko'k nuqta + ANIQLIK DOIRASI.
 *
 * 🔑 GPS YANGILANISHI FAQAT SHU KOMPONENTNI qayta chizadi (`useMyLocation`
 * ataylab shu yerda chaqiriladi). Yuqorida, xaritaning o'zida bo'lganda
 * har bir GPS javobi butun xaritani — yuzlab nuqta va 3000 nuqtali
 * yo'lni — qayta chizardi.
 */
export function MyLocationLayer({
  ctl,
  color,
  onFix,
}: {
  ctl: MyLocationControl;
  /** Doira rangi — TOKENDAN o'qilgan (`useMapColors().me`). SVG'da
      `var(--…)` ishlamaydi, izohi `mapColors.ts` da. */
  color: string;
  /** Birinchi aniq javob — sahifa undan foydalanishi mumkin. */
  onFix?: (lat: number, lon: number) => void;
}) {
  const map = useMap();
  const { pos, status } = useMyLocation(ctl.tracking);
  const { following, tracking, stopFollow, setStatus } = ctl;

  React.useEffect(() => setStatus(status), [status, setStatus]);

  /* Odam xaritani O'Z QO'LI bilan surdi — ergashish to'xtaydi.
     ⚠️ `dragstart`, `moveend` EMAS: kadrni biz ham `setView` bilan
     siljitamiz va `moveend` ga bog'lansak ergashish o'zini o'zi
     o'chirib qo'yardi. */
  useMapEvents({ dragstart: () => following && stopFollow() });

  const firstFix = React.useRef(false);
  React.useEffect(() => {
    if (!tracking) {
      firstFix.current = false;
      return;
    }
    if (pos && !firstFix.current) {
      firstFix.current = true;
      onFix?.(pos.lat, pos.lon);
    }
  }, [pos, tracking, onFix]);

  React.useEffect(() => {
    if (!following || !pos) return;
    /* Zum SAQLANADI: odam ko'chani ko'rish uchun yaqinlashtirgan
       bo'lsa, har GPS javobida uni orqaga tortib olish — qo'lidan
       xaritani tortib olish bilan barobar. Uzoqdan boshlansa esa
       shahar darajasiga yaqinlashtiriladi. */
    map.setView([pos.lat, pos.lon], Math.max(map.getZoom(), 13), { animate: true });
  }, [following, pos, map]);

  if (!tracking || !pos) return null;

  return (
    <>
      {/*
        ANIQLIK DOIRASI — METRDA (piksel emas), ya'ni zum bilan birga
        o'sadi. 🔑 U YOLG'ONNI TO'SADI: GPS binolar orasida 50 metrgacha
        xato qiladi va doirasiz nuqta «men AYNAN shu yerdaman» deb
        turadi — odam esa uchrashuv nuqtasini shunga qarab tanlaydi.
      */}
      {pos.accuracyM != null && pos.accuracyM > 0 && (
        <Circle
          center={[pos.lat, pos.lon]}
          radius={pos.accuracyM}
          pathOptions={{ color, weight: 1, opacity: 0.4, fillColor: color, fillOpacity: 0.12 }}
        />
      )}
      <Marker position={[pos.lat, pos.lon]} icon={myLocationIcon()} />
    </>
  );
}
