/**
 * TAKLIF HAVOLASI — kim kimni olib kelganini O'LCHASH.
 *
 * 🔴 NEGA YOZILDI (08.09.2026): `InviteCard` odamga shunchaki
 * `yolyolakay.co.uz` havolasini berardi. Ya'ni foydalanuvchi ellikta
 * tanishini chaqirsa ham, buni HECH KIM bilmasdi: na o'lchay olardik,
 * na rahmat ayta olardik. Telegram guruhlariga reklama boshlanayotgan
 * paytda bu ayniqsa qimmatga tushadi — nima ishlaganini bilmay,
 * bilmagan holda pul va vaqt sarflaymiz.
 *
 * ═══ NEGA BACKENDSIZ ═══
 *
 * `POST /auth/register` ga `referral_code` qo'shib yuborish eng to'g'ri
 * yo'l bo'lardi, LEKIN backend ortiqcha maydonni qanday kutib olishini
 * O'LCHAY OLMADIK (`GET /auth/mock-otp/{phone}` endi 401 — sinov kodi
 * olib bo'lmaydi, ya'ni haqiqiy ro'yxatdan o'tishni sinab ko'rishning
 * iloji yo'q). Agar u 400 bersa, RO'YXATDAN O'TISH BUTUNLAY YIQILARDI —
 * bu esa taklif kodidan ming marta qimmat.
 *
 * Shuning uchun kod backendga YUBORILMAYDI. U analitikaga yoziladi
 * (`POST /analytics/events` yangi hodisa turini qabul qilishi
 * 08.09.2026 da jonli o'lchandi: 200). Backend maydon qo'shsa —
 * mukofot (bepul obuna kunlari) ham mumkin bo'ladi; so'raldi.
 *
 * ═══ MAXFIYLIK ═══
 *
 * Kod — foydalanuvchi id'sining birinchi 8 belgisi. Bu YANGI ma'lumot
 * emas: `driver.id` allaqachon ochiq safar javobida keladi. Ism,
 * telefon yoki boshqa shaxsiy narsa havolaga TUSHMAYDI.
 */

/** Havoladagi parametr: `?r=a1b2c3d4`. */
export const REFERRAL_PARAM = 'r';

const KEY = 'referral';

/**
 * Kod qancha yashaydi.
 *
 * 30 kun: odam havolani ko'radi, o'ylaydi, keyin qaytadi. Bir kunlik
 * oyna haqiqiy hayotni o'lchamaydi. Cheksiz saqlash esa teskari xato —
 * yarim yildan keyingi ro'yxatdan o'tishni o'sha havolaga yozib
 * qo'yish yolg'on bo'lardi.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Kod shakli — QAT'IY tekshiriladi.
 *
 * Havoladagi qiymat begona odam yozgan matn: u analitikaga, keyin esa
 * hisobotga tushadi. Shakl tekshirilmasa u yerga istalgan narsa
 * yozilishi mumkin edi.
 */
const CODE = /^[a-z0-9]{4,16}$/;

interface Stored {
  code: string;
  at: number;
}

/** Foydalanuvchi id'sidan taklif kodi: uuid'ning birinchi 8 belgisi. */
export function inviteCode(userId: string | null | undefined): string | null {
  const hex = (userId || '').replace(/-/g, '').toLowerCase();
  if (hex.length < 8) return null;
  const code = hex.slice(0, 8);
  return CODE.test(code) ? code : null;
}

/**
 * Ulashiladigan havola.
 *
 * Manzil — BOSH SAHIFA, safar sahifasi emas: taklif qilingan odam
 * avval nima ekanini ko'rishi kerak. Tili — chaqirayotgan odamning
 * tili: u tanishlari bilan o'sha tilda gaplashadi.
 */
export function inviteLink(userId: string | null | undefined, locale: string): string {
  const base = `https://yolyolakay.co.uz/${locale}`;
  const code = inviteCode(userId);
  return code ? `${base}?${REFERRAL_PARAM}=${code}` : base;
}

/**
 * Manzildagi kodni o'qib, saqlaydi va URL'dan OLIB TASHLAYDI.
 *
 * ⚠️ URL tozalanishi SHART: aks holda odam o'sha manzilni boshqa
 * odamga uzatganda BEGONA kod bilan uzatardi va hisobot buzilardi.
 *
 * ⚠️ Birinchi kod g'olib: odam ikkinchi havoladan kirsa ham, uni
 * ilk marta kim olib kelgani muhimroq.
 */
export function captureReferral(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const raw = (url.searchParams.get(REFERRAL_PARAM) || '').toLowerCase();
    if (!raw) return;

    url.searchParams.delete(REFERRAL_PARAM);
    window.history.replaceState(null, '', url.toString());

    if (!CODE.test(raw)) return;
    if (readReferral()) return;

    const value: Stored = { code: raw, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Xususiy rejim yoki bloklangan xotira — taklif hisobi yo'qoladi,
    // lekin sahifa ishlashda davom etadi. Bu almashuv ATAYIN.
  }
}

/** Saqlangan kod (muddati o'tmagan bo'lsa). */
export function readReferral(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored> | null;
    const code = typeof parsed?.code === 'string' ? parsed.code : '';
    const at = typeof parsed?.at === 'number' ? parsed.at : 0;
    if (!CODE.test(code) || !at || Date.now() - at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

/** Hisobga olingach o'chiriladi — bitta havola bitta ro'yxatdan o'tishga. */
export function clearReferral(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yuqoridagi izoh */
  }
}
