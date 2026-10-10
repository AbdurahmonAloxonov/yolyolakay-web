/**
 * XARITA PLITKALARI — PROVAYDERNI ALMASHTIRISH YAGONA JOYI.
 *
 * 🔴 NEGA (18.09.2026): manzil TO'QQIZTA faylda qo'lda takrorlangan edi
 * va hammasi `tile.openstreetmap.org` ga ketardi. OSM Foundation'ning
 * qoidasi ommaviy mahsulotga ruxsat bermaydi (heavy use) — bloklansa
 * xaritalar bir vaqtda bo'm-bo'sh kulrang bo'lib qolardi, almashtirish
 * esa to'qqizta faylni qo'lda tahrirlash degani bo'lardi.
 *
 * Endi `.env` dagi bitta o'zgaruvchi yetarli (ilovada ham xuddi shu
 * qoida — `core/env.dart`, ikkalasi bir paytda almashtirilsin):
 *
 *   NEXT_PUBLIC_MAP_TILES_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}
 *   NEXT_PUBLIC_MAP_TILES_KEY=<kalit>
 *   NEXT_PUBLIC_MAP_TILES_ATTRIBUTION=© MapTiler
 *   NEXT_PUBLIC_MAP_TILES_DARK_URL=...streets-v2-dark...   (ixtiyoriy)
 *
 * ⚠️ Kalit brauzerga tushadi, ya'ni u SIR EMAS — provayder panelida
 * uni domen (referer) bo'yicha cheklash SHART.
 */

import { useEffect, useState } from 'react';

const DEFAULT_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/*
 * 🔴 QIYMATLAR AYNAN SHU KO'RINISHDA O'QILADI — `process.env[nom]`
 * BILAN EMAS (18.09.2026 da tutildi).
 *
 * Next.js `NEXT_PUBLIC_*` larni brauzer paketiga QIDIRIB-ALMASHTIRISH
 * bilan qo'yadi va u faqat TO'G'RIDAN yozilgan `process.env.NEXT_PUBLIC_X`
 * ni taniydi. O'zgaruvchi nomini hisoblab yozsak (`process.env[name]`),
 * brauzerda qiymat BO'SH bo'lib qoladi: sozlama serverda ishlab,
 * odamning ekranida ishlamasdi — ya'ni «almashtirdik» degan da'vo
 * yolg'on chiqardi va buni faqat prodda sezardik.
 */
const RAW = {
  url: process.env.NEXT_PUBLIC_MAP_TILES_URL,
  darkUrl: process.env.NEXT_PUBLIC_MAP_TILES_DARK_URL,
  key: process.env.NEXT_PUBLIC_MAP_TILES_KEY,
  attribution: process.env.NEXT_PUBLIC_MAP_TILES_ATTRIBUTION,
} as const;

const env = (name: keyof typeof RAW): string => (RAW[name] ?? '').trim();

/**
 * Plitka manzili. `{key}` o'rniga kalit qo'yiladi; kalit bo'lmasa o'rin
 * O'CHIRILADI — aks holda so'rov `key={key}` bo'lib provayder 403 berardi.
 *
 * @param dark tungi uslub so'ralyaptimi (provayderning o'zi bersa).
 */
export function tileUrl(dark = false): string {
  const darkUrl = env('darkUrl');
  const base = dark && darkUrl ? darkUrl : env('url') || DEFAULT_URL;
  return base.replaceAll('{key}', env('key'));
}

/** Provayderning O'Z tungi uslubi bormi — bo'lsa CSS filtri keraksiz. */
export const hasProviderDarkTiles = (): boolean => env('darkUrl') !== '';

/**
 * Attributsiya — litsenziya TALABI, olib tashlanmasin.
 *
 * OSM havolasi HAR DOIM qoladi: deyarli barcha provayderlar OSM
 * ma'lumoti ustida ishlaydi va ODbL buni talab qiladi. Provayder nomi
 * berilsa, uning oldiga qo'shiladi — ya'ni xarita almashsa yozuv ham
 * o'zi to'g'rilanadi (ilgari to'qqiz joyda eski nom qolib ketardi).
 */
export function tileAttribution(): string {
  const osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const provider = env('attribution');
  return provider ? `${provider} · ${osm}` : osm;
}

/**
 * O'ROVCHI o'zi chizadigan attributsiya — ODDIY MATN.
 *
 * ⚠️ Ba'zi xaritalarda Leaflet'ning o'z yozuvi O'CHIRILGAN
 * (`attributionControl={false}`): u 14 px havola yasaydi va barmoq
 * nishoni qoidasidan (44 px) kichik bo'lib auditga tushardi. Bunday
 * joyda yozuvni o'rovchining o'zi chizadi — va u ham SHU yerdan
 * o'qisin, aks holda provayder almashganda eski nom qolib ketardi.
 */
export function tileAttributionText(): string {
  const provider = env('attribution');
  return provider ? `${provider} · © OpenStreetMap` : '© OpenStreetMap';
}

/** Provayder tungi uslubi ishlatilgan plitkalar — CSS filtri ULARGA TEGMASIN. */
export const PROVIDER_DARK_CLASS = 'map-tiles-provider-dark';

/**
 * Joriy temaga mos plitka manzili.
 *
 * 🔴 NEGA HOOK: tema `<html class="dark">` bilan almashadi va xarita
 * buni O'ZI bilishi kerak — ilgari plitka DOIM yorug' kelardi, tungi
 * ko'rinish esa CSS filtri bilan yasalardi (`globals.css`). Filtr
 * provayderning TAYYOR tungi uslubidan qo'polroq: yozuvlar xiralashadi.
 *
 * ⚠️ Provayder tungi manzili berilmagan bo'lsa hammasi AVVALGIDEK
 * qoladi — yorug' plitka + CSS filtri. Ya'ni bu o'zgarish standart
 * yig'ilishda hech nimani buzmaydi.
 */
export function useTileUrl(): { url: string; className?: string } {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains('dark'));
    read();
    // `useMapColors` dagi AYNI usul — tema klassi kuzatiladi.
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  const providerDark = dark && hasProviderDarkTiles();
  return {
    url: tileUrl(providerDark),
    className: providerDark ? PROVIDER_DARK_CLASS : undefined,
  };
}
