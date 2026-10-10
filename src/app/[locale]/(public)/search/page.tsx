'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { searchRides } from '@/shared/api/rides';
import { cacheRides } from '@/shared/api/rideCache';
import type { RideSearchItem } from '@/shared/api/types/ride';
import { EmptyState, PeshtoqBadge } from '@/shared/ui/EmptyState';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { CityAutocomplete } from '@/shared/ui/CityAutocomplete';
import { Counter } from '@/shared/ui/Counter';
import { DateField, formatDateKey } from '@/shared/ui/DateField';
import { DateStrip } from '@/shared/ui/DateStrip';
import { Badge } from '@/shared/ui/Badge';
import { Skeleton } from '@/shared/ui/Skeleton';
import { RatingBadge } from '@/shared/ui/StarRating';
import { SeatMap } from '@/shared/ui/SeatMap';
import { WatchRouteButton } from '@/features/search/WatchRouteButton';
import { RecentRides } from '@/features/search/RecentRides';
import {
  dateToRangeISO,
  formatCurrency,
  formatTripDateTime,
  departureStatusLabel,
  isRideBookable,
  isTripOpen,
  normalizeStatus,
  personName,
  tashkentLocalDate,
  tashkentNow,
} from '@/shared/lib/format';
import { forwardGeocode, haversineKm } from '@/shared/lib/geo';
import { resolveCityCoord, nearestCityName } from '@/shared/data/uzCities';
import { useUIStore } from '@/shared/model/uiStore';
import { useProfile } from '@/entities/user/api/useProfile';
import { getRecentRoutes, addRecentRoute, type RecentRoute } from '@/shared/lib/recentRoutes';
import { getStoredFilters, saveFilters } from '@/shared/lib/searchFilters';
import { toast } from 'sonner';
import {
  ArrowRight,
  Calendar,
  User,
  RefreshCw,
  SearchX,
  Search,
  Package,
  MapPin,
  ArrowUpDown,
  Map as MapIcon,
  List as ListIcon,
  Wallet,
  Clock,
  Scale,
  SlidersHorizontal,
  Venus as VenusIcon,
  X,
} from 'lucide-react';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import Link from 'next/link';
import { MapPicker } from '@/shared/ui/MapPicker';
import { getAccessToken } from '@/shared/lib/token';
import { RecommendedRides } from '@/features/recommendations/RecommendedRides';
import { ResultsMap } from '@/shared/ui/ResultsMap';
import { VoiceInputButton } from '@/shared/ui/VoiceInputButton';
import { parseVoiceRoute } from '@/shared/lib/voiceRoute';
import { fetchRoadRoute } from '@/shared/api/routing';
import { useTr } from '@/shared/lib/useTr';
import { AnalyticsEvent, logEvent } from '@/shared/lib/analytics';
import { rideFeatureIcons, rideFeatureLabels, rideFeatures } from '@/shared/ui/rideFeatures';
import type { LucideIcon } from 'lucide-react';

// Frontend ichida ishlatiladigan normallashtirilgan shakl (RideSearchItem'dan).
interface Trip {
  id: string;
  from: string;
  to: string;
  price: number;
  date: string; // YYYY-MM-DD (Toshkent) — sana filtri uchun
  departureTime: string; // UTC ISO — ko'rsatish uchun
  driver: string;
  driverRating?: number;
  driverReviews?: number;
  /** Haydovchi UUID — profil havolasi uchun (kelmasa havola chizilmaydi). */
  driverId?: string;
  /** Jo'nash nuqtasi — XARITA ko'rinishi uchun (kelmasa belgi chizilmaydi). */
  originLat?: number;
  originLon?: number;
  seats: number;
  /** Jami o'rindiq — sxema chizish uchun (`seats` esa BO'SHLARI). */
  totalSeats?: number;
  status: string; // CREATED | IN_PROGRESS | COMPLETED | CANCELLED
  acceptsParcel: boolean;
  hasAC: boolean;
  hasLuggage: boolean;
  noSmoking: boolean;
  noPets: boolean;
  drivingSpeed?: string; // calm | normal | fast
  maxTwoBack: boolean;
  /**
   * `'female'` — haydovchi bu safarga faqat ayol yo'lovchi oladi.
   * Bo'sh satr yoki `undefined` — cheklovsiz.
   *
   * ⚠️ Haydovchining jinsi EMAS (backend uni umuman bermaydi).
   */
  genderRestriction?: string;
  /** Backend hisoblagan "adolatli narx" belgisi — yo'lovchiga tanlashda yordam beradi. */
  fairPrice: boolean;
  /** Oraliq shaharlar nomi ("Orqali: ..." qatori uchun) */
  stops: string[];
  // Qidirilgan "qayerdan" nuqtasidan jo'nash nuqtasigacha masofa (km) — saralash + belgi uchun.
  distanceKm?: number;
}

