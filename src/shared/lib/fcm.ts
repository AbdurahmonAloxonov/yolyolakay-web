'use client';

import { toast } from 'sonner';
import { registerFcmToken } from '@/shared/api/notifications';
import { localizeNotification, localizeNotificationDetail } from '@/shared/lib/notifications';
import { asLang, type Lang } from '@/shared/lib/i18n';

/**
 * Firebase Cloud Messaging (web push) — telefon/brauzer yopiq bo'lsa ham bildirishnoma.
 *
 * BUTUNLAY env orqali sozlanadi (NEXT_PUBLIC_FIREBASE_*). Konfiguratsiya bo'lmasa yoki
 * brauzer qo'llab-quvvatlamasa — hamma funksiya JIM no-op (build/oqim buzilmaydi).
 * Token backend'ga `POST /notifications/tokens {fcm_token, language, platform}` bilan yuboriladi.
 *
 * Foreground xabar toast bilan (yagona tarjima lug'ati — shared/lib/notifications),
 * background xabar service worker (public/firebase-messaging-sw.js) orqali ko'rsatiladi.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** Barcha zarur env qiymatlari bormi — bo'lmasa push butunlay o'chirilgan deb qaraladi. */
export const isPushConfigured = (): boolean =>
  Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    VAPID_KEY
  );

/**
 * UI tili — PushManager yangilab turadi; foreground toast va token `language`
 * shundan o'qiydi.
 *
 * 🔴 2026-08-16: tur `'uz' | 'ru'` edi va inglizcha `'ru'` ga aylanardi.
 * Ikki oqibati bor edi:
 *   1. foreground toast inglizcha interfeysda RUSCHA chiqardi;
 *   2. muhimrog'i — bu qiymat `POST /notifications/tokens` da `language`
 *      bo'lib BACKENDGA ketardi, ya'ni ingliz tilidagi foydalanuvchi
 *      bazada "ruscha" deb yozilib, hamma pushni ruscha olardi.
 *      (Push xatida biz backenddan aynan shu maydonga qarab til tanlashni
 *      so'raganmiz — demak noto'g'ri qiymat yuborish ayni muammoni
 *      qaytarardi.)
 * Endi til `asLang` orqali to'liq o'qiladi (uz | ru | en).
 */
let uiLocale: Lang = 'uz';
export const setPushLocale = (l: string): void => {
  uiLocale = asLang(l);
};

const supported = (): boolean =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  isPushConfigured();

/** Joriy ruxsat holati — banner ko'rsatish uchun ('unsupported' = push umuman yo'q). */
export const pushPermission = (): 'unsupported' | 'default' | 'granted' | 'denied' =>
  supported() ? Notification.permission : 'unsupported';

// Service worker'ni konfiguratsiya bilan (URL query orqali — hardcode yo'q) ro'yxatga olamiz.
const swUrl = (): string => {
  const p = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? '',
    authDomain: firebaseConfig.authDomain ?? '',
    projectId: firebaseConfig.projectId ?? '',
    messagingSenderId: firebaseConfig.messagingSenderId ?? '',
    appId: firebaseConfig.appId ?? '',
  });
  return `/firebase-messaging-sw.js?${p.toString()}`;
};

/**
 * SW'ni HAR DOIM (push ruxsatisiz ham) ro'yxatga oladi — keshlash/oflayn rejim SW'siz
 * ishlamaydi. URL registerToken() bilan BIR XIL (swUrl) — aks holda ikki xil script URL
 * navbatma-navbat ro'yxatga olinib, SW har safar qayta o'rnatilardi (kesh bekorga tozalanadi).
 * Firebase env bo'lmasa query bo'sh keladi — SW ichida push qismi jim o'tkazib yuboriladi.
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(swUrl(), { scope: '/' });
  } catch {
    return null; // SW majburiy emas — ro'yxatga olinmasa ilova odatdagidek ishlayveradi
  }
};

// Messaging'ni lazy (dinamik import) init qilamiz — SSR'da ishlamaydi, bundle'ni yengil saqlaydi.
let messagingPromise: Promise<import('firebase/messaging').Messaging | null> | null = null;
const getMessagingInstance = async (): Promise<import('firebase/messaging').Messaging | null> => {
  if (!supported()) return null;
  if (!messagingPromise) {
    messagingPromise = (async () => {
      try {
        const { isSupported, getMessaging } = await import('firebase/messaging');
        if (!(await isSupported())) return null;
        const { initializeApp, getApps, getApp } = await import('firebase/app');
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        return getMessaging(app);
      } catch {
        return null;
      }
    })();
  }
  return messagingPromise;
};

let foregroundBound = false;
const bindForeground = async (): Promise<void> => {
  if (foregroundBound) return;
  const messaging = await getMessagingInstance();
  if (!messaging) return;
  const { onMessage } = await import('firebase/messaging');
  onMessage(messaging, (payload) => {
    const n = payload.notification;
    const data = (payload.data ?? {}) as { type?: string };
    toast(localizeNotification(data.type, n?.title || n?.body, uiLocale), {
      description: localizeNotificationDetail(n?.body, uiLocale),
    });
  });
  foregroundBound = true;
};

// Token oladi va backend'ga ro'yxatdan o'tkazadi (til bilan — backend push tilini shundan biladi).
const registerToken = async (): Promise<string | null> => {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;
  const reg = await registerServiceWorker();
  if (!reg) return null;
  const { getToken } = await import('firebase/messaging');
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg,
  });
  if (!token) return null;
  await registerFcmToken({ fcm_token: token, language: uiLocale, platform: 'web' });
  return token;
};

/**
 * Ruxsat ALLAQACHON berilgan bo'lsa — jimgina token'ni yangilab, foreground'ni bog'laymiz.
 * Har kirishda chaqiriladi (token aylanishi mumkin — qayta ro'yxatdan o'tkazamiz).
 */
export const initPushIfGranted = async (): Promise<void> => {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    await registerToken();
    await bindForeground();
  } catch {
    /* jim — push majburiy emas */
  }
};

/**
 * Foydalanuvchi push'ni yoqmoqchi (tugma) — ruxsat so'raymiz, keyin token ro'yxatga olinadi.
 * @returns natija: 'granted' | 'denied' | 'unsupported' | 'error'
 */
export const enablePush = async (): Promise<'granted' | 'denied' | 'unsupported' | 'error'> => {
  if (!supported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    await registerToken();
    await bindForeground();
    return 'granted';
  } catch {
    return 'error';
  }
};
