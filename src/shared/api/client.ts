import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  decodeJwtPayload,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  clearStoredUserName,
  clearStoredUserId,
} from '@/shared/lib/token';
import { localizeBackendMessage, isInternalBackendError, deepUnescape } from '@/shared/lib/format';
import { deviceHeaders } from './device';
import { isPublicPathname } from '@/shared/lib/routes';
import { asLang } from '@/shared/lib/i18n';
import { toast } from 'sonner';
import { trFor } from '@/shared/lib/i18n';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
    // Shu so'rov uchun global xato-toastini o'chirish (chaqiruvchi xatoni o'zi ishlasa).
    skipErrorToast?: boolean;
  }
  export interface AxiosRequestConfig {
    skipErrorToast?: boolean;
  }
}

// Backend: YolYolakay — BITTA API Gateway (api.yolyolakay.com), hamma route /api/v1 ostida.
// MUHIM: brauzer default'da same-origin proxy (/api-proxy, next.config.ts rewrites) orqali boradi.
// Sabab (2026-07-18) gateway CORS preflight'i X-Device-ID / X-OS-Type ga ruxsat bermasligi edi.
// 2026-08-09 da qayta o'lchandi: preflight endi
//   Access-Control-Allow-Headers: Origin,Content-Type,Accept,Authorization,X-Device-Id,X-Os-Type
// qaytaradi, ya'ni to'siq YO'Q. Proxy ATAYIN saqlanmoqda — u backend manzilini (tunnel URL)
// serverda yashiradi va u o'zgarganda mijoz kodini qayta yig'ish kerak emas. To'g'ridan-to'g'ri
// ulanish kerak bo'lsa: NEXT_PUBLIC_API_URL=https://api.yolyolakay.com.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api-proxy';

// Yagona client — barcha domen modullari (auth, users, rides, billing, notifications...) shu orqali.
export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Gateway javobi ba'zan {success, data} qobig'ida, ba'zan yassi keladi —
 * ikkalasini ham bitta shaklga keltiramiz.
 */
export function unwrap<T>(res: AxiosResponse): T {
  const body = res.data;
  if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) {
    return body.data as T;
  }
  return body as T;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token = getAccessToken();

  /*
   * MUDDATI TUGAYOTGAN TOKEN BILAN SO'ROV YUBORMAYMIZ.
   *
   * 🔴 `access_token` umri jonli o'lchovda atigi 15 DAQIQA (2026-08-24).
   * Ilgari yangilash faqat 401 KELGANDAN KEYIN boshlanardi, ya'ni har 15
   * daqiqada butun bir 401 to'lqini ko'tarilardi (`refetchOnWindowFocus`
   * tabga qaytilganda o'nlab so'rovni birdan yuboradi). Har bunday to'lqin —
   * yangilash poygasi uchun imkoniyat, poyga esa sessiyani o'ldirardi
   * (refresh token aylanadi, izohi quyida).
   *
   * Endi token muddati tugashiga bir daqiqadan kam qolsa, so'rov ketishidan
   * OLDIN yangilanadi. Qulf tufayli parallel so'rovlar bitta yangilashni
   * kutadi — 401 umuman yuzaga kelmaydi.
   *
   * `/auth/*` chetlab o'tiladi: login/OTP tokensiz ishlaydi va yangilashning
   * o'zi ham shu yerdan o'tmasligi kerak.
   */
  const isAuthCall = (config.url ?? '').includes('/auth/');
  if (token && !isAuthCall) {
    const left = msUntilExpiry(token);
    if (left !== null && left < REFRESH_SKEW_MS) {
      token = (await refreshAccessToken(token)) ?? token;
    }
  }

  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Qurilma identifikatori — HAR so'rovga (avval faqat login/verify-otp'ga qo'lda
  // qo'yilardi). Backend qurilmani `send-otp` bosqichida ham bog'laydi: headersiz
  // so'rov unga "yangi qurilma" bo'lib ko'rinadi va parol bilan kirishda ortiqcha
  // SMS talab qilinadi (2026-08-09 backend hisoboti).
  if (config.headers) {
    const dev = deviceHeaders();
    if (dev['X-Device-ID']) {
      config.headers['X-Device-ID'] = dev['X-Device-ID'];
      config.headers['X-OS-Type'] = dev['X-OS-Type'];
    }
  }
  return config;
});

