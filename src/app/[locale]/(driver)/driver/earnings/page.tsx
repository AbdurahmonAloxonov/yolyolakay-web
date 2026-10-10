'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft, CheckCircle, XCircle, Route, Wallet, RefreshCw } from 'lucide-react';
import { useDriverEarnings } from '@/entities/ride/api/useDriverEarnings';
import { formatCurrency } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/EmptyState';
import { GirihPattern } from '@/shared/ui/brand/Ornament';
import { CountUp } from '@/shared/ui/motion';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Button } from '@/shared/ui/Button';
import { useTr } from '@/shared/lib/useTr';
import { useUIStore } from '@/shared/model/uiStore';

/**
 * Haydovchi daromadi — `GET /rides/earnings` (swagger 2026-08-03).
 *
 * KO'RSATISH SHAKLI (ataylab grafik EMAS): backend to'rtta yig'ma son beradi —
 * `total_earnings`, `total_rides`, `completed_rides`, `cancelled_rides`. Davr
 * bo'yicha bo'linish YO'Q, ya'ni chizish uchun qator ham, vaqt o'qi ham yo'q.
 * Bunday ma'lumot uchun to'g'ri shakl — bitta yetakchi son (hero) + KPI
 * kafeli + bitta nisbat o'lchagichi (meter). Ikki bo'lakli "pirog" yoki bitta
 * ustunli diagramma bu yerda faqat bezak bo'lardi.
 *
 * RANG: o'lchagich to'ldirmasi `accent` (brand-pink), bo'sh yo'lak — O'SHA rangning
 * och qadami (`accent/15`), neytral kulrang EMAS: holat butun chiziq bo'ylab o'qilsin.
 * NEGA `success` emas: brend `--success` = turquoise (#99e1d9) va uning oq fondagi
 * kontrasti 1.45:1 — 10px chiziq oddiy ko'zga ham deyarli ko'rinmaydi (o'lchandi).
 * `accent` esa ikkala temada ham 3:1 dan yuqori.
 * Yakunlangan/bekor qilingan yozuvlarida holat ranglari qoladi, LEKIN yonida doim
 * ikonка va matn bor — rang yolg'iz ma'no tashimaydi (rang ko'rmaydiganlar uchun).
 *
 * MA'LUMOT YO'Q va NOL — boshqa narsa: maydon kelmasa "—" chiziladi, 0 emas.
 */

/** Bitta KPI kafeli. Qiymat ustunda emas — proporsional raqamlar (tabular emas). */
function StatTile({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'error';
}) {
  // `text-success` ATAYIN ishlatilmaydi: brendda `--success` = turquoise (#99e1d9),
  // uning oq fondagi kontrasti 1.45:1 — 14px ikonка deyarli ko'rinmaydi. Yorug'
  // temada to'q siyoh (wine-ash), tungi temada turquoise — ikkalasi ham brend tokeni.
  const toneClass =
    tone === 'success'
      ? 'text-wine-ash dark:text-turquoise'
      : tone === 'error'
        ? 'text-error'
        : 'text-accent';
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-text-muted">
        <span className={toneClass}>{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] font-bold text-text-muted">{hint}</p>}
    </div>
  );
}

