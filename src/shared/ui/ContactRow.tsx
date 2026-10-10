'use client';

import React from 'react';
import { Phone } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';

/**
 * Kelishilgandan keyingi ALOQA qatori: raqam + "Qo'ng'iroq" tugmasi.
 *
 * 🔴 NEGA KERAK (egasi, 2026-08-16): "kelishuvga erishganlar bir-birining
 * nomerini topolmayapti". Bron tasdiqlangach ikki taraf uchrashish joyini
 * aniqlashi kerak; chat bunga har doim ham yetmaydi (internet yo'q, odam
 * saytni ochmagan). Telefon — eng ishonchli yo'l.
 *
 * ⚠️ Raqam kelmasa blok BO'SH QOLMAYDI, sababini aytadi: backend safar/bron
 * javobida telefon maydonini hozircha YUBORMAYDI (xat 2026-08-16). Shu
 * sababli "raqam yo'q" holati vaqtincha ODATIY hisoblanadi.
 *
 * Chaqiruvchi TASDIQLANGANLIKNI o'zi tekshiradi: raqam tasdiqdan oldin
 * ko'rsatilsa, har kim e'lon egasining raqamini yig'ib olishi mumkin bo'lardi.
 *
 * Flutter tomonda ayni komponent: `features/shared/ui.dart` -> `ContactRow`.
 */
export const ContactRow: React.FC<{ phone?: string | null }> = ({ phone }) => {
  const tr = useTr();
  const number = phone?.trim();

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg/50 px-3 py-2.5">
      <Phone className="h-4.5 w-4.5 shrink-0 text-text-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-text-muted">
          {tr('Aloqa', 'Связь', 'Contact')}
        </div>
        {number ? (
          <div className="truncate text-sm font-extrabold text-text">{number}</div>
        ) : (
          <div className="truncate text-xs font-medium text-text-muted">
            {tr(
              "Raqam kelmadi — chat orqali bog'laning",
              'Номер не пришёл — свяжитесь через чат',
              'No number available — use the chat'
            )}
          </div>
        )}
      </div>
      {number && (
        <a
          href={`tel:${number}`}
          className="shrink-0 rounded-xl bg-brand-pink-light dark:bg-accent/10 px-3 py-2 text-xs font-extrabold text-accent hover:bg-accent/20 transition-colors"
        >
          {tr("Qo'ng'iroq", 'Позвонить', 'Call')}
        </a>
      )}
    </div>
  );
};
