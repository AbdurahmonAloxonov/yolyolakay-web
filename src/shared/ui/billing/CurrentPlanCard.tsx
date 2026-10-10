'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CreditCard, CalendarClock, TrendingUp, Crown, Sparkles, Package } from 'lucide-react';
import { useCurrentPlan } from '@/entities/billing/api/useSubscription';
import {
  formatBalance,
  formatCurrency,
  formatDateOnly,
  formatQuota,
  daysUntil,
} from '@/shared/lib/format';
import { useTr } from '@/shared/lib/useTr';
import { GirihPattern } from '@/shared/ui/brand/Ornament';
import { AtlasEdge } from '@/shared/ui/brand/Atlas';

/**
 * "Sizning tarifingiz" kartasi — tariflar sahifalari va profil uchun YAGONA manba
 * (CEO talabi 2026-07-30: balansdan tashqari amaldagi tarif va uning tugash sanasi
 * ham ko'rinsin).
 *
 * Uch ko'rinish `useCurrentPlan().mode` dan keladi:
 *   trial   — obuna yo'q/sinov: karta "sinov" holatini aytadi, tariflar setkasi ochiq
 *   upgrade — o'rta tarif: joriy tarif + keyingi rejaga ko'tarilish taklifi
 *   top     — eng qimmat tarif: faqat tarif va balans, sotish taklifi YO'Q
 *
 * `compact` — profil sahifasi uchun past variant (upsell bloki chizilmaydi).
 * `showBalance` — profilda ALOHIDA rol balansi bloki bor (haydovchi/yo'lovchi),
 *   shuning uchun u yerda o'chiriladi: ikki xil balans raqami chalkashtiradi.
 */