export default function DriverEarningsPage() {
  const locale = useLocale();
  const tr = useTr();
  const { setActiveRole } = useUIStore();
  const { data, isLoading, isError, refetch, isFetching } = useDriverEarnings();

  React.useEffect(() => {
    setActiveRole('driver');
  }, [setActiveRole]);

  const num = (v?: number) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const earnings = num(data?.total_earnings);
  const total = num(data?.total_rides);
  const completed = num(data?.completed_rides);
  const cancelled = num(data?.cancelled_rides);

  // Yakunlash ulushi — maxraj sifatida `total_rides`ni olamiz; u kelmasa
  // yakunlangan+bekor qilingan yig'indisi (backend yig'ma sonlarni alohida
  // hisoblaydi, shuning uchun ikkalasi ham bo'lmasa o'lchagich chizilmaydi).
  const denom = total ?? (completed !== null && cancelled !== null ? completed + cancelled : null);
  const rate =
    denom && denom > 0 && completed !== null ? Math.round((completed / denom) * 100) : null;

  // O'rtacha safar narxi — foydali, lekin faqat ikkala son bo'lgandagina rost.
  const avg =
    earnings !== null && completed !== null && completed > 0 ? earnings / completed : null;

  const dash = '—';
  const money = (v: number | null) => (v === null ? dash : formatCurrency(v, locale));
  const count = (v: number | null) => (v === null ? dash : String(v));

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8 select-none">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/${locale}/dashboard`}
            /* ⚠️ Balandligi 20 px edi (o'lchandi 2026-09-04). */
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-text-muted transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            {tr('Panelga qaytish', 'Назад в панель', 'Back to dashboard')}
          </Link>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={tr('Yangilash', 'Обновить', 'Refresh')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition-colors hover:text-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-1">
          <h1 className="font-display text-3xl font-black tracking-tight text-foreground">
            {tr('Daromadim', 'Мой заработок', 'My earnings')}
          </h1>
          <p className="text-sm text-text-muted">
            {tr(
              "Yakunlangan safarlaringiz bo'yicha umumiy hisob.",
              'Сводка по вашим завершённым поездкам.',
              'A summary of your completed trips.'
            )}
          </p>
        </div>

        {isLoading ? (
          // Umumiy `Skeleton` primitivi — ilgari shu yerda qo'lda yozilgan
          // `animate-pulse` bloklari turardi va primitiv umuman ishlatilmasdi.
          // Bitta joydan kelgani yaxshi: pulse tezligi yoki rangi o'zgarsa,
          // butun ilovada bir xil o'zgaradi.
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-[168px] rounded-2xl border border-border" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[104px] rounded-2xl border border-border" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="space-y-3 rounded-2xl border border-error/20 bg-error/5 p-6 text-center">
            <p className="text-sm font-bold text-text">
              {tr(
                "Statistikani yuklab bo'lmadi",
                'Не удалось загрузить статистику',
                'Could not load your statistics'
              )}
            </p>
            <p className="text-xs text-text-muted">
              {tr(
                "Internet aloqasini tekshirib, qayta urinib ko'ring.",
                'Проверьте соединение и попробуйте ещё раз.',
                'Check your connection and try again.'
              )}
            </p>
            <Button variant="secondary" onClick={() => refetch()}>
              {tr('Qayta urinish', 'Повторить', 'Try again')}
            </Button>
          </div>
        ) : (
          // `mo-in` — skeleton'dan kontentga yumshoq o'tish. Skeleton bloklari
          // va haqiqiy kontent bir xil o'lchamda, shuning uchun keskin almashuv
          // "chaqnash" bo'lib ko'rinardi.
          <div className="mo-in space-y-4">
            {/* YETAKCHI SON — ekranda BITTA. Katta raqam proporsional shriftda
                (tabular-nums faqat ustunlar uchun). */}
            <div className="relative overflow-hidden rounded-2xl border border-wine-ash bg-wine-ash p-6 text-white">
              <GirihPattern size={92} color="var(--turquoise)" opacity={0.06} />
              <div className="relative z-10">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-white/50">
                  <Wallet className="h-3.5 w-3.5 text-turquoise" />
                  {tr('Jami daromad', 'Всего заработано', 'Total earned')}
                </p>
                {/* Summa 0 dan sanaladi. PUL bo'lgani uchun `CountUp` uch qatlamli
                    kafolat bilan yozilgan (izohi komponentda): JS ishlamasa ham
                    server HTML'ida haqiqiy raqam turadi, rAF muzlasa taymer yakuniy
                    qiymatni qo'yadi. Ma'lumot kelmagan bo'lsa animatsiya YO'Q — "—"
                    chiziqchasi sanalmaydi. */}
                <p className="mt-2 text-[clamp(2.5rem,9vw,3.5rem)] font-extrabold leading-none">
                  {earnings === null ? (
                    dash
                  ) : (
                    <CountUp value={earnings} format={(n) => formatCurrency(n, locale)} />
                  )}
                </p>
                <p className="mt-3 text-xs font-bold text-white/60">
                  {completed !== null
                    ? tr(
                        `${completed} ta yakunlangan safar uchun`,
                        `за ${completed} завершённых поездок`,
                        `across ${completed} completed trips`
                      )
                    : tr(
                        "Yakunlangan safarlar bo'yicha",
                        'По завершённым поездкам',
                        'Across completed trips'
                      )}
                </p>
              </div>
            </div>

            {/* KPI qatori */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={<CheckCircle className="h-3.5 w-3.5" />}
                label={tr('Yakunlangan', 'Завершено', 'Completed')}
                value={count(completed)}
                tone="success"
              />
              <StatTile
                icon={<XCircle className="h-3.5 w-3.5" />}
                label={tr('Bekor qilingan', 'Отменено', 'Cancelled')}
                value={count(cancelled)}
                tone="error"
              />
              <StatTile
                icon={<Route className="h-3.5 w-3.5" />}
                label={tr('Jami safar', 'Всего поездок', 'Total trips')}
                value={count(total)}
              />
              <StatTile
                icon={<Wallet className="h-3.5 w-3.5" />}
                label={tr("O'rtacha", 'В среднем', 'Average')}
                value={money(avg)}
                hint={tr('bitta safarga', 'за поездку', 'per trip')}
              />
            </div>

            {/* NISBAT O'LCHAGICHI — bitta ko'rsatkich, ikki bo'lakli "pirog" emas.
                To'ldirma holatni bildiradi (success), yo'lak — O'SHA rangning och
                qadami. Rang yolg'iz emas: ikonка + yozuv + foiz bor. */}
            {rate !== null && (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">
                    {tr('Yakunlash ulushi', 'Доля завершённых', 'Completion rate')}
                  </p>
                  <p className="text-2xl font-extrabold text-foreground">{rate}%</p>
                </div>

                <div
                  className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-accent/15"
                  role="img"
                  aria-label={tr(
                    `Yakunlash ulushi ${rate} foiz`,
                    `Доля завершённых ${rate} процентов`,
                    `Completion rate ${rate} percent`
                  )}
                >
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-text-muted">
                    <CheckCircle className="h-3.5 w-3.5 text-wine-ash dark:text-turquoise" />
                    {tr('Yakunlangan', 'Завершено', 'Completed')}: {count(completed)}
                  </span>
                  <span className="flex items-center gap-1.5 text-text-muted">
                    <XCircle className="h-3.5 w-3.5 text-error" />
                    {tr('Bekor qilingan', 'Отменено', 'Cancelled')}: {count(cancelled)}
                  </span>
                </div>
              </div>
            )}

            {/* Ma'lumot umuman yo'q — bo'sh holat (0 daromad ham shu yerga tushmaydi:
                0 son bo'lsa yuqoridagi bloklar chiziladi). */}
            {earnings === null && total === null && completed === null && (
              <EmptyState
                className="rounded-2xl border border-border bg-surface"
                icon={<Wallet />}
                title={tr("Hozircha hisob yo'q", 'Пока нет данных', 'No data yet')}
                description={tr(
                  "Birinchi safaringizni yakunlaganingizdan so'ng daromadingiz shu yerda ko'rinadi.",
                  'Заработок появится здесь после первой завершённой поездки.',
                  'Your earnings will appear here after your first completed trip.'
                )}
                action={
                  <Link href={`/${locale}/driver/create-trip`}>
                    <Button>{tr('Safar yaratish', 'Создать поездку', 'Create a trip')}</Button>
                  </Link>
                }
              />
            )}

            <p className="text-[11px] leading-snug text-text-muted">
              {tr(
                "Raqamlar butun ishlash davri uchun — backend hozircha oy/hafta bo'yicha bo'linish bermaydi. Naqd pul yo'lovchi bilan to'g'ridan-to'g'ri hisob-kitob qilinadi.",
                'Цифры за весь период — бэкенд пока не отдаёт разбивку по месяцам. Наличные вы получаете напрямую от пассажира.',
                'Figures cover your whole history — the backend does not provide a monthly breakdown yet. Cash is settled directly with the passenger.'
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
