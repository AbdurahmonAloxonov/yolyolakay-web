'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useProfile } from '@/entities/user/api/useProfile';
import { LOCALES } from '@/shared/lib/i18n';

/**
 * No-show (kelmaslik) bloki: agar backend foydalanuvchining `timeout_until` (vaqtinchalik blok
 * tugash vaqti) ni KELAJAKDAGI vaqtga o'rnatgan bo'lsa — foydalanuvchini `Pit-stop` sahifasiga
 * majburan yo'naltiramiz (u yerda qolgan vaqt hisoblanadi).
 *
 * MUHIM: `timeout_until` bo'sh/o'tган bo'lsa HECH NARSA qilinmaydi — oddiy foydalanuvchiga ta'sir yo'q.
 * (Backend chegара oshganда `tariff.timeout_until` ni o'rnatishi bilan avtomatik ishlaydi.)
 *
 * Hech narsa render qilmaydi. Providers ichida (react-query ostida) mount qilinadi.
 */
export function NoShowGuard() {
  const { data: profile } = useProfile();
  const pathname = usePathname();
  const router = useRouter();

  const timeoutUntil = profile?.timeout_until;

  useEffect(() => {
    if (!timeoutUntil) return;
    const until = new Date(timeoutUntil).getTime();
    // Yaroqsiz sana yoki allaqachon o'tган — blok yo'q.
    if (Number.isNaN(until) || until <= Date.now()) return;

    const parts = pathname.split('/');
    const locale =
      parts.length > 1 && LOCALES.includes(parts[1] as (typeof LOCALES)[number]) ? parts[1] : 'uz';
    const cleanPath = '/' + parts.slice(2).join('/');

    // Pit-stop va login sahifalarida yo'naltirmaymiz (aylanma / kirishni bloklamaslik uchun).
    if (cleanPath.startsWith('/pit-stop') || cleanPath.startsWith('/login')) return;

    router.replace(`/${locale}/pit-stop`);
  }, [timeoutUntil, pathname, router]);

  return null;
}
