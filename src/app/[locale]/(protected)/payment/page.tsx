'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProfile } from '@/entities/user/api/useProfile';
import { useUIStore } from '@/shared/model/uiStore';
import { getTransaction } from '@/shared/api/billing';
import { forgetTransaction, recallTransaction } from '@/shared/lib/checkout';
import { Button } from '@/shared/ui/Button';
import { CheckCircle2, XCircle, Loader2, CreditCard, Clock } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';

// To'lov provayderi "fail"/"cancel" holatini bildiruvchi parametrlar (turli provayderlar).
const FAIL_STATES = ['fail', 'failed', 'cancel', 'cancelled', 'canceled', 'error', 'declined'];

/** Backend tranzaksiya holatlari (14.09.2026): pending | success | failed | cancelled. */
const TX_DONE = ['success', 'succeeded', 'paid', 'completed'];
const TX_FAIL = ['failed', 'cancelled', 'canceled', 'error', 'declined'];

/** Nechа marta so'raymiz — 2 soniyada bir, ya'ni ~40 soniya. */
const TX_TRIES = 20;

function PaymentResult() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeRole = useUIStore((s) => s.activeRole);
  const tr = useTr();

  const { data: profile, refetch } = useProfile();

  // Provayder qaytargan holat (bo'lsa). Ko'p provayderlar status/state/result beradi.
  const rawStatus = (
    searchParams.get('status') ||
    searchParams.get('state') ||
    searchParams.get('result') ||
    ''
  ).toLowerCase();
  const isFailed = FAIL_STATES.includes(rawStatus);

  /*
   * TO'LOV HOLATI — ENDI TAXMIN EMAS, SO'RALADI (14.09.2026).
   *
   * 🔴 NEGA O'ZGARDI: ilgari bu sahifa profilni 4 marta qayta o'qib,
   * 8 soniyadan keyin HAR DOIM «To'lov qabul qilindi!» deb yozardi —
   * to'lov o'tgan-o'tmaganidan QAT'I NAZAR. Ya'ni karta rad etilgan
   * odam ham yashil belgi va tabrik ko'rardi. Bu bizdagi eski
   * kasallik: javobni bilmasdan turib xushxabar berish.
   *
   * Backend 14.09 da `transaction_id` va
   * `GET /billing/transactions/{id}` berdi — endi AYNAN shu to'lovni
   * so'raymiz va rostini aytamiz.
   *
   * Zaxira yo'l saqlanadi: id bo'lmasa yoki so'rov javob bermasa
   * (noma'lum id'da backend 500 beradi), eski xulq — profilni
   * yangilab, neytral «qabul qilindi» — ishlaydi. Aks holda to'lovi
   * o'tgan odam bo'sh ekranda qolardi.
   */
  const txFromUrl = searchParams.get('transaction_id') || searchParams.get('transaction') || '';
  const [txStatus, setTxStatus] = useState<'pending' | 'done' | 'failed' | 'unknown'>('pending');
  const [checking, setChecking] = useState(!isFailed);

  useEffect(() => {
    if (isFailed) return;
    const txId = txFromUrl || recallTransaction() || '';
    let alive = true;
    let count = 0;

    const tick = async () => {
      count += 1;
      refetch();

      if (txId) {
        const tx = await getTransaction(txId);
        const st = (tx?.status ?? '').toLowerCase();
        if (!alive) return;
        if (TX_DONE.includes(st)) {
          setTxStatus('done');
          forgetTransaction();
          setChecking(false);
          return;
        }
        if (TX_FAIL.includes(st)) {
          setTxStatus('failed');
          forgetTransaction();
          setChecking(false);
          return;
        }
      }

      // Id yo'q (yoki javob bermadi) — eski yo'l: bir necha marta
      // profilni yangilab, neytral tugatamiz.
      const limit = txId ? TX_TRIES : 4;
      if (count >= limit) {
        if (!alive) return;
        setTxStatus(txId ? 'pending' : 'unknown');
        setChecking(false);
      }
    };

    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isFailed, refetch, txFromUrl]);

  // Provayder "bekor" desa ham, tranzaksiya "rad etildi" desa ham — bir xil ekran.
  const failed = isFailed || txStatus === 'failed';

  const balance =
    activeRole === 'driver' ? (profile?.driver_balance ?? 0) : (profile?.passenger_balance ?? 0);
  // Manfiy balans ko'rsatilmaydi (backend -1 berishi mumkin — format.ts izohi).
  const balanceShown = Math.max(0, balance);
  const goHome = () =>
    router.push(activeRole === 'driver' ? `/${locale}/dashboard` : `/${locale}/search`);

  return (
    <div className="flex-1 bg-bg flex items-center justify-center px-4 py-12 min-h-[70vh]">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center space-y-6 shadow-sm">
        {/* TO'LOV AMALGA OSHMADI */}
        {failed ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 text-error border border-error/20">
              <XCircle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-extrabold text-text">
                {tr("To'lov amalga oshmadi", 'Платёж не прошёл', 'Payment failed')}
              </h1>
              <p className="text-sm text-text-muted leading-relaxed">
                {tr(
                  "To'lov bekor qilindi yoki xatolik yuz berdi. Qayta urinib ko'ring.",
                  'Платёж был отменён или произошла ошибка. Попробуйте ещё раз.',
                  'The payment was cancelled or failed. Please try again.'
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() =>
                  // 2026-08-11: tariflar BITTA sahifada — rolga qarab ajratish kerak emas.
                  // (profil sahifasidagi 'To'ldirish' bilan bir xil marshrut).
                  router.push(`/${locale}/tariffs`)
                }
                className="w-full"
              >
                {tr('Qayta urinish', 'Попробовать снова', 'Try again')}
              </Button>
              <Button onClick={goHome} variant="secondary" className="w-full">
                {tr('Bosh sahifa', 'На главную', 'Home')}
              </Button>
            </div>
          </>
        ) : checking ? (
          /* TEKSHIRILMOQDA */
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-pink-light dark:bg-accent/10 text-accent border border-accent/20">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-extrabold text-text">
                {tr("To'lov tekshirilmoqda...", 'Проверяем платёж...', 'Checking the payment...')}
              </h1>
              <p className="text-sm text-text-muted leading-relaxed">
                {tr(
                  'Iltimos kuting, balansingiz yangilanmoqda.',
                  'Пожалуйста, подождите — баланс обновляется.',
                  'Please wait, your balance is being updated.'
                )}
              </p>
            </div>
          </>
        ) : (
          /* MUVAFFAQIYATLI (yoki yakunlangan) */
          <>
            <div
              className={
                txStatus === 'pending'
                  ? 'mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 text-warning border border-warning/20'
                  : 'mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 text-success border border-success/20'
              }
            >
              {txStatus === 'pending' ? (
                <Clock className="h-8 w-8" />
              ) : (
                <CheckCircle2 className="h-8 w-8" />
              )}
            </div>
            <div className="space-y-2">
              {/* 🔑 «HALI MA'LUM EMAS» ni «MUVAFFAQIYAT» deb yozmaymiz.
                  Tranzaksiya 40 soniyada ham `pending` bo'lsa — shuni
                  aytamiz. Ilgari bu holat ham tabrik bilan tugardi. */}
              <h1 className="text-xl font-extrabold text-text">
                {txStatus === 'pending'
                  ? tr(
                      "To'lov hali tasdiqlanmadi",
                      'Платёж ещё не подтверждён',
                      'Payment not confirmed yet'
                    )
                  : tr("To'lov qabul qilindi!", 'Платёж принят!', 'Payment accepted!')}
              </h1>
              <p className="text-sm text-text-muted leading-relaxed">
                {txStatus === 'pending'
                  ? tr(
                      "Bank javobi kechikmoqda. Pul yechilgan bo'lsa, paket bir necha daqiqada o'zi faollashadi.",
                      'Банк отвечает с задержкой. Если деньги списаны, пакет активируется в течение нескольких минут.',
                      'The bank is slow to respond. If you were charged, your plan will activate within a few minutes.'
                    )
                  : tr(
                      'Balansingiz yangilandi. Yaxshi sayohat!',
                      'Ваш баланс обновлён. Хорошей поездки!',
                      'Your balance has been updated. Have a good trip!'
                    )}
              </p>
            </div>
            <div className="rounded-xl bg-bg border border-border p-4 flex items-center justify-between">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-accent" />
                {tr('Joriy balans', 'Текущий баланс', 'Current balance')}
              </span>
              <span className="text-lg font-extrabold text-accent">
                {balanceShown} {tr('safar', 'поездок', 'rides')}
              </span>
            </div>
            <Button onClick={goHome} className="w-full">
              {tr('Davom etish', 'Продолжить', 'Continue')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[70vh]">
          <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        </div>
      }
    >
      <PaymentResult />
    </Suspense>
  );
}
