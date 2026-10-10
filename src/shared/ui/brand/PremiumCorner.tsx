import React from 'react';

/**
 * Premium karta burchak bezagi — juda kichik geometrik motiv (spec 3-bo'lim).
 * FAQAT premium (wine-ash) tarif kartalarida. Statik SVG, bitta rangda (turquoise).
 */
export function PremiumCorner({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="60"
      height="60"
      viewBox="0 0 60 60"
      fill="none"
      stroke="var(--turquoise)"
      strokeWidth="1.4"
      className={`pointer-events-none absolute bottom-0 right-0 ${className}`}
      style={{ opacity: 0.45 }}
    >
      {/* Diagonal geometrik shtrix + kichik romb — minimal milliy tuyg'u */}
      <path d="M60 26 L26 60 M60 38 L38 60 M60 50 L50 60" strokeLinecap="round" />
      <path d="M60 14 L46 28 L60 42 Z" fill="var(--turquoise)" stroke="none" opacity="0.5" />
    </svg>
  );
}
