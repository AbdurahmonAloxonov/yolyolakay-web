import { Car } from 'lucide-react';

/**
 * Brend belgisi — pushti plitka + oq mashina konturi.
 *
 * Ayni shu shakl mobil ilova ikonida (`assets/brand/icon.png`), PWA ikonlarida
 * (`public/icon-*.png`, `icon.svg`) va favicon'da ishlatiladi — sayt, PWA va
 * ilova bitta belgini ko'rsatishi uchun shu komponent yagona manba.
 *
 * O'lchamlar ilova ikonidan olingan: mashina plitkaning ~61% ini egallaydi
 * (`icon.svg` dagi `scale(13)` ga teng).
 *
 * Chiziq qalinligi esa ATAYIN o'lchamga bog'liq. Ilova ikonidagi 1.7 qiymati
 * 1024px plitkada to'g'ri, lekin 32-36px header belgisida u 0.8px ga tushib
 * xiralashadi. Shuning uchun kichik o'lchamda qalinroq olinadi — favicon uchun
 * ham xuddi shu sabab kontur qalinlashtirilgan (`scripts` emas, favicon.ico).
 */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  const strokeWidth = size <= 48 ? 2.4 : 1.7;

  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-pink text-white ${className}`}
    >
      <Car size={Math.round(size * 0.61)} strokeWidth={strokeWidth} aria-hidden />
    </span>
  );
}
