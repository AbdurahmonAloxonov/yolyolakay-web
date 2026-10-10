import { api, unwrap } from './client';

/**
 * Qo'llab-quvvatlash — `POST /helpdesk/tickets`.
 *
 * Backend bu bo'limni ancha oldin qurgan, lekin bizga aytmagan: endpoint
 * swagger sverkasida topildi (2026-08-16). Tavsifi: «жалоба, ДТП,
 * забытые вещи».
 *
 * 🔴 MUHIM CHEKLOV: backendda operator JAVOBINI saqlaydigan maydon YO'Q.
 * Operator qila oladigan yagona amal — `POST /helpdesk/tickets/resolve`,
 * ya'ni murojaatni "hal qilindi" deb yopish. Shuning uchun UI javob ILOVA
 * ICHIDA kelishini VA'DA QILMAYDI — yuborgach javob Telegram orqali
 * kelishi ochiq aytiladi. Yolg'on va'da eng yomon variant bo'lardi: odam
 * kutib o'tiraveradi. (Backenddan javob maydoni so'raldi — xat 2026-08-16d.)
 *
 * `GET /helpdesk/tickets` HOZIRCHA ISHLATILMAYDI: javob shakli swaggerda
 * ochiq qoldirilgan (`additionalProperties: true`), ya'ni ro'yxatda
 * `status`/`created_at` bor-yo'qligi noma'lum. Shakl aniqlangach qo'shiladi.
 */
export async function createSupportTicket(body: {
  subject: string;
  description: string;
}): Promise<void> {
  await api.post('/helpdesk/tickets', body, { skipErrorToast: true });
}

/**
 * Qo'llab-quvvatlash murojaati — `GET /helpdesk/tickets`.
 *
 * ✅ 2026-08-16 kechqurun ULANDI: backend sxemani yozdi va `resolution`
 * (operator javobi) maydonini qo'shdi. Ungacha javob shakli noma'lum edi
 * va ro'yxatni ko'r-ko'rona chizish aniq xatoga olib borardi.
 *
 * ⚠️ `?user_id=` YUBORILMAYDI — backend uni olib tashladi, ro'yxat
 * tokendan aniqlanadi (birovning murojaatini o'qib bo'lmaydi).
 */
export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  /** Operator javobi. Bo'sh — hali javob berilmagan. */
  resolution?: string;
  created_at?: string;
}

export async function getSupportTickets(): Promise<SupportTicket[]> {
  const res = await api.get('/helpdesk/tickets', { skipErrorToast: true });
  const body = unwrap<SupportTicket[] | { tickets: SupportTicket[] | null }>(res);
  if (Array.isArray(body)) return body;
  return body?.tickets ?? [];
}

/**
 * Operator uchun texnik ma'lumot — murojaat matni oxiriga qo'shiladi.
 *
 * NEGA KERAK: hozir odam Telegramga yozganda operator "qaysi brauzer,
 * qanaqa qurilma?" deb so'rashi kerak va odatda javob ololmaydi. Sayt
 * buni o'zi biladi — so'ramaslik kerak.
 *
 * Shaxsiy ma'lumot qo'shilmaydi: faqat brauzer satri va sahifa manzili.
 */
export const supportTechnicalContext = (): string => {
  if (typeof window === 'undefined') return '';
  return [
    "--- texnik ma'lumot ---",
    `Sahifa: ${window.location.pathname}`,
    `Brauzer: ${navigator.userAgent}`,
  ].join('\n');
};
