'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, MoreVertical, ShieldBan } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import {
  blockUser,
  unblockUser,
  isNotAvailable,
  reportUser,
  type ReportReason,
} from '@/shared/api/moderation';
import { useTr } from '@/shared/lib/useTr';

/**
 * Shikoyat va bloklash — Google Play UGC siyosati talabi (xat §7b).
 *
 * Chat ekranida ishlatiladi: foydalanuvchilar bir-biri bilan yozishadigan
 * joyda shikoyat qilish va bloklash imkoni BO'LISHI SHART, aks holda reliz
 * rad etiladi. SOS tugmasi buni qoplamaydi.
 *
 * ✅ 2026-07-31: backend endpointlari qo'shildi (`/reports`, `/users/{id}/block`).
 * Xato kelganda foydalanuvchiga ANIQ aytiladi — jim yutib yuborilmaydi va
 * "yuborildi" degan yolg'on ham ko'rsatilmaydi.
 */
export function ReportBlockMenu({
  targetUserId,
  targetName,
  rideId,
}: {
  targetUserId: string;
  targetName?: string;
  rideId?: string;
}) {
  const locale = useLocale();
  const t = useTr();

  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'report' | 'block' | null>(null);
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [comment, setComment] = useState('');

  // Endpoint yo'qligi bilan haqiqiy xatoni ajratamiz: birinchisida "hali ishga
  // tushirilmagan" to'g'ri, ikkinchisida esa u ADASHTIRADI (funksiya bor, so'rov o'tmadi).
  const failToast = (e: unknown) =>
    toast.error(
      isNotAvailable(e)
        ? t(
            "Bu imkoniyat hali ishga tushirilmagan. Tez orada qo'shiladi.",
            'Эта возможность ещё не запущена. Скоро будет добавлена.',
            'This feature is not live yet. It is coming soon.'
          )
        : t(
            "Amalni bajarib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.",
            'Не удалось выполнить. Попробуйте ещё раз позже.',
            'The action failed. Please try again later.'
          )
    );

  const reportMutation = useMutation({
    mutationFn: () =>
      reportUser({ target_user_id: targetUserId, ride_id: rideId, reason, comment }),
    onSuccess: () => {
      toast.success(t('Shikoyat yuborildi', 'Жалоба отправлена', 'Report sent'));
      setMode(null);
      setOpen(false);
      setComment('');
    },
    onError: failToast,
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(targetUserId),
    onSuccess: () => {
      /*
        🔴 «QAYTARISH» TUGMASI (egasi tasdiqladi, 2026-08-19).

        Bloklash — shikoyat tugmasi bilan YONMA-YON turadigan amal, ya'ni
        tasodifan bosilishi oson. Uni bekor qilish yo'li esa juda uzoq edi:
        Profil → Hisob va xavfsizlik → Bloklangan foydalanuvchilar. Odam
        buni bilmasa, xato bosilgan blok abadiy qolardi va suhbatdosh
        sababsiz "yo'qolgan" bo'lib ko'rinardi.

        Bu yerda tasdiq oynasi EMAS, aynan «Qaytarish» to'g'ri keladi:
        amal SERVERDA qaytariladigan (`unblockUser` bor), ya'ni va'da
        haqiqiy. Qaytarib bo'lmaydigan amallarda esa `useConfirm`
        ishlatiladi — u yerda "qaytaraman" deb yolg'on aytib bo'lmaydi.
      */
      toast.success(t('Foydalanuvchi bloklandi', 'Пользователь заблокирован', 'User blocked'), {
        action: {
          label: t('Qaytarish', 'Вернуть', 'Undo'),
          onClick: () => {
            unblockUser(targetUserId)
              .then(() => {
                toast.success(t('Blok olib tashlandi', 'Блокировка снята', 'User unblocked'));
                queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
              })
              .catch(failToast);
          },
        },
        // Qaytarish uchun odatdagidan uzunroq vaqt: odam avval "nima
        // bo'ldi?" deb o'ylab, keyin tugmani qidiradi.
        duration: 8000,
      });
      // Profildagi "Bloklanganlar" ro'yxati darhol yangilansin.
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      setMode(null);
      setOpen(false);
    },
    onError: failToast,
  });

  const reasons: { value: ReportReason; label: string }[] = [
    {
      value: 'harassment',
      label: t('Haqorat yoki tahdid', 'Оскорбления или угрозы', 'Abuse or threats'),
    },
    { value: 'spam', label: t('Spam yoki reklama', 'Спам или реклама', 'Spam or advertising') },
    { value: 'fraud', label: t('Firibgarlik', 'Мошенничество', 'Fraud') },
    {
      value: 'unsafe',
      label: t('Xavfli xatti-harakat', 'Опасное поведение', 'Dangerous behaviour'),
    },
    { value: 'other', label: t('Boshqa', 'Другое', 'Other') },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Qo'shimcha amallar", 'Дополнительные действия', 'More actions')}
        className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      <Dialog
        isOpen={open && mode === null}
        onClose={() => setOpen(false)}
        title={targetName || t('Amallar', 'Действия', 'Actions')}
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setMode('report')}
            className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-accent"
          >
            <Flag className="h-5 w-5 shrink-0 text-warning" aria-hidden />
            <span className="text-sm font-bold text-text">
              {t('Shikoyat qilish', 'Пожаловаться', 'Report')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode('block')}
            className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-error"
          >
            <ShieldBan className="h-5 w-5 shrink-0 text-error" aria-hidden />
            <span className="text-sm font-bold text-text">
              {t('Bloklash', 'Заблокировать', 'Block')}
            </span>
          </button>
        </div>
      </Dialog>

      {/* Shikoyat: sabab + ixtiyoriy izoh */}
      <Dialog
        isOpen={mode === 'report'}
        onClose={() => setMode(null)}
        title={t('Shikoyat qilish', 'Пожаловаться', 'Report')}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {reasons.map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                  reason === r.value ? 'border-accent bg-accent/5' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-[var(--brand-pink)]"
                />
                <span className="text-sm font-semibold text-text">{r.label}</span>
              </label>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t(
              'Qisqacha tushuntiring (ixtiyoriy)',
              'Кратко опишите (необязательно)',
              'Briefly describe the issue (optional)'
            )}
            className="w-full rounded-xl border border-border bg-bg p-3 text-sm text-text focus:border-accent focus:outline-none"
          />

          <div className="flex gap-2">
            <Button
              onClick={() => reportMutation.mutate()}
              isLoading={reportMutation.isPending}
              className="flex-1"
            >
              {t('Yuborish', 'Отправить', 'Send')}
            </Button>
            <Button variant="secondary" onClick={() => setMode(null)} className="flex-1">
              {t('Bekor qilish', 'Отмена', 'Cancel')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Bloklash: tasdiqlash */}
      <Dialog
        isOpen={mode === 'block'}
        onClose={() => setMode(null)}
        title={t('Bloklash', 'Заблокировать', 'Block')}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-text-muted">
            {t(
              "Bloklangan foydalanuvchi sizga yoza olmaydi va safarlaringizni ko'rmaydi. Buni keyin bekor qilishingiz mumkin.",
              'Заблокированный пользователь не сможет вам писать и не увидит ваши поездки. Это можно отменить позже.',
              'A blocked user cannot message you and will not see your trips. You can undo this later.'
            )}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => blockMutation.mutate()}
              isLoading={blockMutation.isPending}
              className="flex-1 bg-error hover:bg-error"
            >
              {t('Bloklash', 'Заблокировать', 'Block')}
            </Button>
            <Button variant="secondary" onClick={() => setMode(null)} className="flex-1">
              {t('Bekor qilish', 'Отмена', 'Cancel')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
