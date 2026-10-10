'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { Clock } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { useTr } from '@/shared/lib/useTr';

/**
 * Soat tanlash — brend "sifer­blati".
 *
 * NEGA ikkita `<select>` EMAS: 24 + 60 elementli ochiluvchi ro'yxatda kerakli
 * qiymatgacha uzoq skroll qilinardi (ayniqsa telefonda), va bu ikki maydon
 * dizayn tizimidagi boshqa hech narsaga o'xshamasdi. Endi soat panjarasi
 * (00–23) + daqiqa panjarasi (5 daqiqalik qadam) — istalgan vaqt IKKI bosishda.
 *
 * Qiymat formati o'zgarmagan: "HH:MM" (`tashkentLocalToUTCISO` shuni kutadi).
 */

const pad = (n: number) => String(n).padStart(2, '0');
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

interface TimeFieldProps {
  label?: string;
  /** "HH:MM"; bo'sh satr = tanlanmagan. */
  value: string;
  onChange: (value: string) => void;
  /** "HH:MM" — bundan oldingi vaqtlar o'chirilgan (bugungi kun uchun "hozir"). */
  minTime?: string;
  /** Daqiqa qadami — 5 (odatiy). */
  minuteStep?: number;
  className?: string;
}

export const TimeField: React.FC<TimeFieldProps> = ({
  label,
  value,
  onChange,
  minTime,
  minuteStep = 5,
  className = '',
}) => {
  const locale = useLocale();
  const tr = useTr();

  const [open, setOpen] = React.useState(false);
  const [hour, setHour] = React.useState<number | null>(null);
  const [minute, setMinute] = React.useState<number | null>(null);

  // Sheet ochilganda joriy qiymatdan boshlaymiz.
  React.useEffect(() => {
    if (!open) return;
    const [h, m] = value ? value.split(':').map(Number) : [null, null];
    setHour(Number.isFinite(h as number) ? (h as number) : null);
    setMinute(Number.isFinite(m as number) ? (m as number) : null);
  }, [open, value]);

  const minMin = minTime ? toMinutes(minTime) : -1;
  const hourDisabled = (h: number) => minMin >= 0 && (h + 1) * 60 - minuteStep < minMin;
  const minuteDisabled = (m: number) => minMin >= 0 && hour !== null && hour * 60 + m < minMin;

  const commit = (h: number, m: number) => {
    onChange(`${pad(h)}:${pad(m)}`);
    setOpen(false);
  };

  const pickHour = (h: number) => {
    setHour(h);
    // Daqiqa allaqachon tanlangan va yangi soat bilan o'tmishda qolsa — eng yaqin
    // ruxsat etilgan daqiqaga ko'tarib qo'yamiz (foydalanuvchi "nega tasdiqlanmayapti"
    // deb qolmasin).
    if (minute !== null && minMin >= 0 && h * 60 + minute < minMin) {
      const need = Math.ceil((minMin - h * 60) / minuteStep) * minuteStep;
      setMinute(need <= 59 ? need : null);
    }
  };

  // Tez tanlov — eng ko'p uchraydigan jo'nash soatlari.
  const quick = ['06:00', '08:00', '12:00', '18:00', '21:00'].filter(
    (t) => minMin < 0 || toMinutes(t) >= minMin
  );

  const canConfirm = hour !== null && minute !== null && !minuteDisabled(minute);
  const preview = `${hour === null ? '--' : pad(hour)}:${minute === null ? '--' : pad(minute)}`;

  return (
    <div className="flex w-full flex-col gap-1.5 text-left">
      {label && <span className="text-sm font-bold text-text-muted select-none">{label}</span>}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex min-h-[52px] w-full items-center gap-2 rounded-xl border border-border/80 bg-surface input-inner-shadow px-4 text-left text-[15px] font-medium text-text transition-colors duration-300 hover:border-border focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 ${className}`}
      >
        <Clock className="h-4.5 w-4.5 shrink-0 text-accent" />
        <span className={value ? 'font-bold tabular-nums' : 'text-text-muted'}>
          {value || tr('Soatni tanlang', 'Выберите время', 'Choose a time')}
        </span>
      </button>

      <BottomSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title={tr("Jo'nash soati", 'Время отправления', 'Departure time')}
      >
        <div className="space-y-4 pb-2">
          {/* Katta ko'rsatkich — tanlangan vaqt har doim ko'z oldida. */}
          <div className="rounded-2xl border border-border bg-bg py-4 text-center">
            <span className="font-display text-4xl font-black tabular-nums text-foreground">
              {preview}
            </span>
          </div>

          {quick.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quick.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => commit(Number(t.slice(0, 2)), Number(t.slice(3)))}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-bold tabular-nums transition-colors ${
                    value === t
                      ? 'border-accent bg-brand-pink-light dark:bg-accent/10 text-accent'
                      : 'border-border bg-surface text-text-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">
              {tr('Soat', 'Часы', 'Hours')}
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 24 }, (_, h) => {
                const disabled = hourDisabled(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => pickHour(h)}
                    disabled={disabled}
                    className={`h-10 rounded-xl text-sm font-bold tabular-nums transition-colors ${
                      hour === h
                        ? 'bg-accent text-white shadow-sm'
                        : disabled
                          ? 'cursor-not-allowed text-text-muted/30'
                          : 'border border-border text-text hover:border-accent hover:text-accent'
                    }`}
                  >
                    {pad(h)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">
              {tr('Daqiqa', 'Минуты', 'Minutes')}
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep).map(
                (m) => {
                  const disabled = minuteDisabled(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => (hour !== null ? commit(hour, m) : setMinute(m))}
                      disabled={disabled}
                      className={`h-10 rounded-xl text-sm font-bold tabular-nums transition-colors ${
                        minute === m
                          ? 'bg-accent text-white shadow-sm'
                          : disabled
                            ? 'cursor-not-allowed text-text-muted/30'
                            : 'border border-border text-text hover:border-accent hover:text-accent'
                      }`}
                    >
                      {pad(m)}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => hour !== null && minute !== null && canConfirm && commit(hour, minute)}
            className="w-full rounded-2xl bg-accent py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tr('Tasdiqlash', 'Подтвердить', 'Confirm')}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
