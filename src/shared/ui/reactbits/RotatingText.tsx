'use client';

import React, { useEffect, useState } from 'react';

/**
 * Almashib turadigan yozuv — hero chipidagi yo'nalishlar uchun.
 *
 * 🔴 NEGA QAYTA YOZILDI (10.09.2026, tezlik o'lchovi): bu komponent
 * reactbits'dan ko'chirilgan 252 qatorlik variant edi va `framer-motion`
 * ni import qilardi. Butun loyihada `framer-motion` ni ishlatadigan
 * YAGONA fayl shu edi — ya'ni landingga kirgan har bir odam katta
 * animatsiya kutubxonasini bitta bezak yozuv uchun yuklab olardi.
 *
 * Almashtirish ARZONGA tushdi, chunki eski variantning imkoniyatlaridan
 * deyarli hech nima ishlatilmasdi:
 *
 *   • `staggerDuration` standart bo'yicha **0** va chaqiruv joyi uni
 *     bermaydi — ya'ni harflar ketma-ket emas, BIRGA harakatlanardi;
 *   • `splitBy="words"` berilgan, ya'ni "harf" aslida butun so'z;
 *   • `ref` (next/previous/jumpTo/reset) hech qayerda olinmagan;
 *   • `loop`, `auto`, `staggerFrom`, `animatePresenceMode` — hammasi
 *     standart qiymatda qolgan.
 *
 * Qolgani — pastdan surilib chiqadigan so'zlar, va buni CSS o'zi
 * qiladi. Ustiga: `prefers-reduced-motion` endi ALOHIDA hisobga
 * olinmaydi ham — `globals.css` dagi umumiy qoida CSS animatsiyalarini
 * o'zi to'xtatadi, framer-motion esa buni o'zi bilishi kerak edi.
 *
 * ⚠️ BITTA KO'RINISH FARQI: ilgari eski yozuv YUQORIGA CHIQIB ketardi,
 * yangisi esa pastdan kirardi. Endi faqat KIRISH bor. Eski yozuvni ham
 * chizish uchun uni absolyut joylashtirish kerak edi, u esa yangi
 * so'zning eniga qirqilib qolardi (yo'nalish nomlari har xil uzunlikda).
 * Qutining balandligi qat'iy va `overflow-hidden` — shuning uchun
 * almashuv baribir silliq ko'rinadi.
 */
export interface RotatingTextProps {
  texts: string[];
  /** Almashish oralig'i, ms. */
  rotationInterval?: number;
  /** Tashqi o'ram klassi. */
  mainClassName?: string;
  /** Har SO'Z qutisi klassi — bu yerga `overflow-hidden` va balandlik beriladi. */
  splitLevelClassName?: string;
}

export default function RotatingText({
  texts,
  rotationInterval = 2000,
  mainClassName,
  splitLevelClassName,
}: RotatingTextProps) {
  const [index, setIndex] = useState(0);
  /*
   * BIRINCHI CHIZISHDA ANIMATSIYA YO'Q (eski `animatePresenceInitial={false}`):
   * sahifa ochilishida yozuv joyida turishi kerak, pastdan sakrab
   * kirishi emas.
   *
   * ⚠️ `useRef` EMAS, `useState`: ref ni chizish paytida O'QISH
   * React qoidasini buzadi (`react-hooks/refs`) — chizish sof
   * bo'lishi kerak. Birinchi almashuv baribir taymer ichida
   * bo'ladi, ya'ni bayroqni o'sha yerda yoqish yetarli.
   */
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (texts.length < 2) return;
    const id = setInterval(() => {
      setStarted(true);
      setIndex((i) => (i + 1) % texts.length);
    }, rotationInterval);
    return () => clearInterval(id);
  }, [texts.length, rotationInterval]);

  const current = texts[index] ?? '';
  const words = current.split(' ');

  return (
    <span
      className={['relative flex flex-wrap whitespace-pre-wrap', mainClassName]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Ekran o'qigich uchun — to'liq matn bir marta, bo'linmagan holda.
          Pastdagi so'zlarga bo'lingan nusxa esa undan YASHIRILADI, aks
          holda "Samarqand" va "Buxoro" alohida-alohida o'qilardi. */}
      <span className="sr-only">{current}</span>
      <span
        // `key` — qayta chizishga majburlaydi, ya'ni CSS animatsiyasi
        // har almashuvda boshidan ketadi.
        key={index}
        aria-hidden="true"
        className="relative flex flex-wrap whitespace-pre-wrap"
      >
        {words.map((word, i) => (
          <span key={i} className={['inline-flex', splitLevelClassName].filter(Boolean).join(' ')}>
            <span className={started ? 'rt-word inline-block' : 'inline-block'}>{word}</span>
            {i !== words.length - 1 && <span className="whitespace-pre"> </span>}
          </span>
        ))}
      </span>
    </span>
  );
}
