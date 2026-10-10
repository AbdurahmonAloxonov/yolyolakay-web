'use client';

import React from 'react';
import './globals.css';
import { reportError } from '@/shared/lib/reportError';
import { trFor } from '@/shared/lib/i18n';
import { SUPPORT_TELEGRAM_URL } from '@/shared/config/contacts';

/**
 * Oxirgi chegara: root layout'ning O'ZI qulaganda ishlaydi (locale layout'dagi error.tsx
 * bunday holatda ishga tushmaydi — u qulagan layout ichida yashaydi). Shuning uchun bu
 * yerda o'z <html>/<body> teglarimiz bo'lishi SHART va hech qanday provider (i18n, tema,
 * react-query) mavjud deb hisoblab bo'lmaydi.
 *
 * Til next-intl'siz aniqlanadi — URL prefiksidan, defaultLocale'ga mos ravishda 'uz'.
 * Ranglar globals.css tokenlaridan, lekin tema provideri yo'q → `prefers-color-scheme`
 * bo'yicha brauzerning o'zi hal qiladi.
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  // Root layout qulagan — provider ham yo'q. Til URL prefiksidan (SSRda 'uz').
  const tr = trFor(typeof window === 'undefined' ? 'uz' : window.location.pathname.split('/')[1]);

  React.useEffect(() => {
    console.error('Global error:', error);
    // Root layout qulaganda — bu eng jiddiy holat, monitoringga ALBATTA yetsin.
    reportError(error, { boundary: 'global-error' });
  }, [error]);

  return (
    <html lang={tr('uz', 'ru', 'en')}>
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen items-center justify-center px-4 py-16">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 text-error">
              {/* lucide-react o'rniga inline SVG — bundle qulagan holatda ham chiziladi. */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
                aria-hidden="true"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-black">
              {tr('Ilova ishga tushmadi', 'Приложение не запустилось', 'The app failed to start')}
            </h1>
            <p className="text-sm leading-relaxed text-text-muted">
              {tr(
                "Jiddiy xatolik yuz berdi. Sahifani qayta yuklang — muammo takrorlansa, birozdan keyin urinib ko'ring.",
                'Произошла серьёзная ошибка. Перезагрузите страницу — если проблема повторится, попробуйте позже.',
                'A serious error occurred. Reload the page — if it happens again, try later.'
              )}
            </p>
            <button
              onClick={reset}
              className="mt-2 rounded-xl bg-accent px-8 py-3 text-sm font-semibold text-white shadow-md hover:bg-accent-hover"
            >
              {tr('Qayta yuklash', 'Перезагрузить', 'Reload')}
            </button>
            {/* Oxirgi chegara — bu yerda ham bizga yetib kelish yo'li
                qolsin: oddiy <a>, hech qanday provider talab qilmaydi. */}
            <a
              href={SUPPORT_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-text-muted underline-offset-4 hover:underline"
            >
              {tr("Qo'llab-quvvatlashga yozish", 'Написать в поддержку', 'Write to support')}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
