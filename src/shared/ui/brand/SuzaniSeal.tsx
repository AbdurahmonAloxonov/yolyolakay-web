import React from 'react';
import { ATLAS_COLORS } from '@/shared/ui/brand/Atlas';

/**
 * SHAXSIY SUZANI MUHRI — rasmsiz foydalanuvchi uchun generativ avatar (SVG).
 *
 * 🔴 Ilova `lib/features/shared/brand/suzani_avatar.dart` bilan AYNAN bir xil
 * hash, rang tanlash tartibi va geometriya — bir foydalanuvchi SAYTDA ham
 * ILOVADA ham BIR XIL muhr oladi. Sayt va ilova bitta mahsulot degan qoida
 * shu yerda ham (qarang: `Ornament.tsx` izohi).
 *
 * 🔴 RANG VA SHAKL QAYTA QURILDI (2026-09-03): ilgari rang HSL bo'yicha
 * 175°–285° oralig'idan olinardi va yarmi BINAFSHA edi — muhrlar «ochiq
 * rangli romashka»ga o'xshab, saytning naqsh tilidan (girih, peshtoq,
 * atlas) ajralib turardi. Ilovada bu tuzatilgandi, sayt esa eski
 * ko'rinishda qolgan edi: BIR ODAM IKKI JOYDA IKKI XIL muhr olardi.
 * Endi rang XONATLAS ranglaridan, shakl esa PAXTA GULI.
 *
 * Determinizm: FNV-1a hash (JS `hashCode` yo'q, Dart bilan bir xil algoritm).
 */
function fnv(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    /*
     * 🔴 `Math.imul` — ODDIY `*` EMAS (o'lchandi 2026-09-03).
     *
     * Dart'da butun son 64 bitli va ko'paytma aniq chiqadi. JS'da esa
     * son 2^53 dan oshsa PASTKI BITLAR YO'QOLADI, bu yerda esa
     * ko'paytma har qadamda ~2^55 ga yetadi. Natijada sayt va ilova
     * bir xil kod yozilgan bo'lsa ham BOSHQA-BOSHQA son chiqarardi:
     * test foydalanuvchisida sayt 1188735084, ilova 1028099390 —
     * ya'ni bir odam ikki joyda ikki xil muhr olardi (izohda esa
     * «aynan bir xil» deb yozib qo'yilgandi).
     *
     * `Math.imul` ko'paytmaning pastki 32 bitini ANIQ beradi, 31 bitli
     * niqobdan keyin natija Dart bilan bit-ma-bit teng (tekshirildi).
     */
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619) & 0x7fffffff;
  }
  return h;
}

/**
 * Koordinatani UCH XONAGACHA yaxlitlaydi.
 *
 * 🔴 NEGA SHART (16.09.2026, hidratsiya ogohlantirishi orqali topildi):
 * `Math.cos`/`Math.sin` ning aniqligi ECMAScript standartida
 * BELGILANMAGAN — har dvigatel o'z algoritmini ishlatishi mumkin.
 * Natijada bitta seed uchun server va brauzer OXIRGI BITDA farq
 * qiladigan son chiqarardi:
 *
 *     server  cx="67.60293805624654"
 *     brauzer cx={67.60293805624653}
 *
 * React buni hidratsiya nomuvofiqligi deb hisoblaydi va «This won't be
 * patched up» deydi. Ko'z bilan farq bilinmaydi, lekin ogohlantirish
 * konsolni to'ldiradi va HAQIQIY nomuvofiqliklarni ko'mib yuboradi.
 *
 * 🔑 Bu ILOVA bilan mosligini ham mustahkamlaydi: Dart'ning `cos`i ham
 * JS'niki bilan oxirgi bitda farq qilishi mumkin edi, holbuki qoida —
 * bir odam saytda ham, ilovada ham AYNAN bir xil muhr olishi.
 *
 * Uch xona yetarli: `viewBox` 0..100, ya'ni 0.001 birlik har qanday
 * o'lchamda pikseldan kichik.
 */
