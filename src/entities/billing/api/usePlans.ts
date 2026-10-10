import { useQuery } from '@tanstack/react-query';
import { getPlans } from '@/shared/api/billing';
import { getAccessToken } from '@/shared/lib/token';

/**
 * Tarif setkasi — YAGONA manba endi `GET /billing/plans` (jonli 2026-07-18):
 * Free Trial 0 (5 safar), Plus 50 000 (50), Pro 100 000 (cheksiz), Premium 150 000 (cheksiz).
 * Eski hardcode (shared/config/tariffs.ts) NOTO'G'RI qiymatlarga ega edi (premium 200k,
 * pro 150 safar) — o'chirildi. `quota` shakli eski sahifalar kutgani bilan mos:
 * -1 = cheksiz (formatQuota shuni "Cheksiz" deb ko'rsatadi).
 */
export interface PlanQuota {
  /** `POST /billing/pay` ga ketadigan qiymat — lowercase ('trial'/'plus'/'pro'/'premium'). */
  type: string;
  /** Ko'rsatish nomi — backend bergan holicha ("Free Trial", "Plus", ...). */
  name: string;
  price: number;
  /** Oylik safar paketi, -1 = cheksiz. */
  quota: number;
  /** Oylik bepul posilka paketi. */
  parcels: number;
  features: string[];
}

// Obuna jadvalida trial `plan_name: "trial"` (jonli) — "Free Trial"ni shunga xaritalaymiz,
// qolganlari oddiy lowercase (backend pay faqat lowercase qabul qiladi).
const toType = (planName: string): string => {
  const n = planName.trim().toLowerCase();
  return n === 'free trial' ? 'trial' : n;
};

export const usePlanQuotas = () =>
  useQuery<PlanQuota[]>({
    queryKey: ['billing-plans'],
    // MEHMONDA SO'RALMAYDI: ruchka `BearerAuth` talab qiladi va tokensiz 401 beradi.
    // Header (balans) har sahifada chiziladi, shuning uchun gard bo'lmasa mehmon
    // HAR sahifada ikkita ortiqcha 401 oladi — konsolda shovqin va bekorga trafik.
    enabled: !!getAccessToken(),
    staleTime: 10 * 60 * 1000,
    // Setka bo'lmasa sahifada SOTADIGAN narsa qolmaydi — bitta tarmoq uzilishi
    // "tariflar yo'q"ga aylanmasin uchun bir marta qayta uriniladi.
    retry: 1,
    queryFn: async () => {
      const plans = await getPlans();
      /*
       * 🔴 YO'LOVCHI TARIFLARI CHIQARIB TASHLANADI (2026-09-03).
       *
       * Backend `GET /billing/plans` ga to'rtta yangi tarif qo'shdi —
       * «Passenger Trial / Plus / Pro / Premium», 1 000–5 000 so'mdan,
       * ya'ni yo'lovchidan bron uchun pul olish taklif qilingan.
       *
       * Bizning modelimizda yo'lovchi PUL TO'LAMAYDI: to'lov haydovchi
       * tomonda. Egasi: «oldingi tariflarimiz Plus, Pro, Premium yaxshi
       * edi — qo'shilganlarini olib tashla, kerakmas».
       *
       * ⚠️ Roli NOMA'LUM tarif QOLDIRILADI: backend maydonni olib
       * tashlasa, hamma tarif yo'qolib sahifada sotadigan narsa
       * qolmasligi kerak emas.
       */
      const forDriver = plans.filter(
        (p) =>
          String(p.target_role ?? '')
            .trim()
            .toLowerCase() !== 'passenger'
      );
      return forDriver.map((p) => ({
        type: toType(String(p.plan_name ?? '')),
        name: String(p.plan_name ?? ''),
        price: Number(p.price ?? 0),
        quota: Number(p.rides_quota ?? 0),
        parcels: Number(p.free_parcels_quota ?? 0),
        features: Array.isArray(p.features) ? p.features : [],
      }));
    },
  });
