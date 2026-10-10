'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldBan } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import {
  getBlockedUsers,
  isNotAvailable,
  unblockUser,
  type BlockedUser,
} from '@/shared/api/moderation';
import { useLocale } from 'next-intl';
import { useTr } from '@/shared/lib/useTr';

/**
 * Bloklangan foydalanuvchilar — profilda.
 *
 * Bloklash chatdan qilinadi (ReportBlockMenu), lekin BEKOR QILISH joyi bo'lmasa
 * amal bir tomonlama bo'lib qoladi: tasodifan bloklagan odam boshqa hech qachon
 * o'sha haydovchi bilan yura olmaydi. Play talabi ham "bloklashni boshqarish"ni
 * nazarda tutadi.
 *
 * Ro'yxat bo'sh bo'lsa yoki endpoint BACKENDDA YO'Q bo'lsa (404/405/501) — bo'lim
 * UMUMAN ko'rsatilmaydi: profilda doim bo'sh turadigan karta shovqindan boshqa
 * narsa emas.
 *
 * 🔴 LEKIN o'tkinchi nosozlik (tarmoq, 502, 401) BUNDAN AJRATILADI — 2026-08-08.
 * Ilgari ikkalasi bitta shart edi (`isLoading || !blocked?.length`), ya'ni backend
 * yiqilganda bo'lim JIMGINA yo'q bo'lardi. Odam bloklaganlari bor holda profilni
 * ochsa "bloklarim yo'qolibdi" yoki "blokni boshqarish joyi yo'q ekan" deb
 * tushunardi — bu yolg'on, va Play talabi (bloklashni BOSHQARISH) shu paytda
 * bajarilmay qolardi. Backend uy mashinasida va 502 bo'lib turadi (2026-08-02 da
 * bir soat, 2026-08-08 da yana) — ya'ni bu holat nazariy emas.
 * Posilkalardagi (b9c527c) uch holatli naqshning shu yerdagi ko'rinishi.
 */
export function BlockedUsersSection() {
  const locale = useLocale();
  const t = useTr();
  const queryClient = useQueryClient();

  const {
    data: blocked,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<BlockedUser[]>({
    queryKey: ['blocked-users'],
    queryFn: getBlockedUsers,
    // Endpoint yo'q bo'lsa qayta-qayta urinmaymiz — bo'lim jimgina yashiriladi.
    retry: (count, e) => !isNotAvailable(e) && count < 1,
  });

  // Endpoint YO'Q (404/405/501) — bo'lim jimgina yashiriladi, ko'rsatadigan narsa yo'q.
  // Boshqa har qanday xato — O'TKINCHI: aytamiz va qayta urinish tugmasini beramiz.
  const failed = isError && !isNotAvailable(error);

  const unblockMutation = useMutation({
    mutationFn: unblockUser,
    onSuccess: () => {
      toast.success(t('Blok olib tashlandi', 'Блокировка снята', 'User unblocked'));
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
    },
    onError: () =>
      toast.error(
        t(
          "Blokni olib tashlab bo'lmadi. Qayta urinib ko'ring.",
          'Не удалось снять блокировку. Попробуйте ещё раз.',
          'Could not unblock. Please try again.'
        )
      ),
  });

  if (isLoading) return null;

  // O'tkinchi nosozlik — bo'limni YASHIRMAYMIZ. Yashirsak odam bloklaganlari
  // yo'qolgan yoki boshqarish joyi yo'q deb o'ylaydi (posilkalardagi bilan bir xil xato).
  if (failed) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text">
            {t('Bloklangan foydalanuvchilar', 'Заблокированные пользователи', 'Blocked users')}
          </span>
          <ShieldBan className="h-5 w-5 text-text-muted" aria-hidden />
        </div>
        <p className="text-sm text-text-muted">
          {t(
            "Ro'yxatni yuklab bo'lmadi. Aloqa uzildi yoki server javob bermadi.",
            'Не удалось загрузить список. Связь прервалась или сервер не ответил.',
            'Could not load the list. The connection dropped or the server did not respond.'
          )}
        </p>
        <Button
          variant="secondary"
          onClick={() => refetch()}
          isLoading={isFetching}
          className="px-4 py-2 text-xs"
        >
          {t('Qayta urinish', 'Повторить', 'Try again')}
        </Button>
      </div>
    );
  }

  if (!blocked?.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">
          {t('Bloklangan foydalanuvchilar', 'Заблокированные пользователи', 'Blocked users')}
        </span>
        <ShieldBan className="h-5 w-5 text-text-muted" aria-hidden />
      </div>

      <ul className="space-y-2">
        {blocked.map((u) => (
          <li key={u.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
            <Avatar name={u.name} size={36} />
            {/* min-w-0 SHART: usiz flex elementi o'z matni kengligidan kichraymaydi va
                uzun ism tugmani ekrandan chiqarib yuboradi (truncate o'zi yetmaydi). */}
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-text">
              {u.name || t('Foydalanuvchi', 'Пользователь', 'User')}
            </span>
            <Button
              variant="secondary"
              onClick={() => unblockMutation.mutate(u.id)}
              isLoading={unblockMutation.isPending && unblockMutation.variables === u.id}
              className="shrink-0 px-3 py-1.5 text-xs"
            >
              {t('Blokdan chiqarish', 'Разблокировать', 'Unblock')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
