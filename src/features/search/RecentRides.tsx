'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowRight, History } from 'lucide-react';
import { readRecentRides, type RecentRide } from '@/shared/lib/recentRides';
import { useTr } from '@/shared/lib/useTr';

/**
 * SO'NGGI KO'RILGANLAR — qidiruv bosh sahifasida.
 *
 * 🔴 NEGA KERAK: bosh sahifa har safar NOLDAN boshlanadi. Odam kecha
 * safarni ochib ko'rgan, o'ylab qolgan, bugun qaytdi — va hech qanday iz
 * yo'q, yo'nalishni qaytadan yozishi kerak. Ilovada bor edi, saytda yo'q.
 *
 * ⚠️ `localStorage` DA — server bilmaydi. Shuning uchun ro'yxat FAQAT
 * brauzerda o'qiladi (`useEffect`), aks holda SSR va mijoz turlicha
 * chizib, gidratatsiya xatosi berardi.
 *
 * ⚠️ Narx va joy soni ATAYIN saqlanmaydi (izohi `recentRides.ts` da) —
 * eski raqam yolg'on bo'lardi.
 */
export function RecentRides() {
  const tr = useTr();
  const locale = useLocale();
  const [items, setItems] = React.useState<RecentRide[]>([]);

  React.useEffect(() => {
    setItems(readRecentRides());
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-text-muted">
        <History className="h-3.5 w-3.5" aria-hidden />
        {tr("So'nggi ko'rilganlar", 'Вы недавно смотрели', 'Recently viewed')}
      </h3>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id}>
            <Link
              href={`/${locale}/trip/${r.id}`}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-text shadow-sm transition-colors hover:border-accent"
            >
              <span className="truncate">{r.from}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              <span className="truncate">{r.to}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
