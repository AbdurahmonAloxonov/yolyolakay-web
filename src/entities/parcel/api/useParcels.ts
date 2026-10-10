import { useQuery } from '@tanstack/react-query';
import {
  getMyParcels,
  getParcelResponses,
  isNotImplemented,
  searchParcels,
} from '@/shared/api/parcels';
import type { Parcel, ParcelResponse, ParcelSearchParams } from '@/shared/api/types/parcel';

/**
 * Posilka hooklari.
 *
 * ASOSIY G'OYA: `notReady` bayrog'i. Backendda endpoint hali yo'q (404) bo'lsa,
 * UI "posilka topilmadi" DEB YOZMASLIGI kerak — bu yolg'on bo'ladi va
 * foydalanuvchi bo'limni bo'sh deb o'ylaydi. Shuning uchun 404 alohida
 * holatga aylantiriladi va sahifa "bo'lim tayyorlanmoqda" deb ko'rsatadi.
 *
 * Backend endpointlarni chiqargach BU FAYLDA HECH NARSA O'ZGARMAYDI —
 * 404 kelmay qo'yadi va notReady o'zi false bo'ladi.
 */

export interface ParcelsResult<T> {
  data: T;
  isLoading: boolean;
  /** Endpoint gateway'da hali yo'q (404) — "bo'sh" bilan chalkashtirmaslik uchun. */
  notReady: boolean;
  /** Vaqtinchalik nosozlik (tarmoq, 5xx, 401) — qayta urinib ko'rish mumkin. */
  failed: boolean;
  refetch: () => void;
}

const useParcelQuery = <T>(
  key: unknown[],
  fn: () => Promise<T>,
  empty: T,
  enabled = true
): ParcelsResult<T> => {
  const q = useQuery<{ value: T; notReady: boolean }>({
    queryKey: key,
    enabled,
    // 404 (endpoint yo'q) — qayta urinish MA'NOSIZ, u o'zgarmaydi.
    // Qolgan xatolar o'tkinchi bo'lishi mumkin (backend uy mashinasida, 502 bo'lib
    // turadi) — bitta qayta urinish bepul va ko'p holatni yopadi.
    retry: (count, e) => !isNotImplemented(e) && count < 1,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return { value: await fn(), notReady: false };
      } catch (e) {
        if (isNotImplemented(e)) return { value: empty, notReady: true };
        throw e;
      }
    },
  });

  return {
    data: q.data?.value ?? empty,
    isLoading: q.isLoading,
    // 🔴 2026-08-07 TUZATILDI. Ilgari shunday edi: `notReady: q.data?.notReady ?? q.isError`,
    // ya'ni ISTALGAN xato (internet uzilishi, backend 502, token eskirishi) foydalanuvchiga
    // "Posilkalar serveri HALI ULANMAGAN, interfeys tayyor" deb ko'rsatilardi.
    //
    // Bu YOLG'ON: posilka endpointlari backendda BOR va ishlaydi. Odam o'tkinchi
    // uzilishni "bu funksiya hali yozilmagan" deb tushunib, boshqa qaytmasdi.
    //
    // Endi ikkisi ajratilgan: `notReady` — faqat haqiqiy 404, `failed` — o'tkinchi
    // nosozlik (sahifa "qayta urinish" tugmasini ko'rsatadi).
    notReady: q.data?.notReady ?? false,
    failed: q.isError,
    refetch: () => void q.refetch(),
  };
};

/** Haydovchi: yo'lida olib ketish mumkin bo'lgan posilkalar. */
export const useParcelSearch = (params: ParcelSearchParams, enabled = true) =>
  useParcelQuery<Parcel[]>(['parcels-search', params], () => searchParcels(params), [], enabled);

/**
 * O'z posilkalarim — faqat JO'NATUVCHI ko'rinishi (`/parcels/my` boshqasini
 * bermaydi, swagger 2026-07-31). Haydovchi ekranida `enabled=false` bilan
 * o'chiriladi: noto'g'ri ro'yxat ko'rsatgandan ko'ra hech narsa ko'rsatmagan afzal.
 */
export const useMyParcels = (enabled = true, role: 'sender' | 'driver' = 'sender') =>
  useParcelQuery<Parcel[]>(['parcels-my', role], () => getMyParcels(role), [], enabled);

/** Tanlangan posilkaga kelgan otkliklar (safar arizalarining analogi). */
export const useParcelResponses = (parcelId: string | null) =>
  useParcelQuery<ParcelResponse[]>(
    ['parcel-responses', parcelId],
    () => getParcelResponses(String(parcelId)),
    [],
    !!parcelId
  );
