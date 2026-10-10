'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getAccessToken } from '@/shared/lib/token';
import { buildWsUrl } from '@/shared/api/ws';
import { localizeNotification, localizeNotificationDetail } from '@/shared/lib/notifications';
import { deepUnescape } from '@/shared/lib/format';

/**
 * Butun ilova bo'ylab ishlaydigan real-time bildirishnoma tinglovchisi.
 *
 * Backend WS `{ type, payload }` hodisalarini yuboradi (chat NEW_MESSAGE ma'lum).
 * Bu komponent foydalanuvchi qaysi sahifada bo'lishidan qat'i nazar WS'ga ulanadi,
 * hodisalarni toast sifatida ko'rsatadi va tegishli react-query ro'yxatlarini
 * yangilaydi. Noma'lum hodisa turlari ham umumiy tarzda ko'rsatiladi (xavfsiz).
 *
 * Hech narsa render qilmaydi.
 */
export function NotificationsListener() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  // Joriy path'ni ref orqali ushlaymiz — effektni qayta ishga tushirmaymiz (WS uzilmaydi).
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!getAccessToken() || typeof window === 'undefined') return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    // Ketma-ket muvaffaqiyatsiz urinishlar — orqaga chekinish uchun.
    //
    // 🔴 NEGA (2026-08-28): backend `/ws` da `Origin` ni ruxsat ro'yxati
    // bilan tekshiradi va bizning domenimiz ro'yxatda yo'q (403 — jonli
    // o'lchandi). Ya'ni ulanish HECH QACHON ochilmaydi, oldingi qat'iy
    // 5 soniya esa har ochiq sahifadan serverga tinimsiz urish degani
    // edi. Bu yerda foydalanuvchiga xabar ko'rsatilmaydi — bu fon
    // tinglovchisi, xabarni chat ekrani beradi.
    let failures = 0;

    const retry = () => {
      failures += 1;
      reconnectTimer = setTimeout(connect, Math.min(5000 * failures, 60000));
    };
    let closedByUs = false;

    // URL prefiksidan til: '/en/...' -> 'en' (provider ichida emasmiz, useLocale yo'q).
    const lang = () => pathRef.current.split('/')[1] || 'uz';

    // Hodisa turiga qarab tegishli ro'yxatlarni yangilaymiz (UI darhol yangilansin).
    // DIQQAT: kalitlar joriy useQuery kalitlari bilan sinxron bo'lishi SHART —
    // 'trips' (dashboard/create-trip), 'trip-bidding' (bidding), 'trip' (trip detal),
    // 'history', 'conversations', 'chat-messages', 'notifications'.
    const invalidateFor = (type: string) => {
      if (type === 'NEW_MESSAGE') {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
        return;
      }
      // Booking/trip hodisalari -> arizalar, safarlar, tarix va bildirishnomalar ro'yxatlari.
      ['trips', 'trip-bidding', 'trip', 'history', 'conversations', 'notifications'].forEach(
        (key) => queryClient.invalidateQueries({ queryKey: [key] })
      );
    };

    const connect = () => {
      // Token'ni HAR ulanishda yangi o'qiymiz — refresh'dan keyin reconnect eski token bilan
      // aylanmasin. buildWsUrl same-origin fallback ham beradi (env qo'yilmagan dev'da ham ulanadi).
      const token = getAccessToken();
      if (!token) {
        reconnectTimer = setTimeout(connect, 5000);
        return;
      }
      try {
        socket = new WebSocket(buildWsUrl(token));
      } catch {
        retry();
        return;
      }

      // Ulanish ochilgach hisob nolga tushadi — aks holda bir marta
      // uzilgandan keyin kutish vaqti abadiy o'sib boraverardi.
      socket.onopen = () => {
        failures = 0;
      };

      socket.onmessage = (event) => {
        try {
          // WS kadri ham HTML kodlangan keladi (`so&#39;m`) — bannerda buzuq
          // matn ko'rinmasin. HTTP tomonida buni `client.ts` interceptor'i
          // qiladi, bu yerda esa qo'lda.
          const data = deepUnescape(JSON.parse(event.data)) as Record<string, unknown>;
          const type: string | undefined = data?.type as string | undefined;
          if (!type) return;

          // 2026-07-13 xat (7.2): monolitda BARCHA real-time xabarlar bitta formatda keladi:
          // { type: "notification", title, body }. Boy strukturali eventlar (NEW_BOOKING,
          // COUNTER_OFFER...) Centrifugo orqali ketadi va u deploy qilinmagan — YETIB KELMAYDI.
          // Shu sabab: title/body'ni ko'rsatamiz va tegishli ro'yxatlarni REST orqali yangilaymiz.
          if (type === 'notification') {
            const title = typeof data?.title === 'string' ? data.title : '';
            const body = typeof data?.body === 'string' ? data.body : '';
            // Semantik type kelmaydi — ruscha matndan aniqlab tilga o'giramiz (yagona lug'at);
            // tavsif uz interfeysida hali kirill bo'lsa ko'rsatilmaydi (til aralashmasin).
            toast(localizeNotification(undefined, title || body, lang()), {
              description: localizeNotificationDetail(body, lang()),
            });
            invalidateFor(type);
            return;
          }

          // Chat sahifasida ochiq turgan suhbat xabarini chat o'zi ko'rsatadi -> toast bermaymiz.
          if (type === 'NEW_MESSAGE' && pathRef.current.includes('/chat/')) {
            invalidateFor(type);
            return;
          }

          const payloadMsg = (data?.payload as { message?: unknown } | undefined)?.message;
          toast(
            localizeNotification(type, typeof payloadMsg === 'string' ? payloadMsg : '', lang())
          );
          invalidateFor(type);
        } catch {
          // yaroqsiz xabar — e'tiborsiz qoldiramiz
        }
      };

      socket.onclose = () => {
        if (closedByUs) return;
        // Uzilsa, 5 soniyadan keyin qayta ulanamiz.
        retry();
      };

      socket.onerror = () => {
        try {
          socket?.close();
        } catch {
          // ignore
        }
      };
    };

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        socket?.close();
      } catch {
        // ignore
      }
    };
  }, [queryClient]);

  return null;
}
