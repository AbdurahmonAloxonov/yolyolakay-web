import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { LOCALES } from '@/shared/lib/i18n';

// 1. Создаем next-intl middleware
// defaultLocale='uz' (2026-07-28): asosiy bozor O'zbekiston va prod domeni `.uz`.
// next-intl avval Accept-Language'ni tekshiradi — ruschа brauzer baribir /ru oladi;
// bu qiymat FAQAT til aniqlanmagan mehmon uchun ishlaydi (ilgari u /ru ga tushardi).
const intlMiddleware = createMiddleware({
  locales: [...LOCALES],
  defaultLocale: 'uz',
  localePrefix: 'always',
});

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api-proxy: brauzer POST/PUT/DELETE (va cross-origin GET) so'rovlarida DOIM `Origin`
  // header yuboradi. Bu yerda uni Referer bilan birga OLIB TASHLAYMIZ — tozalangan so'rov
  // next.config rewrite orqali gateway'ga xuddi server-server chaqiruv kabi boradi.
  //
  // TARIXI: 2026-07-22 da backend oldidagi WAF Origin'li HAR qanday so'rovni 403 bilan
  // rad etardi (hatto GET /health ni ham) — OTP jo'natish brauzerda umuman ishlamasdi.
  //
  // 2026-08-03 QAYTA O'LCHANDI: WAF muammosi TUZATILGAN. 7 ta yo'lda (users/me, tariffs,
  // rides/search, auth/send-otp, auth/verify-otp, auth/login, POST /rides/) Originli va
  // Originsiz javob kodlari BIR XIL. Ya'ni bu blok endi MAJBURIY EMAS.
  //
  // Shunday bo'lsa ham ATAYIN SAQLANADI, chunki uni olib tashlashning foydasi nol,
  // riski esa haqiqiy:
  //   1. Gateway hozir ISTALGAN Origin'ni ko'zi yumib qaytaradi (evil.example.com ham
  //      `access-control-allow-origin: https://evil.example.com` + `allow-credentials: true`
  //      oladi). Bu backend tomonda tuzatilishi kerak bo'lgan sozlama va biz uni
  //      xatda so'radik. Ular allow-list'ni TORAYTIRGANDA ro'yxatga faqat
  //      `yolyolakay.co.uz` tushib qolishi mumkin — o'shanda preview deploy'lar va
  //      tarqatilgan eski `.vercel.app` APK'lari 403 ola boshlaydi.
  //   2. Bu blok aynan o'sha holatdan himoya qiladi: Origin umuman bormasa, allow-list
  //      qanday torayishidan qat'i nazar so'rov o'tadi.
  // Ya'ni biz backenddan CORS'ni qattiqlashtirishni so'rab turib, o'zimizni himoyasiz
  // qoldirmaymiz. Olib tashlamoqchi bo'lsangiz — avval allow-list tarkibini bilib oling.
  if (pathname.startsWith('/api-proxy')) {
    const headers = new Headers(request.headers);
    headers.delete('origin');
    headers.delete('referer');
    return NextResponse.next({ request: { headers } });
  }

  // Игнорируем статические файлы и API-прокси (иначе next-intl добавит /uz|/ru префикс
  // и запрос /api-proxy/... превратится в /uz/api-proxy/... → 404).
  // 2026-07-17: единый gateway — один префикс /api-proxy (покрыт проверкой /api).
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    // Sentry tunnel yo'li (next.config `tunnelRoute`). Locale prefiksi qo'shilsa
    // `/uz/monitoring` bo'lib qolardi va xato hisobotlari 404 ga tushardi.
    pathname.startsWith('/monitoring') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Foydalanuvchi ANIQ tanlagan tili (profil til-almashtirgichi NEXT_LOCALE cookie'ga yozadi)
  // URL prefiksidan USTUN. Eski havola/bookmark/push "/ru/bidding/..." ni ochsa ham,
  // cookie 'uz' bo'lsa — "/uz/bidding/..." ga yo'naltiramiz. Aks holda profildagi til
  // tanlovi deep-link'larda e'tiborsiz qolardi (torgi sahifasi rus chiqardi).
  const prefix = pathname.split('/')[1];
  const preferred = request.cookies.get('NEXT_LOCALE')?.value;
  if (
    LOCALES.includes(prefix as (typeof LOCALES)[number]) &&
    preferred &&
    LOCALES.includes(preferred as (typeof LOCALES)[number]) &&
    preferred !== prefix
  ) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(`/${prefix}`, `/${preferred}`);
    return NextResponse.redirect(url);
  }

  // KIRGAN FOYDALANUVCHINI LOGIN SAHIFASIDAN O'TKAZIB YUBORAMIZ (2026-08-07).
  //
  // MUAMMO: PWA `start_url` = `/login`. Kirgan odam ilovani har ochganda:
  //   `/login` --307--> `/uz/login` --SSR--> JS yuklanadi --> AuthGuard panelga uloqtiradi
  // Ya'ni har ochilishda ortiqcha redirect + BUTUN BIR sahifa serverda render bo'lardi
  // (jonli o'lchov: 307 = 0.36 s, `/uz/login` TTFB sovuqda 1.55 s) va u darhol tashlanardi.
  //
  // Endi buni serverda kesamiz — brauzer login sahifasini UMUMAN ko'rmaydi.
  //
  // Cookie yo'q bo'lsa (24 soatda tugaydi yoki brauzer cheklagan) — hech nima buzilmaydi,
  // eski xatti-harakat qaytadi. `refreshAuthCookie` uni tirik ushlab turadi.
  // Sikl xavfi `clearAuthCookie` bilan yopilgan — `shared/lib/token.ts` izohiga qarang.
  const segments = pathname.split('/').filter(Boolean);
  const hasLocalePrefix = LOCALES.includes(segments[0] as (typeof LOCALES)[number]);
  const cleanPath = '/' + (hasLocalePrefix ? segments.slice(1) : segments).join('/');

  if (cleanPath === '/login' && request.cookies.get('access_token')?.value) {
    const locale = hasLocalePrefix
      ? segments[0]
      : preferred && LOCALES.includes(preferred as (typeof LOCALES)[number])
        ? preferred
        : 'uz';
    // Rol cookie'si `shared/model/uiStore.ts` da yoziladi; bo'lmasa yo'lovchi (default).
    const home = request.cookies.get('yy_role')?.value === 'driver' ? 'dashboard' : 'search';
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/${home}`;
    return NextResponse.redirect(url);
  }

  // Возвращаем результат next-intl middleware (которая добавляет локаль в заголовки/редиректит)
  return intlMiddleware(request);
}

export const config = {
  // /api-proxy — Origin header'ni tozalash uchun ATAYLAB kiritilgan (aks holda umumiy
  // matcher `api`ni chetlab o'tardi). Qolgan sahifalar uchun eski matcher.
  matcher: ['/api-proxy/:path*', '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
