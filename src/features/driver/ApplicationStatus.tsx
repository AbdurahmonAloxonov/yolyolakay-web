'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Car as CarIcon } from 'lucide-react';

import { getMyCars } from '@/shared/api/users';
import type { Car } from '@/shared/api/types/user';
import { SuzaniBloom } from '@/shared/ui/brand/SuzaniBloom';
import { useTr } from '@/shared/lib/useTr';

/**
 * Haydovchi arizasining holati — ariza yuborilgandan tasdiqlanguncha.
 *
 * NEGA KERAK BO'LDI: ilgari bu ekranda "Tabriklaymiz! Endi buyurtmalarni
 * ko'rishingiz mumkin" yozilardi. Bu HAQIQAT EMAS edi — backend yangi mashinani
 * `moderation_status: "pending"` bilan qaytaradi, ya'ni admin tasdiqlamaguncha
 * odam ishlay olmaydi. Ekran esa uni "tayyor" deb ishontirib yuborardi va
 * haydovchi nega e'lon bera olmayotganini tushunmasdi.
 *
 * Uch bosqich yo'l metaforasi bilan ko'rsatiladi — loyihada yo'l allaqachon
 * asosiy vizual metafora (landing'dagi `RoadIllustration`) va u har yoshdagi
 * foydalanuvchiga izohsiz tushunarli: qayerdan chiqdim, qayerdaman, qayerga
 * yetaman.
 */
export function ApplicationStatus({ onStart }: { onStart: () => void }) {
  const tr = useTr();

  // Moderatsiya holati mashinada keladi. `refetchInterval` — odam shu ekranda
  // turganida admin tasdiqlasa, sahifani yangilamasdan ko'rsin. Ekrandan
  // chiqqach so'rov ham to'xtaydi (react-query komponent bilan birga tugaydi).
  const { data: cars = [] } = useQuery<Car[]>({
    queryKey: ['vehicles'],
    queryFn: getMyCars,
    refetchInterval: 20000,
  });

  const status = String(cars[0]?.moderation_status ?? 'pending').toLowerCase();
  const approved = status === 'approved' || status === 'active' || status === 'verified';
  const rejected = status === 'rejected' || status === 'declined';

  const steps = [
    {
      title: tr('Ariza yuborildi', 'Заявка отправлена', 'Application sent'),
      done: true,
    },
    {
      title: tr('Tekshiruvda', 'На проверке', 'Under review'),
      done: approved,
      current: !approved && !rejected,
    },
    {
      title: tr("Yo'lga tayyor", 'Готовы к поездкам', 'Ready to drive'),
      done: approved,
    },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center space-y-7 text-center">
      <SuzaniBloom tone={approved ? 'approved' : 'pending'} />

      <div className="space-y-2">
        <h1 className="font-display text-2xl font-black tracking-tight text-foreground">
          {approved
            ? tr('Tasdiqlandi!', 'Подтверждено!', 'Approved!')
            : rejected
              ? tr('Ariza qaytarildi', 'Заявка отклонена', 'Application declined')
              : tr('Arizangiz qabul qilindi', 'Заявка принята', 'Application received')}
        </h1>
        <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-text-muted">
          {approved
            ? tr(
                "Mashinangiz tasdiqlandi. Endi safar e'lon qilishingiz mumkin.",
                'Ваш автомобиль подтверждён. Теперь можно публиковать поездки.',
                'Your car is approved. You can publish trips now.'
              )
            : rejected
              ? tr(
                  "Hujjatlarda muammo bo'lgan ko'rinadi. Mashina ma'lumotlarini profil orqali qayta yuboring.",
                  'Похоже, с документами возникла проблема. Отправьте данные автомобиля заново через профиль.',
                  'There seems to be an issue with the documents. Please resubmit your car details from the profile.'
                )
              : tr(
                  "Mashina ma'lumotlaringiz tekshiruvga yuborildi. Tasdiqlangach xabar beramiz — bu sahifada kutib turishingiz shart emas.",
                  'Данные автомобиля отправлены на проверку. Мы сообщим, когда всё будет готово — ждать на этой странице не нужно.',
                  'Your car details are under review. We will notify you once it is done — no need to wait on this page.'
                )}
        </p>
      </div>

      {/* Yo'l: uchta bekat. Joriy bekatda mashina turadi. */}
      <ol className="w-full max-w-[300px] space-y-0">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-stretch gap-3 text-left">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  s.done
                    ? 'border-turquoise bg-turquoise text-wine-ash'
                    : s.current
                      ? 'border-accent bg-brand-pink-light dark:bg-accent/10 text-accent'
                      : 'border-border bg-surface text-text-muted'
                }`}
              >
                {s.done ? (
                  <Check className="h-4 w-4" />
                ) : s.current ? (
                  <CarIcon className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </span>
              {/* Bekatlarni bog'lovchi yo'l chizig'i (oxirgisidan keyin yo'q) */}
              {i < steps.length - 1 && (
                <span
                  className={`w-0.5 flex-1 ${s.done ? 'bg-turquoise' : 'bg-border'}`}
                  style={{ minHeight: 20 }}
                />
              )}
            </div>
            <div className="pb-4 pt-1">
              <p
                className={`text-sm font-bold ${
                  s.done || s.current ? 'text-foreground' : 'text-text-muted'
                }`}
              >
                {s.title}
              </p>
              {s.current && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {tr(
                    'Odatda bir ish kuni',
                    'Обычно один рабочий день',
                    'Usually one business day'
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onStart}
        className="mo-lift w-full max-w-[220px] rounded-2xl bg-brand-pink px-6 py-3 text-base font-bold text-white"
      >
        {approved
          ? tr("Safar e'lon qilish", 'Опубликовать поездку', 'Publish a trip')
          : tr('Bosh sahifaga', 'На главную', 'Go to dashboard')}
      </button>
    </div>
  );
}
