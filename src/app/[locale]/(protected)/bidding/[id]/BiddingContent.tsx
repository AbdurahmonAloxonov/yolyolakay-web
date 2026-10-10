'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/entities/user/api/useProfile';
import { useUIStore } from '@/shared/model/uiStore';
import {
  getMyRides,
  getMyBookings,
  getRide,
  bookRide,
  acceptBooking,
  rejectBooking,
  counterOffer,
} from '@/shared/api/rides';
import { getCachedRide, cacheRides } from '@/shared/api/rideCache';
import type { MyRide } from '@/shared/api/types/ride';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { BookingProgress } from '@/shared/ui/BookingProgress';
import { PickupCard } from '@/shared/ui/PickupCard';
import { shareTripWatch } from '@/shared/lib/shareRide';
import { getEta } from '@/shared/api/telematics';
import { buildIcs, downloadIcs } from '@/shared/lib/placeLinks';
import { haversineKm } from '@/shared/lib/geo';
import { hasValidCoords } from '@/shared/lib/maps';
import { useVehicle } from '@/entities/ride/api/useVehicle';
import { normalizeVehicle } from '@/shared/api/vehicles';
import { Input } from '@/shared/ui/Input';
import { Counter } from '@/shared/ui/Counter';
import { Switch } from '@/shared/ui/Switch';
import {
  bookingStatusLabel,
  formatCurrency,
  formatTripDateTime,
  isTripOpen,
  normalizeBooking,
  normalizeStatus,
  tripStatusLabel,
  isBookingSettled,
} from '@/shared/lib/format';
import {
  Users,
  CheckCircle2,
  MapPin,
  User,
  Share2,
  ShieldCheck,
  Clock,
  CalendarPlus,
  CalendarX2,
  Inbox,
} from 'lucide-react';
import { RatingBadge } from '@/shared/ui/StarRating';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { shareOrCopy } from '@/shared/lib/share';
import { SosButton } from '@/shared/ui/SosButton';
import { PassengerTrust } from '@/shared/ui/PassengerTrust';
import { SeatMap } from '@/shared/ui/SeatMap';
import { Avatar } from '@/shared/ui/Avatar';
import { ContactRow } from '@/shared/ui/ContactRow';
import { useTr } from '@/shared/lib/useTr';
import { AnalyticsEvent, logEvent } from '@/shared/lib/analytics';

/**
 * Savdolashish — haydovchi O'Z narxini qaytaradi.
 *
 * ✅ 2026-08-13 YOQILDI. Kontrakt biz taklif qilgan shaklda backendga
 * QO'SHILGAN (jonli swaggerda tekshirildi):
 *   POST /rides/{id}/bookings/{booking_id}/counter  {new_price}
 *
 * Ilgari bu funksiya to'liq yozilgan-u, `NEXT_PUBLIC_COUNTER_OFFER=1`
 * bo'lmagani uchun ekranda KO'RINMASDI — endpoint hali yo'q edi va tugma
 * 404 ga olib borardi. Endi standart holat — YOQILGAN; kerak bo'lsa
 * `NEXT_PUBLIC_COUNTER_OFFER=0` bilan o'chiriladi (masalan backend uni
 * qaytarib olsa).
 */
const COUNTER_OFFER_ENABLED = process.env.NEXT_PUBLIC_COUNTER_OFFER !== '0';

// Safar ko'rinishi — MyRide (RideSearchItem) ustiga UI normallashuvi.
// ⚠ Gateway'da GET /rides/{id} va GET /rides/{id}/bookings YO'Q (xat v5 №5) — manba:
//   o'z safarlarim (/rides/my, bookings[] shu yerda) yoki qidiruv keshi (rideCache).
interface BiddingTrip extends MyRide {
  base_price?: number;
  driver_id?: string;
  is_negotiable?: boolean;
}

// normalizeBooking'dan keyingi shakl (camelCase -> snake_case, CONFIRMED -> ACCEPTED).
interface BookingRow {
  ID: string;
  trip_id?: number | string;
  passenger_id?: string;
  status: string; // PENDING | ACCEPTED | REJECTED | CANCELLED
  offered_price?: number;
  seats?: number;
  passenger_name?: string;
  // `phone_number` — jonli swaggerdagi nom (2026-08-16); `phone` zaxira.
  passenger?: {
    name?: string;
    display_name?: string;
    rating?: number;
    phone?: string;
    phone_number?: string;
    // ✅ 2026-08-27: backend `PassengerProfile` ga qo'shdi — endi bu
    // ma'lumot bronning O'ZIDA keladi va `GET /users/{id}` kerak emas.
    kyc_status?: string;
    created_at?: string;
  };
}

