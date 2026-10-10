import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { fetchRideForMetadata } from '@/shared/api/server/rides';
import { asLang, pickFor, trFor, type Lang, intlTag } from '@/shared/lib/i18n';
import { formatCurrency } from '@/shared/lib/format';
import TripDetailClient from './TripDetailClient';

/**
 * Safar sahifasi — SERVER qobig'i (tafsilotlarni mijoz komponenti chizadi).
 *
 * NEGA QOBIQ KERAK BO'LDI (2026-08-09 jonli o'lchov):
 *   `/uz/trip/<istalgan-id>` **200** qaytarardi, `robots: index, follow` bilan va
 *   HTML'da faqat "Yuklanmoqda..." matni turardi — ya'ni
 *     1) mavjud BO'LMAGAN safar ham indekslanadigan sahifa edi (soft-404):
 *        bot o'ylab topgan har bir id uchun bo'sh sahifa,
 *     2) MAVJUD safarning ham sarlavhasi/tavsifi umumiy sayt matni edi, ya'ni
 *        marketpleysning asosiy kontenti qidiruvda umuman ko'rinmasdi.
 *
 * Ikkalasi ham shu yerda yopiladi: `generateMetadata` yo'nalishni sarlavhaga
 * chiqaradi, `notFound()` esa haqiqiy 404 beradi.
 *
 * Bu 2026-08-09 gacha MUMKIN EMAS edi: `GET /rides/{id}` tokensiz `401` qaytarardi.
 * Endi ochiq (`404 "ride not found"`), tafsilot: `shared/api/server/rides.ts`.
 */

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** "Toshkent → Samarqand" ko'rinishi; manzillar bo'sh bo'lsa null. */
function routeLabel(from?: string, to?: string): string | null {
  const a = (from || '').trim();
  const b = (to || '').trim();
  if (!a || !b) return null;
  return `${a} → ${b}`;
}

/**
 * Sanani tilga mos qisqa ko'rinishda.
 *
 * Vaqt zonasi ANIQ berilgan (Asia/Tashkent): serverning zonasi qanday bo'lishidan
 * qat'i nazar sarlavhadagi sana foydalanuvchi ko'radigan sana bilan bir xil bo'lsin.
 */
function shortDate(iso: string | undefined, locale: Lang): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // ⚠️ `pickFor` EMAS: u kirill uchun o'zbekcha qiymatni (`uz-UZ`)
  // qaytaradi va kirill sahifada oy nomi lotinda chiqib qolardi.
  const tag = intlTag(locale);
  try {
    return new Intl.DateTimeFormat(tag, {
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Tashkent',
    }).format(d);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale = asLang(rawLocale);
  const tr = trFor(locale);
  const result = await fetchRideForMetadata(id);

  // Safar yo'q (yoki backend javob bermadi) — sahifani indeksga BERMAYMIZ.
  // `unavailable` da ham noindex: o'tkinchi uzilish paytida bot kelib qolsa,
  // bo'sh sahifa indeksga tushib qolmasin.
  if (result.kind !== 'ok') {
    return {
      title: tr('Safar topilmadi', 'Поездка не найдена', 'Trip not found'),
      robots: { index: false, follow: false },
    };
  }

  const ride = result.ride;
  const route = routeLabel(ride.origin_address, ride.destination_address);
  const date = shortDate(ride.departure_time, locale);
  const price = Number.isFinite(ride.price_per_seat)
    ? formatCurrency(ride.price_per_seat, locale)
    : null;

  // Brend nomi QO'SHILMAYDI: ildiz layout'ida `template: '%s — YolYolakay'` bor,
  // ya'ni u o'zi qo'shiladi (aks holda "… | YolYolakay — YolYolakay" chiqadi).
  const title = route
    ? `${route}${date ? `, ${date}` : ''} — ${tr('hamroh', 'попутчики', 'rideshare')}`
    : tr('Safar', 'Поездка', 'Trip');

  const seats = ride.available_seats;
  const description = [
    route,
    date,
    price ? tr(`${price} / o'rin`, `${price} / место`, `${price} per seat`) : null,
    typeof seats === 'number'
      ? tr(`${seats} ta bo'sh o'rin`, `свободных мест: ${seats}`, `${seats} seats available`)
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  /*
   * JO'NAB KETGAN SAFAR INDEKSGA TUSHMAYDI (10.09.2026).
   *
   * 🔴 NEGA: backend jo'nash vaqti o'tgan safarni hamon `active` deb
   * qaytaradi, sahifa esa `index, follow` bilan chiqardi. Ya'ni
   * "Toshkent → Samarqand, 4-sentabr" sahifasi Google indeksiga tushib,
   * u yerda ABADIY qolardi: noyabrda qidirgan odam sentabrdagi safarni
   * topib, ustiga "Jo'nab ketdi" yozuvini ko'radi. Google uchun bular —
   * eskirgan, yupqa sahifalar to'plami (soft-404 xavfi), odam uchun esa
   * ishonchni yo'qotadigan birinchi uchrashuv.
   *
   * `follow` SAQLANADI: sahifadagi haydovchi profili va qidiruv
   * havolalari bo'yicha bot yurishda davom etsin — biz faqat SHU
   * sahifani ro'yxatdan chiqaryapmiz, uni tupikka aylantirmayapmiz.
   *
   * Chegara qidiruvdagi bilan BIR XIL (`SearchFilters.lateGrace` /
   * `LATE_GRACE_MS`): natijalarda ko'rinmaydigan safar indeksda ham
   * turmasligi kerak.
   */
  const departedAt = ride.departure_time ? new Date(ride.departure_time).getTime() : NaN;
  const departed = !Number.isNaN(departedAt) && departedAt < Date.now() - 3 * 60 * 60 * 1000;

  return {
    title,
    description:
      description ||
      tr(
        "Yo'l-yo'lakay hamroh toping",
        'Найдите попутчиков в дорогу',
        'Find travel companions on your route'
      ),
    ...(departed ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, type: 'article' },
  };
}

export default async function TripDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await fetchRideForMetadata(id);

  // Backend ANIQ "yo'q" desa — haqiqiy 404. `unavailable` da esa sahifani
  // ko'rsatamiz: uzilishni "safar o'chirilgan" deb ko'rsatish yolg'on bo'lardi
  // va mavjud sahifa qidiruvdan tushib ketardi.
  if (result.kind === 'not-found') notFound();

  // Server topgan safar mijozga BOSHLANG'ICH ma'lumot bo'lib beriladi: HTML'da
  // darhol haqiqiy matn turadi (Google ham, foydalanuvchi ham spinner ko'rmaydi),
  // mijoz esa keyin o'zi yangilab oladi.
  return <TripDetailClient id={id} initialTrip={result.kind === 'ok' ? result.ride : null} />;
}
