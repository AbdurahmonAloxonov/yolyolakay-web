'use client';

import React from 'react';
import { Star } from 'lucide-react';

/**
 * Yulduzli reyting — ham KO'RSATISH (read-only), ham TANLASH (onChange bergan bo'lsa).
 * To'ldirilgan yulduz — amber (warning); bo'sh — muted chegara.
 */
export function StarRating({
  value,
  onChange,
  size = 18,
  className = '',
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  className?: string;
}) {
  const interactive = typeof onChange === 'function';
  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role={interactive ? 'radiogroup' : undefined}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value);
        const star = (
          <Star
            style={{ width: size, height: size }}
            className={filled ? 'text-warning' : 'text-border'}
            fill={filled ? 'var(--warning)' : 'none'}
            strokeWidth={2}
          />
        );
        return interactive ? (
          <button
            key={i}
            type="button"
            aria-label={`${i}`}
            onClick={() => onChange!(i)}
            className="p-0.5 transition-transform duration-150 hover:scale-110 active:scale-95"
          >
            {star}
          </button>
        ) : (
          <span key={i}>{star}</span>
        );
      })}
    </div>
  );
}

/** Kichik ko'rinish — o'rtacha reyting raqami bilan (masalan ⭐ 4.8). Reyting yo'q bo'lsa null. */
export function RatingBadge({
  rating,
  count,
  className = '',
}: {
  rating?: number | null;
  count?: number | null;
  className?: string;
}) {
  if (rating == null || rating <= 0) return null;
  /*
   * 🔴 RANG BU YERDA QOTIRILMAYDI (2026-09-04). Ilgari `text-foreground`
   * yozilgan edi va bu profil sarlavhasida reytingni KO'RINMAS qilardi:
   * peshtoq to'q (`bg-wine-ash` = #32292f), yorug' temada `foreground`
   * ham AYNAN #32292f — ya'ni kontrast 1.00:1, matn zamin bilan bir xil.
   * `className` bilan ustidan bosib bo'lmasdi: ikkala sinf ham bir xil
   * xususiyatga tegadi va g'olibni CSS TARTIBI hal qiladi, atribut
   * tartibi emas. Yechim — rangni ota-onadan MEROS qilib olish.
   */
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold ${className}`}>
      <Star className="h-3.5 w-3.5 text-warning" fill="var(--warning)" strokeWidth={2} />
      {rating.toFixed(1)}
      {count ? <span className="font-medium opacity-70">({count})</span> : null}
    </span>
  );
}
