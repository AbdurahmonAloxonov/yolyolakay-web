'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { getMyRides, getMyBookings } from '@/shared/api/rides';
import { cacheRides, getCachedRide, mergeRide } from '@/shared/api/rideCache';
import type { RideSearchItem } from '@/shared/api/types/ride';
import { normalizeBooking } from '@/shared/lib/format';
import {
  formatCurrency,
  formatTripDateTime,
  normalizeStatus,
  personName,
} from '@/shared/lib/format';
import { hasValidCoords } from '@/shared/lib/maps';
import { RoutePreview } from '@/shared/ui/RoutePreview';
import { useUIStore } from '@/shared/model/uiStore';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Badge } from '@/shared/ui/Badge';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Button } from '@/shared/ui/Button';
import { RatingModal } from '@/shared/ui/RatingModal';
import { CancelBookingModal } from '@/shared/ui/CancelBookingModal';
import { Calendar, User, Users, ArrowRight, Compass, Star, CalendarX } from 'lucide-react';
import Link from 'next/link';
import { pickFor } from '@/shared/lib/i18n';
import { useTr } from '@/shared/lib/useTr';

// Birlashtirilgan ko'rinish (haydovchi safari yoki yo'lovchi broni).
// Safar javobidan xarita uchun koordinatalarni ajratadi.
//
// Koordinatasiz (yoki (0,0)) safar `undefined` qaytaradi — nol nuqtaga
// chizilgan chiziq xaritani okean o'rtasiga sudrab ketardi.
function routeCoords(ride: Record<string, any> | null | undefined): HistoryItem['coords'] {
  if (!ride) return undefined;
  if (!hasValidCoords(ride.origin_lat, ride.origin_lon)) return undefined;
  if (!hasValidCoords(ride.destination_lat, ride.destination_lon)) return undefined;
  return {
    from: [ride.origin_lat, ride.origin_lon],
    to: [ride.destination_lat, ride.destination_lon],
    via: ((ride.stops ?? []) as Array<{ lat: number; lon: number }>)
      .filter((st) => hasValidCoords(st.lat, st.lon))
      .map((st) => [st.lat, st.lon] as [number, number]),
  };
}

interface HistoryItem {
  id: string; // trip id (havola uchun)
  from: string;
  to: string;
  price: number;
  departureTime: string;
  driver: string;
  status: string; // safar statusi (ikkala rolda ham)
  isActive: boolean; // tab filtri uchun
  completed?: boolean; // SAFAR tugallanganmi (baholash uchun)
  href?: string; // yo'lovchi -> bidding sahifasi
  driverId?: string; // baholash uchun reviewee_id (backend majburiy qiladi)
  /**
   * BRON ID — bekor qilish uchun (`.../bookings/{booking_id}/cancel`).
   * `id` maydoni SAFAR id'si (havola uchun), ya'ni ular BOSHQA-BOSHQA narsa.
   * Faqat yo'lovchi bronlarida to'ldiriladi.
   */
  bookingId?: string;
  seats?: number;
  /**
   * HAYDOVCHI tarixi: shu safarda olib borilgan yo'lovchilar soni.
   * CEO 2026-07-30 (F4): tarixda kimlarni olib borgani ko'rinsin, LEKIN
   * ularning ma'lumotlari ochilmasin — shuning uchun bu yerda faqat SON va
   * bosh harflar, ism/telefon YO'Q.
   */
  passengerCount?: number;
  /**
   * SAFAR YO'LI xaritada (16.09.2026, egasi: «karta to'liq ishlatilsin»).
   *
   * 🔴 Tarixda safar haqida faqat IKKI NOM va sana turardi. Odam
   * «qaysi yo'ldan borgandik?» degan savolga javob topa olmasdi,
   * holbuki koordinatalar javobda ALLAQACHON kelardi va shunchaki
   * tashlab yuborilardi.
   *
   * Koordinata kelmasa `undefined` — karta umuman chizilmaydi
   * (`RoutePreview` o'zi tekshiradi).
   */
  coords?: {
    from: [number, number];
    to: [number, number];
    via: [number, number][];
  };
  passengerInitials?: string[];
}

