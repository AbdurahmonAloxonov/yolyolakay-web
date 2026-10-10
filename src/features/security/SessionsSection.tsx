'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MonitorSmartphone, LogOut } from 'lucide-react';
import { getSessions, deleteSession } from '@/shared/api/auth';
import type { Session } from '@/shared/api/types/auth';
import { getDeviceId } from '@/shared/api/device';
import { formatDateOnly } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { useTr } from '@/shared/lib/useTr';

/**
 * Kirilgan qurilmalar — `GET /auth/sessions` + `DELETE /auth/sessions/{device_id}`.
 *
 * Bu ikki ruchka `shared/api/auth.ts` da ANCHADAN BERI yozilgan, lekin ularni
 * hech qayerdan chaqirilmagan edi — ya'ni backend ma'lumot berardi, foydalanuvchi
 * esa qayerdan kirilganini ko'ra olmasdi (CEO 2026-08-04: "hammasini to'liq
 * tortib ol"). Xavfsizlik uchun ham kerak: telefon yo'qolsa, o'sha sessiyani
 * shu yerdan yopish mumkin.
 *
 * Ro'yxat BO'SH bo'lsa bo'lim chizilmaydi (profilda ortiqcha bo'sh blok turmasin).
 *
 * 🔴 Lekin XATO bo'lsa — chiziladi. Ilgari ikkalasi bir xil ishlanardi va so'rov
 * yiqilganda bo'lim butunlay yo'q bo'lardi: odam "sessiyalarni boshqarish qayerda
 * edi?" deb qolardi, telefoni yo'qolgan bo'lsa esa uni yopa olmasdi. Bo'sh
 * ro'yxat va uzilish — BOSHQA-BOSHQA holat, React Query'da ikkalasi ham
 * `data === undefined` beradi.
 */
export function SessionsSection() {
  const tr = useTr();
  const queryClient = useQueryClient();
  const currentDeviceId = getDeviceId();

  const {
    data: sessions = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<Session[]>({
    queryKey: ['auth-sessions'],
    queryFn: getSessions,
    staleTime: 60 * 1000,
  });

  const closeMutation = useMutation({
    mutationFn: (deviceId: string) => deleteSession(deviceId),
    onSuccess: () => {
      toast.success(tr('Qurilma chiqarildi', 'Устройство отключено', 'Device signed out'));
      queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    },
    onError: () =>
      toast.error(
        tr(
          "Chiqarib bo'lmadi. Qayta urinib ko'ring",
          'Не удалось отключить. Попробуйте ещё раз',
          'Could not sign the device out. Please try again'
        )
      ),
  });

  if (isLoading) return null;

  if (isError) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {tr('Kirilgan qurilmalar', 'Активные устройства', 'Signed-in devices')}
          </h3>
          <MonitorSmartphone className="h-4.5 w-4.5 text-accent" />
        </div>
        <p className="text-sm text-text-muted">
          {tr(
            "Qurilmalar ro'yxati yuklanmadi. Qayta urinib ko'ring.",
            'Не удалось загрузить список устройств. Попробуйте ещё раз.',
            "Couldn't load your devices. Please try again."
          )}
        </p>
        <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching
            ? tr('Yuklanmoqda…', 'Загрузка…', 'Loading…')
            : tr('Qayta urinish', 'Повторить', 'Try again')}
        </Button>
      </div>
    );
  }

  if (sessions.length === 0) return null;

  /** Qurilma nomi — backend `os_type`/`user_agent` beradi, ikkalasi ham bo'lmasa umumiy. */
  const deviceLabel = (s: Session) => {
    const os = (s.os_type || '').trim();
    if (os) return os;
    const ua = (s.user_agent || '').trim();
    if (!ua) return tr("Noma'lum qurilma", 'Неизвестное устройство', 'Unknown device');
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad|ios/i.test(ua)) return 'iOS';
    if (/windows/i.test(ua)) return 'Windows';
    if (/mac os|macintosh/i.test(ua)) return 'macOS';
    return ua.slice(0, 28);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
          {tr('Kirilgan qurilmalar', 'Активные устройства', 'Signed-in devices')}
        </h3>
        <MonitorSmartphone className="h-4.5 w-4.5 text-accent" />
      </div>

      <ul className="space-y-2">
        {sessions.map((s) => {
          const isCurrent = !!currentDeviceId && s.device_id === currentDeviceId;
          return (
            <li
              key={s.session_id || s.device_id}
              className="flex items-center justify-between gap-3 rounded-xl bg-bg/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p data-user-text className="truncate text-sm font-bold text-text">
                  {deviceLabel(s)}
                  {isCurrent && (
                    <span className="ml-2 rounded-full bg-turquoise-light/70 px-2 py-0.5 text-[10px] font-black uppercase text-wine-ash">
                      {tr('Shu qurilma', 'Это устройство', 'This device')}
                    </span>
                  )}
                </p>
                <p className="text-[11px] font-bold text-text-muted">
                  {[s.device_ip, formatDateOnly(s.created_at)].filter(Boolean).join(' · ')}
                </p>
              </div>

              {/* Joriy qurilmani bu yerdan yopmaymiz — buning uchun "Chiqish" tugmasi bor,
                  u tokenlarni ham tozalaydi. Aks holda ilova tokensiz qolib "osilardi". */}
              {!isCurrent && (
                <Button
                  variant="secondary"
                  onClick={() => closeMutation.mutate(s.device_id)}
                  isLoading={closeMutation.isPending && closeMutation.variables === s.device_id}
                  className="shrink-0 !py-1.5 !px-3 text-xs"
                >
                  <LogOut className="mr-1 h-3.5 w-3.5" />
                  {tr('Chiqarish', 'Отключить', 'Sign out')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
