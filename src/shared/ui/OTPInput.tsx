'use client';

import React, { useRef, useEffect } from 'react';
import { Check } from 'lucide-react';

/**
 * SMS kodini kiritish — beshta katak va tasdiq uchun YASHIL yonish.
 *
 * 🔴 NEGA SODDALASHTIRILDI (egasi, 2026-09-07: "otp animationni oddiy qilib
 * shunchaki yashil yonib tekshirishni tasdiqlaydigan qilaylik, hozirgi
 * animation qotib qotib ishlayapti").
 *
 * Bundan oldin bu yerda «yo'ldagi bekatlar» turardi: kataklar ostida punktir
 * yo'l, unda bekatdan bekatga yuradigan mashina, egzoz tutuni, tasdiq paytida
 * esa kataklarni "devor" deb buzib o'tadigan katta mashina, 5×8 ta uchib
 * chiquvchi parcha va manzil rozetkasi. Ilovada aynan shu shakl har kadrda
 * qayta chizilardi va kuchsizroq telefonda kadr tushirardi.
 *
 * ⚠️ IKKALA MIJOZDA BIR KUNDA: bu shakl saytda ham, ilovada ham bitta edi.
 * Egasi motivni rad etganda u ikkala mijozdan ham o'sha kuni olib tashlanadi
 * — ilgari rad etilgan romb saytda oltita faylda tirik qolib ketgan edi.
 * Flutter tomondagi juftligi — `otp_code_field.dart`.
 *
 * ENDI: kod to'g'ri ekani tasdiqlanganda kataklar yashilga o'tadi (bitta
 * `transition-colors`, 200 ms) va ostida yashil belgi chiqadi. Xatoda qator
 * qizarib bir marta chayqaladi.
 *
 * ⚠️ YASHIL FAQAT BELGI VA CHEGARADA, YOZUVDA EMAS: `--verified` oq zaminda
 * 3.05:1 beradi — ikonka/chegara uchun yetadi (kerak 3:1), mayda yozuv uchun
 * yetmaydi (kerak 4.5:1). Shuning uchun yozuv oddiy rangda qoladi.
 *
 * QOIDALARGA MOSLIGI: faqat `transform`/`opacity`/rang o'tishi, cheksiz sikl
 * yo'q, `prefers-reduced-motion` global qoida bilan o'chadi.
 */

interface OTPInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
  /**
   * Tasdiqlash natijasi.
   *
   * `success` — kod TO'G'RI: kataklar yashil yonadi va ostida tasdiq belgisi
   * chiqadi. Bu holat chaqiruvchida bir necha yuz millisekund ushlab
   * turilishi kerak, aks holda sahifa rang o'tishi ko'rinmasdan almashadi.
   */
  status?: 'idle' | 'success';
  /**
   * Tasdiq belgisining yozuvi. Uch tilda — chaqiruvchi `tr(...)` bilan
   * beradi. ⚠️ Bu yerga matnni QOTIRIB yozib bo'lmaydi: komponent tilni
   * bilmaydi va sayt uch tilda ishlaydi.
   */
  confirmLabel?: string;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length,
  value,
  onChange,
  error = false,
  disabled = false,
  status = 'idle',
  confirmLabel,
}) => {
  const inputsRef = useRef<HTMLInputElement[]>([]);

  // Разделяем строку на массив символов
  const valuesArray = value.split('').concat(Array(length).fill('')).slice(0, length);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (!val) return;

    const newValues = [...valuesArray];
    newValues[index] = val.slice(-1); // Берем последний символ
    const combinedValue = newValues.join('');
    onChange(combinedValue);

    // Автофокус на следующую ячейку
    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      const newValues = [...valuesArray];
      if (newValues[index]) {
        newValues[index] = '';
        onChange(newValues.join(''));
      } else if (index > 0) {
        newValues[index - 1] = '';
        onChange(newValues.join(''));
        inputsRef.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData('text')
      .replace(/[^0-9]/g, '')
      .slice(0, length);
    if (pastedData) {
      onChange(pastedData);
      const focusIndex = Math.min(pastedData.length, length - 1);
      inputsRef.current[focusIndex]?.focus();
    }
  };

  // Автофокус на первую пустую ячейку при загрузке
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const ok = status === 'success';

  return (
    <div className={`w-full ${error ? 'otp-shake' : ''}`}>
      <div className="flex justify-center">
        <div className="flex gap-3" onPaste={handlePaste}>
          {Array.from({ length }).map((_, index) => {
            const isFilled = !!valuesArray[index];
            return (
              <input
                key={index}
                ref={(el) => {
                  if (el) inputsRef.current[index] = el;
                }}
                type="text"
                maxLength={1}
                value={valuesArray[index] || ''}
                onChange={(e) => handleChange(e, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                disabled={disabled}
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={`${index + 1}`}
                data-filled={isFilled}
                style={{ '--i': index } as React.CSSProperties}
                className={`otp-cell w-12 h-14 shrink-0 text-center text-xl font-bold rounded-xl border bg-surface outline-none transition-colors duration-200 select-none ${
                  error
                    ? 'border-error focus:border-error focus:ring-4 focus:ring-error/20'
                    : ok
                      ? 'otp-ok border-2'
                      : isFilled
                        ? 'border-accent text-foreground'
                        : 'border-border focus:border-accent focus:ring-4 focus:ring-accent/20'
                } disabled:opacity-50`}
              />
            );
          })}
        </div>
      </div>

      {/* Tasdiq belgisi. Balandlik DOIM band — belgi chiqqanda ostidagi
          tugma sakramasin. */}
      <div
        className={`mt-2 flex h-5 items-center justify-center gap-1.5 text-sm transition-opacity duration-200 ${
          ok ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden={!ok}
      >
        <Check className="otp-ok-icon h-4 w-4" strokeWidth={3} />
        <span className="text-text-muted">{confirmLabel}</span>
      </div>
    </div>
  );
};
