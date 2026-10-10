import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'primary', className = '' }) => {
  const baseStyle =
    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border transition-colors duration-200 uppercase tracking-wide';

  // success — turquoise och rang, shuning uchun matn wine-ash (kontrast); turquoise fon+chegara.
  const variants = {
    primary: 'bg-brand-pink-light dark:bg-accent/10 border-accent/20 text-accent',
    secondary: 'bg-surface border-border text-text-muted',
    success: 'bg-turquoise-light border-turquoise/50 text-wine-ash',
    warning: 'bg-warning/10 border-warning/20 text-warning',
    error: 'bg-error/10 border-error/20 text-error',
  };

  return <span className={`${baseStyle} ${variants[variant]} ${className}`}>{children}</span>;
};
