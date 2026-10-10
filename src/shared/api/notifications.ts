import { api, unwrap } from './client';
import type {
  ChatMessage,
  ChatSummary,
  NotificationItem,
  RegisterFcmTokenRequest,
} from './types/notification';

/**
 * Notifications + chat (bitta notification servisda):
 *   GET /notifications          -> TIZIM bildirishnomalari
 *   GET /notifications/history  -> CHAT tarixi (user juftligi bo'yicha)
 * Xabar YUBORISH faqat WS orqali (REST yo'q) — shared/api/ws.ts.
 * Chat FAQAT confirmed (accepted) bron uchun ochiladi — UI qoidasi.
 */

export async function getNotifications(): Promise<NotificationItem[]> {
  const res = await api.get('/notifications', { skipErrorToast: true });
  const body = unwrap<NotificationItem[] | { notifications: NotificationItem[] | null }>(res);
  if (Array.isArray(body)) return body;
  return body?.notifications ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.put(`/notifications/${id}/read`);
}

/**
 * Bitta suhbat tarixi.
 *
 * ✅ 2026-08-28 dan `GET /chats/{peer_id}/messages` — backend shu kuni
 * uni swaggerga rasman qo'shdi (kontrakt 102 → 104, faqat qo'shilish).
 *
 * 🔴 NEGA KO'CHDIK: eskisi (`/notifications/history`) IKKI id so'rardi
 * va PARAMETR TARTIBIGA sezgir edi — bitta suhbat uchun 4 / 3 / 0 ta
 * natija qaytarardi (o'lchandi 2026-08-28). Backend simmetriyani
 * tuzatdi, lekin yangi manzil bu tuzoqni butunlay yo'q qiladi: unda
 * bitta id bor va adashadigan joy qolmaydi.
 *
 * O'lchandi — ikkalasi AYNAN bir xil: soni, TARTIBI, yetti maydoni,
 * va ikkala taraf (haydovchi ham, yo'lovchi ham) uchun.
 *
 * ⚠️ Eskisi backendda TIRIK qoldi va do'kondagi eski ilovalar hamon
 * o'shani ishlatadi — ular buzilmaydi.
 */
export async function getChatHistory(peerId: string): Promise<ChatMessage[]> {
  const res = await api.get(`/chats/${encodeURIComponent(peerId)}/messages`, {
    skipErrorToast: true,
  });
  const body = unwrap<ChatMessage[] | { messages: ChatMessage[] | null }>(res);
  if (Array.isArray(body)) return body;
  return body?.messages ?? [];
}

/**
 * Suhbatlar ro'yxati — oxirgi xabar va o'qilmaganlar soni bilan.
 *
 * ✅ Backend 2026-08-16 da qo'shdi (`GET /notifications/chats`). Ilgari
 * ro'yxatdagi HAR suhbat uchun oxirgi xabar alohida so'rov bilan
 * olinardi (yoki umuman ko'rsatilmasdi).
 *
 * ⚠️ Javobda ism va avatar YO'Q (faqat `partner_id`), shuning uchun bu
 * suhbatlar ro'yxatini ALMASHTIRMAYDI — ustiga qo'yiladi.
 *
 * Xato YUTILADI: bu ma'lumot bezak. Uzilishda odam "suhbat yo'q" emas,
 * shunchaki oxirgi xabarsiz ro'yxat ko'radi.
 */
export async function getChatSummaries(): Promise<ChatSummary[]> {
  try {
    const res = await api.get('/notifications/chats', { skipErrorToast: true });
    const body = unwrap<ChatSummary[] | { chats: ChatSummary[] | null }>(res);
    if (Array.isArray(body)) return body;
    return body?.chats ?? [];
  } catch {
    return [];
  }
}

/** FCM token ro'yxatga olish (o'chirish endpointi YO'Q — token eskirsa backend o'zi tozalaydi). */
export async function registerFcmToken(body: RegisterFcmTokenRequest): Promise<void> {
  await api.post('/notifications/tokens', body);
}
