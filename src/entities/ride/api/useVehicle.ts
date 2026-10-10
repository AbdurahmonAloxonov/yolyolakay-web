import { useQuery } from '@tanstack/react-query';
import { getVehicle, type Vehicle } from '@/shared/api/vehicles';

/**
 * Safar mashinasi — `GET /vehicles/{id}`.
 *
 * `staleTime` uzun (30 daqiqa): mashina rusumi/raqami deyarli o'zgarmaydi, safar
 * sahifasi har ochilganda qayta so'ramaymiz (backend chaqiruvi ~0.7 s turadi).
 *
 * `retry: false` — bu qo'shimcha ma'lumot, ruchka yiqilsa qatorni shunchaki
 * chizmaymiz. Bir necha marta urinish sahifani sekinlashtirardi.
 */
export const useVehicle = (vehicleId?: string | null) =>
  useQuery<Vehicle | null>({
    queryKey: ['vehicle', vehicleId],
    enabled: !!vehicleId,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: () => getVehicle(String(vehicleId)),
  });
