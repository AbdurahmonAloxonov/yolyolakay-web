'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, type, ...props }, ref) => {
    /*
     * 🔴 YORLIQ MAYDONGA BOG'LANMAGAN EDI (2026-09-04, o'lchandi).
     *
     * `<label>` shunchaki inputning yonida turardi — na `htmlFor`, na
     * o'rash. KO'Z ular bir juft ekanini joylashuvidan biladi, ekran
     * o'qigich esa BILMAYDI: u «tahrirlash maydoni» deb o'qiydi va
     * odam nima yozishini bilmay qoladi. Bu bitta komponent butun
     * saytdagi maydonlarni chizadi — ya'ni nuqson ham hamma joyda edi.
     *
     * ⚠️ PLACEHOLDER YORLIQ EMAS: u yozila boshlanishi bilan
     * yo'qoladi. Shuning uchun uni «nom» deb hisoblab bo'lmaydi.
     *
     * `useId` — SSR'da server va brauzerda BIR XIL id beradi
     * (`Math.random()` bermaydi va gidratatsiya buziladi).
     */
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const tr = useTr();
    // Parol maydoni — ko'z tugmasi yozilganni ko'rsatadi/yashiradi.
    // Telefonda xato terilgan parolni tekshirishning yagona yo'li shu.
    const isPassword = type === 'password';
    const [revealed, setRevealed] = React.useState(false);

    return (
      <div className="flex flex-col gap-1.5 w-full text-left group">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-bold text-text-muted select-none transition-colors group-focus-within:text-text"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`peer w-full bg-surface input-inner-shadow border border-border/80 rounded-xl px-4 text-text placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 min-h-[52px] text-[15px] font-medium transition-colors duration-300 ${isPassword ? 'pr-12' : ''} ${
              error ? 'border-error focus:border-error focus:ring-error/15' : 'hover:border-border'
            } ${className}`}
            {...props}
            type={isPassword && revealed ? 'text' : type}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={
                revealed
                  ? tr('Parolni yashirish', 'Скрыть пароль', 'Hide password')
                  : tr("Parolni ko'rsatish", 'Показать пароль', 'Show password')
              }
              aria-pressed={revealed}
              aria-controls={inputId}
              // 44 px — barmoq uchun eng kichik nishon.
              className="absolute right-1 flex h-11 w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {revealed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          )}
        </div>
        {error && (
          <span
            id={errorId}
            // Xato MATNI maydon bilan bog'langan (`aria-describedby`) —
            // ekran o'qigich uni maydon nomidan keyin o'qiydi.
            className="text-xs text-error font-bold select-none animate-in fade-in slide-in-from-top-1 pl-1"
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
