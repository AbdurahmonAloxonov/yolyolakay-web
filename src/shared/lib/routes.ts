/**
 * Yo'l tahlili — AuthGuard va API interceptor IKKALASI uchun yagona manba.
 *
 * Ikki joyda alohida ro'yxat bo'lgani muammo tug'dirgan edi: AuthGuard huquqiy
 * sahifalarni ochiq deb bilardi, `client.ts` dagi `hardLogout()` esa bilmasdi va
 * 401 kelishi bilan foydalanuvchini login'ga otib yuborardi — natijada
 * `/privacy`, `/terms` sahifalari amalda login ortida qolgan edi.
 */

/** Saytdagi tillar — YAGONA manba `shared/lib/i18n.ts` da (uz/ru/en). */
export { LOCALES } from './i18n';

/** Locale prefiksini olib tashlaydi: "/uz/terms" -> "/terms". */
export const stripLocale = (pathname: string): string =>
  '/' + pathname.split('/').slice(2).join('/');

/**
 * Login TALAB QILINMAYDIGAN sahifalar.
 *
 * `/account-delete` — Google Play majburiy talabi: hisob o'chirish sahifasi
 * ilovasiz va kirmasdan ochilishi shart, moderator uni brauzerda tekshiradi.
 * Maxfiylik siyosati ham shunday — ikkalasi ham login ortiga tushib qolmasin.
 */
export const LEGAL_PATHS = ['/privacy', '/terms', '/account-delete'] as const;

/**
 * KO'RISH uchun login talab qilinmaydigan katalog sahifalari (mehmon rejimi).
 *
 * Ikkalasi ham `(public)` route-guruhida yotadi, ya'ni ATAYIN ochiq deb
 * mo'ljallangan edi — lekin AuthGuard ularni himoyalangan deb bilardi va mehmonni
 * login'ga otib yuborardi. Oqibati ikki tomonlama edi:
 *   1) SSR HTML faqat spinner bo'lardi (`/uz/search` -> 19 KB HTML, matn YO'Q),
 *      ya'ni Google marketpleysning asosiy kontentini umuman ko'rmasdi;
 *   2) yangi mehmon ro'yxatdan o'tmasdan bironta e'lonni ko'ra olmasdi.
 *
 * Amallar (bron, torg, chat) baribir login ortida qoladi — ular `/bidding`,
 * `/chat` kabi himoyalangan yo'llarda.
 */
/*
 * `/user` MEHMONGA ochiq: haydovchi profili qidiruv va safar sahifasidan
 * ochiladi, ikkalasi ham mehmonga ochiq. Uni login ortiga qo'ysak, "bu kim?"
 * degan savol devorga urilardi — aynan bron qilishdan OLDIN.
 *
 * ⚠️ Ma'lumotning O'ZI baribir tokenga bog'liq (`GET /users/{id}` mehmonga
 * 401 beradi) — sahifa buni ochiq aytadi, bo'sh ekran ko'rsatmaydi.
 */
/*
 * `/map` — «Xarita» bo'limi (17.09.2026). Mehmonga ATAYIN ochiq: u
 * platformada QAYSI shaharlar borligini ko'rsatadigan yagona joy va
 * ro'yxatdan o'tmagan odam uchun eng foydali sahifa. Qidiruv natijalari
 * ham mehmonga ochiq (`/rides/search` token talab qilmaydi), faqat
 * mashhur yo'nalishlar ko'rinmaydi (`/rides/recommendations` → 401).
 */
export const BROWSE_PATHS = ['/search', '/trip', '/user', '/map'] as const;

/**
 * Login ORTIDAGI sahifalar — `robots.txt` uchun.
 *
 * DIQQAT: AuthGuard bu ro'yxatni ISHLATMAYDI — u teskari mantiqda ishlaydi
 * ("ochiq bo'lmagan hamma narsa himoyalangan"), shuning uchun yangi himoyalangan
 * sahifa qo'shilsa u avtomatik yopiladi. Bu ro'yxat esa faqat qidiruv robotlariga
 * aytish uchun kerak va QO'LDA yangilanadi: yangi shaxsiy bo'lim qo'shsangiz
 * shu yerga ham qo'shing, aks holda u indeksga tushib ketadi.
 *
 * Ro'yxat manbai: `find src/app/[locale] -name page.tsx` (2026-08-02 holati),
 * `(public)`/`(auth)` guruhlaridagilar chiqarib tashlangan.
 */
export const PRIVATE_PATHS = [
  '/bidding',
  '/chat',
  '/chats',
  '/dashboard',
  '/driver',
  '/history',
  '/notifications',
  '/parcels',
  '/payment',
  '/pit-stop',
  '/profile',
  '/tariffs',
] as const;

/** Berilgan (locale'siz) yo'l huquqiy sahifamı. */
export const isLegalPath = (cleanPath: string): boolean =>
  LEGAL_PATHS.some((p) => cleanPath.startsWith(p));

/** Berilgan (locale'siz) yo'l login talab qilmaydigan sahifamı (huquqiy + katalog). */
export const isPublicPath = (cleanPath: string): boolean =>
  isLegalPath(cleanPath) ||
  BROWSE_PATHS.some((p) => cleanPath === p || cleanPath.startsWith(`${p}/`));

/** To'liq pathname bo'yicha tekshiruv (locale prefiksi bilan). */
export const isLegalPathname = (pathname: string): boolean => isLegalPath(stripLocale(pathname));

/** To'liq pathname bo'yicha tekshiruv (locale prefiksi bilan). */
export const isPublicPathname = (pathname: string): boolean => isPublicPath(stripLocale(pathname));
