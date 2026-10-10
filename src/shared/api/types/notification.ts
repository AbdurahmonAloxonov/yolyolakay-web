// Swagger: notification_domain.NotificationHistoryItem / notification_domain.Message /
// http.registerTokenRequest (2026-07-18 dump).
//
// DIQQAT nomlanish chalkash (Swagger shunday):
//   GET /notifications          -> TIZIM bildirishnomalari (NotificationItem)
//   GET /chats/{peer_id}/messages -> CHAT tarixi (ChatMessage)
//   (eskisi: GET /notifications/history?user_id_1&user_id_2 — hamon tirik)

export interface NotificationItem {
  id: string;
  user_id?: string;
  title: string;
  body: string;
  type?: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  ride_id?: string;
  content: string;
  status?: string;
  created_at: string;
  updated_at?: string;
}

/** POST /notifications/tokens (FCM) — DELETE endpointi YO'Q */
export interface RegisterFcmTokenRequest {
  fcm_token: string;
  language?: string;
  platform?: string;
}

/**
 * WS orqali xabar yuborish (REST endpointi yo'q).
 *
 * 🔴 Server `receiver_id` ni o'qiydi (backend logi, 2026-08-12). `recipient_id`
 * eski kalit — gateway'ning qaysi versiyasi turganini hujjat bilan tekshirib
 * bo'lmagani uchun (chat swaggerda YO'Q) ikkalasi ham yuboriladi.
 */
export interface WsSendMessage {
  event: 'send_message';
  data: {
    receiver_id: string;
    /** Eski kalit — moslik uchun `receiver_id` bilan birga ketadi. */
    recipient_id?: string;
    ride_id?: string;
    content: string;
  };
}

/**
 * `GET /notifications/chats` elementi (backend 2026-08-16).
 *
 * Ism va avatar bu javobda YO'Q — ular bronlardan keladi, shuning uchun
 * ro'yxat almashtirilmaydi, faqat boyitiladi.
 */
export interface ChatSummary {
  partner_id: string;
  unread_count?: number;
  last_message?: {
    id?: string;
    content?: string;
    created_at?: string;
    sender_id?: string;
    receiver_id?: string;
    ride_id?: string;
    status?: string;
  } | null;
}
