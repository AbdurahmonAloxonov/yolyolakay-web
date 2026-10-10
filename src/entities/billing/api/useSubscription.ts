import { useQuery } from '@tanstack/react-query';
import { getSubscription } from '@/shared/api/billing';
import type { Subscription } from '@/shared/api/types/billing';
import { usePlanQuotas, type PlanQuota } from './usePlans';
import { isUnlimitedQuota } from '@/shared/lib/format';
import { getAccessToken } from '@/shared/lib/token';

/**
 * Reja nomini YAGONA ko'rinishga keltiradi.
 *
 * KERAK, chunki manbalar boshqa-boshqa yozadi. Jonli ko'rilganlari:
 *   `GET /billing/plans`        -> "Free Trial"
 *   `GET /billing/subscription` -> "free_trial", "Trial ride", "trial_ride"
 *
 * 🔴 To'RTTA yozilish (oxirgisi 2026-08-13 da jonli ko'rildi). Ilgari faqat
 * "freetrial" tanilardi va `trial_ride` NOMA'LUM tarif bo'lib qolardi:
 * tarif kartochkasi topilmasdi, ya'ni haydovchi o'z tarifini ko'rmasdi.
 * Endi qoida oddiy: "trial" bilan boshlangan hamma nom — sinov tarifi.
 * (Mobil ilovadagi `normalizePlanName` ham ayni shunday.)
 *
 * Backenddan mashina o'qiydigan `plan_key` so'ralgan; kelsa bu normallashtirish
 * keraksiz bo'ladi.
 */
export const normalizePlanName = (raw: unknown): string => {
  const n = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  return n.startsWith('trial') || n === 'freetrial' ? 'trial' : n;
};

/**
 * «Premium filtrlar» — konditsioner, chekilmaydi, orqada maks 2, haydash
 * uslubi. Shu tarifda ishlatsa bo'ladimi?
 *
 * Bu ko'rinish bezagi EMAS: backend `POST /rides/{id}/activate` da tekshiradi.
 * Bloklamasak haydovchi butun formani to'ldirib, e'lon qilish paytida 400 oladi.
 *
 * ✅ 2026-08-13 backend xati JAVOB BERDI: filtrlar FAQAT `pro` va `premium`
 * da ochiq; `trial` da ham, obunasiz ham o'tkazilmaydi. Shuning uchun qoida
 * endi RUXSAT RO'YXATI. Ilgari «`plus` dan boshqa hammasi ochiq» deb
 * hisoblanardi va sinov tarifidagi haydovchi belgilarni yoqib, e'lon qilishda
 * tushunarsiz xato olardi.
 *
 * Mobil ilovada ayni qoida: `Subscription.hasPremiumFilters`.
 */
const PLANS_WITH_PREMIUM_FILTERS = new Set(['pro', 'premium']);

export const planHasPremiumFilters = (rawPlanName: unknown): boolean =>
  PLANS_WITH_PREMIUM_FILTERS.has(normalizePlanName(rawPlanName));

/** Obunadan tarif kaliti: `plan_key` ustun, bo'lmasa nomdan. */
export const planKeyOf = (subscription: Subscription | null | undefined): string =>
  normalizePlanName(subscription?.plan_key || subscription?.plan_name);

/**
 * Obuna HAQIQATAN amal qiladimi.
 *
 * 🔴 2026-08-13, backend xati: ilgari muddati o'tgan obunaga `GET
 * /billing/subscription` 404 qaytarardi va biz uni "obuna yo'q" deb o'qirdik.
 * Endi backend obunani QAYTARADI, faqat `status` ni `expired` qilib qo'yadi.
 * Statusga qaramasak, muddati tugagan Pro tirik Pro'dek ko'rinadi va uning
 * premium belgilari ochiq qolardi.
 */
