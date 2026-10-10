'use client';

import React from 'react';
import { PeshtoqFrame, GirihPattern } from './brand/Ornament';
import { AtlasEdge } from './brand/Atlas';

/**
 * BO'SH HOLAT — sayt bo'ylab YAGONA ko'rinish.
 *
 * 🔴 NEGA YOZILDI (egasi, 03.09.2026: «hamma narsalarni aralashtirib
 * qo'ygansan, tartib yo'q, chiroy yo'q»).
 *
 * Saytda ellikdan ortiq komponent bor edi-yu, bo'sh holat uchun
 * BITTASI ham yo'q edi: har sahifa o'zi chizardi. Natijada qidiruvda
 * xira doira ichida pushti lupa, tariflarda boshqa narsa, chatlarda
 * yana boshqasi — bir mahsulotning o'n besh sahifasi o'n besh xil
 * ko'rinardi. Aynan shu «tartib yo'qligi» edi.
 *
 * Endi shakl bitta va u ILOVA bilan bir xil: PESHTOQ MEDALYONI —
 * to'q ravoq, ichida girih naqshi va belgi, ostida atlas jiyagi.
 * Odam uni landingda ham, ilovada ham ko'rgan.
 *
 * ⚠️ Ravoq eni 96 px dan oshmasin: u enidan 1.24 baravar baland va
 * kattarganda bo'sh holat butun ekranni egallab ketadi (ilovada
 * o'lchangan).
 */
/**
 * Faqat MEDALYON — matni o'zicha qurilgan bloklar uchun.
 *
 * 🔑 Ba'zi bo'sh holatlar shunchaki «ikonka + sarlavha + izoh» emas:
 * qidiruvdagi bo'sh natija sababga qarab boshqa-boshqa matn va bir
 * necha amal ko'rsatadi. Ularni `EmptyState` ga majburan siqish
 * mazmunni buzadi — lekin BELGISI baribir bitta bo'lishi kerak.
 */
export function PeshtoqBadge({
  icon,
  className = '',
}: {
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-24 ${className}`}>
      <div className="relative h-[119px] w-24 overflow-hidden">
        <PeshtoqFrame className="h-full w-full">
          <div className="relative h-full w-full bg-wine-ash">
            <GirihPattern size={34} color="rgba(255,255,255,0.16)" className="opacity-100" />
            <div className="absolute inset-0 flex items-center justify-center text-white [&>svg]:h-8 [&>svg]:w-8">
              {icon}
            </div>
          </div>
        </PeshtoqFrame>
      </div>
      {/* Ravoq OSTIDAGI jiyak — poydevor. Busiz ravoq havoda osilib
          turgandek ko'rinadi. */}
      <AtlasEdge className="h-[5px] w-full" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: {
  /** Ma'no belgisi — ravoq ichida oq holda chiziladi. */
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}
    >
      <PeshtoqBadge icon={icon} />

      {/* 🔴 DARAJA h3 EMAS, h2 (2026-09-04, o'lchandi): bo'sh holat
          sahifa sarlavhasidan (`h1`) keyin KELADIGAN yagona bo'lim va
          orada `h2` yo'q edi — ekran o'qigich sarlavhalar ro'yxatida
          bo'sh bo'g'in ko'rardi (h1 → h3). */}
      <h2 className="mt-5 text-base font-extrabold text-foreground">{title}</h2>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
