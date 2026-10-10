'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Clock } from 'lucide-react';
import { getUser } from '@/shared/api/users';
import { isKycApproved } from '@/shared/lib/trust';
import { useTr } from '@/shared/lib/useTr';

/**
 * YO'LOVCHI HAQIDA HAYDOVCHIGA — «kimni olayapman».
 *
 * 🔴 NEGA KERAK (raqobat tahlili, 2026-08-27): Yoldosh haydovchini HAM,
 * yo'lovchini HAM tasdiqlashini ochiq reklama qiladi. Bizda haydovchi
 * bron so'rovida faqat ism va avatar ko'rardi — yangi akkauntda esa
 * odam haqida aytadigan hech narsa qolmasdi.
 *
 * ✅ 2026-08-27 (kechqurun): backend `PassengerProfile` ga `kyc_status`
 * va `created_at` ni QO'SHDI — biz aynan shuni so'ragandik. Ya'ni odatda
 * ma'lumot BRONNING O'ZIDA keladi va qo'shimcha so'rov KETMAYDI.
 *
 * ⚠️ `GET /users/{id}` zaxira sifatida QOLDIRILDI: eski keshdagi
 * javoblarda bu maydonlar yo'q va ular yangilanmaguncha nishon jimgina
 * yo'qolib turardi.
 *
 * ⚠️ TASDIQLANMAGANDA HECH NIMA CHIZILMAYDI. «Tasdiqlanmagan» yozuvi
 * AYBLOV bo'lardi: bizda yo'lovchi uchun tekshiruv oqimi umuman yo'q,
 * ya'ni odam uni O'TA OLMAYDI ham. Yo'qlik dalil emas.
 *
 * Mobil ekvivalenti: `lib/features/rides/passenger_trust.dart`.
 */

/** Backend nomlari turlicha bo'lishi mumkin — DENY-list emas, aniq ro'yxat
 *  bo'yicha faqat "o'tgan" holat tan olinadi (yolg'on yashil bermaslik uchun). */
export function PassengerTrust({
  userId,
  profile,
}: {
  userId?: string;
  /** Bronga biriktirilgan profil — yetarli bo'lsa so'rov qilinmaydi. */
  profile?: { kyc_status?: string; created_at?: string } | null;
}) {
  const tr = useTr();
  const id = (userId ?? '').trim();

  const hasEmbedded = !!(profile?.kyc_status || profile?.created_at);

  const { data } = useQuery({
    queryKey: ['user', id],
    queryFn: () => getUser(id),
    // Bronda ma'lumot bo'lsa tarmoqqa umuman chiqmaymiz.
    enabled: !!id && !hasEmbedded,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const source = hasEmbedded ? profile : data;
  if (!source) return null;

  const verified = isKycApproved(source.kyc_status);

  const createdRaw = source.created_at;
  const year = createdRaw ? new Date(createdRaw).getFullYear() : NaN;
  const hasYear = Number.isFinite(year) && year > 2000;

  if (!verified && !hasYear) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {verified && (
        <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-brand-pink-light dark:bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          {tr('Shaxsi tasdiqlangan', 'Личность подтверждена', 'Identity verified')}
        </span>
      )}
      {hasYear && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] font-bold text-text-muted">
          <Clock className="h-3 w-3" aria-hidden />
          {tr(`${year}-yildan`, `С ${year} года`, `Since ${year}`)}
        </span>
      )}
    </div>
  );
}
