'use client';

import React from 'react';

import { canSmooth, frameAt, pingAgeMs, type LivePoint } from './livePosition';

/**
 * Jonli nuqtani ikkita ping ORASIDA suradigan hook.
 *
 * Matematikasi `livePosition.ts` da (u React'siz va o'lchanadi —
 * `pnpm test:live-point`), bu yerda faqat KADRLAR.
 *
 * 🔑 ANIMATSIYA JORIY KO'RINGAN NUQTADAN boshlanadi, oldingi PINGDAN
 * emas. Aks holda yangi ping animatsiya o'rtasida kelganda nuqta avval
 * orqaga sakrab, keyin oldinga yugurardi.
 *
 * ⚠️ Bu hook nuqtani faqat `to` gacha olib boradi va TO'XTAYDI. Keyingi
 * ping kechiksa u joyida turadi — «shu tezlikda davom etdi» deb chizish
 * joyni o'ylab topish bo'lardi (izohi `livePosition.ts` da).
 */
export function useLivePoint(
  target: LivePoint | null | undefined,
  {
    /**
     * Surish davomiyligi. Standart 10 000 ms — so'rov oralig'iga
     * TENG: nuqta keyingi ping kelgan payt manzilga yetadi, ya'ni
     * harakat uzluksiz ko'rinadi (tez yurib to'xtab qolmaydi).
     */
    durationMs = 10_000,
    /**
     * Serverdagi ping vaqti (`updated_at`).
     *
     * 🔑 YOSH SHU YERDA, animatsiya BOSHLANISHIDA hisoblanadi — tashqaridan
     * tayyor raqam olinmaydi. Sabab: yosh har soniyada o'zgaradi, ya'ni uni
     * prop qilib uzatsak sahifa har soniyada qayta chizilishi kerak bo'lardi
     * (yoki eskirgan raqam bilan qaror qabul qilinardi).
     */
    updatedAt = null,
  }: { durationMs?: number; updatedAt?: string | null } = {}
): LivePoint | null {
  const [shown, setShown] = React.useState<LivePoint | null>(target ?? null);

  // Kadrlar orasida o'zgaradigan qiymatlar — render'ga bog'liq emas.
  const shownRef = React.useRef<LivePoint | null>(target ?? null);
  const rafRef = React.useRef<number | null>(null);

  const lat = target?.lat;
  const lon = target?.lon;
  const heading = target?.heading ?? null;

  React.useEffect(() => {
    if (lat == null || lon == null) {
      shownRef.current = null;
      setShown(null);
      return;
    }
    const to: LivePoint = { lat, lon, heading };
    const from = shownRef.current;

    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Surib bo'lmasa (birinchi nuqta, katta sakrash, eski ping yoki
    // foydalanuvchi harakatni o'chirgan) — DARHOL o'sha joyga.
    if (reduced || !canSmooth(from, to, { staleMs: pingAgeMs(updatedAt, Date.now()) })) {
      shownRef.current = to;
      setShown(to);
      return;
    }

    const start = performance.now();
    const a = from as LivePoint;
    let lastPaint = 0;

    const step = (nowMs: number) => {
      const t = Math.min(1, (nowMs - start) / durationMs);
      const f = frameAt(a, to, t);
      shownRef.current = f;
      // ~25 kadr/soniya yetarli: nuqta 10 soniyada bir necha piksel
      // suriladi, 60 kadr esa telefon batareyasini bekorga yeydi.
      if (t >= 1 || nowMs - lastPaint > 40) {
        lastPaint = nowMs;
        setShown(f);
      }
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // `updatedAt` ATAYIN bog'liqlikda EMAS: har ping bilan u ham
    // o'zgaradi, lekin animatsiyani KOORDINATA boshlaydi. Ikkalasini
    // ham qo'ysak, joyi o'zgarmay faqat vaqti yangilangan ping
    // animatsiyani bekorga qayta ishga tushirardi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, heading, durationMs]);

  return shown;
}