export const isSubscriptionUsable = (subscription: Subscription | null): boolean => {
  if (!subscription) return false;
  if (subscription.status === 'expired') return false;

  // 🔴 Statusga YOLG'IZ tayanib bo'lmaydi: jonli o'lchovda muddati o'tgan
  // obuna hamon `status: "active"` bilan kelgan (backend xati, 17-band).
  // Shu sabab sanani ham tekshiramiz — mobil ilovadagi `Subscription.isExpired`
  // bilan bir xil qoida. Sana kelmasa yoki tushunarsiz bo'lsa — statusga
  // ishonamiz (obunani bekorga o'chirib qo'ymaslik uchun).
  const end = subscription.end_date ? Date.parse(subscription.end_date) : NaN;
  if (!Number.isNaN(end) && end < Date.now()) return false;

  return true;
};

/**
 * Joriy obuna. 404 = "obuna yo'q" (billing.ts izohiga qarang) — bu XATO EMAS,
 * shuning uchun null'ga aylantiriladi va React Query qayta urinmaydi.
 * Yo'lovchida obuna umuman bo'lmasligi mumkin (Subscription tipida driver_id bor —
 * backendga savol yuborilgan, BACKEND_XAT_UI_TALABLAR_2026-07-30.md §5b).
 */
export const useSubscription = () =>
  useQuery<Subscription | null>({
    queryKey: ['billing-subscription'],
    // Mehmonda so'ralmaydi (401) — sabab `usePlans.ts` izohida.
    enabled: !!getAccessToken(),
    staleTime: 60 * 1000,
    retry: false,
    // ⚠️ Bu yerda `try/catch` bilan `null` QAYTARMANG. Ilgari shunday edi va
    // uzilish "obuna yo'q" ga aylanib qolardi (CurrentPlan.isError izohiga qara).
    queryFn: getSubscription,
  });

/** Tariflar sahifasi qaysi ko'rinishda chizilishi (CEO talabi 2026-07-30). */
export type PlanMode =
  /** Sinov tarifi yoki obuna yo'q -> BARCHA tariflar ko'rsatiladi. */
  | 'trial'
  /** O'rta tarif -> joriy tarif + limitni oshirish taklifi. */
  | 'upgrade'
  /** Eng qimmat tarif -> faqat balans va tarif, sotishga taklif yo'q. */
  | 'top';

export interface CurrentPlan {
  subscription: Subscription | null;
  /** Obunadagi rejaning `GET /billing/plans` dagi to'liq yozuvi (nom, narx, kvota). */
  plan: PlanQuota | null;
  mode: PlanMode;
  /** `mode === 'upgrade'` bo'lganda — keyingi qimmatroq reja (upsell uchun). */
  nextPlan: PlanQuota | null;
  /** Sotib olish mumkin bo'lgan rejalar, narx bo'yicha o'sish tartibida. */
  paidPlans: PlanQuota[];
  /** Tarif amal qilish muddati (ISO) — backend bermasa null. */
  endDate: string | null;
  ridesLeft: number | null;
  /**
   * Tarifning O'ZI cheksizmi (kvota bo'yicha). Balans raqamiga BOG'LIQ EMAS —
   * `rides_left: -1` cheklangan tarifda "cheksiz" degani emas (format.ts izohi).
   */
  isUnlimited: boolean;
  isLoading: boolean;
  /**
   * Obuna so'rovi YIQILDI (uzilish), "obuna yo'q" degani EMAS.
   *
   * Farqi hayotiy: xato yutilganda `subscription = null` bo'lardi va `mode`
   * avtomatik `trial` ga tushardi — ya'ni pullik tarifdagi haydovchiga
   * "tarifingiz yo'q, sotib oling" deb ko'rsatilardi va u ikkinchi marta
   * to'lab yuborishi mumkin edi. Sotuv ekranlari buni ALOHIDA ishlashi shart.
   */
  isError: boolean;
  /** Xatodan keyin qayta urinish (sotuv ekranlaridagi tugma uchun). */
  refetch: () => void;
  /**
   * Obuna bor, lekin MUDDATI TUGAGAN.
   *
   * "Obuna yo'q" dan farq qiladi: bu odam ilgari to'lagan, ya'ni unga
   * "yangilang" deyish kerak, "tanishib chiqing" emas.
   */
  isExpired: boolean;
}

