import type { Metadata } from 'next';
import { trFor } from '@/shared/lib/i18n';

/**
 * `/search` uchun alohida metadata.
 *
 * Sahifaning O'ZI `'use client'` (filtrlar, xarita, React Query) — klient komponenti
 * `metadata` eksport qila olmaydi. Shuning uchun ustiga shu yupqa server layout
 * qo'yiladi: u faqat sarlavha/tavsif beradi va bolani o'zgarishsiz render qiladi.
 *
 * Ilgari kerak emas edi — sahifa login ortida turgani uchun umuman indekslanmasdi.
 * 2026-08-02 dan mehmonga ochiq (routes.ts BROWSE_PATHS), demak endi u qidiruv
 * natijalarida landing bilan BIR XIL sarlavha bilan chiqmasligi kerak.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tr = trFor(locale);

  const title = tr(
    "Safar qidirish — O'zbekiston bo'ylab hamroh",
    'Поиск поездок по Узбекистану',
    'Find a ride — carpooling across Uzbekistan'
  );
  const description = tr(
    "Yo'nalish va sanani tanlab, hamroh haydovchilarni toping. Narxni solishtiring va yo'l xarajatini bo'ling.",
    'Выберите маршрут и дату, найдите попутчиков. Сравните цены и разделите расходы на дорогу.',
    'Pick a route and date to find drivers going your way. Compare prices and split travel costs.'
  );

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/search`,
      // Root layout'dagi `languages` ildizga (`/uz`) ko'rsatadi — bu yerda uni
      // AYNAN shu sahifaga qayta yozamiz, aks holda uzbekcha qidiruv sahifasidan
      // ruschasiga o'tish havolasi landing'ga olib borardi.
      languages: {
        uz: '/uz/search',
        ru: '/ru/search',
        en: '/en/search',
        'x-default': '/uz/search',
      },
    },
    openGraph: { title, description, url: `/${locale}/search`, type: 'website' },
  };
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
