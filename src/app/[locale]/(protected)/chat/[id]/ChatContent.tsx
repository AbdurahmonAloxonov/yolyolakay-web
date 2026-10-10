'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChatHistory } from '@/shared/api/notifications';
import { useProfile } from '@/entities/user/api/useProfile';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import {
  ArrowLeft,
  Send,
  CheckCheck,
  Check,
  MapPin,
  MessageCircle,
  AlertCircle,
  Search,
  X,
} from 'lucide-react';
import { ReportBlockMenu } from '@/features/moderation/ReportBlockMenu';
import { encodeGeoMessage, parseGeoMessage } from '@/shared/lib/geoMessage';
import { PointPreview } from '@/shared/ui/PointPreview';
import { MapPicker } from '@/shared/ui/MapPicker';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { getAccessToken, getStoredUserId } from '@/shared/lib/token';
import { buildWsUrl } from '@/shared/api/ws';
import {
  formatTripTime,
  formatCurrency,
  deepUnescape,
  parseBackendDate,
} from '@/shared/lib/format';
import { toast } from 'sonner';
import { useTr } from '@/shared/lib/useTr';
import { Avatar } from '@/shared/ui/Avatar';

interface BackendMessage {
  id?: number | string;
  conversation_id?: number | string;
  booking_id?: number | string;
  ride_id?: number | string; // yuborishda kontekst sifatida ketadi (chat KALITI emas)
  sender_id?: number | string;
  // Backend xati 2026-08-13: `receiver_id` doim keladi. `recipient_id` —
  // eski nom, orqaga moslik uchun.
  receiver_id?: number | string;
  recipient_id?: number | string;
  content?: string;
  body?: string;
  created_at?: string;
  /**
   * Suhbatdosh o'qiganmi — ikki galochka uchun. Backend qaysi nomда
   * qaytarishi noma'lum (chat swaggerda yo'q), shu sabab yig'ilishda bir
   * necha ehtimol tekshiriladi. Yo'q bo'lса — "yuborildi" (bitta galochka).
   */
  is_read?: boolean;
  read?: boolean;
  read_at?: string;
}

// Xabarlarni ESKIDAN YANGIGA tartiblaydi.
//
// 🔴 Ilgari `history.slice().reverse()` edi — ya'ni "backend doim yangidan
// eskiga qaytaradi" deb ISHONILARDI. Bu tekshirilmagan taxmin: tartib
// noto'g'ri bo'lsa butun yozishma teskari ko'rinadi. Ustiga-ustak
// yozishmada bir daqiqada yozilgan xabarlar ko'p bo'ladi va ularni
// vaqt bo'yicha "saralash" har safar boshqacha chiqishi mumkin.
//
// Qoida (ilovadagi `orderChatMessages` bilan bir xil):
//   * vaqtlar har xil bo'lsa — vaqt bo'yicha;
//   * vaqtlar TENG bo'lsa — serverdan kelgan tartib saqlanadi;
//   * vaqti yo'q xabar qo'shnisining vaqtini oladi, ya'ni o'z joyida qoladi.
function orderMessages(raw: BackendMessage[]): BackendMessage[] {
  if (raw.length < 2) return raw.slice();

  // Go'ning nol vaqti (`0001-01-01`) `null` beradi — aks holda jonli kelgan
  // xabar eng eski hisoblanib yozishmaning TEPASIGA chiqib ketardi
  // (izohi `parseBackendDate` da).
  const stamp = (m: BackendMessage): number | null =>
    parseBackendDate(m?.created_at)?.getTime() ?? null;

  const known = raw.map(stamp).filter((v): v is number => v != null);
  const serverDesc = known.length > 1 && known[0] > known[known.length - 1];

  // Vaqtsiz xabarga qo'shnisining vaqti beriladi (avval oldingisi, bo'lmasa keyingisi).
  const effective: (number | null)[] = new Array(raw.length).fill(null);
  let carry: number | null = null;
  for (let i = 0; i < raw.length; i += 1) {
    carry = stamp(raw[i]) ?? carry;
    effective[i] = carry;
  }
  let back: number | null = null;
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    back = stamp(raw[i]) ?? back;
    if (effective[i] == null) effective[i] = back;
  }

  return raw
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const at = effective[a.i];
      const bt = effective[b.i];
      if (at != null && bt != null && at !== bt) return at - bt;
      return serverDesc ? b.i - a.i : a.i - b.i;
    })
    .map((x) => x.m);
}

// Optimistik (lokal echo) xabar id'si — yuborilganda vaqtinchalik beriladi.
/**
 * Chatdagi bir bosishlik iboralar — `[uz, ru, en]`.
 *
 * Ro'yxat QISQA (4 ta): uzun ro'yxat surishni talab qiladi va "tez"
 * bo'lmay qoladi. Iboralar ikkala taraf uchun ham mos.
 * Ilovadagi `AppStrings.quickReplies` bilan BIR XIL.
 */
const QUICK_REPLIES: readonly (readonly [string, string, string])[] = [
  ["Yo'ldaman", 'Я в пути', 'On my way'],
  ['5 daqiqa', '5 минут', '5 minutes'],
  ['Qayerdasiz?', 'Вы где?', 'Where are you?'],
  ['Yetib keldim', 'Я на месте', "I'm here"],
] as const;

const isLocalEcho = (m: BackendMessage) => typeof m?.id === 'string' && m.id.startsWith('local-');