// Trip va booking statuslari uchun yagona o'qiladigan yorliq (case-insensitive).
const statusLabel = (status: string, locale: string): string => {
  const map: Record<string, [string, string, string]> = {
    CREATED: ['Faol', 'Активна', 'Active'],
    IN_PROGRESS: ["Yo'lda", 'В пути', 'On the way'],
    COMPLETED: ['Tugallandi', 'Завершена', 'Completed'],
    CANCELLED: ['Bekor qilindi', 'Отменена', 'Cancelled'],
    PENDING: ['Kutilmoqda', 'Ожидает', 'Pending'],
    PENDING_NEGOTIATION: [
      'Narxga javob kutilmoqda',
      'Ожидает ответа на цену',
      'Awaiting price reply',
    ],
    COUNTER_OFFERED: ['Yangi narx', 'Новая цена', 'New price'],
    ACCEPTED: ['Qabul qilindi', 'Принята', 'Accepted'],
    REJECTED: ['Rad etildi', 'Отклонена', 'Declined'],
  };
  const row = map[String(status || '').toUpperCase()];
  return row ? pickFor(locale)(row[0], row[1], row[2]) : status;
};

export default function HistoryPage() {
  const t = useTranslations('Trips');
  const locale = useLocale();
  const activeRole = useUIStore((s) => s.activeRole);

  const tr = useTr();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  // Baholash oynasi ochiq bo'lgan tugallangan safar (yo'lovchi -> haydovchini baholaydi).
  const [rateItem, setRateItem] = useState<HistoryItem | null>(null);
  const [cancelItem, setCancelItem] = useState<HistoryItem | null>(null);
  // Haydovchi tarixida karta bosilganda ochiladigan detal (CEO 2026-07-30, F4).
  // Yo'lovchida karta bidding sahifasiga HAVOLA, shuning uchun bu faqat haydovchida.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Rolga qarab manba (jonli shakllar 2026-07-18):
  //   HAYDOVCHI -> GET /rides/my?role=driver {rides:[...]} — safarlar to'liq.
  //   YO'LOVCHI -> GET /rides/my?role=passenger {bookings:[...]} — FAQAT bronlar
  //   (safar detali YO'Q!) — marshrut matni qidiruv keshidan (rideCache) to'ldiriladi.
  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<HistoryItem[]>({
    queryKey: ['history', activeRole],
    /*
     * Yengil polling: haydovchi safarni boshlaganda/yakunlaganda yoki bron holati
     * o'zgarganda odam sahifani QO'LDA yangilamasdan ko'rsin. Ilgari bu ro'yxat
     * umuman yangilanmasdi va eski holatda qotib qolardi.
     * Fon tabda o'chiq — backend har chaqiruvda ~0.7 s turadi, ortiqcha yuk bermaymiz.
     */
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      {
        if (activeRole === 'driver') {
          const raw = await getMyRides('driver');
          cacheRides(raw);
          return raw.map((tr): HistoryItem => {
            const status = normalizeStatus(tr.status || 'ACTIVE');

            // Haqiqatan olib borilgan yo'lovchilar = tasdiqlangan bronlar.
            // ATAYIN faqat bosh harf olinadi: to'liq ism ham shaxsiy ma'lumot.
            // DIQQAT: bu KO'RSATMASLIK, himoya EMAS — to'liq ism baribir tarmoq
            // javobida keladi va DevTools'da ko'rinadi. Backenddan uni javobda
            // maskalash so'ralgan (BACKEND_XAT_UI_TALABLAR_2026-07-30.md §6b).
            // normalizeBooking SHART: gateway bronni PascalCase beradi (`Status`) —
            // to'g'ridan `b.status` o'qilsa doim undefined bo'lib, yo'lovchilar soni
            // har safar 0 chiqadi (dashboard'dagi belgida shu bug tasdiqlangan).
            const accepted = (tr.bookings ?? []).filter(
              (b) => normalizeBooking(b as Record<string, any>).status === 'ACCEPTED'
            );
            const initials = accepted
              .map((b) => {
                const raw = b as Record<string, any>;
                const n = personName(raw.passenger, raw.passenger_name).trim();
                return n ? `${n[0].toUpperCase()}.` : '';
              })
              .filter(Boolean);

            return {
              id: String(tr.id),
              from: tr.origin_address || '—',
              to: tr.destination_address || '—',
              price: tr.price_per_seat ?? 0,
              departureTime: tr.departure_time || '',
              driver: personName(tr.driver),
              status,
              isActive: status === 'CREATED' || status === 'ACTIVE' || status === 'IN_PROGRESS',
              completed: status === 'COMPLETED',
              passengerCount: accepted.length,
              passengerInitials: initials,
              coords: routeCoords(tr as unknown as Record<string, any>),
            };
          });
        }

        const rawBookings = await getMyBookings();
        const now = Date.now();
        return rawBookings.map((rb): HistoryItem => {
          const b = normalizeBooking(rb) as Record<string, any>;
          const rideId = String(b.trip_id ?? '');
          // Safar detali: bronга EMBEDDED ride (backend v6 §4 — deploy bo'lgach keladi),
          // bo'lmasa qidiruv keshi.
          // Bronga embedded safar USTUN, lekin unda bo'lmagan maydonlar (ko'pincha
          // `driver`) qidiruv keshidan to'ldiriladi. Ilgari bu `??` edi: embedded
          // safar kelsa kesh UMUMAN qaralmasdi, ya'ni haydovchisiz javob kelganda
          // ism ham, "Haydovchini baholash" tugmasi ham yo'qolardi.
          const cached = b.ride
            ? (mergeRide(
                b.ride as unknown as RideSearchItem,
                getCachedRide(rideId)
              ) as unknown as Record<string, any>)
            : (getCachedRide(rideId) as Record<string, any> | null);
          const bookingStatus = String(b.status ?? '');
          const cachedRaw = cached as Record<string, any> | null;
          // Baholash sharti: bron qabul qilingan VA safar yakunlangan — embedded/kesh
          // statusi COMPLETED bo'lsa yoki jo'nash vaqti o'tgan bo'lsa.
          const depMs = cached?.departure_time ? new Date(cached.departure_time).getTime() : NaN;
          const rideDone =
            normalizeStatus(cached?.status) === 'COMPLETED' ||
            (!Number.isNaN(depMs) && depMs < now);
          /*
           * 🔴 SAFAR BEKOR QILINGANI BRON HOLATIDA KO'RINMAYDI (egasi,
           * 2026-08-16: "haydovchi safarni bekor qilsa yo'lovchi bilmay
           * ishonib qolib ketadi").
           *
           * Haydovchi safarni bekor qilganda bron `ACCEPTED` bo'lib
           * QOLAVERADI — ro'yxatda yashil "Qabul qilindi" turardi va odam
           * safar bo'lishiga ishonardi. Safar holati esa embedded/keshda
           * bor (`rideDone` uni allaqachon o'qiydi), faqat ishlatilmasdi.
           */
          const rideCancelled = normalizeStatus(cached?.status) === 'CANCELLED';
          return {
            id: rideId || String(b.ID),
            from: cached?.origin_address || '—',
            to: cached?.destination_address || '—',
            // `||` ATAYIN: offered_price 0 (backend OfferedPrice:null holati) bo'lsa
            // keshdagi haqiqiy narxga o'tamiz — `??` 0 ni "bor" deb qoldirardi.
            price: Number(b.offered_price || cached?.price_per_seat || 0),
            departureTime: cached?.departure_time || String(b.CreatedAt ?? ''),
            driver: personName(cached?.driver),
            // Odatda BRON statusi ko'rsatiladi, lekin safar bekor qilingan
            // bo'lsa AYNAN SHU haqiqat ustun — bron "qabul qilingan" bo'lsa ham.
            status: rideCancelled ? 'CANCELLED' : bookingStatus,
            isActive:
              !rideCancelled &&
              (bookingStatus === 'PENDING' ||
                bookingStatus === 'PENDING_NEGOTIATION' ||
                bookingStatus === 'ACCEPTED') &&
              !rideDone,
            completed: !rideCancelled && bookingStatus === 'ACCEPTED' && rideDone,
            href: rideId ? `/${locale}/bidding/${rideId}` : undefined,
            // driver.id — backend v6 §3 (DriverProfile'ga qo'shildi); eski zanjirlar zaxira.
            driverId: cachedRaw?.driver?.id || cachedRaw?.driver_id || cachedRaw?.driver?.user_id,
            bookingId: String(b.ID ?? ''),
            seats: Number(b.seats ?? 1) || 1,
            coords: routeCoords(cached),
          };
        });
      }
    },
  });

  const trips = items.filter((it) => (activeTab === 'active' ? it.isActive : !it.isActive));

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8 select-none">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Заголовок страницы */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-black text-foreground tracking-tight sm:text-3xl">
              {t('historyTitle')}
            </h1>
            <p className="text-sm text-text-muted">
              {tr(
                'Barcha tugallangan va faol hamrohlik safarlari tarixi',
                'Список всех ваших совместных и активных поездок',
                'All your active and completed shared rides'
              )}
            </p>
          </div>
        </div>

        {/* Табы */}
        <div className="flex bg-surface p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
              activeTab === 'active'
                ? 'bg-bg text-accent shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {tr('Faol safarlar', 'Активные', 'Active')}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
              activeTab === 'history'
                ? 'bg-bg text-accent shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {tr('Tarix', 'История', 'History')}
          </button>
        </div>

        {/* Список истории */}
        <div className="space-y-4">
          {isLoading ? (
            /* Kartochkalar SHAKLIDAGI skelet — matnli "Yuklanmoqda..." o'rniga.
               Ma'lumot kelganda joylashuv o'zgarmaydi, ya'ni sahifa sakramaydi. */
            <div className="space-y-4" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              ))}
            </div>
          ) : isError ? (
            /* Ro'yxat YUKLANMADI. Ilgari xato `catch` ichida yutilar va bo'sh massiv
               qaytarilardi — ekran "safarlaringiz yo'q" deb ko'rsatardi. Odam bronlari
               bekor bo'lgan deb o'ylardi. Endi ochiq aytamiz. */
            <div className="rounded-2xl border border-border bg-surface p-8 text-center space-y-4 shadow-sm">
              <p className="text-sm font-semibold">
                {tr(
                  "Ro'yxat yuklanmadi",
                  'Не удалось загрузить список',
                  "Couldn't load your trips"
                )}
              </p>
              <p className="text-sm text-text-muted">
                {tr(
                  'Safarlaringiz joyida — bu vaqtinchalik uzilish.',
                  'Ваши поездки на месте — это временный сбой.',
                  'Your trips are safe — this is a temporary glitch.'
                )}
              </p>
              <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching
                  ? tr('Yuklanmoqda…', 'Загрузка…', 'Loading…')
                  : tr('Qayta urinish', 'Повторить', 'Try again')}
              </Button>
            </div>
          ) : trips.length === 0 ? (
            // Bo'sh holat — sayt bo'ylab YAGONA shakl (`EmptyState`).
            // 🔴 Bu yerda 40 qatorlik O'Z SVG illyustratsiyasi turardi:
            // boshqa hech qayerda uchramaydigan, ilovaga ham, landingga
            // ham o'xshamaydigan chizma. Har sahifaning o'z rasmi
            // bo'lishi — «tartib yo'q» ning aynan o'zi.
            <EmptyState
              className="mo-in rounded-2xl border border-border bg-surface shadow-sm"
              icon={<Compass />}
              title={tr("Hozircha safarlar yo'q", 'В добрый путь!', 'No trips yet')}
              description={tr(
                "Siz hali hamrohlik safarlarini amalga oshirmadingiz. Toshkent-Samarkand yoki boshqa yo'nalishlarda birinchi sayohatingizni boshlang!",
                'У вас пока нет запланированных или завершенных поездок. Найдите водителя прямо сейчас и делите дорожные расходы.',
                'You have not taken any shared rides yet. Start your first trip — Tashkent–Samarkand or any other route!'
              )}
              action={
                <Link href={`/${locale}/search`}>
                  <Button className="flex min-h-[48px] items-center justify-center gap-2">
                    <Compass className="h-4.5 w-4.5" />
                    <span>{tr('Safar qidirish', 'Найти попутчиков', 'Find a ride')}</span>
                  </Button>
                </Link>
              }
            />
          ) : (
            trips.map((trip, i) => {
              const variant =
                trip.status === 'COMPLETED' || trip.status === 'ACCEPTED'
                  ? 'success'
                  : trip.status === 'CANCELLED' || trip.status === 'REJECTED'
                    ? 'error'
                    : 'primary';
              const card = (
                <div className="mo-lift rounded-2xl border border-border bg-surface p-5 shadow-sm flex items-center justify-between gap-4 transition-[transform,border-color] duration-200 hover:border-accent">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-text">{trip.from || '—'}</span>
                      <ArrowRight className="h-4 w-4 text-accent" />
                      <span className="text-base font-extrabold text-text">{trip.to || '—'}</span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-accent" />
                        {formatTripDateTime(trip.departureTime) || '—'}
                      </span>
                      {trip.driver && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-accent" />
                          {trip.driver}
                        </span>
                      )}

                      {/* Haydovchi tarixi: kimlarni olib borgani — SON va bosh
                          harflar bilan. To'liq ism/telefon ATAYIN ko'rsatilmaydi
                          (CEO F4). */}
                      {activeRole === 'driver' && (trip.passengerCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-accent" />
                          {trip.passengerCount} {tr("yo'lovchi", 'пасс.', 'pass.')}
                          {trip.passengerInitials && trip.passengerInitials.length > 0 && (
                            <span className="text-text-muted">
                              ({trip.passengerInitials.join(' ')})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right space-y-2">
                    <span className="text-base font-extrabold text-text block">
                      {trip.price > 0 ? formatCurrency(trip.price, locale) : '—'}
                    </span>
                    <Badge variant={variant}>{statusLabel(trip.status, locale)}</Badge>
                  </div>
                </div>
              );
              // Yo'lovchi qabul qilingan (ACCEPTED) va safar tugallangan bo'lsa — haydovchini baholaydi.
              const canRate = !!trip.href && trip.completed && trip.status === 'ACCEPTED';
              /*
               * BEKOR QILISH — faqat YO'LOVCHI o'z TIRIK bronida.
               *
               * `isActive` allaqachon to'g'ri shartni tutadi: bron
               * kutilmoqda/savdolashishda/qabul qilingan, safar bekor
               * qilinmagan va jo'nash vaqti o'tmagan. Shu yerda yana bir
               * marta yozsak, ikki manba paydo bo'lardi.
               */
              const canCancel =
                activeRole !== 'driver' && trip.isActive && !!trip.bookingId && !!trip.id;
              return (
                <div
                  key={trip.id}
                  style={{ '--i': Math.min(i, 8) } as React.CSSProperties}
                  className="mo-stagger-item space-y-2"
                >
                  {trip.href ? (
                    <Link href={trip.href} className="block">
                      {card}
                    </Link>
                  ) : activeRole === 'driver' ? (
                    // Haydovchi: karta bosilganda safar detali ochiladi.
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === trip.id ? null : trip.id)}
                      aria-expanded={expandedId === trip.id}
                      className="block w-full text-left"
                    >
                      {card}
                    </button>
                  ) : (
                    card
                  )}

                  {activeRole === 'driver' && expandedId === trip.id && (
                    <div className="rounded-2xl border border-border bg-surface/60 p-5 space-y-4">
                      {/* SAFAR YO'LI — 16.09.2026.

                          🔴 Tarixda faqat ikki nom va sana turardi;
                          «qaysi yo'ldan borgandik, qayerda to'xtagandik?»
                          degan savol javobsiz qolardi. Koordinatalar
                          javobda ALLAQACHON kelardi va tashlab
                          yuborilardi.

                          Faqat karta YOYILGANDA chiziladi — yopiq
                          ro'yxatda o'nlab xarita yuklanmaydi. */}
                      {trip.coords && (
                        <RoutePreview
                          from={trip.coords.from}
                          to={trip.coords.to}
                          via={trip.coords.via}
                          height={160}
                        />
                      )}
                      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        {[
                          [tr("Yo'nalish", 'Маршрут', 'Route'), `${trip.from} → ${trip.to}`],
                          [
                            tr('Sana', 'Дата', 'Date'),
                            formatTripDateTime(trip.departureTime) || '—',
                          ],
                          [
                            tr('Narx', 'Цена', 'Price'),
                            trip.price > 0 ? formatCurrency(trip.price, locale) : '—',
                          ],
                          [tr('Holat', 'Статус', 'Status'), statusLabel(trip.status, locale)],
                        ].map(([k, v]) => (
                          <div key={k} className="min-w-0">
                            <dt className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                              {k}
                            </dt>
                            <dd className="truncate font-bold text-text">{v}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="border-t border-border/60 pt-4">
                        <h4 className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                          {tr(
                            "Olib borilgan yo'lovchilar",
                            'Перевезённые пассажиры',
                            'Passengers carried'
                          )}
                        </h4>
                        {(trip.passengerCount ?? 0) > 0 ? (
                          <>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(trip.passengerInitials ?? []).map((ini, i) => (
                                <span
                                  key={`${ini}-${i}`}
                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/20 bg-brand-pink-light dark:bg-accent/10 text-sm font-black text-accent"
                                  aria-hidden
                                >
                                  {ini.replace('.', '')}
                                </span>
                              ))}
                            </div>
                            {/* CEO F4: tarixda yo'lovchi MA'LUMOTLARI ochilmaydi —
                                shuning uchun bu yerda ism ham, telefon ham, profil
                                havolasi ham YO'Q. Faqat son va bosh harf. */}
                            <p className="mt-3 text-xs text-text-muted">
                              {tr(
                                `${trip.passengerCount} ta yo'lovchi. Tugallangan safarlarda yo'lovchi ma'lumotlari ko'rsatilmaydi.`,
                                `${trip.passengerCount} пассажир(ов). В завершённых поездках данные пассажиров не показываются.`,
                                `${trip.passengerCount} passenger(s). Passenger details are hidden for completed trips.`
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-xs text-text-muted">
                            {tr(
                              "Bu safarda tasdiqlangan yo'lovchi bo'lmagan.",
                              'В этой поездке не было подтверждённых пассажиров.',
                              'There were no confirmed passengers on this trip.'
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setCancelItem(trip)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-bold text-text-muted transition-colors hover:border-error hover:text-error"
                    >
                      <CalendarX className="h-4 w-4" />
                      {tr('Bronni bekor qilish', 'Отменить бронь', 'Cancel booking')}
                    </button>
                  )}
                  {canRate && (
                    <button
                      type="button"
                      onClick={() => setRateItem(trip)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-turquoise/50 py-2.5 text-sm font-bold text-wine-ash transition-colors hover:bg-turquoise-light dark:text-turquoise dark:hover:bg-turquoise/10"
                    >
                      <Star className="h-4 w-4 text-warning" fill="var(--warning)" />
                      {tr('Haydovchini baholash', 'Оценить водителя', 'Rate the driver')}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bronni bekor qilish oynasi */}
      <CancelBookingModal
        isOpen={!!cancelItem}
        onClose={() => setCancelItem(null)}
        rideId={cancelItem?.id || ''}
        bookingId={cancelItem?.bookingId || ''}
        seats={cancelItem?.seats}
      />

      {/* Baholash oynasi */}
      <RatingModal
        isOpen={!!rateItem}
        onClose={() => setRateItem(null)}
        tripId={rateItem?.id || ''}
        revieweeId={rateItem?.driverId}
        revieweeName={rateItem?.driver}
      />
    </div>
  );
}
