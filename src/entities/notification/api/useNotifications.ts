'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markNotificationRead } from '@/shared/api/notifications';
import type { NotificationItem } from '@/shared/api/types/notification';
import { getAccessToken } from '@/shared/lib/token';
import {
  localizeNotification as localizeNotifText,
  localizeNotificationDetail,
} from '@/shared/lib/notifications';

// Jonli shakl (2026-07-18): GET /notifications YALANG'OCH massiv qaytaradi:
// [{id, user_id, title, body, type, is_read, created_at}]. Eski kod {data}/{notifications}
// qobig'ini kutib, yalang'och massivda BO'SH ro'yxat ko'rsatib yuborardi — tuzatildi
// (shared/api/notifications.getNotifications ikkala shaklni ham o'qiydi).
export type NotificationRow = NotificationItem & {
  message?: string;
  read_at?: string | null;
};

export const isRead = (n: NotificationRow) => Boolean(n.is_read || n.read_at);

// Tarjima YAGONA manbadan (shared/lib/notifications) — WS toast bilan bir xil lug'at.
export const localizeNotification = (n: NotificationRow, locale: string): string =>
  localizeNotifText(n.type, n.message || n.body || n.title, locale);

// Ro'yxatdagi ikkilamchi qator (tafsilot) — uz interfeysida ruscha xom matn yashiriladi.
export const notificationDetail = (n: NotificationRow, locale: string): string | undefined => {
  const detail = localizeNotificationDetail(n.body || n.message, locale);
  // Sarlavha bilan bir xil bo'lsa (type'siz xom matn) takrorlamaymiz.
  return detail && detail !== localizeNotification(n, locale) ? detail : undefined;
};

export function useNotifications() {
  return useQuery<NotificationRow[]>({
    queryKey: ['notifications'],
    enabled: !!getAccessToken(),
    refetchInterval: 60_000, // WS o'tkazib yuborilganda ham badge eskirib qolmasin
    queryFn: () => getNotifications() as Promise<NotificationRow[]>,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    // Yangi Gateway: o'qildi belgisi PUT /notifications/{id}/read (POST emas).
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
