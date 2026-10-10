export const setTokens = (accessToken: string | undefined, refreshToken: string | undefined) => {
  if (typeof window !== 'undefined') {
    // HTTPS'da (prod) cookie faqat shifrlangan kanaldan yuborilsin — Secure bayrog'i.
    // Lokal http dev'da Secure qo'yilsa brauzer cookie'ni umuman saqlamaydi.
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    if (accessToken && accessToken !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      document.cookie = `access_token=${accessToken}; path=/; max-age=86400; SameSite=Lax${secure}`;
    }
    if (refreshToken && refreshToken !== 'undefined') {
      localStorage.setItem('refresh_token', refreshToken);
      document.cookie = `refresh_token=${refreshToken}; path=/; max-age=2592000; SameSite=Lax${secure}`;
    }
  }
};

/**
 * `access_token` cookie'sining umrini uzaytiradi (localStorage'da token borligi
 * aniqlanganda chaqiriladi).
 *
 * NEGA KERAK: cookie 24 soatda tugaydi, localStorage esa uzoq yashaydi. Cookie
 * `proxy.ts` dagi "kirgan odamni login sahifasiga kirgizmaslik" optimizatsiyasining
 * YAGONA server-tomon signali — u tugab qolsa, optimizatsiya jim o'chib qolardi va
 * har ochilishda yana ortiqcha redirect + login SSR qaytardi.
 */
export const refreshAuthCookie = (): void => {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('access_token');
  if (!token) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `access_token=${token}; path=/; max-age=86400; SameSite=Lax${secure}`;
};

/**
 * FAQAT `access_token` cookie'sini o'chiradi (localStorage tegilmaydi).
 *
 * 🔴 REDIRECT SIKLINING OLDINI OLADI. `proxy.ts` cookie bo'lsa `/login` dan
 * panelga yuboradi; `AuthGuard` esa localStorage'da token bo'lmasa `/login` ga
 * qaytaradi. Ikkalasi rost bo'lib qolsa (cookie bor, localStorage bo'sh — masalan
 * odam localStorage'ni qo'lda tozalasa) brauzer CHEKSIZ aylanardi.
 * Shuning uchun tokensiz login'ga qaytishdan OLDIN cookie ham o'chiriladi.
 */
export const clearAuthCookie = (): void => {
  if (typeof window === 'undefined') return;
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
};

export const getAccessToken = () => {
  if (typeof window !== 'undefined') {
    // localStorage — token uchun ASOSIY manba. Cookie'ni TALAB qilmaymiz: cookie 24 soatda
    // tugaydi (yoki inkognito/brauzer sozlamalarida cheklanadi), bunda token localStorage'da
    // bo'lsa ham foydalanuvchi "chiqib ketgandek" bo'lib, qidiruv/so'rovlar o'chib qolardi.
    // Token eskirgan bo'lsa — axios refresh-interceptor uni yangilaydi yoki logout qiladi.
    return localStorage.getItem('access_token');
  }
  return null;
};

export const getRefreshToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('refresh_token');
  }
  return null;
};

export const clearTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    // Clear cookies for Next.js Middleware
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
};

// ===== Lokal ism zaxirasi =====
// Backend name'ni kechiktirib qaytarganda profil bo'sh ko'rinmasligi uchun fallback.
// MUHIM: yozishda DOIM trim — bo'sh/" " qiymat bilan haqiqiy ismni ezib yubormaslik
// uchun (shu bug bir marta bo'lgan). Kalit va qoida faqat shu yerda yashaydi.
const USER_NAME_KEY = 'user_name';

export const getStoredUserName = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(USER_NAME_KEY) || '';
};

export const setStoredUserName = (name: string | null | undefined): void => {
  if (typeof window === 'undefined') return;
  const trimmed = (name ?? '').trim();
  if (trimmed) localStorage.setItem(USER_NAME_KEY, trimmed);
};

export const clearStoredUserName = (): void => {
  if (typeof window !== 'undefined') localStorage.removeItem(USER_NAME_KEY);
};

// ===== Foydalanuvchi ID =====
// Yangi backend'da `GET /users/me` YO'Q (faqat `GET /users/{id}`), TokenResponse ham
// id qaytarmaydi — o'z id'ni JWT'dan (claim) olamiz. WS `?user_id=`, `GET /users/{id}`,
// reyting reviewer_id ham shundan. Har xil backend claim nomlari uchun himoyalangan.
const USER_ID_KEY = 'user_id';

/**
 * JWT payload'ini (claim'lar) xavfsiz dekod qiladi. MUHIM: JWT base64url ishlatadi
 * (`-`/`_` belgilar bilan) — oddiy `atob` bunday token'da yiqiladi, shuning uchun avval
 * base64'ga o'giramiz va UTF-8'ni to'g'ri tiklaymiz. Yaroqsiz token -> null.
 */
export const decodeJwtPayload = (token?: string | null): Record<string, any> | null => {
  const t = token ?? getAccessToken();
  if (!t) return null;
  try {
    const part = t.split('.')[1];
    if (!part) return null;
    return JSON.parse(
      decodeURIComponent(
        atob(part.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    );
  } catch {
    return null;
  }
};

export const decodeUserIdFromToken = (token?: string | null): string | null => {
  const json = decodeJwtPayload(token);
  if (!json) return null;
  const id = json.user_id ?? json.sub ?? json.uid ?? json.id ?? json.userId;
  return id ? String(id) : null;
};

export const getStoredUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_ID_KEY) || decodeUserIdFromToken();
};

export const setStoredUserId = (id: string | null | undefined): void => {
  if (typeof window === 'undefined') return;
  if (id) localStorage.setItem(USER_ID_KEY, String(id));
};

export const clearStoredUserId = (): void => {
  if (typeof window !== 'undefined') localStorage.removeItem(USER_ID_KEY);
};
