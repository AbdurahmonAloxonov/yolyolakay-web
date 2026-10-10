'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getMyRides, getMyBookings } from '@/shared/api/rides';
import { getCachedRide } from '@/shared/api/rideCache';
import { MessageCircle, CheckCheck } from 'lucide-react';
import { formatTripTime, normalizeBooking, personName } from '@/shared/lib/format';
import { getChatSummaries } from '@/shared/api/notifications';
import { getUser } from '@/shared/api/users';
import { useProfile } from '@/entities/user/api/useProfile';
import { useUIStore } from '@/shared/model/uiStore';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Avatar } from '@/shared/ui/Avatar';
import { useTr } from '@/shared/lib/useTr';

interface Conversation {
  rideId: string; // chat kaliti (1): safar
  peerId: string; // chat kaliti (2): suhbatdosh — `/notifications/history?peer_id=&ride_id=`
  other_name: string;
  /** Suhbatdosh surati — bo'lmasa bosh harf ko'rsatiladi (`Avatar`). */
  avatar?: string;
  last_message?: string;
  last_at?: string;
  /**
   * Oxirgi xabarni MEN yozganmanmi.
   *
   * 🔴 NEGA KERAK (egasi tasdiqladi, 2026-08-19): ro'yxatda faqat matn
   * turardi va kim yozgani bilinmasdi. "Xo'p, kelishdik" degan qatorni
   * ko'rgan odam suhbatdosh javob berdi deb o'ylab chatni ochardi —
   * u yerda esa o'zining xabari turardi. Telegram/WhatsApp bu muammoni
   * "Siz:" prefiksi bilan yechgan, bizda esa u yo'q edi.
   */
  mine?: boolean;
  /**
   * O'qilmagan xabarlar soni (`GET /notifications/chats`).
   *
   * 🔴 Server buni ancha oldindan beryapti, lekin 2026-08-17 gacha
   * hech qayerda ko'rsatilmasdi: odam ro'yxatga qarab qaysi suhbatda
   * yangi xabar borligini BILOLMASDI, har bittasini ochib ko'rishi
   * kerak edi.
   */
  unread?: number;
}

