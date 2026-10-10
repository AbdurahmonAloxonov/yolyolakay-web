'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitFeedback } from '@/shared/api/rating';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { BottomSheet } from './BottomSheet';
import { StarRating } from './StarRating';
import { Button } from './Button';
import { useTr } from '@/shared/lib/useTr';

/**
 * Safardan keyin ishtirokchini baholash oynasi — FAQAT completed safar uchun
 * (chaqiruvchi shuni kafolatlaydi). Haydovchi <-> yo'lovchi o'zaro baholaydi.
 * Yangi Gateway: POST /rating {ride_id, reviewee_id, score 1-5, comment?} — reviewer tokendan.
 */
export function RatingModal({
  isOpen,
  onClose,
  tripId,
  revieweeId,
  revieweeName,
  onSubmitted,
}: {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  revieweeId?: string;
  revieweeName?: string;
  onSubmitted?: () => void;
}) {
  const locale = useLocale();
  const tr = useTr();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      submitFeedback({
        ride_id: tripId,
        reviewee_id: revieweeId ?? '',
        score: rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success(tr('Baho uchun rahmat!', 'Спасибо за оценку!', 'Thanks for your rating!'));
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setRating(0);
      setComment('');
      onSubmitted?.();
      onClose();
    },
    onError: (err: any) => {
      const status = err?.response?.status;

      /*
       * 🔴 "ALLAQACHON BAHOLANGAN" — XATO EMAS (2026-08-16).
       *
       * Gateway'da "men kimni baholaganman" degan endpoint YO'Q, shuning
       * uchun tugma baho berilgandan keyin ham chiqib turishi mumkin:
       * odam telefonda baholab, saytga kirsa yoki ikki marta bossa.
       * Ilgari bunda "Baho yuborilmadi. Qayta urining" chiqardi — ya'ni
       * odam HECH QACHON o'tmaydigan ishni qayta-qayta bosardi.
       *
       * Mobil ilovada ayni holat `RatingRepository._isAlreadyRated` da
       * shunday ishlanadi: xato emas, muvaffaqiyat deb qabul qilinadi.
       */
      const raw = String(
        err?.response?.data?.error ?? err?.response?.data?.message ?? ''
      ).toLowerCase();
      const alreadyRated =
        raw.includes('already') && (raw.includes('rat') || raw.includes('feedback'));
      if (alreadyRated) {
        toast(
          tr(
            'Bu safarni allaqachon baholagansiz',
            'Вы уже оценили эту поездку',
            'You have already rated this trip'
          )
        );
        queryClient.invalidateQueries({ queryKey: ['history'] });
        onSubmitted?.();
        onClose();
        return;
      }

      // Backend endpoint hali tayyor emas (404) — foydalanuvchiga tushunarli xabar.
      if (status === 404) {
        toast.error(
          tr(
            'Baholash tizimi tez orada ishga tushadi',
            'Система оценок скоро заработает',
            'Ratings are coming soon'
          )
        );
      } else {
        toast.error(
          tr(
            'Baho yuborilmadi. Qayta urining',
            'Не удалось отправить оценку',
            'Could not send the rating. Please try again'
          )
        );
      }
    },
  });

  const handleSubmit = () => {
    if (rating < 1) {
      toast.error(tr('Yulduz tanlang (1–5)', 'Выберите оценку (1–5)', 'Pick a rating (1–5)'));
      return;
    }
    // Backend target_id'ni MAJBURIY qiladi — usiz so'rov baribir 400 bo'ladi,
    // jim yuborib xato olgandan ko'ra aniq xabar beramiz.
    if (!revieweeId) {
      toast.error(
        tr(
          'Baholanuvchi aniqlanmadi. Sahifani yangilab qayta urining',
          'Не удалось определить получателя оценки. Обновите страницу',
          'Could not identify who to rate. Refresh the page and try again'
        )
      );
      return;
    }
    mutation.mutate();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={tr('Safarni baholang', 'Оцените поездку', 'Rate the trip')}
    >
      <div className="space-y-5">
        {revieweeName && (
          <p className="text-center text-sm text-text-muted">
            {tr('Kim bilan sayohat qildingiz:', 'С кем вы ехали:', 'Who you travelled with:')}{' '}
            <span className="font-bold text-foreground">{revieweeName}</span>
          </p>
        )}

        <div className="flex justify-center">
          <StarRating value={rating} onChange={setRating} size={38} />
        </div>

        <div className="space-y-1">
          <label className="ml-1 text-sm font-medium text-text">
            {tr('Izoh (ixtiyoriy)', 'Комментарий (необязательно)', 'Comment (optional)')}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 300))}
            rows={3}
            placeholder={tr("Sayohat qanday o'tdi?", 'Как прошла поездка?', 'How was the ride?')}
            className="w-full resize-none rounded-xl border border-border bg-bg-soft px-4 py-3 text-sm text-text outline-none transition-colors focus:border-accent"
          />
        </div>

        <Button
          onClick={handleSubmit}
          isLoading={mutation.isPending}
          disabled={mutation.isPending}
          className="w-full"
        >
          {tr('Yuborish', 'Отправить', 'Send')}
        </Button>
      </div>
    </BottomSheet>
  );
}