// ===== TOKEN YANGILASH =====
//
// 🔴 SESSIYA O'ZIDAN O'ZI UZILARDI (egasi, 2026-08-24: "sayt o'zidan o'zi
// chiqarib yuboryapti", "rol almashganda login pagega qaytib qolyapti").
//
// Sabab JONLI O'LCHANDI (2026-08-24, prod gateway):
//   • `access_token` umri — atigi 15 DAQIQA;
//   • `POST /auth/refresh` refresh tokenni AYLANTIRADI (yangisini qaytaradi);
//   • ESKI refresh token DARHOL o'ladi → qayta ishlatilsa `401 {"error":
//     "invalid or expired session"}`.
//
// Ya'ni IKKI yangilash poygaga tushsa, biri albatta 401 oladi va eski kod
// uni "sessiya o'ldi" deb o'qib `hardLogout()` qilardi. Poyga esa oson
// yuzaga keladi:
//   1. IKKI TAB (yoki PWA + brauzer) ochiq — har birida o'z `isRefreshing`i;
//      `refetchOnWindowFocus` tabga qaytilganda ikkalasida ham 401 to'lqini;
//   2. yangilash so'rovi ketgan, javob KELMASDAN sahifa qayta yuklandi —
//      yangi refresh token saqlanmay qoldi, eskisi esa serverda allaqachon
//      o'lgan (keyingi urinish darhol 401).
//
// Uchta himoya qo'yildi:
//   A. TABLARARO QULF (`navigator.locks`) — bir vaqtda faqat BITTA tab
//      yangilaydi, qolganlari kutadi;
//   B. qulfni olgach xotiradagi token QAYTA O'QILADI: boshqa tab allaqachon
//      yangilagan bo'lsa umuman so'rov yubormaymiz;
//   C. 401 kelsa DARHOL chiqarmaymiz — saqlangan refresh token o'zgargan
//      bo'lsa (kimdir ulgurgan) yangisi bilan BIR marta qayta urinamiz.
//
// D. Va eng muhimi — 401 ni KUTMAYMIZ: muddati tugayotgan token bilan so'rov
//    yubormaymiz (`REFRESH_SKEW_MS`), shunda 401 to'lqinining o'zi bo'lmaydi.
//
// ⚠️ Backendga: eski refresh tokenga qisqa (30-60 s) imtiyoz oynasi berilsa,
// bu himoyalarning hammasi ortiqcha bo'lardi — xatga yozildi.

/**
 * Sessiya haqiqatan o'lganda — hamma narsani tozalab login'ga.
 *
 * ⚠️ FAQAT `refreshAccessToken` chaqiradi va faqat qayta urinishlar
 * tugagach: bu funksiya odamni ish o'rtasida ekrandan uloqtiradi.
 */
const hardLogout = () => {
  if (typeof window === 'undefined') return;
  clearTokens();
  localStorage.removeItem('user_phone');
  clearStoredUserName();
  clearStoredUserId();
  // 🔴 2026-08-16: ilgari `startsWith('/uz') ? 'uz' : 'ru'` edi — inglizcha
  // sahifadan chiqarilgan odam RUSCHA login ekraniga tushardi va o'z tiliga
  // qaytish uchun uni qaytadan qidirishi kerak edi.
  const locale = asLang(window.location.pathname.split('/')[1]);

  // Ochiq sahifalardan HECH QACHON login'ga otmaymiz. Ular kirmasdan ochilishi
  // kerak, va sahifadagi biror fon so'rovi 401 bergani ularni yopib qo'yishi
  // mumkin emas.
  //
  // Huquqiy sahifalarda bu haqiqiy bug edi: Play moderatori maxfiylik siyosati
  // yoki hisob o'chirish havolasini ochganda login ekraniga tushardi — bu relizni
  // rad etish sababi.
  //
  // Katalog sahifalari (`/search`, `/trip/{id}`) shu ro'yxatga 2026-08-02 da
  // qo'shildi: mehmon uchun `/rides/{id}` 401 qaytaradi va aynan shu 401 uni
  // sahifadan uloqtirib yuborardi — mehmon rejimi amalda ishlamas edi.
  if (isPublicPathname(window.location.pathname)) return;

  if (!window.location.pathname.includes('/login')) {
    window.location.href = `/${locale}/login`;
  }
};

