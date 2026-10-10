'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { trFor } from '@/shared/lib/i18n';

/**
 * Internet uzilganda foydalanuvchiga tushunarli xabar ko'rsatadi.
 *
 * MUHIM: TanStack Query default `networkMode: 'online'` — navigator.onLine=false
 * bo'lsa query/mutation'lar PAUZA bo'ladi (so'rov ketmaydi, xato ham bo'lmaydi),
 * shuning uchun axios interceptor'dagi tarmoq-xato toasti bu holatda ishlamaydi.
 * Bu listener aynan shu bo'shliqni yopadi: offline -> doimiy toast, online -> yo'qoladi.
 * Toast `id`si interceptor'dagi bilan bir xil ('network-error') — dublikat chiqmaydi.
 */
export function OfflineListener() {
  useEffect(() => {
    // shared/api/client.ts bilan BIR XIL qoida (default 'ru') — aks holda prefikssiz yo'lda
    // ikki toast (interceptor + shu listener) har xil tilda chiqardi.
    const tr = () => trFor(window.location.pathname.split('/')[1]);

    const onOffline = () => {
      toast.error(
        tr()(
          'Internet aloqasi uzildi. Ulanish tiklangach davom etasiz',
          'Нет соединения с интернетом. Продолжите после восстановления связи',
          'You are offline. You can continue once the connection is back'
        ),
        { id: 'network-error', duration: Infinity }
      );
    };
    const onOnline = () => {
      toast.dismiss('network-error');
      toast.success(
        tr()('Internet aloqasi tiklandi', 'Соединение восстановлено', 'You are back online'),
        {
          id: 'network-restored',
        }
      );
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    // Sahifa offline holatda ochilgan bo'lsa ham darhol ko'rsatamiz.
    if (!navigator.onLine) onOffline();
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return null;
}
