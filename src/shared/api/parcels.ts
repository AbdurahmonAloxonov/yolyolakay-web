import { api, unwrap } from './client';
import type {
  CreateParcelRequest,
  Parcel,
  ParcelResponse,
  ParcelSearchParams,
} from './types/parcel';

/**
 * Posilkalar API.
 *
 * HOLAT (2026-07-31, backendning IKKI hisoboti bo'yicha):
 *   ✅ aytilgan: `GET /parcels/{id}`, `GET /parcels/my`, `POST /parcels/{id}/respond`,
 *      `POST /parcels/responses/{id}/accept|reject`
 *   ❓ hech qaysi hisobotda YO'Q: `GET /parcels/{id}/responses` (jo'natuvchi
 *      otkliklarni ko'radi — accept/reject aynan shundan ishlaydi) va
 *      `POST /parcels/{id}/cancel`
 *   ⚠️ jonli Swagger HAMON ESKI (51 yo'l, md5 o'zgarmagan) — ya'ni bularning
 *      birortasini hujjat bilan tasdiqlab bo'lmaydi. `notReady` himoyasi SAQLANADI.
 *
 * UI shu modulga ALLAQACHON ulangan va endpointlar paydo bo'lishi bilan
 * ishlab ketadi. Endpoint yo'q bo'lsa 404 keladi — chaqiruvchi hook uni
 * "bo'lim tayyor emas" holatiga aylantiradi (entities/parcel/api/useParcels.ts).
 * SHU SABAB bu yerda 404 yutilmaydi va bo'sh massivga aylantirilmaydi:
 * "posilka topilmadi" bilan "bo'lim ishlamayapti" ni farqlash SHART.
 */

/** Xatoni "endpoint yo'q" deb tanish uchun — hook shu bo'yicha holat tanlaydi. */
export const isNotImplemented = (e: unknown): boolean =>
  (e as { response?: { status?: number } })?.response?.status === 404;

export async function createParcel(body: CreateParcelRequest): Promise<Parcel> {
  const res = await api.post('/parcels', body);
  return unwrap<Parcel>(res);
}

/**
 * Posilka qidirish (haydovchi yo'lida yuk izlaydi).
 * Swagger 2026-07-31: `lat`/`lon` majburiy, `radius` metrda; `driver_id` talabi
 * OLIB TASHLANGAN — kim qidirayotgani tokendan aniqlanadi (xat §2 bajarildi).
 */
export async function searchParcels(params: ParcelSearchParams): Promise<Parcel[]> {
  const res = await api.get('/parcels/search', { params, skipErrorToast: true });
  const body = unwrap<Parcel[] | { parcels: Parcel[] | null }>(res);
  if (Array.isArray(body)) return body;
  return body?.parcels ?? [];
}

/**
 * O'z posilkalarim.
 *
 * ✅ 2026-08-07: `role` parametri QO'SHILDI (swagger). Endi haydovchi ham
 * "men olib ketayotgan posilkalar" ro'yxatini oladi — ilgari bunday endpoint
 * yo'q edi va haydovchi taklifi qabul qilingandan keyin posilka undan
 * KO'RINMAY ketardi.
 *
 * `role` berilmasa backend eski xatti-harakatni saqlaydi (jo'natuvchi).
 */
export async function getMyParcels(role?: 'sender' | 'driver'): Promise<Parcel[]> {
  const res = await api.get('/parcels/my', {
    params: role ? { role } : undefined,
    skipErrorToast: true,
  });
  const body = unwrap<Parcel[] | { parcels: Parcel[] | null }>(res);
  if (Array.isArray(body)) return body;
  return body?.parcels ?? [];
}

export async function getParcel(parcelId: string): Promise<Parcel | null> {
  const res = await api.get(`/parcels/${parcelId}`, { skipErrorToast: true });
  return unwrap<Parcel | null>(res) ?? null;
}

