'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';

interface CounterProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export const Counter: React.FC<CounterProps> = ({ label, value, onChange, min = 1, max = 10 }) => {
  const tr = useTr();
  const handleDecrement = () => {
    if (value > min) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (value < max) onChange(value + 1);
  };

  /*
   * ⚠️ Bu YORLIQ EMAS: pastda kiritish maydoni yo'q — ikkita tugma va
   * raqam turadi. Boshqaruvsiz `<label>` ni ekran o'qigich hech
   * narsaga bog'lamaydi, shuning uchun yozuv GURUHNING nomi bo'ladi.
   */
  const groupId = React.useId();

  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && (
        <span id={groupId} className="text-sm font-semibold text-text-muted select-none">
          {label}
        </span>
      )}
      <div
        role="group"
        aria-labelledby={label ? groupId : undefined}
        className="flex items-center justify-between bg-surface border border-border rounded-xl px-2 min-h-[48px] transition-colors duration-200"
      >
        {/* Ikonkali tugmaning NOMI bo'lishi shart: ekran o'qigich aks holda
            «button» deb o'qiydi va odam nimani bosayotganini bilmaydi.
            O'chiq holat shaffoflik bilan ko'rsatiladi — bu YOZUV emas,
            ikonka; lekin 30% da u deyarli yo'qolardi, 40% da esa «bor,
            ammo hozir ishlamaydi» bo'lib turadi. */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label={`${label ?? ''} ${tr('kamaytirish', 'уменьшить', 'decrease')}`.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-bg hover:text-text active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>
        {/* `key={value}` — raqam har o'zgarganda element qayta yaratiladi va
            `mo-bump` boshidan yuradi. Usiz raqam jimgina almashardi va bosish
            "yetib bordimi yo'qmi" bilinmasdi. Sensorli ekranda bu ayniqsa
            muhim: u yerda hover yo'q, yagona javob shu harakat. */}
        <span key={value} className="mo-bump w-8 select-none text-center text-lg font-bold">
          {value}
        </span>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label={`${label ?? ''} ${tr("ko'paytirish", 'увеличить', 'increase')}`.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-bg hover:text-text active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
