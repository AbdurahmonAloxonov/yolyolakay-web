'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Star, CalendarDays, Car, ShieldCheck, ArrowLeft } from 'lucide-react';
import { ReviewsSection } from '@/shared/ui/ReviewsSection';
import { MyRoadsMap } from '@/shared/ui/MyRoadsMap';
import { TrustLadder } from '@/shared/ui/TrustLadder';
import Link from 'next/link';
import { getUser } from '@/shared/api/users';
import { Avatar } from '@/shared/ui/Avatar';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useTr } from '@/shared/lib/useTr';
import { personName, formatTripDateTime } from '@/shared/lib/format';

/**
 * 🔴 NEGA KERAK: haydovchi saytda ham o'lik nuqta edi — qidiruvda ism va
 * yulduzcha ko'rinardi, lekin ustiga bosib bo'lmasdi. Bron qilish qarori
 * esa aynan "bu kim?" degan savolga tayanadi.
 *
 * ⚠️ BU YERDA HECH NIMA TO'QIB CHIQARILMAYDI. Backend "safarlar soni" yoki
 * "javob berish tezligi" kabi ma'lumotlarni BERMAYDI — ular ishonchni
 * oshirsa ham, yo'q raqamni chizib qo'yish yolg'on bo'lardi. Maydon
 * kelmasa, qator umuman ko'rsatilmaydi.
 */
export default function UserProfileClient({ id }: { id: string }) {
  const locale = useLocale();
  const tr = useTr();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-user', id],
    enabled: !!id,
    queryFn: () => getUser(id),
  });

  const name =
    personName(user as Parameters<typeof personName>[0]) ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    tr('Haydovchi', 'Водитель', 'Driver');

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md space-y-6">
        <Link
          href={`/${locale}/search`}
          className="inline-flex items-center gap-2 text-sm font-bold text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
          <span>{tr('Orqaga', 'Назад', 'Back')}</span>
        </Link>

        {isLoading ? (
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
            <Skeleton className="mx-auto h-24 w-24 rounded-full" />
            <Skeleton className="mx-auto h-6 w-40" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError || !user ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-text-muted">
            {tr('Profil topilmadi', 'Профиль не найден', 'Profile not found')}
          </div>
        ) : (
          <div className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Avatar src={user.avatar_url} name={name} seed={user.id} size={96} />
              <h1 className="text-2xl font-extrabold text-text">{name}</h1>
            </div>

            <dl className="divide-y divide-border/60 border-y border-border/60">
              {/* Reyting — baholar SONI bilan. Son bo'lmasa reyting yolg'on
                  ishonch beradi: bitta besh ballik baho "5.0" bo'lib ko'rinadi. */}
              {(user.rating ?? 0) > 0 && (
                <div className="flex items-center gap-3 py-3">
                  <Star className="h-5 w-5 shrink-0 text-warning" fill="var(--warning)" />
                  <div>
                    <dt className="text-sm font-bold text-text">
                      {(user.rating as number).toFixed(1)}
                    </dt>
                    <dd className="text-xs text-text-muted">
                      {tr(
                        `${user.rating_count ?? 0} baho`,
                        `${user.rating_count ?? 0} оценок`,
                        `${user.rating_count ?? 0} ratings`
                      )}
                    </dd>
                  </div>
                </div>
              )}

              {user.created_at && (
                <div className="flex items-center gap-3 py-3">
                  <CalendarDays className="h-5 w-5 shrink-0 text-accent" />
                  <div>
                    <dt className="text-sm font-bold text-text">
                      {formatTripDateTime(user.created_at).split(',')[0]}
                    </dt>
                    <dd className="text-xs text-text-muted">
                      {tr("Ro'yxatdan o'tgan", 'На платформе с', 'Member since')}
                    </dd>
                  </div>
                </div>
              )}

              {user.role === 'driver' && (
                <div className="flex items-center gap-3 py-3">
                  <Car className="h-5 w-5 shrink-0 text-accent" />
                  <dt className="text-sm font-bold text-text">
                    {tr('Haydovchi', 'Водитель', 'Driver')}
                  </dt>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* ISHONCH NARVONI — tarqoq dalillar (reyting, baholar soni,
            hisob yoshi) o'rniga bitta javob. Ilovada bor edi, saytda yo'q.
            Izohi `shared/lib/trust.ts` da. */}
        <TrustLadder user={user} />

        {/* ODATDAGI YO'LLARI — 16.09.2026.

            🔴 Yo'lovchi haydovchi profilini ochganda «bu odam bu yo'lni
            muntazam yuradimi?» degan savolga javob yo'q edi: reyting bor,
            sharh bor, YO'L yo'q. Bu ishonch uchun sharhdan kam emas —
            muntazam yuradigan odam tasodifiy haydovchi emas.

            ✅ Ruchka 16.09.2026 da ochildi va o'lchandi: mehmonga ham
            200, javobda faqat marshrut/vaqt/narx/holat — yo'lovchi,
            telefon va bron YO'Q. Safari bo'lmasa karta umuman
            chizilmaydi. Izohi `MyRoadsMap` da. */}
        {user?.id && <MyRoadsMap driverId={String(user.id)} />}

        {/* SHARHLAR — reyting raqamining ORTIDA nima turgani.
            Shu paytgacha bu sahifada faqat «4.9» va baholar soni turardi;
            odam izoh yozardi va u hech qayerda ko'rinmasdi. */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <ReviewsSection userId={user?.id} />
        </div>
      </div>
    </div>
  );
}
