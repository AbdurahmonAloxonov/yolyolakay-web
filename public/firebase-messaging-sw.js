/**
 * YolYolakay service worker — IKKI vazifa bitta faylda (bitta scope'da faqat bitta SW
 * yashaydi, shuning uchun ajratib bo'lmaydi):
 *   1. Keshlash/oflayn — sahifalar network-first (oflaynda kesh -> offline.html),
 *      /_next/static cache-first (hash'langan, o'zgarmas), rasm/shrift stale-while-revalidate.
 *      /api va /api-proxy HECH QACHON keshlanmaydi (jonli ma'lumot).
 *   2. Firebase Cloud Messaging — ilova/brauzer YOPIQ bo'lganda push ko'rsatadi.
 *
 * FCM konfiguratsiyasi ro'yxatga olishda URL query orqali beriladi (shared/lib/fcm.ts swUrl) —
 * kodda hardcode YO'Q, hammasi env'dan. Firebase web config maxfiy emas (klientga ochiq).
 * Compat CDN (importScripts) — service worker ESM importni ishonchli qo'llamaydi.
 */

/* ==================== 1) Keshlash / oflayn ==================== */

// Kesh sxemasi o'zgarganda versiyani oshiring — eski kesh activate'da tozalanadi.
// v2 (2026-08-07): navigatsiya network-first'dan stale-while-revalidate'ga o'tdi.
const CACHE_VERSION = 'yy-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const PAGES_CACHE = CACHE_VERSION + '-pages';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icon-192.png', '/icon.svg', '/manifest.webmanifest']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Navigation preload: SW uyg'onishi bilan tarmoq so'rovi PARALLEL boshlanadi.
      // Usiz har navigatsiya SW ishga tushishini kutardi (mobil qurilmada 100-300 ms).
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Chet origin (Yandex Maps, gstatic, backend tunnel) — brauzer o'zi hal qilsin.
  if (url.origin !== self.location.origin) return;
  // API javoblari keshlanmaydi — eski balans/safar ko'rsatishdan oflayn afzal emas.
  if (url.pathname.startsWith('/api')) return;

  // Sahifa navigatsiyasi — STALE-WHILE-REVALIDATE (2026-08-07 da network-first'dan o'zgardi).
  //
  // NEGA O'ZGARDI: network-first'da kesh FAQAT internet uzilganda ishlatilardi, ya'ni
  // tezlikka hech narsa qo'shmasdi — har navigatsiya Vercel SSR'ini kutardi (jonli
  // o'lchov: sovuq 1.55 s, issiq 0.61 s). Endi keshdagi sahifa DARHOL beriladi,
  // yangi nusxa fonda yuklanib keshga yoziladi.
  //
  // NEGA ESKIRISH XAVFI KICHIK: bu ilovada sahifalar mijoz tomonda render bo'ladi
  // ('use client' + React Query). SSR HTML amalda BO'SH QOBIQ — ichida foydalanuvchi
  // ma'lumoti yo'q. Haqiqiy ma'lumot doim `/api-proxy` orqali JONLI keladi va u
  // HECH QACHON keshlanmaydi (pastdagi `/api` sharti). Ya'ni eskirishi mumkin bo'lgan
  // yagona narsa — qobiqning o'zi, u esa keyingi navigatsiyada yangilanadi.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);

        // Tarmoq: preload javobi bo'lsa o'shani olamiz (allaqachon boshlangan).
        const network = (async () => {
          const res = (await event.preloadResponse) || (await fetch(req));
          if (res && res.ok) {
            const copy = res.clone();
            const cache = await caches.open(PAGES_CACHE);
            await cache.put(req, copy);
          }
          return res;
        })();

        if (cached) {
          // Fon yangilanishi javobni USHLAB TURMASIN va xatosi yutilsin —
          // aks holda internet uzilganda "unhandled rejection" chiqardi.
          event.waitUntil(network.catch(() => {}));
          return cached;
        }

        try {
          return await network;
        } catch {
          return (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
    return;
  }

  // Build fayllari hash'langan (o'zgarmas) — keshdan bir zumda, yo'q bo'lsa tarmoqdan olib keshlaymiz.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Rasm/shrift/ikonka: keshdagini darhol beramiz, fonda yangilaymiz (stale-while-revalidate).
  if (req.destination === 'image' || req.destination === 'font' || url.pathname.startsWith('/images/')) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});

/* ==================== 2) Firebase Cloud Messaging ==================== */

