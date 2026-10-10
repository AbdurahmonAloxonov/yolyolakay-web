'use client';

import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  /**
   * Yozuv YONIDA turganda beriladigan nom.
   *
   * 🔴 NEGA KERAK (2026-09-04, o'lchandi): kalitlar ko'pincha qator
   * ichida turadi — chapda «Konditsioner», o'ngda kalit. KO'Z ularni
   * bir juft deb biladi, ekran o'qigich esa BILMAYDI: yozuv boshqa
   * elementda va kalit ichida hech nima yo'q. Natijada o'qigich
   * «belgilash katakchasi» deb o'qirdi, xolos.
   *
   * `label` bergan bo'lsangiz bu kerak emas — u kalit ICHIDA turadi.
   */
  ariaLabel?: string;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
}) => {
  return (
    <label
      className={`inline-flex items-center gap-3 cursor-pointer select-none group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="relative flex items-center">
        <input
          type="checkbox"
          aria-label={label ? undefined : ariaLabel}
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          className="sr-only peer"
          disabled={disabled}
        />
        {/* Track */}
        <div
          className={`w-12 h-7 rounded-full transition-colors duration-300 ease-in-out shadow-inner ${
            checked ? 'bg-accent' : 'bg-border/60 dark:bg-bg'
          }`}
        />
        {/* Thumb */}
        <div
          className={`absolute left-0.5 top-0.5 w-6 h-6 bg-white rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      {label && (
        <span className="text-sm font-bold text-text transition-colors group-active:text-accent/80">
          {label}
        </span>
      )}
    </label>
  );
};
