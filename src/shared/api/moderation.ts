import { api, unwrap } from './client';

/**
 * Moderatsiya: shikoyat va bloklash.
 *
 * 🔴 GOOGLE PLAY TALABI, funksiya emas. Foydalanuvchilar bir-biri bilan chat
 * qiladigan ilovada shikoyat va bloklash bo'lishi SHART (User Generated Content
 * siyosati) — busiz reliz rad etiladi yoki chiqqandan keyin o'chiriladi.
 * SOS tugmasi bu talabni QOPLAMAYDI: u favqulodda yordam uchun.
 *
 * ✅ 2026-07-31 (kech): gateway qayta deploy qilindi, Swagger endi JONLI va
 * ROST manba (71 yo'l, md5 o'zgardi). Yo'llar shu hujjatdan olingan —
 * backendning ikki zid hisobotidan EMAS. Ilgari qo'yilgan ikki-yo'lli
 * fallback OLIB TASHLANDI: taxmin qilishning hojati qolmadi.
 *   POST   /users/{id}/report   (tanada: reason, ixtiyoriy izoh)
 *   POST   /users/{id}/block
 *   DELETE /users/blocked/{id}
 *   GET    /users/blocked       → STRING massivi (faqat ID'lar!)
 */

/** "Endpoint hali yo'q" ni haqiqiy xatodan farqlash uchun (UI boshqacha xabar beradi). */
export const isNotAvailable = (e: unknown): boolean => {
  const s = (e as { response?: { status?: number } })?.response?.status;
  return s === 404 || s === 405 || s === 501;
};

/** Shikoyat sababi — backendga string sifatida ketadi. */
export type ReportReason = 'spam' | 'harassment' | 'fraud' | 'unsafe' | 'other';

export interface CreateReportRequest {
  target_user_id: string;
  ride_id?: string;
  reason: ReportReason;
  comment?: string;
}

// skipErrorToast: bu amallarning HAMMASINI chaqiruvchi komponent o'zi izohlaydi
// (endpoint yo'qmi yoki haqiqiy xatomi) — global toast bilan ikki marta chiqmasin.

/** Kim haqida ekani YO'LDA, sabab tanada (swagger: body = ixtiyoriy obyekt, `reason` kutiladi). */
export async function reportUser(body: CreateReportRequest): Promise<void> {
  const { target_user_id, ...rest } = body;
  await api.post(`/users/${target_user_id}/report`, rest, { skipErrorToast: true });
}

export async function blockUser(userId: string): Promise<void> {
  await api.post(`/users/${userId}/block`, {}, { skipErrorToast: true });
}

export async function unblockUser(userId: string): Promise<void> {
  await api.delete(`/users/blocked/${userId}`, { skipErrorToast: true });
}

export interface BlockedUser {
  id: string;
  name?: string;
}

/** Ro'yxatda ismlarni to'ldirish uchun ochiladigan profil so'rovlari chegarasi. */
const BLOCKED_NAME_LOOKUP_LIMIT = 20;

/**
 * Bloklanganlar ro'yxati.
 *
 * Swagger (2026-07-31): `GET /users/blocked` → **STRING massivi**, ya'ni faqat
 * ID'lar, ismsiz. Ro'yxatda "Foydalanuvchi, Foydalanuvchi, Foydalanuvchi" turishi
 * foydasiz — kimni blokdan chiqarayotganini bilib bo'lmaydi. Shuning uchun har
 * ID uchun `GET /users/{id}` bilan ism olib kelinadi (parallel, xatosi yutiladi:
 * ism kelmasa ID bo'yicha ko'rsatiladi).
 *
 * Obyekt massivi kelib qolsa ham o'qiymiz — backend keyin boyitishi mumkin.
 */
export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const res = await api.get('/users/blocked', { skipErrorToast: true });
  const body = unwrap<unknown>(res);
  const list = Array.isArray(body)
    ? body
    : ((body as Record<string, unknown>)?.blocked ??
      (body as Record<string, unknown>)?.blocked_users ??
      (body as Record<string, unknown>)?.users ??
      []);
  if (!Array.isArray(list)) return [];

  const rows: BlockedUser[] = list
    .map((raw) => {
      // Jonli shakl — oddiy string (ID).
      if (typeof raw === 'string') return { id: raw };
      const r = raw as Record<string, unknown>;
      const id = r.id ?? r.ID ?? r.user_id ?? r.UserID ?? r.blocked_user_id ?? r.BlockedUserID;
      const first = r.first_name ?? r.FirstName;
      const last = r.last_name ?? r.LastName;
      const name = (r.name as string) || [first, last].filter(Boolean).join(' ').trim();
      return { id: String(id ?? ''), name: name || undefined };
    })
    .filter((u) => !!u.id);

  const needName = rows.filter((u) => !u.name).slice(0, BLOCKED_NAME_LOOKUP_LIMIT);
  if (!needName.length) return rows;

  const named = new Map<string, string>();
  await Promise.allSettled(
    needName.map(async (u) => {
      const r = await api.get(`/users/${u.id}`, { skipErrorToast: true });
      const raw = unwrap<Record<string, unknown>>(r);
      const usr = (raw?.user as Record<string, unknown>) ?? raw;
      const name = [usr?.first_name, usr?.last_name].filter(Boolean).join(' ').trim();
      if (name) named.set(u.id, name);
    })
  );

  return rows.map((u) => (u.name ? u : { ...u, name: named.get(u.id) }));
}

/**
 * Hisobni o'chirish — Google Play 2024-dan MAJBURIY qilgan.
 * Ochiq sahifa allaqachon bor: /[locale]/account-delete.
 * ✅ 2026-07-31: backend "yumshoq o'chirish" qildi — profil o'chirilgan deb
 * belgilanadi va telefon raqami anonimlashtiriladi (`deleted_<id>_<phone>`),
 * shuning uchun o'sha raqam bilan qayta ro'yxatdan o'tish mumkin bo'ladi.
 */
export async function deleteAccount(): Promise<void> {
  await api.delete('/users/me', { skipErrorToast: true });
}
