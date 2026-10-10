// Swagger: billing_domain.Subscription / billing_domain.PaymentToken /
// http.SubscribeDriverRequest / http.AddPaymentMethodRequest (2026-07-18 dump).

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired' | (string & {});

export interface Subscription {
  id: string;
  /**
   * Swagger 2026-07-31: maydon endi `user_id` (ilgari `driver_id` edi) — ya'ni
   * obuna ROLGA emas, foydalanuvchiga bog'langan va yo'lovchida ham ishlaydi
   * (xat №3 §5b savoliga javob). Eski nom orqaga moslik uchun qoldirildi.
   */
  user_id?: string;
  driver_id?: string;
  /** lowercase: free_trial/plus/pro/premium — UPPERCASE backend'da 'invalid plan name' */
  plan_name: string;
  status: SubscriptionStatus;
  rides_left?: number;
  free_parcels_quota?: number;
  has_used_trial?: boolean;
  start_date?: string;
  end_date?: string;
  /**
   * Mashina kaliti — backend xati (2026-08-14) bo'yicha qo'shiladi:
   * "trial" | "plus" | "pro" | "premium". Kelmasa `plan_name` dan
   * hisoblanadi (`normalizePlanName`).
   */
  plan_key?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * GET /billing/plans elementi — JONLI shakl (2026-07-18): {plans:[{plan_name:"Free Trial"|
 * "Plus"|"Pro"|"Premium", price (UZS), rides_quota (-1 = cheksiz), free_parcels_quota,
 * currency, features[]}]}. Narxlar FAQAT shu endpointdan (hardcode taqiqlangan).
 */
export interface BillingPlan {
  plan_name: string;
  price: number;
  /** -1 = cheksiz */
  rides_quota: number;
  free_parcels_quota?: number;
  currency?: string;
  features?: string[];
  /**
   * `driver` | `passenger` — backend 03.09.2026 da qo'shdi.
   *
   * Biz FAQAT haydovchi tariflarini ko'rsatamiz: yo'lovchi bizning
   * modelimizda pul to'lamaydi (izohi `usePlans.ts` da).
   */
  target_role?: string;
}

/** POST /billing/pay */
export interface PayRequest {
  /** MAJBURIY lowercase (plus/pro/premium) */
  plan_name: string;
  payment_token_id?: string;
  promo_code?: string;
  /**
   * Click to'lovdan keyin odamni QAYERGA qaytarsin (14.09.2026).
   *
   * 🔴 NEGA KERAK: ilgari backendda mobil diplink
   * (`uz.yolyolakay.mobile://payment/success`) QOTIRIB qo'yilgan edi —
   * saytdan to'lagan odam brauzerda ochib bo'lmaydigan manzilga
   * tushardi. Endi har mijoz o'z manzilini yuboradi.
   */
  return_url?: string;
}

/** Jonli (2026-07-18): {message:"payment initiated", payment_url:"https://mock.click.uz/..."} */
export interface PayResponse extends Partial<Subscription> {
  checkout_url?: string;
  payment_url?: string;
  message?: string;
  /**
   * To'lov identifikatori (14.09.2026) — `GET /billing/transactions/{id}`
   * bilan AYNAN shu to'lov holatini bilish uchun. Ilgari yagona yo'l
   * butun obunani qayta-qayta so'rash edi, ya'ni "o'zgardimi" degan
   * KO'R-KO'RONA taxmin.
   */
  transaction_id?: string;
}

/** `GET /billing/transactions/{id}` javobi (14.09.2026). */
export interface Transaction {
  transaction_id?: string;
  /** `pending` | `success` | `failed` | `cancelled` */
  status?: string;
  amount?: number;
  currency?: string;
  plan?: string;
  created_at?: string;
}

export interface PaymentToken {
  id: string;
  user_id?: string;
  masked_pan: string;
  provider: string;
  token?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

/** POST /billing/cards */
export interface AddPaymentMethodRequest {
  masked_pan: string;
  provider: string;
  token: string;
}
