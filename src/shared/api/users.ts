import { api, unwrap } from './client';
import type {
  Car,
  CreateCarRequest,
  CreateProfileRequest,
  MeResponse,
  UpdateProfileRequest,
  User,
} from './types/user';

/**
 * Users — profil, mashinalar, haydovchiga upgrade.
 * Mashinalar faqat GET/POST (tahrirlash/o'chirish endpointi gateway'da YO'Q).
 */

/** Joriy foydalanuvchi: {user, cars} (jonli tasdiqlangan shakl). */
export async function getMe(): Promise<MeResponse> {
  const res = await api.get('/users/me', { skipErrorToast: true });
  return unwrap<MeResponse>(res);
}

export async function getUser(id: string): Promise<User> {
  const res = await api.get(`/users/${id}`, { skipErrorToast: true });
  const body = unwrap<User | { user: User }>(res);
  // Ba'zi javoblar {user: {...}} qobig'ida kelishi mumkin (users/me bilan simmetrik).
  return (body as { user?: User })?.user ?? (body as User);
}

/** Yangi hisob profili (is_new_user=true oqimida). */
export async function createProfile(body: CreateProfileRequest): Promise<User> {
  const res = await api.post('/users', body);
  return unwrap<User>(res);
}

export async function updateProfile(body: UpdateProfileRequest): Promise<User> {
  const res = await api.put('/users/profile', body);
  return unwrap<User>(res);
}

/**
 * Avatar ham SHU YERDAN yangilanadi.
 *
 * Backend hisobotida "PATCH /users/me alias qo'shildi" deyilgan edi, lekin jonli
 * Swagger'da (2026-07-31 kech, 71 yo'l) `/users/me` da faqat GET va DELETE bor —
 * PATCH YO'Q. `avatar_url` esa `http.UpdateProfileRequest` ichida, ya'ni aynan
 * shu PUT. Shuning uchun vaqtincha qo'yilgan PATCH→PUT fallback olib tashlandi.
 *
 * Swagger'dan: `first_name` va `last_name` — required, min 2 / max 50 belgi;
 * `avatar_url`, `gender`, `locale` — ixtiyoriy.
 */
export const updateMe = updateProfile;

export async function getMyCars(): Promise<Car[]> {
  // Fon-o'qish — profil/VehiclesSection xatoda bo'sh ro'yxatni ko'rsatadi; global
  // "Tizimda xatolik" toast'i CHIQMASIN (profilni ochganda qo'rqitmaydi).
  const res = await api.get('/users/me/cars', { skipErrorToast: true });
  return unwrap<Car[]>(res) ?? [];
}

export async function addCar(body: CreateCarRequest): Promise<Car> {
  const res = await api.post('/users/me/cars', body);
  return unwrap<Car>(res);
}

/**
 * POST /users/upgrade tanasi.
 *
 * ✅ `myid_code` OLIB TASHLANDI (2026-08-22): backend uni endi talab
 * qilmaydi — bo'sh tana validatsiyasi faqat brand/model/gov_number
 * so'raydi (jonli o'lchandi).
 * ✅ 2026-08-27, `.com` ga ko'chgach: `myid_code` va `redirect_uri`
 * sxemadan BUTUNLAY yo'qoldi — swagger endi kod bilan mos.
 *
 * ✅ HUJJAT IKKI TOMONDAN, MASHINA UCH RAKURSDA (`.com`): ilgari har
 * hujjatdan bitta kadr ketardi, ya'ni guvohnomaning orqasidagi TOIFALAR
 * (odam yo'lovchi tashishga haqlimi) va texpasportning orqasidagi egalik
 * yozuvlari moderatsiyaga umuman yetib bormasdi.
 *
 * 🔑 Eski `tech_passport_photo` / `driver_license_photo` ham to'ldiriladi
 * (old tomon bilan): moderatsiya paneli hamon o'shalarni o'qiyotgan
 * bo'lishi mumkin.
 */
export interface UpgradeToDriverRequest {
  brand: string;
  model: string;
  gov_number: string;
  /** Hujjatlar (media/upload URL'lari) — moderatsiya shular bo'yicha tasdiqlaydi. */
  tech_passport_front?: string;
  tech_passport_back?: string;
  driver_license_front?: string;
  driver_license_back?: string;
  car_front_photo?: string;
  car_back_photo?: string;
  car_side_photo?: string;
  /**
   * Odamning O'Z surati — pasport/ID o'rniga (egasi, 2026-08-28).
   * ✅ Bu maydon sxemada ALLAQACHON bor, ya'ni bugunoq ishlaydi.
   *
   * 🔴 `passport_photo` va `identity_type` OLIB TASHLANDI: ular
   * backendga hech qachon yetib bormagan (maydonning o'zi yo'q edi),
   * ya'ni odamdan hech qayerga bormaydigan hujjat so'ralardi.
   */
  avatar_url?: string;
  /** Eskilari — moderatsiya hamon shularni o'qiyotgan bo'lishi mumkin. */
  tech_passport_photo?: string;
  driver_license_photo?: string;
}

/**
 * Haydovchiga upgrade — BITTA so'rovda ariza + birinchi mashina.
 *
 * ✅ Onboarding endi AYNAN shu funksiyani chaqiradi. Ilgari u
 * `POST /api/myid/upgrade` (o'zimizning server route) orqali borardi,
 * chunki `myid_code` HttpOnly cookie'da yotardi — MyID olib tashlangach
 * o'sha route ham o'chirildi.
 */
export async function upgradeToDriver(body: UpgradeToDriverRequest): Promise<void> {
  await api.post('/users/upgrade', body);
}
