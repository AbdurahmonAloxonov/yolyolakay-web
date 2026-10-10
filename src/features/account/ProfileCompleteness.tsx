'use client';

import React from 'react';
import { Camera, IdCard, Car, ChevronRight } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';

/**
 * PROFIL TO'LIQLIGI — nima yetishmayotgani va NEGA muhimligi.
 *
 * 🔴 NEGA KERAK: rasmsiz va familiyasiz profil bron olishi qiyin —
 * haydovchi «bu kim?» deb rad etadi. Lekin odam buni BILMAYDI: sayt unga
 * hech nima demaydi, u esa «nega meni qabul qilishmayapti?» deb o'ylaydi.
 * Ilovada 2026-08-25 dan beri bor, saytda YO'Q edi.
 *
 * ⚠️ FOIZ O'ZI MAQSAD EMAS. Ro'yxatda faqat HAQIQATAN ta'sir qiladigan
 * narsalar bor va har biri yonida SABABI yozilgan. «Profilingizni 100%
 * qiling» degan bo'sh o'yin emas — «surat qo'ysangiz bron qabul
 * qilinishi osonlashadi» degan aniq gap.
 *
 * ⚠️ To'liq bo'lsa karta UMUMAN chizilmaydi: bajarilgan ishni har kuni
 * ko'rsatib turish — shovqin.
 *
 * Mobil juftligi: `lib/features/profile/profile_completeness.dart` —
 * bandlar ro'yxati ikkalasida BIR XIL bo'lsin.
 */
export function ProfileCompleteness({
  profile,
  hasCar,
  onAvatar,
  onName,
  onCar,
}: {
  profile?: { avatar_url?: string | null; name?: string; is_driver?: boolean } | null;
  /**
   * Mashina BORmi. `undefined` — BILMAYMIZ (masalan ro'yxat yuklanmadi).
   * 🔴 Bunda band KO'RSATILMAYDI: «mashina qo'shing» deb yozish odam
   * allaqachon qo'shgan bo'lsa yolg'on bo'lardi. Ma'lumot yo'qligi —
   * ayblov emas (ilovadagi `TrustLadder` bilan bir xil qoida).
   */
  hasCar?: boolean;
  onAvatar?: () => void;
  onName?: () => void;
  onCar?: () => void;
}) {
  const tr = useTr();
  if (!profile) return null;

  const isDriver = !!profile.is_driver;
  // Profil javobida `last_name` alohida kelmaydi — to'liq ismdan
  // ajratamiz (bo'sh joydan keyingi qismi).
  const hasLastName = (profile.name ?? '').trim().split(/\s+/).filter(Boolean).length >= 2;

  // Tartib MUHIMLIK bo'yicha.
  const gaps = [
    !(profile.avatar_url ?? '').trim() && {
      key: 'avatar',
      Icon: Camera,
      label: tr("Surat qo'shing", 'Добавьте фото', 'Add a photo'),
      why: tr(
        'Suratli profilga bron osonroq beriladi',
        'С фото заявку принимают охотнее',
        'Requests with a photo get accepted more often'
      ),
      onTap: onAvatar,
    },
    !hasLastName && {
      key: 'name',
      Icon: IdCard,
      label: tr('Familiyani kiriting', 'Укажите фамилию', 'Add your last name'),
      why: tr(
        'Hamroh sizni tanishi uchun',
        'Чтобы попутчик вас узнал',
        'So your companion can recognise you'
      ),
      onTap: onName,
    },
    isDriver &&
      hasCar === false && {
        key: 'car',
        Icon: Car,
        label: tr("Mashina qo'shing", 'Добавьте автомобиль', 'Add your car'),
        why: tr(
          "Mashinasiz e'lon faollashmaydi",
          'Без автомобиля объявление не активируется',
          'Without a car your listing cannot go live'
        ),
        onTap: onCar,
      },
  ].filter(Boolean) as {
    key: string;
    Icon: typeof Camera;
    label: string;
    why: string;
    onTap?: () => void;
  }[];

  if (gaps.length === 0) return null;

  // Jami band soni: yo'lovchida 2, haydovchida 3 — lekin mashina holati
  // NOMA'LUM bo'lsa u sanoqqa ham kirmaydi (aks holda «2/3» deb turardi
  // va uchinchisi nima ekani ko'rinmasdi).
  const total = isDriver && hasCar !== undefined ? 3 : 2;
  const done = total - gaps.length;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-extrabold text-text">
          {tr('Profilingiz', 'Ваш профиль', 'Your profile')}
        </h2>
        <span className="text-xs font-bold text-text-muted tabular-nums">
          {done} / {total}
        </span>
      </div>

      <ul className="space-y-2">
        {gaps.map(({ key, Icon, label, why, onTap }) => (
          <li key={key}>
            <button
              type="button"
              onClick={onTap}
              disabled={!onTap}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-bg p-3 text-left transition-colors enabled:hover:border-accent disabled:cursor-default"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text">{label}</span>
                {/* 🔴 SABAB — bandning o'zidan muhimroq: usiz bu shunchaki buyruq. */}
                <span className="block text-xs text-text-muted">{why}</span>
              </span>
              {onTap && (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
