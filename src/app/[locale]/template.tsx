'use client';

import { usePathname } from 'next/navigation';

/**
 * Sahifalar orasidagi o'tish animatsiyasi.
 *
 * `key={pathname}` MAJBURIY — busiz ishlamaydi. `template.tsx` navigatsiyada
 * qayta mount bo'ladi, lekin React o'sha turdagi va o'sha o'rindagi DOM
 * tugunini QAYTA ISHLATADI. CSS animatsiya esa element qayta yaratilgandagina
 * boshidan yuradi — natijada o'tish ko'zga umuman tashlanmasdi.
 *
 * Jonli o'lchov (prod, 2026-08-06): navigatsiyadan keyin o'ram elementi ayni
 * o'sha tugun bo'lib qolardi (`before === after`), animatsiya esa URL
 * o'zgarishidan oldin boshlanib, ESKI kontentga sarflanardi — yangi sahifa
 * animatsiyasiz paydo bo'lardi.
 *
 * `key` bilan: yo'l o'zgarishi bilan React eski divni tashlaydi va yangisini
 * quradi, animatsiya yangi kontent bilan birga boshlanadi.
 *
 * Klient komponent bo'lishi shart (`usePathname`), lekin bu narx tug'dirmaydi:
 * ichidagi sahifalar server komponentligicha qoladi — ular `children` sifatida
 * uzatiladi, klient chegarasidan o'tmaydi.
 *
 * `flex-1 flex flex-col` — `layout.tsx` dagi `<main>` flex-ustun; bu o'ram
 * balandlikni o'tkazib yuborishi kerak, aks holda `min-h-screen` ishlatadigan
 * sahifalar siqilib qolardi.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="mo-page flex flex-1 flex-col">
      {children}
    </div>
  );
}
