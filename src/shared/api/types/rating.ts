// Swagger: http.SubmitFeedbackRequest / rating_domain.Feedback (2026-07-18 dump).
// Endpoint BIRLIKDA: POST /rating. reviewer_id YUBORILMAYDI — tokendan olinadi.

export interface SubmitFeedbackRequest {
  ride_id: string;
  /** Baholanayotgan foydalanuvchi */
  reviewee_id: string;
  /** 1..5 */
  score: number;
  comment?: string;
}

export interface Feedback {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewee_id: string;
  score: number;
  comment?: string;
  created_at?: string;
}

/**
 * SHARH — `GET /rating` ro'yxatidan (`domain.FeedbackItem`).
 *
 * 🔴 NEGA ENDI BOR: 27-avgustgacha kontraktda faqat `POST /rating` bor
 * edi. Ya'ni biz safardan keyin izoh SO'RAYDIK, odam yozadi — va u gap
 * hech qayerda ko'rinmasdi. Backend so'rovimizdan keyin `GET` ni ochdi.
 *
 * ⚠️ `reviewer` — MUALLIF, baholanuvchi emas. `reviewee_id` bu yerda
 * YO'Q: kim haqidaligi so'rovning o'zidan ma'lum.
 */
export interface FeedbackItem {
  id: string;
  ride_id?: string;
  reviewer?: { id?: string; name?: string; avatar?: string };
  score: number;
  comment?: string;
  created_at?: string;
}

/** `GET /rating` javobi. `total`/`average` javobning O'ZIDA — profil
 *  uchun alohida so'rov kerak emas. */
export interface FeedbackList {
  items: FeedbackItem[] | null;
  total: number;
  average: number;
}
