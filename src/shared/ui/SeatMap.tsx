'use client';

import React from 'react';
import { useTr } from '@/shared/lib/useTr';

/**
 * O'RINDIQ SXEMASI — «3 joy» raqami o'rniga KO'RINADIGAN o'rindiqlar.
 *
 * 🔴 NEGA KERAK: «2 / 4» degan kasr ikki xil o'qiladi — mashinada ikkita
 * joy bormi yoki ikkitasi BO'SHMI? Sxemada savol qolmaydi: band o'rindiq
 * so'ngan, bo'shi brend rangida.
 *
 * 🔴 SAYTDA BU UMUMAN YO'Q EDI (2026-08-27 gacha): ilovada to'liq salon
 * chizilardi, saytda esa hamma joyda xom kasr turardi. Sayt mehmon
 * rejimida ochiq va odam bizni ko'pincha birinchi o'sha yerdan ko'radi.
 *
 * Salon taqsimoti QO'LDA hisoblanadi: backend faqat `total_seats` beradi,
 * salon chizmasini emas. O'zbekistonda sotiladigan mashinalarning deyarli
 * hammasi — oldida BITTA yo'lovchi o'rindig'i, qolgani orqada (Cobalt,
 * Nexia, Malibu). 4 dan ko'p bo'lsa (Damas, minivan) orqa qator ikkiga
 * bo'linadi — aks holda sakkizta belgi bitta qatorga tiqilib, hech nima
 * o'qilmay qolardi.
 *
 * ⚠️ BAND O'RINDIQLAR ORQADAN TO'LADI — bu KO'RSATISH TARTIBI, VA'DA
 * EMAS. Backend kim qayerda o'tirishini SAQLAMAYDI (bronda faqat
 * `seats_booked` soni bor), ya'ni «falonchi 2-o'rindiqda» deb yozsak,
 * buni o'zimiz o'ylab topgan bo'lardik.
 *
 * Mobil ekvivalenti: `lib/features/rides/seat_map.dart`.
 */
export function SeatMap({
  totalSeats,
  availableSeats,
  maxTwoBack = false,
  compact = false,
}: {
  totalSeats?: number | null;
  availableSeats?: number | null;
  /** Haydovchi «orqada 2 kishi» qoidasini qo'ygan (`max_two_back`). */
  maxTwoBack?: boolean;
  /** Ixcham: sarlavhasiz, matnsiz, bitta qator — ro'yxat kartalari uchun. */
  compact?: boolean;
}) {
  const tr = useTr();

  const total = Math.min(Math.max(Number(totalSeats ?? 0), 0), 8);
  // Ma'lumot yaroqsiz bo'lsa hech nima chizmaymiz: bo'sh ramka «sayt
  // buzuq» degandek ko'rinadi.
  if (total <= 0) return null;

  const free = Math.min(Math.max(Number(availableSeats ?? 0), 0), total);
  const taken = total - free;

  // Ixcham ko'rinishda salon ikkiga BO'LINMAYDI: kartada kerak bo'lgan
  // javob «joy bormi», salon chizmasi emas.
  const rows: number[] = compact
    ? [total]
    : total <= 1
      ? [total]
      : total <= 4
        ? [1, total - 1]
        : [1, Math.ceil((total - 1) / 2), Math.floor((total - 1) / 2)];

  // Bandlar orqadan to'ladi (izohi yuqorida).
  const backCount = compact ? 0 : total - rows[0];
  const backTaken = Math.min(taken, backCount);
  const frontTaken = Math.min(taken - backTaken, rows[0]);

  const size = compact ? 15 : 20;
  let drawn = 0;

  const seat = (rowIndex: number, posInRow: number) => {
    const isBack = rowIndex > 0;
    let takenBefore = 0;
    for (let r = 1; r < rowIndex; r++) takenBefore += rows[r];
    const rowTaken = isBack
      ? Math.min(Math.max(backTaken - takenBefore, 0), rows[rowIndex])
      : frontTaken;
    const isFree = posInRow >= rowTaken;
    const rowName = isBack ? tr('Orqada', 'Сзади', 'Back') : tr('Oldinda', 'Впереди', 'Front');

    return (
      <SeatIcon
        key={`s-${drawn++}`}
        size={size}
        free={isFree}
        label={
          isFree
            ? tr(`${rowName}: bo'sh`, `${rowName}: свободно`, `${rowName}: free`)
            : tr(`${rowName}: band`, `${rowName}: занято`, `${rowName}: taken`)
        }
      />
    );
  };

  const car = (
    <div className="flex flex-col gap-1">
      {/* OLD QATOR — haydovchi + yonidagi o'rindiq. Haydovchi o'rindig'i
          ATAYIN chiziladi: usiz qator «mashina» bo'lib ko'rinmaydi. */}
      <div className="flex items-center gap-1">
        <SeatIcon size={size} driver label={tr('Haydovchi', 'Водитель', 'Driver')} />
        <span className="w-1.5" aria-hidden />
        {Array.from({ length: rows[0] }, (_, i) => seat(0, i))}
      </div>
      {rows.slice(1).map((count, r) => (
        <div key={`r-${r}`} className="flex items-center gap-1">
          {Array.from({ length: count }, (_, i) => seat(r + 1, i))}
        </div>
      ))}
    </div>
  );

  if (compact) return car;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-text-muted">
        {tr("O'rindiqlar", 'Места', 'Seats')}
      </p>
      <div className="flex items-center gap-4">
        {car}
        <div className="min-w-0">
          <p className="truncate text-sm text-text-muted">
            {tr(
              `${total} tadan ${free} tasi bo'sh`,
              `${free} из ${total} свободно`,
              `${free} of ${total} free`
            )}
          </p>
          {/* «Orqada 2 kishi» qoidasi AYNAN shu yerda: odam orqa qatorga
              qarab turib o'qiydi. Ilgari u belgilar orasida yo'qolardi. */}
          {maxTwoBack && (
            <p className="truncate text-[11px] font-semibold text-text-muted">
              {tr('Orqada 2 kishi', 'Сзади двое', 'Two in the back')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SeatIcon({
  size,
  free,
  driver = false,
  label,
}: {
  size: number;
  free?: boolean;
  driver?: boolean;
  label: string;
}) {
  // Haydovchi o'rindig'i — neytral, «band» ham emas, «bo'sh» ham.
  const cls = driver ? 'text-border' : free ? 'text-accent' : 'text-text-muted/35';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cls}
      role="img"
      aria-label={label}
      fill="currentColor"
    >
      <title>{label}</title>
      {driver ? (
        <path d="M7 20v-2h10v2H7zm-2-3V9a3 3 0 0 1 3-3h1V4h6v2h1a3 3 0 0 1 3 3v8H5z" />
      ) : (
        <path d="M6 19v-3h12v3H6zM7 14V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8H7z" />
      )}
    </svg>
  );
}
