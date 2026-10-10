import { isUnlimitedQuota } from '@/shared/lib/format';

/**
 * Tarif kartasidagi REKLAMA raqamlari — hammasi HISOBLANADI.
 *
 * 🔴 Egasi shart qo'ydi (2026-08-16): "reklamani kuchliroq berishimiz kerak,
 * bo'rttirib lekin TO'G'RISINI". Ya'ni kartadagi har bir gap oddiy arifmetika
 * bo'lishi kerak, o'ylab topilgan maqtov emas.
 *
 * Mobil ilovada ayni mantiq: `features/billing/tariffs_screen.dart`.
 */

interface PlanLike {
  type: string;
  name: string;
  price: number;
  /** Oylik safar paketi, -1 = cheksiz. */
  quota: number;
}

/**
 * Bitta safarning narxi — tarif narxini paketga bo'lib.
 *
 * "60 000 so'm/oy" qimmat eshitiladi, "1 safar ≈ 1 500 so'm" esa arzon —
 * VA IKKALASI HAM AYNI HAQIQAT, faqat odam tushunadigan o'lchovda.
 *
 * Cheksiz va bepul tarifda `null`: bo'linadigan son yo'q.
 */
export const perRidePrice = (plan: PlanLike): number | null => {
  if (plan.price <= 0 || isUnlimitedQuota(plan.quota) || plan.quota <= 0) return null;
  return plan.price / plan.quota;
};

/**
 * Bitta safar eng arzonga tushadigan tarif.
 *
 * 🔴 Ilgari saytda "mashhur" nishoni `type === 'premium'` deb QOTIRIB
 * qo'yilgan edi. Bu ikki sababdan yomon: narxlar o'zgarsa yozuv yolg'onga
 * aylanadi, va u hech qanday faktga tayanmaydi — shunchaki eng qimmatini
 * ko'rsatadi.
 *
 * 🔴 CHEKSIZ tarif hisobga OLINMAYDI: uni "0 so'm bir safarga" deb hisoblasak
 * u doim g'olib chiqadi, holbuki cheksiz tarif faqat KO'P yuradigan odam
 * uchun foydali. Oyiga ikki marta yuradiganga u eng qimmat variant.
 */
export const bestValueType = (plans: PlanLike[]): string | null => {
  let best: PlanLike | null = null;
  let bestPerRide = Infinity;
  for (const plan of plans) {
    if (plan.type === 'trial') continue;
    const perRide = perRidePrice(plan);
    if (perRide == null) continue;
    if (perRide < bestPerRide) {
      bestPerRide = perRide;
      best = plan;
    }
  }
  return best?.type ?? null;
};

/**
 * Cheksiz tarif nechta safardan keyin eng arzon tarifdan foydali bo'ladi.
 *
 * Bu bir vaqtning o'zida ham reklama, ham OGOHLANTIRISH: kam yuradigan odamga
 * bu tarif kerak emasligini ochiq aytadi. Ishonchni aynan shu qozonadi —
 * maqtov emas, hisob.
 */
export const unlimitedBreakEven = (
  plans: PlanLike[],
  unlimited: PlanLike
): { rides: number; planName: string } | null => {
  if (!isUnlimitedQuota(unlimited.quota) || unlimited.price <= 0) return null;

  let cheapest: PlanLike | null = null;
  let best = Infinity;
  for (const plan of plans) {
    const perRide = perRidePrice(plan);
    if (perRide == null || perRide <= 0) continue;
    if (perRide < best) {
      best = perRide;
      cheapest = plan;
    }
  }
  if (!cheapest) return null;

  // Yuqoriga yaxlitlanadi: "66.7 safar" degan gap yo'q — 67-safardan
  // boshlab haqiqatan arzonroq bo'ladi.
  return { rides: Math.ceil(unlimited.price / best), planName: cheapest.name };
};
