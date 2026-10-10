'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { getFeedback } from '@/shared/api/rating';
import { Avatar } from './Avatar';
import { useTr } from '@/shared/lib/useTr';
import { formatTripDateTime } from '@/shared/lib/format';

/**
 * SHARHLAR RO'YXATI — odam haqida boshqalar nima yozgani.
 *
 * 🔴 NEGA ENDI BOR: 27-avgustgacha kontraktda faqat `POST /rating` bor
 * edi. Ya'ni biz safardan keyin izoh SO'RAYDIK, odam yozadi — va u gap
 * hech qayerda ko'rinmasdi. Ikki tomonlama zarar: yozgan odam keyingi
 * safar yozmaydi, o'qiydigan odam esa «4.9» raqami ortida nima turganini
 * bilmaydi. Backend so'rovimizdan keyin `GET /rating` ni ochdi.
 *
 * 🔑 MEHMONLARGA OCHIQ — kirmagan odam ham ko'radi. Aynan shu sababdan
 * u safar sahifasida ham turadi: qaror o'sha yerda qabul qilinadi.
 *
 * ⚠️ Uzilishda HECH NIMA chizilmaydi. Sahifaning qolgani (ism, reyting,
 * mashina) ishlaydi — sharhlar uzilishi tufayli butun ekranni xato
 * holatiga o'tkazish nomutanosib bo'lardi.
 *
 * Mobil ekvivalenti: `lib/features/profile/reviews_section.dart`.
 */
export function ReviewsSection({
  userId,
  limit = 3,
}: {
  userId?: string;
  /** Sahifada ko'rsatiladigan soni — qolgani «Yana N ta» bilan ochiladi. */
  limit?: number;
}) {
  const tr = useTr();
  const [expanded, setExpanded] = React.useState(false);
  const id = (userId ?? '').trim();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => getFeedback(id),
    enabled: !!id,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!id || isError) return null;

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    );
  }

  // Matnsiz baholar ro'yxatni suyultiradi — odam GAPNI o'qigani keladi.
  const items = (data?.items ?? []).filter((r) => (r.comment ?? '').trim());
  const shown = expanded ? items : items.slice(0, limit);

  return (
    <section className="space-y-3">
      <h3 className="flex items-baseline gap-2 text-sm font-extrabold text-text">
        {tr('Sharhlar', 'Отзывы', 'Reviews')}
        {(data?.total ?? 0) > 0 && (
          <span className="text-xs font-bold text-text-muted">{data?.total}</span>
        )}
      </h3>

      {items.length === 0 ? (
        /* 🔴 Bo'sh holat AYBLOV emas: yangi odamda sharh bo'lmasligi
           tabiiy, shuning uchun sababi ham aytiladi. */
        <p className="text-sm text-text-muted">
          {tr(
            "Hali matnli sharh yo'q — bu odam yangi bo'lishi mumkin",
            'Пока нет отзывов с текстом — возможно, человек здесь недавно',
            'No written reviews yet — this person may be new here'
          )}
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {shown.map((r) => (
              <li key={r.id} className="flex gap-3">
                <Avatar src={r.reviewer?.avatar} name={r.reviewer?.name} size={32} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-text">
                      {(r.reviewer?.name ?? '').trim() ||
                        tr('Foydalanuvchi', 'Пользователь', 'A user')}
                    </span>
                    {/* Yulduzlar SON bilan emas, BELGI bilan: qatorda
                        "5/5" dan ko'ra tezroq o'qiladi. */}
                    <span className="ml-auto flex shrink-0 items-center gap-px">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i <= r.score ? 'text-warning' : 'text-border'}`}
                          fill={i <= r.score ? 'var(--warning)' : 'none'}
                          aria-hidden
                        />
                      ))}
                    </span>
                  </div>
                  <p className="text-sm text-text">{(r.comment ?? '').trim()}</p>
                  {r.created_at && (
                    <p className="text-[11px] font-semibold text-text-muted">
                      {formatTripDateTime(r.created_at)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {!expanded && items.length > limit && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-sm font-bold text-accent transition-colors hover:text-accent-hover"
            >
              {tr(
                `Yana ${items.length - limit} ta`,
                `Ещё ${items.length - limit}`,
                `${items.length - limit} more`
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
