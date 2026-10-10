'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';

/**
 * Bron BOSQICHLARI — "endi nima bo'ladi?" degan savolga javob.
 *
 * 🔴 NEGA KERAK: holat bitta nishon edi ("Tasdiqlangan"). Odam uni ko'rib
 * keyingi qadamni BILMASDI: haydovchi qo'ng'iroq qiladimi, safar boshlanishini
 * kim belgilaydi, "tugadi" qachon bo'ladi. Bosqichlar butun yo'lni bir
 * qarashda ko'rsatadi va hozir qayerdaligini belgilaydi.
 *
 * Bosqichlar HAQIQIY holatlardan olinadi, o'ylab topilmaydi:
 *   so'rov → tasdiq → yo'lda (safar `IN_PROGRESS`) → tugadi (`COMPLETED`).
 *
 * ⚠️ Rad etilgan / bekor qilingan bronda CHIZILMAYDI: u yo'l tugamagan,
 * UZILGAN — bosqich chizig'i esa "davom etyapti" degan yolg'on taassurot
 * berardi. Bunday holatda holat nishoni o'zi yetarli.
 *
 * ⚠️ Holat nomlari IKKI xil keladi (`ACCEPTED` va `confirmed` — gateway
 * tarixi), shuning uchun kichik harfga keltirib, ikkalasi ham qabul qilinadi.
 * Ilovadagi `_BookingProgress` bilan bir xil qoidalar.
 */
export function BookingProgress({
  bookingStatus,
  tripStatus,
}: {
  bookingStatus?: string | null;
  tripStatus?: string | null;
}) {
  const tr = useTr();
  const b = String(bookingStatus ?? '').toLowerCase();
  const r = String(tripStatus ?? '').toLowerCase();

  if (b === 'rejected' || b === 'cancelled' || b === 'no_show' || r === 'cancelled') return null;

  const current =
    r === 'completed' ? 3 : r === 'in_progress' ? 2 : b === 'confirmed' || b === 'accepted' ? 1 : 0;

  const labels = [
    tr("So'rov", 'Заявка', 'Request'),
    tr('Tasdiqlandi', 'Подтверждено', 'Confirmed'),
    tr("Yo'lda", 'В пути', 'On the way'),
    tr('Tugadi', 'Завершено', 'Done'),
  ];

  return (
    <ol
      className="flex items-start gap-1 py-2"
      aria-label={tr('Bron bosqichlari', 'Этапы брони', 'Booking steps')}
    >
      {labels.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && (
            <li
              aria-hidden
              className={`mt-2 h-0.5 flex-1 rounded-full ${
                i <= current ? 'bg-accent' : 'bg-border'
              }`}
            />
          )}
          <li className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                i < current
                  ? 'border-accent bg-accent text-white'
                  : i === current
                    ? 'border-accent bg-surface text-accent'
                    : 'border-border bg-surface text-text-muted'
              }`}
            >
              {i < current ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${i === current ? 'bg-accent' : ''}`} />
              )}
            </span>
            <span
              className={`text-center text-[10px] leading-tight ${
                i === current ? 'font-extrabold text-text' : 'font-medium text-text-muted'
              }`}
            >
              {label}
            </span>
          </li>
        </React.Fragment>
      ))}
    </ol>
  );
}
