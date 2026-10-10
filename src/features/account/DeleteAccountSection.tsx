'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { deleteAccount, isNotAvailable } from '@/shared/api/moderation';
import { performLogout } from '@/shared/lib/logout';
import { SUPPORT_EMAIL } from '@/shared/config/contacts';
import { trFor } from '@/shared/lib/i18n';

/**
 * Hisobni o'chirish — Google Play MAJBURIY talabi (2024-dan).
 *
 * Play ikkitasini so'raydi: (a) ilova ICHIDA o'chirish yo'li — mana shu,
 * (b) kirmasdan ochiladigan veb-sahifa — `/[locale]/account-delete`.
 *
 * ✅ 2026-07-31: `DELETE /users/me` backendda bor (yumshoq o'chirish, telefon
 * raqami anonimlashtiriladi). Endpoint topilmasa (eski gateway) foydalanuvchiga
 * pochta yo'li ko'rsatiladi — "o'chirildi" degan yolg'on KO'RSATILMAYDI.
 *
 * Tasdiqlash uchun ataylab matn yozdirish talab qilinadi: bu qaytarib
 * bo'lmaydigan amal, oddiy "Ha" tugmasi tasodifan bosilishi mumkin.
 */
export function DeleteAccountSection({ locale }: { locale: string }) {
  const t = trFor(locale);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const CONFIRM_WORD = t("O'CHIRISH", 'УДАЛИТЬ', 'DELETE');

  const mutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success(
        t(
          "Hisob yopildi. Ma'lumotlar 30 kun ichida o'chiriladi.",
          'Аккаунт закрыт. Данные будут удалены в течение 30 дней.',
          'Account closed. The data will be deleted within 30 days.'
        )
      );
      performLogout(queryClient, locale);
    },
    onError: (e) => {
      // Endpoint hali yoyilmagan bo'lsa — pochta yo'lini ko'rsatamiz; boshqa xatoda
      // "pochta orqali yuboring" deyish adashtiradi (amal aslida qabul qilinmadi).
      toast.error(
        isNotAvailable(e)
          ? t(
              "Hozircha ilova orqali o'chirib bo'lmaydi — pochta orqali so'rov yuboring.",
              'Пока удалить через приложение нельзя — отправьте запрос по почте.',
              'Deleting from the app is not available yet — please send a request by email.'
            )
          : t(
              "O'chirib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.",
              'Не удалось удалить. Попробуйте ещё раз позже.',
              'Could not delete. Please try again later.'
            )
      );
    },
  });

  return (
    <>
      <div className="rounded-2xl border border-border/60 p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          /* ⚠️ `min-h-11`: balandligi 20 px edi (o'lchandi 2026-09-04).
             Bu Google Play MAJBURIY qilgan amal — odam uni topolmasa,
             do'kon talabi bajarilmagan hisoblanadi. Urg'usi baribir
             past (neytral rang, ekran oxirida). */
          className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-bold text-text-muted transition-colors hover:text-error"
        >
          <Trash2 className="h-4 w-4" />
          {t("Hisobni o'chirish", 'Удалить аккаунт', 'Delete account')}
        </button>
      </div>

      <Dialog
        isOpen={open}
        onClose={() => {
          setOpen(false);
          setConfirmText('');
        }}
        title={t("Hisobni o'chirish", 'Удаление аккаунта', 'Delete account')}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-text-muted">
            {t(
              "Bu amalni QAYTARIB BO'LMAYDI. Safarlar tarixi, reyting, sharhlar va chat xabarlaringiz o'chiriladi.",
              'Это действие НЕОБРАТИМО. История поездок, рейтинг, отзывы и сообщения будут удалены.',
              'This action is IRREVERSIBLE. Your trip history, rating, reviews and chat messages will be deleted.'
            )}
          </p>

          <Link
            href={`/${locale}/account-delete`}
            className="inline-block text-sm font-bold text-accent underline-offset-4 hover:underline"
          >
            {t(
              "Nima o'chadi va nima saqlanadi",
              'Что удаляется и что сохраняется',
              'What is deleted and what is kept'
            )}
          </Link>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wide text-text-muted">
              {t(
                `Tasdiqlash uchun «${CONFIRM_WORD}» deb yozing`,
                `Введите «${CONFIRM_WORD}»`,
                `Type «${CONFIRM_WORD}» to confirm`
              )}
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-bold text-text focus:border-error focus:outline-none"
              placeholder={CONFIRM_WORD}
              autoComplete="off"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => mutation.mutate()}
              disabled={confirmText.trim().toUpperCase() !== CONFIRM_WORD}
              isLoading={mutation.isPending}
              className="flex-1 bg-error hover:bg-error"
            >
              {t("O'chirish", 'Удалить', 'Delete')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setConfirmText('');
              }}
              className="flex-1"
            >
              {t('Bekor qilish', 'Отмена', 'Cancel')}
            </Button>
          </div>

          <p className="text-xs text-text-muted">
            {t("Muammo bo'lsa: ", 'При проблемах: ', 'If something goes wrong: ')}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-bold text-accent underline-offset-4 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </Dialog>
    </>
  );
}