// try/catch — CDN skript yuklanmasa/buzilsa ham yuqoridagi keshlash qismi ishlayveradi
// (importScripts natijalari SW o'rnatilishida brauzer tomonidan keshlanadi, oflaynda ham yuradi).
// Turni normallaymiz: 'NEW_MESSAGE' | 'new_message' | 'NewMessage' -> 'newmessage'
// (mijoz tomonda ham aynan shu qoida: shared/lib/notifications.ts, Flutter push_routes.dart).
const normType = (data) =>
  String((data && (data.type || data.event)) || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const isChat = (data) => {
  const t = normType(data);
  return t.includes('message') || t.includes('chat');
};

/**
 * Push bosilganda ochiladigan sahifa.
 *
 * 🔴 Til prefiksi ATAYIN YO'Q: SW foydalanuvchi tilini bilmaydi, prefikssiz
 * manzilni esa proxy.ts NEXT_LOCALE cookie'siga qarab to'g'ri tilga
 * yo'naltiradi (PWA `start_url` ham xuddi shunday ishlaydi).
 */
const targetUrl = (data) => {
  data = data || {};
  const t = normType(data);

  if (isChat(data)) {
    // Chat manzili suhbatdosh + safar juftligidan quriladi (ChatsContent.tsx).
    const peer = data.peer_id || data.sender_id;
    if (peer) {
      // 🔴 SAFAR ID'si SHART EMAS: chat ODAM bo'yicha ochiladi. Ilgari
      // `ride_id` bo'lmasa push umumiy ro'yxatga tashlab ketardi va odam
      // kim yozganini o'zi qidirib topishi kerak edi — safar tugagandan
      // keyingi yozishmalarda esa `ride_id` umuman kelmaydi.
      // `direct` — safarsiz suhbat segmenti (ChatsContent.tsx bilan bir xil).
      const name = data.peer_name || data.sender_name || '';
      return '/chat/' + (data.ride_id || 'direct') + '?peer=' + peer +
        (name ? '&name=' + encodeURIComponent(name) : '');
    }
    return '/chats';
  }

  if (t.includes('parcel')) return '/parcels';
  if (t.includes('payment') || t.includes('subscription') || t.includes('trial') ||
      t.includes('tariff') || t.includes('plan')) return '/tariffs';

  // Haydovchiga kelgan ARIZA — uni tasdiqlash/rad etish paneli dashboard'da.
  if (t.includes('bookingcreated') || t.includes('newbooking')) return '/dashboard';
  // Qolgan bron hodisalari yo'lovchiga tegishli — uning bronlari tarixda.
  if (t.includes('booking')) return '/history';
  if (t.includes('ride') || t.includes('trip') || t.includes('reminder')) {
    return data.ride_id ? '/trip/' + data.ride_id : '/history';
  }

  return '/notifications';
};

try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

  const params = new URL(self.location).searchParams;
  const config = {
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain') || undefined,
    projectId: params.get('projectId'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
  };

  if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    // Backenddan kelgan data-only yoki notification push — orqa fonda ko'rsatamiz.
    messaging.onBackgroundMessage((payload) => {
      const n = (payload && payload.notification) || {};
      const data = (payload && payload.data) || {};
      const title = n.title || 'YolYolakay';
      const chat = isChat(data);
      self.registration.showNotification(title, {
        body: n.body || '',
        // Chatda BITTA suhbatga BITTA bildirishnoma (20 ta xabar kelsa
        // ekran to'lib ketmasin), qolgan hodisalar alohida ko'rinadi.
        tag: chat
          ? 'chat-' + (data.peer_id || data.sender_id || '')
          : data.ride_id || data.type || 'yolyolakay',
        // Ikonkasiz bildirishnomani brauzer O'ZINING nishoni bilan chizadi —
        // foydalanuvchi kimdan kelganini tanimaydi.
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        // Tegi bir xil bo'lsa ham yangi xabar ovoz bersin (aks holda ikkinchi
        // xabar JIMGINA almashtiriladi).
        renotify: chat,
        vibrate: [200, 100, 200],
        // Bosilganda qayerga borishni `notificationclick` shundan o'qiydi.
        data: Object.assign({}, data, { url: targetUrl(data) }),
      });
    });
  }
} catch (e) {
  // Push ishlamasa ham ilova (keshlash) ishlashda davom etadi.
}

/**
 * Bildirishnoma bosilganda — KERAKLI sahifani ochamiz.
 *
 * 🔴 Ilgari bu yerda ochiq oyna shunchaki fokuslanardi va `target` E'TIBORSIZ
 * qolardi: foydalanuvchi "sizga yangi xabar" pushini bosib, o'zi turgan
 * sahifaga qaytardi va yozishmani QO'LDA qidirardi.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          // Avval manzilga o'tkazamiz, keyin fokus. `navigate` ba'zi
          // brauzerlarda qo'llanmaydi (yoki chet origin bo'lsa rad etadi) —
          // o'shanda hech bo'lmasa oyna ochiladi.
          return Promise.resolve(client.navigate ? client.navigate(target) : null)
            .catch(() => null)
            .then((navigated) => (navigated || client).focus());
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
