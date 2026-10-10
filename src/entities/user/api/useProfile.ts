import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { getMe, updateMe as apiUpdateMe } from '@/shared/api/users';
import { uploadMedia } from '@/shared/api/media';
import { getSubscription } from '@/shared/api/billing';
import { splitFullName } from '@/shared/lib/format';
import {
  decodeJwtPayload,
  getAccessToken,
  getStoredUserName,
  setStoredUserName,
} from '@/shared/lib/token';

/**
 * UI bo'ylab ishlatiladigan profil shakli — MAYDON NOMLARI SAQLANGAN (Header, dashboard,
 * profile, payment, pit-stop shu shaklga bog'langan), manba esa YANGI Gateway:
 *   GET /users/me            -> {user:{first_name,last_name,role,rating,rating_count,...}, cars:[]}
 *   GET /billing/subscription -> {rides_left, ...} (balans endi obunadan; xato bo'lsa 0)
 * Eski monolitdagi tariff.driver_balance/passenger_balance, no_show_count, timeout_until
 * gateway'da YO'Q — balans ikkala rol uchun rides_left, qolganlari null/undefined.
 */
export interface UserProfile {
  id?: string;
  phone: string;
  name: string;
  gender?: 'male' | 'female' | null;
  /** Avatar URL — bo'lmasa UI bosh harflarni ko'rsatadi */
  avatar_url?: string | null;
  is_driver: boolean;
  /** Shaxsni tasdiqlash holati — xom qiymat, talqini `KycStatusCard` da. */
  kyc_status?: string;
  /**
   * Modarator yozgan RAD ETISH SABABI. Bo'lmasligi mumkin (eski akkauntlar,
   * yoki backend hali qaytarmasa) — o'shanda karta umumiy maslahat beradi.
   */
  kyc_rejection_reason?: string | null;
  // tariff_balance = passenger_balance (orqaga moslik uchun saqlanadi)
  tariff_balance: number;
  driver_balance: number;
  passenger_balance: number;
  rating?: number;
  reviews_count?: number;
  no_show_count?: number;
  // Vaqtinchalik blok (Pit-stop) — yangi gateway hozircha bermaydi, doim null.
  timeout_until?: string | null;
}

export const useProfile = () => {
  const queryClient = useQueryClient();

  return useQuery<UserProfile, AxiosError>({
    queryKey: ['profile'],
    enabled: !!getAccessToken(),
    queryFn: async () => {
      try {
        const me = await getMe();
        const u = me.user;

        // Balans (qolgan e'lon/safar soni) — obunadan. Obuna yo'q/billing yotgan bo'lsa 0.
        let ridesLeft = 0;
        try {
          const sub = await getSubscription();
          ridesLeft = sub?.rides_left ?? 0;
        } catch {
          /* obunasiz yoki billing xato — balans 0 ko'rinadi */
        }

        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();

        return {
          id: u.id,
          phone: u.phone_number,
          // Placeholder/bo'sh ism bo'lsa lokal saqlangan ismga qaytamiz.
          name: name || getStoredUserName(),
          gender: (u.gender as UserProfile['gender']) ?? null,
          // Backend maydoni `avatar_url`; eski/qisqa `avatar` shakli ham uchrashi mumkin.
          avatar_url: u.avatar_url || (u as { avatar?: string }).avatar || null,
          is_driver: String(u.role ?? '').toLowerCase() === 'driver',
          kyc_status: u.kyc_status,
          kyc_rejection_reason: u.kyc_rejection_reason ?? null,
          tariff_balance: ridesLeft,
          driver_balance: ridesLeft,
          passenger_balance: ridesLeft,
          rating: u.rating,
          reviews_count: u.rating_count,
          no_show_count: undefined,
          timeout_until: null,
        } satisfies UserProfile;
      } catch (err: unknown) {
        console.warn("users/me o'qilmadi, JWT fallback", err);
        // Tarmoq/5xx holatida sessiyani "yo'qotmaslik" uchun JWT claim'laridan minimal profil.
        const token = getAccessToken();
        if (token) {
          // base64url'ni to'g'ri dekod qiladigan yagona helper (oddiy atob `-`/`_` da yiqilardi).
          const payload = decodeJwtPayload(token);
          if (payload) {
            const cachedProfile = queryClient.getQueryData<UserProfile>(['profile']);
            const savedPhone =
              typeof window !== 'undefined' ? localStorage.getItem('user_phone') : null;

            return {
              id: payload.sub || payload.user_id || payload.id || 'unknown-id',
              phone: savedPhone || payload.phone_number || '+998',
              name: getStoredUserName() || 'User',
              gender: cachedProfile?.gender ?? null,
              avatar_url: cachedProfile?.avatar_url ?? null,
              is_driver:
                cachedProfile?.is_driver || String(payload.role ?? '').toLowerCase() === 'driver',
              tariff_balance: cachedProfile?.tariff_balance ?? 0,
              driver_balance: cachedProfile?.driver_balance ?? 0,
              passenger_balance: cachedProfile?.passenger_balance ?? 0,
              rating: cachedProfile?.rating,
              reviews_count: cachedProfile?.reviews_count,
              no_show_count: cachedProfile?.no_show_count,
              timeout_until: cachedProfile?.timeout_until ?? null,
            } satisfies UserProfile;
          }
          console.error('JWT fallback ham ishlamadi (token dekodlanmadi)');
        }
        throw err;
      }
    },
    retry: (failureCount, error) => {
      if (error?.response?.status === 401 || error?.response?.status === 404) return false;
      return failureCount < 2;
    },
  });
};

