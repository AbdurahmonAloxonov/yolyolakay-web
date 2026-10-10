'use client';

import React from 'react';
import { Type } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';

/**
 * KATTAROQ MATN — butun saytda yozuvlar kattalashadi.
 *
 * 🔴 NEGA KERAK: foydalanuvchilarimizning katta qismi keksa odamlar
 * (shaharlararo yo'l — ularning odatiy safari). Brauzerning o'z
 * masshtabi butun sahifani, jumladan xaritani ham cho'zadi; bu esa
 * FAQAT matnni kattalashtiradi.
 *
 * 🔴 BIRINCHI URINISH XATO EDI (egasi: «profil sochilib ketgan»):
 * `html { font-size: 160% }` qilingandi. Tailwind'da BO'SHLIQ va
 * KENGLIK ham `rem` da — ya'ni matn bilan birga butun joylashuv
 * cho'zilardi va `max-w-2xl` konteyner 672px dan 1075px ga chiqib,
 * hech qaysi telefonga sig'may qolardi.
 *
 * Endi `<html>` ga faqat `data-bigtext="1"` belgisi qo'yiladi, o'lcham
 * esa `globals.css` da FAQAT matn sinflari uchun qayta belgilanadi.
 * Bo'shliq, kenglik, tugma balandligi TEGILMAYDI.
 *
 * ⚠️ Koeffitsent ilovadagi 1.6 emas, 1.25 — sababi `globals.css` da.
 */
const KEY = 'big_text';

function apply(on: boolean) {
  const root = document.documentElement;
  // Faqat BELGI qo'yiladi — o'lchamlar `globals.css` da. Brauzerning
  // o'z masshtabi buning USTIGA qo'shiladi va shunday bo'lishi kerak:
  // bizniki uning sozlamasini bekor qilmaydi.
  if (on) {
    root.setAttribute('data-bigtext', '1');
  } else {
    root.removeAttribute('data-bigtext');
  }
}

/** Sahifa ochilishida qo'llash — sozlama har yuklanishda tiklanishi shart. */
export function useBigTextBoot() {
  React.useEffect(() => {
    try {
      apply(localStorage.getItem(KEY) === '1');
    } catch {
      /* xotira bloklangan — standart o'lchamda qolaveradi */
    }
  }, []);
}

export function BigTextToggle() {
  const tr = useTr();
  const [on, setOn] = React.useState(false);

  React.useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) === '1');
    } catch {
      /* o'qib bo'lmadi — o'chiq deb qaraymiz */
    }
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* saqlanmasa ham joriy sessiyada ishlaydi */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent"
    >
      <Type className="h-4.5 w-4.5 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-text">
          {tr('Kattaroq matn', 'Крупный текст', 'Larger text')}
        </span>
        <span className="block text-xs text-text-muted">
          {tr(
            'Butun saytda yozuvlar kattalashadi',
            'Текст на всём сайте станет крупнее',
            'Text gets bigger across the site'
          )}
        </span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}
