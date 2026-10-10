/**
 * ISHONCH NARVONI — «bu odamga ishonsam bo'ladimi?» degan savolga BITTA
 * javob.
 *
 * 🔴 NEGA KERAK: ishonch dalillari sahifaga TARQOQ sochilgan — reyting
 * bir joyda, baholar soni boshqa joyda, hisob yoshi uchinchi qatorda.
 * Odam ularni o'zi yig'ib xulosa chiqarishi kerak edi va amalda hech kim
 * buni qilmaydi: u faqat reytingga qaraydi, reyting esa BITTA baho bilan
 * ham «5.0» bo'lib turadi.
 *
 * ⚠️ Ilovada 2026-08-25 dan beri bor, saytda YO'Q edi. Mantiq AYNAN bir
 * xil bo'lishi shart: `lib/core/trust.dart`. Chegaralarni birida
 * o'zgartirsang — ikkinchisida ham, aks holda bir xil odam ikki mijozda
 * turlicha «ishonchli» bo'lib chiqadi.
 *
 * ═══ IKKI QAT'IY QOIDA ═══
 *
 *  1. **Ma'lumot yo'qligi — QIZIL BELGI EMAS.** Backend `created_at` yoki
 *     `rating_count` yubormasa, o'sha bosqich UMUMAN ko'rsatilmaydi. Uni
 *     «bajarilmagan» deb chizish odamni asossiz ayblash bo'lardi — va bu
 *     bizning ma'lumotimiz yo'qligidan, uning aybidan emas.
 *
 *  2. **Reyting YOLG'IZ ishonch bermaydi.** Bitta besh ballik baho ham
 *     «5.0» bo'lib ko'rinadi, shuning uchun reyting bosqichi faqat
 *     yetarlicha baho bo'lgandagina hisobga olinadi.
 */

export type TrustStep = 'phone' | 'tenure' | 'reviews' | 'rating' | 'car';

/** Hisob shuncha kundan eski bo'lsa — «yangi hisob» emas.
 *  30 kun ATAYIN: firibgar hisob tez ochilib tez tashlanadi. */
const TENURE_DAYS = 30;
/** Reyting ishonchli bo'lishi uchun kerakli eng kam baho soni. */
const RATING_NEEDS_REVIEWS = 3;
/** «Yetarlicha odam baho bergan» chegarasi. */
const REVIEWS_ENOUGH = 5;
/** Yuqori reyting chegarasi. */
const GOOD_RATING = 4.5;

export interface TrustSummary {
  done: Set<TrustStep>;
  /** EKRANDA ko'rsatiladigan bosqichlar (ma'lumoti bor bo'lganlari). */
  shown: TrustStep[];
  earned: number;
  total: number;
}

export function computeTrust(user: {
  created_at?: string;
  rating?: number;
  rating_count?: number;
  role?: string;
}): TrustSummary {
  // Telefon HAR DOIM bajarilgan: hisob faqat SMS kodidan keyin
  // yaratiladi, ya'ni tasdiqlanmagan telefonli foydalanuvchi yo'q.
  const shown: TrustStep[] = ['phone'];
  const done = new Set<TrustStep>(['phone']);

  if (user.created_at) {
    const ms = Date.parse(user.created_at);
    if (Number.isFinite(ms)) {
      shown.push('tenure');
      const days = (Date.now() - ms) / 86_400_000;
      if (days >= TENURE_DAYS) done.add('tenure');
    }
  }

  const count = user.rating_count;
  if (typeof count === 'number') {
    shown.push('reviews');
    if (count >= REVIEWS_ENOUGH) done.add('reviews');
  }

  const rating = user.rating;
  // Reyting bosqichi FAQAT baho soni ma'lum va yetarli bo'lganda ko'rinadi.
  if (typeof rating === 'number' && rating > 0 && (count ?? 0) >= RATING_NEEDS_REVIEWS) {
    shown.push('rating');
    if (rating >= GOOD_RATING) done.add('rating');
  }

  // ⚠️ Mashina bosqichi saytda KO'RSATILMAYDI: `GET /users/{id}`
  // mashinalarni qaytarmaydi va «tasdiqlanmagan» deb yozish yolg'on
  // bo'lardi — biz shunchaki bilmaymiz (ilovada ham xuddi shu qoida).

  return {
    done,
    shown,
    earned: shown.filter((s) => done.has(s)).length,
    total: shown.length,
  };
}

/**
 * Hujjat tekshiruvi O'TGANmi (`kyc_status`).
 *
 * 🔑 Backend uch xil qiymat qaytaradi (`approved` / `verified` /
 * `accepted`) — bittasiga tayanib bo'lmaydi. Ro'yxat BITTA joyda:
 * ilgari u `PassengerTrust` ichida qotirilgan edi va ikkinchi joyda
 * kerak bo'lganda nusxa ko'chirilardi.
 */
const APPROVED_KYC = new Set(['approved', 'verified', 'accepted']);

export function isKycApproved(status?: string | null): boolean {
  return APPROVED_KYC.has(
    String(status ?? '')
      .trim()
      .toLowerCase()
  );
}