/**
 * Tariflar/profil ekranlari uchun yagona manba: joriy obuna + reja setkasi
 * birlashtirilib, qaysi ko'rinish kerakligi hisoblanadi.
 */
export const useCurrentPlan = (): CurrentPlan => {
  const {
    data: subscription = null,
    isLoading: subLoading,
    isError: subFailed,
    refetch: refetchSub,
  } = useSubscription();
  const { data: planRows = [], isLoading: plansLoading } = usePlanQuotas();

  // Narx bo'yicha o'sish tartibi — "eng qimmat" va "keyingi" shundan aniqlanadi
  // (tartib backend javobiga TAYANMAYDI).
  const paidPlans = planRows
    .filter((p) => normalizePlanName(p.type) !== 'trial')
    .slice()
    .sort((a, b) => a.price - b.price);

  // `plan_key` kelsa O'SHA ishlatiladi (backend xati 2026-08-14), aks holda
  // nomdan hisoblanadi. Normallashtirish saqlanadi: eski javoblar va
  // qidiruv keshida hamon eski shakl bo'lishi mumkin.
  const currentType = normalizePlanName(subscription?.plan_key || subscription?.plan_name);
  const plan = planRows.find((p) => normalizePlanName(p.type) === currentType) ?? null;

  /*
   * 🔴 MUDDATI TUGAGAN TARIF SOTIB OLISHNI TO'SIB QO'YARDI (2026-08-16).
   *
   * `mode` xom obunadan hisoblanardi, ya'ni muddati o'tgan Premium ham
   * `top` bo'lib qolardi. Tariflar sahifasi esa `top` rejimida setkani
   * UMUMAN chizmaydi ("eng qimmat tarifdagi odamga sotadigan narsa yo'q").
   *
   * Natija: obunasi tugagan haydovchi "Muddati tugagan" yozuvini ko'radi-yu,
   * yangilash uchun HECH QANDAY tugma topolmaydi. Ya'ni to'lamoqchi bo'lgan
   * odam to'lay olmaydi. `upgrade` rejimida ham xuddi shu: tugagan Plus
   * egasiga faqat Plus'dan qimmatroqlari ko'rinardi, o'zini qayta sotib
   * olish mumkin emas edi.
   *
   * Endi muddati o'tgan obuna REJIM uchun "tarif yo'q" deb hisoblanadi va
   * butun setka ochiladi. Obunaning O'ZI qaytarilaveradi — kartochka
   * "Muddati tugagan" deb ko'rsatishi uchun kerak.
   *
   * Mobil ilovada ayni qoida `Subscription.isExpired` da.
   */
  const usable = isSubscriptionUsable(subscription);

  const currentIndex = usable
    ? paidPlans.findIndex((p) => normalizePlanName(p.type) === currentType)
    : -1;
  const hasPaidPlan = currentIndex >= 0;
  const isTop = hasPaidPlan && currentIndex === paidPlans.length - 1;

  const mode: PlanMode = !hasPaidPlan ? 'trial' : isTop ? 'top' : 'upgrade';

  return {
    subscription,
    plan,
    mode,
    nextPlan: mode === 'upgrade' ? (paidPlans[currentIndex + 1] ?? null) : null,
    paidPlans,
    endDate: subscription?.end_date ?? null,
    ridesLeft: subscription?.rides_left ?? null,
    // Muddati tugagan tarifda "Cheksiz" ko'rsatish yolg'on bo'lardi.
    isUnlimited: usable && plan ? isUnlimitedQuota(plan.quota) : false,
    isLoading: subLoading || plansLoading,
    isError: subFailed,
    refetch: () => void refetchSub(),
    isExpired: !!subscription && !usable,
  };
};
