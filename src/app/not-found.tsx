'use client';

import React from 'react';
import { Onest } from 'next/font/google';
import { Compass } from 'lucide-react';
import { asLang, trFor, type Lang } from '@/shared/lib/i18n';
import { PeshtoqBadge } from '@/shared/ui/EmptyState';
import './globals.css';

/**
 * BRENDLI 404 — butun sayt uchun YAGONA sahifa.
 *
 * 🔴 NEGA YOZILDI (2026-09-04, jonli o'lchandi): `/uz/nimadir` yoki
 * `/uz/trip/<axlat>` ochilganda sayt Next.js'ning O'Z sahifasini
 * chizardi — oq fon, inglizcha «This page could not be found.», na
 * brend, na bosh sahifaga havola. Butun sayt uch tilli ekan, adashgan
 * odam aynan shu yerda begona tilga urilardi.
 *
 * 🔑 `[locale]/not-found.tsx` ALLAQACHON bor edi va HECH QACHON
 * chizilmagan. Sabab: ildiz maketi `[locale]` ichida yashaydi, Next
 * esa «topilmadi» chegarasini ILDIZDAN qidiradi. Tekshirildi:
 * chegarani `[locale]/`, `(public)/` va hatto `trip/[id]/` ichiga
 * qo'yib ko'rildi — uchalasida ham standart sahifa chiqdi. Faqat
 * `src/app/not-found.tsx` ishlaydi, va u IKKALA holatni ham
 * qamrab oladi:
 *   • mos kelmagan manzil        → 404 + shu sahifa
 *   • sahifadagi `notFound()`    → 404 + shu sahifa
 *
 * ⚠️ Ildiz maketi YO'Q (u `[locale]` ichida), shuning uchun bu
 * sahifani Next o'zining YASHIRIN maketiga o'raydi: `<html>`/`<body>`
 * bu yerda YOZILMAYDI, lekin stil va shrift ham MEROS BO'LIB
 * O'TMAYDI — ikkalasi shu faylda alohida ulanadi.
 */
const bodySans = Onest({
  variable: '--font-geist-sans',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

export default function NotFound() {
  // Til MANZILDAN olinadi: bu sahifa `[locale]` maketidan tashqarida
  // turadi, ya'ni `next-intl` provayderi bu yerda YO'Q.
  // ⚠️ Tur QO'LDA yozilmaydi: `Lang` ga yangi til qo'shilsa bu yer
  // o'zi moslashsin (kirill qo'shilganda TypeScript aynan shu qatorda
  // to'xtatgandi).
  const [locale, setLocale] = React.useState<Lang>('uz');

  React.useEffect(() => {
    setLocale(asLang(window.location.pathname.split('/')[1]));
    /*
     * Tema — maketdagi bilan bir xil mantiq. Yashirin maket `<html>` ga
     * hech qanday klass qo'ymaydi, ya'ni bu sahifa tungi rejimda ham
     * OPPOQ chiqib, ko'zni qamashtirardi.
     */
    try {
      const root = document.documentElement;
      let t = localStorage.getItem('theme');
      if (t !== 'light' && t !== 'dark') {
        t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      root.classList.remove('light', 'dark');
      root.classList.add(t);
      if (localStorage.getItem('theme_style') === 'neon') root.classList.add('neon');
    } catch {
      /* localStorage yopiq — yorug' tema qoladi, sahifa baribir ishlaydi */
    }
  }, []);

  const tr = trFor(locale);

  return (
    <div
      /*
       * ⚠️ Shrift `variable` orqali EMAS, `className` orqali beriladi.
       * Sabab o'lchandi: bu sahifaning CSS to'plamiga Tailwind'ning
       * `--font-sans` tokeni TUSHMAYDI (u faqat ishlatilgan joyda
       * chiqariladi, ildiz maketi esa bu yerda yo'q) — natijada butun
       * sahifa «Times New Roman» da chizilardi. `className` shriftni
       * to'g'ridan-to'g'ri qo'yadi va hech qanday tokenga bog'liq emas.
       */
      className={`${bodySans.className} flex min-h-screen flex-col items-center justify-center gap-5 bg-bg px-6 py-16 text-center text-text antialiased`}
    >
      {/* Brend belgisi — odam qaysi saytda ekanini bilsin. Manzil xato
          bo'lgani uchun sarlavha paneli chizilmaydi. */}
      {/* ⚠️ `font-display` (serif) ISHLATILMAYDI: uning tokeni ham shu
          sahifaga tushmaydi va sarlavha jimgina Times'ga aylanadi.
          Sarlavha panelidagi logotip ham grotesk — bir xil bo'ldi. */}
      <span className="text-xl font-black tracking-tight">
        YOL<span className="text-brand-pink">YOLAKAY</span>
      </span>

      {/* Peshtoq medalyoni — saytdagi o'n bir «bo'sh holat» bilan AYNAN
          bir xil shakl. 404 ham bo'sh holat: odam kutgan narsa yo'q.
          Boshqa belgi qo'yish yana bir «o'ziga xos» ekran yasagan
          bo'lardi. */}
      <PeshtoqBadge icon={<Compass />} className="mt-2" />

      {/* 🔴 SAHIFANING SARLAVHASI (2026-09-04, o'lchandi): bu yerda
          umuman `h1` yo'q edi. Ekran o'qigich sahifani sarlavhalar
          bo'yicha kezadi va 404 da unga ilinadigan hech nima
          yo'q edi. Raqamning O'ZI sarlavha bo'lolmaydi — «404» deb
          eshitish hech nima anglatmaydi, shuning uchun yonida
          ko'rinmas, lekin O'QILADIGAN izoh turadi. */}
      <h1 className="text-5xl font-black leading-none text-foreground">
        404
        <span className="sr-only">
          {' — '}
          {tr('Sahifa topilmadi', 'Страница не найдена', 'Page not found')}
        </span>
      </h1>

      <p className="max-w-sm text-sm leading-relaxed text-text-muted">
        {tr(
          "Bunday sahifa topilmadi. Ehtimol u ko'chirilgan yoki o'chirilgan.",
          'Страница не найдена. Возможно, она была перемещена или удалена.',
          'This page was not found. It may have been moved or deleted.'
        )}
      </p>

      <a
        href={`/${locale}`}
        className="mt-1 inline-flex min-h-11 items-center rounded-xl bg-accent px-8 text-sm font-bold text-white"
      >
        {tr('Bosh sahifa', 'На главную', 'Home')}
      </a>
    </div>
  );
}
