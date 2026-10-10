import React from 'react';

/**
 * Matnni so'zlarga bo'lib, ketma-ket ochadi (reactbits `SplitText` ekvivalenti).
 *
 * FARQLAR (ataylab):
 *  - HARFLAR bo'yicha emas, SO'ZLAR bo'yicha. Harf bo'yicha bo'lish bitta
 *    sarlavhani 40+ DOM tugunga aylantiradi va arzon telefonda birinchi kadr
 *    sezilarli kechikadi.
 *  - rAF yo'q: CSS `animation ... both`, ya'ni yakuniy holat kafolatlangan.
 *  - Server komponentda ham ishlaydi — hech qanday state yo'q.
 *
 * `startIndex` — ketma-ketlikni davom ettirish uchun (masalan sarlavha ikki
 * qismdan iborat bo'lsa, ikkinchisi birinchisidan keyin ochilsin).
 */
export function SplitText({
  text,
  delay = 0,
  startIndex = 0,
  className = '',
}: {
  text: string;
  /** Boshlanish kechikishi, soniyada. */
  delay?: number;
  /** Ketma-ketlik indeksining boshlang'ich qiymati. */
  startIndex?: number;
  className?: string;
}) {
  const words = text.split(' ');

  return (
    <span className={className}>
      {words.map((word, i) => (
        <React.Fragment key={`${word}-${i}`}>
          <span
            className="mo-split-word"
            style={
              {
                '--i': startIndex + i,
                ...(delay ? { '--mo-d': `${delay}s` } : {}),
              } as React.CSSProperties
            }
          >
            {word}
          </span>
          {/* Bo'shliq span'dan TASHQARIDA — aks holda qator ko'chishi buziladi. */}
          {i < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </span>
  );
}

/** Matndagi so'zlar soni — keyingi `SplitText` uchun `startIndex` hisoblashda. */
export const wordCount = (text: string) => text.split(' ').length;
