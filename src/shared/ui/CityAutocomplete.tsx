'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Input } from './Input';
import { useDebounce } from '@/shared/lib/useDebounce';
import { stripUzCase } from '@/shared/lib/geo';
import { searchCities } from '@/shared/data/uzCities';
import { MapPin } from 'lucide-react';

/**
 * Shahar avtomatik to'ldirish (autocomplete) — OpenStreetMap Nominatim orqali.
 * Backend qidiruvi KOORDINATA bilan ishlagani uchun, foydalanuvchi shahar tanlaganda
 * uning lat/lon'i ham olinadi (onSelect). `onBestMatch` esa yozilayotganda eng mos
 * shaharning koordinatasini avtomatik beradi (tanlanmasa ham qidiruv to'g'ri origin'dan boradi).
 */
interface Suggestion {
  name: string;
  lat: number;
  lon: number;
}

const ADMIN_SUFFIX =
  /\s+(shahri|shahar|viloyati|viloyat|tumani|tuman|district|region|city|oblast)$/i;

const cleanName = (a: Record<string, string>, display: string): string => {
  const raw =
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.county ||
    a.state_district ||
    a.region ||
    a.state ||
    display.split(',')[0] ||
    '';
  return String(raw).replace(ADMIN_SUFFIX, '').trim() || display.split(',')[0];
};

interface Props {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (text: string) => void;
  onSelect: (name: string, lat: number, lon: number) => void;
  /** Yozilayotganda eng mos (1-chi) shahar koordinatasi — tanlanmasa ham origin to'g'ri bo'lsin. */
  onBestMatch?: (lat: number, lon: number) => void;
  /**
   * Qiymat TASHQARIDAN qo'yilgan bo'lsa — taklif ro'yxati ochilmasin.
   *
   * 🔴 NEGA (17.09.2026, xarita bo'limida ko'z bilan ko'rildi): xaritadan
   * shahar bosilganda maydon qiymati dastur tomonidan o'zgaradi va
   * komponent buni «odam yozyapti» deb o'qib, taklif ro'yxatini ochardi —
   * ro'yxat esa formaning qolgan qismini (ikkinchi shahar, sana) yopib
   * qo'yardi. Ya'ni bir amal ikkinchisini to'sardi.
   *
   * Standart qiymati `false` — boshqa sahifalarda xatti-harakat
   * o'zgarmaydi.
   */
  suppressSuggestions?: boolean;
}

export function CityAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  onBestMatch,
  suppressSuggestions = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const justSelected = useRef(false);
  const debounced = useDebounce(value, 400);

  useEffect(() => {
    // Qiymat tashqaridan qo'yildi (xaritadan tanlandi / manzil qatoridan
    // keldi) — ro'yxat ochilmaydi va so'rov ham yuborilmaydi.
    if (suppressSuggestions) {
      setOpen(false);
      return;
    }
    // Tanlangandan keyin qayta so'rov yubormaymiz (dropdown yopiq qolsin).
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    const q = stripUzCase(debounced.trim());
    if (q.length < 2) {
      setItems([]);
      return;
    }
    let cancelled = false;

    // 1) Curated (barqaror koordinatali) shaharlar — DARHOL, tarmoqsiz. Bu ma'lum shahar
    // e'lon va qidiruvda AYNAN bir koordinataga tushishini kafolatlaydi (radius mos keladi).
    const curated: Suggestion[] = searchCities(debounced.trim()).map((c) => ({
      name: c.name,
      lat: c.coord[0],
      lon: c.coord[1],
    }));
    if (curated.length > 0) {
      setItems(curated);
      setOpen(true);
      // Eng mos curated shaharning barqaror koordinatasini beramiz.
      if (onBestMatch) onBestMatch(curated[0].lat, curated[0].lon);
    }

    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=uz&accept-language=uz&limit=6&q=${encodeURIComponent(q)}`
    )
      .then((r) => r.json())
      .then(
        (
          data: Array<{
            display_name?: string;
            lat: string;
            lon: string;
            address?: Record<string, string>;
          }>
        ) => {
          if (cancelled) return;
          // Curated shaharlar ro'yxat boshida turadi; Nominatim faqat ro'yxatda YO'Q
          // joylarni (qishloq/aniq nuqta) qo'shadi.
          const seen = new Set<string>(curated.map((c) => c.name.toLowerCase()));
          const list: Suggestion[] = [...curated];
          for (const d of Array.isArray(data) ? data : []) {
            const a = d.address || {};
            // FAQAT shahar/aholi punkti darajasidagi natijalar. Mahalla/ko'cha/POI kabi
            // sub-obyektlarda bu maydonlar bo'lmaydi — ularni tashlab yuboramiz, aks holda
            // "Toshkent" o'rniga "Kashgar mahalla" chiqib qolardi.
            const settlement =
              a.city ||
              a.town ||
              a.village ||
              a.municipality ||
              a.county ||
              a.state_district ||
              a.region ||
              a.state;
            if (!settlement) continue;
            const name = String(settlement).replace(ADMIN_SUFFIX, '').trim();
            if (!name || seen.has(name.toLowerCase())) continue;
            seen.add(name.toLowerCase());
            list.push({ name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) });
          }
          // Agar hech qanday aholi punkti topilmasa (kamyob holat) — eski usulga qaytamiz,
          // qidiruv butunlay bo'sh qolib ketmasligi uchun.
          if (list.length === 0) {
            for (const d of Array.isArray(data) ? data : []) {
              const name = cleanName(d.address || {}, d.display_name || '');
              if (!name || seen.has(name.toLowerCase())) continue;
              seen.add(name.toLowerCase());
              list.push({ name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) });
            }
          }
          setItems(list);
          setOpen(list.length > 0);
          // Eng mos shahar koordinatasini avtomatik beramiz (origin to'g'ri bo'lishi uchun).
          if (list.length > 0 && onBestMatch) onBestMatch(list[0].lat, list[0].lon);
        }
      )
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
    // onBestMatch'ni deps'ga qo'shmaymiz — har render'da yangi funksiya bo'lishi mumkin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, suppressSuggestions]);

  const pick = (s: Suggestion) => {
    justSelected.current = true;
    onChange(s.name);
    onSelect(s.name, s.lat, s.lon);
    setOpen(false);
    setItems([]);
  };

  return (
    <div className="relative w-full">
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-surface border border-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {items.map((s, i) => (
            <li key={`${s.name}-${i}`}>
              <button
                type="button"
                // onMouseDown — input blur'idan OLDIN ishlaydi (tanlash yo'qolib qolmasin).
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                /* ⚠️ `min-h-11`: qator balandligi 34 px edi (o'lchandi
                   2026-09-04). Bu ro'yxat aynan YOZAYOTGANDA ochiladi,
                   ya'ni barmoq klaviatura ustidan tez tegadi — qo'shni
                   shaharni tanlab yuborish oson. */
                className="flex w-full min-h-11 items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-brand-pink-light dark:hover:bg-accent/10"
              >
                <MapPin className="h-4 w-4 text-accent shrink-0" />
                <span className="font-medium text-text">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
