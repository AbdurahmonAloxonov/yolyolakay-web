'use client';

import React from 'react';
import { Check, Circle } from 'lucide-react';
import { computeTrust, type TrustStep } from '@/shared/lib/trust';
import { useTr } from '@/shared/lib/useTr';

/**
 * ISHONCH NARVONI — profildagi tarqoq dalillar o'rniga bitta javob.
 *
 * Ilovada 2026-08-25 dan beri bor, saytda YO'Q edi
 * (`lib/features/profile/*` → `TrustLadder`). Mantiq `shared/lib/trust.ts`
 * da va u ilovadagi `core/trust.dart` bilan AYNAN bir xil.
 *
 * ⚠️ Bajarilmagan bosqich SO'NGAN holda ko'rsatiladi, QIZIL emas: bu
 * ayblov emas, «hali yig'ilmagan» degani. Yangi foydalanuvchida
 * bosqichlarning yarmi bo'sh bo'lishi TABIIY.
 */
export function TrustLadder({
  user,
}: {
  user?: { created_at?: string; rating?: number; rating_count?: number; role?: string } | null;
}) {
  const tr = useTr();
  if (!user) return null;

  const trust = computeTrust(user);
  if (trust.total === 0) return null;

  const label: Record<TrustStep, string> = {
    phone: tr(
      'Telefon SMS bilan tasdiqlangan',
      'Телефон подтверждён по SMS',
      'Phone confirmed by SMS'
    ),
    tenure: tr('Hisob bir oydan ortiq', 'Аккаунту больше месяца', 'Account older than a month'),
    reviews: tr(
      'Yetarlicha odam baho bergan',
      'Достаточно оценок от людей',
      'Enough people have rated them'
    ),
    rating: tr('Bahosi yuqori', 'Высокая оценка', 'High rating'),
    car: tr("Mashina tekshiruvdan o'tgan", 'Машина проверена', 'Car has been verified'),
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold text-text">{tr('Ishonch', 'Доверие', 'Trust')}</h3>
        <span className="text-xs font-bold text-text-muted tabular-nums">
          {trust.earned} / {trust.total}
        </span>
      </div>

      <ul className="space-y-2">
        {trust.shown.map((step) => {
          const ok = trust.done.has(step);
          return (
            <li key={step} className="flex items-center gap-2.5">
              {ok ? (
                <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-border" aria-hidden />
              )}
              <span className={`text-sm ${ok ? 'text-text' : 'text-text-muted'}`}>
                {label[step]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