/** Muddati shu vaqtdan kam qolgan token OLDINDAN yangilanadi. */
const REFRESH_SKEW_MS = 60_000;

/** Tablararo qulf nomi (`navigator.locks`). */
const REFRESH_LOCK = 'yy-token-refresh';

/** Refresh 5xx/tarmoq bilan yiqilsa — shu vaqtgacha qayta urinmaymiz. */
let cooldownUntil = 0;
const inCooldown = () => Date.now() < cooldownUntil;

/** Tokenning muddati tugashiga qancha qolgani (ms). Aniqlab bo'lmasa `null`. */
const msUntilExpiry = (token: string | null): number | null => {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 - Date.now() : null;
};

/**
 * Amalni tablararo QULF ichida bajaradi.
 *
 * `navigator.locks` — brauzerning o'z mexanizmi, tablar orasida ATOMAR.
 * Bo'lmasa (eski brauzer) amal shunchaki bajariladi va bizni C-himoya
 * (o'zgargan tokenni payqash) qutqaradi.
 */
const withRefreshLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const locks =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { locks?: LockManager }).locks
      : undefined;
  return locks?.request ? (locks.request(REFRESH_LOCK, fn) as Promise<T>) : fn();
};

/** Bitta refresh so'rovi. Muvaffaqiyatda yangi access tokenni saqlab qaytaradi. */
const postRefresh = async (refreshToken: string): Promise<string> => {
  // Toza axios (interceptorsiz), aks holda 401 cheksiz aylanadi.
  // Qurilma headerlari: sessiya `device_id` bilan ochilgan.
  const res = await axios.post(
    `${API_URL}/api/v1/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: deviceHeaders() }
  );
  const body = res.data?.data ?? res.data;
  const access = body?.access_token;
  if (!access) throw new Error("refresh javobida access_token yo'q");
  setTokens(access, body?.refresh_token || refreshToken);
  return access;
};

/**
 * Access tokenni yangilaydi. `null` — sessiya haqiqatan o'lgan yoki
 * vaqtinchalik urinib bo'lmaydi (cooldown).
 *
 * [seenToken] — muammoni keltirib chiqargan (401 bergan yoki muddati
 * tugayotgan) access token. Qulfni olgach saqlangani SHUNDAN farq qilsa,
 * demak boshqa tab allaqachon yangilagan — so'rov umuman yubormaymiz.
 */
const refreshAccessToken = (seenToken: string | null): Promise<string | null> =>
  withRefreshLock(async () => {
    const current = getAccessToken();
    if (current && current !== seenToken) return current;
    if (inCooldown()) return null;

    const used = getRefreshToken();
    if (!used) {
      hardLogout();
      return null;
    }

    try {
      return await postRefresh(used);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;

      // Tarmoq yoki 5xx — token hali yaroqli bo'lishi mumkin, sessiyani
      // SAQLAYMIZ va 10 soniya urinmay turamiz (server tiklansin, loop bo'lmasin).
      if (status !== 400 && status !== 401 && status !== 403) {
        cooldownUntil = Date.now() + 10_000;
        return null;
      }

      // C-himoya: refresh token AYLANADI. Biz ishlatgani o'lgan bo'lishi
      // mumkin, chunki uni boshqa tab (yoki uzilib qolgan oldingi urinish)
      // allaqachon almashtirgan. Saqlangani o'zgargan bo'lsa — bu "sessiya
      // o'ldi" degani EMAS, "kechikdik" degani. Bir marta qayta urinamiz.
      const latest = getRefreshToken();
      if (latest && latest !== used) {
        try {
          return await postRefresh(latest);
        } catch {
          /* ikkinchi urinish ham yiqildi — sessiya rostdan o'lgan */
        }
      }

      hardLogout();
      return null;
    }
  });

api.interceptors.response.use(
  (response) => {
    // Faqat JSON javoblar: `blob`/`arraybuffer` (media yuklash) tegilmaydi.
    if (response.data && typeof response.data === 'object') {
      response.data = deepUnescape(response.data);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Yangilash TABLARARO QULF ichida, bitta nuqtada (izohi yuqorida).
      // Parallel 401 lar shu bitta chaqiruvni kutadi — qulf ularni navbatga
      // qo'yadi, birinchisi yangilaydi, qolganlari tayyor tokenni oladi.
      const seen = originalRequest.headers?.Authorization?.toString().replace(/^Bearer\s+/i, '');
      const token = await refreshAccessToken(seen || getAccessToken());
      if (!token) return Promise.reject(error);

      originalRequest._retry = true;
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
      }
      return api(originalRequest);
    }

    // ===== Global xato-toastlar (skipErrorToast bilan o'chiriladi) =====
    if (typeof window !== 'undefined' && !error.config?.skipErrorToast) {
      // Til URL prefiksidan: interceptor React'dan tashqarida ishlaydi (useLocale yo'q).
      const uiLocale = window.location.pathname.split('/')[1];
      const tr = trFor(uiLocale);

      if (!error.response) {
        // Sof tarmoq xatosi — `id` bilan dedupe: parallel so'rovlar bitta toast ko'rsatadi.
        toast.error(
          tr(
            "Internet aloqasi yo'q yoki server javob bermayapti. Ulanishni tekshirib, qayta urinib ko'ring",
            'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз',
            'No internet connection or the server is not responding. Check your connection and try again'
          ),
          { id: 'network-error' }
        );
      } else if (error.response.status === 400) {
        // Ma'lum backend xatolari foydalanuvchi tiliga o'giriladi (aks holda uz
        // interfeysida inglizcha/ruscha xom matn chiqib, til aralashardi).
        const msg = error.response.data?.message || error.response.data?.error;
        toast.error(
          localizeBackendMessage(msg, uiLocale) ||
            /*
             * 🔴 ICHKI XATODA ODAMNI AYBLAMAYMIZ. «Noto'g'ri so'rov» —
             * ya'ni «siz xato kiritdingiz» degani; server jadvalida ustun
             * yetishmasa esa odam nima kiritsa ham o'tmaydi. U formani
             * qayta-qayta to'ldirib, o'zidan xato izlab o'tiraveradi.
             * (Jonli: 27.08.2026, `cars` jadvalidagi yetishmagan ustun.)
             */
            (isInternalBackendError(msg)
              ? tr(
                  "Serverda vaqtincha nosozlik — bu sizning xatongiz emas. Biroz keyin qayta urinib ko'ring",
                  'Временный сбой на сервере — это не ваша ошибка. Попробуйте немного позже',
                  'A temporary server problem — this is not your fault. Please try again a little later'
                )
              : tr("Noto'g'ri so'rov yuborildi", 'Неверный запрос', 'Invalid request'))
        );
      } else if (error.response.status === 403) {
        const msg = error.response.data?.message || error.response.data?.error;
        toast.error(
          localizeBackendMessage(msg, uiLocale) ||
            tr('Ruxsat etilmagan harakat', 'Доступ запрещен', 'Access denied')
        );
      } else if (error.response.status === 429) {
        toast.error(
          tr(
            "Ko'p so'rov yuborildi, 1 daqiqadan keyin urinib ko'ring",
            'Слишком много запросов, попробуйте через 1 минуту',
            'Too many requests, please try again in a minute'
          ),
          { id: 'rate-limit' }
        );
      } else if ([502, 503, 504].includes(error.response.status)) {
        // Origin javob bermayapti (gateway/tunnel o'chiq) — bu ilova xatosi EMAS, vaqtinchalik
        // uzilish. Umumiy "tizimda xatolik" bu yerda chalg'itadi: foydalanuvchi o'zi noto'g'ri
        // amal qildim deb o'ylaydi va qayta urinmaydi. 2026-07-25/28 jonli holat: /auth/* 502
        // qaytarganda ro'yxatdan o'tolmagan foydalanuvchi sababini bilmasdan ketardi.
        toast.error(
          tr(
            "Server vaqtincha javob bermayapti. Bir necha daqiqadan so'ng qayta urinib ko'ring",
            'Сервер временно недоступен. Попробуйте через несколько минут',
            'The server is temporarily unavailable. Please try again in a few minutes'
          ),
          { id: 'server-unavailable' }
        );
      } else if (error.response.status >= 500) {
        toast.error(
          tr('Tizimda xatolik yuz berdi', 'Произошла системная ошибка', 'A system error occurred'),
          {
            id: 'server-error',
          }
        );
      }
    }

    return Promise.reject(error);
  }
);
