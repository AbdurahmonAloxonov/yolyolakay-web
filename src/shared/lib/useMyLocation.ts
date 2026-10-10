'use client';

import React from 'react';

/**
 * «MEN SHU YERDAMAN» — xaritadagi JONLI nuqta.
 *
 * 🔴 NEGA YOZILDI (egasi, 18.09.2026 — Yandex Go bilan solishtirish):
 * bizda joylashuv BIR MARTA olinardi (`getCurrentPosition`) va undan
 * faqat eng yaqin SHAHAR NOMI chiqarilardi. Ya'ni xaritada odamning
 * o'zi YO'Q edi: u qayerda turgani, qay tomonga yurayotgani ko'rinmasdi
 * va uchrashuv nuqtasiga yaqinlashayotganini xaritadan bilib bo'lmasdi.
 * Yandex Go'da (va har qanday xaritada) bu — ko'k nuqta.
 *
 * 🔑 ANIQLIK DOIRASI SHART. GPS xatosi shaharda 5 m, binolar orasida
 * 50 m bo'lishi mumkin. Doirasiz nuqta «men AYNAN shu yerdaman» deb
 * turadi va odam uchrashuv nuqtasini xato tanlaydi — doira esa
 * «shu atrofda» deb halol gapiradi.
 *
 * ⚠️ KUZATUV FAQAT SO'RALGANDA yoqiladi (`enabled`). Doimiy
 * `watchPosition` — batareya va, undan muhimi, odam so'ramagan
 * kuzatuv. Tugma bosilmagan bo'lsa GPS ham tegilmaydi.
 */

export interface MyLocation {
  lat: number;
  lon: number;
  /** GPS aniqligi (metr). Xaritada shu radiusda doira chiziladi. */
  accuracyM: number | null;
  at: number;
}

export type MyLocationStatus = 'off' | 'asking' | 'on' | 'denied' | 'error';

export function useMyLocation(enabled: boolean): {
  pos: MyLocation | null;
  status: MyLocationStatus;
} {
  const [pos, setPos] = React.useState<MyLocation | null>(null);
  const [status, setStatus] = React.useState<MyLocationStatus>('off');

  React.useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      return;
    }

    // Birinchi javob kelguncha holat «so'ralyapti» — tugma shuni
    // ko'rsatadi. Busiz odam tugmani bosib, hech nima bo'lmagandek
    // turgan ekranga qarab qoladi (GPS 10 soniyagacha o'ylashi mumkin).
    setStatus((s) => (s === 'on' ? s : 'asking'));

    const id = navigator.geolocation.watchPosition(
      (p) => {
        setStatus('on');
        setPos({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracyM: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
          at: Date.now(),
        });
      },
      (err) => {
        // 1 = PERMISSION_DENIED. Qolganlari (joy topilmadi, vaqt tugadi)
        // — vaqtinchalik, shuning uchun boshqa matn.
        setStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { pos, status };
}
