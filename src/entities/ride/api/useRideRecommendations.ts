import { useQuery } from '@tanstack/react-query';
import { getRideRecommendations, type RideRecommendations } from '@/shared/api/rides';
import { getAccessToken } from '@/shared/lib/token';

/**
 * Tavsiyalar — `GET /rides/recommendations`.
 *
 * Mehmonda UMUMAN so'ralmaydi (ruchka `BearerAuth`), shuning uchun `enabled`.
 * `staleTime` 5 daqiqa: bu qidiruv emas, sahifa ochilishida ko'rsatiladigan
 * qo'shimcha blok — har kirishda so'rov yubormaymiz.
 *
 * 2026-08-07: ilgari bu yerda kelgan safarlar `rideCache`ga yozilardi. Ruchka
 * SAFAR qaytarmaydi (yo'nalish statistikasi — `shared/api/rides.ts` izohiga qarang),
 * shuning uchun keshlash olib tashlandi: keshga yozadigan narsa yo'q edi.
 */
export const RIDE_RECOMMENDATIONS_KEY = ['ride-recommendations'] as const;

export const useRideRecommendations = () =>
  useQuery<RideRecommendations>({
    queryKey: RIDE_RECOMMENDATIONS_KEY,
    enabled: !!getAccessToken(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: getRideRecommendations,
  });
