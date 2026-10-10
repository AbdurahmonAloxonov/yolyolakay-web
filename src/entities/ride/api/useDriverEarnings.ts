import { useQuery } from '@tanstack/react-query';
import { getDriverEarnings } from '@/shared/api/rides';
import type { DriverStatistics } from '@/shared/api/types/ride';
import { getAccessToken } from '@/shared/lib/token';

/**
 * Haydovchi daromadi va safar statistikasi — `GET /rides/earnings`.
 *
 * Ruchka 2026-08-03 swagger yangilanishida sxema oldi (`DriverStatisticsResponse`),
 * shu paytgacha frontendda umuman ishlatilmagan edi.
 *
 * `staleTime` 2 daqiqa: raqamlar safar yakunlangandagina o'zgaradi, shuning uchun
 * ekranga har kirganda so'rov yubormaymiz. Safar yakunlangach chaqiruvchi
 * `['driver-earnings']` ni invalidatsiya qiladi.
 */
export const DRIVER_EARNINGS_KEY = ['driver-earnings'] as const;

export const useDriverEarnings = () =>
  useQuery<DriverStatistics>({
    queryKey: DRIVER_EARNINGS_KEY,
    queryFn: getDriverEarnings,
    enabled: !!getAccessToken(),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
