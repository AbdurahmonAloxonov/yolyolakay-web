'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CheckCircle2, XCircle, HelpCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useTr } from '@/shared/lib/useTr';

/**
 * XIZMAT HOLATI — «nima ishlayapti, nima yo'q» degan savolga bitta javob.
 *
 * 🔴 NEGA KERAK: uzilish bu loyihada ODATIY hol (backend Cloudflare
 * tuneli orqasida turadi, 502 ham bo'lib turadi; 27.08.2026 da esa
 * migratsiya bajarilmagani uchun haydovchi umuman safar e'lon qila
 * olmadi va QIDIRUV BO'SH bo'lib qoldi). Bunday paytda odam saytda
 * FAQAT bo'sh ro'yxatni ko'radi va keyingi savol doim bir xil bo'ladi:
 * «sayt buzuqmi, internetimmi, yoki shunchaki safar yo'qmi?» — javob
 * esa hech qayerda yo'q edi. Javobsiz uzilish ishonchni yo'qotadi.
 *
 * Ilovada bu ekran 2026-08-25 dan beri bor, saytda esa UMUMAN yo'q edi.
 * Mobil ekvivalenti: `lib/features/support/service_status_screen.dart`.
 *
 * ⚠️ BU YERDA HECH QANDAY TAXMIN YO'Q. Har qator — o'lchangan haqiqat:
 *   • internet — brauzerning `navigator.onLine` bayrog'i;
 *   • server — HAQIQIY so'rov javob berdimi (`navigator.onLine` server
 *     ishlayotganini BILMAYDI — Wi-Fi ulangani yetarli emas);
 *   • bildirishnoma — brauzer ruxsati.
 *
 * 🔑 Server tekshiruvi ATAYIN mehmonlarga ochiq endpointga boradi
 * (`/rides/search`) — token talab qiladiganini so'rasak, kirmagan odam
 * har doim «ishlamayapti» degan javob olardi.
 */

type State = 'ok' | 'fail' | 'unknown' | 'checking';

