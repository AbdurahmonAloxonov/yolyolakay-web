import type { MetadataRoute } from 'next';
import { LOCALES } from '@/shared/lib/i18n';
import { fetchOpenRideIds } from '@/shared/api/server/rides';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yolyolakay-frontend.vercel.app';

/**
 * Sitemap soatiga bir marta qayta yig'iladi.
 *
 * Safarlar ro'yxati backenddan olinadi, ya'ni bu sahifa statik BO'LA OLMAYDI;
 * lekin har bot so'roviga backendni urish ham kerak emas — safarlar soati bilan
 * o'zgaradi, daqiqasi bilan emas.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public sahifalar (auth ortidagilar kiritilmaydi).
  // `/search` — 2026-08-02 dan mehmonga ochiq (routes.ts BROWSE_PATHS); ilgari u
  // login ortida edi va sitemap'ga qo'shish Google'ni bo'sh spinnerga olib borardi.
  // `/map` — «Xarita» bo'limi (17.09.2026), mehmonga ochiq.
  const routes = ['', '/map', '/search', '/login', '/privacy', '/terms', '/account-delete'];
  const now = new Date();

  const staticEntries = LOCALES.flatMap((locale) =>
    routes.map((route) => ({
      url: `${SITE_URL}/${locale}${route}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1 : route === '/search' || route === '/map' ? 0.9 : 0.6,
    }))
  );

  /*
   * Safar sahifalari — 2026-08-09 dan qo'shildi.
   *
   * Ilgari bu yerda "backend ochiq ro'yxat bergandan keyin" degan izoh turardi:
   * `GET /rides/{id}` tokensiz 401 qaytarardi, ya'ni safar sahifasi mehmonga ham,
   * Google'ga ham yopiq edi. Endi u ochiq va sahifada haqiqiy SSR kontent bor —
   * demak ular indekslanishi MUMKIN va KERAK (marketpleysning asosiy kontenti).
   *
   * Ro'yxat qidiruv orqali yig'iladi: backendda "hamma safarlar" endpointi YO'Q,
   * `GET /rides/search` esa jo'nash/manzil koordinatasini MAJBURIY talab qiladi.
   * Shuning uchun bir nechta keng radiusli yo'nalish bo'yicha so'rab, id'larni
   * birlashtiramiz. Backend javob bermasa — sitemap statik qismi bilan chiqadi
   * (bo'sh sitemap qaytarish mavjud sahifalarni indeksdan chiqarib yuborardi).
   */
  const rideIds = await fetchOpenRideIds();
  const rideEntries = rideIds.flatMap((id) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}/${locale}/trip/${id}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }))
  );

  return [...staticEntries, ...rideEntries];
}
