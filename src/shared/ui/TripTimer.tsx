'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useTr } from '@/shared/lib/useTr';

const format = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/**
 * Safar boshlangandan beri o'tgan vaqt — har soniya yangilanadi.
 * startMs=0 (noma'lum boshlanish) bo'lsa hech narsa ko'rsatmaydi.
 */
export function TripTimer({ startMs }: { startMs: number }) {
  const tr = useTr();
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!startMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);

  if (!startMs) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-turquoise/15 px-2.5 py-1 text-xs font-black text-wine-ash tabular-nums dark:text-turquoise">
      <Clock className="h-3.5 w-3.5 text-turquoise" />
      {tr("Yo'lda:", 'В пути:', 'En route: ')} {format(now - startMs)}
    </span>
  );
}
