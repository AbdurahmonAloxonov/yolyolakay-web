'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { getMyRides, getRide } from '@/shared/api/rides';
import { getMe } from '@/shared/api/users';
import { getCachedRide, cacheRides, mergeRide } from '@/shared/api/rideCache';
import type { RideSearchItem } from '@/shared/api/types/ride';
import { getAccessToken } from '@/shared/lib/token';
import { Button } from '@/shared/ui/Button';
import {
  formatCurrency,
  formatTripDateTime,
  departureStatusLabel,
  tashkentLocalDate,
  hasDeparted,
  isTripOpen,
  normalizeStatus,
  personName,
  tripStatusLabel,
} from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { fetchDayWeather, tempLabel, weatherLabel } from '@/shared/lib/weather';
import { getRideDriverPosition } from '@/shared/api/telematics';
import { hasValidCoords } from '@/shared/lib/maps';
import { RouteMapSheet } from '@/shared/ui/RouteMapSheet';
import { RoutePreview } from '@/shared/ui/RoutePreview';
import { TripLive } from '@/shared/ui/TripLive';
import {
  ArrowLeft,
  Calendar,
  User,
  ShieldCheck,
  Users,
  MapIcon,
  Car,
  Share2,
  Eye,
  Star,
  Venus as VenusIcon,
} from 'lucide-react';
import { ReviewsSection } from '@/shared/ui/ReviewsSection';
import { SeatMap } from '@/shared/ui/SeatMap';
import { rememberRide } from '@/shared/lib/recentRides';
import { toast } from 'sonner';
import { shareRide } from '@/shared/lib/shareRide';
import { shareOrCopy } from '@/shared/lib/share';
import { createWatchToken } from '@/shared/api/rides';
import { buildWatchUrl, readWatchToken, WATCH_PARAM } from '@/shared/lib/watchLink';
import { useVehicle } from '@/entities/ride/api/useVehicle';
import { normalizeVehicle } from '@/shared/api/vehicles';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { isKycApproved } from '@/shared/lib/trust';
import { useTr } from '@/shared/lib/useTr';
import { FeatureBadge, rideFeatures } from '@/shared/ui/rideFeatures';

interface TripDetailClientProps {
  id: string;
  /**
   * Server `GET /rides/{id}` dan olgan safar (`page.tsx`). Mehmon uchun bu YAGONA
   * ishonchli manba edi — ilgari u faqat qidiruv keshiga tayanardi va to'g'ridan
   * havola bilan kelgan odam hech nima ko'rmasdi.
   */
  initialTrip: RideSearchItem | null;
}

