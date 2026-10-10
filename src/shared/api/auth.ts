import { api, unwrap } from './client';
import type { OtpPurpose, Session, TokenResponse } from './types/auth';

// Eslatma: `X-Device-ID` / `X-OS-Type` bu yerda QO'LDA qo'yilmaydi — client.ts
// request interceptor'i ularni HAR so'rovga qo'shadi (send-otp ham shu qatorda).

/**
 * Auth — IKKI yo'l (2026-07-19 mahsulot qarori):
 *  1) OTP (asosiy): verify-otp yangi hisobni AVTOMATIK yaratadi (login+register bitta oqim);
 *  2) Parol (qo'shimcha): avval OTP bilan kirib setup-password qilgan foydalanuvchi
 *     keyin POST /auth/login {phone_number, password} bilan SMS'siz kiradi.
 * Rate-limit: send-otp 3/daqiqa -> 429 (client.ts global toast beradi).
 */

/**
 * OTP yuborish. `type` MAJBURIY — usiz backend 400 beradi
 * ("invalid request body or missing 'type'").
 *
 * `skipErrorToast`: 404 (raqam topilmadi) va 409 (raqam allaqachon bor) —
 * bu oqimning MA'NOLI holatlari, ularni chaqiruvchi o'z matni bilan ko'rsatadi.
 * Global "Noto'g'ri so'rov" toasti bu yerda faqat chalg'itadi.
 */
export async function sendOtp(phoneNumber: string, type: OtpPurpose): Promise<void> {
  await api.post('/auth/send-otp', { phone_number: phoneNumber, type }, { skipErrorToast: true });
}

/**
 * Parol bilan kirish — parol oldindan setup-password bilan o'rnatilgan bo'lishi kerak.
 *
 * YANGI QURILMA (backend 2026-08-09): parol TO'G'RI, lekin `X-Device-ID` foydalanuvchining
 * ochiq sessiyalari orasida bo'lmasa, backend O'ZI SMS yuboradi va
 * `403 {"error":"new_device"}` qaytaradi. Bu XATO EMAS — oqimning davomi, chaqiruvchi
 * `isNewDeviceError()` bilan tekshirib kod ekraniga o'tishi kerak.
 */
export async function loginWithPassword(
  phoneNumber: string,
  password: string
): Promise<TokenResponse> {
  const res = await api.post(
    '/auth/login',
    { phone_number: phoneNumber, password },
    { skipErrorToast: true }
  );
  return unwrap<TokenResponse>(res);
}

function errorBody(err: unknown): { code: string; text: string; status?: number } {
  const res = (err as { response?: { status?: number; data?: unknown } })?.response;
  const data = res?.data as { error?: unknown; message?: unknown } | undefined;
  const nested = (data as { data?: { error?: unknown; message?: unknown } } | undefined)?.data;
  const raw = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    status: res?.status,
    code: raw(data?.error ?? nested?.error)
      .trim()
      .toLowerCase(),
    text: `${raw(data?.error ?? nested?.error)} ${raw(data?.message ?? nested?.message)}`,
  };
}

/** SMS YUBORILMADI kodi — `new_device` bilan aralashib ketmasligi SHART (pastga qara). */
const SMS_FAILED_CODE = 'new_device_sms_failed';

/**
 * `/auth/login` javobi "yangi qurilma — SMS yuborildi" ma'nosini bildiradimi?
 *
 * DIQQAT: backend `error` maydonini IKKI xil ishlatadi — ba'zan mashina kodi
 * (`new_device`), ba'zan odamga mo'ljallangan matn (`invalid phone or password`).
 * Shuning uchun avval kodni ANIQ solishtiramiz.
 *
 * Zaxira sifatida matn ham tekshiriladi (swaggerda 403 erkin `map[string]string`).
 *
 * 🔴 `new_device_sms_failed` ANIQ ISTISNO QILINADI: u ham `new_device` bilan
 * boshlanadi, ya'ni matn bo'yicha zaxira tekshiruv uni XATO ravishda "kod
 * yuborildi" deb qabul qilardi va foydalanuvchi kelmaydigan kodni kutib
 * qolardi — aynan biz backenddan so'rab, oldini olmoqchi bo'lgan holat.
 *
 * Jonli tasdiqlangan (2026-08-09, test raqami): `403 {"error":"new_device"}`.
 */
export function isNewDeviceError(err: unknown): boolean {
  const { status, code, text } = errorBody(err);
  if (status !== 403) return false;
  if (code === SMS_FAILED_CODE || text.includes(SMS_FAILED_CODE)) return false;
  return code === 'new_device' || /new[\s_-]?device|новое устройство/i.test(text);
}

/**
 * Yangi qurilma aniqlandi, LEKIN SMS ketmadi (limit 3/daq yoki shlyuz yiqildi).
 *
 * Backend kontrakti (2026-08-09 javobi): `429` yoki `403` +
 * `error: "new_device_sms_failed"`. Bunda kod ekraniga o'tish YARAMAYDI — kod
 * yo'q, odam bo'sh ekranda kutib qoladi. To'g'ri xatti-harakat: ochiq aytish.
 */
export function isSmsNotSentError(err: unknown): boolean {
  const { status, code, text } = errorBody(err);
  if (status !== 403 && status !== 429) return false;
  return code === SMS_FAILED_CODE || text.includes(SMS_FAILED_CODE);
}

/**
 * `423 Locked` — hisob vaqtincha bloklangan (swaggerda hujjatlashtirilgan, lekin
 * backend xatida aytilmagan). Buni umumiy "Kirishda xatolik" bilan yopib qo'yish
 * eng yomon holat: odam parolini to'g'ri deb o'ylab qayta-qayta uradi va blokni
 * uzaytiradi.
 */
export function isAccountLockedError(err: unknown): boolean {
  return errorBody(err).status === 423;
}

/** Joriy (token bilan kirgan) foydalanuvchiga parol o'rnatish/almashtirish. */
export async function setupPassword(password: string): Promise<void> {
  await api.post('/auth/setup-password', { password }, { skipErrorToast: true });
}

export async function verifyOtp(phoneNumber: string, code: string): Promise<TokenResponse> {
  const res = await api.post('/auth/verify-otp', { phone_number: phoneNumber, code });
  return unwrap<TokenResponse>(res);
}

// Eslatma: refresh oqimi FAQAT client.ts interceptor'ida (toza axios bilan) —
// bu yerda alohida refresh() saqlanmaydi, ikki nusxa mantiq drift qilmasin.

export async function getSessions(): Promise<Session[]> {
  // Fon-o'qish (sessiyalar ro'yxati) — xatoda bo'sh ko'rinadi, global toast kerak emas.
  const res = await api.get('/auth/sessions', { skipErrorToast: true });
  return unwrap<Session[]>(res) ?? [];
}

/** Logout — shu qurilma sessiyasini yopish (eski /auth/logout YO'Q). Xato kritik emas. */
export async function deleteSession(deviceId: string): Promise<void> {
  await api.delete(`/auth/sessions/${deviceId}`, { skipErrorToast: true });
}
