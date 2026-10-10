'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/shared/ui/Button';
import { AlertTriangle } from 'lucide-react';
import { reportError } from '@/shared/lib/reportError';
import { trFor } from '@/shared/lib/i18n';
import { SUPPORT_TELEGRAM_URL } from '@/shared/config/contacts';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const pathname = usePathname();
  // next-intl provideri bu yerda yo'q (xato chegarasi) — tilni URL prefiksidan olamiz.
  const tr = trFor(pathname?.split('/')[1]);

  React.useEffect(() => {
    console.error('App error:', error);
    reportError(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 text-error">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-black text-foreground">
          {tr('Nimadir xato ketdi', 'Что-то пошло не так', 'Something went wrong')}
        </h1>
        <p className="text-sm leading-relaxed text-text-muted">
          {tr(
            "Kutilmagan xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
            'Произошла непредвиденная ошибка. Пожалуйста, попробуйте ещё раз.',
            'An unexpected error occurred. Please try again.'
          )}
        </p>
        <Button onClick={reset} className="mt-2 px-8">
          {tr('Qayta urinish', 'Повторить', 'Try again')}
        </Button>
        {/*
          YORDAM — XATO EKRANIDAN (egasi, 22.09.2026: «xatolik bo'lsa ham
          supportga yozish uchun»).

          🔴 «Qayta urinish» hamma xatoni yechmaydi: sabab bizning
          kodimizda bo'lsa tugma har safar o'sha xatoga qaytaradi va
          odamning qo'lida boshqa hech narsa qolmaydi.

          ⚠️ `AuthSupportLink` EMAS: bu xato chegarasi — next-intl
          provideri bu yerda YO'Q (shuning uchun tepada ham `trFor`
          ishlatilgan) va hook'ga tayanadigan komponent shu ekranning
          o'zini qulatardi.
        */}
        <a
          href={SUPPORT_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="-my-2 py-2 text-sm font-semibold text-text-muted underline-offset-4 hover:text-accent hover:underline"
        >
          {tr("Qo'llab-quvvatlashga yozish", 'Написать в поддержку', 'Write to support')}
        </a>
      </div>
    </div>
  );
}
