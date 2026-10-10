/**
 * Qurilma identifikatsiyasi — verify-otp/login'da gateway `X-Device-ID` + `X-OS-Type`
 * headerlarini kutadi (Swagger: body'da device_fingerprint YO'Q). ID har qurilma uchun
 * bir marta yaratilib localStorage'da barqaror saqlanadi; sessiyalar ro'yxati
 * (GET /auth/sessions) va sessiyani yopish (DELETE /auth/sessions/{device_id}) ham shu ID bilan.
 */
const DEVICE_ID_KEY = 'device_id';
// Eski kalit — avvalgi versiyada shu nom bilan saqlangan, qiymatini ko'chirib olamiz
// (aks holda mavjud foydalanuvchilarning sessiyasi boshqa qurilma sifatida ochilardi).
const LEGACY_KEY = 'device_fingerprint';

export const OS_TYPE = 'web';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_ID_KEY) || localStorage.getItem(LEGACY_KEY);
  if (!id) id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  // Cookie'ga NUSXA: `/api/myid/start` ga brauzer NAVIGATSIYA bilan boradi (redirect),
  // ya'ni u yerga header yuborib bo'lmaydi va server route localStorage'ni ko'rmaydi.
  // Nusxasiz o'sha route backendga qurilmasiz chiqardi — MyID oqimi har safar
  // "yangi qurilma" bo'lib ko'rinardi. HttpOnly EMAS: qiymatni JS o'zi yozadi,
  // va bu sir emas — shunchaki qurilma yorlig'i.
  document.cookie = `${DEVICE_ID_KEY}=${id}; path=/; max-age=31536000; samesite=lax${
    location.protocol === 'https:' ? '; secure' : ''
  }`;
  return id;
}

/** Backendga ketadigan qurilma headerlari (client.ts interceptor'i shuni qo'yadi). */
export function deviceHeaders(): Record<string, string> {
  return { 'X-Device-ID': getDeviceId(), 'X-OS-Type': OS_TYPE };
}

/**
 * SERVER tomoni uchun: kelayotgan so'rovdan qurilma headerlarini tiklash.
 *
 * Next route handler'lari (`/api/myid/*`) backendga o'zi chiqadi va u yerda
 * `localStorage` yo'q. Qiymat ikki manbadan olinadi: brauzer `fetch` bilan
 * kelsa — headerdan; navigatsiya (redirect) bilan kelsa — cookie'dan.
 * Ikkalasi ham bo'lmasa BO'SH obyekt: bo'sh `X-Device-ID` yuborish backendni
 * chalg'itadi (bu "qurilma noma'lum" degani, "qurilma yo'q" degani emas).
 */
export function deviceHeadersFromRequest(request: {
  headers: { get(name: string): string | null };
  cookies: { get(name: string): { value: string } | undefined };
}): Record<string, string> {
  const id = request.headers.get('x-device-id') || request.cookies.get(DEVICE_ID_KEY)?.value || '';
  if (!id) return {};
  return { 'X-Device-ID': id, 'X-OS-Type': request.headers.get('x-os-type') || OS_TYPE };
}
