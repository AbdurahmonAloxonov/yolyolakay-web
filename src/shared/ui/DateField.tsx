'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { tashkentNow } from '@/shared/lib/format';
import { pickFor, trFor } from '@/shared/lib/i18n';
import { useTr } from '@/shared/lib/useTr';

/**
 * Sana tanlash — brend kalendari.
 *
 * NEGA `<input type="date">` EMAS: brauzerning o'z oynasi ilovaning dizayn tizimidan
 * (rang, shrift, radius) BUTUNLAY tashqarida, Android WebView'da esa umuman boshqacha
 * ko'rinadi va ba'zi qurilmalarda ochilmaydi ham. Bundan tashqari native oynada
 * "Bugun / Ertaga / Dam olish kuni" kabi tez tanlovlar yo'q.
 *
 * Sana FORMATI o'zgarmagan — `YYYY-MM-DD` (backend `dateToRangeISO` shuni kutadi),
 * shuning uchun chaqiruvchi joylarda mantiq o'zgartirilmaydi.
 *
 * Barcha sana hisob-kitobi UTC ustida (`Date.UTC`) — mahalliy vaqt mintaqasi
 * kunni bir kunga surib yuborishi mumkin bo'lgan klassik xatoni oldini oladi.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const isKey = (s?: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

const parseKey = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
};

const addDays = (s: string, n: number) => {
  const { y, m, d } = parseKey(s);
  const dt = new Date(Date.UTC(y, m, d + n));
  return keyOf(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
};

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
/** Dushanbadan boshlanadigan hafta uchun oyning 1-kuni qaysi ustunda turishi (0..6). */
const firstWeekdayIndex = (y: number, m: number) =>
  (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
const weekdayIndex = (s: string) => {
  const { y, m, d } = parseKey(s);
  return (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
};

const MONTHS_UZ = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];
const MONTHS_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTHS_RU_NOM = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];
const WEEK_UZ = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const WEEK_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "5-avgust, Se" / "5 августа, Вт" / "5 August, Tue" — tugmadagi qisqa yozuv. */
export const formatDateKey = (value: string, locale: string): string => {
  if (!isKey(value)) return '';
  const tr = trFor(locale);
  const pick = pickFor(locale);
  const { y, m, d } = parseKey(value);
  const wd = pick(WEEK_UZ, WEEK_RU, WEEK_EN)[weekdayIndex(value)];
  const today = tashkentNow().date;
  const prefix =
    value === today
      ? tr('Bugun', 'Сегодня', 'Today')
      : value === addDays(today, 1)
        ? tr('Ertaga', 'Завтра', 'Tomorrow')
        : '';
  const base = pick(`${d}-${MONTHS_UZ[m]}`, `${d} ${MONTHS_RU[m]}`, `${d} ${MONTHS_EN[m]}`);
  const yearPart = y !== Number(today.slice(0, 4)) ? ` ${y}` : '';
  return prefix ? `${prefix} · ${base}${yearPart}` : `${base}${yearPart}, ${wd}`;
};

interface DateFieldProps {
  label?: string;
  /** YYYY-MM-DD; bo'sh satr = tanlanmagan. */
  value: string;
  onChange: (value: string) => void;
  /** YYYY-MM-DD — bundan oldingi kunlar o'chirilgan (o'tmishga safar yo'q). */
  min?: string;
  max?: string;
  placeholder?: string;
  /** "Tozalash" tugmasi (qidiruvda sanasiz izlash uchun). */
  allowClear?: boolean;
  /**
   * `field` — Input bilan bir xil ko'rinishdagi tugma (odatiy).
   * `bare`  — chegarasiz: tashqi konteyner o'z ramkasini chizadigan joylar uchun.
   */
  variant?: 'field' | 'bare';
  className?: string;
}