export function CurrentPlanCard({
  compact = false,
  showBalance = true,
  className = '',
}: {
  compact?: boolean;
  showBalance?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTr();

  const { plan, mode, nextPlan, endDate, ridesLeft, isUnlimited, isLoading } = useCurrentPlan();

  if (isLoading) {
    return (
      /* min-h — yuklangan kartaning balandligiga yaqin: skeleton pastroq bo'lsa,
         javob kelganda karta "cho'ziladi" va ostidagi bloklar sakrab tushardi. */
      <div
        className={`min-h-[148px] animate-pulse rounded-2xl border border-border bg-surface p-6 ${className}`}
        aria-busy="true"
      >
        <div className="h-4 w-32 rounded bg-border/60" />
        <div className="mt-3 h-7 w-40 rounded bg-border/40" />
        <div className="mt-6 h-4 w-28 rounded bg-border/40" />
      </div>
    );
  }

  const daysLeft = daysUntil(endDate);
  // Muddat o'tib ketgan bo'lsa "qoldi" deb yozish noto'g'ri bo'lardi.
  const isExpired = daysLeft !== null && daysLeft < 0;
  const isEndingSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5;

  const planLabel = plan?.name ?? t('Sinov tarifi', 'Пробный тариф', 'Trial plan');

  /*
   * OBUNA KARTASI — «a'zolik guvohnomasi».
   *
   * 🔴 Ilgari u FAQAT eng qimmat tarifda to'q edi, qolganda esa oq
   * karta bo'lib, ichida pushti yozuv va pushti nishon turardi — ya'ni
   * pastdagi pushti «Tanlash» tugmasi bilan raqobatlashardi. Ilovada
   * bu 03.09 da tuzatilgandi (izohi `tariffs_screen.dart` da), sayt
   * esa eski holida qolgandi: bir mahsulotning ikki yuzi.
   *
   * Endi u har doim to'q va girih naqshli — safar pasporti bilan bir
   * tilda, pastida atlas jiyagi. Bu «xabar» emas, HUJJAT.
   */
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-wine-ash bg-wine-ash p-6 text-white shadow-sm ${className}`}
    >
      <GirihPattern size={64} color="rgba(255,255,255,0.09)" className="opacity-100" />
      {/* Pastdagi jiyak — hujjatning etagi. */}
      <AtlasEdge className="absolute inset-x-0 bottom-0 h-1 w-full" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-widest text-white/60">
            {t('Sizning tarifingiz', 'Ваш тариф', 'Your plan')}
          </span>
          <div className="flex items-center gap-2">
            {mode === 'top' && <Crown className="h-5 w-5 text-turquoise" aria-hidden />}
            <h3 className="text-2xl font-display font-black tracking-tight text-white">
              {planLabel}
            </h3>
          </div>
        </div>

        {/* Balans — rolga bog'liq emas, obunadan keladi */}
        <div
          className={`${showBalance ? 'flex' : 'hidden'} items-center gap-2 rounded-full bg-white/10 px-3 py-1.5`}
        >
          <CreditCard className="h-4 w-4 text-turquoise" aria-hidden />
          <span className="text-sm font-extrabold text-white">
            {formatBalance({ isUnlimited, ridesLeft, planKnown: !!plan }, locale)}{' '}
            {t('safar', 'поездок', 'rides')}
          </span>
        </div>
      </div>

      {/* Bepul posilka kvotasi — `GET /billing/plans` beradi (`free_parcels_quota`),
          lekin hech qayerda ko'rsatilmasdi. Faqat 0 dan katta bo'lsa chiziladi. */}
      {!!plan?.parcels && plan.parcels > 0 && (
        <p className="relative mt-3 flex items-center gap-1.5 text-xs font-bold text-white/70">
          <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('Bepul posilka', 'Бесплатных посылок', 'Free parcels')}: {plan.parcels}
        </p>
      )}

      {/* Amal qilish muddati. Backend `end_date` bermasa QATOR CHIZILMAYDI —
          "muddatsiz" deb yozish yolg'on bo'lardi (§5a backendga so'ralgan). */}
      {endDate && (
        <div className="relative mt-4 flex items-center gap-2 text-sm text-white/70">
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
          {isExpired ? (
            <span className="font-semibold text-accent-on-dark">
              {t('Muddati tugagan', 'Срок истёк', 'Expired')} — {formatDateOnly(endDate)}
            </span>
          ) : (
            <span>
              {t('Amal qiladi', 'Действует до', 'Valid until')}:{' '}
              <strong>{formatDateOnly(endDate)}</strong>
              {isEndingSoon && (
                <span className="ml-1 font-semibold text-accent-on-dark">
                  (
                  {daysLeft === 0
                    ? t('bugun', 'сегодня', 'today')
                    : `${daysLeft} ${t('kun', 'дн.', 'days')}`}
                  )
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Limitni oshirish taklifi — FAQAT o'rta tarifda. Eng qimmatda ko'rsatilmaydi. */}
      {!compact && mode === 'upgrade' && nextPlan && (
        <div className="relative mt-5 rounded-xl border border-white/15 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-turquoise" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-bold text-white">
                {t('Limitni oshiring', 'Повысьте лимиты', 'Increase your limits')}
              </p>
              <p className="text-xs text-white/60">
                {t(
                  `«${nextPlan.name}» tarifida ${formatQuota(nextPlan.quota, locale)} safar — ${formatCurrency(nextPlan.price, locale)}`,
                  `На тарифе «${nextPlan.name}» — ${formatQuota(nextPlan.quota, locale)} поездок за ${formatCurrency(nextPlan.price, locale)}`,
                  `The «${nextPlan.name}» plan gives ${formatQuota(nextPlan.quota, locale)} rides for ${formatCurrency(nextPlan.price, locale)}`
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sinov holati — nima uchun pastda barcha tariflar turgani tushuntiriladi. */}
      {!compact && mode === 'trial' && (
        <p className="relative mt-4 flex items-start gap-2 text-sm text-white/70">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-turquoise" aria-hidden />
          {t(
            'Hozir sinov rejimidasiz — quyidagi tariflardan birini tanlang.',
            'Сейчас у вас пробный режим — выберите один из тарифов ниже.',
            'You are on the trial plan — pick one of the plans below.'
          )}
        </p>
      )}

      {/* Profil varianti: to'liq sahifaga o'tish */}
      {compact && (
        <Link
          href={`/${locale}/tariffs`}
          /* ⚠️ Balandligi 20 px edi (o'lchandi 2026-09-04): karta ichidagi
             YAGONA bosiladigan joy — u eng ishonchli nishon bo'lishi kerak. */
          className="relative mt-4 inline-flex min-h-11 items-center text-sm font-bold text-turquoise underline-offset-4 hover:underline"
        >
          {mode === 'top'
            ? t("Tariflarni ko'rish", 'Посмотреть тарифы', 'View plans')
            : t("Tarifni o'zgartirish", 'Изменить тариф', 'Change plan')}
        </Link>
      )}
    </div>
  );
}
