'use client';

import { useEffect, useState } from 'react';
import { haversineKm } from '@/shared/lib/geo';

/** Manzilga "yetdik" deb hisoblanadigan masofa (km). ~300 m. */
const ARRIVAL_KM = 0.3;

/**
 * Faol safarda haydovchining joriy joylashuvi borish nuqtasiga yaqinlashganini kuzatadi.
 * `active=true` bo'lgandagina geolokatsiyani (watchPosition) yoqadi va manzilga ~300m
 * qolganda `true` qaytaradi — dashboard shunda "Yakunlaysizmi?" so'rovini ko'rsatadi.
 * Ruxsat berilmasa yoki koordinata bo'lmasa — jimgina `false` (majburiy emas).
 */
export function useArrivalPrompt(active: boolean, destLat?: number, destLon?: number): boolean {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    setArrived(false);
    const valid =
      typeof destLat === 'number' &&
      typeof destLon === 'number' &&
      (destLat !== 0 || destLon !== 0);
    if (!active || !valid || typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    let cancelled = false;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        const km = haversineKm(
          [pos.coords.latitude, pos.coords.longitude],
          [destLat as number, destLon as number]
        );
        if (km <= ARRIVAL_KM) setArrived(true);
      },
      () => {
        /* ruxsat yo'q / xato — jim */
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [active, destLat, destLon]);

  return arrived;
}
