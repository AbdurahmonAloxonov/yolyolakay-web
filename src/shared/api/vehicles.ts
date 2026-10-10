import { api, unwrap } from './client';

/**
 * Mashina ma'lumoti — `GET /vehicles/{id}` (backend 2026-08-07 da qo'shdi).
 *
 * NEGA KERAK: yo'lovchi safar kartochkasida mashina rusumi va raqamini ko'rmasdi —
 * ilgari buni oladigan joy umuman yo'q edi (safar javobida `vehicle_id` bor, lekin
 * mashinaning o'zi ochilmaydi). Bu ishonch uchun muhim: odam kutayotgan mashinani
 * taniy olishi kerak.
 *
 * ⚠️ IKKI SXEMA, BIR NARSA. Backend bir xil mashinani ikki xil ataydi:
 *     domain.Car     → gov_number,    tech_passport_photo, driver_license_photo
 *     domain.Vehicle → license_plate, color, year
 * `/users/me/cars` birinchisini, `GET /vehicles/{id}` ikkinchisini qaytaradi.
 * Qaysi biri kanonik ekani backenddan SO'RALGAN (xat 2026-08-07, 6-band), javob
 * kelmagunicha IKKALASINI ham o'qiymiz — shunda qaysi shakl kelishidan qat'i nazar
 * raqam ko'rinadi va javob kelganda bu yerda hech nima o'zgartirilmasa ham ishlaydi.
 */
export interface Vehicle {
  id: string;
  brand?: string;
  model?: string;
  /** `license_plate` (Vehicle) yoki `gov_number` (Car) — qaysi biri kelsa. */
  plate?: string;
  color?: string;
  year?: number;
  moderationStatus?: string;
}

const str = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || undefined;
};

export function normalizeVehicle(raw: unknown): Vehicle | null {
  if (!raw || typeof raw !== 'object') return null;
  // `{vehicle:{...}}` / `{car:{...}}` o'ramidan chiqamiz.
  const outer = raw as Record<string, unknown>;
  const inner = (outer.vehicle ?? outer.car) as Record<string, unknown> | undefined;
  const v = inner && typeof inner === 'object' ? inner : outer;

  const id = str(v.id) ?? str(v.ID);
  if (!id) return null;

  const year = Number(v.year);
  return {
    id,
    brand: str(v.brand),
    model: str(v.model),
    plate: str(v.license_plate) ?? str(v.gov_number),
    color: str(v.color),
    year: Number.isFinite(year) && year > 1900 ? year : undefined,
    moderationStatus: str(v.moderation_status),
  };
}

/**
 * Bitta mashina. Fon-o'qish: topilmasa/xato bo'lsa `null` — chaqiruvchi mashina
 * qatorini UMUMAN chizmaydi (bo'sh joy ham, xato ham ko'rinmaydi).
 */
export async function getVehicle(vehicleId: string): Promise<Vehicle | null> {
  try {
    const res = await api.get(`/vehicles/${vehicleId}`, { skipErrorToast: true });
    return normalizeVehicle(unwrap<unknown>(res));
  } catch {
    return null;
  }
}
