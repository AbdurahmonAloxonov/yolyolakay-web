'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/shared/model/ThemeContext';
import { Toaster } from 'sonner';
import { AuthGuard } from '@/shared/ui/AuthGuard';
import { NotificationsListener } from '@/shared/ui/NotificationsListener';
import { PushManager } from '@/shared/ui/PushManager';
import { NoShowGuard } from '@/shared/ui/NoShowGuard';
import { OfflineListener } from '@/shared/ui/OfflineListener';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 10s -> 30s: bir xil ma'lumot 30s ichida qayta so'ralmaydi (backend ~0.5-1s,
            // ortiqcha so'rov = sekinlik hissi). Jonli ma'lumot (bidding/qidiruv) o'z
            // refetchInterval'ini alohida beradi — bu faqat default.
            staleTime: 30 * 1000,
            /*
             * Ilovaga QAYTGANDA ma'lumot yangilanadi.
             *
             * Ilgari `false` edi — "har fokusda hamma query qayta yuklanadi, bu
             * sekinlik beradi" degan sabab bilan. Lekin telefonda odam ilovadan
             * chiqib-kirib turadi, fon rejimida esa polling ham to'xtaydi
             * (`refetchIntervalInBackground: false`). Natijada qaytib kelganda
             * ekran ESKI ma'lumot bilan turardi va odam sahifani qo'lda
             * yangilashga majbur bo'lardi — "jonli ishlamayapti" hissi aynan
             * shundan edi (2026-08-10, egasi jonli uchratdi).
             *
             * Endi xavf yo'q, chunki `staleTime: 30s` qo'riqlaydi: 30 soniya
             * ichida qaytilsa hech narsa so'ralmaydi. Ya'ni "har fokusda bo'ron"
             * emas, faqat rostdan eskirgan ma'lumot yangilanadi.
             */
            refetchOnWindowFocus: true,
            // Sekin/yiqilgan backendda default 3 urinish = uzoq osilish; 1 urinish bilan
            // xato tezroq ko'rinadi (spinner cheksiz aylanmaydi).
            retry: 1,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        {/* Xarita OSM (Leaflet) — Yandex script YO'Q (egasi, 2026-08-20). */}
        <AuthGuard>{children}</AuthGuard>
        <NotificationsListener />
        <PushManager />
        <NoShowGuard />
        <OfflineListener />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--text-color)',
              borderColor: 'var(--border-color)',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
