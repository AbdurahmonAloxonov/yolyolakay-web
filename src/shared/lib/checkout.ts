import { toast } from 'sonner';
import { pay } from '@/shared/api/billing';
import { trFor } from '@/shared/lib/i18n';

/** Backend /billing/pay javobi (envelope ochilgan holda ham, xomligicha ham). */
export interface SubscribeResponse {
  checkout_url?: string;
  message?: string;
  /** Bu AYNAN shu to'lovning id'si — qaytib kelganda holatini so'raymiz. */
  transaction_id?: string;
}

/**
 * To'lov id'sini Click'ga ketishdan OLDIN saqlaymiz.
 *
 * 🔑 NEGA `localStorage`: odam saytdan CHIQIB ketadi (my.click.uz) va
 * boshqa sahifaga qaytadi — React holati bu safarda omon qolmaydi.
 * Click id'ni qaytarib bersa o'shani ishlatamiz, bermasa shu yerdan.
 */
const TX_KEY = 'yol:last-payment-tx';

export function rememberTransaction(id: string | undefined): void {
  if (!id) return;
  try {
    localStorage.setItem(TX_KEY, id);
  } catch {
    // Maxfiy oyna / bloklangan xotira — to'lov baribir o'tadi, biz
    // shunchaki holatini aniq ayta olmaymiz (eski yo'lga tushamiz).
  }
}

export function recallTransaction(): string | null {
  try {
    return localStorage.getItem(TX_KEY);
  } catch {
    return null;
  }
}

export function forgetTransaction(): void {
  try {
    localStorage.removeItem(TX_KEY);
  } catch {
    /* yuqoridagi izoh */
  }
}

/**
 * Tarif sotib olish so'rovi — dashboard va ikkala tariffs sahifasi uchun YAGONA
 * implementatsiya. Yangi Gateway: `POST /billing/pay {plan_name, payment_token_id,
 * promo_code}` (plan_name lowercase — billing modul o'zi kichraytiradi). Rol yuborilmaydi —
 * tarif setkasi ikkala rol uchun bir xil; promokod ham SHU so'rov ichida.
 */
export async function subscribeTariff(
  planName: string,
  opts: { paymentTokenId?: string; promoCode?: string; locale?: string } = {}
): Promise<SubscribeResponse> {
  const res = await pay({
    plan_name: planName,
    ...(opts.paymentTokenId ? { payment_token_id: opts.paymentTokenId } : {}),
    ...(opts.promoCode ? { promo_code: opts.promoCode } : {}),
    // 🔴 `return_url` SHART (14.09.2026): backendda ilgari MOBIL diplink
    // qotirib qo'yilgan edi, ya'ni saytdan to'lagan odam brauzerda
    // ochib bo'lmaydigan manzilga tushardi. Manzilni o'zimiz aytamiz.
    ...(opts.locale && typeof window !== 'undefined'
      ? { return_url: `${window.location.origin}/${opts.locale}/payment` }
      : {}),
  });
  // Jonli (2026-07-18): gateway `payment_url` nomi bilan beradi (eski checkout_url ham zaxira).
  const out = {
    checkout_url: res.checkout_url ?? res.payment_url,
    message: res.message,
    transaction_id: res.transaction_id,
  };
  rememberTransaction(out.transaction_id);
  return out;
}

/**
 * Subscribe javobini bir xilda qayta ishlash (dashboard, tariflar sahifasi).
 *
 * MOCK TEKSHIRUVI OLIB TASHLANDI (2026-08-11). Ilgari backend to'lovni o'zi
 * "o'tkazib" yuborardi va mavjud bo'lmagan domenga (`mock.click.uz`) URL
 * qaytarardi — biz uni tanib, redirect qilmasdan "test rejimi" deb
 * ko'rsatardik, aks holda odam o'lik sahifada qolardi.
 *
 * Endi backend HAQIQIY Click manzilini qaytaradi. Jonli o'lchandi (2026-08-11):
 *   POST /billing/pay {"plan_name":"plus"}
 *   -> {"message":"payment initiated",
 *       "payment_url":"https://my.click.uz/services/pay?service_id=…&merchant_id=…"}
 *
 * ⚠️ Kalitlar hozir TEST rejimida (backend xati) — pul yechilmaydi, lekin oqim
 * haqiqiy: odam Click sahifasiga boradi. Ya'ni "test rejimi" yozuvini
 * ko'rsatish endi YOLG'ON bo'lardi.
 *
 * @returns true — to'lov sahifasiga redirect boshlandi.
 */
export function handleCheckout(res: SubscribeResponse, locale: string): boolean {
  const tr = trFor(locale);
  const url = res.checkout_url ?? '';
  if (url) {
    toast.success(
      tr(
        "To'lov sahifasiga yo'naltirilmoqda...",
        'Перенаправление на оплату...',
        'Redirecting to the payment page...'
      )
    );
    setTimeout(() => {
      window.location.href = url;
    }, 1000);
    return true;
  }
  toast.success(
    tr(
      'Tarif muvaffaqiyatli faollashtirildi!',
      'Тариф успешно куплен!',
      'Your plan has been activated!'
    )
  );
  return false;
}
