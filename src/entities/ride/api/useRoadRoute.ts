'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRoadRoute, routeKey, type RoadRoute } from '@/shared/api/routing';

/**
 * HAQIQIY YO'L — `GET /routing/route`.
 *
 * 🔴 NEGA HOOK (17.09.2026): yo'l geometriyasi endi IKKI joyda kerak —
 * xaritani chizishda ham, «qancha qoldi» ni hisoblashda ham. Ilgari uni
 * `RoutePreviewInner` o'z ichida so'rardi va tashqariga bermasdi: sahifa
 * o'sha yo'lni qayta so'rashi kerak bo'lardi.
 *
 * 🔑 KESH ABADIY (`staleTime: Infinity`): yo'l o'zgarmaydi. Toshkent–
 * Samarqand javobi 3204 nuqta va ~800 ms (o'lchandi) — uni har
 * yangilanishda qayta so'rash isrof bo'lardi, jonli nuqta esa 30
 * soniyada bir keladi.
 *
 * ⚠️ Mehmonga ham OCHIQ (o'lchandi: tokensiz 200) — xarita bo'limi
 * ro'yxatdan o'tmagan odamga ham to'g'ri chiziq ko'rsatadi.
 */
export function useRoadRoute(waypoints: [number, number][] | null) {
  const key = routeKey(waypoints ?? []);
  return useQuery<RoadRoute>({
    queryKey: ['road-route', key],
    enabled: !!waypoints && waypoints.length >= 2,
    // Taxminiy (yiqilgan) javob abadiy qolmasin — keyingi ochilishda
    // qayta uriniladi. Haqiqiy yo'l o'zgarmaydi.
    staleTime: (q: { state: { data?: RoadRoute } }) => (q.state.data?.isReal ? Infinity : 30_000),
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: () => fetchRoadRoute(waypoints as [number, number][]),
  });
}