const q = (v: number): number => Math.round(v * 1000) / 1000;

/** `#RRGGBB` ni oqqa qorishtiradi (Dart'dagi `Color.lerp(c, white, t)`). */
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${mix((n >> 16) & 255)} ${mix((n >> 8) & 255)} ${mix(n & 255)})`;
}

export const SuzaniSeal: React.FC<{ seed: string; size?: number }> = ({ seed, size = 48 }) => {
  const h = fnv(seed);

  /*
   * ===== RANG — XONATLAS RANGLARIDAN TERILADI =====
   *
   * Tayyor terma OLINMAYDI: termalar atigi uchta, hash bittasiga tushib
   * qolsa hamma muhr bir xil chiqadi (ilovada aynan shunday bo'lgandi).
   * To'rtta rang yettitadan alohida-alohida teriladi va olingani
   * ro'yxatdan chiqariladi — 7×6×5 = 210 uyg'unlik, ranglar hech qachon
   * ustma-ust tushmaydi va gul «yo'qolib» qolmaydi.
   */
  const bag = [
    ATLAS_COLORS.crimson,
    ATLAS_COLORS.saffron,
    ATLAS_COLORS.turquoise,
    ATLAS_COLORS.indigo,
    ATLAS_COLORS.pink,
    ATLAS_COLORS.ink,
    ATLAS_COLORS.ivory,
  ];
  const pick = (salt: number) => bag.splice(Math.floor(h / salt) % bag.length, 1)[0];

  // ⚠️ BARG hech qachon IVORY bo'lmaydi (ro'yxatdagi oxirgi rang): och barg
  // och zaminda yo'qoladi va muhr «bo'sh doira» bo'lib qoladi.
  const petalColor = bag.splice(h % (bag.length - 1), 1)[0];
  const innerColor = pick(7);
  const coreColor = pick(53);
  const groundColor = pick(211);

  // viewBox 0..100, markaz 50,50, r=50 (Dart nisbatlariga mos).
  const r = 50;
  const cx = 50;
  const cy = 50;

  // ===== PAXTA BARGLARI: 5..8 ta, seed'dan =====
  // ⚠️ Barg YUMALOQ: paxta ko'sagi shunday ochiladi.
  const petals = 5 + (h % 4);
  const rot = ((h % 30) * Math.PI) / 180;
  const outer: React.ReactElement[] = [];
  const inner: React.ReactElement[] = [];
  for (let i = 0; i < petals; i++) {
    const a = rot + (2 * Math.PI * i) / petals - Math.PI / 2;
    outer.push(
      <circle
        key={`o${i}`}
        cx={q(cx + r * 0.44 * Math.cos(a))}
        cy={q(cy + r * 0.44 * Math.sin(a))}
        r={r * 0.3}
        fill={petalColor}
      />
    );
    if (h % 2 === 0) {
      const a2 = rot + Math.PI / petals + (2 * Math.PI * i) / petals - Math.PI / 2;
      inner.push(
        <circle
          key={`i${i}`}
          cx={q(cx + r * 0.26 * Math.cos(a2))}
          cy={q(cy + r * 0.26 * Math.sin(a2))}
          r={r * 0.17}
          fill={innerColor}
        />
      );
    }
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: 'block' }}>
      {/* Zamin — tanlangan rangning juda och tusi: muhr oq karta ustida
          turadi, ya'ni zamini yorug' bo'lishi shart, lekin u ham matoning
          rangidan. */}
      <circle cx={cx} cy={cy} r={r} fill={lighten(groundColor, 0.82)} />
      {outer}
      {inner}
      {/* ===== URUG' — markaz ===== */}
      <circle cx={cx} cy={cy} r={r * 0.2} fill={coreColor} />
      <circle cx={cx} cy={cy} r={r * 0.09} fill={groundColor} />
    </svg>
  );
};
