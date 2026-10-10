// Swagger: user_domain.User / user_domain.Car / http.RegisterPassengerRequest /
// http.UpdateProfileRequest / http.CreateCarRequest (2026-07-18 dump).

export type UserRole = 'passenger' | 'driver' | (string & {});
export type Gender = 'male' | 'female' | (string & {});

export interface User {
  id: string;
  first_name?: string;
  last_name?: string;
  gender?: Gender;
  phone_number: string;
  /** Avatar — POST /media/upload dan olingan URL (backend 2026-07-31 da qo'shdi) */
  avatar_url?: string | null;
  role?: UserRole;
  status?: string;
  /**
   * Shaxsni tasdiqlash holati — `none` | `pending` | `approved` | `rejected`.
   *
   * 🔴 Backendda ANCHADAN BERI bor edi, lekin ikkala mijoz ham uni UMUMAN
   * o'qimasdi (2026-08-27 sverkasi): mashinaning `moderation_status` i
   * ko'rsatilardi, ODAMNING o'zi tekshiruvdan o'tdimi — yo'q.
   */
  kyc_status?: string;
  /**
   * Rad etish SABABI — modarator yozgan matn (`frontend_updates.md` 4.1).
   *
   * 🔑 Ixtiyoriy va ISHONCHSIZ: 09.09.2026 o'lchovida biz buni jonli
   * ko'ra olmadik (sinov akkauntimiz `approved`, rad etilgan akkaunt
   * yo'q — backenddan so'radik). Shuning uchun mijoz uni MAJBURIY deb
   * o'ylamasin: bo'lmasa eski umumiy maslahat ko'rsatiladi.
   */
  kyc_rejection_reason?: string | null;
  rating?: number;
  rating_count?: number;
  locale?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Car {
  id: string;
  user_id?: string;
  brand: string;
  model: string;
  /** Davlat raqami — backend maydoni `gov_number` (plate_number -> 400, jonli tasdiqlangan) */
  gov_number: string;
  moderation_status?: string;
  tech_passport_photo?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

/** GET /users/me javobi — jonli tasdiqlangan shakl: {user, cars} */
export interface MeResponse {
  user: User;
  cars: Car[];
}

/** POST /users — profil yaratish (yangi hisob uchun) */
export interface CreateProfileRequest {
  first_name: string;
  last_name: string;
  phone_number: string;
  gender?: Gender;
}

/**
 * PUT /users/profile — `http.UpdateProfileRequest` (swagger 2026-07-31, 71 yo'l).
 * first_name/last_name MAJBURIY (min 2, max 50) — avatarni yangilaganda ham
 * yuboriladi. `PATCH /users/me` YO'Q: `/users/me` da faqat GET va DELETE bor.
 */
export interface UpdateProfileRequest {
  first_name: string;
  last_name: string;
  gender?: Gender;
  /** Bo'sh satr = avatarni olib tashlash */
  avatar_url?: string;
  locale?: string;
}

/** POST /users/me/cars */
/**
 * POST /users/me/cars tanasi.
 *
 * ✅ 2026-08-27 (`.com`): `http.CreateCarRequest` HUJJAT MAYDONLARINI oldi —
 * texpasportning IKKI tomoni va mashina UCH rakursda. Ilgari faqat bitta
 * umumiy surat bor edi va moderatsiya mashinani bitta kadrdan tasdiqlay
 * olmasdi: mashina "tekshiruvda" holatida qolib ketardi, odam esa nega
 * e'lon bera olmayotganini tushunmasdi.
 *
 * 🔑 Eski `tech_passport_photo` maydoni ham to'ldiriladi (old tomon bilan):
 * u sxemada saqlanib qolgan va moderatsiya paneli hamon o'shani o'qiyotgan
 * bo'lishi mumkin. Ikkalasini yuborish arzon, yo'qotish esa —
 * tasdiqlanmagan mashina.
 */
export interface CreateCarRequest {
  brand: string;
  model: string;
  gov_number: string;
  tech_passport_front?: string;
  tech_passport_back?: string;
  car_front_photo?: string;
  car_back_photo?: string;
  car_side_photo?: string;
  /** Eskisi — moderatsiya hamon shuni o'qiyotgan bo'lishi mumkin. */
  tech_passport_photo?: string;
}
