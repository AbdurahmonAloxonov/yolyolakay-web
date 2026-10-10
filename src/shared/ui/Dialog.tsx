'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Затемнение фона */}
      <div className="mo-scrim fixed inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      {/* Контент модалки — prujinali chiqish (`mo-pop`): oxirida sal oshib
          qaytadi, shuning uchun oyna "qo'lga ushlanadigan" bo'lib tuyuladi.
          Ilgari oddiy `zoom-in-95` edi va u sezilmasdi. */}
      <div className="mo-pop relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl text-text-muted hover:text-text hover:bg-border/30 transition-colors flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {title && (
          <h3 className="text-lg font-extrabold text-text tracking-tight mb-4 select-none pr-8">
            {title}
          </h3>
        )}

        <div className="mt-2 text-text-muted select-none">{children}</div>
      </div>
    </div>
  );
};
