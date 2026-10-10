import React from 'react';

/**
 * Tasdiqlash animatsiyasi — suzani rozetkasi barg-barg ochiladi.
 *
 * NEGA CHEKBELGI EMAS: yashil doiradagi "✓" har qanday saytda bor va brendga
 * hech narsa qo'shmaydi. Suzani guli esa loyihaning milliy motiv tizimidan
 * (`OrnamentMark`, `GirihPattern`, `PremiumCorner` bilan bir oilada) va ayni
 * paytda "ochilish / yakunlanish" ma'nosini beradi — ariza yuborilganda
 * kutilayotgan his aynan shu.
 *
 * QOIDALARGA MOSLIGI: faqat `opacity` + `transform`. Har barg o'z navbatida
 * ochiladi (`--i` indeksi orqali, JS taymersiz), markazi eng oxirida bosiladi.
 * Animatsiya BIR MARTA yuradi va `both` bilan tugaydi — takrorlanmaydi,
 * cheksiz sikl yo'q. `prefers-reduced-motion` da darhol yakuniy holat.
 *
 * `tone`:
 *   `pending`  — ariza tekshiruvda (turkuaz, tinch)
 *   `approved` — tasdiqlandi (pushti, brend CTA rangi — bayram ohangi)
 */
export function SuzaniBloom({
  tone = 'pending',
  className = '',
}: {
  tone?: 'pending' | 'approved';
  className?: string;
}) {
  const color = tone === 'approved' ? 'var(--brand-pink)' : 'var(--turquoise)';
  const petals = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div aria-hidden className={`sz-bloom ${className}`}>
      <svg width="112" height="112" viewBox="0 0 40 40" fill="none" stroke={color}>
        <g strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          {/* Aylanish O'ROVCHI `<g>` da, animatsiya esa ellipsning o'zida.
              Ikkalasini bitta elementga qo'yib bo'lmaydi: `transform-origin`
              (animatsiya uchun kerak) `transform` atributidagi `rotate` ga ham
              ta'sir qiladi va barglar boshqa markaz atrofida burilib, guldan
              tarqab ketadi. Jonli o'lchovda 8 tadan 6 tasi SVG chegarasidan
              chiqib ketgani shundan edi. */}
          {petals.map((deg, i) => (
            <g key={deg} transform={`rotate(${deg} 20 20)`}>
              <ellipse
                cx="20"
                cy="9"
                rx="3.2"
                ry="6.5"
                className="sz-petal"
                style={{ '--i': i } as React.CSSProperties}
              />
            </g>
          ))}
          <circle cx="20" cy="20" r="3.4" fill={color} stroke="none" className="sz-core" />
        </g>
      </svg>
    </div>
  );
}
