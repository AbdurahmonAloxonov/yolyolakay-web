'use client';

import React from 'react';
import { toast } from 'sonner';
import { BellRing, BellOff } from 'lucide-react';
import { createRouteSubscription, deleteRouteSubscription } from '@/shared/api/rides';
import { getAccessToken } from '@/shared/lib/token';
import { useTr } from '@/shared/lib/useTr';

/**
 * YO'NALISHNI KUZATISH — «shu yo'nalishda safar chiqsa xabar bering».
 *
 * 🔴 NEGA KERAK: qidiruv bo'sh chiqsa odam ketadi va uni QAYTARIB
 * chaqirishning yo'li yo'q edi. Ilovada bu 2026-08-25 dan beri bor,
 * saytda YO'Q edi — holbuki sayt mehmon rejimida ochiq va odam bizni
 * ko'pincha birinchi o'sha yerdan ko'radi.
 *
 * ⚠️ OBUNA SERVERDA — mahalliy kuzatuv EMAS: brauzer yopiq tabda hech
 * nima tekshira olmaydi (ilovada mahalliy kuzatuvchi bor, chunki u fonda
 * uyg'ona oladi). Backend `/rides/route-subscriptions` ni 2026-08-27 da
 * ochdi.
 *
 * 🔑 Obuna ID'si `localStorage` da saqlanadi — busiz odam tugmani qayta
 * bosganda obunani O'CHIRA olmasdik va u serverda yetim qolib, keraksiz
 * xabar kelaverardi. Aynan shu bezovtalik odamlarni bildirishnomalarni
 * butunlay o'chirishga majburlaydi.
 *
 * Kirmagan odamga tugma KO'RSATILMAYDI: obuna tokenga bog'langan va
 * mehmonga «xabar beramiz» deb va'da qilish yolg'on bo'lardi.
 */
const KEY = 'route_subscriptions';

/** "lat,lon>lat,lon" -> obuna ID'si */
type Saved = Record<string, string>;

function read(): Saved {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Saved;
  } catch {
    return {};
  }
}

function write(next: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* xotira to'la yoki bloklangan — obuna baribir serverda qoladi */
  }
}

const keyOf = (o: [number, number], d: [number, number]) =>
  `${o[0].toFixed(3)},${o[1].toFixed(3)}>${d[0].toFixed(3)},${d[1].toFixed(3)}`;

export function WatchRouteButton({
  origin,
  dest,
  fromName,
  toName,
}: {
  origin?: [number, number];
  dest?: [number, number];
  fromName?: string;
  toName?: string;
}) {
  const tr = useTr();
  const [on, setOn] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [signedIn, setSignedIn] = React.useState(false);

  const key = origin && dest ? keyOf(origin, dest) : null;

  React.useEffect(() => {
    setSignedIn(!!getAccessToken());
    if (key) setOn(!!read()[key]);
  }, [key]);

  if (!origin || !dest || !key || !signedIn) return null;

  const toggle = async () => {
    setBusy(true);
    const saved = read();
    try {
      if (saved[key]) {
        await deleteRouteSubscription(saved[key]);
        delete saved[key];
        write(saved);
        setOn(false);
        toast(tr("Kuzatuv o'chirildi", 'Отслеживание выключено', 'Route unfollowed'));
        return;
      }
      const id = await createRouteSubscription({
        origin_lat: origin[0],
        origin_lon: origin[1],
        dest_lat: dest[0],
        dest_lon: dest[1],
      });
      if (!id) {
        toast.error(
          tr(
            "Kuzatuvni yoqib bo'lmadi. Biroz keyin urinib ko'ring",
            'Не удалось включить отслеживание. Попробуйте позже',
            'Could not follow the route. Please try again later'
          )
        );
        return;
      }
      saved[key] = id;
      write(saved);
      setOn(true);
      toast.success(
        fromName && toName
          ? tr(
              `${fromName} → ${toName}: safar chiqsa xabar beramiz`,
              `${fromName} → ${toName}: сообщим, когда появится поездка`,
              `${fromName} → ${toName}: we will tell you when a ride appears`
            )
          : tr(
              'Safar chiqsa xabar beramiz',
              'Сообщим, когда появится поездка',
              'We will tell you when a ride appears'
            )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={`mx-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60 ${
        on
          ? 'border-accent bg-brand-pink-light dark:bg-accent/10 text-accent'
          : 'border-border text-text hover:border-accent hover:text-accent'
      }`}
    >
      {on ? (
        <BellOff className="h-4 w-4" aria-hidden />
      ) : (
        <BellRing className="h-4 w-4" aria-hidden />
      )}
      {on
        ? tr('Kuzatilyapti', 'Отслеживается', 'Following')
        : tr(
            'Safar chiqsa xabar bering',
            'Сообщить, когда появится поездка',
            'Tell me when a ride appears'
          )}
    </button>
  );
}
