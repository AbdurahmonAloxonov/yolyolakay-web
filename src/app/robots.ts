import type { MetadataRoute } from 'next';
import { LOCALES, PRIVATE_PATHS } from '@/shared/lib/routes';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yolyolakay-frontend.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Shaxsiy/auth ortidagi sahifalar indekslanmasin.
      //
      // 🔴 2026-08-02 da tuzatilgan bug: ro'yxat locale PREFIKSISIZ yozilgan edi
      // (`/profile`, `/chat`, …). Saytda esa prefiks DOIM bor — `/uz/profile`,
      // `/ru/profile` — ya'ni birorta qoida hech narsaga mos kelmasdi va yopilgan
      // deb o'ylangan sahifalar aslida ochiq turardi.
      //
      // Prefikssiz variantni ham qoldiramiz: locale'siz URL prefiksliga redirect
      // bo'ladi, lekin robots.txt redirectgacha o'qiladi.
      disallow: [
        '/api/',
        '/api-proxy/',
        // Sentry tunnel (next.config `tunnelRoute`) — sahifa emas, indekslanmasin.
        '/monitoring',
        ...PRIVATE_PATHS,
        ...LOCALES.flatMap((l) => PRIVATE_PATHS.map((p) => `/${l}${p}`)),
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
