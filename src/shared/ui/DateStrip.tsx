'use client';

import React from 'react';
import { useTr } from '@/shared/lib/useTr';
import { useLocale } from 'next-intl';

/**
 * SANA LENTASI — kunlar qatori, har kunning tagida SHU YO'NALISHDA
 * topilgan safarlar soni.
 *
 * 🔴 NEGA KERAK: sana o'zgartirish uchun odam yuqoriga qaytib, kalendarni
 * ochib, kun tanlab, qayta qidirishi kerak edi. Va eng yomoni: u
 * tanlagunicha o'sha kunda safar bor-yo'qligini BILMASDI — ko'pincha
 * bo'sh natijaga tushardi.
 *
 * ⚠️ Ilovada ham AYNAN shunday (`features/search/date_strip.dart`).
 * Qoidani birida o'zgartirsang — ikkinchisida ham: bir xil ekran ikki
 * platformada boshqacha ishlashi eng chalkashtiradigan narsa.
 *
 * Ikki qat'iy qoida (ikkalasi ham ilovadagi bilan bir xil):
 *  1. Son TO'QIB CHIQARILMAYDI — u bitta sanasiz qidiruvdan sanaladi.
 *     Ma'lumot kelmaguncha lenta CHIZILMAYDI.
 *  2. Bo'sh kun BOSILMAYDI. Son ko'rsatib turib, bosilgach bo'sh natija
 *     berish ishonchni yo'qotadi. Nol o'rniga chiziqcha: «0» raqami
 *     «hisoblanmadi» degan taassurot beradi.
 */

/** Lentada nechta kun — ikki hafta (undan uzog'ida e'lon deyarli yo'q). */
const DAYS = 14;

/**
 * `YYYY-MM-DD` — LOKAL kun bo'yicha.
 *
 * ⚠️ `toISOString()` ATAYIN ishlatilmaydi: u UTC'ga o'tkazadi va
 * Toshkentda (UTC+5) ertalab soat 5 gacha KECHAGI kunni qaytaradi.
 */
const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0'
  )}`;

const WEEKDAYS: Record<string, string[]> = {
  uz: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export function DateStrip({
  counts,
  selected,
  onPick,
}: {
  /** `YYYY-MM-DD` -> shu kundagi safarlar soni. */
  counts: Record<string, number> | undefined;
  /** Tanlangan kun (`YYYY-MM-DD`) yoki bo'sh. */
  selected: string;
  onPick: (day: string) => void;
}) {
  const tr = useTr();
  const locale = useLocale();
  const week = WEEKDAYS[locale] ?? WEEKDAYS.uz;

  // Yuklanmaguncha yo'q: sakrab turadigan skelet ro'yxatni pastga suradi
  // va odam bosayotgan kartochkasini yo'qotadi.
  if (!counts || Object.keys(counts).length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      aria-label={tr('Kunlar', 'Дни', 'Days')}
    >
      {Array.from({ length: DAYS }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() + i);
        const key = dayKey(day);
        const count = counts[key] ?? 0;
        const empty = count === 0;
        const isSelected = selected === key;

        return (
          <button
            key={key}
            type="button"
            disabled={empty}
            onClick={() => onPick(key)}
            // Ekran o'quvchisi uchun: «12-avgust, 3 safar». Raqamlar
            // alohida o'qilsa ma'nosi yo'qoladi.
            aria-label={`${day.toLocaleDateString(locale)}, ${count}`}
            aria-pressed={isSelected}
            className={`flex w-16 shrink-0 flex-col items-center rounded-xl px-2 py-1.5 text-center transition-colors ${
              isSelected
                ? 'bg-accent text-white'
                : empty
                  ? 'cursor-not-allowed bg-surface text-text-muted opacity-55'
                  : 'bg-brand-pink-light dark:bg-accent/10 text-accent hover:bg-accent/20'
            }`}
          >
            <span className="whitespace-nowrap text-sm font-extrabold">
              {week[day.getDay()]} {day.getDate()}
            </span>
            <span className="text-[11px] font-bold">{empty ? '—' : count}</span>
          </button>
        );
      })}
    </div>
  );
}
