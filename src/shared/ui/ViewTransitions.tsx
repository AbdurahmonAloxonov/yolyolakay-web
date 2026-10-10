'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Sahifalar orasidagi View Transition — brauzerning o'z mexanizmi.
 *
 * NEGA NEXT'NING `experimental.viewTransition` BAYROG'I EMAS: u React'ning
 * `<ViewTransition>` komponentiga tayanadi, o'sha komponent esa faqat React'ning
 * EKSPERIMENTAL qurilmasida bor (bizda barqaror 19.2.4). Ya'ni bayroqni yoqish
 * uchun butun ilovani eksperimental React ustiga ko'chirish kerak bo'lardi.
 * `document.startViewTransition` esa React va Next'dan mustaqil, barqaror
 * brauzer API'si — natija bir xil, xavf esa yo'q.
 *
 * ISHLASH TARTIBI: ichki havola bosilganda odatiy navigatsiyani to'xtatamiz va
 * `router.push` ni view transition ichida bajaramiz. Brauzer eski va yangi
 * holatning suratini olib, ular orasida o'zi o'tish chizadi — hammasi
 * kompozitorda, JS kadr sikliga bog'liq emas.
 *
 * QO'LLAB-QUVVATLAMAYDIGAN BRAUZER: `startViewTransition` bo'lmasa hech narsa
 * qilmaymiz — havola odatdagidek ishlaydi va `.mo-page` CSS o'tishi qoladi.
 * Ya'ni buzilish yo'q, faqat effekt kamroq.
 */
export function ViewTransitions() {
  const router = useRouter();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (typeof doc.startViewTransition !== 'function') return;

    // Qo'llab-quvvatlanadi — `.mo-page` CSS o'tishini o'chiramiz, aks holda
    // ikkita animatsiya ustma-ust tushib, sahifa ikki marta "ochilardi".
    document.documentElement.classList.add('has-view-transitions');

    const onClick = (e: MouseEvent) => {
      // Faqat oddiy chap tugma bosilishi. Ctrl/Cmd/Shift/Alt bilan bosilsa
      // foydalanuvchi yangi oynada ochmoqchi — aralashmaymiz.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;
      // Tashqi havola, yangi oyna, yuklab olish, `mailto:`/`tel:` — tegmaymiz.
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      if (!href.startsWith('/')) return;

      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
      // Ayni sahifaga havola (faqat #langar) — o'tish kerak emas.
      if (url.pathname === location.pathname && url.search === location.search) return;

      e.preventDefault();
      doc.startViewTransition!(() => {
        router.push(url.pathname + url.search);
      });
    };

    // `capture: true` — Next'ning `<Link>` o'z ishlovchisidan OLDIN ushlaymiz.
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      document.documentElement.classList.remove('has-view-transitions');
    };
  }, [router]);

  return null;
}