function SearchContent() {
  const t = useTranslations('Trips');
  const locale = useLocale();
  const searchParams = useSearchParams();

  const tr = useTr();

  const { setActiveRole } = useUIStore();

  const defaultFrom = searchParams.get('from') || '';
  const defaultTo = searchParams.get('to') || '';
  // Landing qidiruv paneli date va seats'ni ham URL'ga qo'yadi (ilgari o'qilmasdan yo'qolardi).
  const defaultDate = searchParams.get('date') || '';
  const defaultSeats = Number(searchParams.get('seats'));

  const [filterFrom, setFilterFrom] = useState(defaultFrom);
  const [filterCoords, setFilterCoords] = useState<[number, number]>([41.311081, 69.240562]); // Default to Tashkent
  // "Qayerdan" XARITADAN tanlanganmi? Ha bo'lsa — LOKATSIYA rejimi: shahar nomi bilan filtrlamay,
  // faqat shu nuqtaga eng yaqin safarlarni (masofa bo'yicha) ko'rsatamiz. Yo'q bo'lsa — nom rejimi.
  const [fromByMap, setFromByMap] = useState(false);
  const [filterTo, setFilterTo] = useState(defaultTo);
  // Bo'sh = sana bo'yicha filtrlanmaydi (barcha safarlar ko'rinadi). Foydalanuvchi
  // sanani tanlasagina o'sha kungi safarlar bo'yicha filtrlaymiz.
  // Default sana — BUGUN (Toshkent). O'tib ketgan kunlarni ko'rsatmaymiz.
  // Sana — landing'dan kelsa o'shani, aks holda bugun (Toshkent).
  const [filterDate, setFilterDate] = useState(() => defaultDate || tashkentNow().date);
  const [passengerCount, setPassengerCount] = useState(() =>
    defaultSeats >= 1 && defaultSeats <= 6 ? defaultSeats : 1
  );

  /**
   * 🔴 "Faqat ayollar" filtri OLIB TASHLANDI (egasi, 2026-08-13): «faqat
   * ayollar cheklovi olib tashlansin, erkaklar ham uni qidira olsin».
   * Safar hammaga ochiq — na qidiruvda, na ariza berishda jins tekshirilmaydi.
   */

  /**
   * Qo'shimcha filtrlar — HAMMASI bitta obyektda va bitta shtorka ichida.
   *
   * NEGA shunday: chap panel allaqachon to'la (yo'nalish, sana, yo'lovchi soni,
   * "Qidirish"), unga yana 8 ta filtr qo'shilsa forma ekranga sig'masdi. Endi
   * panelda faqat CHIPLAR qatori turadi ("Filtrlar · N", eng ko'p ishlatiladigan
   * 2 ta tez tugma), qolgani shtorkada — joy egallamaydi.
   *
   * Narx SERVERDA filtrlanadi (backend §1), qulaylik belgilari esa backendda
   * parametr sifatida YO'Q — ular topilgan natijalar ichida filtrlanadi (buni
   * foydalanuvchiga shtorkada ochiq yozib qo'yamiz, "yashirin qirqish" bo'lmasin).
   */
  type ComfortKey = 'ac' | 'luggage' | 'noSmoking' | 'noPets' | 'twoBack' | 'parcel';
  interface ExtraFilters {
    priceMin: string;
    priceMax: string;
    /**
     * «Faqat ayollar» — haydovchining SALON haqidagi e'loni
     * (`gender_restriction === 'female'`), uning JINSI emas: erkak
     * haydovchi ham «bu safarga faqat ayol yo'lovchi olaman» deya
     * oladi (egasi, 08.09.2026).
     *
     * 🔴 QOLGAN FILTRLARDAN FARQI — SERVER filtri: cheklovli safar
     * oddiy qidiruv javobiga UMUMAN kirmaydi (08.09.2026 da prodda
     * o'lchandi — ketma-ket 6 ta so'rovda ham chiqmadi). Shuning
     * uchun u `queryKey` da ham, so'rov parametrida ham bor.
     */
    women: boolean;
    ac: boolean;
    luggage: boolean;
    noSmoking: boolean;
    noPets: boolean;
    twoBack: boolean;
    parcel: boolean;
    speed: '' | 'calm' | 'normal' | 'fast';
    sort: 'distance' | 'price' | 'time';
  }
  const EMPTY_EXTRA: ExtraFilters = {
    priceMin: '',
    priceMax: '',
    women: false,
    ac: false,
    luggage: false,
    noSmoking: false,
    noPets: false,
    twoBack: false,
    parcel: false,
    speed: '',
    sort: 'distance',
  };
  const [extra, setExtra] = useState<ExtraFilters>(EMPTY_EXTRA);

  /*
   * SAQLANGAN FILTRLARNI TIKLASH (2026-09-05, qulaylik auditi).
   *
   * ⚠️ `useState` ning boshlang'ich qiymatida O'QIB BO'LMAYDI:
   * `localStorage` faqat brauzerda bor va serverda chizilgan HTML
   * bilan mos kelmay hydration xatosi berardi. Shuning uchun
   * effektda — birinchi kadrdan keyin.
   *
   * 🔑 Narx SAQLANMAYDI, sababi `searchFilters.ts` da.
   */
  useEffect(() => {
    const saved = getStoredFilters();
    if (Object.keys(saved).length === 0) return;
    setExtra((prev) => ({ ...prev, ...saved }));
    // `draft` ga tegmaymiz: shtorka ochilganda `openFilters` uni
    // `extra` dan nusxalaydi (pastda), ya'ni u o'zi mos keladi.
  }, []);

  useEffect(() => {
    saveFilters({
      women: extra.women,
      ac: extra.ac,
      luggage: extra.luggage,
      noSmoking: extra.noSmoking,
      noPets: extra.noPets,
      twoBack: extra.twoBack,
      parcel: extra.parcel,
      speed: extra.speed,
      sort: extra.sort,
    });
  }, [extra]);
  // Shtorka ichidagi "qoralama": har bir bosishda qidiruv qayta yugurmasin —
  // o'zgarishlar "Ko'rsatish" bosilgandagina qo'llanadi.
  const [draft, setDraft] = useState<ExtraFilters>(EMPTY_EXTRA);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const openFilters = () => {
    setDraft(extra);
    setFiltersOpen(true);
  };
  // Qidiruvda faqat "qayerdan" uchun xarita bor (manzil xaritadan tanlanmaydi).
  const [openMap, setOpenMap] = useState<'from' | null>(null);

  // Устанавливаем роль пассажира
  useEffect(() => {
    setActiveRole('passenger');
  }, [setActiveRole]);

  // URL parametrlari o'zgarsa (masalan landing "Mashhur yo'nalishlar" kartochkasidan).
  useEffect(() => {
    if (defaultFrom) setFilterFrom(defaultFrom);
  }, [defaultFrom]);
  useEffect(() => {
    if (defaultTo) setFilterTo(defaultTo);
  }, [defaultTo]);

  // Qidiruv FAQAT "Qidirish" tugmasi bosilganda ishga tushadi (avtomatik emas).
  // `submitted` — tugma bosilganda qotirilgan origin/dest koordinatalari. null bo'lsa hali
  // qidirilmagan → boshlang'ich holat ko'rsatiladi ("topilmadi" emas).
  const [submitted, setSubmitted] = useState<{
    origin: [number, number];
    dest: [number, number];
  } | null>(null);

  // Yangi Gateway kontrakti (jonli tasdiqlangan 2026-07-18): `GET /rides/search` FAQAT
  // koordinata bilan qidiradi va origin HAM dest HAM MAJBURIY (dest'siz 400) —
  // shuning uchun "qayerga" maydoni ham to'ldirilishi shart.
  const DEFAULT_ORIGIN: [number, number] = [41.311081, 69.240562];
  // radius_km — origin VA dest ikkalasidan (AND, backend tasdig'i xat v5 №7.5); default 25.
  const DEFAULT_RADIUS_KM = 25;
  /** Taklif so'rovi uchun — butun O'zbekistonni qoplaydi. */
  const COUNTRY_RADIUS_KM = 700;
  /** Taklifga faqat SHU shahardan chiqadigan safarlar kiradi. */
  const NEAR_ORIGIN_KM = 60;
  /**
   * 🔴 RADIUSNI KENGAYTIRISH TUGMASI OLIB TASHLANDI (egasi, qurilmada
   * 2026-08-19): "Toshkentdan Andijonga qidirdim, chiqmadi; 100 km
   * qo'shdim — Toshkentdan CHORTOQQA chiqardi".
   *
   * Sabab: `radius_km` backendda jo'nash VA manzil nuqtasining IKKALASIGA
   * qo'llanadi. Radiusni oshirish "shu yo'nalishni kengroq qidir" degani
   * emas — u BOSHQA MANZILLARNI ham natijaga qo'shadi. Odam Andijonga
   * so'rab, Chortoqqa safar ko'radi va buni xato deb qabul qiladi. U haq:
   * javob so'ralgan savolga mos emas.
   *
   * O'rniga: manzillar YASHIRINCHA aralashtirilmaydi, balki OCHIQ taklif
   * qilinadi — "bu yo'nalishda safar yo'q, lekin Toshkentdan bu shaharlarga
   * bor: ..." (pastdagi `alternatives`).
   */
  const [resolving, setResolving] = useState(false);
  // Oxirgi yo'nalishlar — localStorage'dan (mijozda), qidiruvdan keyin yangilanadi.
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  useEffect(() => {
    setRecentRoutes(getRecentRoutes());
  }, []);

  // override — oxirgi-yo'nalish chipidan qidirilganda (state async yangilanadi, shu sabab
  // qiymatlarni to'g'ridan uzatamiz).
  const runSearch = async (override?: { from?: string; to?: string }) => {
    setResolving(true);
    try {
      const fromTxt = (override?.from ?? filterFrom).trim();
      const toTxt = (override?.to ?? filterTo).trim();
      if (!toTxt) {
        toast.error(
          tr(
            'Qayerga borishingizni kiriting',
            'Укажите, куда вы едете',
            'Enter where you are going'
          )
        );
        return;
      }
      // "Qayerdan" koordinatasi: kanonik shahar ro'yxati -> xaritadan tanlangan nuqta -> geokod.
      let origin = filterCoords;
      const originCity = fromTxt ? resolveCityCoord(fromTxt) : null;
      if (originCity && !fromByMap) {
        origin = originCity.coord;
      } else if (fromTxt && !fromByMap) {
        const isDefaultOrigin =
          Math.abs(origin[0] - DEFAULT_ORIGIN[0]) < 1e-6 &&
          Math.abs(origin[1] - DEFAULT_ORIGIN[1]) < 1e-6;
        if (isDefaultOrigin) {
          const g = await forwardGeocode(fromTxt);
          if (g) origin = g;
        }
      }
      // "Qayerga" koordinatasi — MAJBURIY: kanonik ro'yxat, bo'lmasa forward geocode.
      const arrCity = resolveCityCoord(toTxt);
      const dest: [number, number] | null = arrCity?.coord ?? (await forwardGeocode(toTxt));
      if (!dest) {
        toast.error(
          tr(
            'Manzil topilmadi — shahar nomini tekshiring',
            'Пункт назначения не найден — проверьте название города',
            'Destination not found — check the city name'
          )
        );
        return;
      }
      setSubmitted({ origin, dest });
      // Muvaffaqiyatli qidiruvni oxirgi yo'nalishlarga saqlaymiz (ikkalasi ham to'la bo'lsa).
      addRecentRoute(fromTxt, toTxt);
      setRecentRoutes(getRecentRoutes());
    } finally {
      setResolving(false);
    }
  };

  // Login holati faqat mijozda ma'lum (localStorage) — hydration mosligi uchun effect'da
  // o'qiymiz. null = hali aniqlanmagan (SSR/birinchi render), false = kirilmagan.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  // Avto-qidiruv FAQAT to'liq yo'nalish (from VA to) URL'da bo'lganda ishga tushadi —
  // masalan landing'dagi "Mashhur yo'nalishlar" kartochkasidan kelinganda. Ilgari sahifa
  // ochilishi bilan shaharsiz avto-qidiruv butun O'zbekiston safarlarini ko'rsatib yuborardi
  // (foydalanuvchining "qayerdan"ini e'tiborsiz qoldirib). Yo'nalishsiz kelsa — foydalanuvchi
  // maydonlarni to'ldirib "Qidirish"ni o'zi bosadi (bo'sh bosilsa hammasi baribir chiqadi).
  useEffect(() => {
    setIsAuthed(!!getAccessToken());
    if (!submitted && defaultFrom.trim() && defaultTo.trim()) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Получаем список поездок
  const {
    data: trips = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<Trip[]>({
    // MUHIM: filtrlar endi SERVER parametri, shuning uchun ularning hammasi
    // queryKey'da bo'lishi SHART — aks holda filtr o'zgarganda React Query
    // eski (filtrlanmagan) natijani keshdan qaytaraveradi.
    queryKey: [
      'search-trips',
      submitted?.origin[0] ?? null,
      submitted?.origin[1] ?? null,
      submitted?.dest[0] ?? null,
      submitted?.dest[1] ?? null,
      passengerCount,
      filterDate,
      extra.priceMin,
      extra.priceMax,
      extra.women,
    ],
    queryFn: async () => {
      // 2026-07-31: sana/gender/narx filtrlari SERVERGA ko'chirildi. Ilgari ular
      // klientda hisoblanardi va yolg'on natija berardi — foydalanuvchi "50 minggacha"
      // desa, backend qaytargan qismdan tashqaridagi arzonroq safar ko'rinmay qolardi.
      const range = dateToRangeISO(filterDate);
      const query = {
        origin_lat: submitted!.origin[0],
        origin_lon: submitted!.origin[1],
        dest_lat: submitted!.dest[0],
        dest_lon: submitted!.dest[1],
        radius_km: DEFAULT_RADIUS_KM,
        min_seats: passengerCount,
        // Tanlangan kundan BOSHLAB (yuqori chegara qo'yilmaydi — foydalanuvchi
        // bitta kun tanlaydi, lekin keyingi kunlardagi safarlar ham kerak bo'ladi).
        ...(range.from ? { date_from: range.from } : {}),
        ...(extra.priceMin ? { price_min: Number(extra.priceMin) } : {}),
        ...(extra.priceMax ? { price_max: Number(extra.priceMax) } : {}),
        // ⚠️ AYNAN `female`: boshqa qiymatda backend 400 qaytaradi
        // (o'lchandi). Filtr yoqilmasa parametr UMUMAN yuborilmaydi —
        // uning o'zi natijani o'zgartiradi.
        ...(extra.women ? { gender_restriction: 'female' } : {}),
      };

      let raw: RideSearchItem[] = await searchRides(query);

      /*
       * 🔴 «AYOLLAR UCHUN» SO'ROVI BEQAROR — BIR MARTA QAYTA URINAMIZ.
       *
       * 08.09.2026 da prodda o'lchandi (5 daqiqa, har 60 soniyada bitta
       * so'rov): bir xil so'rov navbatma-navbat 6 ta va 0 ta natija
       * qaytardi. Ikkinchi urinish katta ehtimol bilan to'la ro'yxatni
       * beradi.
       *
       * Odatda qayta urinish xatoni yashiradi va biz bunday qilmaymiz.
       * Bu yerda narx boshqacha: ayol odam «safar yo'q ekan» degan
       * YOLG'ON xulosaga keladi. Backend tuzatgach bu blok o'chadi.
       * Ilovadagi juftligi — `RidesRepository.search`.
       */
      if (extra.women && raw.length === 0) {
        raw = await searchRides(query);
      }

      // GET /rides/{id} gateway'da YO'Q — trip/bidding sahifalari uchun natijani keshlaymiz.
      cacheRides(raw);

      /*
       * 🔴 STATISTIKANING ENG QIMMATLI HODISASI.
       *
       * Natija SONI bilan birga yuboriladi — shuning uchun "talab bor,
       * taklif yo'q" yo'nalishlar ko'rinadi: odamlar qidiryapti, lekin
       * safar chiqmayapti. Bu qayerga haydovchi jalb qilish kerakligini
       * aytadi va boshqa hech qanday manbadan olib bo'lmaydi.
       *
       * Aniq koordinata YUBORILMAYDI (maxfiylik: `shared/lib/analytics.ts`).
       */
      logEvent(AnalyticsEvent.search, {
        results: raw.length,
        seats: passengerCount,
        has_date: !!filterDate,
        has_price_filter: !!(extra.priceMin || extra.priceMax),
      });

      const searchOrigin = submitted!.origin;
      // Manzil matni TO'G'RIDAN backenddan (origin_address/destination_address) —
      // reverse-geocode BUTUNLAY YO'Q.
      return raw.map((t): Trip => {
        const distanceKm =
          t.origin_lat != null && t.origin_lon != null
            ? haversineKm(searchOrigin, [t.origin_lat, t.origin_lon])
            : undefined;
        return {
          id: String(t.id),
          from: t.origin_address || '—',
          to: t.destination_address || '—',
          price: t.price_per_seat ?? 0,
          date: tashkentLocalDate(t.departure_time),
          departureTime: t.departure_time || '',
          driver: personName(t.driver),
          driverRating: t.driver?.rating,
          driverReviews: undefined,
          driverId: t.driver?.id,
          originLat: t.origin_lat ?? undefined,
          originLon: t.origin_lon ?? undefined,
          seats: t.available_seats ?? t.total_seats ?? 1,
          totalSeats: t.total_seats ?? undefined,
          // Gateway statuslari kichik harfda (active/...) — KATTA harfga normallashtiramiz.
          status: normalizeStatus(t.status || 'ACTIVE'),
          acceptsParcel: !!t.takes_parcels,
          hasAC: !!t.has_ac,
          hasLuggage: !!t.has_luggage,
          noSmoking: !!t.no_smoking,
          noPets: !!t.no_pets,
          drivingSpeed: t.driving_speed,
          maxTwoBack: !!t.max_two_back,
          genderRestriction: t.gender_restriction || undefined,
          fairPrice: !!t.has_fair_price_badge,
          stops: (t.stops ?? []).map((s) => s.address).filter(Boolean),
          distanceKm,
        };
      });
    },
    // 2026-08-02 JONLI TEKSHIRUV: `GET /rides/search` gateway'da OCHIQ — tokensiz
    // 200 qaytaradi (swagger'da ham `security` yo'q). Bu yerdagi eski
    // "Bearer auth talab qiladi" sharti ESKI MONOLIT (`/trips/search`) dan qolgan
    // edi va mehmonga bironta safarni ko'rsatmasdi. Endi faqat "Qidirish"
    // bosilganini kutamiz.
    enabled: !!submitted,
  });

  // 2026-07-31: sana, gender, o'rindiq va NARX endi SERVERDA filtrlanadi
  // (backend §1 — jonli tekshirilgan: price_min=abc -> 400, ya'ni parametr
  // haqiqatan o'qiladi). Shu sabab bu yerda faqat ikkita narsa qoldi:
  //   1) yaroqlilik himoyasi — status va jo'nash vaqti bo'yicha, endi
  //      alohida `bookableTrips` da (10.09.2026);
  //   2) saralash — eng yaqin jo'nash nuqtasi tepada.
  //
  // 2026-08-03 qo'shildi: qulaylik belgilari (konditsioner, bagaj, chekilmaydi,
  // hayvonsiz, orqada 2 kishi, pochta) va haydash uslubi. Bular `GET /rides/search`
  // da PARAMETR sifatida YO'Q (RideSearchParams'ga qarang) — javobda esa BOR,
  // shuning uchun topilgan natijalar ichida filtrlanadi. Foydalanuvchi buni bilishi
  // uchun shtorkada izoh yozilgan.
  /**
   * YAROQLI SAFARLAR — foydalanuvchi filtrlaridan OLDIN.
   *
   * 🔴 NEGA AJRATILDI (10.09.2026, jonli o'lchov): backend jo'nash vaqti
   * o'tgan safarni HAMON `active` deb qaytaradi (o'lchandi: 5 tadan 3
   * tasi 4–5-sentabrda ketgan edi). Ularni oddiygina `filteredTrips`
   * ichida kessak, pastdagi `hiddenByFilters` ularni ham sanardi va
   * odam HECH QANDAY filtr yoqmagan holda "filtrlar hammasini yashirdi"
   * degan xabarni, ustiga "Filtrlarni tozalash" tugmasini ko'rardi —
   * bosilganda hech nima o'zgarmaydigan tugma.
   *
   * Endi ikki bosqich: avval safar O'ZI yaroqlimi, keyin foydalanuvchi
   * nima tanlagani. Ilovada ayni shunday: `SearchFilters.isBookable`.
   */
  const bookableTrips = useMemo(
    () => trips.filter((trip) => isRideBookable(trip.status, trip.departureTime)),
    [trips]
  );

  const filteredTrips = useMemo(() => {
    const filtered = bookableTrips.filter((trip) => {
      // Parametr yuborilgani natijani KESMAYDI — server aralash
      // ro'yxat qaytaradi (08.09.2026: 6 tadan 5 tasi cheklovsiz edi).
      if (extra.women && trip.genderRestriction !== 'female') return false;
      if (extra.ac && !trip.hasAC) return false;
      if (extra.luggage && !trip.hasLuggage) return false;
      if (extra.noSmoking && !trip.noSmoking) return false;
      if (extra.noPets && !trip.noPets) return false;
      if (extra.twoBack && !trip.maxTwoBack) return false;
      if (extra.parcel && !trip.acceptsParcel) return false;
      if (extra.speed && trip.drivingSpeed !== extra.speed) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (extra.sort === 'price') return a.price - b.price;
      if (extra.sort === 'time')
        return (a.departureTime || '').localeCompare(b.departureTime || '');
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }, [bookableTrips, extra]);

  /**
   * Narx konteksti — natijalarning MEDIAN narxi.
   *
   * 🔴 MEDIAN, o'rtacha EMAS: bitta juda qimmat e'lon o'rtachani tortib
   * ketadi va qolgan hammasi "arzon" bo'lib chiqardi.
   *
   * ⚠️ 3 tadan kam natijada `null`: ikkita e'lon orasidagi "o'rtacha"
   * odamga hech nima aytmaydi, lekin ishonchli raqamdek ko'rinadi.
   *
   * Ilovadagi `_medianPrice` bilan BIR XIL qoida.
   */
  /*
   * RO'YXAT yoki XARITA. Standart — ro'yxat: u tezroq o'qiladi va aynan
   * shu ko'rinishga odam o'rgangan. Xarita — ATAYIN tanlanadigan holat.
   */
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  /*
   * FILTR / SARALASH / YANGI QIDIRUV o'zgarsa — ro'yxat TEPADAN boshlansin.
   *
   * 🔴 Egasi (2026-08-21): «cardlar tepaga qaytmayapti». Filtr almashganda
   * ro'yxat butunlay boshqa bo'ladi-yu, siljish o'sha joyda qolardi — odam
   * yangi ro'yxatning O'RTASIDAN chiqib, birinchi (eng mos) natijalarni
   * ko'rmasdi.
   *
   * `smooth` ATAYIN: to'satdan sakrash "sahifa qayta yuklandi" degandek
   * ko'rinadi. Birinchi chizishda ishlamaydi — pastda `submitted` bor.
   */
  useEffect(() => {
    if (!submitted) return;
    if (typeof window === 'undefined') return;
    if (window.scrollY <= 0) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [submitted, extra]);

  /**
   * Yo'l davomiyligi — YO'NALISH bo'yicha BITTA so'rov.
   *
   * 🔴 NEGA har kartochka uchun emas: yigirmata natija = yigirmata so'rov
   * bo'lardi. Qidiruv natijalari esa deyarli har doim BITTA shahar
   * juftligi — shuning uchun so'rov `submitted` yo'nalishi bo'yicha
   * ketadi va hamma kartochkaga bir xil qiymat tushadi.
   *
   * ⚠️ Ma'lumot serverda ALLAQACHON bor edi (`/routing/route`), lekin
   * faqat xarita chizishda ishlatilardi.
   */
  /*
   * KUNLAR BO'YICHA SANOQ — sana lentasi uchun (`DateStrip`).
   *
   * BITTA sanasiz qidiruv, natija kunlar bo'yicha sanaladi. Sana
   * filtri queryKey'da ATAYIN yo'q: ro'yxat sana o'zgarganda qayta
   * so'ralmasligi kerak, u butun ikki haftani ko'rsatadi.
   *
   * ⚠️ Ilovadagi juftligi — `ridesPerDayProvider`. Qoida bir xil:
   * son to'qib chiqarilmaydi, faqat rost javobdan sanaladi.
   */
  const { data: dayCounts } = useQuery({
    queryKey: [
      'search-day-counts',
      submitted?.origin[0] ?? null,
      submitted?.origin[1] ?? null,
      submitted?.dest[0] ?? null,
      submitted?.dest[1] ?? null,
      passengerCount,
    ],
    enabled: !!submitted,
    staleTime: 60_000,
    queryFn: async () => {
      const raw: RideSearchItem[] = await searchRides({
        origin_lat: submitted!.origin[0],
        origin_lon: submitted!.origin[1],
        dest_lat: submitted!.dest[0],
        dest_lon: submitted!.dest[1],
        radius_km: DEFAULT_RADIUS_KM,
        min_seats: passengerCount,
      });

      const counts: Record<string, number> = {};
      const now = Date.now();
      for (const t of raw) {
        const at = t.departure_time ? new Date(t.departure_time) : null;
        // O'tgan safarlar sanalmaydi — ularni tanlab bo'lmaydi.
        if (!at || Number.isNaN(at.getTime()) || at.getTime() < now) continue;
        if (!isTripOpen(t.status)) continue;
        const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(at.getDate()).padStart(2, '0')}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    },
  });

  const { data: routeInfo } = useQuery({
    queryKey: [
      'route-corridor',
      submitted?.origin[0] ?? null,
      submitted?.origin[1] ?? null,
      submitted?.dest[0] ?? null,
      submitted?.dest[1] ?? null,
    ],
    enabled: !!submitted,
    staleTime: 10 * 60_000,
    queryFn: () => fetchRoadRoute([submitted!.origin, submitted!.dest]),
  });

  const medianPrice = useMemo(() => {
    const prices = filteredTrips
      .map((t) => t.price)
      .filter((p) => typeof p === 'number' && p > 0)
      .sort((a, b) => a - b);
    if (prices.length < 3) return null;
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 === 1 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  }, [filteredTrips]);

  /*
   * Xarita belgilari — FAQAT koordinatasi bor natijalardan. Koordinatasiz
   * safar tashlab yuboriladi (nol nuqtaga qo'yish Afrika o'rtasiga belgi
   * chizib qo'yardi), lekin u ro'yxatda qoladi.
   */
  const mapPoints = useMemo(
    () =>
      filteredTrips
        .filter((t) => typeof t.originLat === 'number' && typeof t.originLon === 'number')
        .map((t) => ({
          id: t.id,
          lat: t.originLat as number,
          lon: t.originLon as number,
          priceLabel: formatCurrency(t.price, locale),
          title: `${t.from} → ${t.to}`,
          subtitle:
            departureStatusLabel(t.departureTime, t.status, locale) ||
            formatTripDateTime(t.departureTime),
          href: `/${locale}/trip/${t.id}`,
        })),
    [filteredTrips, locale]
  );

  // Formada tanlangan, lekin ko'zga tashlanmaydigan filtrlar chip bo'lib chiqadi.
  // Faqat DEFAULT'dan farq qilganlari — aks holda har doim turaveradigan
  // "bugun / 1 yo'lovchi" chiplari shovqin bo'lardi.
  const todayDate = tashkentNow().date;

  /**
   * Qulaylik belgilari — shtorkadagi panjara ham, chiplar ham SHU ro'yxatdan.
   *
   * 🔴 2026-08-16: emoji o'rniga IKONKA (`shared/ui/rideFeatures`). Emoji
   * qurilmaga qarab boshqacha chiziladi, brend ranglariga bo'ysunmaydi va
   * qulflangan holatda so'nik bo'la olmaydi. Mobil ilovada bu allaqachon
   * qoida edi (`design_system_test.dart`), sayt ortda qolgan edi.
   */
  const featureLabels = rideFeatureLabels(tr);
  const COMFORT: { key: ComfortKey; icon: LucideIcon; label: string }[] = [
    { key: 'ac', icon: rideFeatureIcons.ac, label: featureLabels.ac },
    { key: 'luggage', icon: rideFeatureIcons.luggage, label: featureLabels.luggage },
    { key: 'noSmoking', icon: rideFeatureIcons.noSmoking, label: featureLabels.noSmoking },
    { key: 'noPets', icon: rideFeatureIcons.noPets, label: featureLabels.noPets },
    { key: 'twoBack', icon: rideFeatureIcons.twoBack, label: featureLabels.twoBack },
    { key: 'parcel', icon: rideFeatureIcons.parcel, label: featureLabels.parcel },
  ];

  const SPEEDS: {
    value: ExtraFilters['speed'];
    icon?: LucideIcon;
    label: string;
  }[] = [
    { value: '', label: tr("Farqi yo'q", 'Не важно', 'Any') },
    { value: 'calm', icon: rideFeatureIcons.calm, label: tr('Sekin', 'Спокойно', 'Calm') },
    { value: 'normal', icon: rideFeatureIcons.normal, label: tr("O'rtacha", 'Средне', 'Moderate') },
    { value: 'fast', icon: rideFeatureIcons.fast, label: tr('Tez', 'Быстро', 'Fast') },
  ];

  const SORTS: { value: ExtraFilters['sort']; icon: LucideIcon; label: string }[] = [
    { value: 'distance', icon: MapPin, label: tr('Yaqin', 'Ближе', 'Nearest') },
    { value: 'price', icon: Wallet, label: tr('Arzon', 'Дешевле', 'Cheapest') },
    { value: 'time', icon: Clock, label: tr('Erta', 'Раньше', 'Earliest') },
  ];

  const setExtraField = <K extends keyof ExtraFilters>(k: K, v: ExtraFilters[K]) =>
    setExtra((prev) => ({ ...prev, [k]: v }));

  // "Filtrlar" tugmasidagi raqam — nechta qo'shimcha shart yoqilgani.
  const extraCount =
    (extra.women ? 1 : 0) +
    COMFORT.filter((c) => extra[c.key]).length +
    (extra.speed ? 1 : 0) +
    (extra.priceMin ? 1 : 0) +
    (extra.priceMax ? 1 : 0);

  /**
   * «QAYERGA KETSA BO'LADI» — bo'sh natijaning O'RNINI bosadi.
   *
   * 🔴 NEGA KERAK (egasi, qurilmada 2026-08-19): "safar topilmadi" — bu
   * boshi berk javob. Odam nima qilishini bilmaydi va ilovadan chiqib
   * ketadi. Ayni paytda platformada safar BOR, faqat boshqa yo'nalishda.
   *
   * Shuning uchun bo'sh natijada jo'nash nuqtasi ATROFIDAGI barcha
   * safarlarni bir marta so'rab, ularni MANZIL bo'yicha guruhlaymiz:
   * "Toshkentdan Samarqandga 3 ta, Buxoroga 2 ta safar bor".
   *
   * MUHIM: bu natijalar asosiy ro'yxatga ARALASHTIRILMAYDI. Odam
   * Andijonni so'ragan bo'lsa, unga Chortoq safarini "natija" deb
   * ko'rsatib bo'lmaydi — u faqat TAKLIF bo'lishi mumkin, va qaysi
   * shahar ekani ochiq yozilgan bo'lishi kerak.
   *
   * So'rov FAQAT haqiqatan bo'sh natijada ketadi (`trips.length === 0`):
   * filtrlar yashirgan holatda javob boshqa — "filtrlarni tozalang".
   */
  const { data: alternatives = [] } = useQuery<{ name: string; count: number }[]>({
    queryKey: [
      'search-alternatives',
      submitted?.origin[0] ?? null,
      submitted?.origin[1] ?? null,
      filterDate,
    ],
    enabled: !!submitted && !isLoading && trips.length === 0,
    staleTime: 60_000,
    queryFn: async () => {
      const range = dateToRangeISO(filterDate);
      // Manzil MAJBURIY (dest'siz backend 400 beradi), shuning uchun
      // o'sha manzilni qoldirib radiusni butun mamlakatga ochamiz.
      const raw = await searchRides({
        origin_lat: submitted!.origin[0],
        origin_lon: submitted!.origin[1],
        dest_lat: submitted!.dest[0],
        dest_lon: submitted!.dest[1],
        radius_km: COUNTRY_RADIUS_KM,
        ...(range.from ? { date_from: range.from } : {}),
      });

      const counts = new Map<string, number>();
      for (const r of raw) {
        // Katta radius jo'nash nuqtasini ham bo'shatadi — shuning uchun
        // AYNAN shu shahardan chiqadiganlarini o'zimiz qoldiramiz. Aks
        // holda "Toshkentdan bor" deb Samarqand–Buxoro safarini
        // ko'rsatib qo'yardik.
        const fromKm = haversineKm(submitted!.origin, [r.origin_lat, r.origin_lon]);
        if (fromKm > NEAR_ORIGIN_KM) continue;
        if (normalizeStatus(r.status) === 'COMPLETED') continue;
        if (normalizeStatus(r.status) === 'CANCELLED') continue;

        // Nom koordinatadan olinadi: `destination_address` haydovchi yozgan
        // erkin matn ("Andijon shahri, 3-mavze") va guruhlash uchun yaramaydi.
        const name = nearestCityName(r.destination_lat, r.destination_lon);
        if (!name) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }

      return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    },
  });

  /**
   * «BOSHQA KUNLARDA SAFAR BOR» — bo'sh natijaning eng ko'p uchraydigan
   * sababi SANA.
   *
   * 🔴 Odam 20-avgustni tanlaydi, safar esa 21-avgustda bor. Ilgari sayt
   * «safar topilmadi» derdi va odam yo'nalish umuman ishlamaydi deb
   * o'ylardi. Muqobil MANZILLAR taklifi allaqachon bor edi — bu uning
   * sana bo'yicha egizagi.
   *
   * ⚠️ FAQAT BITTA qo'shimcha so'rov: `date_from` ning YUQORI CHEGARASI
   * YO'Q, ya'ni sanani umuman yubormagan bitta so'rov kelajakdagi HAMMA
   * safarni beradi. Kunlar shu javobdan hisoblanadi — har kun uchun
   * alohida so'rov ketmaydi.
   */
  const { data: otherDays = [] } = useQuery<{ date: string; count: number }[]>({
    queryKey: [
      'search-other-days',
      submitted?.origin[0] ?? null,
      submitted?.dest[0] ?? null,
      submitted?.dest[1] ?? null,
      filterDate,
    ],
    enabled: !!submitted && !isLoading && trips.length === 0,
    staleTime: 60_000,
    queryFn: async () => {
      const raw = await searchRides({
        origin_lat: submitted!.origin[0],
        origin_lon: submitted!.origin[1],
        dest_lat: submitted!.dest[0],
        dest_lon: submitted!.dest[1],
        radius_km: DEFAULT_RADIUS_KM,
        // Sana ATAYIN yuborilmaydi — hamma kelajak safarlar kerak.
      });

      const counts = new Map<string, number>();
      const nowIso = new Date().toISOString();
      for (const r of raw) {
        if (!r.departure_time) continue;
        // O'tgan safarlar taklif qilinmaydi — ularni tanlab bo'lmaydi.
        if (r.departure_time < nowIso) continue;
        const st = normalizeStatus(r.status);
        if (st === 'COMPLETED' || st === 'CANCELLED') continue;
        const day = tashkentLocalDate(r.departure_time);
        if (!day || day === filterDate) continue;
        counts.set(day, (counts.get(day) ?? 0) + 1);
      }

      return [...counts.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4);
    },
  });

  /**
   * Server safar qaytardi-yu, KLIENT filtrlari hammasini yashirdimi?
   *
   * Qulaylik belgilari `GET /rides/search` da parametr sifatida YO'Q — ular
   * javob ichida filtrlanadi (izohi `filteredTrips` ustida). Shu sabab bo'sh
   * ro'yxat ikki xil ma'no berardi va ekran ikkalasini ham "safar yo'q" deb
   * ko'rsatardi. Bu son ularni AJRATADI.
   */
  const hiddenByFilters = filteredTrips.length === 0 ? bookableTrips.length : 0;

  /**
   * Bo'sh natija ekranidagi bir bosishlik amallar.
   *
   * Tartib — ehtimollik bo'yicha: avval foydalanuvchining O'ZI qo'ygan
   * cheklovlar (ularni olib tashlash eng tez natija beradi), keyin qidiruv
   * doirasini kengaytirish. Har biri faqat MA'NOSI bo'lganda ko'rinadi:
   * "filtrlarni tozalash" filtr yo'qligida, "bugundan qidirish" allaqachon
   * bugun turganida chiqmaydi — bosilganda hech narsa o'zgarmaydigan tugma
   * odamni "ilova ishlamayapti" degan xulosaga olib keladi.
   */
  const emptyActions: {
    key: string;
    label: string;
    icon: LucideIcon;
    run: () => void;
  }[] = [];
  if (extraCount > 0) {
    emptyActions.push({
      key: 'clear-filters',
      icon: SlidersHorizontal,
      label: tr(
        `Filtrlarni tozalash (${extraCount})`,
        `Сбросить фильтры (${extraCount})`,
        `Clear filters (${extraCount})`
      ),
      run: () => {
        setExtra({ ...EMPTY_EXTRA, sort: extra.sort });
        setDraft({ ...EMPTY_EXTRA, sort: extra.sort });
      },
    });
  }
  if (passengerCount > 1) {
    emptyActions.push({
      key: 'one-seat',
      icon: User,
      label: tr("1 yo'lovchi uchun ko'rish", 'Посмотреть на 1 пассажира', 'Show for 1 passenger'),
      run: () => setPassengerCount(1),
    });
  }
  if (filterDate && filterDate > todayDate) {
    emptyActions.push({
      key: 'from-today',
      icon: Calendar,
      label: tr('Bugundan boshlab qidirish', 'Искать с сегодня', 'Search from today'),
      run: () => setFilterDate(todayDate),
    });
  }

  const activeFilters: { key: string; label: string; clear: () => void }[] = [
    // Bo'sh sana ham chip bo'lib chiqadi ("Istalgan kun") — foydalanuvchi nega
    // birdan boshqa kunlardagi safarlar chiqib ketganini ko'rib tursin va bir
    // bosishda bugunga qaytara olsin.
    ...(filterDate !== todayDate
      ? [
          {
            key: 'date',
            label: formatDateKey(filterDate, locale) || tr('Istalgan kun', 'Любой день', 'Any day'),
            clear: () => setFilterDate(todayDate),
          },
        ]
      : []),
    ...(passengerCount > 1
      ? [
          {
            key: 'seats',
            label: `${passengerCount} ${tr("yo'lovchi", 'пасс.', 'pax')}`,
            clear: () => setPassengerCount(1),
          },
        ]
      : []),
    ...(extra.priceMin
      ? [{ key: 'pmin', label: `≥ ${extra.priceMin}`, clear: () => setExtraField('priceMin', '') }]
      : []),
    ...(extra.priceMax
      ? [{ key: 'pmax', label: `≤ ${extra.priceMax}`, clear: () => setExtraField('priceMax', '') }]
      : []),
    ...COMFORT.filter((c) => extra[c.key]).map((c) => ({
      key: String(c.key),
      label: c.label,
      clear: () => setExtra((prev) => ({ ...prev, [c.key]: false })),
    })),
    ...(extra.speed
      ? [
          {
            key: 'speed',
            label: SPEEDS.find((s) => s.value === extra.speed)?.label ?? '',
            clear: () => setExtraField('speed', ''),
          },
        ]
      : []),
  ];

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8 relative select-none">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Заголовок страницы */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-display font-black text-foreground tracking-tight sm:text-4xl">
              {t('searchTitle')}
            </h1>
            <p className="text-sm text-text-muted">{t('searchSubtitle')}</p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={!submitted || isLoading || isRefetching}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface border border-border text-text-muted hover:text-accent disabled:opacity-50 transition-colors shadow-sm"
            title={tr('Yangilash', 'Обновить', 'Refresh')}
          >
            <RefreshCw className={`h-5 w-5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/*
          Ikki panelli tartib (CEO 2026-07-30): qidiruv CHAP panelda, natijalar o'ng
          tomonda. Noutbuk/PK'da forma doim ko'z oldida turadi (sticky) — ilgari forma
          ham, natijalar ham bitta ustunda edi va har qidiruvdan keyin yuqoriga
          qaytish kerak bo'lardi.

          Moslashuv: lg (1024px) dan PASTDA — bitta ustun, forma tepada (telefon va
          planshet-kitob uchun odatiy tartib). lg dan boshlab — 2 ustun.
        */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,380px)_1fr] lg:items-start">
          {/* ЛЕВАЯ ПАНЕЛЬ — форма поиска и фильтры */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-md transition-colors duration-200 space-y-6">
              <div className="w-full">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <CityAutocomplete
                      label={tr('Qayerdan (Shahar)', 'Откуда (Город)', 'From (city)')}
                      placeholder={tr('Masalan, Toshkent', 'Напр. Ташкент', 'e.g. Tashkent')}
                      value={filterFrom}
                      // Foydalanuvchi shahar nomini yozyapti → NOM rejimi (xarita emas).
                      onChange={(v) => {
                        setFilterFrom(v);
                        setFromByMap(false);
                      }}
                      // Ro'yxatdan shahar tanlandi → nom rejimi, koordinata = origin.
                      onSelect={(name, lat, lon) => {
                        setFilterFrom(name);
                        setFilterCoords([lat, lon]);
                        setFromByMap(false);
                      }}
                      onBestMatch={(lat, lon) => setFilterCoords([lat, lon])}
                    />
                  </div>
                  {/*
                    OVOZ — shahar nomini yozish keksa foydalanuvchi uchun
                    to'siq (klaviatura tili, lotin/kirill, apostrof).
                    Brauzer qo'llamasa tugma UMUMAN chizilmaydi.

                    🔴 2026-08-24 (egasi): tugma FAQAT jo'nash joyini
                    to'ldirardi. Odam "Toshkentdan Samarqandga" desa, butun
                    gap "qayerdan" maydoniga tushardi, "qayerga" bo'sh
                    qolardi va qidiruv ishlamasdi — ya'ni aytilgan gapning
                    yarmi tashlab ketilardi.

                    Endi bitta gapdan IKKALA shahar ajratiladi
                    (`shared/lib/voiceRoute.ts`). Hech qanday shahar
                    tanilmasa — xom matn eski tartibda "qayerdan" ga
                    tushadi: funksiya yomonlashmasin.
                  */}
                  <VoiceInputButton
                    className="h-[46px] w-[46px]"
                    label={tr(
                      "Yo'nalishni ayting: «Toshkentdan Samarqandga»",
                      'Скажите маршрут: «из Ташкента в Самарканд»',
                      'Say the route: "from Tashkent to Samarkand"'
                    )}
                    onResult={(text) => {
                      const route = parseVoiceRoute(text);
                      setFromByMap(false);

                      if (!route || (!route.from && !route.to)) {
                        setFilterFrom(text);
                        return;
                      }
                      if (route.from) {
                        setFilterFrom(route.from.name);
                        setFilterCoords(route.from.coord);
                      }
                      if (route.to) setFilterTo(route.to.name);

                      // Nutqni tanish xato qilishi mumkin — odam NIMA
                      // tushunilganini ko'rsin va kerak bo'lsa tuzatsin.
                      // Jimgina to'ldirish "ilova o'zi nimadir qildi"
                      // hissini beradi.
                      toast.success(
                        route.from && route.to
                          ? `${route.from.name} → ${route.to.name}`
                          : tr(
                              'Bitta shahar tanildi — ikkinchisini kiriting',
                              'Распознан один город — введите второй',
                              'One city recognised — enter the other'
                            )
                      );

                      /*
                        🔴 IKKALASI TANILDI — QIDIRUVNI O'ZIMIZ ISHGA
                        TUSHIRAMIZ (egasi, 2026-08-25: «ovozdan olingan
                        natija qidiruvga qo'yilmayapti»).

                        Ilgari maydonlar to'lardi-yu, qidiruv turib
                        qolardi: odam yo'nalishni to'liq aytgan, ekranda
                        esa hech nima o'zgarmagan. Ilovada bu ancha oldin
                        avtomatik edi — paritet buzilgan edi.

                        `override` SHART: `setFilterFrom`/`setFilterTo`
                        asinxron, shu render'da `filterFrom` hali eski
                        qiymatni tutadi.
                      */
                      if (route.from && route.to) {
                        void runSearch({ from: route.from.name, to: route.to.name });
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-[46px] px-3 shrink-0"
                    aria-label={tr(
                      "Jo'nash joyini xaritadan tanlash",
                      'Выбрать место отправления на карте',
                      'Pick departure on the map'
                    )}
                    onClick={() => setOpenMap('from')}
                  >
                    {/* 🔴 PUSHTI EMAS (2026-09-03): bu ikkinchi
                        darajali asbob — yonidagi mikrofon kabi. Pushti
                        bu ekranda «Qidirish» tugmasiniki. Ilovaning
                        qoidasi: pushti = asosiy amal. */}
                    <MapPin className="h-5 w-5 text-text-muted" />
                  </Button>
                </div>
              </div>

              {/*
                JOYLARNI ALMASHTIRISH — ilovada ancha oldindan bor edi
                (`Icons.swap_vert`), saytda esa YO'Q edi. Qaytish safari —
                eng ko'p takrorlanadigan qidiruv: odam ikkala shaharni
                qo'lda qayta yozardi.

                Xaritadan tanlangan nuqta ALMASHTIRISHDA bekor qilinadi:
                "qayerga" maydonida faqat NOM bor, koordinatasi yo'q — eski
                koordinatani yangi shaharga qoldirsak, qidiruv jimgina
                BOSHQA joydan izlardi. Nom bo'yicha esa yuborishda kanonik
                shahar ro'yxati koordinatani o'zi topadi.
              */}
              {(filterFrom || filterTo) && (
                <div className="flex justify-center -my-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterFrom(filterTo);
                      setFilterTo(filterFrom);
                      setFromByMap(false);
                      setFilterCoords(DEFAULT_ORIGIN);
                    }}
                    aria-label={tr('Joylarni almashtirish', 'Поменять места', 'Swap places')}
                    title={tr('Joylarni almashtirish', 'Поменять места', 'Swap places')}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-accent transition-colors hover:border-accent hover:text-accent active:scale-95"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/*
                `lg:grid-cols-1` ATAYIN: lg dan boshlab forma TOR chap panelga
                ko'chadi (~320-380px), va u yerda 3 ustun sig'maydi — sana bilan
                shahar nomi kesilib qolardi. lg gacha esa forma to'liq kenglikda,
                shuning uchun md'da 3 ustun qoladi.
              */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-1 items-end">
                <div className="w-full">
                  <CityAutocomplete
                    label={t('to')}
                    placeholder={tr('Masalan, Samarqand', 'Напр. Самарканд', 'e.g. Samarkand')}
                    value={filterTo}
                    onChange={(v) => setFilterTo(v)}
                    onSelect={(name) => setFilterTo(name)}
                  />
                </div>

                <div className="w-full">
                  {/* Brend kalendari — brauzerning native oynasi o'rniga (DateField izohi).
                      O'tgan kunlar tanlanmaydi: bugundan oldingi safar bo'lmaydi. */}
                  {/* 🔴 «Sana» EMAS, «Qachondan» (10.09.2026): bu maydon
                      serverga `date_from` bo'lib ketadi va YUQORI CHEGARA
                      YO'Q — ya'ni tanlangan kundan BOSHLAB hammasi
                      qaytadi (qaror 31.07.2026, sababi: yo'nalishlarda
                      safar kam, bitta kunni tanlab bo'sh ekran ko'rgan
                      odam «bu yerda umuman safar yo'q» deb ketib
                      qoladi).

                      Yorliq esa «Sana» derdi. Natijada odam «Bugun ·
                      10-sentabr» ni tanlab, ro'yxatda 12 va 15-sentabrni
                      ko'rardi va bu XATO bo'lib tuyulardi. Endi yorliqning
                      o'zi aytadi. Yonidagi ikkitasi ham shu shaklda:
                      Qayerdan · Qayerga · Qachondan. */}
                  <DateField
                    label={tr('Qachondan', 'С какого дня', 'From when')}
                    value={filterDate}
                    min={todayDate}
                    onChange={setFilterDate}
                    // Sanani tozalash = "istalgan kun": `dateToRangeISO('')` bo'sh
                    // oraliq beradi va `date_from` umuman yuborilmaydi.
                    allowClear
                    placeholder={tr('Istalgan kun', 'Любой день', 'Any day')}
                  />
                </div>

                <div className="w-full">
                  <Counter
                    label={tr("Yo'lovchilar", 'Пассажиры', 'Passengers')}
                    value={passengerCount}
                    onChange={setPassengerCount}
                    max={6}
                  />
                </div>
              </div>

              {/* Narx oralig'i "Filtrlar" shtorkasiga ko'chdi (joyni tejash) — u yerda
                  qoralama sifatida kiritiladi va "Ko'rsatish"da bir marta qo'llanadi.
                  Ilgari bu yerda turgan va har bosilgan raqamda YANGI so'rov ketardi. */}

              {/* Qidirish tugmasi — natija FAQAT shu bosilganda so'raladi (avtomatik emas). */}
              <Button
                onClick={() => runSearch()}
                disabled={isLoading || isRefetching || resolving}
                isLoading={isLoading || isRefetching || resolving}
                className="w-full h-14 text-lg font-semibold rounded-2xl shadow-lg shadow-accent/20"
              >
                <Search className="h-5 w-5 mr-1.5" />
                <span>{tr('Qidirish', 'Найти поездки', 'Search rides')}</span>
              </Button>

              {/* Oxirgi yo'nalishlar — bitta bosishda qayta qidirish. */}
              {recentRoutes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide">
                    {tr("Oxirgi yo'nalishlar", 'Недавние маршруты', 'Recent routes')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentRoutes.map((r) => (
                      <button
                        key={`${r.from}-${r.to}`}
                        type="button"
                        onClick={() => {
                          setFilterFrom(r.from);
                          setFilterTo(r.to);
                          setFromByMap(false);
                          void runSearch({ from: r.from, to: r.to });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-muted hover:border-accent hover:text-accent transition-colors"
                      >
                        <MapPin className="h-3.5 w-3.5 text-accent" />
                        {r.from} → {r.to}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ПРАВАЯ ПАНЕЛЬ — результаты поиска */}
          <section className="space-y-4">
            {/*
              FILTRLAR QATORI natijalar USTIGA ko'chirildi (CEO 2026-08-04).
              Ilgari u chap panelning eng tagida, "Qidirish" tugmasidan ham pastda
              turardi: desktopda o'ng ustunning tepasi bo'sh qolar, filtrlar esa
              ko'z tushmaydigan joyda edi. Endi ular natijalar ustunining tepasida
              — skrollsiz ko'rinadi, bosilgan zahoti ro'yxat o'zgaradi.
              `sticky` — uzun ro'yxatda ham qatorda qoladi.
            */}
            <div className="sticky top-16 z-20 -mx-1 bg-bg/95 px-1 pb-3 pt-1 backdrop-blur-sm lg:top-20">
              {/*
              Filtrlar. Posilka filtri OLIB TASHLANDI (CEO 2026-07-30): posilka
              alohida bo'lim, safar qidiruvida uning o'rni yo'q. Safar kartasidagi
              "Pochta" belgisi qoldi — u filtr emas, safar xususiyati.

              Tanlangan filtrlar shu yerda chip bo'lib ko'rinadi va × bilan
              yakka-yakka olib tashlanadi.
            */}
              <div className="flex flex-wrap items-center gap-2">
                {/* "Filtrlar" — qolgan HAMMA shart shu tugma ortidagi shtorkada.
                  Yonidagi raqam nechta shart yoqilganini aytadi. */}
                <button
                  type="button"
                  onClick={openFilters}
                  // 🔴 34 px edi (o'lchandi) — barmoq uchun kam.
                  // Yozuv o'lchami o'zgarmaydi, faqat balandlik.
                  className={`flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                    extraCount > 0
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-surface text-text-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {tr('Filtrlar', 'Фильтры', 'Filters')}
                  {extraCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-accent">
                      {extraCount}
                    </span>
                  )}
                </button>

                {/* Saralash — uchta holat bitta segmentli tugmada (alohida joy egallamaydi). */}
                <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-bg p-0.5">
                  {SORTS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setExtraField('sort', s.value)}
                      aria-pressed={extra.sort === s.value}
                      // Segment balandligi 29 px edi — 36 ga ko'tarildi.
                      /* 🔴 TANLANGAN SEGMENT PUSHTI EDI va yonidagi
                         pushti «Qidirish» bilan raqobatlashardi. Saralash
                         — TANLOV, amal emas: tanlangani eng KUCHLI
                         (qalin, to'q zaminda), qolganlari sokin. Aynan
                         shu yechim ilovadagi til almashtirgichda ham. */
                      className={`min-h-9 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        extra.sort === s.value
                          ? 'bg-wine-ash text-white shadow-sm dark:bg-surface dark:text-foreground'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* RO'YXAT ⇄ XARITA — bizda uchrashuv nuqtasi hal qiluvchi:
                    ro'yxatdagi "Chortoq" shaharning qaysi chetidan chiqishini
                    aytmaydi (manzil haydovchi yozgan erkin matn). Xarita esa
                    buni bir qarashda ko'rsatadi.

                    Tugma FAQAT koordinatali natija bo'lganda chiqadi: bo'sh
                    xaritani ochish "buzuq" degandek ko'rinardi. */}
                {mapPoints.length > 0 && (
                  <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-bg p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      aria-pressed={viewMode === 'list'}
                      className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        viewMode === 'list'
                          ? 'bg-wine-ash text-white shadow-sm dark:bg-surface dark:text-foreground'
                          : 'text-text-muted hover:text-accent'
                      }`}
                    >
                      <ListIcon className="h-3.5 w-3.5" />
                      {tr("Ro'yxat", 'Список', 'List')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('map')}
                      aria-pressed={viewMode === 'map'}
                      className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        viewMode === 'map'
                          ? 'bg-wine-ash text-white shadow-sm dark:bg-surface dark:text-foreground'
                          : 'text-text-muted hover:text-accent'
                      }`}
                    >
                      <MapIcon className="h-3.5 w-3.5" />
                      {tr('Xarita', 'Карта', 'Map')}
                    </button>
                  </div>
                )}

                {activeFilters.map((f) => (
                  <span
                    key={f.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-brand-pink-light dark:bg-accent/10 px-3 py-2 text-xs font-bold text-accent"
                  >
                    {f.label}
                    <button
                      type="button"
                      onClick={f.clear}
                      aria-label={tr(
                        `${f.label} filtrini olib tashlash`,
                        `Убрать: ${f.label}`,
                        `Remove filter: ${f.label}`
                      )}
                      className="rounded-full p-0.5 hover:bg-accent/20 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {activeFilters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDate(todayDate);
                      setPassengerCount(1);
                      setExtra((prev) => ({ ...EMPTY_EXTRA, sort: prev.sort }));
                    }}
                    className="text-xs font-bold text-text-muted underline-offset-4 hover:text-accent hover:underline"
                  >
                    {tr('Tozalash', 'Сбросить', 'Reset')}
                  </button>
                )}
              </div>
            </div>

            {/* SANA LENTASI — natijalar sarlavhasidan OLDIN.
                Sana o'zgartirish uchun odam yuqoriga qaytib kalendarni
                ochishi kerak edi va o'sha kunda safar bor-yo'qligini
                tanlagunicha BILMASDI. Izohi `DateStrip` da; ilovada ham
                aynan shunday. */}
            {submitted && (
              <DateStrip counts={dayCounts} selected={filterDate} onPick={setFilterDate} />
            )}

            {/* Natijalar soni — filtr o'zgarganda raqam turtki bilan almashadi
                (`mo-bump`, `key` orqali). Ilgari filtrni bosgan odam nima
                o'zgarganini darrov ko'rmasdi. */}
            {/* Bo'lim yorlig'i — sayt bo'ylab YAGONA shakl
                (`SectionLabel`, yonida islimi novdasi). Ilgari har
                sahifa o'z sinflarini yozardi. */}
            <SectionLabel
              trailing={
                filteredTrips.length > 0 ? (
                  <span
                    key={filteredTrips.length}
                    className="mo-bump rounded-full bg-brand-pink-light dark:bg-accent/10 px-2 py-0.5 text-xs text-accent"
                  >
                    {filteredTrips.length}
                  </span>
                ) : undefined
              }
            >
              {tr('Qidiruv natijalari', 'Найденные поездки', 'Search results')}
            </SectionLabel>

            {/* Backend yo'lovchining O'ZI yaratgan safarlarni qidiruvdan chiqarib tashlaydi —
              haydovchi o'z e'lonini shu yerda izlab "ishlamayapti" deb o'ylamasligi uchun eslatма. */}
            {isAuthed && submitted && (
              <p className="text-xs text-text-muted">
                {tr(
                  "Eslatma: o'zingiz e'lon qilgan safarlar bu ro'yxatda ko'rinmaydi — ularni Haydovchi panelida ko'rasiz.",
                  'Примечание: ваши собственные поездки здесь не показываются — они видны в панели водителя.',
                  'Note: your own published trips are not shown here — you will find them in the driver panel.'
                )}
              </p>
            )}

            {/* Mehmon endi natijalarni KO'RADI (`/rides/search` ochiq) — login faqat
              bron qilish uchun kerak. Ilgari bu yerda "avval tizimga kiring" bloki
              turardi va yangi foydalanuvchi bironta e'lonni ko'rmasdan ketardi. */}
            {isAuthed === false && submitted && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/50 p-4 text-sm text-text-muted">
                <User className="h-5 w-5 shrink-0 text-accent opacity-70" />
                <span className="flex-1">
                  {tr(
                    'Bron qilish uchun tizimga kiring.',
                    'Чтобы забронировать место, войдите в систему.',
                    'Sign in to book a seat.'
                  )}
                </span>
                <Link href={`/${locale}/login`}>
                  <Button variant="secondary">{tr('Kirish', 'Войти', 'Sign in')}</Button>
                </Link>
              </div>
            )}

            {!submitted ? (
              // Hali qidirilmagan — "topilmadi" o'rniga taklif va tavsiyalar.
              <>
                {/* Bo'sh holat — sayt bo'ylab YAGONA shakl (`EmptyState`).
                    Ilgari bu yerda xira doira ichida pushti lupa turardi
                    va har sahifada boshqacha edi. */}
                <EmptyState
                  /* qulaylik: chiqish yo'li SHART EMAS — qidiruv formasi
                     AYNAN shu sahifada, bo'sh holatning ustida turibdi. */
                  icon={<Search />}
                  title={tr("Yo'nalishni tanlang", 'Выберите маршрут', 'Choose a route')}
                  description={tr(
                    "Yo'nalish va sanani tanlab, «Qidirish» tugmasini bosing.",
                    'Выберите маршрут и дату, затем нажмите «Найти поездки».',
                    'Choose a route and a date, then tap “Search rides”.'
                  )}
                  className="rounded-2xl border border-border bg-surface/50"
                />
                {/* SO'NGGI KO'RILGANLAR — odam qayerda qolganini eslasin.
                    Bosh sahifa har safar noldan boshlanardi. Ilovada bor
                    edi, saytda yo'q. Yozuv bo'lmasa O'ZI chizilmaydi. */}
                <RecentRides />
                {/* «Siz uchun» — bo'sh ekranning eng foydali joyi: foydalanuvchi hali
                    hech narsa yozmagan, lekin ko'rsatadigan safar bor. Mehmonda va
                    javob tanib bo'lmasa komponent O'ZI hech narsa chizmaydi. */}
                <RecommendedRides />
              </>
            ) : isLoading ? (
              /* NATIJA KARTOCHKASI SHAKLIDAGI skelet — matnli "yuklanmoqda"
                 o'rniga. Ikki foydasi bor: (1) kutish qisqaroq tuyuladi,
                 chunki ekran allaqachon "to'lgan"; (2) ma'lumot kelganda
                 joylashuv O'ZGARMAYDI — sahifa sakramaydi va odam
                 bosayotgan joyi ostidan surilib ketmaydi. */
              <div className="space-y-4" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-5 w-3/5" />
                      <Skeleton className="h-3 w-2/5" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <Skeleton className="h-7 w-24" />
                      <Skeleton className="h-10 w-28 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              // Qidiruv so'rovi xato bilan tugadi (tarmoq/server) — fake natija ko'rsatmaymiz.
              <EmptyState
                className="rounded-2xl border border-border bg-surface/50"
                icon={<SearchX />}
                title={tr('Qidiruv bajarilmadi', 'Поиск не выполнен', 'Search failed')}
                description={tr(
                  "Qidiruvda xatolik yuz berdi. Qayta urinib ko'ring.",
                  'Ошибка поиска. Попробуйте ещё раз.',
                  'Search failed. Please try again.'
                )}
                action={
                  <Button variant="secondary" onClick={() => refetch()} disabled={isRefetching}>
                    {tr('Qayta urinish', 'Повторить', 'Try again')}
                  </Button>
                }
              />
            ) : filteredTrips.length === 0 ? (
              /*
                ===== BO'SH NATIJA — «NIMA QILAY?» EKRANI =====

                🔴 NEGA QAYTA YOZILDI (egasi tasdiqladi, 2026-08-19): ilgari bu
                yerda bitta jumla turardi — "bu yo'nalishda safar yo'q, boshqa
                sana yoki filtrlarni sinab ko'ring". Ikki jiddiy nuqsoni bor edi:

                 1. U ba'zan YOLG'ON bo'lardi. Qulaylik belgilari (konditsioner,
                    chekilmaydi...) SERVERDA emas, natija ichida filtrlanadi.
                    Ya'ni server 8 ta safar qaytarib, filtrlar hammasini
                    yashirsa ham ekranda "safar yo'q" yozilardi. Odam
                    yo'nalishda safar yo'q deb o'ylab chiqib ketardi.
                 2. Maslahat berardi, lekin BAJARIB bermasdi: "boshqa sana
                    sinab ko'ring" — o'zi qidiruv formasiga qaytib, sanani
                    o'zgartirib, yana bosishi kerak edi.

                Endi ekran SABABGA qarab aniq, bir bosishlik amal taklif qiladi.
              */
              <>
                {/* ⚠️ Chegara UZUQ EMAS: uzuq chegara saytda «bu yerga
                    narsa qo'ying» degan ma'noni bildiradi (surat yuklash),
                    bo'sh natija esa javob — u boshqa bo'sh holatlar bilan
                    bir xil, butun chegarada bo'lishi kerak. */}
                <div className="rounded-2xl border border-border bg-surface/50 p-8 text-center text-sm text-text-muted">
                  {/* Belgi — sayt bo'ylab bitta shakl (peshtoq medalyoni).
                      Bu blokning MATNI sababga qarab o'zgaradi, shuning
                      uchun `EmptyState` emas, faqat medalyon olinadi. */}
                  <PeshtoqBadge icon={<SearchX />} className="mx-auto mb-4" />

                  {hiddenByFilters > 0 ? (
                    // Safarlar BOR — ularni foydalanuvchining o'z filtrlari yashirdi.
                    <p className="mx-auto max-w-sm leading-relaxed">
                      {tr(
                        `Bu yo'nalishda ${hiddenByFilters} ta safar bor, lekin qulaylik filtrlari hammasini yashirdi.`,
                        `На этом направлении есть ${hiddenByFilters} поездок, но фильтры удобств скрыли все.`,
                        `There are ${hiddenByFilters} rides on this route, but your comfort filters hid all of them.`
                      )}
                    </p>
                  ) : (
                    <>
                      {/* Yo'nalish ATAYIN nomi bilan aytiladi: "safar topilmadi"
                          degan umumiy jumla qaysi so'rovga javob ekani noaniq
                          qoldiradi va odam yozganini xato deb o'ylaydi. */}
                      <p className="mx-auto max-w-sm font-bold leading-relaxed text-text">
                        {tr(
                          `${filterFrom || tr('Tanlangan nuqta', '', '')} → ${filterTo} yo'nalishida hozircha safar yo'q`,
                          `На направлении ${filterFrom} → ${filterTo} пока нет поездок`,
                          `No rides on ${filterFrom} → ${filterTo} yet`
                        )}
                      </p>
                      <p className="mx-auto mt-1.5 max-w-sm leading-relaxed">
                        {tr(
                          "Bu yo'nalishda haydovchilar hali e'lon bermagan.",
                          'Водители пока не опубликовали объявления по этому маршруту.',
                          'Drivers have not posted any listings for this route yet.'
                        )}
                      </p>
                      {/* KUZATUV — bo'sh natijaning ENG foydali javobi:
                          odam ketmasin, biz uni qaytarib chaqira olaylik.
                          Ilovada bor edi, saytda yo'q. Izohi
                          `WatchRouteButton` da. */}
                      <div className="mt-4">
                        <WatchRouteButton
                          origin={submitted?.origin}
                          dest={submitted?.dest}
                          fromName={filterFrom}
                          toName={filterTo}
                        />
                      </div>
                      {/* 🔴 «Safar yo'q» va «sayt buzuq» — odam uchun BIR XIL
                          ko'rinadi. Aynan shu savolga javob beradigan sahifa
                          bor, lekin unga yo'l yo'q edi. Havola ATAYIN mayda:
                          u asosiy taklif emas, shubhaga javob. */}
                      <p className="mx-auto mt-3 max-w-sm text-xs">
                        <Link
                          href={`/${locale}/status`}
                          className="font-bold text-text-muted underline decoration-dotted underline-offset-2 hover:text-accent"
                        >
                          {tr(
                            'Sayt ishlayaptimi — tekshirish',
                            'Проверить, работает ли сервис',
                            'Check whether the service is working'
                          )}
                        </Link>
                      </p>
                    </>
                  )}

                  {/* Bir bosishlik amallar — eng ehtimolli sababdan boshlab. */}
                  {emptyActions.length > 0 && (
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      {emptyActions.map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          onClick={a.run}
                          className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3.5 py-2 text-xs font-bold text-accent transition-colors hover:border-accent hover:bg-brand-pink-light dark:hover:bg-accent/10"
                        >
                          <a.icon className="h-3.5 w-3.5" />
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/*
                  ===== «QAYERGA KETSA BO'LADI» =====
                  🔴 Bu blok bo'sh natijani BOSHI BERK bo'lishdan saqlaydi.
                  Ilgari radiusni kengaytirish tugmasi bor edi va u boshqa
                  manzillarni JIM aralashtirar edi — Andijon so'ralganda
                  Chortoq safari "natija" bo'lib chiqardi. Endi boshqa
                  manzillar hech qachon natijaga qo'shilmaydi: ular OCHIQ,
                  nomi va soni bilan taklif qilinadi, tanlash odamda qoladi.
                */}
                {/* BOSHQA KUNLAR — manzillardan OLDIN: bo'sh natijaning
                    eng ko'p uchraydigan sababi sana, manzil emas.

                    Kun bosilganda `runSearch` chaqirilmaydi: `filterDate`
                    asosiy so'rovning `queryKey` ida turibdi, ya'ni holatni
                    o'zgartirishning O'ZI qidiruvni qayta yugurtiradi. */}
                {hiddenByFilters === 0 && otherDays.length > 0 && (
                  <div className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
                    <p className="text-sm font-extrabold text-foreground">
                      {tr(
                        'Boshqa kunlarda safar bor',
                        'В другие дни поездки есть',
                        'Rides on other days'
                      )}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {tr(
                        'Kunni bosing — qidiruv qayta yugurtiriladi.',
                        'Нажмите на день — поиск повторится.',
                        'Tap a day and the search will re-run.'
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {otherDays.map((d) => (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => setFilterDate(d.date)}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-bold text-text shadow-sm transition-colors hover:border-accent hover:text-accent"
                        >
                          <Calendar className="h-4 w-4 text-accent" />
                          {formatDateKey(d.date, locale) || d.date}
                          <span className="rounded-full bg-brand-pink-light dark:bg-accent/10 px-1.5 py-0.5 text-[11px] font-extrabold text-accent">
                            {d.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {hiddenByFilters === 0 && alternatives.length > 0 && (
                  <div className="rounded-2xl border border-turquoise/40 bg-turquoise/5 p-5">
                    <p className="text-sm font-extrabold text-foreground">
                      {tr(
                        `${filterFrom} dan quyidagi shaharlarga safarlar bor`,
                        `Зато из города ${filterFrom} есть поездки в`,
                        `But there are rides from ${filterFrom} to`
                      )}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {tr(
                        "Shaharni bosing — o'sha yo'nalish bo'yicha qidiramiz.",
                        'Нажмите на город — поищем по этому направлению.',
                        'Tap a city and we will search that route.'
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {alternatives.map((alt) => (
                        <button
                          key={alt.name}
                          type="button"
                          onClick={() => {
                            setFilterTo(alt.name);
                            void runSearch({ to: alt.name });
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-bold text-text shadow-sm transition-colors hover:border-accent hover:text-accent"
                        >
                          <MapPin className="h-4 w-4 text-accent" />
                          {alt.name}
                          <span className="rounded-full bg-brand-pink-light dark:bg-accent/10 px-1.5 py-0.5 text-[11px] font-extrabold text-accent">
                            {alt.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bo'sh natija — chiqib ketish sababi. Tavsiyalar shu yerda
                  muqobil beradi (topilmadi bloki ostida, uni almashtirmaydi). */}
                <RecommendedRides className="pt-2" />
              </>
            ) : (
              <>
                {/* Natijа sonи — nechta safar topilganини darrov ko'rsatadi. */}
                <p className="flex items-center gap-1.5 px-1 text-xs font-bold text-text-muted">
                  <Search className="h-3.5 w-3.5" />
                  {tr(
                    `${filteredTrips.length} ta safar topildi`,
                    `Найдено поездок: ${filteredTrips.length}`,
                    `${filteredTrips.length} rides found`
                  )}
                  {/* Narx konteksti — ayni EKRANDAGI natijalardan hisoblangan
                      median. Bozor narxi DEYILMAYDI va to'qib chiqarilmaydi. */}
                  {medianPrice != null && (
                    <span className="font-semibold text-text-muted">
                      ·{' '}
                      {tr(
                        `o'rtacha ${formatCurrency(medianPrice, locale)}`,
                        `в среднем ${formatCurrency(medianPrice, locale)}`,
                        `avg ${formatCurrency(medianPrice, locale)}`
                      )}
                    </span>
                  )}
                </p>
                {/* XARITA — TOR ekranda ro'yxat O'RNIGA (ikkalasini birga
                    ko'rsatish ikkalasini ham foydasiz qiladi), KENG ekranda
                    esa YONMA-YON: `xl` dan boshlab joy yetadi va odam
                    kartochkani o'qib turib xaritada qayerdaligini ko'radi.

                    Xarita YOPISHIB turadi (`sticky`): ro'yxat surilganda
                    u ekrandan chiqib ketmasligi kerak. */}
                {viewMode === 'map' && mapPoints.length > 0 ? (
                  /* KENG ekranda xarita va ro'yxat YONMA-YON, tor ekranda
                     faqat xarita: telefonda ikkalasini birga ko'rsatish
                     ikkalasini ham foydasiz qiladi.

                     Xarita YOPISHIB turadi: ro'yxat surilganda u ekrandan
                     chiqib ketmasligi kerak. */
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div className="hidden max-h-[70vh] space-y-2 overflow-y-auto xl:block">
                      {filteredTrips.map((trip) => (
                        <Link
                          key={trip.id}
                          href={`/${locale}/trip/${trip.id}`}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-text">
                              {trip.from} → {trip.to}
                            </span>
                            <span className="block text-xs text-text-muted">
                              {departureStatusLabel(trip.departureTime, trip.status, locale) ||
                                formatTripDateTime(trip.departureTime)}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-extrabold text-accent">
                            {formatCurrency(trip.price, locale)}
                          </span>
                        </Link>
                      ))}
                    </div>
                    <ResultsMap
                      points={mapPoints}
                      openLabel={tr('Ochish', 'Открыть', 'Open')}
                      className="h-[60vh] min-h-[320px] xl:sticky xl:top-24 xl:h-[70vh]"
                    />
                  </div>
                ) : null}

                {viewMode === 'map'
                  ? null
                  : filteredTrips.map((trip, i) => (
                      <div
                        key={trip.id}
                        // Natijalar ketma-ket ochiladi. Indeks 8 bilan chegaralangan —
                        // 50 ta natija 2.5 soniyalik karvonga aylanib qolmasin.
                        style={{ '--i': Math.min(i, 8) } as React.CSSProperties}
                        className="mo-stagger-item rounded-2xl border border-border bg-surface p-6 shadow-sm hover:-translate-y-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-[transform,border-color] duration-200 hover:border-accent"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg font-extrabold text-text">{trip.from}</span>
                            <ArrowRight className="h-4.5 w-4.5 text-accent" />
                            <span className="text-lg font-extrabold text-text">{trip.to}</span>
                            {/* Yaqin-atrof belgisi: qidirilgan nuqtadan jo'nash nuqtasigacha masofa.
                        ~12 km ichi = "shu atrofdan", aks holda taxminiy km. */}
                            {trip.distanceKm != null && trip.distanceKm > 12 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-pink-light dark:bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
                                <MapPin className="h-3 w-3" />
                                {tr(
                                  `yaqin atrof · ~${Math.round(trip.distanceKm)} km`,
                                  `рядом · ~${Math.round(trip.distanceKm)} км`,
                                  `nearby · ~${Math.round(trip.distanceKm)} km`
                                )}
                              </span>
                            )}
                          </div>

                          {/* Oraliq shaharlar — haydovchi yo'l-yo'lakay kirib o'tadigan nuqtalar */}
                          {trip.stops.length > 0 && (
                            <p className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-accent shrink-0" />
                              {tr('Orqali', 'Через', 'Via')}: {trip.stops.join(', ')}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-4 text-xs text-text-muted font-semibold">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-accent" />
                              {/* Yaqin safarda MUTLAQ sana o'rniga "qancha qoldi" —
                              ro'yxatni ko'z bilan skanerlayotgan odamga u
                              foydaliroq. Uzoq sanada yorliq bo'sh qaytadi va
                              o'sha eski yozuv qoladi (ilova bilan bir xil). */}
                              {/* 🔴 14.09.2026: `departureLabel` jo'nash
                              vaqti o'tgan zahoti "Jo'nab ketdi" derdi, holbuki
                              safar yana UCH SOAT bron qilinadi (backend ham
                              shu oynani ishlatadi, jonli o'lchandi). Endi
                              "Kechikmoqda — 12 daqiqa" — ilovadagi
                              `departureStatusLabel` bilan bir xil. */}
                              {departureStatusLabel(trip.departureTime, trip.status, locale) ||
                                formatTripDateTime(trip.departureTime) ||
                                '—'}
                            </span>
                            {/* Backend rides javobida ism yo'q (PII auth'da) — ism bo'lmasa ham
                        reytingni ko'rsatamiz, fallback: "Haydovchi". */}
                            {(trip.driver || trip.driverRating != null) && (
                              <span className="flex items-center gap-1.5">
                                <User className="h-4 w-4 text-accent" />
                                {/* Haydovchi endi O'LIK NUQTA emas — bosilsa
                                profili ochiladi. `driverId` kelmasa
                                (backend har doim ham bermaydi) oddiy
                                yozuv bo'lib qoladi. */}
                                {trip.driverId ? (
                                  <Link
                                    href={`/${locale}/user/${trip.driverId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="underline decoration-dotted underline-offset-2 hover:text-accent"
                                  >
                                    {trip.driver || tr('Haydovchi', 'Водитель', 'Driver')}
                                  </Link>
                                ) : (
                                  trip.driver || tr('Haydovchi', 'Водитель', 'Driver')
                                )}
                                <RatingBadge
                                  rating={trip.driverRating}
                                  count={trip.driverReviews}
                                />
                              </span>
                            )}
                            {/* O'RINDIQ SXEMASI — kartada. Saytda bu
                            umuman yo'q edi: odam faqat «Oxirgi joy»
                            nishonini ko'rardi, mashinada nechta joy
                            borligini esa bilmasdi. Ixcham: kartada
                            sxema o'qishga emas, BIR QARASHDA javob
                            berishga xizmat qiladi. */}
                            {(trip.totalSeats ?? 0) > 0 && (
                              <SeatMap
                                totalSeats={trip.totalSeats}
                                availableSeats={trip.seats}
                                compact
                              />
                            )}
                            {/* OXIRGI JOYLAR — `available_seats` allaqachon
                            qo'limizda edi, lekin oddiy raqam bo'lib turardi.
                            Bu yolg'on shoshilinchlik emas, ro'yxatdagi
                            HAQIQIY holat. */}
                            {trip.seats > 0 && trip.seats <= 2 && (
                              <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-extrabold text-error">
                                {trip.seats === 1
                                  ? tr('Oxirgi joy', 'Последнее место', 'Last seat')
                                  : tr(
                                      `${trip.seats} joy qoldi`,
                                      `Осталось ${trip.seats} места`,
                                      `${trip.seats} seats left`
                                    )}
                              </span>
                            )}
                            <Badge variant={isTripOpen(trip.status) ? 'primary' : 'secondary'}>
                              {/* Backend v2 statusi 'ACTIVE' — usiz else-tarmoq faol safarni
                          "Tugallangan" deb ko'rsatib yuborardi. */}
                              {isTripOpen(trip.status)
                                ? tr('Faol safar', 'Активно', 'Active')
                                : trip.status === 'IN_PROGRESS'
                                  ? tr("Yo'lda", 'В пути', 'On the way')
                                  : tr('Tugallangan', 'Завершено', 'Completed')}
                            </Badge>
                            <div className="flex flex-wrap gap-1.5">
                              {/* Adolatli narx — backend `has_fair_price_badge` beradi;
                            ilgari faqat torg sahifasida ko'rinardi, natijalar
                            ro'yxatida esa yo'qolib ketardi. */}
                              {trip.fairPrice && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-turquoise-light/70 text-wine-ash px-1.5 py-0.5 rounded font-bold">
                                  <Scale className="h-3 w-3 shrink-0" aria-hidden />
                                  {tr('Adolatli narx', 'Честная цена', 'Fair price')}
                                </span>
                              )}
                              {trip.acceptsParcel && (
                                <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                  <Package className="w-3 h-3" />{' '}
                                  {tr('Pochta', 'Посылка', 'Parcel')}
                                </span>
                              )}
                              {/*
                          🔴 2026-08-16: belgilar emoji EMAS, ikonka bilan va
                          ro'yxat YAGONA manbadan (`shared/ui/rideFeatures`).
                          Ilgari bu yerda ham, safar varag'ida ham, safar
                          sahifasida ham, e'lon formasida ham bir xil emoji
                          qo'lda takrorlanardi.
                        */}
                              {rideFeatures(
                                {
                                  has_ac: trip.hasAC,
                                  has_luggage: trip.hasLuggage,
                                  no_smoking: trip.noSmoking,
                                  no_pets: trip.noPets,
                                  max_two_back: trip.maxTwoBack,
                                  driving_speed: trip.drivingSpeed,
                                },
                                tr
                              ).map((f) => (
                                <span
                                  key={f.key}
                                  className="inline-flex items-center gap-1 text-[10px] bg-surface border border-border text-text-muted px-1.5 py-0.5 rounded font-bold"
                                >
                                  <f.icon className="h-3 w-3 shrink-0" aria-hidden />
                                  {f.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-end gap-3 sm:gap-6 border-t border-border pt-4 sm:border-none sm:pt-0">
                          <div className="text-left sm:text-right flex items-center justify-between w-full sm:w-auto">
                            <span className="text-[10px] font-bold text-text-muted block uppercase tracking-wider sm:mb-0.5">
                              {tr("Boshlang'ich narx", 'Начальная цена', 'Starting price')}
                            </span>
                            <span className="text-xl font-extrabold text-accent">
                              {formatCurrency(trip.price, locale)}
                              {/* Sezilarli farq BO'LGANDAGINA — 10% dan kichik
                              farq odam uchun ahamiyatsiz, lekin deyarli har
                              kartada yozuv chiqarib ro'yxatni shovqinga
                              to'ldirardi. Ilova bilan bir xil chegara. */}
                              {medianPrice != null && trip.price > 0 && (
                                <>
                                  {trip.price <= medianPrice * 0.9 && (
                                    <span className="block text-[10px] font-bold text-turquoise">
                                      {tr("O'rtachadan arzon", 'Дешевле среднего', 'Below average')}
                                    </span>
                                  )}
                                  {trip.price >= medianPrice * 1.1 && (
                                    <span className="block text-[10px] font-bold text-text-muted">
                                      {tr("O'rtachadan qimmat", 'Дороже среднего', 'Above average')}
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                          </div>

                          {/*
                      🔴 `seats` HAVOLADA ketishi shart (egasi, 2026-08-16):
                      "2 kishiga" deb qidirilgan bo'lsa ham savdolashish
                      sahifasi 1 joydan boshlanardi — narx 1 kishiga
                      hisoblanib, haydovchiga 1 kishilik so'rov ketardi.
                      Odam buni sezmasa safarga ikkitasi borib qoladi.
                      URL orqali: havola nusxalansa ham tanlov saqlanadi.
                    */}
                          <Link
                            href={`/${locale}/bidding/${trip.id}${
                              passengerCount > 1 ? `?seats=${passengerCount}` : ''
                            }`}
                            className="w-full sm:w-auto shrink-0"
                          >
                            <Button
                              variant={isTripOpen(trip.status) ? 'primary' : 'secondary'}
                              className="min-h-[44px] w-full"
                            >
                              <span>{tr('Savdolashish', 'Договориться', 'Make an offer')}</span>
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
              </>
            )}
          </section>
        </div>
      </div>

      {/*
        FILTRLAR SHTORKASI. Chap panelga sig'magan hamma shart shu yerda:
        narx, qulaylik belgilari, haydash uslubi. Qoralama (`draft`) ustida
        ishlaydi — "Ko'rsatish" bosilgunicha na so'rov ketadi, na ro'yxat sakraydi.
      */}
      <BottomSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={tr('Filtrlar', 'Фильтры', 'Filters')}
      >
        <div className="space-y-5 pb-2">
          {/* Narx — YAGONA serverda filtrlanadigan qism (backend §1). */}
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">
              {tr("Narx (so'm)", 'Цена (сум)', 'Price (UZS)')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.priceMin}
                onChange={(e) => setDraft((p) => ({ ...p, priceMin: e.target.value }))}
                placeholder={tr('dan · 0', 'от · 0', 'from · 0')}
              />
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.priceMax}
                onChange={(e) => setDraft((p) => ({ ...p, priceMax: e.target.value }))}
                placeholder={tr('gacha · 200 000', 'до · 200 000', 'to · 200 000')}
              />
            </div>
          </div>

          {/*
            XAVFSIZLIK — qulayliklardan OLDIN. Bu «konditsioner bormi»
            darajasidagi tanlov emas: odam safarga chiqish-chiqmaslikni
            shunga qarab hal qiladi.

            🔑 Izoh MAJBURIY: belgi haydovchining JINSI deb tushunilmasin.
            Erkak haydovchi ham «faqat ayol yo'lovchi olaman» deya oladi.
          */}
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">
              {tr('Kim bilan', 'С кем', 'Who with')}
            </p>
            <button
              type="button"
              aria-pressed={draft.women}
              onClick={() => setDraft((p) => ({ ...p, women: !p.women }))}
              className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                draft.women
                  ? 'border-accent bg-brand-pink-light dark:bg-accent/10 text-accent'
                  : 'border-border bg-surface text-text-muted hover:border-accent/50'
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <VenusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {tr('Faqat ayollar', 'Только женщины', 'Women only')}
              </span>
              <span className="mt-1 block text-[11px] font-semibold leading-snug text-text-muted">
                {tr(
                  "Haydovchi bu safarga faqat ayol yo'lovchi oladi",
                  'Водитель берёт в эту поездку только женщин',
                  'The driver takes only female passengers on this ride'
                )}
              </span>
            </button>
          </div>

          {/* Qulayliklar — ikki ustunli panjara: 6 ta shart bitta ekranga sig'adi. */}
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">
              {tr('Qulayliklar', 'Удобства', 'Comfort')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COMFORT.map((c) => {
                const on = draft[c.key];
                return (
                  <button
                    key={String(c.key)}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDraft((p) => ({ ...p, [c.key]: !p[c.key] }))}
                    className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                      on
                        ? 'border-accent bg-brand-pink-light dark:bg-accent/10 text-accent'
                        : 'border-border bg-surface text-text-muted hover:border-accent/50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <c.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Haydash uslubi */}
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">
              {tr('Haydash uslubi', 'Стиль вождения', 'Driving style')}
            </p>
            <div className="flex flex-wrap gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s.value || 'any'}
                  type="button"
                  aria-pressed={draft.speed === s.value}
                  onClick={() => setDraft((p) => ({ ...p, speed: s.value }))}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    draft.speed === s.value
                      ? 'border-accent bg-brand-pink-light dark:bg-accent/10 text-accent'
                      : 'border-border bg-surface text-text-muted hover:border-accent/50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Halol izoh: qulaylik belgilari backendda filtr parametri sifatida yo'q. */}
          <p className="text-[11px] leading-snug text-text-muted">
            {tr(
              'Narx serverda filtrlanadi. Qulaylik belgilari va haydash uslubi esa topilgan safarlar ichida saralanadi.',
              'Цена фильтруется на сервере. Удобства и стиль вождения применяются к уже найденным поездкам.',
              'Price is filtered on the server. Comfort options and driving style are applied to the rides already found.'
            )}
          </p>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setDraft((p) => ({ ...EMPTY_EXTRA, sort: p.sort }))}
              className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {tr('Tozalash', 'Сбросить', 'Reset')}
            </button>
            <Button
              className="flex-1"
              onClick={() => {
                setExtra(draft);
                setFiltersOpen(false);
              }}
            >
              {tr("Ko'rsatish", 'Показать', 'Show results')}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Выдвижная Bottom Sheet шторка для карты */}
      <BottomSheet
        isOpen={openMap !== null}
        onClose={() => setOpenMap(null)}
        title={tr('Xaritadan tanlang', 'Выберите на карте', 'Pick on the map')}
      >
        <div className="p-2 pb-6">
          {openMap === 'from' && (
            <MapPicker
              defaultLocation={filterCoords}
              onChange={(coords, address) => {
                setFilterCoords(coords);
                if (address) setFilterFrom(address);
                // Xaritadan tanlandi → LOKATSIYA rejimi: eng yaqin safarlarni ko'rsatamiz.
                setFromByMap(true);
              }}
            />
          )}
          <Button className="w-full mt-4" onClick={() => setOpenMap(null)}>
            {tr('Tasdiqlash', 'Подтвердить', 'Confirm')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