export default function TripDetailClient({ id, initialTrip }: TripDetailClientProps) {
  const locale = useLocale();
  const router = useRouter();
  const tr = useTr();

  // Marshrutni ILOVA ICHIDA ko'rsatish (RouteMapSheet) — yo'lovchi yo'nalishni xaritada
  // ko'radi, tashqi saytga chiqib ketmaydi (PWA'da ilovadan chiqish shikoyati bor edi).
  const [routeSheetOpen, setRouteSheetOpen] = useState(false);

  // Login holati faqat mijozda ma'lum (localStorage) — hidratsiya mosligi uchun effektda
  // o'qiymiz. null = hali aniqlanmagan, false = mehmon.
  //
  // Sahifa 2026-08-02 dan mehmonga OCHIQ (routes.ts BROWSE_PATHS).
  // 🔓 2026-08-09: `GET /rides/{id}` ham tokensiz ochildi (avval 401 edi) — endi
  // safarni SERVER o'qib beradi (`initialTrip`), ya'ni mehmon to'g'ridan havola
  // bilan kelsa ham hamma narsani ko'radi. Kesh (`rideCache`) zaxira bo'lib qoldi.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    setIsAuthed(!!getAccessToken());
  }, []);

  // Detal manbalari (ustuvorlik bo'yicha):
  //   1) GET /rides/{id} — backend v6'da qo'shildi (stagingda hali 404 -> null, o'tib ketiladi),
  //   2) qidiruv/tarix keshi (rideCache),
  //   3) /rides/my?role=driver (o'z e'lonim bo'lsa),
  //   4) topilmasa — "topilmadi" holati.
  const { data: trip, isLoading } = useQuery<RideSearchItem | null>({
    queryKey: ['trip', id, isAuthed],
    queryFn: async () => {
      // Mehmon: tokenli chaqiruvlar 401 beradi, shuning uchun ularni o'tkazib
      // yuboramiz va faqat qidiruvdan qolgan keshni ko'ramiz. Kesh bo'lsa mehmon
      // safar tafsilotlarini TO'LIQ ko'radi — login faqat bron uchun kerak.
      if (!isAuthed) {
        // Mehmon uchun ham `GET /rides/{id}` endi ochiq, lekin server allaqachon
        // o'qib bergan — takroriy so'rov qilmaymiz. Server javob bermagan bo'lsa
        // (uzilish) keshga tushamiz.
        return initialTrip ?? getCachedRide(id);
      }

      const fresh = await getRide(id);
      if (fresh) {
        // Yangi javobni eskisi (SSR/kesh) bilan BIRLASHTIRAMIZ: `GET /rides/{id}`
        // haydovchisiz javob berishi mumkin, o'shanda 20 soniyalik yangilashdan
        // keyin ekrandagi haydovchi bloki yo'qolib qolardi.
        const merged = mergeRide(fresh, initialTrip ?? getCachedRide(id));
        cacheRides([merged]);
        return merged;
      }
      const cached = getCachedRide(id);
      if (cached) return cached;
      const mine = await getMyRides('driver').catch(() => []);
      const found = mine.find((x) => String(x.id) === id);
      if (found) {
        cacheRides([found]);
        return found;
      }
      return initialTrip;
    },
    // Server topgan safar — BOSHLANG'ICH qiymat: SSR HTML'ida darhol haqiqiy matn
    // turadi (bot ham, odam ham "Yuklanmoqda..." ko'rmaydi), so'ng fon'da yangilanadi.
    initialData: initialTrip ?? undefined,
    enabled: isAuthed !== null,
    /*
     * Holat o'zgarishini ushlash uchun yengil polling: haydovchi safarni
     * boshlaganda/yakunlaganda yo'lovchi sahifani qayta yuklamasdan ko'rsin.
     * Tugagan safarda to'xtaydi va fon tabda ishlamaydi — ortiqcha so'rov yo'q.
     * Mehmonda ma'nosiz (u faqat keshni ko'radi), shuning uchun tokensiz o'chiq.
     */
    refetchInterval: (query) => {
      if (!isAuthed) return false;
      const s = normalizeStatus(query.state.data?.status ?? '');
      if (s === 'COMPLETED' || s === 'CANCELLED') return false;
      // Safar YO'LDA bo'lsa yo'lovchi ekranga tikilib turadi (haydovchi keldimi,
      // qayerda?) — 20 s u yerda uzoq. Jo'nashdan oldin esa tez-tez so'rashning
      // ma'nosi yo'q, backend har chaqiruvga ~0.7 s sarflaydi.
      return s === 'IN_PROGRESS' ? 8000 : 20000;
    },
    refetchIntervalInBackground: false,
  });

  // Mashina — yo'lovchi kutayotgan avtomobilni taniy olishi uchun.
  //
  // AVVAL javobning O'ZIDAN: swagger (2026-08-07) `RideResponse` va
  // `RideSearchResponse` ikkalasida ham `car: domain.Vehicle` beradi, ya'ni
  // qo'shimcha so'rov KERAK EMAS (har chaqiruv ~0.7 s turadi).
  // Faqat `car` kelmasa `GET /vehicles/{id}` ga tushamiz — swagger jonli
  // xatti-harakatdan bir necha marta farq qilgan, shuning uchun zaxira yo'l bor.
  const embeddedVehicle = normalizeVehicle(trip?.car);
  const { data: fetchedVehicle } = useVehicle(embeddedVehicle ? null : trip?.vehicle_id);
  const vehicle = embeddedVehicle ?? fetchedVehicle;

  // Marshrut nomlari — TO'G'RIDAN backend matni (reverse-geocode YO'Q).
  const routeNames = trip
    ? { from: trip.origin_address || '—', to: trip.destination_address || '—' }
    : null;

  // SO'NGGI KO'RILGANLARGA yozamiz — odam qaytganda qayerda qolganini
  // eslasin (izohi `shared/lib/recentRides.ts` da). Faqat brauzerda va
  // faqat yo'nalish ma'lum bo'lsa.
  const tripId = trip?.id ? String(trip.id) : null;
  const fromName = routeNames?.from;
  const toName = routeNames?.to;
  React.useEffect(() => {
    if (!tripId || !fromName || !toName) return;
    rememberRide({ id: tripId, from: fromName, to: toName });
  }, [tripId, fromName, toName]);

  // "Yuklanmoqda..." FAQAT ko'rsatadigan narsa yo'q bo'lganda.
  //
  // `isAuthed` effektda o'qiladi (localStorage), ya'ni SERVERDA u DOIM `null` —
  // shu sabab ilgari SSR HTML'ida hamisha spinner turardi va Google safar
  // sahifasidan boshqa hech nima ko'rmasdi. Server safarni topgan bo'lsa
  // (`initialTrip`) darhol chizamiz: birinchi render serverda ham, mijozda ham
  // bir xil (ikkalasida `isAuthed === null`), ya'ni hidratsiya buzilmaydi.
  /*
   * Ob-havo — manzil koordinatasi va safar kuni bo'yicha. O'tgan safarga
   * prognoz ma'nosiz, shuning uchun so'rov ham yuborilmaydi.
   */
  const tripDay = tashkentLocalDate(trip?.departure_time);
  const { data: weather } = useQuery({
    queryKey: ['weather', trip?.destination_lat, trip?.destination_lon, tripDay],
    enabled:
      !!tripDay &&
      typeof trip?.destination_lat === 'number' &&
      typeof trip?.destination_lon === 'number' &&
      tripDay >= tashkentLocalDate(new Date().toISOString()),
    staleTime: 30 * 60_000,
    queryFn: () =>
      fetchDayWeather(trip?.destination_lat as number, trip?.destination_lon as number, tripDay),
  });

  /*
   * Haydovchining oxirgi ma'lum joyi — FAQAT safar boshlangach
   * (`IN_PROGRESS`).
   *
   * 🔴 ORALIQ 30 → 10 SONIYA (18.09.2026, Yandex Go bilan
   * solishtirishdan keyin). Eski izohda «ping ham shu chastotada
   * keladi, undan tez so'rash aniqlik bermaydi» deb yozilgandi va bu
   * XATO fikr edi: haydovchi 20 soniyada bir yuboradi (`LivePing._minGap`),
   * lekin biz 30 soniyada bir so'raganimiz uchun YANGI ping ekranga
   * o'rtacha 15, eng yomon holatda 30 soniya KECHIKIB tushardi —
   * ya'ni jami eskilik 50 soniyagacha yetardi. Tezroq so'rash yangi
   * nuqta YARATMAYDI, lekin KELGANINI darhol ko'rsatadi.
   *
   * ⚠️ Fon tabda so'ralmaydi (`refetchIntervalInBackground` standart
   * `false`) — yopiq oynada batareya yeyilmasin.
   */
  /*
   * KUZATUV HAVOLASI — `?watch=wt_...` (16.09.2026).
   *
   * 🔴 Ilgari «Safarimni kuzat» onaga shunchaki E'LON havolasini
   * yuborardi: u yo'nalishni ko'rardi, mashinani KO'RMASDI. Endi
   * havolada kuzatuv tokeni bo'ladi va bu sahifa MEHMONGA ham jonli
   * nuqtani ko'rsatadi. Izohi `shared/lib/watchLink.ts` da.
   */
  const searchParams = useSearchParams();
  const watchToken = readWatchToken(searchParams.get(WATCH_PARAM));

  const { data: driverFeed } = useQuery({
    queryKey: ['driver-pos', trip?.id, watchToken ?? ''],
    // Safar bo'yicha manzil `ride_id` dan boshqa hech narsa talab
    // qilmaydi: ruxsatni ham, qaysi haydovchi ekanini ham server
    // o'zi hal qiladi.
    enabled: !!trip?.id && normalizeStatus(trip?.status ?? '') === 'IN_PROGRESS',
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    queryFn: () => getRideDriverPosition(trip!.id as string, watchToken),
  });

  const driverPos = driverFeed?.pos ?? null;

  /*
   * HAMROHLAR — boshqa TASDIQLANGAN yo'lovchilar.
   *
   * 🔴 14.09.2026 — ILDIZI: ro'yxat `GET /rides/{id}/passengers` dan
   * olinardi, u esa RBAC ostida: begonaga 403, hatto bron qilib
   * TASDIQLANMAGAN (pending) odamga ham 403 (jonli o'lchandi). Xato
   * ko'rinmasdi (bo'sh ro'yxat → blok chizilmaydi), lekin natija
   * shunday edi: «kim bilan ketaman» degan savolga javobni AYNAN
   * qaror qilayotgan odam — hali bron qilmagan yo'lovchi — ololmasdi.
   * Ayol yo'lovchi uchun bu eng ko'p so'ralgan narsa edi.
   *
   * Javob esa allaqachon qo'limizda: `GET /rides/{id}` javobining
   * O'ZIDA `passengers[]` keladi va u HAMMAGA ochiq — mehmonga ham.
   * Telefon u yerda faqat haydovchi/tasdiqlangan yo'lovchiga
   * qo'shiladi, qolganiga kalit umuman kelmaydi. Biz telefonni
   * baribir ko'rsatmaymiz (egasi qarori 12.09.2026), ya'ni
   * `/passengers` ga so'rov endi UMUMAN kerak emas: bitta so'rov
   * kamaydi va ro'yxat mehmonga ham ko'rinadi.
   */
  const coPassengers = trip?.passengers;
  // O'zini ro'yxatdan chiqarish uchun joriy foydalanuvchi id'si.
  const { data: me } = useQuery({
    queryKey: ['me'],
    enabled: isAuthed === true,
    staleTime: 5 * 60_000,
    queryFn: getMe,
  });
  const selfId = me?.user?.id;
  const otherPassengers = (coPassengers ?? []).filter(
    (p) => !selfId || String(p.id ?? '') !== String(selfId)
  );

  if (!trip && (isAuthed === null || isLoading)) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg">
        <p className="text-text-muted text-sm font-semibold">
          {tr('Yuklanmoqda...', 'Загрузка поездки...', 'Loading...')}
        </p>
      </div>
    );
  }

  if (!trip) {
    // Bu shoxga tushish endi FAQAT uzilishda mumkin.
    //
    // Ilgari mehmon uchun bu ODATIY hol edi (`GET /rides/{id}` tokensiz 401 berardi,
    // shuning uchun "tizimga kiring" deb yozardik). 2026-08-09 dan endpoint ochiq va
    // safarni server o'qiydi; mavjud bo'lmagan safar esa `page.tsx` da `notFound()`
    // bilan haqiqiy 404 beradi va bu yergacha yetib kelmaydi.
    //
    // Ya'ni bu yerda "Safar topilmadi" ham, "tizimga kiring" ham YOLG'ON bo'lardi —
    // safar bor, shunchaki server javob bermadi. Shuni ochiq aytamiz.
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bg p-4 space-y-4 text-center">
        <div className="bg-surface p-4 rounded-full border border-border shadow-sm">
          <User className="h-8 w-8 text-accent opacity-70" />
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-text-muted">
          {tr(
            "Safar ma'lumotini yuklab bo'lmadi. Bir necha daqiqadan so'ng qayta urinib ko'ring.",
            'Не удалось загрузить поездку. Попробуйте через несколько минут.',
            'Could not load the trip. Please try again in a few minutes.'
          )}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => router.refresh()}>
            {tr('Qayta urinish', 'Повторить', 'Try again')}
          </Button>
          <Link href={`/${locale}/search`}>
            <Button variant="secondary">{tr('Qidiruv', 'К поиску', 'Search')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  // v1 CREATED / v2 active — normalizatsiyasiz solishtirish CTA'ni doim o'chirib qo'yardi.
  /*
   * Ulashish natijasiga QARAB xabar ko'rsatamiz: tizim oynasi ochilganda
   * ortiqcha toast chiqarish shovqin, nusxalanganda esa odam nima
   * bo'lganini BILISHI kerak — aks holda tugma "hech nima qilmadi"
   * bo'lib ko'rinadi (desktop brauzerlarda `navigator.share` yo'q).
   */
  /**
   * «SAFARIMNI KUZAT» HAVOLASINI ULASHISH.
   *
   * Token FAQAT bosilganda olinadi: oldindan olsak, sahifani har
   * ochganda serverda keraksiz token yig'ilib borardi.
   *
   * 🔑 Rad etilsa SABABI AYTILADI (uy qoidasi). Serverning qoidasi:
   * token faqat haydovchiga va TASDIQLANGAN yo'lovchiga beriladi —
   * kutayotgan bron ham 403 oladi (prodda o'lchandi). Umumiy «xato»
   * xabari odamni «ilova buzuq» deb o'ylashga majburlardi.
   */
  const handleShareWatch = async () => {
    const token = await createWatchToken(String(trip.id ?? id));
    if (!token) {
      toast.error(
        tr(
          "Kuzatuv havolasini faqat haydovchi yoki broni TASDIQLANGAN yo'lovchi ulasha oladi",
          'Ссылку на отслеживание может отправить только водитель или пассажир с ПОДТВЕРЖДЁННОЙ бронью',
          'Only the driver or a passenger with a CONFIRMED booking can share a tracking link'
        )
      );
      return;
    }
    const url = buildWatchUrl(window.location.origin, locale, String(trip.id ?? id), token);
    // ⚠️ Token `await` qilingach brauzer bosishni «unutadi» va `share`
    // NotAllowedError berishi mumkin — `shareOrCopy` shunda nusxaga o'tadi
    // (ilgari bu yerda tugma jim o'lardi).
    await shareOrCopy(
      { text: url },
      {
        copied: tr(
          'Kuzatuv havolasi nusxalandi',
          'Ссылка отслеживания скопирована',
          'Tracking link copied'
        ),
        failed: tr("Ulashib bo'lmadi", 'Не удалось поделиться', "Couldn't share"),
      }
    );
  };

  const handleShare = async () => {
    const result = await shareRide(
      {
        id: String(trip.id ?? id),
        from: routeNames?.from,
        to: routeNames?.to,
        departureTime: trip.departure_time,
        price: trip.price_per_seat,
        seats: trip.available_seats ?? trip.total_seats,
      },
      locale
    );
    if (result === 'copied') {
      toast.success(tr('Havola nusxalandi', 'Ссылка скопирована', 'Link copied'));
    } else if (result === 'failed') {
      toast.error(tr("Ulashib bo'lmadi", 'Не удалось поделиться', "Couldn't share"));
    }
  };

  const tripStatus = normalizeStatus(trip.status);
  const isOnTheWay = tripStatus === 'IN_PROGRESS';

  /*
   * JO'NAB KETGANMI (10.09.2026, jonli o'lchov).
   *
   * 🔴 NEGA KERAK: bu sahifada 4-sentabrda jo'nagan safar ochilardi va
   * bir kartada BIR VAQTNING O'ZIDA «FAOL» yorlig'i, uning ostida
   * «Jo'nab ketdi» yozuvi va pastda ISHLAYDIGAN «Savdolarga kirish»
   * tugmasi turardi. Sabab: holat backenddan hamon `active` bo'lib
   * keladi, `isTripOpen` esa faqat statusga qaraydi — VAQTGA emas.
   * Odam tugmani bosib, bir hafta oldin ketgan mashina uchun savdo
   * ochardi.
   *
   * Chegara qidiruvdagi bilan bir xil (`hasDeparted`, `shared/lib/format.ts`).
   */
  const departed = hasDeparted(trip.departure_time);

  const isActive = isTripOpen(trip.status) && !departed;

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8 select-none">
      <div className="mx-auto max-w-md space-y-6">
        {/* Кнопка Назад */}
        <Link
          href={`/${locale}/search`}
          className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
          <span>{tr('Orqaga', 'Назад к поиску', 'Back')}</span>
        </Link>

        {/* KUZATUVCHI UCHUN QATOR — 16.09.2026.

            🔴 Havolani ochgan odam (onasi, turmush o'rtog'i) NIMA
            ko'rayotganini bilishi kerak. Ayniqsa safar hali
            boshlanmagan bo'lsa: xaritada mashina YO'Q va u buni
            «havola ishlamadi» deb o'ylardi.

            ⚠️ Shuning uchun matn HOLATGA qarab o'zgaradi va nuqta
            nega yo'qligini AYTADI — «jim bo'sh xarita» eng yomon
            variant. */}
        {watchToken && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-turquoise/40 bg-turquoise-light/30 p-4 text-sm font-bold text-wine-ash dark:bg-turquoise/10 dark:text-turquoise">
            <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {isOnTheWay
                ? tr(
                    "Siz bu safarni kuzatyapsiz — mashina xaritada ko'rinadi",
                    'Вы отслеживаете эту поездку — машина видна на карте',
                    'You are tracking this trip — the car is shown on the map'
                  )
                : departed
                  ? tr(
                      'Safar yakunlangan — mashina endi xaritada ko’rsatilmaydi',
                      'Поездка завершена — машина больше не показывается на карте',
                      'The trip has finished — the car is no longer shown'
                    )
                  : tr(
                      "Safar hali boshlanmagan — mashina yo'lga chiqqach xaritada paydo bo'ladi",
                      'Поездка ещё не началась — машина появится на карте после выезда',
                      'The trip has not started yet — the car will appear once it sets off'
                    )}
            </span>
          </div>
        )}

        {/* Детальная карточка поездки */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-6">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold text-accent tracking-wider uppercase">
                {tr('Safar tafsilotlari', 'Детали поездки', 'Trip details')}
              </span>
              {/* ULASHISH — safar Telegramga tayyor matn bo'lib ketadi.
                  Ilgari odam safarni ko'rsatish uchun ekranni suratga olardi,
                  suratdan esa havola ochilmaydi. */}
              <button
                type="button"
                onClick={handleShare}
                aria-label={tr('Safarni ulashish', 'Поделиться поездкой', 'Share ride')}
                title={tr('Safarni ulashish', 'Поделиться поездкой', 'Share ride')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:border-accent hover:text-accent active:scale-95"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>

            {/* KUZATUV HAVOLASI — 16.09.2026.

                🔴 Ilgari «Safarimni kuzat» faqat ILOVADA bor edi va u
                ham shunchaki e'lon havolasini yuborardi: yaqin kishi
                mashina qayerdaligini KO'RMASDI.

                Faqat KIRGAN odamga ko'rinadi: mehmon token ololmaydi.
                Tugma bosilganda token so'raladi va rad etilsa SABABI
                aytiladi (`handleShareWatch`). */}
            {isAuthed && isActive && (
              <button
                type="button"
                onClick={handleShareWatch}
                className="inline-flex items-center gap-1.5 self-start rounded-full border border-turquoise px-3 py-1.5 text-xs font-bold text-turquoise-ink transition-colors hover:bg-turquoise-light/50 dark:text-turquoise dark:hover:bg-turquoise/10"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                {tr('Safarimni kuzatish havolasi', 'Ссылка на отслеживание', 'Share tracking link')}
              </button>
            )}
            <h2 className="text-2xl font-extrabold text-text flex items-center gap-2">
              <span>{routeNames?.from || '...'}</span>
              <span className="text-accent">→</span>
              <span>{routeNames?.to || '...'}</span>
            </h2>
            {/* HOLAT — ilgari bu sahifada umuman ko'rinmasdi: haydovchi safarni
                boshlaganini yoki yakunlaganini yo'lovchi bilmasdi. Endi holat
                yozuv bilan turadi va yengil polling uni o'zi yangilaydi. */}
            <Badge
              variant={isActive ? 'primary' : isOnTheWay ? 'success' : 'secondary'}
              className="mt-1"
            >
              {/* Vaqt o'tib ketgan bo'lsa BACKEND STATUSI emas, HAQIQAT
                  yoziladi: «FAOL» yorlig'ining ostida «Jo'nab ketdi»
                  turishi qarama-qarshilik edi. */}
              {departed
                ? tr("Jo'nab ketdi", 'Отправился', 'Departed')
                : tripStatusLabel(trip.status ?? '', locale)}
            </Badge>
          </div>

          <div className="space-y-4 border-y border-border/60 py-5">
            <div className="flex items-center gap-3 text-text">
              <Calendar className="h-5 w-5 text-accent shrink-0" />
              <div>
                <span className="text-xs text-text-muted block">
                  {tr("Jo'nash sanasi", 'Дата отправления', 'Departure date')}
                </span>
                <span className="text-sm font-semibold text-text">
                  {formatTripDateTime(trip.departure_time) || '—'}
                </span>
                {/* Bu sahifada aniq vaqt QOLADI (qidiruv kartasidan farqli),
                    "qancha qoldi" esa uning ostiga qo'shiladi: odam ulgurishini
                    shu yerda hal qiladi.

                    Jo'nab ketgan bo'lsa (3 soatdan oshgan) BU QATOR
                    TUSHIRILADI: u holatda yozuv yuqoridagi yorliq bilan
                    SO'ZMA-SO'Z bir xil bo'lardi — bitta kartada bir gap
                    ikki marta (10.09.2026).

                    🔴 14.09.2026: uch soatlik oyna ICHIDA bu yerda
                    "Jo'nab ketdi" turardi — yuqorida esa "FAOL" yorlig'i
                    va pastda ISHLAYDIGAN tugma. Endi holat bilan
                    hisoblanadi: "Kechikmoqda — 12 daqiqa" (ilovadagi
                    `departureStatusLabel` bilan so'zma-so'z bir xil). */}
                {!departed && departureStatusLabel(trip.departure_time, trip.status, locale) ? (
                  <span className="block text-xs font-bold text-accent">
                    {departureStatusLabel(trip.departure_time, trip.status, locale)}
                  </span>
                ) : null}
                {/* MANZILDAGI OB-HAVO — safar kunida. Odam nima kiyishini
                    va yo'l qanday bo'lishini shu yerda biladi. */}
                {weather && (
                  <span className="block text-xs text-text-muted">
                    {trip.destination_address}: {tempLabel(weather.maxTemp)},{' '}
                    {weatherLabel(weather.code, (uz, ru, en) => tr(uz, ru, en))}
                  </span>
                )}
              </div>
            </div>

            {/* O'RINDIQ SXEMASI — ilgari bu yerda «2 / 4» kasr turardi va
                u ikki xil o'qilardi: mashinada ikkita joy bormi yoki
                ikkitasi BO'SHMI? Izohi `SeatMap` da. */}
            <SeatMap
              totalSeats={trip.total_seats}
              availableSeats={trip.available_seats ?? trip.total_seats}
              maxTwoBack={trip.max_two_back}
            />

            {/* Oraliq shaharlar — yo'l-yo'lakay kirib o'tiladigan nuqtalar */}
            {(trip.stops?.length ?? 0) > 0 && (
              <div className="flex items-center gap-3 text-text">
                <MapIcon className="h-5 w-5 text-accent shrink-0" />
                <div>
                  <span className="text-xs text-text-muted block">
                    {tr("Yo'l-yo'lakay", 'Через города', 'Via cities')}
                  </span>
                  <span className="text-sm font-semibold text-text">
                    {trip.stops!.map((s) => s.address).join(' → ')}
                  </span>
                </div>
              </div>
            )}

            {personName(trip.driver) ? (
              <div className="flex items-center gap-3 text-text">
                <User className="h-5 w-5 text-accent shrink-0" />
                <div>
                  <span className="text-xs text-text-muted block">
                    {tr('Haydovchi', 'Водитель', 'Driver')}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
                    {/* Bosilsa haydovchi profili ochiladi (reyting, MyID,
                        qachondan beri platformada). `id` kelmasa oddiy
                        yozuv bo'lib qoladi. */}
                    {trip.driver?.id ? (
                      <Link
                        href={`/${locale}/user/${trip.driver.id}`}
                        className="underline decoration-dotted underline-offset-2 hover:text-accent"
                      >
                        {personName(trip.driver)}
                      </Link>
                    ) : (
                      personName(trip.driver)
                    )}
                  </span>
                </div>
              </div>
            ) : null}

            {/* HAYDOVCHI HAQIDA SHARHLAR — qaror AYNAN shu sahifada qabul
                qilinadi va u MEHMON rejimida ham ochiladi (endpoint
                tokensiz ishlaydi, o'lchandi). Profilga o'tishni kutib
                bo'lmaydi.

                Atigi ikkitasi: sahifa allaqachon zich, qolgani haydovchi
                ismi bosilganda profilda ochiladi. */}
            {trip.driver?.id ? (
              <div className="border-t border-border/60 pt-4">
                <ReviewsSection userId={trip.driver.id} limit={2} />
              </div>
            ) : null}

            {/* HAMROHLAR — boshqa tasdiqlangan yo'lovchilar. Manba —
                safar javobining o'zidagi `passengers[]` (14.09.2026):
                MEHMONGA ham ko'rinadi, chunki qaror aynan shu yerda
                qabul qilinadi.
                🔒 TELEFON YO'Q: yo'lovchi-yo'lovchiga telefon shart emas
                (egasi qarori 12.09.2026) — ilova bilan bir xil. */}
            {otherPassengers.length > 0 ? (
              <div className="border-t border-border/60 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {tr('Hamrohlar', 'Попутчики', 'Fellow passengers')}
                  </span>
                </div>
                <ul className="space-y-2">
                  {otherPassengers.map((p, i) => {
                    const name = (p.name ?? '').trim();
                    const g = (p.gender ?? '').trim().toLowerCase();
                    const genderLabel =
                      g === 'male'
                        ? tr('Erkak', 'Мужской', 'Male')
                        : g === 'female'
                          ? tr('Ayol', 'Женский', 'Female')
                          : null;
                    return (
                      <li key={p.id ?? i} className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-muted">
                          <User className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-text">
                            {name || tr("Yo'lovchi", 'Пассажир', 'Passenger')}
                          </span>
                          {genderLabel ? (
                            <span className="block text-xs text-text-muted">{genderLabel}</span>
                          ) : null}
                        </span>
                        {typeof p.rating === 'number' && p.rating > 0 ? (
                          <span className="flex shrink-0 items-center gap-0.5 text-xs text-text-muted">
                            <Star
                              className="h-3 w-3 text-warning"
                              fill="var(--warning)"
                              aria-hidden
                            />
                            {p.rating.toFixed(1)}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {/* Mashina — rusum + davlat raqami. Ikkalasidan biri bo'lmasa ham
                bori ko'rsatiladi; ikkalasi ham bo'lmasa qator chizilmaydi. */}
            {vehicle && (vehicle.brand || vehicle.model || vehicle.plate) ? (
              <div className="flex items-center gap-3 text-text">
                <Car className="h-5 w-5 text-accent shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-text-muted block">
                    {tr('Mashina', 'Автомобиль', 'Car')}
                  </span>
                  <span className="text-sm font-semibold text-text">
                    {[[vehicle.brand, vehicle.model].filter(Boolean).join(' '), vehicle.plate]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              </div>
            ) : null}

            {/* 🔴 IKKI XATO TUZATILDI (2026-08-28).
                1) Yozuvda «MyID orqali tasdiqlangan» derdi — MyID esa
                   mahsulotdan 22-avgustda OLIB TASHLANGAN.
                2) Belgi HAR safarda SHARTSIZ chiqardi, ya'ni hujjati
                   tekshirilmagan haydovchida ham «tasdiqlangan» deb
                   turardi. Bu yolg'on va'da — aynan xavfsizlik joyida.

                Endi haqiqiy `kyc_status` ga qaraydi va tekshirilmagan
                bo'lsa UMUMAN chizilmaydi: yo'q narsani va'da qilgandan
                ko'ra hech nima demagan yaxshi. */}
            {isKycApproved(trip.driver?.kyc_status) && (
              <div className="flex items-center gap-3 text-text">
                <ShieldCheck className="h-5 w-5 text-accent shrink-0" />
                <div>
                  <span className="text-xs text-text-muted block">
                    {tr('Xavfsizlik', 'Безопасность', 'Safety')}
                  </span>
                  <span className="text-sm font-semibold text-success">
                    {tr('Hujjatlari tekshirilgan', 'Документы проверены', 'Documents verified')}
                  </span>
                </div>
              </div>
            )}

            {/*
              «FAQAT AYOLLAR» — QULAYLIK EMAS, BRON SHARTI.

              Shuning uchun u belgilar orasida emas, alohida va bron
              tugmasidan OLDIN turadi: odam shartni bron qilishdan
              oldin ko'rishi kerak, keyin emas.

              🔑 Matn haydovchining JINSI haqida emas — erkak haydovchi
              ham «faqat ayol yo'lovchi olaman» deya oladi.
            */}
            {trip.gender_restriction === 'female' && (
              <div className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-brand-pink-light px-3 py-2.5 dark:bg-accent/10">
                <VenusIcon className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                <span className="text-sm font-semibold text-text">
                  {tr(
                    "Haydovchi bu safarga faqat ayol yo'lovchi oladi",
                    'Водитель берёт в эту поездку только женщин',
                    'The driver takes only female passengers on this ride'
                  )}
                </span>
              </div>
            )}

            {/* Qulayliklar va salon qoidalari — haydovchi e'lon qilgan belgilar (ikon-badge) */}
            {(() => {
              // 🔴 2026-08-16: emoji o'rniga IKONKA, ro'yxat esa YAGONA
              // manbadan (`shared/ui/rideFeatures`) — ilgari u to'rtta
              // faylda qo'lda takrorlanardi.
              const chips = rideFeatures(trip, tr, false);
              if (chips.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-2 pt-1">
                  {chips.map((chip) => (
                    <FeatureBadge
                      key={chip.key}
                      icon={chip.icon}
                      label={chip.label}
                      className="bg-surface px-3 py-1.5"
                    />
                  ))}
                </div>
              );
            })()}

            {/*
              XARITA ENDI TUGMA ORTIDA EMAS — 16.09.2026
              (egasi: «karta to'liq ishlatilsin»).

              🔴 Bu yerda faqat «Marshrutni xaritada ko'rish» tugmasi
              turardi. Ya'ni yo'nalishni ko'rish uchun odam avval QAROR
              qilishi kerak edi, holbuki bizda uchrashuv nuqtasi hal
              qiluvchi: manzil — haydovchi yozgan erkin matn («Chortoq,
              3-mavze»), shahar nomi esa qayerdan chiqishni aytmaydi.

              Endi yo'l DARHOL ko'rinadi. Bosilsa o'sha varaq ochiladi —
              u yerda masofa, davomiylik, haydovchining jonli nuqtasi va
              navigator havolasi bor, ya'ni tugma yo'qolmadi, XARITANING
              O'ZI tugmaga aylandi.
            */}
            {hasValidCoords(trip.origin_lat, trip.origin_lon) &&
              hasValidCoords(trip.destination_lat, trip.destination_lon) &&
              /*
               * SAFAR YO'LDA — xarita «rasm» emas, JAVOB bo'ladi
               * (17.09.2026, egasi: «safar boshlanganda qayerda
               * ketayotganini ko'rish imkoni yo'q — yana Yandex kartaga
               * kirvolishadi»).
               *
               * Bu holatda oddiy ko'rik o'rniga `TripLive` chiziladi:
               * haqiqiy yo'l geometriyasi, bosib o'tilgan ulush, qolgan
               * masofa, yetib borish vaqti va PING QANCHA ESKI ekani.
               */
              (isOnTheWay ? (
                <TripLive
                  from={[trip.origin_lat, trip.origin_lon]}
                  to={[trip.destination_lat, trip.destination_lon]}
                  via={(trip.stops ?? [])
                    .filter((s) => hasValidCoords(s.lat, s.lon))
                    .map((s) => [s.lat, s.lon] as [number, number])}
                  pickup={
                    hasValidCoords(trip.pickup_lat, trip.pickup_lon)
                      ? ([trip.pickup_lat, trip.pickup_lon] as [number, number])
                      : null
                  }
                  driver={driverPos}
                  trackingDenied={driverFeed?.forbidden ?? false}
                  onOpen={() => setRouteSheetOpen(true)}
                  openLabel={tr(
                    "To'liq xaritada ochish",
                    'Открыть на полной карте',
                    'Open the full map'
                  )}
                />
              ) : (
                <RoutePreview
                  from={[trip.origin_lat, trip.origin_lon]}
                  to={[trip.destination_lat, trip.destination_lon]}
                  via={(trip.stops ?? [])
                    .filter((s) => hasValidCoords(s.lat, s.lon))
                    .map((s) => [s.lat, s.lon] as [number, number])}
                  /* UCHRASHUV NUQTASI — haydovchi xaritada belgilagan aniq
                     joy (`pickup_lat/pickup_lon`, 17.09.2026 da o'lchandi:
                     saqlanadi va qaytadi). Ilgari yo'lovchi faqat matnni
                     ko'rardi va uni O'ZI qidirib topishi kerak edi. */
                  pickup={
                    hasValidCoords(trip.pickup_lat, trip.pickup_lon)
                      ? ([trip.pickup_lat, trip.pickup_lon] as [number, number])
                      : null
                  }
                  /* JONLI NUQTA — safar yo'lda bo'lsa mashina SHU YERDA,
                     sahifaning o'zida ko'rinadi. Ilgari u faqat varaq
                     ochilganda chizilardi: «mashinam qayerda» degan savolga
                     javob olish uchun odam avval xaritani ochishi kerak
                     edi (kuzatuv havolasi bilan kelgan onasi ham). */
                  driver={
                    driverPos
                      ? {
                          coord: [driverPos.lat, driverPos.lon],
                          heading: driverPos.heading ?? null,
                          updatedAt: driverPos.updatedAt ?? null,
                        }
                      : null
                  }
                  onOpen={() => setRouteSheetOpen(true)}
                  openLabel={tr(
                    "Marshrutni xaritada ko'rish",
                    'Показать маршрут на карте',
                    'Show the route on the map'
                  )}
                  height={200}
                />
              ))}
          </div>

          {/* Стоимость */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-text-muted block">
                {tr("Boshlang'ich narx", 'Начальная цена', 'Starting price')}
              </span>
              <span className="text-2xl font-extrabold text-accent">
                {trip.price_per_seat && trip.price_per_seat > 0
                  ? formatCurrency(trip.price_per_seat, locale)
                  : tr('Kelishilgan', 'Договорная', 'Negotiable')}
              </span>
            </div>

            <Button
              onClick={() => router.push(`/${locale}/bidding/${trip.id || id}`)}
              disabled={!isActive}
              className="px-6"
            >
              {/* O'CHIQ TUGMA SABABINI AYTADI (uy qoidasi): «Safar tugagan»
                  degan umumiy matn bu yerda YOLG'ON bo'lardi — safar
                  tugamagan, shunchaki jo'nab ketgan. */}
              {isActive
                ? tr('Savdolarga kirish', 'Войти в торги', 'Join the bidding')
                : isOnTheWay
                  ? tr("Safar yo'lda", 'Поездка в пути', 'Trip is on the way')
                  : departed
                    ? tr("Jo'nab ketdi", 'Уже отправился', 'Already departed')
                    : tr('Safar tugagan', 'Поездка завершена', 'Trip finished')}
            </Button>
          </div>
        </div>
      </div>

      {/* Marshrut xaritasi (ilova ichida) */}
      {hasValidCoords(trip.origin_lat, trip.origin_lon) &&
        hasValidCoords(trip.destination_lat, trip.destination_lon) && (
          <RouteMapSheet
            isOpen={routeSheetOpen}
            onClose={() => setRouteSheetOpen(false)}
            from={[trip.origin_lat, trip.origin_lon]}
            to={[trip.destination_lat, trip.destination_lon]}
            via={(trip.stops ?? [])
              .filter((s) => hasValidCoords(s.lat, s.lon))
              .map((s) => [s.lat, s.lon] as [number, number])}
            fromLabel={routeNames?.from}
            toLabel={routeNames?.to}
            driver={driverPos ? [driverPos.lat, driverPos.lon] : null}
            driverHeading={driverPos?.heading ?? null}
            driverUpdatedAt={driverPos?.updatedAt ?? null}
          />
        )}
    </div>
  );
}
