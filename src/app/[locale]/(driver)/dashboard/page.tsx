'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyRides,
  getRide,
  activateRide,
  acceptBooking,
  rejectBooking,
  markNoShow,
  startRide,
  completeRide,
  cancelRide,
} from '@/shared/api/rides';
import type { MyRide } from '@/shared/api/types/ride';
import { usePlanQuotas } from '@/entities/billing/api/usePlans';
import { useCurrentPlan } from '@/entities/billing/api/useSubscription';
import { useProfile } from '@/entities/user/api/useProfile';
import { AnalyticsEvent, logEvent } from '@/shared/lib/analytics';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Input } from '@/shared/ui/Input';
import {
  formatCurrency,
  formatQuota,
  formatTripDateTime,
  bookingStatusLabel,
  tripStatusLabel,
  normalizeBooking,
  normalizeStatus,
  personName,
  isBookingSettled,
} from '@/shared/lib/format';
import { handleCheckout, subscribeTariff } from '@/shared/lib/checkout';
import {
  Users,
  MapPin,
  CheckCircle,
  XCircle,
  CreditCard,
  Navigation,
  MessageCircle,
  Info,
  ChevronRight,
  Wallet,
  Inbox,
} from 'lucide-react';
import { hasValidCoords } from '@/shared/lib/maps';
import { RouteMapSheet } from '@/shared/ui/RouteMapSheet';
import { RoutePreview } from '@/shared/ui/RoutePreview';
import {
  markTripStarted,
  clearTripStarted,
  getTripStartedMs,
  getElapsedSinceStart,
} from '@/shared/lib/tripClock';
import { TripTimer } from '@/shared/ui/TripTimer';
import { SosButton } from '@/shared/ui/SosButton';
import { useArrivalPrompt } from '@/shared/lib/useArrivalPrompt';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUIStore } from '@/shared/model/uiStore';
import { Avatar } from '@/shared/ui/Avatar';
import { useTr } from '@/shared/lib/useTr';
import { TripDetailsSheet } from '@/shared/ui/trip/TripDetailsSheet';
import { useDriverEarnings, DRIVER_EARNINGS_KEY } from '@/entities/ride/api/useDriverEarnings';
import { useConfirm } from '@/shared/ui/useConfirm';

// Backend booking obyekti: id YO'Q -> ID; price YO'Q -> offered_price;
// status KATTA harf: PENDING | ACCEPTED | REJECTED | CANCELLED.
interface Booking {
  ID: string;
  trip_id: string;
  passenger_id?: string;
  status: string; // PENDING | ACCEPTED | REJECTED | CANCELLED
  offered_price?: number;
  seats?: number;
  passenger_name?: string; // eski/yassi maydon (fallback uchun saqlanadi)
  // Backend .Preload("Passenger") — endi NAME ham bor (2026-06-27 backend tuzatildi).
  passenger?: { name?: string; display_name?: string; rating?: number };
}

// /rides/my elementi (MyRide) + UI normallashuvi: ID (katta harf) va KATTA harf status.
type TripRow = MyRide & { ID: string };

interface DriverTariff {
  id: string;
  name: string;
  price: number;
  trips: number | string;
}

