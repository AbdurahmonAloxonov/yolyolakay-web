'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { Bell, BellOff, BellRing, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  useNotifications,
  useMarkNotificationRead,
  isRead,
  localizeNotification,
  notificationDetail,
  type NotificationRow,
} from '@/entities/notification/api/useNotifications';
import { enablePush, pushPermission } from '@/shared/lib/fcm';
import { useTr } from '@/shared/lib/useTr';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { groupByDay, formatTripTime } from '@/shared/lib/format';

// Bildirishnomalar markazi: GET /notifications ro'yxati + har birini o'qilgan deb belgilash.
export default function NotificationsPage() {
  const locale = useLocale();
  const tr = useTr();
  const { data: items = [], isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();

  const unread = items.filter((n) => !isRead(n));

  // Push opt-in holati faqat mijozda ma'lum (Notification.permission) — hydration uchun effect'da.
  const [pushState, setPushState] = React.useState<
    'unsupported' | 'default' | 'granted' | 'denied'
  >('unsupported');
  const [enabling, setEnabling] = React.useState(false);
  React.useEffect(() => {
    setPushState(pushPermission());
  }, []);

  const onEnablePush = async () => {
    setEnabling(true);
    const res = await enablePush();
    setEnabling(false);
    setPushState(pushPermission());
    if (res === 'granted') {
      toast.success(
        tr(
          'Push bildirishnomalar yoqildi',
          'Push-уведомления включены',
          'Push notifications enabled'
        )
      );
    } else if (res === 'denied') {
      toast.error(
        tr(
          'Ruxsat berilmadi. Brauzer sozlamalaridan yoqishingiz mumkin.',
          'Разрешение не выдано. Включите его в настройках браузера.',
          'Permission denied. You can enable it in your browser settings.'
        )
      );
    } else if (res === 'error') {
      toast.error(tr('Xatolik yuz berdi', 'Произошла ошибка', 'Something went wrong'));
    }
  };

  // Ma'lum type'lar foydalanuvchi tilida (backend hozircha faqat ruscha yozadi).
  const text = (n: NotificationRow) => localizeNotification(n, locale);
  const detail = (n: NotificationRow) => notificationDetail(n, locale);
  /*
   * Endi faqat VAQT: sana guruh sarlavhasiga chiqdi ("Bugun" / "Kecha" /
   * "18.08.2026"). Ikkalasini takrorlash qatorni uzaytirar va sarlavhani
   * ma'nosiz qilardi.
   */
  const when = (n: NotificationRow) => formatTripTime(n.created_at);

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* ⚠️ `flex-wrap` + `gap`: 390 px ekranda «Hammasini o'qilgan
            qilish» sarlavha yonida sig'may, ekrandan chiqib ketardi
            (o'lchandi 2026-09-03). Endi joy qolmasa havola pastki
            qatorga tushadi. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="min-w-0 text-3xl font-display font-black text-foreground tracking-tight flex items-center gap-3">
            <Bell className="h-7 w-7 text-accent" />
            {tr('Bildirishnomalar', 'Уведомления', 'Notifications')}
          </h1>
          {unread.length > 0 && (
            <button
              type="button"
              onClick={() => unread.forEach((n) => markRead.mutate(n.id))}
              disabled={markRead.isPending}
              /* ⚠️ Balandligi 16 px edi — sahifadagi eng past nishon
                 (o'lchandi 2026-09-04). */
              className="inline-flex min-h-11 items-center text-xs font-bold text-accent hover:underline disabled:opacity-50"
            >
              {tr("Hammasini o'qilgan qilish", 'Прочитать все', 'Mark all as read')}
            </button>
          )}
        </div>

        {/* Push opt-in — faqat sozlangan (env) VA hali ruxsat so'ralmagan holatda ko'rsatamiz.
            Auto-prompt qilmaymiz: foydalanuvchi o'zi bosadi (brauzer talabi + yaxshi UX). */}
        {pushState === 'default' && (
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <BellRing className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-text">
                  {tr(
                    'Push bildirishnomalarni yoqing',
                    'Включите push-уведомления',
                    'Turn on push notifications'
                  )}
                </p>
                <p className="text-xs text-text-muted leading-relaxed">
                  {tr(
                    "Ilova yopiq bo'lsa ham yangi arizalar va xabarlardan xabardor bo'ling.",
                    'Получайте новые заявки и сообщения, даже когда приложение закрыто.',
                    'Get new requests and messages even when the app is closed.'
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onEnablePush}
              disabled={enabling}
              className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {enabling ? tr('...', '...', '...') : tr('Yoqish', 'Включить', 'Enable')}
            </button>
          </div>
        )}

        {isLoading ? (
          /* Ro'yxat SHAKLIDAGI skelet — matnli "Yuklanmoqda..." o'rniga:
             kutish qisqaroq tuyuladi va ma'lumot kelganda sahifa sakramaydi. */
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          /*
            🔴 UZILISH "BILDIRISHNOMA YO'Q" DEGANI EMAS (2026-08-16).
            Ilgari so'rov yiqilsa ham "Hozircha bildirishnoma yo'q" chiqardi.
            Aynan shu ekranda bu xavfli: odam safariga ariza kelgan-kelmaganini
            bilish uchun kiradi va "hech nima yo'q" degan XATO xulosaga
            keladi. Xuddi shu naqsh safarlar ro'yxatida ham topilgan edi.
          */
          <div className="mo-in rounded-2xl border border-error/30 bg-error/5 p-8 text-center space-y-3">
            <p className="text-sm font-bold text-error">
              {tr(
                'Bildirishnomalar yuklanmadi',
                'Не удалось загрузить уведомления',
                'Could not load notifications'
              )}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              /* ⚠️ Balandligi 16 px edi (o'lchandi 2026-09-04). Bu XATO
                 holatidagi yagona amal — odam allaqachon asabiy, tugmani
                 topolmaslik eng yomon lahza. */
              className="inline-flex min-h-11 items-center text-xs font-bold text-accent hover:underline"
            >
              {tr('Qayta urinish', 'Повторить', 'Try again')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            /* qulaylik: chiqish yo'li SHART EMAS — bildirishnoma odamning
               ishi emas, u KELADI. Sun'iy tugma yolg'on va'da bo'lardi. */
            className="mo-in rounded-2xl border border-border bg-surface/50"
            icon={<BellOff />}
            title={tr("Bildirishnoma yo'q", 'Уведомлений нет', 'No notifications')}
            description={tr(
              'Bron, safar va xabarlar haqidagi xabarnomalar shu yerda chiqadi.',
              'Уведомления о бронях, поездках и сообщениях появятся здесь.',
              'Alerts about bookings, rides and messages will appear here.'
            )}
          />
        ) : (
          /* KUNLAR bo'yicha guruhlangan — chatdagi ajratgichlar bilan bir xil
             qoida. Ilgari o'nta bildirishnoma ketma-ket turardi va qaysi biri
             bugungi ekani faqat kichkina sanadan bilinardi. */
          <div className="mo-in space-y-5">
            {groupByDay(items, (n) => n.created_at, locale).map((group) => (
              <div key={group.label || 'nodate'} className="space-y-2">
                {group.label && (
                  <div className="sticky top-16 z-10 flex justify-center">
                    <span className="rounded-full bg-surface/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted shadow-sm backdrop-blur">
                      {group.label}
                    </span>
                  </div>
                )}
                <ul className="space-y-2">
                  {group.items.map((n) => {
                    const read = isRead(n);
                    return (
                      <li
                        key={n.id}
                        className={`rounded-2xl border p-4 flex items-start justify-between gap-3 transition-colors ${
                          read
                            ? 'border-border bg-surface/60 text-text-muted'
                            : 'border-accent/30 bg-surface shadow-sm'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <p
                            className={`text-sm leading-relaxed ${read ? 'font-medium' : 'font-bold text-text'}`}
                          >
                            {text(n)}
                          </p>
                          {detail(n) && (
                            <p className="text-xs leading-relaxed text-text-muted break-words">
                              {detail(n)}
                            </p>
                          )}
                          <p className="text-[11px] font-bold text-text-muted">{when(n)}</p>
                        </div>
                        {!read && (
                          <button
                            type="button"
                            onClick={() => markRead.mutate(n.id)}
                            disabled={markRead.isPending}
                            /* ⚠️ Nishon 27 px edi va u HAR bildirishnoma
                               qatorida takrorlanadi — ro'yxatdagi eng ko'p
                               bosiladigan tugma. */
                            className="shrink-0 flex min-h-11 items-center gap-1 rounded-full bg-brand-pink-light dark:bg-accent/10 border border-accent/20 px-2.5 py-1 text-[11px] font-bold text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                            title={tr(
                              "O'qilgan deb belgilash",
                              'Отметить прочитанным',
                              'Mark as read'
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {tr("O'qildi", 'Прочитано', 'Read')}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
