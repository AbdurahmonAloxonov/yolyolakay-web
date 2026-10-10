'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/shared/ui/Button';
import { Coffee, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/entities/user/api/useProfile';
import { useTr } from '@/shared/lib/useTr';

export default function PitStopPage() {
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tr = useTr();

  const { data: profile, isLoading } = useProfile();
  const timeoutUntil = profile?.timeout_until;

  // Qolgan vaqt — HAQIQIY `timeout_until` (backend) bo'yicha hisoblanadi.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!timeoutUntil) {
      setSecondsLeft(0);
      return;
    }
    const compute = () =>
      Math.max(0, Math.floor((new Date(timeoutUntil).getTime() - Date.now()) / 1000));
    setSecondsLeft(compute());
    const interval = setInterval(() => setSecondsLeft(compute()), 1000);
    return () => clearInterval(interval);
  }, [timeoutUntil]);

  // Bloklanmagan bo'lsa (timeout_until yo'q/o'tган) — bu sahifada ushlab turmaymiz, uyga qaytaramiz.
  useEffect(() => {
    if (isLoading) return; // profil yuklanguncha kutamiz
    const until = timeoutUntil ? new Date(timeoutUntil).getTime() : 0;
    if (!until || until <= Date.now()) {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.replace(`/${locale}/search`);
    }
  }, [isLoading, timeoutUntil, secondsLeft, queryClient, router, locale]);

  // Форматирование времени в MM:SS (soat bo'lsa HH:MM:SS)
  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (num: number) => String(num).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  const remaining = secondsLeft ?? 0;

  return (
    <div className="flex-grow flex items-center justify-center bg-bg px-4 py-8 select-none">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-surface p-8 shadow-md text-center">
        {/* Kofe chashkasi ikonasi (statik) */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-warning/10 text-warning border border-warning/20">
          <Coffee className="h-10 w-10" />
        </div>

        {/* Информационные сообщения */}
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-black text-foreground tracking-tight">
            {tr("Yo'l cheti (Pit-Stop)", 'Время Пит-Стопа', 'Pit stop')}
          </h2>
          <p className="text-sm font-semibold text-text-muted max-w-xs mx-auto leading-relaxed">
            {tr(
              'Biz sizni butunlay bloklamaymiz, shunchaki xavfsizlik va hurmat yuzasidan qisqa tanaffus qilishni maslahat beramiz.',
              'Мы не верим в грубые баны. Вместо этого мы предлагаем вам сделать короткую паузу, выпить чашку кофе и отдохнуть от трассы.',
              'We do not ban people outright. We simply ask you to take a short break, for safety and respect.'
            )}
          </p>
        </div>

        {/* Анимация таймера */}
        <div className="bg-bg border border-border rounded-2xl p-6 space-y-2 shadow-inner">
          <div className="flex items-center justify-center gap-2 text-text-muted font-bold text-xs uppercase tracking-wider">
            <Timer
              className="h-4.5 w-4.5 text-accent animate-spin"
              style={{ animationDuration: '4s' }}
            />
            <span>{tr('Tanaffus tugashiga', 'До окончания перерыва', 'Break ends in')}</span>
          </div>

          <div className="text-4xl font-extrabold text-text font-mono tracking-wider">
            {formatTime(remaining)}
          </div>
        </div>

        {/* Заботливое пояснение */}
        <div className="text-xs text-text-muted font-semibold leading-relaxed border-t border-border/80 pt-4 text-left space-y-1">
          <span className="text-text block font-extrabold">
            {tr("Nima sodir bo'ldi?", 'Что произошло?', 'What happened?')}
          </span>
          <span>
            {tr(
              "Safar bekor qilinishi yoki kelmaslik (no-show) sabab, platformada qisqa tanaffus belgilandi. Bu vaqt ichida yangi torglar yaratib bo'lmaydi.",
              'Из-за частых отмен или неявок (no-show) система перевела ваш аккаунт в режим отдыха. Это помогает сохранять дорожное спокойствие.',
              'Because of cancellations or no-shows, your account is on a short break. You cannot start new bids during this time.'
            )}
          </span>
        </div>

        {/* Кнопка действия */}
        <Button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            router.replace(`/${locale}/search`);
          }}
          className="w-full"
          variant="secondary"
          disabled={remaining > 0}
        >
          {remaining > 0
            ? tr('Kuting...', 'Отдыхаем...', 'Taking a break...')
            : tr('Davom etish', 'Вернуться на трассу', 'Continue')}
        </Button>
      </div>
    </div>
  );
}