/**
 * Profil yangilash (ism/jins/avatar) — PATCH /users/me (PUT /users/profile ga fallback).
 * DIQQAT: backend first_name VA last_name'ni QAT'IY talab qiladi (required+min) —
 * bitta so'zli ism kelsa familiyani joriy profildagi ismdan to'ldiramiz.
 * Rol almashtirish BU YERDA EMAS: haydovchiga o'tish = usersApi.upgradeToDriver (onboarding).
 */
/**
 * Interfeys tilini SERVERGA saqlaydi (`PUT /users/profile` -> `locale`).
 *
 * NEGA: backend bildirishnoma/SMS matnini `user.locale` bo'yicha yaratadi. Ilgari bu
 * maydonni yozadigan endpoint yo'q edi va hammaga ruscha kelardi — frontend ularni
 * namuna (regex) bo'yicha tarjima qilib turardi (shared/lib/notifications.ts). Swagger
 * 2026-08-03 da `http.UpdateProfileRequest` ga `locale` qo'shildi.
 *
 * Jimgina ishlaydi ("fire-and-forget"): til baribir cookie'da saqlanadi, shuning uchun
 * so'rov yiqilsa foydalanuvchiga xato ko'rsatilmaydi. Ism to'liq bo'lmasa UMUMAN
 * yuborilmaydi — `first_name`/`last_name` bu PUT'da MAJBURIY (min 2 belgi) va
 * to'liqsiz profil 400 olardi.
 */
export const persistLocaleOnServer = async (
  queryClient: QueryClient,
  locale: string
): Promise<void> => {
  if (!getAccessToken()) return;
  const cached = queryClient.getQueryData<UserProfile>(['profile']);
  const { first_name, last_name } = splitFullName((cached?.name ?? '').trim());
  if (!first_name || !last_name) return;
  try {
    await apiUpdateMe({
      first_name,
      last_name,
      ...(cached?.gender ? { gender: cached.gender } : {}),
      ...(cached?.avatar_url ? { avatar_url: cached.avatar_url } : {}),
      locale,
    });
  } catch {
    /* til cookie'da saqlangan — bu faqat bildirishnoma tili uchun, jim o'tamiz */
  }
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: {
      name?: string;
      gender?: 'male' | 'female' | null;
      /** '' = avatarni olib tashlash, undefined = tegilmaydi */
      avatar_url?: string;
    }) => {
      const cached = queryClient.getQueryData<UserProfile>(['profile']);
      const source = (updates.name ?? cached?.name ?? '').trim();
      const names = splitFullName(source);
      const cachedNames = splitFullName((cached?.name ?? '').trim());
      const first_name = names.first_name ?? cachedNames.first_name;
      const last_name = names.last_name ?? cachedNames.last_name;
      if (!first_name || !last_name) {
        throw new Error('FULL_NAME_REQUIRED');
      }

      const updated = await apiUpdateMe({
        first_name,
        last_name,
        ...(updates.gender ? { gender: updates.gender } : {}),
        ...(updates.avatar_url !== undefined ? { avatar_url: updates.avatar_url } : {}),
      });
      return updated;
    },
    onSuccess: (u) => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      setStoredUserName(name);
      // Javob to'liq User — keshni yangilab, serverdan qayta tasdiqlaymiz.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

/**
 * Avatarni almashtirish: fayl -> POST /media/upload -> PATCH /users/me {avatar_url}.
 * Ikki qadam ATAYIN bitta mutatsiyada — foydalanuvchi uchun bu bitta amal, va
 * yuklash muvaffaqiyatli bo'lib profil yangilanmasa, "sirg'anib qolgan" media
 * hech qayerda ko'rinmay qoladi (holat yarim saqlanmasin).
 *
 * `file: null` — avatarni olib tashlash (bo'sh `avatar_url` yuboriladi).
 */
export const useUpdateAvatar = () => {
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();

  return useMutation({
    mutationFn: async (file: File | null) => {
      if (!file) return updateProfile.mutateAsync({ avatar_url: '' });
      const media = await uploadMedia(file);
      if (!media?.url) throw new Error('AVATAR_UPLOAD_NO_URL');
      return updateProfile.mutateAsync({ avatar_url: media.url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};