// Ikki xabar bir xil "mantiqiy" xabarmi? Backend haqiqiy xabarni boshqa id bilan qaytaradi,
// shuning uchun lokal echo bilan solishtirganda jo'natuvchi + matn bo'yicha moslashtiramiz.
const sameLogicalMessage = (a: BackendMessage, b: BackendMessage) => {
  if (a?.id != null && b?.id != null && String(a.id) === String(b.id)) return true;
  if (!isLocalEcho(a) && !isLocalEcho(b)) return false;
  if ((a.content ?? a.body ?? '') !== (b.content ?? b.body ?? '')) return false;
  // Jo'natuvchi: 2026-08-12 dan backend `new_message` ni jo'natuvchining O'ZIGA
  // ham qaytaradi, lekin qaytgan tanada `sender_id` bo'lmasligi mumkin (chat
  // swaggerda yo'q — shaklga kafolat yo'q). Shunda qat'iy tenglik talab qilsak,
  // o'z xabaring ekranda IKKI marta ko'rinardi. Kelmagan `sender_id` ni "mos"
  // deb qabul qilamiz: solishtirish baribir faqat lokal echo bilan ketyapti.
  const sa = String(a.sender_id ?? '');
  const sb = String(b.sender_id ?? '');
  return sa === sb || sa === '' || sb === '';
};

