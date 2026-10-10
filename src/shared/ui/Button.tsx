import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  isLoading,
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}) => {
  // Animatsiya: FAQAT transform + background-color (spec 5). box-shadow/width animatsiya YO'Q.
  const baseStyle =
    'relative flex items-center justify-center font-bold rounded-xl transition-[background-color,transform] duration-200 ' +
    // 🔴 O'CHIQ TUGMA O'QILISHI SHART (2026-09-04). Ilgari bu yerda
    // `disabled:opacity-50` turardi: pushti zamindagi oq yozuv shaffof
    // bo'lib qolib kontrast 1.54:1 ga tushardi — ya'ni «Keyingisi»
    // tugmasi nima deyayotgani KO'RINMASDI. Shaffoflik o'rniga o'chiq
    // holatning O'Z terisi: sokin zamin + muted yozuv (5.2:1 yorug'da,
    // 6.6:1 tungida). `:disabled` selektori variant ranglarini o'zi
    // bosadi — sinf tartibiga bog'liq emas.
    'active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ' +
    'disabled:bg-bg-soft disabled:text-text-muted disabled:border disabled:border-border disabled:shadow-none ' +
    'min-h-[52px] min-w-[48px] px-6 text-[15px] select-none outline-none overflow-hidden ' +
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

  // Ranglar FAQAT token orqali (hardcode yo'q). primary = brand-pink CTA.
  const variants = {
    primary: 'bg-accent hover:bg-accent-hover text-white shadow-md',
    secondary: 'bg-surface hover:bg-bg text-text border border-border shadow-sm',
    danger: 'bg-error text-white shadow-md',
    ghost: 'bg-transparent hover:bg-surface/60 text-text-muted hover:text-text',
    glass: 'glass-panel text-text hover:bg-white/10 dark:hover:bg-white/5 shadow-sm',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyle} ${variants[variant]} ${className} group`}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="animate-spin h-5 w-5" />
          <span className="animate-pulse tracking-widest">...</span>
        </span>
      ) : (
        <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      )}
    </button>
  );
};
