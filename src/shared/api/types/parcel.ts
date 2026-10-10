/**
 * Posilkalar kontrakti — 2026-08-07 jonli Swagger bilan solishtirildi.
 *
 * ✅ Backend so'ralgan maydonlarni QO'SHDI. Endi `domain.Parcel` va
 * `createParcelRequest` da bor: `from_address`, `to_address` (ikkalasi MAJBURIY),
 * `size`, `description`, `deliver_by`, origin/destination lat-lon, `price`,
 * `receiver_phone`, `status`, `driver_id`, `sender_id`.
 *
 * 🔴 NOM O'ZGARDI: ilgari biz manzilni `origin_address`/`destination_address` deb
 * yuborardik — backend kontraktida bunday nom hech qachon bo'lmagan, ya'ni matn
 * jim tashlab yuborilardi. Endi `from_address`/`to_address` va ular MAJBURIY:
 * eski nomlar bilan yuborilgan so'rov 400 oladi.
 *
 * ⚠️ Hamon YO'Q: `sender` / `driver` obyektlari — javoblarda faqat
 * `sender_id` / `driver_id` keladi, ism uchun alohida so'rov kerak.
 */

/** Posilka o'lchami — narx va mos mashina uchun. */
export type ParcelSize = 'small' | 'medium' | 'large';

export interface Parcel {
  id: string;
  sender_id: string;
  driver_id?: string;

  /** Manzil MATNI — qidiruv natijasida shahar nomi ko'rsatiladi (koordinata emas). */
  from_address?: string;
  to_address?: string;
  origin_lat: number;
  origin_lon: number;
  destination_lat: number;
  destination_lon: number;

  price?: number;
  size?: ParcelSize;
  /** Yuk tavsifi — "hujjat", "kichik quti" kabi. */
  description?: string;
  receiver_phone?: string;

  /**
   * Nechta haydovchi taklif berdi.
   *
   * ✅ Backend 2026-08-16 kechqurun qo'shdi. Ungacha jo'natuvchi taklif
   * kelganini BILMASDI — har posilkani ochib tekshirishi kerak edi.
   */
  responses_count?: number;
  /** pending | active | matched | in_transit | delivered | completed | cancelled */
  status?: string;
  /** Yetkazib berish kutilayotgan sana (ISO). */
  deliver_by?: string;

  /** Jo'natuvchi (haydovchi ko'radi). Tarixda maskalanishi kerak — xat §6b. */
  sender?: { id?: string; name?: string; display_name?: string; rating?: number };

  /** Haydovchi otkliklari — faqat jo'natuvchi so'roviga qo'shiladi. */
  responses?: ParcelResponse[];

  created_at?: string;
  updated_at?: string;
}

/** Haydovchining posilkaga otkligi (safar bronining analogi). */
export interface ParcelResponse {
  id: string;
  parcel_id: string;
  driver_id: string;
  /** Haydovchi taklif qilgan narx (jo'natuvchi narxidan farq qilishi mumkin). */
  offered_price?: number;
  /** pending | accepted | rejected */
  status?: string;
  driver?: { id?: string; name?: string; display_name?: string; rating?: number };
  created_at?: string;
}

export interface CreateParcelRequest {
  origin_lat: number;
  origin_lon: number;
  destination_lat: number;
  destination_lon: number;
  from_address?: string;
  to_address?: string;
  price?: number;
  size?: ParcelSize;
  description?: string;
  receiver_phone?: string;
  deliver_by?: string;
}

/**
 * Qidiruv parametrlari — JONLI swagger bo'yicha (2026-07-31).
 *
 * `lat`/`lon` MAJBURIY (haydovchi nuqtasi), `radius` — METRDA (default 5000).
 * Ilgari bu yerda `city`, `radius_km`, `size`, manba/manzil koordinatalari bor
 * edi — backend ularning BIRORTASINI qabul qilmaydi, `driver_id` talabi esa
 * olib tashlangan (kim qidirayotgani endi tokendan aniqlanadi).
 *
 * Shahar bo'yicha qidiruv shu sababli frontendda geokoder orqali koordinataga
 * aylantiriladi (parcels sahifasi), bu yerda esa faqat backend tili qoladi.
 */
export interface ParcelSearchParams {
  lat: number;
  lon: number;
  /** Metr. Shahar bo'yicha qidirilganda kattaroq qiymat beriladi. */
  radius?: number;
  /** Narx oralig'i (UZS, ikki tomoni ham inklyuziv). */
  price_min?: number;
  price_max?: number;
}
