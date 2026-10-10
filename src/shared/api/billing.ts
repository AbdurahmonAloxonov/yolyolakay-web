import { api, unwrap } from './client';
import type {
  AddPaymentMethodRequest,
  BillingPlan,
  PayRequest,
  PayResponse,
  PaymentToken,
  Subscription,
  Transaction,
} from './types/billing';

/**
 * Billing — tariflar/obuna. Eski /billing/subscribe, /billing/trial, /billing/promo YO'Q:
 * hammasi POST /billing/pay ichida (promo_code shu so'rovda). Narxlar FAQAT GET /billing/plans'dan.
 */

export async function getPlans(): Promise<BillingPlan[]> {
  // `skipErrorToast` — bu so'rov PROFIL/dashboard'da ham fonda ketadi (CurrentPlanCard).
  // Global toast u yerlarda kontekstsiz "Xatolik" chiqarardi; endi xatoni tariflar
  // sahifasining O'ZI ko'rsatadi (qayta urinish tugmasi bilan).
  const res = await api.get('/billing/plans', { skipErrorToast: true });
  const body = unwrap<BillingPlan[] | { plans: BillingPlan[] | null }>(res);
  if (Array.isArray(body)) return body;
  return body?.plans ?? [];
}

/** 404/bo'sh — obuna yo'q holati sifatida chaqiruvchida ishlanadi. */
/**
 * Joriy obuna. Obuna YO'Q bo'lsa `null` — bu XATO EMAS.
 *
 * Backend xati (2026-08-14): ilgari obunasi yo'q foydalanuvchiga **404**
 * qaytarilardi va React Query uni xato deb hisoblardi — yangi odam
 * tariflar sahifasida "Joriy tarifingizni aniqlab bo'lmadi" degan qizil
 * blokni ko'rardi. Endi backend **200 + null** qaytaradi.
 *
 * 404 ni ham qabul qilamiz: eski javob keshda yoki eski gateway'da
 * qolishi mumkin. Qolgan xatolar (502, 401) esa YUTILMAYDI — uzilish
 * "sizda tarif yo'q" bo'lib ko'rinsa, odam ikkinchi marta to'lab
 * yuborishi mumkin.
 */
export async function getSubscription(): Promise<Subscription | null> {
  try {
    const res = await api.get('/billing/subscription', { skipErrorToast: true });
    return unwrap<Subscription | null>(res) ?? null;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw error;
  }
}

/** plan_name MAJBURIY lowercase (plus/pro/premium) — UPPERCASE 'invalid plan name'. */
export async function pay(body: PayRequest): Promise<PayResponse> {
  const res = await api.post('/billing/pay', { ...body, plan_name: body.plan_name.toLowerCase() });
  return unwrap<PayResponse>(res);
}

/**
 * BITTA to'lov holati — `GET /billing/transactions/{id}` (14.09.2026).
 *
 * ⚠️ Noma'lum id'da backend 500 «no rows in result set» qaytaradi (404
 * emas, o'lchandi) — shuning uchun xato YUTILADI va `null` qaytadi.
 * Chaqiruvchi bunda eski yo'lga (obunani qayta o'qish) tushadi, ekranda
 * esa qizil xato ko'rinmaydi.
 */
export async function getTransaction(id: string): Promise<Transaction | null> {
  try {
    const res = await api.get(`/billing/transactions/${id}`, { skipErrorToast: true });
    return unwrap<Transaction>(res) ?? null;
  } catch {
    return null;
  }
}

export async function getCards(): Promise<PaymentToken[]> {
  // Fon-o'qish (karta ro'yxati) — xatoda bo'sh ko'rinadi, global toast kerak emas.
  const res = await api.get('/billing/cards', { skipErrorToast: true });
  const body = unwrap<PaymentToken[] | { cards: PaymentToken[] | null }>(res);
  if (Array.isArray(body)) return body;
  return body?.cards ?? [];
}

export async function addCard(body: AddPaymentMethodRequest): Promise<PaymentToken> {
  const res = await api.post('/billing/cards', body);
  return unwrap<PaymentToken>(res);
}
