'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getAccessToken } from '@/shared/lib/token';
import { initPushIfGranted, setPushLocale, registerServiceWorker } from '@/shared/lib/fcm';

/**
 * FCM push'ni ilova bo'ylab boshqaradi: kirgan foydalanuvchida ruxsat ALLAQACHON berilgan
 * bo'lsa, jimgina token'ni yangilaydi va foreground tinglovchini bog'laydi. Ruxsat so'rash
 * (birinchi opt-in) esa bildirishnomalar sahifasidagi tugmadan — auto-prompt qilmaymiz (UX).
 *
 * MUHIM: bu komponent <Providers> ichida, ya'ni NextIntlClientProvider'dan TASHQARIDA render
 * bo'ladi — shuning uchun useLocale() ISHLAMAYDI (intl context yo'q). Tilni yo'l (pathname)
 * dan olamiz, xuddi NotificationsListener kabi. Push sozlanmagan/qo'llanmasa — no-op.
 */
export function PushManager() {
  const pathname = usePathname();

  // Tilni har yo'l o'zgarishida yangilaymiz (arzon) — push tili to'g'ri bo'lsin.
  //
  // 🔴 2026-08-16: ilgari `startsWith('/uz') ? 'uz' : 'ru'` edi, ya'ni
  // INGLIZCHA sahifada ham "ru" yuborilardi. Bu qiymat backendga
  // `POST /notifications/tokens` ning `language` maydonida ketadi —
  // natijada ingliz tilidagi foydalanuvchi bazada ruscha deb yozilib,
  // hamma push'ni ruscha olardi. Endi prefiks to'liq o'qiladi.
  useEffect(() => {
    setPushLocale(pathname.split('/')[1] ?? '');
  }, [pathname]);

  // SW'ni SHARTSIZ ro'yxatga olamiz (login/push ruxsatidan qat'i nazar) — keshlash va
  // oflayn rejim shu SW'da; usiz ikkinchi ochilish sekin, internetsiz esa umuman ochilmaydi.
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  // Token ro'yxati va foreground'ni FAQAT bir marta (mount) — aks holda har navigatsiyada
  // SW qayta ro'yxat + POST /notifications/tokens ketardi (ortiqcha tarmoq/batareya).
  useEffect(() => {
    if (!getAccessToken()) return;
    void initPushIfGranted();
  }, []);

  return null;
}
