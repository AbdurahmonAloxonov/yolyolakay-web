'use client';

import { useEffect, useState } from 'react';

/**
 * XARITA CHIZIQLARINING RANGI — brend tokenlaridan, JS orqali o'qib.
 *
 * 🔴 NEGA SHUNDAY (17.09.2026, jonli tekshiruvda tutildi): men chiziq
 * rangini `pathOptions.className` orqali bermoqchi bo'ldim (belgilar
 * uchun `var(--accent)` ishlagani uchun). Chiziqda bu ISHLAMADI —
 * o'lchandi: `path` elementida faqat `leaflet-interactive` klassi
 * qoldi va `stroke` LEAFLET'NING STANDART KO'KI (`rgb(51,136,255)`)
 * bo'lib chiqdi. Ya'ni saytdagi HAMMA marshrut chizig'i begona ko'k
 * rangga o'tib ketgan edi.
 *
 * Sabab: Leaflet chiziq rangini SVG atributiga yozadi va react-leaflet
 * `pathOptions` ni `setStyle` bilan qo'llaydi — u `className` ni
 * bilmaydi.
 *
 * Yechim: tokenni JS'da O'QIYMIZ va oddiy `color` qilib beramiz. Tema
 * almashsa (`<html class="dark">`) qiymat qayta o'qiladi — kuzatuvchi
 * shuning uchun kerak.
 *
 * ⚠️ SSR'da `getComputedStyle` yo'q, shuning uchun boshlang'ich qiymat
 * — tokenlarning o'zidagi standart ranglar (`globals.css` bilan bir xil
 * bo'lishi shart).
 */
export interface MapColors {
  accent: string;
  soft: string;
  muted: string;
  /** «Men shu yerdaman» — ko'k nuqta va uning aniqlik doirasi. */
  me: string;
}

const FALLBACK: MapColors = {
  accent: '#C71578',
  soft: '#99E1D9',
  muted: '#6B6570',
  me: '#2F6BFF',
};

function read(): MapColors {
  if (typeof window === 'undefined') return FALLBACK;
  const s = getComputedStyle(document.documentElement);
  const pick = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
  return {
    accent: pick('--accent', FALLBACK.accent),
    soft: pick('--turquoise', FALLBACK.soft),
    muted: pick('--text-muted', FALLBACK.muted),
    me: pick('--my-location', FALLBACK.me),
  };
}

export function useMapColors(): MapColors {
  const [colors, setColors] = useState<MapColors>(FALLBACK);

  useEffect(() => {
    setColors(read());
    // Tema `<html>` klassi bilan almashadi (`dark`, `neon`).
    const mo = new MutationObserver(() => setColors(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  return colors;
}
