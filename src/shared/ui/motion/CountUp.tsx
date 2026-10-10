'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** SSR'da `useLayoutEffect` ogohlantirish beradi — serverda `useEffect` ga tushamiz. */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Raqamning 0 dan haqiqiy qiymatgacha sanalishi (reactbits `CountUp` ekvivalenti).
 *
 * BU YERDA RAQAM PUL BO'LISHI MUMKIN — shuning uchun uch qatlamli kafolat bor:
 *
 *  1. Server HTML'ida DARHOL haqiqiy qiymat turadi. JS umuman ishlamasa ham
 *     foydalanuvchi to'g'ri summani ko'radi (0 emas).
 *  2. Nolga tushirish `useLayoutEffect` da — ya'ni brauzer chizishdan OLDIN.
 *     Shu sababli "haqiqiy qiymat ko'rindi → 0 ga sakradi" degan miltillash yo'q.
 *  3. Muddat tugagach majburiy taymer yakuniy qiymatni qo'yadi. rAF muzlab qolsa
 *     (fon tab, WebView ochilishi) raqam yarim yo'lda qotib qolmaydi.
 *
 * `prefers-reduced-motion` yoqilgan bo'lsa animatsiya UMUMAN ishga tushmaydi.
 */
export function CountUp({
  value,
  duration = 900,
  format,
  className = '',
}: {
  value: number;
  /** Davomiylik, millisekundda. */
  duration?: number;
  /** Ko'rsatish formati (masalan `formatCurrency`). */
  format?: (n: number) => string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  const fmt = format ?? ((n: number) => String(n));

  useIsoLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (!Number.isFinite(value) || value <= 0) return;

    // Chizishdan oldin noldan boshlaymiz — miltillash bo'lmaydi.
    setShown(0);

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // easeOutCubic — oxiriga borib sekinlashadi, "to'xtadi" hissi aniq bo'ladi.
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // 3-qatlam: rAF muzlasa ham yakuniy qiymat qo'yiladi.
    const failsafe = window.setTimeout(() => setShown(value), duration + 400);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(failsafe);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {fmt(shown)}
    </span>
  );
}