// Yo'lovchi arizasi bosqichlari: Yuborildi -> Qabul qilindi -> Yo'lda -> Tugallandi.
// Rad etilgan/bekor qilingan bo'lsa alohida holat ko'rsatiladi.
const BookingTimeline: React.FC<{ bookingStatus: string; tripStatus: string }> = ({
  bookingStatus,
  tripStatus,
}) => {
  const tr = useTr();
  if (bookingStatus === 'REJECTED' || bookingStatus === 'CANCELLED') {
    return (
      <div className="rounded-xl bg-error/10 border border-error/20 px-3 py-2 text-xs font-bold text-error text-center">
        {bookingStatus === 'REJECTED'
          ? tr('Ariza rad etildi', 'Заявка отклонена', 'Request declined')
          : tr('Ariza bekor qilindi', 'Заявка отменена', 'Request cancelled')}
      </div>
    );
  }
  const steps = [
    tr('Yuborildi', 'Отправлено', 'Sent'),
    tr('Qabul qilindi', 'Принято', 'Accepted'),
    tr("Yo'lda", 'В пути', 'On the way'),
    tr('Tugallandi', 'Завершено', 'Completed'),
  ];
  let active = 0;
  if (bookingStatus === 'ACCEPTED') active = 1;
  if (tripStatus === 'IN_PROGRESS') active = 2;
  if (tripStatus === 'COMPLETED') active = 3;
  return (
    <div className="flex items-start">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1 w-16">
            <div
              className={`h-3 w-3 rounded-full ${i <= active ? 'bg-accent' : 'bg-border'} ${
                i === active ? 'ring-4 ring-accent/20' : ''
              }`}
            />
            <span
              className={`text-[10px] font-bold text-center leading-tight ${
                i <= active ? 'text-accent' : 'text-text-muted'
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mt-1.5 ${i < active ? 'bg-accent' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export const BiddingContent: React.FC<{ tripId: string }> = ({ tripId }) => {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { activeRole } = useUIStore();
  const tr = useTr();
  const [isBuyout, setIsBuyout] = React.useState(false);
  /**
   * Yo'lovchi band qiladigan o'rinlar soni (butun salon bo'lmasa).
   *
   * 🔴 Boshlang'ich qiymat QIDIRUVDAN keladi (`?seats=`). Ilgari doim 1 edi:
   * "2 kishiga" deb qidirgan odam bu sahifada 1 joylik narx ko'rib, haydovchiga
   * 1 kishilik so'rov yuborardi — xato faqat safar kuni ma'lum bo'lardi.
   * Bo'sh joy soni keyinroq (safar yuklangach) tekshiriladi.
   */
  const [seatCount, setSeatCount] = React.useState(() => {
    const wanted = Number(searchParams.get('seats'));
    return Number.isFinite(wanted) && wanted >= 1 && wanted <= 6 ? wanted : 1;
  });
  // Yo'lovchi taklif qiladigan narx (savdolashish). Trip yuklanganda base_price bilan to'ldiriladi.
  const [offerPrice, setOfferPrice] = React.useState(0);

  // BITTA so'rov to'plami: safar + rol + bronlar. GET /rides/{id} va /rides/{id}/bookings
  // gateway'da YO'Q — hammasi /rides/my (bronlar shu javob ichida, camelCase) yoki
  // qidiruv keshidan (rideCache) keladi.
  const {
    data: bundle,
    isLoading: tripLoading,
    isError: tripError,
    refetch: refetchTrip,
    isFetched: myBookingsFetched,
  } = useQuery<{
    trip: BiddingTrip | null;
    role: 'driver' | 'passenger';
    bookings: BookingRow[];
    /** Jonli so'rov yiqilib, eski keshdan ko'rsatilyaptimi (holat noto'g'ri bo'lishi mumkin). */
    staleSource?: boolean;
  }>({
    queryKey: ['trip-bidding', tripId],
    // POLLING = asosiy yangilanish mexanizmi. Bidding eventlari (NEW_BOOKING / COUNTER_OFFER)
    // Centrifugo orqali yuboriladi, u hozir DEPLOY QILINMAGAN — WS'dan frontendga YETIB KELMAYDI
    // (backend docs/FRONTEND_INTEGRATION_UZ.md §7.2). NotificationsListener'ning WS invalidatsiyasi
    // ishlasa bonus, lekin unga tayanmaymiz. Interval holatga qarab dinamik:
    //   - safar tugagan/bekor   -> polling TO'XTAYDI (ortiqcha so'rov yo'q)
    //   - faol savdolashish bor -> 4s  (javob kutilyapti — tez ko'rinishi kerak)
    //   - aks holda             -> 10s
    refetchInterval: (query) => {
      const data = query.state.data;
      const status = String(data?.trip?.status || '').toUpperCase();
      if (status === 'COMPLETED' || status === 'CANCELLED') return false;
      const activeNegotiation = (data?.bookings ?? []).some((b) => {
        const s = String(b.status || '').toUpperCase();
        return s === 'PENDING' || s === 'PENDING_NEGOTIATION' || s === 'COUNTER_OFFERED';
      });
      return activeNegotiation ? 4000 : 10000;
    },
    // Tab fonда bo'lsa polling to'xtaydi (foydasiz yuk); fokusга qaytganda global
    // refetchOnWindowFocus darhol yangilaydi.
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // Jonli shakllar (2026-07-18): role=driver -> {rides:[...driver_id bilan...]};
      // role=passenger -> {bookings:[...PascalCase...]} (SAFAR EMAS!). Safar detali
      // yo'lovchi uchun faqat qidiruv keshidan (rideCache) olinadi.
      const [driverRes, bookingsRes] = await Promise.allSettled([
        getMyRides('driver'),
        getMyBookings(),
      ]);
      const driverRides = driverRes.status === 'fulfilled' ? driverRes.value : [];
      const myBookingsRaw = bookingsRes.status === 'fulfilled' ? bookingsRes.value : [];
      const mineAsDriver = driverRides.find((r) => String(r.id) === String(tripId)) ?? null;
      const myBookings = myBookingsRaw
        .map((b) => normalizeBooking(b) as BookingRow)
        .filter((b) => String(b.trip_id) === String(tripId));

      const role: 'driver' | 'passenger' = mineAsDriver ? 'driver' : 'passenger';
      /*
       * 🔴 MANBA USTUVORLIGI TESKARI EDI (CEO shikoyati 2026-08-04): yo'lovchi uchun
       * avval `rideCache` o'qilardi. Kesh — QIDIRUV PAYTIDAGI SNAPSHOT, u hech qachon
       * yangilanmaydi. Shu sabab haydovchi safarni boshlaganda ham, yakunlaganda ham
       * yo'lovchida holat "Faol" bo'lib qotib qolardi: polling har 4-10 soniyada
       * ishlaganiga qaramay, queryFn har safar O'SHA eski obyektni qaytarardi.
       *
       * Endi yangi holat manbai — `GET /rides/{id}` (2026-08-03 dan tokenli jonli).
       * Kesh va bronga biriktirilgan ride faqat ZAXIRA: so'rov yiqilsa yoki mehmon
       * bo'lsa, hech bo'lmasa eski ma'lumot ko'rinadi.
       */
      const embeddedRide = (myBookings[0] as Record<string, any> | undefined)?.ride ?? null;
      let source = mineAsDriver;
      /*
       * 🔴 Zaxiraga tushganimizni YASHIRMAYMIZ. `getRide` xatoni yutib `null`
       * qaytaradi (tarmoq, 403, 500 — farqi yo'q), shunda biz qidiruv keshiga
       * tushamiz. Kesh esa QIDIRUV PAYTIDAGI snapshot: haydovchi safarni
       * boshlagan yoki yakunlagan bo'lsa ham, u yerda holat eski bo'lib qoladi.
       *
       * Ilgari bu jimgina sodir bo'lardi va yo'lovchi noto'g'ri holatni HAQIQAT
       * deb ko'rardi. Endi bayroq qaytaramiz va ekranda ochiq aytamiz.
       */
      let staleSource = false;
      if (!source) {
        const fresh = await getRide(tripId);
        if (fresh) {
          cacheRides([fresh]);
          source = fresh;
        } else {
          source = getCachedRide(tripId) ?? embeddedRide;
          staleSource = !!source;
        }
      }

      let trip: BiddingTrip | null = null;
      if (source) {
        const raw = source as Record<string, any>;
        trip = {
          ...source,
          base_price: raw.base_price || source.price_per_seat || 0,
          status: normalizeStatus(source.status),
          driver_id: raw.driver_id || raw.driver?.user_id || raw.driver?.id,
          is_negotiable: source.is_negotiable,
        };
      } else if (myBookings.length > 0) {
        // Kesh yo'q (yangi sessiya), lekin bronim bor — minimal karta: bron holati va
        // chat baribir ishlashi kerak, marshrut matni esa keshsiz mavjud emas.
        trip = {
          id: tripId,
          status: 'ACTIVE',
          origin_address: '',
          destination_address: '',
          origin_lat: 0,
          origin_lon: 0,
          destination_lat: 0,
          destination_lon: 0,
          departure_time: '',
          total_seats: 0,
          available_seats: 0,
          price_per_seat: 0,
          base_price: 0,
        };
      }

      const bookings: BookingRow[] =
        role === 'driver'
          ? ((mineAsDriver?.bookings ?? []) as Record<string, any>[]).map(
              (b) =>
                ({
                  ...normalizeBooking(b),
                  passenger_name: b.passenger?.name || b.passenger_name,
                }) as BookingRow
            )
          : myBookings;
      return { trip, role, bookings, staleSource };
    },
  });

  const trip = bundle?.trip ?? null;
  const roleInBidding = bundle?.role ?? activeRole;

  // Marshrut nomlari — TO'G'RIDAN backend matni (reverse-geocode YO'Q).
  const routeNames = trip
    ? { from: trip.origin_address || '—', to: trip.destination_address || '—' }
    : null;

  const driverBookings: BookingRow[] = roleInBidding === 'driver' ? (bundle?.bookings ?? []) : [];

  // Yo'lovchi rejimida /rides/my?role=passenger o'z bronlarimni qaytaradi; boshqa yo'lovchi
  // broni aralashib qolgan holatga qarshi passenger_id bo'lsa o'zimnikini ajratamiz.
  const myTripBookings: BookingRow[] =
    roleInBidding === 'passenger'
      ? (bundle?.bookings ?? []).filter(
          (b) => !b.passenger_id || !profile?.id || String(b.passenger_id) === String(profile.id)
        )
      : [];
  const isActiveBookingStatus = (s: string) => s !== 'REJECTED' && s !== 'CANCELLED';
  const myBooking = myTripBookings.find((b) => isActiveBookingStatus(b.status)) ?? null;

  /*
   * Mashina — kutib olish kartasi uchun. Safar javobida `car` bo'lsa
   * o'shani olamiz, bo'lmasa `GET /vehicles/{id}` ga tushamiz (safar
   * sahifasidagi bilan bir xil qoida — ikki sxema, bir narsa).
   */
  const embeddedVehicle = normalizeVehicle(
    (trip as unknown as Record<string, unknown>)?.car ??
      (trip as unknown as Record<string, unknown>)?.vehicle
  );
  const { data: fetchedVehicle } = useVehicle(
    embeddedVehicle ? null : (trip?.vehicle_id as string | undefined)
  );
  const vehicle = embeddedVehicle ?? fetchedVehicle;

  /*
   * «Qachon yetamiz?» — safar BOSHLANGANDA (`IN_PROGRESS`).
   *
   * 🔴 Safar boshlangach yo'lovchi KO'R bo'lib qolardi: haydovchi yo'ldami,
   * qancha qoldi — yagona yo'l qo'ng'iroq qilish edi.
   *
   * ⚠️ Raqam haydovchining OXIRGI ping'iga tayanadi (ping'ni ILOVA
   * yuboradi). Haydovchi ilovani yopsa raqam eskiradi — shuning uchun
   * «taxminan» deb ko'rsatiladi. 30 soniyada bir yangilanadi: undan
   * tez-tez so'rash ETA'ni aniqroq qilmaydi.
   */
  /*
   * Uchrashuv nuqtasigacha masofa — brauzer joylashuvidan.
   *
   * 🔴 Ruxsat SO'RALMAYDI agar avval rad etilgan bo'lsa: `permissions`
   * API bilan tekshiramiz. Bu qo'shimcha ma'lumot, uning uchun tizim
   * oynasini majburan chiqarish haddan tashqari.
   */
  /*
   * UCHRASHUV NUQTASI — endi ANIQ (17.09.2026).
   *
   * Haydovchi xaritada nuqta qo'ygan bo'lsa (`pickup_lat/pickup_lon`)
   * masofa ham, «xaritada ochish» ham SHU nuqtaga ishlaydi. Ilgari
   * ikkalasi ham JO'NASH SHAHRIning markaziga ishlardi va «2 km» degan
   * yozuv aslida shahar markazigacha bo'lgan masofa edi.
   */
  const pickupLat = trip?.pickup_lat;
  const pickupLon = trip?.pickup_lon;
  const originLat = trip?.origin_lat;
  const originLon = trip?.origin_lon;
  const meetPoint = React.useMemo<[number, number] | null>(() => {
    if (hasValidCoords(pickupLat, pickupLon)) return [pickupLat as number, pickupLon as number];
    if (hasValidCoords(originLat, originLon)) return [originLat as number, originLon as number];
    return null;
  }, [pickupLat, pickupLon, originLat, originLon]);

  const [distanceToPickup, setDistanceToPickup] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!meetPoint) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (status.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            setDistanceToPickup(
              haversineKm([pos.coords.latitude, pos.coords.longitude], meetPoint)
            );
          },
          () => {
            /* joylashuv olinmadi — masofa ko'rsatilmaydi */
          }
        );
      })
      .catch(() => {
        /* `permissions` API yo'q — masofani o'tkazib yuboramiz */
      });
    return () => {
      cancelled = true;
    };
  }, [meetPoint]);

  const driverIdForEta = trip?.driver?.id ?? '';
  const { data: eta } = useQuery({
    queryKey: ['ride-eta', tripId, driverIdForEta],
    enabled:
      !!driverIdForEta &&
      normalizeStatus(trip?.status ?? '') === 'IN_PROGRESS' &&
      typeof trip?.destination_lat === 'number' &&
      typeof trip?.destination_lon === 'number',
    refetchInterval: 30_000,
    queryFn: () =>
      getEta(driverIdForEta, trip!.destination_lat as number, trip!.destination_lon as number),
  });

  /*
   * Haydovchi javob berganda YO'LOVCHIGA aytamiz.
   *
   * Holat polling orqali keladi, ya'ni ekran ochiq turganda nishon JIMGINA
   * almashardi: odam "Kutilmoqda" dan "Qabul qilindi" ga o'tganini payqamasligi
   * mumkin. Bu esa butun oqimdagi eng kutilgan lahza.
   *
   * Faqat O'TISH paytida bir marta ishlaydi (avvalgi holat eslab qolinadi) —
   * sahifa ochilganda allaqachon qabul qilingan bron uchun chiqmaydi, aks holda
   * har kirganda takrorlanardi.
   */
  // Rad etilgan bron `myBooking` dan tushib qoladi (u faqat FAOL holatlarni oladi),
  // shuning uchun holat butun ro'yxatdan olinadi — aks holda rad etish payqalmasdi.
  const latestBookingStatus = myBooking?.status ?? myTripBookings[0]?.status ?? null;
  const prevBookingStatus = React.useRef<string | null>(null);
  React.useEffect(() => {
    const now = latestBookingStatus;
    const before = prevBookingStatus.current;
    prevBookingStatus.current = now;
    if (!before || !now || before === now) return;
    if (now === 'ACCEPTED') {
      toast.success(
        tr(
          'Haydovchi arizangizni qabul qildi!',
          'Водитель принял вашу заявку!',
          'The driver accepted your request!'
        )
      );
    } else if (now === 'REJECTED') {
      toast(
        tr(
          'Haydovchi arizangizni rad etdi',
          'Водитель отклонил вашу заявку',
          'The driver declined your request'
        )
      );
    }
  }, [latestBookingStatus, tr]);

  /*
   * HAYDOVCHI SAFARNI BEKOR QILDI — yo'lovchiga darhol aytamiz.
   *
   * 🔴 Egasi (2026-08-16): "haydovchi safarni bekor qilsa yo'lovchiga xabar
   * ham kelmaydi, bilmay ishonib qolib ketadi". Bron holati bunda
   * O'ZGARMAYDI (`ACCEPTED` bo'lib qolaveradi), shuning uchun yuqoridagi
   * kuzatuvchi buni ushlay olmasdi — safar holatini alohida kuzatamiz.
   *
   * ⚠️ Bu FAQAT sahifa ochiq turgan holatni yopadi (polling orqali).
   * Ilova/sayt yopiq bo'lsa xabar push bilan kelishi kerak — u backend
   * tomonda (BACKEND_XAT_PUSH_2026-08-16, 4-trigger).
   */
  const tripStatus = normalizeStatus(trip?.status);
  const prevTripStatus = React.useRef<string | null>(null);
  React.useEffect(() => {
    const before = prevTripStatus.current;
    prevTripStatus.current = tripStatus || null;
    if (!before || !tripStatus || before === tripStatus) return;
    if (tripStatus === 'CANCELLED') {
      toast.error(
        tr(
          'Haydovchi safarni bekor qildi',
          'Водитель отменил поездку',
          'The driver cancelled the trip'
        )
      );
    }
  }, [tripStatus, tr]);

  // Faol arizasi yo'q, lekin avvalgi rad etilgan/bekor qilingan arizasi bor — formada eslatamiz.
  const lastClosedBooking = myBooking ? null : (myTripBookings[0] ?? null);

  // Female-only trip'ga erkak yo'lovchi ariza berolmaydi (backend ham tekshiradi, oldindan ogohlantiramiz).
  // 🔴 Jins cheklovi OLIB TASHLANDI (egasi, 2026-08-13): safar hammaga
  // ochiq, erkak ham ariza bera oladi.

  // Trip BIRINCHI yuklanganda taklif narxini boshlang'ich narx (base_price) bilan to'ldiramiz.
  // MUHIM: faqat bir marta (initialized ref) — ilgari `offerPrice === 0` sharti bilan bog'liq
  // edi, shu sabab foydalanuvchi maydonni tozalasa (0) effekt uni majburan qaytarib, yangi narx
  // yozib bo'lmasdi.
  // Qidiruv -> ochish -> bron zanjiri: odam qayerda to'xtab qolishini
  // faqat uchalasi birga ko'rsatadi. Bir marta, safar yuklangach.
  const openLogged = React.useRef(false);
  React.useEffect(() => {
    if (openLogged.current || !trip?.id) return;
    openLogged.current = true;
    logEvent(AnalyticsEvent.rideOpened, {
      negotiable: !!trip.is_negotiable,
    });
  }, [trip?.id, trip?.is_negotiable]);

  const offerInitialized = React.useRef(false);
  React.useEffect(() => {
    if (!offerInitialized.current && trip?.base_price) {
      setOfferPrice(trip.base_price);
      offerInitialized.current = true;
    }
  }, [trip?.base_price]);

  // Qidiruvdan kelgan joylar soni BO'SH joydan ko'p bo'lishi mumkin (3 ta
  // so'raldi, 2 tasi qoldi) — safar yuklangach mavjudiga qisqartiramiz.
  // Aks holda hisoblagich "+" ruxsat bermaydigan qiymatda turib, bron
  // tugmasi backend tomonidan rad etilardi.
  const freeSeats = trip?.available_seats ?? trip?.total_seats;
  React.useEffect(() => {
    if (!freeSeats || freeSeats < 1) return;
    setSeatCount((current) => (current > freeSeats ? freeSeats : current));
  }, [freeSeats]);

  /**
   * O'Z taklifimiz — brauzerda eslab qolinadi.
   *
   * Backend bronning `offered_price` maydonini haydovchi javobida
   * ALMASHTIRADI, lekin kim oxirgi taklif qilganini bildiradigan maydon
   * yo'q. Solishtirish uchun o'zimiznikini saqlaymiz.
   */
  const driverCountered = (() => {
    if (!myBooking?.ID || typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem(`my_offer_${myBooking.ID}`);
    if (saved == null) return false;
    const mine = Number(saved);
    const current = Number(myBooking.offered_price ?? 0);
    return Number.isFinite(mine) && current > 0 && Math.abs(current - mine) > 0.5;
  })();

  const createBookingMutation = useMutation({
    mutationFn: () =>
      // `seats` (seats_booked EMAS, Swagger). Backend semantikasi (v6 javobi §5):
      // offered_price yuborish DOIM savdolashish (pending_negotiation) deb qabul qilinadi —
      // yo'lovchi haydovchi narxiga TO'LIQ rozi bo'lsa maydon umuman yuborilmaydi (pending).
      // Shu sabab: is_negotiable=false yoki narx haydovchinikiga teng -> yubormaymiz.
      bookRide(tripId, {
        seats: isBuyout ? Math.max(1, trip?.available_seats ?? 1) : seatCount,
        is_full_car_buyout: isBuyout,
        ...(trip?.is_negotiable !== false && offerPrice !== (trip?.base_price ?? 0)
          ? { offered_price: offerPrice }
          : {}),
      }),
    onSuccess: (created) => {
      // O'z taklifimizni eslab qolamiz (yuqoridagi izoh).
      const createdId = created as { id?: string; ID?: string } | undefined;
      const bookingId = createdId?.id ?? createdId?.ID;
      if (bookingId && typeof window !== 'undefined') {
        window.localStorage.setItem(`my_offer_${bookingId}`, String(offerPrice));
      }
      toast.success(tr("So'rov yuborildi!", 'Запрос отправлен!', 'Request sent!'));

      // Qidiruv -> ochish -> bron zanjirining oxirgi bo'g'ini.
      logEvent(AnalyticsEvent.bookingCreated, {
        seats: isBuyout ? Math.max(1, trip?.available_seats ?? 1) : seatCount,
        buyout: isBuyout,
        // Narx taklif qilindimi — savdolashish qanchalik ishlatilishini
        // ko'rsatadi.
        negotiated: trip?.is_negotiable !== false && offerPrice !== (trip?.base_price ?? 0),
      });

      /*
       * Ekranni DARHOL yangilaymiz — `invalidate` javobini kutmasdan.
       *
       * Nega: ilgari odam tugmani bosgach ~1.5 soniya hech qanday o'zgarishsiz
       * kutardi (backend javobi ~0.7 s + qayta so'rov ~0.7 s), forma esa joyida
       * turardi. Bu "bosdim, ishlamadi shekilli" hissini beradi va odam qayta
       * bosishga uriladi.
       *
       * Soxta yozuv YASAMAYMIZ: `bookRide` serverdan haqiqiy bronni qaytaradi,
       * ya'ni `ID` ham, status ham rost. Keyingi `invalidate` uni shunchaki
       * tasdiqlaydi.
       */
      queryClient.setQueryData<{
        trip: BiddingTrip | null;
        role: 'driver' | 'passenger';
        bookings: BookingRow[];
      }>(['trip-bidding', tripId], (old) => {
        if (!old) return old;
        const row = normalizeBooking(created as unknown as Record<string, unknown>) as BookingRow;
        if (!row?.ID) return old; // kutilmagan shakl — keshni buzmaymiz, invalidate hal qiladi
        const rest = old.bookings.filter((b) => String(b.ID) !== String(row.ID));
        return { ...old, bookings: [row, ...rest] };
      });

      queryClient.invalidateQueries({ queryKey: ['trip-bidding', tripId] });
    },
  });

  /**
   * Bitta arizaning holatini keshda DARHOL o'zgartiradi — `invalidate` javobini
   * kutmasdan. Server allaqachon 200 qaytargan, ya'ni bu taxmin emas, tasdiq.
   *
   * `ACCEPTED` ATAYIN: backend `confirmed` yuboradi, `normalizeStatus` uni
   * `ACCEPTED` ga xaritalaydi — shuning uchun qayta so'rov kelganda status
   * o'zgarmaydi va ro'yxat "sakramaydi".
   */
  const patchBookingStatus = (bookingId: string, status: 'ACCEPTED' | 'REJECTED') => {
    queryClient.setQueryData<{
      trip: BiddingTrip | null;
      role: 'driver' | 'passenger';
      bookings: BookingRow[];
    }>(['trip-bidding', tripId], (old) =>
      old
        ? {
            ...old,
            bookings: old.bookings.map((b) =>
              String(b.ID) === String(bookingId) ? { ...b, status } : b
            ),
          }
        : old
    );
  };

  const confirmBookingMutation = useMutation({
    mutationFn: (bookingId: string) => acceptBooking(tripId, bookingId),
    onSuccess: (_data, bookingId) => {
      toast.success(tr('Qabul qilindi!', 'Принято!', 'Accepted!'));
      patchBookingStatus(bookingId, 'ACCEPTED');
      queryClient.invalidateQueries({ queryKey: ['trip-bidding', tripId] });
    },
  });

  /*
   * Qarshi narx (savdolashish). Endpoint backendda HALI YO'Q — kontrakt biz
   * tomondan taklif qilingan, shuning uchun butun blok env bayrog'i bilan
   * o'chirilgan. Yoqish uchun `NEXT_PUBLIC_COUNTER_OFFER=1` yetadi, kodga
   * tegilmaydi (MyID bayrog'i bilan bir xil naqsh).
   */
  const [counterFor, setCounterFor] = React.useState<string | null>(null);
  const [counterPrice, setCounterPrice] = React.useState('');
  const counterOfferMutation = useMutation({
    mutationFn: ({ bookingId, price }: { bookingId: string; price: number }) =>
      counterOffer(tripId, bookingId, price),
    onSuccess: (_data, { bookingId, price }) => {
      toast.success(tr('Narx yuborildi', 'Цена отправлена', 'Price sent'));
      setCounterFor(null);
      // Ekran darhol o'zgaradi — qayta so'rov javobini kutmaymiz.
      queryClient.setQueryData<{
        trip: BiddingTrip | null;
        role: 'driver' | 'passenger';
        bookings: BookingRow[];
      }>(['trip-bidding', tripId], (old) =>
        old
          ? {
              ...old,
              bookings: old.bookings.map((b) =>
                String(b.ID) === String(bookingId)
                  ? { ...b, status: 'COUNTER_OFFERED', offered_price: price }
                  : b
              ),
            }
          : old
      );
      queryClient.invalidateQueries({ queryKey: ['trip-bidding', tripId] });
    },
    onError: () =>
      toast.error(
        tr(
          "Narx yuborilmadi. Qayta urinib ko'ring",
          'Цена не отправлена. Попробуйте ещё раз',
          'Could not send the price. Please try again'
        )
      ),
  });

  const rejectBookingMutation = useMutation({
    mutationFn: (bookingId: string) => rejectBooking(tripId, bookingId),
    onSuccess: (_data, bookingId) => {
      toast.success(tr('Rad etildi', 'Отклонено', 'Declined'));
      patchBookingStatus(bookingId, 'REJECTED');
      queryClient.invalidateQueries({ queryKey: ['trip-bidding', tripId] });
    },
  });

  // Xavfsizlik: qabul qilingan safar tafsilotini yaqinlarga ulashish (haydovchi, marshrut, vaqt).
  const shareTripDetails = () => {
    if (!trip) return;
    const driverName = trip.driver?.name || tr('Haydovchi', 'Водитель', 'Driver');
    const from = trip.origin_address || '—';
    const to = trip.destination_address || '—';
    const when = formatTripDateTime(trip.departure_time);
    const text = tr(
      `Men YolYolakay orqali safar qilyapman.\nHaydovchi: ${driverName}\nYo'nalish: ${from} → ${to}${when ? `\nVaqt: ${when}` : ''}`,
      `Я еду через YolYolakay.\nВодитель: ${driverName}\nМаршрут: ${from} → ${to}${when ? `\nВремя: ${when}` : ''}`,
      `I am travelling with YolYolakay.\nDriver: ${driverName}\nRoute: ${from} → ${to}${when ? `\nTime: ${when}` : ''}`
    );
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/${locale}/trip/${tripId}`
        : undefined;
    void shareOrCopy(
      { title: tr('Mening safarim', 'Моя поездка', 'My trip'), text, url },
      {
        copied: tr('Havola nusxalandi', 'Ссылка скопирована', 'Link copied'),
        failed: tr("Ulashib bo'lmadi", 'Не удалось поделиться', 'Could not share'),
      }
    );
  };

  if (!trip) {
    // Uch holatni ajratamiz: yuklanmoqda -> spinner; xato -> qayta urinish; bo'sh -> topilmadi.
    if (tripLoading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      );
    }
    if (tripError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="max-w-xs text-sm font-semibold text-text-muted">
            {tr(
              "Xatolik yuz berdi. Qayta urinib ko'ring.",
              'Произошла ошибка. Попробуйте ещё раз.',
              'Something went wrong. Please try again.'
            )}
          </p>
          <Button variant="secondary" onClick={() => refetchTrip()}>
            {tr('Qayta urinish', 'Повторить', 'Try again')}
          </Button>
        </div>
      );
    }
    // Javob keldi, lekin safar yo'q (o'chirilgan yoki noto'g'ri ID).
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-xs text-sm font-semibold text-text-muted">
          {tr('Safar topilmadi.', 'Поездка не найдена.', 'Trip not found.')}
        </p>
        <Button variant="secondary" onClick={() => router.back()}>
          {tr('Orqaga', 'Назад', 'Back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <div className="flex-1 overflow-y-auto pb-24 max-w-2xl mx-auto w-full px-4 pt-6 space-y-6">
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-border/50 pb-3">
            <div className="flex items-center gap-2 text-accent font-extrabold text-sm uppercase">
              <MapPin className="w-4 h-4" />
              <span>{tr("Safar ma'lumotlari", 'Данные поездки', 'Trip information')}</span>
            </div>
            <Badge variant="primary">{tripStatusLabel(trip.status ?? '', locale)}</Badge>
          </div>
          <div className="flex items-center gap-3 font-extrabold text-lg text-text">
            <span>{routeNames?.from || '...'}</span>
            <span className="text-accent">→</span>
            <span>{routeNames?.to || '...'}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm font-bold text-text-muted">
              {formatTripDateTime(trip.departure_time) || '...'}
            </span>
            {/* Kasr o'rniga sxema — «2 / 4» ikki xil o'qilardi. */}
            <SeatMap
              totalSeats={trip.total_seats}
              availableSeats={trip.available_seats ?? trip.total_seats}
              compact
            />
          </div>
          {/* base_price — savdolashish boshlang'ich narxi (yangi backend maydoni). */}
          {trip.base_price != null && trip.base_price > 0 && (
            <div className="flex justify-between items-center border-t border-border/50 pt-3">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wide">
                {tr("Boshlang'ich narx", 'Начальная цена', 'Starting price')}
              </span>
              <span className="flex items-center gap-2">
                {/* Backend "adolatli narx" belgisini bergan bo'lsa — ishonch belgisi. */}
                {(trip as { has_fair_price_badge?: boolean }).has_fair_price_badge && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                    <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    {tr('Adolatli narx', 'Честная цена', 'Fair price')}
                  </span>
                )}
                <span className="text-lg font-black text-accent">
                  {formatCurrency(trip.base_price, locale)}
                </span>
              </span>
            </div>
          )}

          {/* Haydovchi: ism + reyting. Sharhlar RO'YXATI endpointi gateway'da YO'Q
              (GET /users/{id}/reviews 404) — faqat umumiy reyting ko'rsatiladi. */}
          {trip.driver && (
            <div className="border-t border-border/50 pt-3">
              <span className="flex items-center gap-1.5 text-sm font-extrabold text-text">
                {/* Avatar bo'lsa rasm, bo'lmasa bosh harf — eski ikonka o'rniga */}
                <Avatar src={trip.driver.avatar} name={trip.driver.name} size={24} />
                {trip.driver.name || tr('Haydovchi', 'Водитель', 'Driver')}
                <RatingBadge rating={trip.driver.rating} />
              </span>
            </div>
          )}
        </div>

        {roleInBidding === 'passenger' && (
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold text-text">
              {tr('Sizning arizangiz', 'Ваша заявка', 'Your request')}
            </h2>
            {!myBooking ? (
              !isTripOpen(trip.status) ? (
                // Safar yakunlangan/bekor qilingan — yangi ariza berib bo'lmaydi (forma yashirin).
                <EmptyState
                  className="rounded-2xl border border-border bg-surface"
                  icon={<CalendarX2 />}
                  title={tr('Safar yopilgan', 'Поездка закрыта', 'Trip is closed')}
                  description={tr(
                    "Bu safar yakunlangan yoki bekor qilingan — ariza berib bo'lmaydi.",
                    'Поездка завершена или отменена — подать заявку нельзя.',
                    'This trip is completed or cancelled — you cannot apply.'
                  )}
                  /* 🔴 BOSHI BERK EDI (2026-09-05 qulaylik auditi):
                     odam yopilgan safarga kelib qolgan — ilova esa
                     «bo'lmaydi» deb aytib, uni o'sha yerda qoldirardi.
                     Aynan shu lahzada u BOSHQA safar qidiryapti. */
                  action={
                    <Button onClick={() => router.push(`/${locale}/search`)}>
                      {tr('Boshqa safar qidirish', 'Найти другую поездку', 'Find another trip')}
                    </Button>
                  }
                />
              ) : !freeSeats ? (
                /* 🔴 SAYT VA ILOVA BIR-BIRIGA ZID EDI (2026-09-05
                   qulaylik auditi): joy tugagan safarda ilova «Joy
                   band qilish» tugmasini o'chirardi, sayt esa arizani
                   ochiq qoldirardi va odam bajarilmaydigan so'rov
                   yuborardi. Joy FAQAT tasdiqlangan bronda band
                   bo'ladi (egasi tanlagan model) — ya'ni `0` degani
                   safar HAQIQATAN to'la degani. */
                <EmptyState
                  className="rounded-2xl border border-border bg-surface"
                  icon={<CalendarX2 />}
                  title={tr("Bo'sh joy qolmadi", 'Свободных мест нет', 'No seats left')}
                  description={tr(
                    'Bu safarning barcha joylari band qilingan.',
                    'Все места на эту поездку уже заняты.',
                    'Every seat on this trip is already taken.'
                  )}
                  action={
                    <Button onClick={() => router.push(`/${locale}/search`)}>
                      {tr('Boshqa safar qidirish', 'Найти другую поездку', 'Find another trip')}
                    </Button>
                  }
                />
              ) : (
                <div className="bg-surface p-6 rounded-2xl border border-border space-y-4">
                  <p className="text-sm font-bold text-text-muted text-center">
                    {lastClosedBooking
                      ? lastClosedBooking.status === 'REJECTED'
                        ? tr(
                            'Avvalgi arizangiz rad etilgan — qayta ariza berishingiz mumkin.',
                            'Ваша прошлая заявка была отклонена — можно подать новую.',
                            'Your previous request was declined — you can send a new one.'
                          )
                        : tr(
                            'Avvalgi arizangiz bekor qilingan — qayta ariza berishingiz mumkin.',
                            'Ваша прошлая заявка была отменена — можно подать новую.',
                            'Your previous request was cancelled — you can send a new one.'
                          )
                      : tr(
                          'Ushbu safarga ariza bermagansiz.',
                          'Вы еще не подали заявку на эту поездку.',
                          'You have not applied for this trip yet.'
                        )}
                  </p>

                  {/* Yo'lovchi taklif qiladigan narx (savdolashish) */}
                  <Input
                    label={tr(
                      "Sizning taklifingiz (so'm)",
                      'Ваше предложение (сум)',
                      'Your offer (UZS)'
                    )}
                    type="number"
                    inputMode="numeric"
                    placeholder={trip.base_price ? String(trip.base_price) : '50000'}
                    value={offerPrice === 0 ? '' : offerPrice}
                    onChange={(e) => setOfferPrice(Number(e.target.value))}
                  />
                  {trip.base_price != null && trip.base_price > 0 && (
                    <p className="text-xs text-text-muted -mt-2 text-center">
                      {tr("Boshlang'ich narx:", 'Начальная цена:', 'Starting price:')}{' '}
                      <span className="font-bold text-accent">
                        {formatCurrency(trip.base_price, locale)}
                      </span>
                    </p>
                  )}

                  {/* Adolatli narx maslahati — juda past taklif qabul qilinmasligi mumkin. */}
                  {trip.base_price != null &&
                    trip.base_price > 0 &&
                    offerPrice > 0 &&
                    offerPrice < trip.base_price * 0.7 && (
                      <p className="-mt-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 text-center">
                        {tr(
                          "Taklifingiz boshlang'ich narxdan ancha past — qabul qilinmasligi mumkin.",
                          'Ваше предложение намного ниже начальной цены — его могут не принять.',
                          'Your offer is much lower than the starting price — it may be declined.'
                        )}
                      </p>
                    )}

                  {/* O'rinlar soni — butun salon band qilinmasa */}
                  {!isBuyout && (
                    <div className="p-4 bg-bg border border-border rounded-2xl">
                      <Counter
                        label={tr("O'rinlar soni", 'Количество мест', 'Number of seats')}
                        value={seatCount}
                        onChange={setSeatCount}
                        max={Math.max(1, trip.available_seats ?? trip.total_seats ?? 1)}
                      />
                    </div>
                  )}

                  {/* is_buyout — butun salonni band qilish */}
                  <div className="flex items-center justify-between p-4 bg-bg border border-border rounded-2xl">
                    <div className="text-left">
                      <span className="text-sm font-extrabold text-text block">
                        {tr(
                          'Butun salonni band qilish',
                          'Выкупить весь салон',
                          'Book the whole car'
                        )}
                      </span>
                      <span className="text-xs text-text-muted">
                        {tr(
                          "Barcha bo'sh joylar siz uchun",
                          'Все свободные места — вам',
                          'All free seats are yours'
                        )}
                      </span>
                    </div>
                    <Switch
                      ariaLabel={tr(
                        'Butun salonni sotib olish',
                        'Выкупить весь салон',
                        'Buy out the whole car'
                      )}
                      checked={isBuyout}
                      onChange={setIsBuyout}
                    />
                  </div>

                  <Button
                    onClick={() => createBookingMutation.mutate()}
                    isLoading={createBookingMutation.isPending}
                    // myBookingsFetched: arizalarim hali yuklanmagan bo'lsa yubormaymiz —
                    // aks holda mavjud faol ariza ustiga dublikat ochilib qolishi mumkin.
                    disabled={
                      offerPrice <= 0 || createBookingMutation.isPending || !myBookingsFetched
                    }
                    className="w-full"
                  >
                    {tr('Ariza yuborish', 'Отправить заявку', 'Send request')}
                  </Button>
                </div>
              )
            ) : (
              <div className="bg-surface p-5 rounded-2xl border border-border space-y-4">
                {/* Ariza holati bosqichlari — yo'lovchi qayerda ekanini aniq ko'rsatadi. */}
                {/* Jonli holat olinmadi — quyidagi bosqichlar eskirgan bo'lishi mumkin.
                    Buni aytmasak, yo'lovchi "hali boshlanmadi" degan eski holatni
                    haqiqat deb qabul qiladi (aynan shu shikoyat bo'lgan). */}
                {bundle?.staleSource && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-bg/60 px-3 py-2">
                    <span className="text-[11px] font-bold text-text-muted">
                      {tr(
                        "Holat yangilanmadi — eskirgan bo'lishi mumkin",
                        'Статус не обновился — может быть устаревшим',
                        'Status could not be refreshed — it may be out of date'
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => void refetchTrip()}
                      className="shrink-0 text-[11px] font-bold underline underline-offset-2"
                    >
                      {tr('Yangilash', 'Обновить', 'Refresh')}
                    </button>
                  </div>
                )}

                <BookingTimeline
                  bookingStatus={myBooking.status}
                  tripStatus={normalizeStatus(trip.status)}
                />

                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="font-extrabold text-text">{tr('Holat:', 'Статус:', 'Status:')}</p>
                    <Badge
                      variant={
                        myBooking.status === 'ACCEPTED'
                          ? 'success'
                          : myBooking.status === 'REJECTED' || myBooking.status === 'CANCELLED'
                            ? 'error'
                            : 'secondary'
                      }
                    >
                      {bookingStatusLabel(myBooking.status, locale)}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-text-muted uppercase block">
                      {tr('Joriy narx', 'Текущая цена', 'Current price')}
                    </span>
                    <span className="text-lg font-black text-accent">
                      {/* offered_price yo'q = e'lon narxiga rozi bo'lingan (pending) — 0 emas,
                          haydovchi narxi ko'rsatiladi. */}
                      {formatCurrency(myBooking.offered_price || trip.base_price || 0, locale)}
                    </span>
                  </div>
                </div>

                {/* Bosqichlar holat NISHONI ostida: nishon "hozir qayerdaman"
                    deydi, bosqichlar esa "keyin nima bo'ladi" — ikkalasi
                    birga to'liq javob beradi. */}
                <BookingProgress bookingStatus={myBooking.status} tripStatus={trip.status} />

                {/* Uchrashuv payti kerak bo'ladigan hamma narsa — FAQAT bron
                    tasdiqlangach: undan oldin uchrashuv hali yo'q va bu blok
                    faqat ekranni to'ldirardi. */}
                {myBooking.status === 'ACCEPTED' && (
                  <>
                    <PickupCard
                      plate={vehicle?.plate}
                      carTitle={[vehicle?.brand, vehicle?.model].filter(Boolean).join(' ')}
                      color={vehicle?.color}
                      pickupPoint={trip.pickup_point}
                      lat={meetPoint?.[0]}
                      lon={meetPoint?.[1]}
                      distanceKm={distanceToPickup}
                    />

                    {/* KALENDAR — ilova ichidagi eslatmadan kuchliroq: u
                        saytdan tashqarida yashaydi va boshqa qurilmalarga
                        sinxronlanadi. */}
                    {trip.departure_time && (
                      <button
                        type="button"
                        onClick={() => {
                          const start = new Date(trip.departure_time as string);
                          const route = [trip.origin_address, trip.destination_address]
                            .filter(Boolean)
                            .join(' → ');
                          downloadIcs(
                            `yolyolakay-${trip.id ?? tripId}`,
                            buildIcs({
                              uid: String(trip.id ?? tripId),
                              start,
                              title: route ? `YolYolakay: ${route}` : 'YolYolakay',
                              description: `${window.location.origin}/${locale}/trip/${trip.id ?? tripId}`,
                              location: trip.pickup_point || trip.origin_address || '',
                            })
                          );
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        <CalendarPlus className="h-4 w-4" />
                        {tr("Kalendarga qo'shish", 'Добавить в календарь', 'Add to calendar')}
                      </button>
                    )}

                    {eta?.minutes != null && (
                      <div className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm font-semibold text-text">
                        <Clock className="h-4 w-4 shrink-0 text-accent" />
                        {tr(
                          `Taxminan ${Math.max(1, Math.round(eta.minutes))} daqiqada yetib boradi`,
                          `Прибытие примерно через ${Math.max(1, Math.round(eta.minutes))} мин`,
                          `Arriving in about ${Math.max(1, Math.round(eta.minutes))} min`
                        )}
                      </div>
                    )}

                    {/* XAVFSIZLIK: SOS hodisadan KEYIN ishlaydi, bu esa
                        oldini oladi — yaqinlari kim bilan va qanaqa
                        mashinada ketayotganini oldindan biladi. */}
                    <button
                      type="button"
                      onClick={async () => {
                        const result = await shareTripWatch(
                          {
                            id: String(trip.id ?? tripId),
                            from: trip.origin_address,
                            to: trip.destination_address,
                            departureTime: trip.departure_time,
                            driverName: trip.driver?.name,
                            plate: vehicle?.plate,
                            carTitle: [vehicle?.brand, vehicle?.model].filter(Boolean).join(' '),
                          },
                          locale
                        );
                        if (result === 'copied') {
                          toast.success(
                            tr('Havola nusxalandi', 'Ссылка скопирована', 'Link copied')
                          );
                        } else if (result === 'failed') {
                          toast.error(
                            tr("Ulashib bo'lmadi", 'Не удалось поделиться', "Couldn't share")
                          );
                        }
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {tr(
                        'Safarimni yaqinlarimga yuborish',
                        'Отправить поездку близким',
                        'Send my ride to family'
                      )}
                    </button>
                  </>
                )}

                {/* 🔴 HAYDOVCHI NARXNI QAYTARSA — yo'lovchi buni SHU YERDA
                    ko'radi (egasi so'radi 2026-08-13). Ilgari narx jimgina
                    o'zgarardi va ekranda hamon "javobini kutmoqdamiz"
                    turardi — ya'ni haydovchi javob berganini bilishning yo'li
                    yo'q edi.

                    Kim oxirgi taklif qilganini backend aytmaydi
                    (`last_offer_by` yo'q), shuning uchun O'Z taklifimizni
                    brauzerda eslab qolamiz va taqqoslaymiz — mobil ilovada
                    ham ayni shunday. */}
                {/* 🔴 Statusga tayanmaymiz — sabab yuqoridagi haydovchi
                    tugmalari izohida (statuslar swaggerda yozilmagan).
                    Yakunlanmagan bron bo'lsa yetarli. */}
                {!isBookingSettled(myBooking.status) &&
                  (driverCountered ? (
                    <div className="rounded-xl bg-warning/10 border border-warning/25 p-3 space-y-1">
                      <p className="text-sm font-extrabold text-text">
                        {tr(
                          `Haydovchi ${formatCurrency(myBooking.offered_price || 0, locale)} taklif qildi`,
                          `Водитель предложил ${formatCurrency(myBooking.offered_price || 0, locale)}`,
                          `The driver offered ${formatCurrency(myBooking.offered_price || 0, locale)}`
                        )}
                      </p>
                      <p className="text-xs text-text-muted">
                        {tr(
                          "Rozi bo'lsangiz haydovchi tasdiqlashini kuting. Kelishmasangiz unga yozing.",
                          'Если согласны — дождитесь подтверждения водителя. Если нет — напишите ему.',
                          'If you agree, wait for the driver to confirm. If not, message them.'
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-accent/5 border border-accent/20 p-3 text-center">
                      <p className="text-xs font-bold text-text-muted">
                        {tr(
                          'Narxingizga haydovchining javobini kutmoqdamiz...',
                          'Ожидание ответа водителя на вашу цену...',
                          'Waiting for the driver to respond to your price...'
                        )}
                      </p>
                    </div>
                  ))}

                {myBooking.status === 'ACCEPTED' && (
                  <div className="space-y-2">
                    <ContactRow phone={trip?.driver?.phone ?? trip?.driver?.phone_number} />
                    <Button
                      onClick={() =>
                        // Chat kaliti = SAFAR + suhbatdosh (yo'lovchi uchun suhbatdosh — haydovchi).
                        router.push(
                          `/${locale}/chat/${tripId}?peer=${trip?.driver_id ?? ''}&price=${
                            myBooking.offered_price || trip.base_price || 0
                          }`
                        )
                      }
                      variant="primary"
                      className="w-full"
                    >
                      {tr("Chatga o'tish", 'Перейти в чат', 'Open chat')}
                    </Button>
                    {/* Xavfsizlik: safar tafsilotini yaqinlaringga ulashish (haydovchi, marshrut, vaqt). */}
                    <Button
                      onClick={() => shareTripDetails()}
                      variant="secondary"
                      className="w-full flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="h-4 w-4" />
                      {tr(
                        'Safarni yaqinlarga ulashish',
                        'Поделиться поездкой с близкими',
                        'Share the trip with your family'
                      )}
                    </Button>
                    {/* Xavfsizlik: favqulodda yordam (102 ga qo'ng'iroq). */}
                    <SosButton />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {roleInBidding === 'driver' && (
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold text-text flex items-center justify-between">
              <span>{tr("Yo'lovchilar arizalari", 'Заявки пассажиров', 'Passenger requests')}</span>
              <Badge variant="secondary">{driverBookings.length}</Badge>
            </h2>

            {driverBookings.length === 0 ? (
              <EmptyState
                /* qulaylik: chiqish yo'li SHART EMAS — bu KUTISH holati:
                   haydovchi e'lonini bergan, ariza yo'lovchidan keladi. */
                className="rounded-2xl border border-border bg-surface"
                icon={<Inbox />}
                title={tr("Hozircha arizalar yo'q", 'Пока нет заявок', 'No requests yet')}
                description={tr(
                  "Yo'lovchi ariza berishi bilan u shu yerda ko'rinadi.",
                  'Как только пассажир подаст заявку, она появится здесь.',
                  'As soon as a passenger applies, the request appears here.'
                )}
              />
            ) : (
              driverBookings.map((req) => (
                <div
                  key={req.ID}
                  className="bg-surface p-5 rounded-2xl border border-border space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <Avatar
                        src={(req.passenger as { avatar?: string } | undefined)?.avatar}
                        name={req.passenger?.name || req.passenger_name}
                        size={40}
                      />
                      <div>
                        <p className="font-extrabold text-text">
                          {req.passenger?.name ||
                            req.passenger_name ||
                            tr("Yo'lovchi", 'Пассажир', 'Passenger')}
                        </p>
                        {/* KIMNI OLAYAPMAN — ismdan keyin darhol. Yangi
                            akkauntda reyting ham yo'q, ya'ni usiz kartada
                            odam haqida aytadigan hech narsa qolmasdi. */}
                        <PassengerTrust userId={req.passenger_id} profile={req.passenger} />
                        <p className="text-xs font-bold text-text-muted flex items-center gap-1">
                          <Users className="w-3 h-3" /> {req.seats ?? 1}{' '}
                          {tr("o'rin ·", 'мест ·', 'seats ·')}{' '}
                          {/* offered_price yo'q = e'lon narxiga rozi (pending) — 0 ko'rsatilmaydi. */}
                          {req.offered_price
                            ? `${tr('Taklif:', 'Предложение:', 'Offer:')} ${formatCurrency(req.offered_price, locale)}`
                            : `${tr('Narxingizga rozi', 'Согласен с ценой', 'Agrees with your price')} (${formatCurrency(trip.base_price ?? 0, locale)})`}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        req.status === 'ACCEPTED'
                          ? 'success'
                          : req.status === 'REJECTED' || req.status === 'CANCELLED'
                            ? 'error'
                            : 'secondary'
                      }
                    >
                      {bookingStatusLabel(req.status, locale)}
                    </Badge>
                  </div>

                  {/*
                    🔴 RUXSAT RO'YXATI EMAS, RAD ETISH RO'YXATI (2026-08-16).

                    Ilgari tugmalar faqat `PENDING` va `PENDING_NEGOTIATION`
                    da chizilardi. Lekin bron statuslari swaggerda UMUMAN
                    yozilmagan (`type: string`) — backend savdolashish
                    davomida boshqa qiymat qo'ysa (masalan `COUNTER_OFFERED`,
                    u polling shartida allaqachon uchraydi), haydovchida
                    "Qabul qilish / Rad etish / Narx taklif qilish"
                    tugmalari BUTUNLAY yo'qolardi va u savdolashishni davom
                    ettira olmasdi. Egasi aynan shuni ko'rgan.

                    Endi teskarisi: bron YAKUNLANMAGAN bo'lsa tugmalar
                    turadi. Yangi oraliq status qo'shilsa ham ishlayveradi.
                  */}
                  {!isBookingSettled(req.status) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        onClick={() => confirmBookingMutation.mutate(req.ID)}
                        // isPending BARCHA qatorlarga umumiy — faqat AYNAN shu ariza ustida
                        // ishlayotganda (variables === req.ID) spinner ko'rsatamiz.
                        isLoading={
                          confirmBookingMutation.isPending &&
                          confirmBookingMutation.variables === req.ID
                        }
                        disabled={
                          confirmBookingMutation.isPending || rejectBookingMutation.isPending
                        }
                        className="flex-1 min-w-[100px]"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />{' '}
                        {tr('Qabul qilish', 'Принять', 'Accept')}
                      </Button>
                      <Button
                        onClick={() => rejectBookingMutation.mutate(req.ID)}
                        isLoading={
                          rejectBookingMutation.isPending &&
                          rejectBookingMutation.variables === req.ID
                        }
                        disabled={
                          confirmBookingMutation.isPending || rejectBookingMutation.isPending
                        }
                        variant="secondary"
                        className="flex-1 min-w-[100px] text-error hover:bg-error/10"
                      >
                        {tr('Rad etish', 'Отклонить', 'Decline')}
                      </Button>

                      {/* Uchinchi yo'l: O'Z narxini qaytarish. Busiz bu savdolashish
                          emas, "ha yoki yo'q" edi — haydovchi rozi bo'lmasa, narxni
                          faqat chatda aytib, kelishuvni hech qayerda qayd etolmasdi.
                          Backend endpointi hali yo'q, shuning uchun bayroq bilan
                          o'chirilgan (shared/api/rides.ts -> counterOffer izohi). */}
                      {COUNTER_OFFER_ENABLED && (
                        <Button
                          onClick={() => {
                            setCounterFor(req.ID);
                            setCounterPrice(String(req.offered_price || trip.base_price || 0));
                          }}
                          disabled={
                            confirmBookingMutation.isPending || rejectBookingMutation.isPending
                          }
                          variant="secondary"
                          className="flex-1 min-w-[140px]"
                        >
                          {tr('Narx taklif qilish', 'Предложить цену', 'Offer a price')}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Narx kiritish — o'sha ariza qatorining ICHIDA ochiladi, alohida
                      oyna emas: haydovchi yo'lovchi taklifini ko'rib turib yozadi. */}
                  {COUNTER_OFFER_ENABLED && counterFor === req.ID && (
                    <div className="space-y-2 rounded-xl border border-border bg-bg/60 p-3">
                      <label className="text-xs font-bold text-text-muted">
                        {tr('Sizning narxingiz', 'Ваша цена', 'Your price')}
                      </label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={counterPrice}
                        onChange={(e) => setCounterPrice(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            counterOfferMutation.mutate({
                              bookingId: req.ID,
                              price: Number(counterPrice),
                            })
                          }
                          isLoading={counterOfferMutation.isPending}
                          disabled={
                            counterOfferMutation.isPending ||
                            !Number(counterPrice) ||
                            Number(counterPrice) <= 0
                          }
                          className="flex-1"
                        >
                          {tr('Yuborish', 'Отправить', 'Send')}
                        </Button>
                        <Button
                          onClick={() => setCounterFor(null)}
                          variant="secondary"
                          className="flex-1"
                        >
                          {tr('Bekor qilish', 'Отмена', 'Cancel')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {req.status === 'ACCEPTED' && (
                    <ContactRow phone={req.passenger?.phone ?? req.passenger?.phone_number} />
                  )}

                  {req.status === 'ACCEPTED' && (
                    <Button
                      onClick={() =>
                        // Chat kaliti = SAFAR + suhbatdosh (haydovchi uchun — yo'lovchi).
                        router.push(
                          `/${locale}/chat/${tripId}?peer=${req.passenger_id ?? ''}&price=${
                            req.offered_price || trip.base_price || 0
                          }&name=${encodeURIComponent(
                            req.passenger?.name || req.passenger_name || ''
                          )}`
                        )
                      }
                      variant="secondary"
                      className="w-full"
                    >
                      {tr("Chatga o'tish", 'Перейти в чат', 'Open chat')}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
