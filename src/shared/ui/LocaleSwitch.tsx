'use client';

import React, { startTransition, useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { LOCALES, type Lang } from '@/shared/lib/i18n';
import { persistLocaleOnServer } from '@/entities/user/api/useProfile';

/**
 * Til almashtirgich (UZ · RU · EN) — sayt bo'ylab YAGONA komponent.
 *
 * Ilgari bu mantiq uch joyda (Header, profil, ...) qayta-qayta yozilgan edi va
 * uchinchi til qo'shilganda har birini alohida tuzatish kerak bo'lardi. Endi
 * ro'yxat `LOCALES` dan keladi: yangi til qo'shilsa hamma joyda o'zi paydo bo'ladi.
 *
 * MUHIM: tanlangan til NEXT_LOCALE cookie'ga YOZILADI. `proxy.ts` shu cookie'ni URL
 * prefiksidan USTUN qo'yadi — eski havola/bookmark/push ("/ru/bidding/...") ochilsa
 * ham foydalanuvchi o'z tilida ko'radi. Cookie yozilmasa, prefiks bilan cookie
 * to'qnashib, foydalanuvchi eski tiliga qaytarib tashlanardi.
 */

// Kirill — «ЎЗ»: «UZ» bilan yonma-yon turganda farq yozuvning
// O'ZIDA ko'rinishi kerak.
const LABEL: Record<Lang, string> = {
  uz: 'UZ',
  'uz-cyrl': 'ЎЗ',
  ru: 'RU',
  en: 'EN',
};

/**
 * To'liq nomlar — HAR TIL O'Z TILIDA yoziladi va TARJIMA QILINMAYDI.
 * Ruszabon odam «Русский» ni tanidi, «Ruscha» ni esa qidirib topishi
 * kerak bo'ladi. Ixcham ko'rinishdagi ro'yxatda aynan shular chiqadi.
 */
const FULL: Record<Lang, string> = {
  uz: "O'zbekcha",
  'uz-cyrl': 'Ўзбекча',
  ru: 'Русский',
  en: 'English',
};

/** Cookie yozish komponentdan TASHQARIDA: React Compiler render doirasidagi
 *  tashqi qiymat o'zgarishini taqiqlaydi (`react-hooks/immutability`). */
const persistLocale = (next: string) => {
  if (typeof document === 'undefined') return;
  // 1 yil, path=/, SameSite=Lax (next-intl ham shu nomdan foydalanadi).
  document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
};

export function LocaleSwitch({
  size = 'md',
  className = '',
  variant = 'segments',
}: {
  /** `sm` — header menyusi kabi tor joylar uchun. */
  size?: 'sm' | 'md';
  className?: string;
  /**
   * `segments` — uchala til yonma-yon (kompyuter, keng joy).
   * `compact`  — faqat JORIY til + globus; bosilganda uchtasi to'liq
   *              nomi bilan ochiladi.
   *
   * 🔴 NEGA `compact` KERAK BO'LDI (egasi, 2026-09-03): telefonda
   * landing sarlavhasida uchta segment 104 piksel yeyardi va yoniga
   * «Kirish» sig'masdi — shuning uchun kirish BURGER menyusiga
   * yashiringandi. Menyu esa atigi ikkita narsa uchun ochilardi va
   * til almashtirgich UNDA HAM, sarlavhada HAM turardi (ikki nusxa).
   */
  variant?: 'segments' | 'compact';
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const switchTo = (next: string) => {
    if (next === locale) return;
    persistLocale(next);
    // Serverga ham yozamiz — bildirishnomalar shu tilda kelishi uchun (kirgan
    // foydalanuvchida; mehmon uchun cookie yetadi). Javobni KUTMAYMIZ.
    void persistLocaleOnServer(queryClient, next);
    const parts = (pathname || `/${locale}`).split('/');
    if (parts.length > 1 && LOCALES.includes(parts[1] as Lang)) {
      parts[1] = next;
    } else {
      parts.splice(1, 0, next);
    }
    const search = typeof window !== 'undefined' ? window.location.search : '';

    // `startTransition` — "sayt yangilandi" hissi shu yerdan kelardi.
    //
    // Til URL segmenti (`/uz|/ru|/en`), shuning uchun uni almashtirish BUTUN
    // `[locale]` daraxtini qayta render qilishga majbur qiladi — bu next-intl'ning
    // URL-asosli tuzilishida muqarrar. Transition'siz React eski UI ni darhol
    // tashlab, yangi daraxt serverdan kelguncha bo'sh joy ko'rsatardi: ekran
    // oqarib, sahifa qayta yuklanganday tuyulardi.
    //
    // Transition ichida esa eski sahifa yangi daraxt TAYYOR bo'lguncha ekranda
    // qoladi — miltillash yo'qoladi. Bu haqiqiy qayta yuklash EMAS edi (hard
    // reload hech qachon bo'lmagan), lekin ko'zga aynan shunday ko'rinardi.
    // `scroll: false` — Next standart holatda navigatsiyada sahifani tepaga
    // sakratadi. Til almashtirish esa "boshqa sahifaga o'tish" emas: odam
    // qayerda turgan bo'lsa, o'sha yerda qolishi kerak. Tepaga sakrash ham
    // "sayt qayta yuklandi" hissini kuchaytirardi.
    startTransition(() => {
      router.push(parts.join('/') + search, { scroll: false });
    });
  };

  /*
   * 🔴 BOSILADIGAN JOY JUDA KICHIK EDI (2026-09-03, o'lchov).
   *
   * Segmentlar 32×23 px chiqardi — barmoq uchun eng kam qulay
   * o'lcham 44 px, hatto sichqoncha uchun ham 23 px kam. Bu
   * almashtirgich endi HAR sahifada turadi, ya'ni xato ham har
   * sahifada.
   *
   * Yozuv o'lchami o'zgarmaydi (u ATAYIN mayda — sarlavhada
   * baqirmasligi kerak), faqat tegib turadigan maydon o'sadi.
   */
  const pad = size === 'sm' ? 'px-2.5 py-2 text-[10px]' : 'px-3 py-2.5 text-xs';

  if (variant === 'compact') {
    return <CompactSwitch locale={locale as Lang} onPick={switchTo} className={className} />;
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-xl border border-border bg-bg p-0.5 ${className}`}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-pressed={locale === l}
          className={`rounded-lg font-extrabold transition-colors ${pad} ${
            locale === l ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text'
          }`}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}

/**
 * IXCHAM KO'RINISH — joriy til + globus, bosilganda ro'yxat.
 *
 * Ro'yxat tashqariga bosilganda va Esc da yopiladi. Tinglovchi
 * HUJJAT darajasida: sarlavhada `backdrop-blur` bor va u `fixed`
 * avlodlar uchun containing block hosil qiladi — ya'ni ichkaridagi
 * to'liq ekranli fon sahifani emas, faqat sarlavha lentasini
 * qoplaydi (Header'da aynan shu xato bir marta bo'lgan).
 */
function CompactSwitch({
  locale,
  onPick,
  className = '',
}: {
  locale: Lang;
  onPick: (next: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        // Balandligi «Kirish» tugmasi bilan bir xil (44 px) — ikkalasi
        // yonma-yon turadi va barmoq uchun ham shuncha kerak.
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-bg px-3 text-xs font-extrabold text-text"
      >
        <Globe className="h-4 w-4 text-text-muted" aria-hidden />
        {LABEL[locale]}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/10"
        >
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={locale === l}
              onClick={() => {
                setOpen(false);
                onPick(l);
              }}
              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold transition-colors ${
                locale === l
                  ? 'bg-brand-pink-light dark:bg-accent/10 text-accent'
                  : 'text-text hover:bg-bg'
              }`}
            >
              {FULL[l]}
              <span className="text-[10px] font-black text-text-muted">{LABEL[l]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
