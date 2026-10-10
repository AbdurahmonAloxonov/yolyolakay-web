'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * `useState`, lekin qiymat `sessionStorage` da saqlanadi va komponent qayta
 * mount bo'lganda tiklanadi.
 *
 * NEGA KERAK: til URL segmenti (`/uz|/ru|/en`). Uni almashtirish butun
 * `[locale]` daraxtini qayta render qilishga majbur qiladi — bu next-intl'ning
 * URL-asosli tuzilishida muqarrar. Qayta mount esa oddiy `useState` ni
 * boshlang'ich qiymatiga qaytaradi, ya'ni foydalanuvchi kiritgan ma'lumot
 * YO'QOLADI. Landing qidiruv formasida bu shunday ko'rinardi: shahar va sanani
 * kiritasan, tilni almashtirasan — hammasi tozalanib ketadi.
 *
 * `sessionStorage` (localStorage EMAS): qiymat shu yorliq (tab) yopilgunicha
 * yashaydi. Ertaga qaytib kelgan odam eski qidiruvini emas, toza forma ko'rishi
 * kerak.
 *
 * SSR: boshlang'ich qiymat serverdagi bilan bir xil qoladi va o'qish faqat
 * mount'dan keyin bo'ladi — aks holda server "" chizib, klient saqlangan
 * qiymatni chizib, hidratsiya mos kelmasdi.
 */
/**
 * Modul darajasidagi saqlash — FAQAT XOTIRADA.
 *
 * `sessionStorage` dan farqi: hech narsa diskka yozilmaydi va sahifa haqiqatan
 * qayta yuklanganda hammasi yo'qoladi. Shuning uchun parol, OTP kabi maydonlar
 * uchun aynan shu ishlatiladi — ular React holatida qanday tursa, shunday
 * turadi, yangi saqlash joyi ochilmaydi.
 */
const memory = new Map<string, string>();

/** Bir guruh saqlangan qiymatni tozalash (masalan muvaffaqiyatli kirishdan keyin). */
export function clearRetained(prefix: string) {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

/**
 * `useState`, lekin qiymat komponent qayta mount bo'lganda tiklanadi —
 * FAQAT XOTIRA orqali (`useSessionState` dan farqi shu).
 *
 * Til almashtirilganda `[locale]` daraxti butunlay qayta mount bo'ladi va
 * oddiy `useState` boshlang'ich qiymatiga qaytadi. Login formasida bu shunday
 * ko'rinardi: telefon raqamini terasan, tilni almashtirasan — maydon bo'shab
 * qoladi (jonli tekshirildi: `+998(90) 123-45-67` -> `+998 `).
 */
export function useRetainedState(key: string, initial: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => memory.get(key) ?? initial);

  useEffect(() => {
    memory.set(key, value);
  }, [key, value]);

  return [value, setValue];
}

export function useSessionState(key: string, initial: string): [string, (value: string) => void] {
  const [value, setValue] = useState(initial);
  const skipFirstWrite = useRef(true);

  // 1. Mount'dan keyin saqlangan qiymatni tiklaymiz.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) setValue(saved);
    } catch {
      // Shaxsiy rejim yoki cheklangan WebView — saqlash yo'q, forma baribir ishlaydi.
    }
  }, [key]);

  // 2. Keyingi har bir o'zgarishda yozamiz.
  //    BIRINCHI ishga tushish O'TKAZIB YUBORILADI: u yuqoridagi effekt bilan bir
  //    commit'da bo'ladi va hali `value` eski (boshlang'ich) qiymatda turadi —
  //    yozib yuborsak, endigina tiklangan qiymatni bo'sh satr bilan o'chirardik.
  useEffect(() => {
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // yuqoridagi izohga qarang
    }
  }, [key, value]);

  return [value, setValue];
}