export const ChatsContent: React.FC = () => {
  const locale = useLocale();
  const router = useRouter();
  const tr = useTr();
  const { data: profile } = useProfile();
  const { activeRole } = useUIStore();
  const myId = String(profile?.id ?? '');

  const { data: conversationsData, isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations', myId, activeRole],
    // Profil kelmaguncha KUTAMIZ: myId='' bilan ishga tushsa suhbatdosh noto'g'ri
    // aniqlanib, yo'lovchi O'Z ismini ko'rardi + 2x fetch bo'lardi.
    enabled: !!myId,
    queryFn: async () => {
      // Ro'yxat BRONLARDAN yig'iladi. ⚠️ 07.09.2026: ilgari bu yerda «alohida
      // "conversations" endpointi backendda YO'Q» deb yozilgandi — noto'g'ri.
      // `GET /chats` (va aynan nusxasi `GET /notifications/chats`) bor, lekin
      // faqat 3 maydon beradi: partner_id, last_message, unread_count (jonli
      // o'lchandi). Safar ham, ism/avatar ham yo'q — ya'ni ro'yxat baribir
      // shu yerda quriladi, u endpoint esa uni to'ldiradi. Suhbat = (safar, suhbatdosh)
      // juftligi; chat FAQAT ACCEPTED (confirmed) bron uchun ochiladi:
      //   haydovchi — o'z safarlari (/rides/my?role=driver), suhbatdosh = qabul qilingan
      //     bronlar yo'lovchilari (bronlar SHU javob ichida, alohida endpoint yo'q);
      //   yo'lovchi — o'z bronlari (getMyBookings), suhbatdosh = haydovchi.
      //     ⚠ Bron javobida ham, qidiruv keshida ham driver_id YO'Q (jonli 2026-07-18) —
      //     backend qo'shmaguncha bunday suhbat ro'yxatda chiqmaydi (backend-xat bandi).
      if (activeRole === 'passenger') {
        const bookings = (await getMyBookings()).map((b) => normalizeBooking(b));
        return bookings
          .filter((b) => b.status === 'ACCEPTED')
          .map((b): Conversation => {
            const rideId = String(b.trip_id ?? '');
            // Bronга embedded ride (backend v6) -> qidiruv keshi; driver.id — v6 §3.
            const cached =
              ((b as Record<string, any>).ride as Record<string, any> | undefined) ??
              (rideId ? (getCachedRide(rideId) as Record<string, any> | null) : null);
            return {
              rideId,
              peerId: String(
                cached?.driver?.id ?? cached?.driver_id ?? cached?.driver?.user_id ?? ''
              ),
              // Ism BRONNING O'ZIDAN olinadi (`BookingResponse.ride.driver`),
              // kesh faqat zaxira. Ilgari birinchi navbatda kesh qaralardi va
              // u bo'sh bo'lsa — yangi seansda, boshqa qurilmada, yoki safar
              // sahifasi ochilmagan bo'lsa — yo'lovchi haydovchining ismi
              // o'rniga "Haydovchi" so'zini ko'rardi. Haydovchi esa
              // yo'lovchining ismini ko'rib turardi, ya'ni nomutanosiblik
              // aynan shu yerdan chiqqan (egasi xabari 2026-08-12).
              other_name:
                personName(cached?.driver) ||
                String(cached?.driver_name ?? '') ||
                tr('Haydovchi', 'Водитель', 'Driver'),
              avatar: String(cached?.driver?.avatar ?? cached?.driver?.avatar_url ?? ''),
              last_message: '',
              last_at: String(
                (b as Record<string, any>).UpdatedAt ?? (b as Record<string, any>).CreatedAt ?? ''
              ),
            };
          })
          .filter((c) => c.rideId && c.peerId);
      }

      // Haydovchi: bronlar /rides/my javobidagi bookings[]da (N+1 so'rov YO'Q).
      const rides = await getMyRides('driver');
      return rides.flatMap((r): Conversation[] => {
        const rideId = String(r.id ?? '');
        if (!rideId) return [];
        return ((r.bookings ?? []) as Record<string, any>[])
          .map((b) => normalizeBooking(b))
          .filter((b) => b.status === 'ACCEPTED')
          .map(
            (b): Conversation => ({
              rideId,
              peerId: String(b.passenger_id ?? ''),
              other_name:
                personName((b as Record<string, any>).passenger, b.passenger_name) ||
                tr("Yo'lovchi", 'Пассажир', 'Passenger'),
              avatar: String(
                (b as Record<string, any>).passenger?.avatar ??
                  (b as Record<string, any>).passenger?.avatar_url ??
                  ''
              ),
              last_message: '',
              last_at: String(
                (b as Record<string, any>).UpdatedAt ??
                  (b as Record<string, any>).CreatedAt ??
                  r.departure_time ??
                  ''
              ),
            })
          )
          .filter((c) => c.peerId);
      });
    },
    // 5s -> 20s (2026-08-07). Bu suhbatlar RO'YXATI, chatning o'zi emas: xabarlar
    // WS orqali darhol keladi, bu so'rov faqat zaxira. Backend har chaqiruvi jonli
    // o'lchovda 0.65-1.08 s turadi — 5 soniyalik interval so'rovni deyarli DOIM
    // uchib turgan holatda saqlardi (tarmoq/batareya, sekinlik hissi).
    refetchInterval: 20000,
    // Ilova fonga o'tsa so'rov umuman ketmasin (default shunday, ATAYIN aniq yozilgan).
    refetchIntervalInBackground: false,
  });

  /*
   * DUBLIKATLAR OLIB TASHLANADI.
   *
   * 🔴 Egasi xabari (2026-08-12): bitta odam ro'yxatda ikki marta chiqib,
   * har safar "yangi chat" ochilayotgandek ko'rinadi.
   *
   * Sabab: ro'yxat BRONLAR bo'yicha yig'iladi. Bitta yo'lovchi bitta safarga
   * ikki marta bron qilsa, ikkita bir xil qator paydo bo'ladi. Suhbatning
   * o'zi esa (safar, suhbatdosh) juftligi bilan aniqlanadi — havola ham
   * aynan shu ikkitasidan quriladi (`/chat/{rideId}?peer={peerId}`), ya'ni
   * ikkala qator BIR XIL chatni ochadi.
   *
   * 🔴 2026-08-13 KALIT O'ZGARDI: endi FAQAT suhbatdosh. Ilgari (safar +
   * suhbatdosh) edi va bitta haydovchi bilan uch marta yursangiz ro'yxatda
   * UCHTA bir xil ism turardi — ularni faqat yo'nalishdan ajratib bo'lardi.
   * Egasi: "yo'nalish bo'yicha chat ochilmasin, user id bo'yicha ochsin —
   * Telegramda ham shunaqa".
   *
   * `rideId` yozuvda qoladi: u xabar yuborishda kontekst sifatida ketadi.
   * Eng yangisi qoldiriladi: `last_at` bo'yicha kattasi.
   */
  /*
   * OXIRGI XABAR — `GET /notifications/chats` (backend 2026-08-16 da qo'shdi).
   *
   * 🔴 Ilgari ro'yxatda oxirgi xabar UMUMAN yo'q edi (`last_message: ''`)
   * va tartib bron sanasi bo'yicha edi — ya'ni kim yaqinda yozgani
   * ko'rinmasdi, odam har suhbatni ochib chiqishi kerak edi.
   *
   * Javobda ism/avatar YO'Q (faqat `partner_id`), shuning uchun ro'yxat
   * ALMASHTIRILMAYDI: kim ekani bronlardan aniqlanadi, bu esa ustiga
   * "nima yozilgan va qachon" ma'lumotini qo'yadi. So'rov yiqilsa bo'sh
   * massiv qaytadi va ekran ilgarigidek ishlayveradi.
   */
  const { data: summaries = [] } = useQuery({
    queryKey: ['chat-summaries'],
    enabled: !!myId,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
    queryFn: getChatSummaries,
  });

  /*
   * Notanish suhbatdoshlarning ismi — `GET /users/{id}`.
   *
   * Bu ruchka backendda ancha oldindan bor edi, lekin HECH QAYERDAN
   * chaqirilmasdi. U bronda yo'q suhbatdoshning ismini beradi, ya'ni
   * safar tugagandan keyin ham yozishma nomsiz qolmaydi.
   *
   * Faqat NOTANISHLAR uchun so'raladi (odatda 0-2 ta) va xato yutiladi:
   * ism topilmasa suhbat baribir ko'rsatiladi.
   */
  const unknownIds = React.useMemo(() => {
    const known = new Set(
      (Array.isArray(conversationsData) ? conversationsData : []).map((c) => c.peerId)
    );
    return summaries.map((s) => s.partner_id).filter((id): id is string => !!id && !known.has(id));
  }, [conversationsData, summaries]);

  const { data: peerNames = {} } = useQuery<Record<string, { name: string; avatar?: string }>>({
    queryKey: ['chat-peer-names', unknownIds.join(',')],
    enabled: unknownIds.length > 0,
    queryFn: async () => {
      const out: Record<string, { name: string; avatar?: string }> = {};
      await Promise.all(
        unknownIds.map(async (id) => {
          try {
            const u = await getUser(id);
            /*
             * Ism ikki shaklda kelishi mumkin: `/users/{id}` odatda
             * `first_name`/`last_name` beradi, ba'zi javoblar esa
             * `name`/`display_name`. Ikkalasi ham o'qiladi — bittasiga
             * tayanib qolsak, ism yo'q bo'lib chiqishi mumkin edi.
             */
            const flat = [u?.first_name, u?.last_name].filter(Boolean).join(' ');
            const name = personName(u as Parameters<typeof personName>[0], flat);
            /*
             * Yozuv ISM BO'LMASA HAM saqlanadi: ilgari `if (name)` sharti
             * tufayli ismsiz suhbatdoshning avatari ham
             * tashlab yuborilardi. Ism bo'sh bo'lsa quyida "Suhbatdosh"
             * zaxirasi ishlaydi, halqa esa joyida qoladi.
             */
            out[id] = {
              name: name ?? '',
              avatar: u?.avatar_url ?? undefined,
            };
          } catch {
            /* ism topilmasa suhbat baribir ko'rsatiladi */
          }
        })
      );
      return out;
    },
  });

  /**
   * Oxirgi xabar MENIKIMI — "Siz:" prefiksi uchun.
   *
   * `myId` profildan keladi (yuqorida). Bo'sh bo'lsa `false` qaytadi —
   * prefiks shunchaki chiqmaydi, ya'ni noto'g'ri "Siz:" YOZILMAYDI.
   */
  const isMine = React.useCallback(
    (senderId?: string) => !!myId && !!senderId && String(senderId) === myId,
    [myId]
  );

  const chats: Conversation[] = React.useMemo(() => {
    const raw = Array.isArray(conversationsData) ? conversationsData : [];
    const byPeer = new Map<string, Conversation>();
    for (const c of raw) {
      if (!c.peerId) continue;
      const key = c.peerId;
      const prev = byPeer.get(key);
      if (!prev || String(c.last_at ?? '') > String(prev.last_at ?? '')) {
        byPeer.set(key, c);
      }
    }

    const byPartner = new Map(summaries.filter((s) => s.partner_id).map((s) => [s.partner_id, s]));
    const merged = [...byPeer.values()].map((c) => {
      const s = byPartner.get(c.peerId);
      if (!s) return c;
      return {
        ...c,
        unread: s.unread_count ?? 0,
        last_message: s.last_message?.content ?? c.last_message,
        last_at: s.last_message?.created_at ?? c.last_at,
        mine: isMine(s.last_message?.sender_id),
      };
    });

    /*
     * 🔴 SERVER BILADIGAN, BIZ BILMAYDIGAN SUHBATLAR.
     *
     * Ro'yxat BRONLARDAN yig'iladi, ya'ni safar tugab bron ro'yxatdan
     * chiqib ketsa yozishma ham G'OYIB bo'lardi — tarix serverda tursa
     * ham. Odam uchun bu "chatim yo'qoldi" degani.
     *
     * `GET /notifications/chats` esa HAMMA suhbatni biladi. Ism/avatar
     * u yerda yo'q, shuning uchun notanish suhbatdoshlar `peerNames`
     * so'rovi bilan to'ldiriladi (faqat notanishlar uchun).
     */
    for (const s of summaries) {
      if (!s.partner_id || byPeer.has(s.partner_id)) continue;
      merged.push({
        // Safar noma'lum — yuborishda kontekst, bo'sh bo'lsa ham server oladi.
        rideId: '',
        peerId: s.partner_id,
        other_name: peerNames[s.partner_id]?.name ?? '',
        avatar: peerNames[s.partner_id]?.avatar,
        last_message: s.last_message?.content ?? '',
        last_at: s.last_message?.created_at ?? '',
        unread: s.unread_count ?? 0,
        mine: isMine(s.last_message?.sender_id),
      });
    }

    // Eng so'nggi yozishma TEPADA (Telegramdagidek). Sanasizlar pastda.
    return merged.sort((a, b) => String(b.last_at ?? '').localeCompare(String(a.last_at ?? '')));
  }, [conversationsData, summaries, peerNames, isMine]);

  return (
    <div className="flex-1 bg-surface pb-24 select-none">
      <div className="bg-surface sticky top-0 z-10 px-4 py-4 border-b border-border shadow-sm flex items-center justify-between">
        <h1 className="text-2xl font-display font-black text-foreground tracking-tight">
          {tr('Chatlar', 'Чаты', 'Chats')}
        </h1>
        <div className="p-2 bg-brand-pink-light dark:bg-accent/10 rounded-full text-accent">
          <MessageCircle className="w-5 h-5 fill-current opacity-20" />
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {/* Profil hali kelmagan (query disabled) paytda ham loader — "chat yo'q" flash bo'lmasin. */}
        {isLoading || !myId ? (
          /* Matn o'rniga skelet: kelayotgan ro'yxatning SHAKLINI ko'rsatadi, shuning
             uchun ma'lumot kelganda sahifa sakramaydi va kutish qisqaroq tuyuladi. */
          <div className="divide-y divide-border" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            {tr("Hozircha chatlar yo'q.", 'Пока нет чатов.', 'No chats yet.')}
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={`${chat.rideId}:${chat.peerId}`}
              onClick={() =>
                router.push(
                  /*
                   * 🔴 `direct` — safarsiz suhbat uchun. Yo'l `[id]` bo'lgani
                   * uchun bo'sh segment 404 beradi: `/uz/chat/?peer=…` degan
                   * manzil umuman ochilmaydi. Chat baribir ODAM bo'yicha
                   * ishlaydi (`ride_id` tarixda so'ralmaydi), shuning uchun
                   * bu yerda safar id'si shart emas.
                   */
                  `/${locale}/chat/${chat.rideId || 'direct'}?peer=${chat.peerId}&name=${encodeURIComponent(
                    chat.other_name || ''
                  )}${chat.avatar ? `&avatar=${encodeURIComponent(chat.avatar)}` : ''}`
                )
              }
              className="flex items-center gap-4 p-4 hover:bg-surface-hover cursor-pointer transition-colors"
            >
              {/*
                🔴 Ilgari bu yerda faqat ismning BOSH HARFI turardi — surat
                qo'yilgan bo'lsa ham ko'rinmasdi (egasi, 2026-08-16).
                `Avatar` surat bo'lsa suratni, bo'lmasa o'sha bosh harfni
                ko'rsatadi, ya'ni eski ko'rinish zaxira sifatida qoladi.
              */}
              <div className="relative shrink-0">
                <Avatar src={chat.avatar} name={chat.other_name} size={56} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h2 data-user-text className="text-base font-extrabold text-text truncate pr-2">
                    {/* Ism topilmasa ham suhbat KO'RSATILADI — yozishma
                        yo'qolgandan ko'ra nomsiz turgani yaxshi. */}
                    {chat.other_name || tr('Suhbatdosh', 'Собеседник', 'Chat partner')}
                  </h2>
                  <span
                    className={`text-xs whitespace-nowrap font-bold ${
                      chat.unread ? 'text-accent' : 'text-text-muted'
                    }`}
                  >
                    {formatTripTime(chat.last_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <p
                    className={`text-sm truncate ${
                      chat.unread ? 'font-bold text-text' : 'font-medium text-text-muted'
                    }`}
                  >
                    {chat.last_message ? (
                      <>
                        {/* "Siz:" — prefiks kulrang, xabar matni esa o'z
                            rangida qoladi, ya'ni ko'z avval MATNNI o'qiydi. */}
                        {chat.mine && (
                          <span className="font-medium text-text-muted">
                            {tr('Siz: ', 'Вы: ', 'You: ')}
                          </span>
                        )}
                        {chat.last_message}
                      </>
                    ) : (
                      tr('Suhbat boshlandi', 'Беседа начата', 'Conversation started')
                    )}
                  </p>
                  {/*
                    O'qilmaganlar soni — Telegramdagidek yumaloq nishon.
                    99 dan oshsa "99+": uch xonali son ismga joy qoldirmaydi.
                    Soni yo'q bo'lsa eski "yetkazildi" belgisi qoladi.
                  */}
                  {chat.unread ? (
                    <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[0.7rem] font-extrabold text-white">
                      {chat.unread > 99 ? '99+' : chat.unread}
                    </span>
                  ) : (
                    <CheckCheck className="w-4 h-4 text-accent/60 flex-shrink-0" />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