export default function StatusClient() {
  const tr = useTr();
  const locale = useLocale();

  const [online, setOnline] = React.useState<State>('checking');
  const [server, setServer] = React.useState<State>('checking');
  const [push, setPush] = React.useState<State>('checking');
  const [checkedAt, setCheckedAt] = React.useState<Date | null>(null);
  const [busy, setBusy] = React.useState(false);

  const check = React.useCallback(async () => {
    setBusy(true);
    setOnline(navigator.onLine ? 'ok' : 'fail');

    // Bildirishnoma ruxsati — brauzer qo'llab-quvvatlamasa «noma'lum».
    if (typeof Notification === 'undefined') {
      setPush('unknown');
    } else {
      setPush(Notification.permission === 'granted' ? 'ok' : 'fail');
    }

    setServer('checking');
    try {
      // Mehmonlarga ochiq va yengil so'rov. `cache: no-store` SHART:
      // keshdan kelgan javob serverni tirik deb ko'rsatib qo'yardi.
      const res = await fetch(
        '/api-proxy/api/v1/rides/search?origin_lat=41.3&origin_lon=69.24&dest_lat=39.65&dest_lon=66.96&radius_km=50',
        { cache: 'no-store', signal: AbortSignal.timeout(12_000) }
      );
      setServer(res.ok ? 'ok' : 'fail');
    } catch {
      setServer('fail');
    }
    setCheckedAt(new Date());
    setBusy(false);
  }, []);

  React.useEffect(() => {
    void check();
  }, [check]);

  const rows: { label: string; state: State; hint?: string }[] = [
    {
      label: tr('Internet aloqasi', 'Интернет-соединение', 'Internet connection'),
      state: online,
      hint:
        online === 'fail'
          ? tr(
              'Qurilmangiz tarmoqqa ulanmagan',
              'Ваше устройство не подключено к сети',
              'Your device is offline'
            )
          : undefined,
    },
    {
      label: tr('Server javob beryapti', 'Сервер отвечает', 'Server responding'),
      state: server,
      hint:
        server === 'fail'
          ? tr(
              'Server javob bermayapti. Bu bizning tomonimizdagi nosozlik — sizning qurilmangizda emas',
              'Сервер не отвечает. Это сбой на нашей стороне, а не на вашем устройстве',
              'The server is not responding. This is a problem on our side, not on your device'
            )
          : undefined,
    },
    {
      label: tr('Bildirishnomalar', 'Уведомления', 'Notifications'),
      state: push,
      hint:
        push === 'fail'
          ? tr(
              'Brauzer ruxsat bermagan — safar haqidagi xabarlar kelmaydi',
              'Браузер не дал разрешение — сообщения о поездке не придут',
              'The browser has not granted permission — you will not get trip alerts'
            )
          : undefined,
    },
  ];

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {tr('Xizmat holati', 'Состояние сервиса', 'Service status')}
          </h1>
          <p className="text-sm text-text-muted">
            {tr(
              "Nima ishlayapti, nima yo'q — hozir tekshirildi. Bu sahifa taxmin qilmaydi, o'lchaydi.",
              'Что работает, а что нет — проверено сейчас. Эта страница не гадает, а измеряет.',
              'What works and what does not — checked just now. This page measures, it does not guess.'
            )}
          </p>
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-start gap-3 p-4">
              <StateIcon state={r.state} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-text">{r.label}</p>
                {r.hint && <p className="mt-0.5 text-xs text-text-muted">{r.hint}</p>}
              </div>
              <span className="shrink-0 text-xs font-bold text-text-muted">
                {r.state === 'ok'
                  ? tr('Ishlayapti', 'Работает', 'Working')
                  : r.state === 'fail'
                    ? tr('Ishlamayapti', 'Не работает', 'Not working')
                    : r.state === 'checking'
                      ? tr('Tekshirilyapti…', 'Проверяем…', 'Checking…')
                      : tr("Noma'lum", 'Неизвестно', 'Unknown')}
              </span>
            </li>
          ))}
        </ul>

        {/* 🔴 SAFAR YO'QLIGI — NOSOZLIK EMAS. Aynan shu chalkashlik uchun
            sahifa yozildi: qidiruv bo'sh chiqsa odam saytni buzuq deb
            o'ylaydi. Server ishlayotgan bo'lsa buni OCHIQ aytamiz. */}
        {server === 'ok' && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted">
            {tr(
              "Server ishlayapti. Agar qidiruvda safar topilmasa — bu nosozlik emas: shu yo'nalishda hozircha e'lon yo'q. Yo'nalishni kuzatuvga qo'ysangiz, safar chiqqanda xabar beramiz.",
              'Сервер работает. Если поиск ничего не находит — это не сбой: по этому маршруту пока нет объявлений. Подпишитесь на маршрут, и мы сообщим о новой поездке.',
              'The server is up. If the search finds nothing, that is not a fault — there are simply no rides on that route yet. Follow the route and we will tell you when one appears.'
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void check()} disabled={busy}>
            <span className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
              {tr('Qayta tekshirish', 'Проверить снова', 'Check again')}
            </span>
          </Button>
          {/* ⚠️ `min-h-11` + `py`: havolaning bosiladigan maydoni 20 px edi
              (o'lchandi 2026-09-04). Yonidagi tugma 44 px — barmoq
              ikkalasini bir xil deb o'ylaydi va havolaga tegolmaydi. */}
          <Link
            href={`/${locale}/search`}
            className="inline-flex min-h-11 items-center px-1 text-sm font-bold text-accent hover:text-accent-hover"
          >
            {tr('Qidiruvga qaytish', 'Вернуться к поиску', 'Back to search')}
          </Link>
          {checkedAt && (
            <span className="ml-auto text-xs text-text-muted">
              {tr('Tekshirildi:', 'Проверено:', 'Checked:')} {checkedAt.toLocaleTimeString(locale)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: State }) {
  if (state === 'ok') {
    return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />;
  }
  if (state === 'fail') {
    return <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden />;
  }
  return <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" aria-hidden />;
}
