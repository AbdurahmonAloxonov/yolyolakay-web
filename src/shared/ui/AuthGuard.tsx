'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAccessToken, refreshAuthCookie, clearAuthCookie } from '@/shared/lib/token';
import { useUIStore } from '@/shared/model/uiStore';
import { isPublicPath } from '@/shared/lib/routes';
import { LOCALES } from '@/shared/lib/i18n';

/* Yo'lni tahlil qilish — render paytida ham (SSR'da ham) ishlaydi, effekt kutilmaydi. */
function routeInfo(pathname: string) {
  const pathParts = pathname.split('/');
  const locale =
    pathParts.length > 1 && LOCALES.includes(pathParts[1] as (typeof LOCALES)[number])
      ? pathParts[1]
      : 'uz';
  const cleanPath = '/' + pathParts.slice(2).join('/');

  const isLanding = cleanPath === '/' || cleanPath === '';
  const isAuth =
    cleanPath.startsWith('/login') ||
    cleanPath.startsWith('/register') ||
    cleanPath.startsWith('/verify');
  // Huquqiy sahifalar (maxfiylik/shartlar/hisob o'chirish) va katalog sahifalari
  // (`/search`, `/trip/{id}`) — hamma uchun ochiq. Ro'yxat shared/lib/routes.ts da,
  // chunki API interceptor'i (hardLogout) ham AYNAN shu ro'yxatga tayanadi.
  const isPublic = isPublicPath(cleanPath);

  return { locale, isLanding, isAuth, isPublicRoute: isLanding || isAuth || isPublic };
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeRole = useUIStore((s) => s.activeRole);
  const { isPublicRoute } = routeInfo(pathname);

  // MUHIM (landing "ishlamayapti" sababi edi): OCHIQ sahifalar (landing, login, huquqiy)
  // hech qachon spinner ortida turmaydi. Ilgari isChecking=true bilan boshlanardi va
  // kontent FAQAT hidratsiyadan keyin, useEffect ishlagach chiqardi — sekin tarmoq yoki
  // WebView'da sahifa uzoq vaqt (ba'zan umuman) bo'sh spinner bo'lib qolardi, SSR HTML'da
  // esa landing matni umuman yo'q edi (SEO ham yo'qolardi). Endi ochiq sahifa DARHOL
  // ko'rinadi; token tekshiruvi faqat himoyalangan sahifalarni ushlab turadi.
  const [isChecking, setIsChecking] = useState(!isPublicRoute);

  useEffect(() => {
    const { locale, isLanding, isAuth, isPublicRoute: isPublic } = routeInfo(pathname);
    const token = getAccessToken();

    // Cookie'ni tirik ushlab turamiz: u `proxy.ts` dagi "login sahifasini o'tkazib
    // yuborish" optimizatsiyasining yagona server-tomon signali (24 soatda tugaydi).
    if (token) refreshAuthCookie();

    if (!token && !isPublic) {
      // 🔴 Cookie AVVAL o'chiriladi: aks holda proxy bizni panelga, biz esa uni
      // login'ga qaytarib CHEKSIZ sikl hosil bo'lardi (token.ts izohiga qarang).
      clearAuthCookie();
      router.replace(`/${locale}/login`);
    } else if (token && (isAuth || isLanding)) {
      // Tizimga kirgan foydalanuvchi auth/landing'ga kelsa — rolga qarab yo'naltiramiz.
      const home = activeRole === 'driver' ? `/${locale}/dashboard` : `/${locale}/search`;
      router.replace(home);
    } else {
      setIsChecking(false);
    }
  }, [pathname, router, activeRole]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  return <>{children}</>;
}