export const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
  allowClear = false,
  variant = 'field',
  className = '',
}) => {
  const locale = useLocale();
  const tr = useTr();
  const today = tashkentNow().date;

  const [open, setOpen] = React.useState(false);
  // Ko'rinib turgan oy — tanlangan sanadan (bo'lmasa bugundan) boshlanadi.
  const [cursor, setCursor] = React.useState(() => parseKey(isKey(value) ? value : today));

  // Sheet har ochilganda tanlangan oyga qaytadi (foydalanuvchi ilgari boshqa oyni
  // varaqlab qo'ygan bo'lsa ham).
  React.useEffect(() => {
    if (open) setCursor(parseKey(isKey(value) ? value : today));
  }, [open, value, today]);

  const disabledKey = React.useCallback(
    (k: string) => (isKey(min) && k < min) || (isKey(max) && k > max),
    [min, max]
  );

  const pick = (k: string) => {
    if (disabledKey(k)) return;
    onChange(k);
    setOpen(false);
  };

  // Tez tanlov: bugun, ertaga va eng yaqin shanba (dam olish kuni safari).
  const nextSaturday = React.useMemo(() => {
    const wd = weekdayIndex(today); // 0=Du ... 5=Sh
    const delta = wd === 5 ? 7 : (5 - wd + 7) % 7;
    return addDays(today, delta || 7);
  }, [today]);

  const quick = [
    { k: today, label: tr('Bugun', 'Сегодня', 'Today') },
    { k: addDays(today, 1), label: tr('Ertaga', 'Завтра', 'Tomorrow') },
    { k: nextSaturday, label: tr('Shanba', 'Суббота', 'Saturday') },
  ].filter((q) => !disabledKey(q.k));

  const { y, m } = cursor;
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekdayIndex(y, m) }, () => null),
    ...Array.from({ length: daysInMonth(y, m) }, (_, i) => keyOf(y, m, i + 1)),
  ];

  const monthTitle = pickFor(locale)(
    `${MONTHS_UZ[m][0].toUpperCase()}${MONTHS_UZ[m].slice(1)} ${y}`,
    `${MONTHS_RU_NOM[m]} ${y}`,
    `${MONTHS_EN[m]} ${y}`
  );

  const shiftMonth = (delta: number) => {
    const dt = new Date(Date.UTC(y, m + delta, 1));
    setCursor({ y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: 1 });
  };

  // Joriy oy min/max chegarasiga tegib turgan bo'lsa — u tomonga varaqlash ma'nosiz.
  const nextMonth = new Date(Date.UTC(y, m + 1, 1));
  const prevDisabled = isKey(min) && keyOf(y, m, 1) <= min;
  const nextDisabled =
    isKey(max) && keyOf(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 1) > max;

  const triggerClass =
    variant === 'bare'
      ? // 🔴 `bare` holatda tugma balandligi ATIGI 23 px chiqardi
        // (o'lchandi, landing qidiruv formasi): matn balandligi qancha
        // bo'lsa, tegib turadigan maydon ham shuncha edi. Endi eng kami
        // 36 px — ramkani baribir tashqi konteyner chizadi, ya'ni
        // ko'rinish o'zgarmaydi, faqat barmoq yetadigan bo'ladi.
        // ⚠️ 44 px, 36 EMAS: bosh sahifadagi qidiruv formasida bu maydon
        // 36 px edi va barmoq uchun juda past chiqardi (PRODDA o'lchandi
        // 2026-09-04 — lokalda ko'rinmagan, chunki forma to'ldirilmagan).
        `flex min-h-11 w-full items-center gap-2 bg-transparent text-left text-[15px] font-semibold text-text ${className}`
      : `flex min-h-[52px] w-full items-center gap-2 rounded-xl border border-border/80 bg-surface input-inner-shadow px-4 text-left text-[15px] font-medium text-text transition-colors duration-300 hover:border-border focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 ${className}`;

  return (
    <div className="flex w-full flex-col gap-1.5 text-left">
      {label && <span className="text-sm font-bold text-text-muted select-none">{label}</span>}

      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>
        {/* `bare` holatda ikonka tashqi konteynerda (masalan landing LightField'da)
            allaqachon bor — ikkinchisini chizmaymiz. */}
        {/* 🔴 IKONKA PUSHTI EMAS (2026-09-03): maydondagi ikonka —
            ma'no belgisi, amal emas. Ilovada ham u neytral. Pushti
            ekranda faqat asosiy tugmada qoladi. */}
        {variant === 'field' && <CalendarDays className="h-4.5 w-4.5 shrink-0 text-text-muted" />}
        <span className={value ? '' : 'text-text-muted'}>
          {value
            ? formatDateKey(value, locale)
            : (placeholder ?? tr('Sanani tanlang', 'Выберите дату', 'Choose a date'))}
        </span>
      </button>

      <BottomSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title={tr('Sanani tanlang', 'Выберите дату', 'Choose a date')}
      >
        <div className="space-y-4 pb-2">
          {/* Tez tanlov — eng ko'p ishlatiladigan uchta kun bitta bosishda. */}
          {quick.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <button
                  key={q.k}
                  type="button"
                  onClick={() => pick(q.k)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    value === q.k
                      ? 'border-accent bg-brand-pink-light dark:bg-accent/10 text-accent'
                      : 'border-border bg-surface text-text-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Oy sarlavhasi va varaqlash */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={prevDisabled}
              aria-label={tr('Oldingi oy', 'Предыдущий месяц', 'Previous month')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition-colors hover:text-accent disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-extrabold text-text">{monthTitle}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={nextDisabled}
              aria-label={tr('Keyingi oy', 'Следующий месяц', 'Next month')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition-colors hover:text-accent disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Hafta kunlari — dushanbadan (O'zbekistonda odatiy) */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {pickFor(locale)(WEEK_UZ, WEEK_RU, WEEK_EN).map((w, i) => (
              <span
                key={w}
                className={`py-1 text-[11px] font-black uppercase ${
                  i >= 5 ? 'text-brand-pink' : 'text-text-muted'
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((k, i) => {
              if (!k) return <span key={`x${i}`} />;
              const day = Number(k.slice(8));
              const selected = k === value;
              const disabled = disabledKey(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => pick(k)}
                  disabled={disabled}
                  aria-current={k === today ? 'date' : undefined}
                  className={`flex h-10 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                    selected
                      ? 'bg-accent text-white shadow-sm'
                      : disabled
                        ? 'cursor-not-allowed text-text-muted/30'
                        : k === today
                          ? 'border border-accent/50 text-accent hover:bg-brand-pink-light dark:hover:bg-accent/10'
                          : 'text-text hover:bg-brand-pink-light dark:hover:bg-accent/10 hover:text-accent'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {allowClear && value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="w-full rounded-xl border border-border py-2.5 text-xs font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {tr('Sanani tozalash', 'Сбросить дату', 'Clear the date')}
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
};