export const ChatContent: React.FC<{
  rideId: string;
  peerId: string;
  agreedPrice: number;
  peerName?: string;
  peerAvatar?: string;
}> = ({ rideId, peerId, agreedPrice, peerName = '', peerAvatar = '' }) => {
  const locale = useLocale();
  const router = useRouter();
  const tr = useTr();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  // Xabar HTTP bilan emas, ochiq WS orqali yuboriladi — soket'ni yuborish uchun saqlaymiz.
  const socketRef = useRef<WebSocket | null>(null);
  // Allaqachon "o'qildi" deb belgilangan xabar id'lari — ikki marta
  // yubormaslik uchun (backend ack qaytarmaydi, shuning uchun o'zimiz kuzatamiz).
  const markedRef = useRef<Set<string>>(new Set());
  // Joriy xabarlar ro'yxati — soket `onopen`da (closure eskirmasin uchun) o'qiladi.
  const messagesRef = useRef<BackendMessage[]>([]);
  // Suhbatdosh "yozmoqda" holati + uni o'chiradigan taymer.
  /**
   * Yozishma ichidan QIDIRUV.
   *
   * 🔴 NEGA KERAK: uzun yozishmada kelishilgan manzil yoki telefon
   * raqamini topish uchun odam o'nlab xabarni qo'lda surib chiqardi.
   * Qidiruv YUKLANGAN xabarlar ustidan ishlaydi — serverga so'rov
   * yubormaydi, ya'ni internetsiz ham ishlaydi.
   */
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  /**
   * JOY YUBORISH oynasi va unda tanlangan nuqta (`[koordinata, manzil]`).
   *
   * Tanlangan nuqta oyna YOPILGUNCHA saqlanadi: odam xaritani surib,
   * nomini o'qib, keyin «yuborish» bosadi. Darhol yuborilsa tasodifiy
   * bosish xabar bo'lib ketardi.
   */
  const [locationOpen, setLocationOpen] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<[[number, number], string] | null>(null);

  /**
   * Yuborilmagan xabarlar NAVBATI — aloqa tiklanganda o'zi ketadi.
   *
   * `useRef` ATAYIN: navbat ekranni qayta chizishi shart emas va
   * `onopen` callback'i ichidan eng SO'NGGI qiymat o'qilishi kerak
   * (state bo'lsa eskirgan nusxa ilinib qolardi).
   */
  const pendingQueue = useRef<string[]>([]);

  const [peerTyping, setPeerTyping] = useState(false);

  /**
   * Jonli aloqa BUTUNLAY ochilmayaptimi (vaqtincha uzilish emas).
   *
   * 🔴 NEGA KERAK (2026-08-28): backend `/ws` qo'l berishida `Origin` ni
   * ruxsat ro'yxati bilan tekshiradi va bizning domenimiz ro'yxatda YO'Q —
   * jonli o'lchandi: `yolyolakay.co.uz` → 403, `yolyolakay.com` → 101.
   * Brauzer `Origin` ni majburan qo'shadi, ya'ni saytdan kelgan HAR BIR
   * ulanish rad etiladi.
   *
   * Bu holatda ilgari sayt yolg'on umid berardi: har 5 soniyada qayta
   * urinar, xabarni navbatga qo'yib «tiklanganda yuboriladi» derdi — u
   * esa HECH QACHON yuborilmasdi.
   *
   * ⚠️ Brauzer WebSocket xatosining HTTP kodini bermaydi (bu xavfsizlik
   * cheklovi), shuning uchun 403 ni aniq bilib bo'lmaydi. Ketma-ket
   * uchta muvaffaqiyatsiz urinish VA internet joyida bo'lishi — ishonchli
   * belgi: tarmoq uzilishi bunchalik izchil bo'lmaydi.
   */
  const [liveDown, setLiveDown] = useState(false);
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O'z "yozmoqda" signalimni CHEKLAB yuborish — 3s da bir marta.
  const lastTypingSent = useRef(0);

  const { data: profile } = useProfile();

  // Yangi xabarni dublikatsiz qo'shadi: id yoki (jo'natuvchi+matn) bo'yicha mavjud lokal
  // echo topilsa, uni haqiqiy xabar bilan ALMASHTIRAMIZ (ikki nusxa chiqmasin).
  const addMessage = (m: BackendMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((x) => sameLogicalMessage(x, m));
      if (idx === -1) return [...prev, m];
      // Kelgan xabar haqiqiy (lokal emas) bo'lsa — eski lokal echo o'rnini bosadi.
      if (isLocalEcho(prev[idx]) && !isLocalEcho(m)) {
        const next = prev.slice();
        next[idx] = m;
        return next;
      }
      return prev;
    });
  };

  /**
   * SUHBATDOSHNING xabarlarini "o'qildi" deb belgilaydi (WS orqali).
   *
   * 🔴 Backend xati 2026-08-19 aniq shaklni berdi:
   *   {"event":"mark_as_read","data":{"message_ids":["uuid", ...]}}
   * Ack QAYTMAYDI (server jim belgilaydi), chet/mavjud bo'lmagan id jim
   * e'tiborsiz qoldiriladi. Shuning uchun biz javob kutmaymiz — id'ni
   * `markedRef` ga qo'shib, unread hisobini DARHOL lokal yangilaymiz.
   *
   * Faqat SUHBATDOSHNING xabarlari belgilanadi: o'z xabaringni "o'qidim"
   * deyishning ma'nosi yo'q. `local-` echo va id'siz xabarlar tashlanadi —
   * ular hali serverda yo'q yoki id'si noma'lum.
   */
  const markRead = (list: BackendMessage[]): void => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const mine = String(profile?.id || getStoredUserId() || '');

    const ids: string[] = [];
    for (const m of list) {
      const id = m.id;
      if (id == null) continue;
      const sid = String(id);
      if (sid.startsWith('local-')) continue;
      // Faqat suhbatdoshdan kelgan (o'zimniki emas) xabarlar.
      if (mine && String(m.sender_id ?? '') === mine) continue;
      if (markedRef.current.has(sid)) continue;
      markedRef.current.add(sid);
      ids.push(sid);
    }
    if (ids.length === 0) return;

    socket.send(JSON.stringify({ event: 'mark_as_read', data: { message_ids: ids } }));

    // Pastki paneldagi nishon shu suhbat hisobiga kamaysin: server bu suhbatni
    // endi o'qilgan deb biladi, lekin summ'ary keshimiz eski sonni ushlab turadi.
    queryClient.invalidateQueries({ queryKey: ['chat-summaries'] });
  };

  // Yangi Gateway: chat alohida modul emas — notification servisning bir qismi.
  //   GET /notifications/history?user_id_1=&user_id_2=&ride_id=  — suhbat tarixi
  //   (peer_id parametri EMAS — user juftligi; jonli tasdiqlangan validatsiya 2026-07-18)
  //   WS  {event:"send_message", data:{receiver_id, ride_id, content}} — yuborish (HTTP YO'Q)
  const myId = profile?.id || getStoredUserId() || '';
  // `isError` MAJBURIY: usiz so'rov yiqilganda `history` bo'sh massiv bo'lib qolardi va
  // ekran "hali xabar yo'q" deb ko'rsatardi — ya'ni yozishma BOR bo'la turib yo'qday
  // ko'rinardi. Jonli holat (2026-08-10): backend `400 invalid user_id_2` qaytaradi,
  // ya'ni bu nazariy emas. Xatoni yashirmaymiz, ochiq aytamiz va qayta urinish beramiz.
  const queryClient = useQueryClient();

  const {
    data: history = [],
    isLoading,
    isError: historyFailed,
    refetch: reloadHistory,
    isFetching: historyReloading,
  } = useQuery<BackendMessage[]>({
    // `rideId` kalitda QOLADI: bitta odam bilan turli safardan kirilganda
    // yuborish konteksti boshqa, tarix esa baribir bir xil.
    queryKey: ['chat-messages', rideId, peerId, myId],
    enabled: !!peerId && !!myId,
    queryFn: () =>
      // 🔴 `ride_id` bo'yicha filtr ATAYIN YO'Q (2026-08-13): backend uni
      // bersak FAQAT o'sha safar yozishmasini qaytaradi, bizga esa odam
      // bilan BUTUN yozishma kerak — Telegramdagidek. Yangi manzil
      // (`/chats/{peer_id}/messages`) buni tabiiy qiladi: unda `ride_id`
      // tushunchasi umuman yo'q. Yuborishda `ride_id` QOLADI — server
      // tomonda kontekst saqlansin.
      getChatHistory(peerId) as Promise<BackendMessage[]>,
    // 🔴 SERVER TURTKISIGA TAYANIB BO'LMAYDI (2026-08-13 jonli o'lchov).
    //
    // Bitta odamdan uchta xabar yuborildi va soketlar kuzatildi: xabar
    // QABUL QILUVCHIGA emas, YUBORUVCHINING soketlariga tushdi (har safar
    // boshqasiga), bittasi umuman ko'rinmadi. Ya'ni WS yetkazishi qabul
    // qiluvchi bo'yicha ishlamayapti va odam suhbatni ochib turib xabarni
    // ko'rmay qolishi mumkin. Xabarning o'zi bazada saqlanadi, ya'ni
    // tarixni qayta so'rasak ko'rinadi — shuning uchun so'rab turamiz.
    // Server tuzatilgach bu qatorni olib tashlash mumkin.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  /*
   * Suhbat o'qildi — pastki paneldagi (va header'dagi) nishon yangilansin.
   *
   * Server o'qilmaganlar hisobini tarix so'ralganda nolga tushiradi,
   * shuning uchun tarix KELGANDA nishon qayta so'raladi. Aks holda odam
   * xabarni o'qib chiqqan bo'lsa ham nishon 30 soniyagacha turaverardi.
   */
  useEffect(() => {
    if (!isLoading && history.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['chat-summaries'] });
    }
    // Faqat suhbat almashganda: har xabar kelganda so'rov yubormaymiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId, isLoading]);

  /**
   * Xabar yuborish. Yangi kontraktda yuborish FAQAT WS orqali — HTTP endpoint yo'q, shuning
   * uchun useMutation o'rniga to'g'ridan-to'g'ri soketga yozamiz. Soket yopiq bo'lsa matnni
   * inputga qaytaramiz (yo'qolmasin) va xato ko'rsatamiz — reconnect 5 soniyada uriniladi.
   */
  // Yozayotganda suhbatdoshга "yozmoqda" signalини yuboradi (3s throttle).
  const notifyTyping = (): void => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !peerId) return;

    const now = Date.now();
    if (now - lastTypingSent.current < 3000) return;
    lastTypingSent.current = now;
    socket.send(
      JSON.stringify({
        event: 'typing',
        data: { receiver_id: peerId, recipient_id: peerId },
      })
    );
  };

  const sendMessage = (content: string): void => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !peerId) {
      /*
       * 🔴 ILGARI: matn inputga QAYTARILARDI va odam qayta bosishi kerak
       * edi. Shaharlararo yo'lda aloqa tinimsiz uzilib turadi — ya'ni
       * odam har safar ekranga qarab, qayta yuborishi kerak bo'lardi.
       *
       * Endi xabar NAVBATDA turadi va soket tiklanganda o'zi ketadi
       * (`onopen` -> `flushQueue`). Matn inputga qaytarilmaydi: u
       * yo'qolmadi, shunchaki hali yuborilmadi — va biz buni AYTAMIZ.
       */
      if (liveDown) {
        /*
         * 🔴 Navbat va'dasi bu yerda YOLG'ON bo'lardi: ulanish umuman
         * ochilmayotgan bo'lsa xabar hech qachon ketmaydi. Matnni
         * inputga QAYTARAMIZ — odam uni nusxalab ilovadan yuborsin
         * (navbatda qolsa sahifa yangilanishi bilan yo'qolardi).
         */
        setInputValue((prev) => (prev ? prev : content));
        toast.error(
          tr(
            "Saytdan yuborib bo'lmayapti — xabarni ilovadan yuboring",
            'С сайта отправить не получается — напишите из приложения',
            "Can't send from the website — please write from the app"
          )
        );
        return;
      }
      pendingQueue.current.push(content);
      toast(
        tr(
          "Aloqa yo'q — xabar navbatda, tiklanganda yuboriladi",
          'Нет связи — сообщение в очереди, отправим при восстановлении',
          'No connection — message queued, will send when back online'
        )
      );
      return;
    }
    // 🔴 2026-08-12, backend logi bilan topildi: server `receiver_id` ni o'qiydi,
    // biz esa `recipient_id` yuborardik. ID yo'qolmagan — KALIT NOMI boshqa edi.
    // Server bo'sh satrni ko'rib (`invalid UUID length: 0`) xabarni rad etardi:
    // u navbatga ham, bazaga ham tushmasdi, shuning uchun chatga qayta kirilganda
    // yozishma "yo'qolib" qolardi — aslida u hech qachon saqlanmagan edi.
    //
    // IKKALA kalit ham yuboriladi: chat swaggerda umuman yo'q (xat №7), ya'ni
    // gateway'ning qaysi versiyasi turganini hujjat bilan tekshirib bo'lmaydi.
    // Ortiqcha kalit Go tomonda e'tiborsiz qoldiriladi.
    socket.send(
      JSON.stringify({
        event: 'send_message',
        data: { receiver_id: peerId, recipient_id: peerId, ride_id: rideId, content },
      })
    );
    // O'z xabarimizni darhol ko'rsatamiz: backend uni echo qilib qaytarmasligi mumkin.
    // `id` YO'Q — echo kelsa addMessage id bo'yicha dublikat deb hisoblay olmaydi, shuning
    // uchun lokal nusxaga vaqtinchalik id beramiz (tarix qayta yuklanganda o'rnini bosadi).
    addMessage({
      id: `local-${Date.now()}`,
      ride_id: rideId,
      sender_id: profile?.id,
      content,
      created_at: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (history.length === 0) return;
    const ordered = orderMessages(history);
    // MUHIM: history qayta yuklanganda (refetchOnWindowFocus) lokal yuborilgan yoki
    // WS orqali kelgan, lekin hali tarixga tushmagan xabarlarni O'CHIRIB yubormaymiz.

    setMessages((prev) => {
      const seen = new Set(ordered.filter((m) => m?.id != null).map((m) => String(m.id)));
      // Faqat tarixda HALI yo'q xabarlarni saqlaymiz (WS bilan kelgan yoki hali yetib bormagan
      // yuborilganlar). Lokal echo'lar — agar o'sha (jo'natuvchi+matn) tarixga tushgan bo'lsa —
      // tashlab yuboriladi, aks holda o'z xabaring ikki marta ko'rinardi.
      const extras = prev.filter((m) => {
        if (m?.id != null && seen.has(String(m.id))) return false;
        if (isLocalEcho(m)) return !ordered.some((h) => sameLogicalMessage(h, m));
        return m?.id != null;
      });
      return [...ordered, ...extras];
    });
    // Tarix ekranda — suhbatdoshning xabarlarini o'qildi deb belgilaymiz.
    // Soket hali ochilmagan bo'lsa `markRead` jim qaytadi; WS `onopen`
    // tarix bilan qayta urinadi (pastda).
    markRead(ordered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  // Ro'yxatni ref'da ham ushlaymiz: soket `onopen` bir marta ulanadi va
  // uning ichidagi closure eski (bo'sh) ro'yxatni ko'rib qolmasin.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!getAccessToken() || typeof window === 'undefined') return;

    // WebSocket to'g'ridan-to'g'ri backendga ulanadi (Next proxy WS'ni o'tkazmaydi).
    // Yangi Gateway: yagona `/ws` — chat xabarlari ham shu soketda keladi VA shu orqali
    // yuboriladi (buildWsUrl `?token=` qo'yadi, user id token'dan olinadi).
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByUs = false;
    // Ketma-ket muvaffaqiyatsiz urinishlar. `onopen` da nolga tushadi.
    let failures = 0;

    /** Uzilishdan keyin qayta urinish — har safar uzoqroq kutib. */
    const retry = () => {
      failures += 1;
      // Uchtadan keyin bu tarmoq uzilishi emas, xizmat muammosi.
      if (failures >= 3 && navigator.onLine) setLiveDown(true);
      // 5s, 10s, 15s … eng ko'pi 30s. Ilgari doim 5s edi va ulanib
      // bo'lmaydigan holatda server bekorga urib turilardi.
      reconnectTimer = setTimeout(connect, Math.min(5000 * failures, 30000));
    };

    const connect = () => {
      // Token'ni HAR ulanishda yangi o'qiymiz — refresh'dan keyin reconnect eski token bilan
      // aylanmasin (buildWsUrl same-origin fallback ham beradi).
      const token = getAccessToken();
      if (!token) {
        // Token yo'qligi xizmat nosozligi EMAS (yangilanish oralig'i) —
        // muvaffaqiyatsizlik deb sanalmaydi.
        reconnectTimer = setTimeout(connect, 5000);
        return;
      }
      try {
        socket = new WebSocket(buildWsUrl(token));
        socketRef.current = socket;
        // Ulanish tayyor bo'lgach: tarix soketdan OLDIN kelgan bo'lsa,
        // o'shanda `markRead` jim qaytgan edi — endi qayta urinamiz.
        socket.onopen = () => {
          failures = 0;
          setLiveDown(false);
          markRead(messagesRef.current);
          // Aloqa tiklandi — navbatdagi xabarlarni yuboramiz.
          // Navbat DARHOL bo'shatiladi: yuborish yana yiqilsa, xabar
          // `sendMessage` ichida qaytadan navbatga tushadi.
          const queued = pendingQueue.current;
          pendingQueue.current = [];
          for (const text of queued) sendMessage(text);
        };
      } catch {
        retry();
        return;
      }

      socket.onmessage = (event) => {
        try {
          // HTTP javoblari kabi WS kadri ham apostrof/qo'shtirnoqni HTML
          // kodida olib keladi (`so&#39;m`). Ochish SHU YERDA — chizishda
          // emas: aks holda har yangi ko'rsatish joyida yana unutilardi.
          const data = deepUnescape(JSON.parse(event.data)) as Record<string, unknown>;
          // Backend ikki xil shaklda yuboradi (chat swaggerda yo'q, shakl faqat
          // jonli kuzatishdan ma'lum):
          //   eski:  { type: "NEW_MESSAGE", payload: {...} }
          //   yangi: { event: "new_message", data: {...} }  — 2026-08-12 dan
          //          JO'NATUVCHINING O'ZIGA ham qaytariladi (yetkazilgani tasdig'i).
          // Faqat birinchisini o'qisak, yangi shakldagi kadr jim tashlanib,
          // ochiq turgan suhbatga kelgan xabar ekranda ko'rinmasdi.
          const kind = String(data?.type ?? data?.event ?? '').toUpperCase();
          const payload = data?.payload ?? data?.data;

          // "O'qildi" — suhbatdosh MENING xabarларимни o'qиди, jo'natuvchiга
          // keladi (backend 2026-08-20). O'z xabarларимни is_read=true qilib,
          // ikki galochка chizamiz. Tarix qayta yuklаnмаса ham darhol.
          if (kind === 'MESSAGES_READ') {
            const ids = new Set(
              (((payload as { message_ids?: unknown })?.message_ids ?? []) as unknown[]).map((x) =>
                String(x)
              )
            );
            if (ids.size > 0) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id != null && ids.has(String(m.id)) ? { ...m, is_read: true } : m
                )
              );
            }
            return;
          }

          // "Yozmoqda" — server kadrni retranslatsiya qilса keladi (xat
          // 2026-08-21). Faqat SHU suhbatdoshдан, 3 soniya ko'rsatiladi.
          if (kind === 'TYPING') {
            const from = String(
              (payload as { sender_id?: unknown })?.sender_id ??
                (data as { sender_id?: unknown })?.sender_id ??
                ''
            );
            if (from === String(peerId)) {
              if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
              setPeerTyping(true);
              peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 3000);
            }
            return;
          }

          if (kind === 'NEW_MESSAGE' && payload) {
            // Xabar keldi — "yozmoqda" o'chadi.
            if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
            setPeerTyping(false);
            const m = payload as BackendMessage;
            // 🔴 2026-08-13: ilgari xabar SAFAR bo'yicha filtrlanardi
            // (`mRide === rideId`). Chat endi odam bo'yicha ochilgani uchun
            // bu filtr boshqa safardan kelgan xabarni JIM tashlab yuborardi —
            // odam suhbatni ochib turib xabarni ko'rmay qolardi.
            // Endi filtr SUHBATDOSH bo'yicha.
            const from = String(m.sender_id ?? '');
            const to = String(m.receiver_id ?? m.recipient_id ?? '');
            const mine = String(myId ?? '');
            const belongsHere =
              (from === String(peerId) && (!to || to === mine)) ||
              (from === mine && to === String(peerId)) ||
              // Kim yuborgani noma'lum bo'lsa TASHLAB YUBORMAYMIZ: xabarni
              // yo'qotgandan ko'ra ortiqcha ko'rsatgan yaxshi.
              (!from && !to);
            if (belongsHere) {
              addMessage(m);
              // Suhbat ekranda ochiq — kelgan zahoti o'qildi deb belgilaymiz.
              markRead([m]);
            }
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      // Uzilsa (tarmoq/server restart) 5 soniyadan keyin qayta ulanamiz —
      // aks holda ochiq suhbatga kelgan jonli xabarlar butunlay yo'qoladi.
      socket.onclose = () => {
        socketRef.current = null;
        if (closedByUs) return;
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
      if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
      try {
        socket?.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
    // `peerId`/`myId` — kelgan xabar SHU suhbatniki ekanini tekshirish uchun.
    // Ular sahifa davomida o'zgarmaydi, ya'ni ulanish qayta ochilmaydi.
    // `markRead` ATAYIN deps'da yo'q: u har render'da yangi funksiya va
    // qo'shilsa soket har renderda uzilib-ulanardi. Uning ichidagi
    // `socketRef`/`markedRef`/`queryClient` — barqaror ref'lar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId, peerId, myId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    sendMessage(text);
  };

  /**
   * Xaritadan tanlangan joyni yuborish.
   *
   * 🔴 ILGARI BU YERDA OSM HAVOLASI KETARDI
   * (`openstreetmap.org/?mlat=..`). Ilova uni tanimasdi va uzun matn
   * bo'lib ko'rinardi — ya'ni ikki mijoz bir ishni ikki xil qilardi
   * (loyihaning eski kasali). Endi ikkalasi ham standart `geo:`
   * formatini yuboradi va IKKALASIDA ham xarita chiziladi (izohi
   * `lib/geoMessage.ts` da).
   *
   * Joy NOMI ham ketadi: koordinata odamga hech nima aytmaydi,
   * «Chilonzor, 19-kvartal» esa aytadi. Geokoder javob bermasa
   * nomsiz ketadi — xabar baribir ishlaydi.
   */
  const sendPickedLocation = () => {
    if (!pickedLocation) return;
    const [coords, address] = pickedLocation;
    sendMessage(encodeGeoMessage(coords[0], coords[1], address));
    setLocationOpen(false);
    setPickedLocation(null);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-bg relative select-none">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-surface border-b border-border shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-brand-pink-light dark:hover:bg-accent/10 text-text-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            {/* Surat bo'lsa surat, bo'lmasa ismning bosh harfi (eski ko'rinish). */}
            <Avatar src={peerAvatar} name={peerName} size={40} />
            <div className="flex flex-col">
              <span className="font-extrabold text-sm text-text">
                {/* Sarlavha ODAMNIKI: ism kelmasa ham bo'lim nomi emas,
                    rolga bog'liq bo'lmagan so'z tursin (ilovada ham shunday). */}
                {peerName || tr('Suhbatdosh', 'Собеседник', 'Chat partner')}
              </span>
              {/* "Yozmoqda" — bo'lса narx o'rniga (Telegram uslubi), turquoise. */}
              {peerTyping ? (
                <span className="text-[11px] font-bold text-turquoise">
                  {tr('yozmoqda...', 'печатает...', 'typing...')}
                </span>
              ) : (
                agreedPrice > 0 && (
                  <span className="text-[11px] font-bold text-accent">
                    {tr('Kelishilgan narx:', 'Цена:', 'Agreed price:')}{' '}
                    {formatCurrency(agreedPrice, locale)}
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        {/* Shikoyat va bloklash — Google Play UGC siyosati TALABI (xat §7b).
            Chat foydalanuvchilar o'rtasidagi muloqot joyi, shuning uchun
            aynan shu yerda bo'lishi kerak. */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setSearching((v) => !v);
              // Yopilganda so'z ham TOZALANADI: aks holda keyingi
              // ochilishda ro'yxat sababsiz filtrlangan bo'lib qolardi.
              if (searching) setQuery('');
            }}
            aria-label={tr('Yozishmadan qidirish', 'Поиск по переписке', 'Search in chat')}
            title={tr('Yozishmadan qidirish', 'Поиск по переписке', 'Search in chat')}
            className="rounded-full p-2 text-text-muted transition-colors hover:bg-brand-pink-light dark:hover:bg-accent/10 hover:text-accent"
          >
            {searching ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
          {peerId && (
            <ReportBlockMenu targetUserId={peerId} targetName={peerName} rideId={rideId} />
          )}
        </div>
      </div>

      {searching && (
        <div className="border-b border-border bg-surface px-3 py-2">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('Yozishmadan qidirish', 'Поиск по переписке', 'Search in chat')}
            className="w-full rounded-full border border-border bg-bg px-4 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-opacity-50">
        {historyFailed && messages.length === 0 ? (
          /* Tarix YUKLANMADI. Buni "xabar yo'q" bilan almashtirib bo'lmaydi: odam
             yozishmasi o'chib ketgan deb o'ylaydi. Yangi xabarlar WS orqali baribir
             keladi, shuning uchun chat oynasi ochiq qoladi. */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-text-muted">
            <div className="bg-surface p-4 rounded-full border border-border shadow-sm">
              <AlertCircle className="h-8 w-8 opacity-60" />
            </div>
            <p className="text-sm font-medium max-w-[240px] leading-relaxed">
              {tr(
                'Eski xabarlar yuklanmadi. Yozishmangiz joyida — yangi xabarlar keladi.',
                'Старые сообщения не загрузились. Переписка на месте — новые сообщения будут приходить.',
                "Couldn't load earlier messages. Your conversation is safe — new messages will still arrive."
              )}
            </p>
            <Button
              variant="secondary"
              onClick={() => void reloadHistory()}
              disabled={historyReloading}
            >
              {historyReloading
                ? tr('Yuklanmoqda…', 'Загрузка…', 'Loading…')
                : tr('Qayta urinish', 'Повторить', 'Try again')}
            </Button>
          </div>
        ) : messages.length === 0 && !isLoading ? (
          /* Bo'sh suhbat — hali hech qanday xabar yozilmagan. */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-text-muted">
            <div className="bg-surface p-4 rounded-full border border-border shadow-sm">
              <MessageCircle className="h-8 w-8 opacity-60" />
            </div>
            <p className="text-sm font-medium max-w-[220px] leading-relaxed">
              {tr(
                "Hali xabar yo'q. Suhbatni boshlang!",
                'Пока нет сообщений. Начните разговор!',
                'No messages yet. Start the conversation!'
              )}
            </p>
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            <div className="bg-surface/80 backdrop-blur text-[10px] font-bold text-text-muted px-3 py-1 rounded-full shadow-sm">
              {tr('Bugun', 'Сегодня', 'Today')}
            </div>
          </div>
        )}

        {historyFailed && messages.length > 0 && (
          /* Tarix yiqildi, lekin WS orqali yangi xabarlar keldi. Chatni bloklamaymiz —
             faqat "yuqorisi to'liq emas" deb ogohlantiramiz, aks holda odam eski
             xabarlari o'chgan deb o'ylaydi. */
          <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted mb-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {tr(
                'Eski xabarlar yuklanmadi',
                'Старые сообщения не загрузились',
                "Earlier messages didn't load"
              )}
            </span>
            <button
              type="button"
              onClick={() => void reloadHistory()}
              disabled={historyReloading}
              className="underline underline-offset-2 disabled:opacity-50"
            >
              {tr('qayta urinish', 'повторить', 'try again')}
            </button>
          </div>
        )}

        {/* Qidiruv FAQAT ko'rinishni cheklaydi — xabarlar o'chirilmaydi
            va so'z tozalanganda hammasi qaytadi. */}
        {(query.trim()
          ? messages.filter((m) =>
              String(m.content ?? m.body ?? '')
                .toLowerCase()
                .includes(query.trim().toLowerCase())
            )
          : messages
        ).map((msg, index) => {
          // If we don't have profile yet, try to guess or just wait
          const isMe = profile && String(profile.id) === String(msg.sender_id);

          /*
            ULASHILGAN JOY — 16.09.2026.

            🔴 Ilgari joy UZUN HAVOLA bo'lib ko'rinardi
            (`openstreetmap.org/?mlat=...`): odam undan hech nima
            tushunmasdi, bosilsa esa OSM sayti ochilib uni ilovadan
            chiqarib yuborardi. Endi pufakda XARITANING O'ZI chiziladi.

            Eski havolalar ham o'qiladi (izohi `lib/geoMessage.ts` da) —
            tarixdagi xabarlar xarita bo'lib chiziladi.
          */
          const geo = parseGeoMessage(String(msg.content ?? msg.body ?? ''));

          return (
            <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl p-3 shadow-sm relative ${
                  isMe
                    ? 'bg-accent text-white rounded-br-none'
                    : 'bg-surface border border-border text-text rounded-bl-none'
                }`}
              >
                {geo ? (
                  <div className="space-y-1.5">
                    <PointPreview lat={geo.lat} lon={geo.lon} height={130} className="w-[220px]" />
                    <p className="flex items-start gap-1 text-xs font-bold leading-snug break-words">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {/* Nom kelmagan bo'lsa koordinata: bo'sh qator
                          "xarita nimaniki?" degan savol qoldirardi. */}
                      {geo.label ?? `${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium leading-relaxed break-words">
                    {/* HTML kodlari transport qatlamida ochiladi (`client.ts`
                        interceptor'i va yuqoridagi WS `deepUnescape`) — bu yerda
                        matn allaqachon toza. IKKI MARTA OCHISH MUMKIN EMAS:
                        foydalanuvchi chindan yozgan `&amp;` buziladi. */}
                    {msg.content ?? msg.body}
                  </p>
                )}

                <div
                  className={`flex items-center justify-end gap-1 pt-1 mt-0.5 ${isMe ? 'text-white/80' : 'text-text-muted'}`}
                >
                  <span className="text-[9px] font-bold">{formatTripTime(msg.created_at)}</span>
                  {/* 🔴 Bitta galochka = yuborildi; ikki (turquoise) = o'qildi.
                      Ilgari DOIM ikki galochka edi — o'qilmagan xabar ham
                      "o'qildi" ko'rinardi (yolg'on). Backend `is_read`
                      qaytармаса doim bitta galochka. */}
                  {isMe &&
                    (msg.is_read || msg.read || msg.read_at ? (
                      <CheckCheck className="w-3 h-3 text-turquoise" />
                    ) : (
                      <Check className="w-3 h-3" />
                    ))}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-surface border-t border-border shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10 pb-safe">
        {/* TEZ JAVOBLAR — bir bosishlik iboralar.

            🔴 NEGA KERAK: haydovchi RULDA matn yozolmaydi (yozsa ham
            yozmasligi kerak), yo'lovchi esa ko'chada telefon tepishini
            xohlamaydi. Chatdagi xabarlarning katta qismi aslida shu to'rt
            iboradan iborat.

            Faqat maydon BO'SH bo'lganda ko'rinadi: odam yozayotgan bo'lsa
            chiplar shunchaki xalaqit beradi. Ilova bilan bir xil ro'yxat. */}
        {inputValue.trim() === '' && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {QUICK_REPLIES.map((row) => {
              const phrase = tr(row[0], row[1], row[2]);
              return (
                <button
                  key={row[0]}
                  type="button"
                  // DARHOL yuboriladi, maydonga qo'yilmaydi: bir bosish —
                  // bitta amal, aks holda yana "yuborish" bosilardi.
                  onClick={() => sendMessage(phrase)}
                  className="shrink-0 rounded-full border border-border bg-bg px-3 py-1.5 text-xs font-bold text-text-muted transition-colors hover:border-accent hover:text-accent active:scale-95"
                >
                  {phrase}
                </button>
              );
            })}
          </div>
        )}
        {liveDown && (
          /* Eski xabarlar HTTP orqali keladi va o'qiladi — faqat YUBORISH
             ishlamaydi. Shuni aniq aytamiz, aks holda odam butun
             yozishma yo'qolgan deb o'ylaydi. */
          <div
            role="status"
            className="mb-2 flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-text-muted"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
            <span>
              {tr(
                "Saytdan xabar yuborish vaqtincha ishlamayapti. Eski xabarlarni o'qishingiz mumkin, yozish uchun ilovadan foydalaning.",
                'Отправка сообщений с сайта временно не работает. Старые сообщения читаются, для ответа используйте приложение.',
                'Sending messages from the website is temporarily unavailable. You can still read the conversation — use the app to reply.'
              )}
            </span>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/*
            JOY YUBORISH — 16.09.2026 da XARITAGA aylandi.

            🔴 Ilgari bu tugma darhol BRAUZER JOYLASHUVINI yuborardi.
            Ya'ni faqat bitta savolga javob berardi — «men shu yerdaman».
            Ikkinchi, bizda muhimroq savol javobsiz qolardi: «kel, SHU
            YERDA uchrashaylik» — u boshqa nuqta va uni faqat xaritadan
            ko'rsatish mumkin.

            Endi xarita ochiladi, ichida «mening joylashuvim» tugmasi
            ham bor — ya'ni eski amal yo'qolmadi, bir bosish qo'shildi.
            Ilovada AYNAN shunday (`showLocationPicker`).
          */}
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            title={tr('Joy yuborish', 'Отправить место', 'Send a location')}
            aria-label={tr('Joy yuborish', 'Отправить место', 'Send a location')}
            className="p-2.5 rounded-full text-text-muted hover:bg-surface-hover hover:text-accent transition-colors shrink-0"
          >
            <MapPin className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <Input
              placeholder={tr('Xabar yozing...', 'Написать сообщение...', 'Write a message...')}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                notifyTyping();
              }}
              className="rounded-full bg-bg border-none focus-visible:ring-1 focus-visible:ring-accent pl-4 h-11 text-sm font-medium"
            />
          </div>
          <Button
            type="submit"
            disabled={!inputValue.trim()}
            className="rounded-full w-11 h-11 p-0 flex items-center justify-center shrink-0 shadow-md"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </form>
      </div>

      {/* JOY TANLASH — ilovadagi `showLocationPicker` ning juftligi. */}
      <BottomSheet
        isOpen={locationOpen}
        onClose={() => {
          setLocationOpen(false);
          setPickedLocation(null);
        }}
        title={tr('Joy yuborish', 'Отправить место', 'Send a location')}
      >
        <div className="space-y-3">
          <MapPicker onChange={(coords, address) => setPickedLocation([coords, address])} />
          <Button
            onClick={sendPickedLocation}
            // O'CHIQ TUGMA SABABINI AYTADI (uy qoidasi): nuqta
            // tanlanmaguncha yuboradigan narsa yo'q.
            disabled={!pickedLocation}
            className="w-full"
          >
            {pickedLocation
              ? tr('Shu joyni yuborish', 'Отправить это место', 'Send this location')
              : tr('Xaritadan joyni tanlang', 'Выберите место на карте', 'Pick a spot on the map')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
};
