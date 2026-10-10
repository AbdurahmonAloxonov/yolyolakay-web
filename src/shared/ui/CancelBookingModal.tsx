'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cancelBooking } from '@/shared/api/rides';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { useTr } from '@/shared/lib/useTr';

/**
 * YO'LOVCHI o'z bronini bekor qiladi.
 *
 * 🔴 SAYTDA BU FUNKSIYA UMUMAN YO'Q EDI — chunki gateway'da yo'lovchi uchun
 * bekor qilish ruchkasi bo'lmagan. Fikri o'zgargan odamning yagona yo'li
 * kelmay qo'yish edi; haydovchi esa uni kutib, o'rindiqni boshqaga
 * bermasdi. Mobil ilovada shu bo'shliqni vaqtincha «bekor qilish so'rovi»
 * (haydovchiga chat xabari) to'ldirib turgandi.
 *
 * ✅ 2026-08-27: `POST /rides/{id}/bookings/{booking_id}/cancel` ochildi.
 * Ikkala mijozda ham endi HAQIQIY bekor qilish. Mobil ekvivalenti:
 * `lib/features/trips/cancel_booking_sheet.dart`.
 */
export function CancelBookingModal({
  isOpen,
  onClose,
  rideId,
  bookingId,
  seats,
  onCancelled,
}: {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  bookingId: string;
  seats?: number;
  onCancelled?: () => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => cancelBooking(rideId, bookingId, reason.trim() || undefined),
    onSuccess: () => {
      toast.success(
        tr(
          "Bron bekor qilindi — o'rindiq bo'shadi",
          'Бронь отменена — место освободилось',
          'Booking cancelled — the seat is free'
        )
      );
      // Ro'yxat va safar detali QAYTA o'qiladi: bo'shagan o'rindiq va yangi
      // status faqat serverdan keladi.
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['ride'] });
      setReason('');
      onCancelled?.();
      onClose();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      // 🔴 409/400 — odatda "endi kech": safar boshlangan yoki allaqachon
      // bekor qilingan. Bunda "qayta urining" deyish odamni hech qachon
      // o'tmaydigan ishga majburlaydi.
      if (status === 409 || status === 400) {
        toast.error(
          tr(
            "Bu bronni endi bekor qilib bo'lmaydi — haydovchiga yozing",
            'Эту бронь уже нельзя отменить — напишите водителю',
            'This booking can no longer be cancelled — message the driver'
          )
        );
        queryClient.invalidateQueries({ queryKey: ['history'] });
        onClose();
        return;
      }
      toast.error(
        tr(
          'Bekor qilinmadi. Qayta urining',
          'Не удалось отменить. Попробуйте ещё раз',
          'Could not cancel. Please try again'
        )
      );
    },
  });

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={tr('Bronni bekor qilasizmi?', 'Отменить бронь?', 'Cancel this booking?')}
    >
      <div className="space-y-5">
        {/* 🔴 OQIBAT OLDIN aytiladi — nechta o'rindiq bo'shashi va buni
            qaytarib bo'lmasligi. */}
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
          {tr(
            `Bron bekor qilinadi va ${seats ?? 1} o'rindiq darhol bo'shaydi. Buni qaytarib bo'lmaydi — fikringiz o'zgarsa qaytadan bron qilasiz, lekin o'rindiqni boshqa birov olib qo'ygan bo'lishi mumkin.`,
            `Бронь будет отменена, и ${seats ?? 1} мест(а) сразу освободятся. Это нельзя вернуть — если передумаете, придётся бронировать заново, но место может занять кто-то другой.`,
            `The booking will be cancelled and ${seats ?? 1} seat(s) freed immediately. This cannot be undone — if you change your mind you can book again, but someone else may have taken the seat.`
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-text">
            {tr('Sabab (ixtiyoriy)', 'Причина (необязательно)', 'Reason (optional)')}
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            disabled={mutation.isPending}
            placeholder={tr(
              "Masalan: rejalarim o'zgardi",
              'Например: планы изменились',
              'For example: my plans changed'
            )}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent disabled:opacity-60"
          />
        </label>

        {/* Tugmalar ATAYIN ochiq nomlangan: «tasdiqlash» qaysi biri ekanini
            yashirardi. */}
        <div className="space-y-2">
          <Button
            variant="danger"
            className="w-full"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? tr('Bekor qilinmoqda…', 'Отменяем…', 'Cancelling…')
              : tr('Ha, bekor qilinsin', 'Да, отменить', 'Yes, cancel it')}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            {tr("Yo'q, qolsin", 'Нет, оставить', 'No, keep it')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