/** Posilkaga kelgan haydovchi otkliklari (jo'natuvchi ko'radi). */
export async function getParcelResponses(parcelId: string): Promise<ParcelResponse[]> {
  const res = await api.get(`/parcels/${parcelId}/responses`, { skipErrorToast: true });
  const body = unwrap<ParcelResponse[] | { responses: ParcelResponse[] | null }>(res);
  if (Array.isArray(body)) return body;
  return body?.responses ?? [];
}

/** Haydovchi posilkani olib borishga taklif beradi. */
export async function respondToParcel(
  parcelId: string,
  offeredPrice?: number
): Promise<ParcelResponse> {
  const res = await api.post(`/parcels/${parcelId}/respond`, { offered_price: offeredPrice });
  return unwrap<ParcelResponse>(res);
}

/**
 * Jo'natuvchi otklikni qabul qiladi yoki rad etadi.
 *
 * 🔴 YO'L O'ZGARDI (2026-08-07): eski `/parcels/responses/{id}/accept|reject`
 * gateway'dan OLIB TASHLANDI, o'rniga posilka ID'sini ham talab qiladigan
 * `/parcels/{id}/responses/{response_id}/accept|reject` keldi. Eskisi bilan
 * yuborilgan so'rov endi 404 oladi — shuning uchun ikkala ID ham majburiy.
 */
export async function decideParcelResponse(
  parcelId: string,
  responseId: string,
  decision: 'accept' | 'reject'
): Promise<void> {
  await api.post(`/parcels/${parcelId}/responses/${responseId}/${decision}`);
}

/**
 * Posilkani OLDIM / YETKAZDIM (haydovchi).
 *
 * ✅ Backend 2026-08-16 kechqurun qo'shdi (biz so'ragan edik —
 * `BACKEND_XAT_POSILKA_2026-08-16`). Ungacha posilka `accepted` da ABADIY
 * qolardi: jo'natuvchi yetkazilganini bilmasdi, ro'yxat tozalanmasdi.
 */
export async function pickupParcel(parcelId: string): Promise<void> {
  await api.post(`/parcels/${parcelId}/pickup`);
}

export async function deliverParcel(parcelId: string): Promise<void> {
  await api.post(`/parcels/${parcelId}/deliver`);
}

/**
 * JO'NATUVCHI posilkani yopadi — `POST /parcels/{id}/confirm-delivery`.
 *
 * ✅ Backend 2026-09-04 da qo'shdi (biz so'ragan edik).
 *
 * 🔴 Nega kerak edi: yopish tugmasi FAQAT haydovchida edi. Haydovchi
 * posilkani berib, tugmani bosishni unutsa (yoki ilovani o'chirib
 * tashlasa), posilka `picked_up` da ABADIY qolardi va jo'natuvchining
 * qo'lidan hech narsa kelmasdi. Endi ikkala tomon ham yopa oladi.
 *
 * ⚠️ Serverda ruxsat qat'iy: faqat jo'natuvchi yoki tayinlangan
 * haydovchi. Begona odam 400 oladi va holat o'zgarmaydi (o'lchandi).
 */
export async function confirmParcelDelivery(parcelId: string): Promise<void> {
  await api.post(`/parcels/${parcelId}/confirm-delivery`);
}

/**
 * Posilka «haydovchi oldi» holatidami?
 *
 * 🔴 Backend `picked_up` beradi, mijozlar esa `in_transit` ni
 * kutishardi (o'lchandi 2026-09-04: `pickup` dan keyin holat
 * AYNAN `picked_up`). Natijada saytda ham, ilovada ham «Yetkazdim»
 * tugmasi HECH QACHON chiqmasdi va posilka oxirgi qadamda qotib
 * qolardi — 16-avgustdan beri quvib yurgan muammomizning qolgan
 * yarmi shu edi.
 *
 * Ikkala nom ham qabul qilinadi: gateway `in_transit` ga qaytsa
 * ham buzilmaymiz.
 */
export function isParcelPickedUp(status: unknown): boolean {
  const s = String(status ?? '').toLowerCase();
  return s === 'picked_up' || s === 'in_transit';
}

export async function cancelParcel(parcelId: string): Promise<void> {
  await api.post(`/parcels/${parcelId}/cancel`);
}
