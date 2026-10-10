'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { setupPassword } from '@/shared/api/auth';
import { localizeBackendMessage } from '@/shared/lib/format';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from 'next-intl';
import { useTr } from '@/shared/lib/useTr';

/**
 * Parol o'rnatish/almashtirish (profil bo'limi) — POST /auth/setup-password
 * (jonli tasdiqlangan 2026-07-19). O'rnatilgach login sahifadagi "Parol bilan kirish"
 * rejimi SMS'siz ishlaydi. OTP baribir asosiy yo'l bo'lib qoladi.
 */
export function PasswordSection() {
  const locale = useLocale();
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useMutation({
    mutationFn: () => setupPassword(password),
    onSuccess: () => {
      toast.success(
        tr(
          "Parol o'rnatildi — endi SMS'siz kirishingiz mumkin",
          'Пароль установлен — теперь можно входить без SMS',
          'Password set — you can now sign in without SMS'
        )
      );
      setOpen(false);
      setPassword('');
      setConfirm('');
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      const msg = err.response?.data?.error || err.response?.data?.message;
      toast.error(
        localizeBackendMessage(msg, locale) ||
          tr(
            "Parol o'rnatilmadi. Qayta urining",
            'Не удалось установить пароль',
            'Could not set the password. Please try again'
          )
      );
    },
  });

  const submit = () => {
    if (password.length < 6) {
      toast.error(
        tr(
          "Parol kamida 6 belgidan iborat bo'lsin",
          'Пароль должен быть не короче 6 символов',
          'Password must be at least 6 characters'
        )
      );
      return;
    }
    if (password !== confirm) {
      toast.error(tr('Parollar mos kelmadi', 'Пароли не совпадают', 'Passwords do not match'));
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
      {/*
        🔴 O'LCHANDI (2026-09-03): sarlavha 14 px va yonidagi havola bir
        qatorda turgani uchun kartochka 390 px ekranda 29 px TASHQARIGA
        chiqib kesilardi. Endi yorliq sayt bo'ylab umumiy `SectionLabel`
        (11 px, islimi novdasi bilan), havola esa uning `trailing` i —
        novda ikkalasining orasida qolgan joyni oladi va joy qolmasa
        o'zi yo'qoladi, ya'ni toshish mumkin emas.
      */}
      <SectionLabel
        icon={<KeyRound />}
        trailing={
          !open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              /* ⚠️ Balandligi 16 px edi — sahifadagi eng past nishon
                 (o'lchandi 2026-09-04). */
              className="inline-flex min-h-11 items-center text-xs font-bold text-accent hover:underline"
            >
              {tr("O'rnatish / almashtirish", 'Задать / сменить', 'Set / change')}
            </button>
          )
        }
      >
        {tr('Parol bilan kirish', 'Вход по паролю', 'Sign in with a password')}
      </SectionLabel>

      {!open ? (
        <p className="text-sm text-text-muted">
          {tr(
            "Parol o'rnatsangiz, keyingi safar SMS kutmasdan kirishingiz mumkin.",
            'Задайте пароль, чтобы входить без ожидания SMS.',
            'Set a password to sign in without waiting for an SMS.'
          )}
        </p>
      ) : (
        <div className="space-y-3">
          <Input
            type="password"
            label={tr('Yangi parol', 'Новый пароль', 'New password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            type="password"
            label={tr('Parolni takrorlang', 'Повторите пароль', 'Repeat the password')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => {
                setOpen(false);
                setPassword('');
                setConfirm('');
              }}
            >
              {tr('Bekor qilish', 'Отмена', 'Cancel')}
            </Button>
            <Button
              type="button"
              className="flex-1"
              isLoading={mutation.isPending}
              disabled={mutation.isPending}
              onClick={submit}
            >
              {tr('Saqlash', 'Сохранить', 'Save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
