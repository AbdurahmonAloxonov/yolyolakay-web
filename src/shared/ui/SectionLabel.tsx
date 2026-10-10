'use client';

import React from 'react';
import { Islimi } from './brand/Ornament';

/**
 * BO'LIM YORLIG'I — sayt bo'ylab YAGONA ko'rinish.
 *
 * 🔴 NEGA YOZILDI (2026-09-03): bo'lim sarlavhasi har sahifada
 * ALOHIDA yozilgan edi — kimdir `text-[11px] font-black
 * tracking-wider`, kimdir `text-sm font-bold tracking-wider`, kimdir
 * `text-xs`. Bir mahsulotning sahifalari bir-biriga o'xshamasligining
 * yana bir sababi shu edi.
 *
 * Shakl ilovadagi `SectionLabel` bilan bir xil: mayda katta harfli
 * yozuv va yonida ISLIMI novdasi.
 *
 * 🔑 Nega aynan islimi: u O'ZI chiziq naqshi, ya'ni bu balandlikda
 * ishlatish kichraytirish emas, o'z o'lchamida ishlatish. Girih —
 * maydon naqshi, uni bunday joyga qo'yib bo'lmaydi. An'anada ham
 * ikkalasi yonma-yon turadi: girih GEOMETRIYA, islimi TIRIKLIK.
 */
export function SectionLabel({
  children,
  icon,
  trailing,
  className = '',
}: {
  children: React.ReactNode;
  /** Yorliq oldidagi mayda ikonka. Faqat MA'NOSI bo'lsa beriladi
   *  (masalan forma qadamining belgisi), bezak uchun emas. */
  icon?: React.ReactNode;
  /** O'ng chekkadagi ikkinchi darajali amal. Berilsa, novda undan
   *  OLDIN tugaydi. */
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* ⚠️ `min-w-0` va `shrink` ATAYIN: uzun yorliq (ruscha «ВХОД ПО
          ПАРОЛЮ» + yonida havola) tor ekranda qatorni toshirib
          yuborardi. Endi yorliq qisqarib ikki qatorga o'tadi, novda
          esa qolgan joyni oladi — toshish mumkin emas. */}
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-text-muted">
        {icon && <span className="text-accent [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        {children}
      </span>
      {/* ⚠️ Qo'shimcha shaffoflik BERILMAYDI: novda `--border` rangida
          allaqachon sokin, ustiga opacity qo'yilsa u umuman ko'rinmay
          qoladi (o'lchandi — birinchi urinishda shunday bo'ldi). */}
      <span className="min-w-0 flex-1">
        <Islimi className="h-3.5 w-full" color="var(--border)" width={104} />
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </div>
  );
}