export default function DriverDashboardPage() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const tr = useTr();
  // Qaytarib bo'lmaydigan amallar uchun ilovaning O'Z tasdiq oynasi
  // (`window.confirm` o'rniga — sabablari `useConfirm` izohida).
  const { confirm, confirmWithText, confirmDialog } = useConfirm();
  const { data: profile } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const earnings = useDriverEarnings();
  const { setActiveRole } = useUIStore();

  // Dashboard'da har doim haydovchi roli faol (nav + Header balansi izchil bo'lishi uchun).
  React.useEffect(() => {
    setActiveRole('driver');
  }, [setActiveRole]);

  // Tarif setkasi endi JONLI manbadan: GET /billing/plans (hardcode o'chirildi).
  const { data: planRows = [] } = usePlanQuotas();
  const { mode: planMode, plan: activePlan } = useCurrentPlan();

  // Tariflar sahifasidagi bilan BIR XIL qoida (CEO 2026-07-30). Ilgari bu ro'yxat
  // qoidani bilmasdi: Plus tarifidagi haydovchiga yon panelda yana "Plus sotib
  // oling" turardi, eng qimmat tarifdagiga esa sotadigan narsa yo'q bo'lsa ham
  // butun setka ko'rinardi (mock backend bilan tasdiqlangan).
  const activePrice = activePlan?.price ?? -1;
  const driverTariffs: DriverTariff[] = planRows
    .filter((p) => p.type !== 'trial')
    .filter((p) => {
      if (planMode === 'top') return false;
      if (planMode !== 'upgrade') return true;
      return p.price > activePrice;
    })
    .map((p) => ({
      id: p.type,
      name: p.name,
      price: p.price,
      trips: formatQuota(p.quota, locale),
    }));

  const buyTariffMutation = useMutation({
    // `locale` — Click qaytaradigan manzil uchun (`return_url`).
    mutationFn: (tariff: DriverTariff) => subscribeTariff(tariff.id, { locale }),
    onSuccess: (data: { checkout_url?: string; message?: string }) => {
      // Obuna (rides_left) ['profile'] query ichida keladi — bitta invalidatsiya yetadi.
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      // Mock rejimda backend to'lovni O'ZI o'tkazadi — o'lik checkout_url'ga
      // redirect qilinmaydi (tafsilot: shared/lib/checkout.ts).
      handleCheckout(data, locale);
    },
  });

  const { data: tripsData } = useQuery<MyRide[]>({
    queryKey: ['trips'],
    // Bronlar /rides/my javobidagi bookings[]da kutiladi (alohida bookings endpointi YO'Q).
    // ZAXIRA: faol safarda bookings kaliti umuman kelmasa (backend embed qilmagan holat —
    // "bildirishnoma keldi-yu ariza ko'rinmadi" muammosining ildizi), GET /rides/{id}
    // (backend v6) dan to'ldirishga urinamiz — u ham bermasa xatga yozilgan bloker.
    queryFn: async () => {
      const rides = await getMyRides('driver').catch(() => [] as MyRide[]);
      const active = [...rides]
        .reverse()
        .find((r) => !['completed', 'cancelled'].includes(String(r.status).toLowerCase()));
      if (active && active.bookings === undefined) {
        const fresh = await getRide(String(active.id));
        const freshBookings = (fresh as Record<string, any> | null)?.bookings;
        if (Array.isArray(freshBookings)) {
          return rides.map((r) => (r.id === active.id ? { ...r, bookings: freshBookings } : r));
        }
      }
      return rides;
    },
    // Yangi arizalar ko'rinishi uchun davriy yangilab turamiz (asosiy signal — WS invalidatsiya).
    // 10s -> 25s (2026-08-07): bu queryFn IKKITA ketma-ket so'rov qilishi mumkin
    // (getMyRides + getRide), backend esa har biriga 0.65-1.08 s sarflaydi. 10 soniya
    // interval bilan panel amalda tinmay so'rov yuborardi.
    /*
     * Interval HOLATGA QARAB o'zgaradi. Ilgari doim 25 s edi va bu haydovchi
     * uchun sezilarli darajada "o'lik" tuyulardi: yo'lovchi ariza berganidan
     * keyin panelda yarim daqiqagacha hech narsa ko'rinmasdi.
     *
     * Endi: kutayotgan ariza bor yoki safar yo'lda bo'lsa — 8 s (odam aynan
     * shu paytda ekranga tikilib turadi), aks holda o'sha 25 s (bekorga
     * so'rov yubormaymiz, backend har chaqiruvga ~0.7 s sarflaydi).
     */
    refetchInterval: (query) => {
      const rides = query.state.data ?? [];
      const busy = rides.some((r) => {
        const status = String(r?.status ?? '').toUpperCase();
        if (status === 'IN_PROGRESS') return true;
        return (r?.bookings ?? []).some((b) => {
          // Gateway bronni PascalCase (`Status`) ham qaytaradi — ikkalasini o'qiymiz.
          const raw = b as unknown as Record<string, unknown>;
          const s = String(raw?.status ?? raw?.Status ?? '').toUpperCase();
          return s === 'PENDING' || s === 'PENDING_NEGOTIATION' || s === 'COUNTER_OFFERED';
        });
      });
      return busy ? 8000 : 25000;
    },
    refetchIntervalInBackground: false,
  });

  // Status: gateway kichik harfda beradi (draft/active/in_progress/...) — KATTA harfga
  // keltiramiz, quyidagi taqqoslashlar o'zgarishsiz ishlaydi.
  const tripsArray: TripRow[] = (tripsData ?? []).map((t) => ({
    ...t,
    ID: String(t.id ?? ''),
    status: normalizeStatus(t.status),
  }));
  // Mijoz kutayotgan (tugallanmagan/bekor qilinmagan) BARCHA safarlar.
  // CEO 2026-07-30 (F2): ilgari ekran bitta avtomatik tanlangan safar atrofida
  // qurilgan edi — haydovchida bir nechta ochiq safar bo'lsa qolganlari umuman
  // ko'rinmasdi. Endi ro'yxat chiqadi, safar tanlanadi, pastda o'sha safarning
  // so'rovlari turadi.
  const openTrips: TripRow[] = [...tripsArray]
    .reverse()
    .filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');

  const [selectedTripId, setSelectedTripId] = React.useState<string | null>(null);
  // "Safar ma'lumotlari" kartochkasi — qaysi safarniki ochiq turgani.
  const [detailsTripId, setDetailsTripId] = React.useState<string | null>(null);

  // Tanlanmagan bo'lsa — ro'yxatdagi birinchisi (eski xulq-atvor saqlanadi).
  // Tanlangan safar tugab ro'yxatdan chiqib ketsa ham yiqilmasin uchun `??`.
  const activeTrip =
    (selectedTripId ? openTrips.find((t) => t.ID === selectedTripId) : undefined) ?? openTrips[0];

  // E'LON QILINGANDAN KEYIN: create-trip `?created=<id>` bilan qaytaradi va kartochka
  // O'ZI ochiladi — haydovchi nima e'lon qilganini darhol ko'radi (avval bu ma'lumot
  // hech qayerda ko'rinmasdi). Bir marta ochilib, parametr URL'dan olib tashlanadi.
  const createdId = searchParams.get('created');
  React.useEffect(() => {
    if (!createdId) return;
    setSelectedTripId(createdId);
    setDetailsTripId(createdId);
    router.replace(`/${locale}/dashboard`);
  }, [createdId, router, locale]);

  const detailsTrip = detailsTripId
    ? (tripsArray.find((t) => t.ID === detailsTripId) ?? null)
    : null;

  // Marshrut nomlari — TO'G'RIDAN backend matni (origin_address/destination_address),
  // reverse-geocode YO'Q.
  const routeNames = activeTrip
    ? { from: activeTrip.origin_address || '—', to: activeTrip.destination_address || '—' }
    : null;

  // Bronlar /rides/my javobidagi bookings[] massividan (camelCase — normalizeBooking
  // snake_case + CONFIRMED->ACCEPTED normallashtiradi).
  const bookings: Booking[] = (activeTrip?.bookings ?? []).map((b) => {
    const raw = b as Record<string, any>;
    return {
      ...normalizeBooking(raw),
      passenger_name: personName(raw.passenger, raw.passenger_name),
    } as Booking;
  });

  // "Boshlash"dan keyingi manifest: tasdiqlangan yo'lovchilar va olinadigan naqd summa.
  const confirmedBookings = bookings.filter((b) => b.status === 'ACCEPTED');
  const collectTotal = confirmedBookings.reduce(
    (sum, b) => sum + (b.offered_price ?? (activeTrip?.price_per_seat ?? 0) * (b.seats ?? 1)),
    0
  );

  // Manzilga yaqinlashganda "Yakunlaysizmi?" so'rovi (geolokatsiya, faqat IN_PROGRESS'da).
  const arrivedAtDest = useArrivalPrompt(
    activeTrip?.status === 'IN_PROGRESS',
    activeTrip?.destination_lat,
    activeTrip?.destination_lon
  );
  // Haydovchi bannerni yopishi mumkin (masalan yo'lovchi tushirish uchun to'xtagan) —
  // yopilgach shu safar uchun qayta chiqmaydi. Safar (ID) o'zgarsa qayta tiklanadi.
  const [arrivalDismissed, setArrivalDismissed] = React.useState<string | null>(null);
  const showArrivalPrompt =
    arrivedAtDest && activeTrip?.status === 'IN_PROGRESS' && arrivalDismissed !== activeTrip?.ID;

  // Yakunlangach ko'rsatiladigan hisobot (yakunlash lahzasida "muzlatiladi" — keyin
  // activeTrip yo'qoladi). null = oyna yopiq.
  const [tripSummary, setTripSummary] = React.useState<{
    passengers: number;
    total: number;
    durationMs: number;
  } | null>(null);

  // Marshrut xaritasi (ilova ichida) — ilgari tashqi yandex.uz havolasi PWA'dan chiqarib yuborardi.
  const [routeSheetOpen, setRouteSheetOpen] = React.useState(false);

  const durationText = (ms: number): string => {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return tr(`${h} soat ${m} daqiqa`, `${h} ч ${m} мин`, `${h} h ${m} min`);
    return tr(`${m} daqiqa`, `${m} мин`, `${m} min`);
  };

  const confirmBookingMutation = useMutation({
    mutationFn: (bookingId: string) => acceptBooking(activeTrip?.ID ?? '', bookingId),
    onSuccess: () => {
      toast.success(tr('Arizani qabul qildingiz!', 'Заявка принята!', 'Request accepted!'));
      // Bronlar trips javobi ichida — bitta invalidatsiya yetadi.
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  const rejectBookingMutation = useMutation({
    mutationFn: (bookingId: string) => rejectBooking(activeTrip?.ID ?? '', bookingId),
    onSuccess: () => {
      toast.success(tr('Ariza rad etildi', 'Заявка отклонена', 'Request declined'));
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  // NO-SHOW: yo'lovchi kelmadi — haydovchi qayd etadi (yo'lovchi reputatsiyasiga ta'sir qiladi).
  const noShowMutation = useMutation({
    mutationFn: (bookingId: string) => markNoShow(activeTrip?.ID ?? '', bookingId),
    onSuccess: () => {
      toast.success(tr('Kelmaslik qayd etildi', 'Неявка зафиксирована', 'No-show recorded'));
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.status === 404
          ? tr(
              'Bu funksiya tez orada ishga tushadi',
              'Эта функция скоро заработает',
              'This feature is coming soon'
            )
          : tr(
              'Qayd etilmadi. Qayta urining',
              'Не удалось зафиксировать',
              'Could not record. Please try again'
            )
      );
    },
  });

  // DRAFT safar (activate yiqilgan/yakunlanmagan) uchun qayta faollashtirish yo'li —
  // usiz safar abadiy draft'da qolib, qidiruvda hech qachon chiqmasdi.
  const activateTripMutation = useMutation({
    mutationFn: (tripId: string) => activateRide(tripId),
    onSuccess: () => {
      toast.success(tr('Safar faollashtirildi!', 'Поездка активирована!', 'Trip activated!'));
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.response?.data?.message || '';
      // 🔴 PAKET TUGADI — bu paneldan faollashtirishning IKKINCHI kirish
      // nuqtasi. E'lon berish ekranida paywall bor edi, bu yerda esa odam
      // «Keyinroq urining» degan YOLG'ON xabar olardi: qayta urinish
      // tarif yangilanmaguncha hech qachon yordam bermaydi.
      // Holat KODIGA qaraymiz — matn o'zgarsa ham ishlashi uchun.
      if (err?.response?.status === 402) {
        logEvent(AnalyticsEvent.paywallShown, {
          reason: 'quota_exceeded',
          from: 'dashboard',
        });
        toast.warning(
          tr(
            "Paketingizdagi e'lonlar tugadi — tarifni yangilagach e'lon qidiruvda ko'rinadi.",
            'Объявления в вашем пакете закончились — после продления тарифа объявление появится в поиске.',
            'You have no listings left in your plan — renew it and the listing will appear in search.'
          ),
          { duration: 8000 }
        );
        router.push(`/${locale}/tariffs?paywall=true`);
        return;
      }
      toast.error(
        /approved car/i.test(String(msg))
          ? tr(
              "Mashinangiz hali moderatsiyadan o'tmagan — tasdiqlangach qayta urining",
              'Ваш автомобиль ещё на модерации — попробуйте после одобрения',
              'Your car is still under review — try again once it is approved'
            )
          : tr(
              "Faollashtirib bo'lmadi. Keyinroq urining",
              'Не удалось активировать. Попробуйте позже',
              'Could not activate. Try again later'
            )
      );
    },
  });

  const startTripMutation = useMutation({
    mutationFn: (tripId: string) => startRide(tripId),
    onSuccess: (_data, tripId) => {
      // Taymer uchun boshlanish lahzasini saqlaymiz (backend started_at bermaydi).
      markTripStarted(tripId);
      toast.success(tr('Safar boshlandi!', 'Поездка начата!', 'Trip started!'));
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  const completeTripMutation = useMutation({
    mutationFn: (tripId: string) => completeRide(tripId),
    onSuccess: (_data, tripId) => {
      // Hisobot uchun yakunlash lahzasidagi qiymatlarni ushlaymiz (invalidatsiyadan oldin).
      setTripSummary({
        passengers: confirmedBookings.length,
        total: collectTotal,
        durationMs: getElapsedSinceStart(tripId),
      });
      clearTripStarted(tripId);
      toast.success(tr('Safar yakunlandi!', 'Поездка завершена!', 'Trip completed!'));
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      // Daromad statistikasi FAQAT safar yakunlanganda o'zgaradi — shu yerda eskiradi.
      queryClient.invalidateQueries({ queryKey: DRIVER_EARNINGS_KEY });
    },
  });

  const cancelTripMutation = useMutation({
    mutationFn: ({ tripId, reason }: { tripId: string; reason?: string }) =>
      cancelRide(tripId, reason?.trim() || undefined),
    onSuccess: () => {
      toast.success(tr('Safar bekor qilindi', 'Поездка отменена', 'Trip cancelled'));
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: DRIVER_EARNINGS_KEY });
    },
    onError: (err: any) => {
      // Backend faqat CREATED/IN_PROGRESS holatidagi safarni bekor qiladi — noto'g'ri holatда
      // (masalan allaqachon tugagan) yoki boshqa xatoда tushunarli xabar beramiz.
      const status = err?.response?.status;
      toast.error(
        status === 400 || status === 409
          ? tr(
              "Bu safarni hozir bekor qilib bo'lmaydi.",
              'Эту поездку сейчас нельзя отменить.',
              'This trip cannot be cancelled right now.'
            )
          : tr(
              "Safarni bekor qilib bo'lmadi. Keyinroq urinib ko'ring.",
              'Не удалось отменить поездку. Попробуйте позже.',
              'Could not cancel the trip. Please try again later.'
            )
      );
    },
  });

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8 select-none">
      {/* O'ng ustun olib tashlangach 12-ustunli setka kerak emas — kontent
          o'qish uchun qulay kenglikda markazda turadi (juda keng qatorlar
          noutbukda ko'zni charchatadi). */}
      <div className="mx-auto max-w-4xl space-y-6">
        {/* 🔴 SAHIFANING SARLAVHASI (2026-09-04, o'lchandi): panelda
            `h1` UMUMAN yo'q edi va ekran o'qigich sahifani sarlavhalar
            bo'yicha kezganda birinchi ilinadigan narsa «Mening
            safarimga arizalar» bo'lardi — ya'ni odam qaysi sahifada
            ekanini bilmasdi.

            KO'RINMAS: boshqa sahifalarda sarlavha ko'zga ham
            ko'rinadi, lekin panelda uning o'rni yo'q — birinchi
            ekranda daromad kartasi turadi va uni surib yuborish
            haydovchining eng ko'p ochadigan ekranini yomonlashtirardi. */}
        <h1 className="sr-only">{tr('Haydovchi paneli', 'Панель водителя', 'Driver panel')}</h1>
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="space-y-6">
          {/*
            Daromad — `GET /rides/earnings` (swagger 2026-08-03 da sxema oldi).
            Bu yerda faqat IKKI son: umumiy daromad va yakunlangan safarlar; to'liq
            hisob alohida ekranda. Telefonda pastki menyuda 7-element uchun joy yo'q,
            shuning uchun daromadga yagona yo'l — shu karta.
            Ma'lumot kelmasa (401/500) karta UMUMAN chizilmaydi: panelning asosiy
            vazifasi — safarlar, statistika esa qo'shimcha.
          */}
          {earnings.data && (
            <Link
              href={`/${locale}/driver/earnings`}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-text-muted">
                  <Wallet className="h-3.5 w-3.5 text-accent" />
                  {tr('Jami daromad', 'Всего заработано', 'Total earned')}
                </p>
                <p className="mt-1 truncate text-2xl font-extrabold text-foreground">
                  {typeof earnings.data.total_earnings === 'number'
                    ? formatCurrency(earnings.data.total_earnings, locale)
                    : '—'}
                </p>
                {typeof earnings.data.completed_rides === 'number' && (
                  <p className="text-[11px] font-bold text-text-muted">
                    {tr(
                      `${earnings.data.completed_rides} ta yakunlangan safar`,
                      `${earnings.data.completed_rides} завершённых поездок`,
                      `${earnings.data.completed_rides} completed trips`
                    )}
                  </p>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-accent group-hover:underline">
                {tr('Batafsil', 'Подробнее', 'Details')}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}

          {/*
            Mijoz kutayotgan safarlar ro'yxati (CEO 2026-07-30, F2).
            Bittadan ko'p bo'lsagina ko'rsatiladi — bitta safarda ro'yxat ortiqcha
            bosqich bo'lardi. Tanlangani pastdagi blokda ochiladi, so'rovlari bilan.
          */}
          {openTrips.length > 1 && (
            <div className="space-y-2">
              <SectionLabel>
                {tr(
                  `Mijoz kutayotgan safarlar (${openTrips.length})`,
                  `Поездки в ожидании клиентов (${openTrips.length})`,
                  `Trips waiting for passengers (${openTrips.length})`
                )}
              </SectionLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {openTrips.map((trip) => {
                  const isSelected = trip.ID === activeTrip?.ID;
                  // Javob kutayotgan arizalar soni — haydovchi shu raqamga qarab tanlaydi.
                  // normalizeBooking SHART: gateway bronni PascalCase beradi (`Status`),
                  // to'g'ridan `b.status` o'qilsa har doim undefined chiqadi va belgi
                  // HECH QACHON ko'rinmaydi (mock backend bilan tasdiqlangan bug).
                  // PENDING_NEGOTIATION ham SANALADI: pastdagi arizalar paneli uni
                  // ko'rsatadi (632-qator), shu yerda sanalmasa kartada "0" turib,
                  // ochilganda ariza chiqadi — haydovchi arizani umuman ko'rmay ketadi.
                  const pendingCount = (trip.bookings ?? []).filter((b) => {
                    const s = normalizeBooking(b as Record<string, any>).status;
                    return s === 'PENDING' || s === 'PENDING_NEGOTIATION';
                  }).length;
                  return (
                    <div
                      key={trip.ID}
                      /* ⚠️ `min-w-0`: setka bandining standart `min-width: auto`
                         si uzun manzilni («Tashkent, Chilonzor → Samarkand,
                         Registon») qisqartirishga YO'L QO'YMAYDI va kartochka
                         390 px ekranda 9 px tashqariga chiqib kesilib qolardi
                         (o'lchandi 2026-09-03). Ichkarida `truncate` bor edi-yu,
                         u ishlashi uchun butun zanjir `min-w-0` bo'lishi shart. */
                      className={`flex min-w-0 items-center gap-2 rounded-xl border p-3 transition-colors ${
                        isSelected
                          ? 'border-turquoise bg-turquoise-light/40 dark:bg-turquoise/10'
                          : 'border-border bg-surface hover:border-accent'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedTripId(trip.ID)}
                        aria-pressed={isSelected}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            data-user-text
                            className="truncate text-sm font-bold text-foreground"
                          >
                            {trip.origin_address || '—'} → {trip.destination_address || '—'}
                          </span>
                          {pendingCount > 0 && (
                            <span className="shrink-0 rounded-full bg-brand-pink px-2 py-0.5 text-[10px] font-black text-white">
                              {pendingCount}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] font-bold text-text-muted">
                          <span className="shrink-0">
                            {formatTripDateTime(trip.departure_time)}
                          </span>
                          <span className="shrink-0">·</span>
                          <span className="truncate">{tripStatusLabel(trip.status, locale)}</span>
                        </div>
                      </button>
                      {/* Ma'lumot — kartochka BOSILISHI safarni tanlaydi, bu tugma esa
                          e'lonning to'liq mazmunini ochadi (narx, o'rin, belgilar...). */}
                      <button
                        type="button"
                        onClick={() => setDetailsTripId(trip.ID)}
                        aria-label={tr("Safar ma'lumotlari", 'Данные поездки', 'Trip details')}
                        /* ⚠️ Ikonka o'lchami o'zgarmadi, MAYDONI 44 px:
                           bu tugma safar kartochkasining ICHIDA turadi va
                           kichkina bo'lsa kartochkaning o'zi bosilib,
                           boshqa safar tanlanib ketardi. */
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/5 hover:text-accent"
                      >
                        <Info className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTrip ? (
            <div className="rounded-2xl border border-turquoise bg-turquoise-light/40 p-6 shadow-sm space-y-4 dark:bg-turquoise/10">
              <div className="flex items-center justify-between border-b border-turquoise/40 pb-3">
                <div className="flex items-center gap-2">
                  {/* Faol-holat belgisi — turquoise (statik, animatsiyasiz) */}
                  <span className="h-2.5 w-2.5 rounded-full bg-turquoise ring-4 ring-turquoise/25" />
                  <span className="text-sm font-extrabold text-foreground uppercase tracking-wider">
                    {tr('Faol Safar', 'Активная поездка', 'Active trip')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activeTrip.status === 'IN_PROGRESS' && (
                    <TripTimer startMs={getTripStartedMs(activeTrip.ID)} />
                  )}
                  {/* 🔴 Xom status YOZILARDI: o'zbekcha ekranda «ACTIVE»,
                      «IN_PROGRESS» deb turardi (o'lchandi 2026-09-03).
                      Tarjima ro'yxati bitta joyda — `tripStatusLabel`. */}
                  <Badge variant="success">{tripStatusLabel(activeTrip.status, locale)}</Badge>
                </div>
              </div>

              {/* Geofence: manzilga ~300m qolganda avto-so'rov (avtomatik yakunlamaymiz —
                  xavfsizlik uchun haydovchi tasdiqlaydi yoki yopadi). */}
              {showArrivalPrompt && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-turquoise bg-turquoise-light/50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <MapPin className="h-4.5 w-4.5 text-turquoise shrink-0" />
                    {tr(
                      'Manzilga yetdingiz shekilli — safarni yakunlaysizmi?',
                      'Похоже, вы прибыли — завершить поездку?',
                      'Looks like you have arrived — finish the trip?'
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      onClick={() => completeTripMutation.mutate(activeTrip.ID)}
                      isLoading={completeTripMutation.isPending}
                    >
                      {tr('Yakunlash', 'Завершить', 'Finish')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setArrivalDismissed(activeTrip.ID)}
                      aria-label={tr('Yopish', 'Закрыть', 'Close')}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-black/5 transition-colors"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Yo'nalish qatori BOSILADI — e'lonning to'liq kartochkasi ochiladi.
                    Haydovchi "men nima e'lon qildim?" degan savolga shu yerda javob oladi. */}
                <button
                  type="button"
                  onClick={() => setDetailsTripId(activeTrip.ID)}
                  className="group -m-1 rounded-xl p-1 text-left transition-colors hover:bg-turquoise-light/50 dark:hover:bg-turquoise/10"
                >
                  <div className="flex items-center gap-2 font-extrabold text-foreground text-xl">
                    <span>{routeNames?.from || '...'}</span>
                    <span className="text-text-muted">→</span>
                    <span>{routeNames?.to || '...'}</span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-turquoise" />
                  </div>
                  <p className="text-sm text-text-muted font-bold mt-1">
                    {formatTripDateTime(activeTrip.departure_time) || '...'}
                    <span className="ml-2 font-bold text-turquoise-ink group-hover:underline">
                      {tr('Batafsil', 'Подробнее', 'Details')}
                    </span>
                  </p>
                </button>

                <div className="flex flex-wrap gap-2">
                  {/* DRAFT: avval faollashtirish — usiz safar qidiruvda ko'rinmaydi va
                      start ham backend'da 400 bo'ladi. */}
                  {activeTrip.status === 'DRAFT' && (
                    <Button
                      onClick={() => activateTripMutation.mutate(activeTrip.ID)}
                      disabled={activateTripMutation.isPending}
                      isLoading={activateTripMutation.isPending}
                      className="flex-1 min-w-[110px]"
                    >
                      {tr('Faollashtirish', 'Активировать', 'Activate')}
                    </Button>
                  )}
                  <Button
                    onClick={() => startTripMutation.mutate(activeTrip.ID)}
                    // Start faqat ACTIVE safarda ma'noli (draft'da backend 400 beradi).
                    disabled={
                      startTripMutation.isPending ||
                      (activeTrip.status !== 'ACTIVE' && activeTrip.status !== 'CREATED')
                    }
                    isLoading={startTripMutation.isPending}
                    className="flex-1 min-w-[110px]"
                  >
                    {tr('Boshlash', 'Начать', 'Start')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => completeTripMutation.mutate(activeTrip.ID)}
                    disabled={completeTripMutation.isPending || activeTrip.status !== 'IN_PROGRESS'}
                    isLoading={completeTripMutation.isPending}
                    className="flex-1 min-w-[110px]"
                  >
                    {tr('Yakunlash', 'Завершить', 'Finish')}
                  </Button>
                  {/* Navigatsiya — ILOVA ICHIDA marshrut xaritasi (RouteMapSheet). Ilgari bu
                      to'g'ridan yandex.uz saytiga havola edi — PWA/WebView'da ilovadan chiqib
                      ketish bo'lib tuyulardi. Tashqi Navigator endi sheet ichidagi ongli tanlov. */}
                  {hasValidCoords(activeTrip.origin_lat, activeTrip.origin_lon) &&
                    hasValidCoords(activeTrip.destination_lat, activeTrip.destination_lon) && (
                      <button
                        type="button"
                        onClick={() => setRouteSheetOpen(true)}
                        className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-turquoise bg-turquoise-light/40 px-4 py-2 text-sm font-bold text-wine-ash hover:bg-turquoise-light/70 transition-colors dark:bg-turquoise/10 dark:text-turquoise dark:hover:bg-turquoise/20"
                      >
                        <Navigation className="h-4 w-4" />
                        {tr('Navigatsiya', 'Навигация', 'Navigation')}
                      </button>
                    )}
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      // Brauzer oynasi EMAS — ilovaning o'z tasdiq oynasi
                      // (sabablari `useConfirm` izohida).
                      const { ok, text: reasonText } = await confirmWithText({
                        title: tr(
                          'Safarni bekor qilasizmi?',
                          'Отменить поездку?',
                          'Cancel this trip?'
                        ),
                        description: tr(
                          "Bron qilgan yo'lovchilarning arizasi bekor bo'ladi va e'lon qidiruvdan yo'qoladi. Bu amalni qaytarib bo'lmaydi.",
                          'Заявки забронировавших пассажиров будут отменены, объявление исчезнет из поиска. Действие необратимо.',
                          'Bookings from passengers will be cancelled and the listing will disappear from search. This cannot be undone.'
                        ),
                        confirmLabel: tr(
                          'Safarni bekor qilish',
                          'Отменить поездку',
                          'Cancel the trip'
                        ),
                        // SABAB — ilovada ancha oldindan so'ralardi, saytda
                        // esa `cancelRide` sababsiz chaqirilardi (backend
                        // `reason` maydonini QABUL QILADI). Sabab yo'lovchiga
                        // ko'rsatiladi va nizolarda asos bo'ladi.
                        //
                        // ATAYIN majburiy emas: shoshilinch holatda bekor
                        // qilishni matn yozish to'sib qo'ymasligi kerak.
                        promptLabel: tr(
                          "Sabab (ixtiyoriy) — yo'lovchi ko'radi",
                          'Причина (необязательно) — увидит пассажир',
                          'Reason (optional) — the passenger will see it'
                        ),
                        promptPlaceholder: tr(
                          'Masalan: mashina buzildi',
                          'Например: сломалась машина',
                          'e.g. car broke down'
                        ),
                      });
                      if (ok)
                        cancelTripMutation.mutate({
                          tripId: activeTrip.ID,
                          reason: reasonText,
                        });
                    }}
                    disabled={cancelTripMutation.isPending}
                    isLoading={cancelTripMutation.isPending}
                    className="flex-1 min-w-[110px] text-error hover:bg-error/10"
                  >
                    {tr('Bekor qilish', 'Отменить', 'Cancel')}
                  </Button>
                </div>
              </div>

              {/*
                YO'L DARHOL KO'RINADI — 16.09.2026
                (egasi: «karta to'liq ishlatilsin»).

                🔴 Ilgari haydovchi o'z faol safarining yo'lini ko'rish
                uchun «Navigatsiya» tugmasini bosishi kerak edi. Tugma
                o'z joyida qoldi (u varaqni ochadi — u yerda jonli nuqta
                va tashqi navigator bor), lekin YO'LNING O'ZI endi
                panelda turadi: haydovchi oraliq bekatlar qayerdaligini
                bir qarashda ko'radi.
              */}
              {hasValidCoords(activeTrip.origin_lat, activeTrip.origin_lon) &&
                hasValidCoords(activeTrip.destination_lat, activeTrip.destination_lon) && (
                  <RoutePreview
                    from={[activeTrip.origin_lat, activeTrip.origin_lon]}
                    to={[activeTrip.destination_lat, activeTrip.destination_lon]}
                    via={(activeTrip.stops ?? [])
                      .filter((s) => hasValidCoords(s.lat, s.lon))
                      .map((s) => [s.lat, s.lon] as [number, number])}
                    onOpen={() => setRouteSheetOpen(true)}
                    openLabel={tr('Navigatsiya', 'Навигация', 'Navigation')}
                    height={170}
                  />
                )}

              {/* MANIFEST — faqat safar BOSHLANGAN (IN_PROGRESS) va tasdiqlangan yo'lovchi
                  bo'lsa: kim borligi, yig'ilish joyi, har biridan olinadigan naqd va jami.
                  Aloqa = chat (backend yo'lovchi telefonini PII sifatida bermaydi). */}
              {activeTrip.status === 'IN_PROGRESS' && confirmedBookings.length > 0 && (
                <div className="rounded-xl border border-turquoise/40 bg-surface/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
                      <Users className="h-4 w-4 text-turquoise" />
                      {tr("Yo'lovchilaringiz", 'Ваши пассажиры', 'Your passengers')} (
                      {confirmedBookings.length})
                    </span>
                  </div>

                  {/* Yig'ilish nuqtasi — backend bergan bo'lsa (hozircha yo'qolishi mumkin). */}
                  {activeTrip.pickup_point && (
                    <div className="flex items-start gap-1.5 text-xs font-bold text-text-muted">
                      <MapPin className="h-3.5 w-3.5 text-turquoise shrink-0 mt-0.5" />
                      <span>
                        {tr("Yig'ilish joyi: ", 'Место сбора: ', 'Pickup point: ')}
                        <span className="text-text">{activeTrip.pickup_point}</span>
                      </span>
                    </div>
                  )}

                  <ul className="space-y-2">
                    {confirmedBookings.map((b) => {
                      const amount =
                        b.offered_price ?? (activeTrip.price_per_seat ?? 0) * (b.seats ?? 1);
                      const name =
                        b.passenger?.name ||
                        b.passenger_name ||
                        tr("Yo'lovchi", 'Пассажир', 'Passenger');
                      return (
                        <li
                          key={b.ID}
                          className="flex items-center justify-between gap-2 rounded-lg bg-bg/60 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text truncate">{name}</p>
                            <p className="text-[11px] font-bold text-text-muted">
                              {b.seats ?? 1} {tr("o'rin", 'мест', 'seats')} ·{' '}
                              {formatCurrency(amount, locale)}
                            </p>
                          </div>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              router.push(
                                `/${locale}/chat/${activeTrip.ID}?peer=${b.passenger_id ?? ''}&price=${amount}&name=${encodeURIComponent(
                                  b.passenger?.name || b.passenger_name || ''
                                )}`
                              )
                            }
                            className="shrink-0 flex items-center gap-1 !py-1.5 !px-3 text-xs"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            {tr('Chat', 'Чат', 'Chat')}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="flex items-center justify-between border-t border-turquoise/30 pt-2">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wide">
                      {tr(
                        'Jami olinadigan (naqd)',
                        'Итого к получению (нал.)',
                        'Total to collect (cash)'
                      )}
                    </span>
                    <span className="text-base font-black text-foreground">
                      {formatCurrency(collectTotal, locale)}
                    </span>
                  </div>
                </div>
              )}

              {/* Xavfsizlik: safar davomida favqulodda yordam (102 ga qo'ng'iroq). */}
              {activeTrip.status === 'IN_PROGRESS' && <SosButton />}
            </div>
          ) : (
            /* Bo'sh holat — quruq matn o'rniga brend motivi bilan: ikat teksturasi
               (statik, 0.05 shaffoflik) + suzani ajratgichi. Haydovchi panelining
               birinchi taassuroti aynan shu ekran bo'ladi. */
            <EmptyState
              className="rounded-2xl border border-border bg-surface"
              icon={<Navigation />}
              title={tr("Faol safar yo'q", 'Нет активных поездок', 'No active trips')}
              description={tr(
                "Yo'nalishingizni e'lon qiling — yo'lovchilar sizni qidiruvdan topadi.",
                'Опубликуйте маршрут — пассажиры найдут вас через поиск.',
                'Publish your route — passengers will find you in search.'
              )}
              action={
                <Button onClick={() => router.push(`/${locale}/driver/create-trip`)}>
                  {tr('Safar yaratish', 'Создать поездку', 'Create a trip')}
                </Button>
              }
            />
          )}

          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
              {/* Faol-holat belgisi — turquoise, STATIK (animate-ping olib tashlandi) */}
              <span className="inline-flex h-3 w-3 rounded-full bg-turquoise ring-4 ring-turquoise/25" />
              <span>
                {tr('Mening safarimga arizalar', 'Запросы на поездку', 'Requests for my trip')}
              </span>
            </h2>
            <Badge variant="primary">
              {
                // Yakunlanmagan HAMMA ariza sanaladi — savdolashish statusi
                // boshqacha nomlansa ham hisob to'g'ri qoladi.
                bookings.filter((b: Booking) => !isBookingSettled(b.status)).length
              }
            </Badge>
          </div>

          <div className="space-y-4">
            {bookings.length === 0 ? (
              <EmptyState
                /* qulaylik: chiqish yo'li SHART EMAS — KUTISH holati,
                   safar allaqachon e'lon qilingan. */
                className="rounded-2xl border border-border bg-surface shadow-sm"
                icon={<Inbox />}
                title={tr(
                  "Yangi so'rovlar kutilmoqda…",
                  'Ожидание новых запросов…',
                  'Waiting for new requests…'
                )}
                description={tr(
                  "Yo'lovchi bron qilganda so'rov shu yerda paydo bo'ladi.",
                  'Запрос появится здесь, как только пассажир забронирует место.',
                  'A request will appear here as soon as a passenger books a seat.'
                )}
              />
            ) : (
              bookings.map((req) => (
                <div
                  key={req.ID}
                  className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-turquoise"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar
                        src={(req.passenger as { avatar?: string } | undefined)?.avatar}
                        name={req.passenger?.name || req.passenger_name}
                        size={48}
                      />
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-text text-base">
                          {req.passenger?.name ||
                            req.passenger_name ||
                            tr("Yo'lovchi", 'Пассажир', 'Passenger')}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-text-muted font-bold">
                          <Users className="w-3.5 h-3.5 text-accent" />
                          <span>
                            {req.seats ?? 1} {tr("o'rin", 'мест', 'seats')} ·{' '}
                            {/* offered_price yo'q/0 = yo'lovchi E'LON NARXIGA rozi (pending) —
                                "0 so'm" emas, haydovchining o'z narxi ko'rsatiladi. */}
                            {req.offered_price
                              ? `${tr('Taklif:', 'Предложение:', 'Offer:')} ${formatCurrency(req.offered_price, locale)}`
                              : `${tr('Narxingizga rozi', 'Согласен с вашей ценой', 'Agrees with your price')} (${formatCurrency(activeTrip?.price_per_seat ?? 0, locale)})`}
                          </span>
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
                    </div>

                    {/*
                      🔴 Ruxsat ro'yxati emas, RAD ETISH ro'yxati: backend
                      savdolashish statusini boshqacha nomlasa, "Qabul" va
                      "Rad etish" tugmalari butunlay yo'qolib qolardi va
                      haydovchi arizaga javob bera olmasdi.
                    */}
                    {!isBookingSettled(req.status) && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() => confirmBookingMutation.mutate(req.ID)}
                          isLoading={confirmBookingMutation.isPending}
                          className="flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" /> {tr('Qabul', 'Принять', 'Accept')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => rejectBookingMutation.mutate(req.ID)}
                          isLoading={rejectBookingMutation.isPending}
                          className="flex items-center gap-1 text-error"
                        >
                          <XCircle className="w-4 h-4" /> {tr('Rad etish', 'Отклонить', 'Decline')}
                        </Button>
                      </div>
                    )}

                    {req.status === 'ACCEPTED' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            // Chat kaliti = SAFAR + suhbatdosh (booking emas): yangi kontraktda
                            // tarix `/notifications/history?peer_id=&ride_id=` bilan olinadi.
                            router.push(
                              `/${locale}/chat/${activeTrip?.ID}?peer=${req.passenger_id ?? ''}&price=${
                                req.offered_price ?? activeTrip?.price_per_seat ?? 0
                              }&name=${encodeURIComponent(
                                req.passenger?.name || req.passenger_name || ''
                              )}`
                            )
                          }
                          className="flex items-center gap-1"
                        >
                          {tr("Chatga o'tish", 'Перейти в чат', 'Open chat')}
                        </Button>
                        {/* No-show: yo'lovchi kelmadi — reputatsiyaga ta'sir qiladi */}
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            const ok = await confirm({
                              title: tr(
                                "Yo'lovchi kelmadimi?",
                                'Пассажир не явился?',
                                'Passenger did not show up?'
                              ),
                              description: tr(
                                "Belgi uning reputatsiyasiga ta'sir qiladi va uni orqaga qaytarib bo'lmaydi. Faqat yo'lovchi haqiqatan kelmagan bo'lsa qo'ying.",
                                'Отметка повлияет на его репутацию, и её нельзя отменить. Ставьте только если пассажир действительно не пришёл.',
                                'This mark affects their reputation and cannot be undone. Use it only if the passenger really did not come.'
                              ),
                              confirmLabel: tr(
                                'Kelmadi deb belgilash',
                                'Отметить неявку',
                                'Mark as no-show'
                              ),
                            });
                            if (ok) noShowMutation.mutate(req.ID);
                          }}
                          isLoading={noShowMutation.isPending}
                          className="flex items-center gap-1 text-error"
                        >
                          {tr('Kelmadi', 'Не явился', 'No-show')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/*
          O'NG USTUN OLIB TASHLANDI (CEO 2026-07-30). Bu yerda "Radar balansingiz"
          va "Radar tariflari" setkasi turardi. Talab bo'yicha balans va amaldagi
          tarif "Safar yaratish" ekranida ko'rsatiladi (CurrentPlanCard), tarif
          sotib olish esa /tariffs sahifasida — bu panel faqat SAFARLAR haqida.
        */}
      </div>

      {/* Safar yakuni hisoboti — yakunlangach bir marta ko'rsatiladi. */}
      {tripSummary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setTripSummary(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-turquoise-light/60 text-turquoise dark:bg-turquoise/15">
                <CheckCircle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">
                {tr('Safar yakunlandi', 'Поездка завершена', 'Trip completed')}
              </h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-bg/60 px-4 py-2.5">
                <span className="text-sm font-bold text-text-muted">
                  {tr("Yo'lovchilar", 'Пассажиров', 'Passengers')}
                </span>
                <span className="text-sm font-extrabold text-text">{tripSummary.passengers}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-bg/60 px-4 py-2.5">
                <span className="text-sm font-bold text-text-muted">
                  {tr("Yig'ilgan (naqd)", 'Собрано (нал.)', 'Collected (cash)')}
                </span>
                <span className="text-sm font-extrabold text-text">
                  {formatCurrency(tripSummary.total, locale)}
                </span>
              </div>
              {tripSummary.durationMs > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-bg/60 px-4 py-2.5">
                  <span className="text-sm font-bold text-text-muted">
                    {tr('Davomiyligi', 'Длительность', 'Duration')}
                  </span>
                  <span className="text-sm font-extrabold text-text">
                    {durationText(tripSummary.durationMs)}
                  </span>
                </div>
              )}
            </div>
            <Button onClick={() => setTripSummary(null)} className="w-full">
              {tr('Yopish', 'Закрыть', 'Close')}
            </Button>
          </div>
        </div>
      )}

      {/* Marshrut xaritasi — ilova ichида; tashqi Navigator sheet ichidan ixtiyoriy */}
      {activeTrip &&
        hasValidCoords(activeTrip.origin_lat, activeTrip.origin_lon) &&
        hasValidCoords(activeTrip.destination_lat, activeTrip.destination_lon) && (
          <RouteMapSheet
            isOpen={routeSheetOpen}
            onClose={() => setRouteSheetOpen(false)}
            from={[activeTrip.origin_lat, activeTrip.origin_lon]}
            to={[activeTrip.destination_lat, activeTrip.destination_lon]}
            via={(activeTrip.stops ?? [])
              .filter((s) => hasValidCoords(s.lat, s.lon))
              .map((s) => [s.lat, s.lon] as [number, number])}
            fromLabel={activeTrip.origin_address}
            toLabel={activeTrip.destination_address}
          />
        )}

      {/* E'lonning to'liq kartochkasi (chipta ko'rinishida) */}
      <TripDetailsSheet
        trip={detailsTrip}
        isOpen={detailsTrip !== null}
        onClose={() => setDetailsTripId(null)}
      />
      {confirmDialog}
    </div>
  );
}
