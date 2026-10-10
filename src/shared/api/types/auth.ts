// Swagger: http.SendOTPRequest / http.VerifyOTPRequest / http.RefreshRequest /
// auth_usecase.TokenResponse / auth_domain.Session (2026-07-18 dump).

/**
 * OTP nima uchun so'ralayotgani — backend MAJBURIY talab qiladi
 * (`type` bo'lmasa 400: "invalid request body or missing 'type'";
 *  noto'g'ri qiymatda: "invalid type (must be register, login, or frgt_pswd)").
 *
 * Ma'nosi (backend tasdig'i 2026-08-03):
 *   register  — birinchi marta ro'yxatdan o'tish (raqam bor bo'lsa 409)
 *   login     — boshqa qurilmadan kirish (raqam yo'q bo'lsa 404)
 *   frgt_pswd — parolni tiklash (raqam yo'q bo'lsa 404)
 */
export type OtpPurpose = 'register' | 'login' | 'frgt_pswd';

export interface SendOtpRequest {
  phone_number: string;
  type: OtpPurpose;
}

export interface VerifyOtpRequest {
  phone_number: string;
  /** 5 xonali OTP; test akkaunt: +998990000000 / 11111 */
  code: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  /** true — verify-otp yangi hisob yaratdi (ism/jins to'ldirish kerak) */
  is_new_user?: boolean;
}

export interface Session {
  session_id: string;
  user_id: string;
  device_id: string;
  device_ip?: string;
  os_type?: string;
  user_agent?: string;
  refresh_token?: string;
  created_at: string;
  expires_at: string;
}
