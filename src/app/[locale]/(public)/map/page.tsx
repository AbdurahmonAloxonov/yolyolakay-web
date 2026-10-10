'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpDown,
  ChevronRight,
  Clock,
  List,
  MapPin,
  Search as SearchIcon,
  SlidersHorizontal as Sliders,
  Users,
} from 'lucide-react';

import { searchRides } from '@/shared/api/rides';
import { cacheRides } from '@/shared/api/rideCache';
import type { RideSearchItem } from '@/shared/api/types/ride';
import { useRideRecommendations } from '@/entities/ride/api/useRideRecommendations';
import { useRoadRoute } from '@/entities/ride/api/useRoadRoute';
import { simplifyRoute } from '@/shared/lib/routeMath';
import { LiveMap, type LiveMapResult, type LiveMapRoute } from '@/shared/ui/LiveMap';
/* 🔑 Yozuvlar XARITA KOMPONENTIDAN EMAS, alohida fayldan: xarita fayli
   Leaflet'ni tortib keladi va u SERVERDA ishlamaydi (izohi o'sha yerda). */
import { useMyLocationLabels } from '@/shared/lib/myLocationLabels';
import { CityAutocomplete } from '@/shared/ui/CityAutocomplete';
import { DateField } from '@/shared/ui/DateField';
import { Counter } from '@/shared/ui/Counter';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { DateStrip } from '@/shared/ui/DateStrip';
import { PeshtoqBadge } from '@/shared/ui/EmptyState';
import { WatchRouteButton } from '@/features/search/WatchRouteButton';
import { getRecentRoutes, addRecentRoute, type RecentRoute } from '@/shared/lib/recentRoutes';
import { getAccessToken } from '@/shared/lib/token';
import { nearestCityName } from '@/shared/data/uzCities';
import { AtlasEdge } from '@/shared/ui/brand/Atlas';
import { majorCities, resolveCityCoord } from '@/shared/data/uzCities';
import {
  dateToRangeISO,
  departureStatusLabel,
  formatCurrency,
  formatTripDateTime,
  isRideBookable,
  personName,
  tashkentNow,
} from '@/shared/lib/format';
import { useTr } from '@/shared/lib/useTr';
import { tileAttributionText } from '@/shared/lib/mapTiles';

/**
 * «XARITA» BO'LIMI — saytning xarita-birinchi sahifasi.
 *
 * 🔴 NEGA (egasi, 17.09.2026): «karta faqat landingda qo'shilgan, bizga
 * Yandex Go'dek kartani ko'rinishi, qayerga qo'yilishi kerak — saytda
 * kartani shunaqangi qo'shginki HAQIQIY QULAYLIK bo'lsin».
 *
 * Saytda xarita o'nta sahifada bor edi, lekin hammasi TUGMA ORTIDA yoki
 * kichik ko'rik edi — ya'ni xarita hech qachon ish joyi bo'lmagan. Bu
 * sahifada joylashuv teskari: xarita — sahifaning O'ZI, forma va
 * natijalar uning ustida suzadi.
 *
 * QULAYLIK QAYERDA (uch amal, uchalasi ham bir ekranda):
 *   1. Ikki shaharni xaritadan bosasiz — qidiruv O'ZI ishga tushadi
 *      (tugma kutib turmaydi).
 *   2. Natijalar xaritada narx belgisi bo'lib chiqadi; belgini bossangiz
 *      pastdagi kartochka o'ziga tortadi va aksincha.
 *   3. Tanlangan safarda UCHRASHUV NUQTASI ko'rinadi — haydovchi
 *      xaritada belgilagan aniq joy (`pickup_lat/pickup_lon`, 17.09.2026
 *      da jonli o'lchandi: saqlanadi va `/rides/search` javobida qaytadi).
 *
 * ⚠️ «Atrofimdagi mashinalar» YO'Q va bo'la olmaydi: `GET /rides/search`
 * jo'nash VA borish koordinatasini birga talab qiladi. O'ylab topilgan
 * mashina chizish yolg'on bo'lardi — biz uni chizmaymiz.
 *
 * 🔴 TELEFONDA JOYLASHUV BOSHQACHA (320 px da ko'z bilan ko'rilgan):
 * to'liq forma xaritaning deyarli hammasini yopib qo'yardi. Shuning
 * uchun telefonda yuqorida faqat IXCHAM QATOR turadi («Toshkent →
 * Samarqand»), to'liq forma esa bosilganda varaqda ochiladi. Xarita
 * ko'rinib turishi — bu sahifaning butun ma'nosi.
 */

const DEFAULT_RADIUS_KM = 25;

/**
 * TEZ TANLASH — server tavsiya bermaganda (mehmon) ko'rsatiladigan
 * yo'nalishlar. Bular O'ZIMIZNING ro'yxatimizdan, ya'ni «safar bor»
 * degan va'da EMAS: bosilganda oddiy qidiruv ishga tushadi va natija
 * qanday bo'lsa, shunday ko'rsatiladi.
 */
const QUICK_ROUTES: [string, string][] = [
  ['Toshkent', 'Samarqand'],
  ['Toshkent', "Farg'ona"],
  ['Toshkent', 'Buxoro'],
  ['Samarqand', 'Buxoro'],
];

type Point = [number, number];

/**
 * OSM litsenziyasi (ODbL) ko'rinadigan attributsiyani TALAB qiladi.
 *
 * ⚠️ `py-[15px] -my-[15px]` — yozuv JOYIDAN qimirlamaydi, bosiladigan
 * maydon esa 14 px dan 44 px ga o'sadi (loyiha qoidasi; sarlavhadagi
 * havolalarda ham aynan shu usul). Auditsiz qoldirsak «mayda nishon»
 * ro'yxatiga tushib qolardi.
 */
function OsmCredit({ className = '' }: { className?: string }) {
  return (
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
      /* ⚠️ Shaffoflik YO'Q: `text-muted/80` sahifa zaminida 3.46:1
         chiqqandi (AA — 4.5:1), ya'ni yozuv «bor-yo'g'i bor» edi. */
      className={`-my-[15px] inline-flex items-center py-[15px] text-[10px] font-semibold text-text-muted hover:text-accent ${className}`}
    >
      {tileAttributionText()}
    </a>
  );
}

function MapSectionContent() {
  const locale = useLocale();
  const tr = useTr();
  const meLabels = useMyLocationLabels();
  const searchParams = useSearchParams();

  const cities = useMemo(() => majorCities(), []);

  // Manzil qatoridan boshlang'ich holat: boshqa sahifadagi yo'nalish
  // havolasi shu sahifaga olib kelsin (`/map?from=Toshkent&to=Samarqand`).
  const [fromText, setFromText] = useState(() => searchParams.get('from') ?? '');
  const [toText, setToText] = useState(() => searchParams.get('to') ?? '');
  const [fromCoord, setFromCoord] = useState<Point | null>(
    () => resolveCityCoord(searchParams.get('from') ?? '')?.coord ?? null
  );
  const [toCoord, setToCoord] = useState<Point | null>(
    () => resolveCityCoord(searchParams.get('to') ?? '')?.coord ?? null
  );
  const [date, setDate] = useState(() => searchParams.get('date') ?? '');
  const [seats, setSeats] = useState(() => {
    const n = Number(searchParams.get('seats'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  // Telefondagi to'liq forma — varaqda.
  const [formOpen, setFormOpen] = useState(false);
  /*
   * Qiymatni KIM qo'ydi: odam yozdimi yoki xarita/manzil qatori.
   *
   * 🔴 Xaritadan shahar bosilganda maydon qiymati dastur tomonidan
   * o'zgaradi va avtomatik taklif ro'yxati ochilib, formaning qolganini
   * yopib qo'yardi (ko'z bilan ko'rildi). Ro'yxat faqat ODAM yozganda
   * ochiladi.
   */
  const [typing, setTyping] = useState(false);

  const today = tashkentNow().date;
  const hasRoute = !!fromCoord && !!toCoord;

  /*
   * QIDIRUV O'ZI ISHGA TUSHADI — ikkala nuqta ma'lum bo'lishi yetarli.
   *
   * 🔑 Bu sahifaning butun ma'nosi shunda: xaritada ikki shaharni bosgan
   * odam yana «Qidirish» tugmasini izlab yurmasin. Qidiruv sahifasida
   * tugma qoladi (u yerda o'nta filtr bor va har biri so'rov yuborishi
   * noto'g'ri bo'lardi).
   */
  const { data: results = [], isFetching } = useQuery({
    queryKey: [
      'map-search',
      fromCoord?.[0] ?? null,
      fromCoord?.[1] ?? null,
      toCoord?.[0] ?? null,
      toCoord?.[1] ?? null,
      date,
      seats,
    ],
    enabled: hasRoute,
    queryFn: async () => {
      const range = dateToRangeISO(date);
      const raw: RideSearchItem[] = await searchRides({
        origin_lat: fromCoord![0],
        origin_lon: fromCoord![1],
        dest_lat: toCoord![0],
        dest_lon: toCoord![1],
        radius_km: DEFAULT_RADIUS_KM,
        min_seats: seats,
        ...(range.from ? { date_from: range.from } : {}),
      });
      // `GET /rides/{id}` gateway'da yo'q — safar sahifasi shu keshdan o'qiydi.
      cacheRides(raw);
      // Jo'nab ketgani va bekor qilingani ko'rsatilmaydi: xaritada ular
      // «hali ham bor» degan yolg'on taassurot beradi.
      return raw.filter((r) => isRideBookable(r.status, r.departure_time));
    },
  });

  // Yo'nalish o'zgarsa tanlov eskirib qoladi.
  useEffect(() => {
    setActiveId(null);
  }, [fromCoord, toCoord, date, seats]);

  /* Mashhur yo'nalishlar — server bergan HAQIQIY statistika (mehmonda
     so'ralmaydi: ruchka 401 qaytaradi). Nomni koordinataga o'zimizdagi
     ro'yxat yechadi; yechilmasa chiziq CHIZILMAYDI. */
  const { data: recs } = useRideRecommendations();

  /*
   * HAQIQIY YO'L — «tekkis chiziq» o'rniga (egasi, 17.09.2026).
   *
   * 🔴 Ikki shahar orasidagi to'g'ri chiziq yo'l EMAS: u tog'dan ham,
   * cho'ldan ham o'tib ketadi. Bizda esa yo'lning haqiqiy geometriyasi
   * BOR (`GET /routing/route` — mehmonga ham ochiq, o'lchandi) va u
   * shu paytgacha faqat safar sahifasidagi ko'rikda ishlatilardi.
   *
   * ⚠️ So'rovlar SANOQLI: tanlangan safar, tanlangan juftlik va eng
   * mashhur UCHTA yo'nalish. Yo'l o'zgarmaydi — javob abadiy keshlanadi
   * (`useRoadRoute`), ya'ni qayta tanlashda tarmoqqa chiqilmaydi.
   */
  const activeRide = results.find((r) => r.id === activeId) ?? null;
  const activeRoad = useRoadRoute(
    activeRide &&
      Number.isFinite(activeRide.origin_lat) &&
      Number.isFinite(activeRide.destination_lat)
      ? [
          [activeRide.origin_lat, activeRide.origin_lon],
          [activeRide.destination_lat, activeRide.destination_lon],
        ]
      : null
  );
  const pairRoad = useRoadRoute(fromCoord && toCoord ? [fromCoord, toCoord] : null);

  /* ⚠️ Hooklar SHARTSIZ chaqirilishi kerak (React qoidasi), shuning uchun
     mashhur yo'nalishlar uchun UCHTA qat'iy joy: bo'shi `null` bo'ladi. */
  const popularPairs = useMemo<([Point, Point] | null)[]>(() => {
    const out: ([Point, Point] | null)[] = [null, null, null];
    let i = 0;
    for (const r of recs?.popular ?? []) {
      if (i >= 3) break;
      const a = resolveCityCoord(r.from);
      const b = resolveCityCoord(r.to);
      if (!a || !b) continue;
      out[i] = [a.coord, b.coord];
      i += 1;
    }
    return out;
  }, [recs]);
  const pop0 = useRoadRoute(popularPairs[0]);
  const pop1 = useRoadRoute(popularPairs[1]);
  const pop2 = useRoadRoute(popularPairs[2]);
  const popularRoads = [pop0.data, pop1.data, pop2.data];

  /** Xaritaga beriladigan mashhur yo'nalishlar — yo'l kelgan bo'lsa u bilan. */
  const popular = useMemo<LiveMapRoute[]>(() => {
    const names = (recs?.popular ?? [])
      .map((r) => ({ r, a: resolveCityCoord(r.from), b: resolveCityCoord(r.to) }))
      .filter((x) => x.a && x.b)
      .slice(0, 3);
    return names.map((x, i) => {
      const road = popularRoads[i];
      return {
        from: x.a!.coord,
        to: x.b!.coord,
        /* Faqat HAQIQIY yo'l — yiqilgan so'rov kirish nuqtalarini qaytaradi
           va u «yo'l» bo'lib chizilardi (izohi `RoadRoute.isReal` da). */
        points: road?.isReal ? simplifyRoute(road.points, 400) : undefined,
        countLabel: x.r.tripsCount
          ? tr(`${x.r.tripsCount} ta safar`, `${x.r.tripsCount} поездки`, `${x.r.tripsCount} rides`)
          : undefined,
      };
    });
    // `popularRoads` — uchta so'rovning natijasi; qiymat bo'yicha kuzatamiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recs, tr, pop0.data, pop1.data, pop2.data]);

  const mapResults = useMemo<LiveMapResult[]>(
    () =>
      results
        .filter((r) => Number.isFinite(r.origin_lat) && Number.isFinite(r.origin_lon))
        .map((r) => ({
          id: r.id,
          origin: [r.origin_lat, r.origin_lon] as Point,
          dest: [r.destination_lat, r.destination_lon] as Point,
          pickup:
            typeof r.pickup_lat === 'number' &&
            typeof r.pickup_lon === 'number' &&
            (r.pickup_lat !== 0 || r.pickup_lon !== 0)
              ? ([r.pickup_lat, r.pickup_lon] as Point)
              : null,
          priceLabel: formatCurrency(r.price_per_seat, locale),
        })),
    [results, locale]
  );

  /**
   * Xaritadan shahar bosilganda: bo'sh maydonga tushadi.
   *
   * Ikkalasi ham to'lgan bo'lsa yangi bosish MANZILNI almashtiradi —
   * odam odatda borish shahrini o'zgartirib ko'radi, jo'nash shahri esa
   * bitta. Bir xil shaharni qayta bosish uni TOZALAYDI (fikridan
   * qaytdi). Landing xaritasi va ilova ham AYNAN shu qoida bilan
   * ishlaydi — uchta joyda uch xil bo'lmasin.
   */
  const pickCity = (name: string, coord: Point) => {
    setTyping(false);
    if (fromText.trim().toLowerCase() === name.toLowerCase()) {
      setFromText('');
      setFromCoord(null);
      return;
    }
    if (toText.trim().toLowerCase() === name.toLowerCase()) {
      setToText('');
      setToCoord(null);
      return;
    }
    if (!fromCoord) {
      setFromText(name);
      setFromCoord(coord);
    } else {
      setToText(name);
      setToCoord(coord);
    }
  };

  const swap = () => {
    setTyping(false);
    setFromText(toText);
    setToText(fromText);
    setFromCoord(toCoord);
    setToCoord(fromCoord);
  };

  /*
   * IXCHAM QATOR QANCHA JOY EGALLAYDI — O'LCHANADI, taxmin qilinmaydi.
   *
   * Telefonda xarita ustida bitta element suzadi: qidiruv qatori.
   * Kompyuterda esa forma ham, natijalar ham CHAP USTUNDA — ya'ni
   * xarita ustida hech narsa yo'q va chekka ham kerak emas.
   *
   * 🔴 Avval bu «balandlikning 45% i» degan TAXMIN edi va 320 px
   * ekranda kadrni Hindistongacha uzoqlashtirib yubordi.
   */
  const barRef = useRef<HTMLDivElement | null>(null);
  const [insets, setInsets] = useState({ top: 0, bottom: 0, left: 0 });

  useEffect(() => {
    const measure = () => {
      const wide = window.innerWidth >= 1024;
      const h = barRef.current?.getBoundingClientRect().height ?? 0;
      setInsets({ top: wide ? 0 : Math.round(h + 24), bottom: 0, left: 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (barRef.current) ro.observe(barRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  /** Yo'nalishni QO'YISH — chip, mashhur yo'nalish va joylashuv uchun bitta yo'l. */
  const applyRoute = React.useCallback((a: string, b: string) => {
    const x = resolveCityCoord(a);
    const y = resolveCityCoord(b);
    if (!x || !y) return;
    setTyping(false);
    setFromText(x.name);
    setFromCoord(x.coord);
    setToText(y.name);
    setToCoord(y.coord);
  }, []);

  /*
   * «MEN SHU YERDAMAN» — javob beradigan qilib.
   *
   * 🔴 Tugma faqat kadrni siljitardi (egasi: «qulaylik yo'q»). Endi
   * joylashuvdan ENG YAQIN shahar topiladi va «Qayerdan» ga tushadi —
   * borish shahri tanlangan bo'lsa qidiruv O'ZI ishga tushadi.
   *
   * ⚠️ Radius keng (90 km): odam shaharlararo yo'lda bo'lishi mumkin.
   * Topilmasa HECH NIMA qilinmaydi — noto'g'ri shahar qo'yishdan ko'ra
   * qo'ymagan yaxshi.
   */
  const locateMe = React.useCallback((lat: number, lon: number) => {
    const name = nearestCityName(lat, lon, 90);
    if (!name) return;
    const c = resolveCityCoord(name);
    if (!c) return;
    setTyping(false);
    setFromText(c.name);
    setFromCoord(c.coord);
  }, []);

  /*
   * SO'NGGI YO'NALISHLAR — brauzer xotirasidan.
   *
   * ⚠️ `useEffect` ichida: server tomonda `localStorage` yo'q va uni
   * render paytida o'qish hidratsiya nomuvofiqligini beradi.
   */
  /* Kirganmi — obuna tugmasi va matn shunga qarab (izohi pastda). */
  const [isAuthed, setIsAuthed] = useState(false);
  useEffect(() => setIsAuthed(!!getAccessToken()), []);

  const [recent, setRecent] = useState<RecentRoute[]>([]);
  useEffect(() => setRecent(getRecentRoutes()), []);

  /* Tanlangan yo'nalish xotiraga yoziladi — keyingi kirishda chip bo'lib
     turadi (qidiruv sahifasi ham AYNAN shu ro'yxatga yozadi). */
  useEffect(() => {
    if (fromText.trim() && toText.trim() && hasRoute) addRecentRoute(fromText, toText);
  }, [fromText, toText, hasRoute]);

  /*
   * KUNLAR BO'YICHA SANOQ — sana lentasi uchun.
   *
   * BITTA sanasiz qidiruv, natija kunlar bo'yicha sanaladi (qidiruv
   * sahifasidagi bilan AYNAN bir xil qoida: son to'qib chiqarilmaydi).
   * Sana `queryKey` da ATAYIN yo'q — lenta butun ikki haftani
   * ko'rsatadi va kun almashganda qayta so'ralmaydi.
   */
  const { data: dayCounts } = useQuery({
    queryKey: [
      'map-day-counts',
      fromCoord?.[0] ?? null,
      fromCoord?.[1] ?? null,
      toCoord?.[0] ?? null,
      toCoord?.[1] ?? null,
      seats,
    ],
    enabled: hasRoute,
    staleTime: 60_000,
    queryFn: async () => {
      const raw: RideSearchItem[] = await searchRides({
        origin_lat: fromCoord![0],
        origin_lon: fromCoord![1],
        dest_lat: toCoord![0],
        dest_lon: toCoord![1],
        radius_km: DEFAULT_RADIUS_KM,
        min_seats: seats,
      });
      const counts: Record<string, number> = {};
      const now = Date.now();
      for (const t of raw) {
        const at = t.departure_time ? new Date(t.departure_time) : null;
        if (!at || Number.isNaN(at.getTime()) || at.getTime() < now) continue;
        if (!isRideBookable(t.status, t.departure_time)) continue;
        const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(
          at.getDate()
        ).padStart(2, '0')}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    },
  });

  // Xaritadagi belgi bosilganda kartochka O'ZI ko'rinadigan joyga keladi.
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!activeId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-ride="${activeId}"]`);
    // Gorizontal qator: kartochka O'RTAGA keladi (`inline`), sahifa esa
    // qimirlamaydi (`block: 'nearest'`).
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activeId]);

  const searchHref = `/${locale}/search?${new URLSearchParams({
    ...(fromText ? { from: fromText } : {}),
    ...(toText ? { to: toText } : {}),
    ...(date ? { date } : {}),
    seats: String(seats),
  }).toString()}`;

  const statusLine = hasRoute
    ? isFetching
      ? tr('Qidirilmoqda…', 'Идёт поиск…', 'Searching…')
      : tr(
          `${results.length} ta safar topildi`,
          `Найдено поездок: ${results.length}`,
          `${results.length} rides found`
        )
    : tr(
        'Xaritadan ikkita shaharni bosing',
        'Нажмите на карте два города',
        'Tap two cities on the map'
      );

  /** Yo'nalish maydonlari — kompyuterda kartada, telefonda varaqda. BITTA manba. */
  const routeFields = (
    <>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <CityAutocomplete
            label={tr('Qayerdan', 'Откуда', 'From')}
            placeholder={tr('Toshkent', 'Ташкент', 'Tashkent')}
            value={fromText}
            suppressSuggestions={!typing}
            onChange={(v) => {
              setTyping(true);
              setFromText(v);
              // Matn qo'lda o'zgartirilsa eski koordinata yaroqsiz: aks
              // holda odam boshqa shahar yozib, ESKI nuqta bo'yicha
              // qidirib qolardi.
              setFromCoord(resolveCityCoord(v)?.coord ?? null);
            }}
            onSelect={(name, lat, lon) => {
              setTyping(false);
              setFromText(name);
              setFromCoord([lat, lon]);
            }}
            onBestMatch={(lat, lon) => setFromCoord([lat, lon])}
          />
          <CityAutocomplete
            label={tr('Qayerga', 'Куда', 'To')}
            placeholder={tr('Samarqand', 'Самарканд', 'Samarkand')}
            value={toText}
            suppressSuggestions={!typing}
            onChange={(v) => {
              setTyping(true);
              setToText(v);
              setToCoord(resolveCityCoord(v)?.coord ?? null);
            }}
            onSelect={(name, lat, lon) => {
              setTyping(false);
              setToText(name);
              setToCoord([lat, lon]);
            }}
            onBestMatch={(lat, lon) => setToCoord([lat, lon])}
          />
        </div>
        <button
          type="button"
          onClick={swap}
          aria-label={tr(
            "Yo'nalishni almashtirish",
            'Поменять направление местами',
            'Swap direction'
          )}
          className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-text-muted transition-colors hover:border-accent hover:text-accent active:scale-95"
        >
          <ArrowUpDown className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Sana va o'rindiq USTMA-UST: chap ustun 380 px, ikkiga bo'linsa
          har biriga 160 px qoladi va «Sanani tanlang» yozuvi ikki
          qatorga sinadi (qidiruv sahifasida ham ular ustma-ust). */}
      <div className="mt-2 space-y-2">
        <DateField
          label={tr('Sanadan boshlab', 'Начиная с даты', 'From date')}
          value={date}
          min={today}
          onChange={setDate}
        />
        <Counter
          label={tr("O'rindiq", 'Мест', 'Seats')}
          value={seats}
          min={1}
          max={8}
          onChange={setSeats}
        />
      </div>
    </>
  );

  /* Yorliq MAZMUNGA mos: mehmonda tavsiyalar so'ralmaydi (401), ya'ni
     «Mashhur yo'nalishlar» deb yozib, ostida boshqa narsa ko'rsatish —
     yolg'on sarlavha bo'lardi. */
  const hasPopular = (recs?.popular ?? []).some(
    (r) => resolveCityCoord(r.from) && resolveCityCoord(r.to)
  );
  const listTitle = hasPopular
    ? tr("Mashhur yo'nalishlar", 'Популярные направления', 'Popular routes')
    : tr("Yo'nalish", 'Маршрут', 'Route');

  /** Bitta natija kartochkasi — xaritadagi belgi bilan JUFT. */
  const rideCard = (r: RideSearchItem) => (
    <button
      key={r.id}
      type="button"
      data-ride={r.id}
      onClick={() => setActiveId(r.id)}
      className={`w-[248px] shrink-0 snap-center rounded-2xl border p-3 text-left shadow-lg backdrop-blur-md transition-colors sm:w-[268px] ${
        activeId === r.id
          ? 'border-accent bg-surface'
          : 'border-border bg-surface/95 hover:border-accent'
      }`}
    >
      {/*
        VAQT BIRINCHI, yo'nalish emas: bu ro'yxat AYNAN bitta
        yo'nalishning natijasi — har kartochkada «Toshkent → Samarqand»
        ni takrorlash joyni yeb, kesilgan matn berardi («Toshkent →
        Sama…»). Odam bu yerda vaqt va narxni solishtiradi.
      */}
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-text">
            {departureStatusLabel(r.departure_time, r.status, locale) ||
              formatTripDateTime(r.departure_time)}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-semibold text-text-muted">
            {r.origin_address} → {r.destination_address}
          </span>
        </span>
        <span className="shrink-0 text-sm font-extrabold text-accent">
          {formatCurrency(r.price_per_seat, locale)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-text-muted">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {tr(
            `${r.available_seats} o'rin`,
            `${r.available_seats} мест`,
            `${r.available_seats} seats`
          )}
        </span>
        {personName(r.driver) && (
          <span className="max-w-[45%] truncate">{personName(r.driver)}</span>
        )}
        {r.pickup_point && (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <span className="truncate">{r.pickup_point}</span>
          </span>
        )}
      </div>

      {activeId === r.id && (
        <Link
          href={`/${locale}/trip/${r.id}`}
          className="mt-2 inline-block text-xs font-extrabold text-accent underline-offset-2 hover:underline"
        >
          {tr('Safarni ochish', 'Открыть поездку', 'Open the ride')}
        </Link>
      )}
    </button>
  );

  const mapBlock = (
    <LiveMap
      cities={cities.map((c) => ({ name: c.name, coord: c.coord }))}
      routes={popular}
      results={mapResults}
      from={fromCoord}
      to={toCoord}
      activeId={activeId}
      activeRoute={activeRoad.data?.isReal ? simplifyRoute(activeRoad.data.points, 600) : null}
      pairRoute={pairRoad.data?.isReal ? simplifyRoute(pairRoad.data.points, 600) : null}
      insets={insets}
      onPickCity={pickCity}
      onSelectResult={setActiveId}
      onLocated={locateMe}
      cityLabel={tr('Shahar', 'Город', 'City')}
      labels={{
        zoomIn: tr('Kattalashtirish', 'Приблизить', 'Zoom in'),
        zoomOut: tr('Kichiklashtirish', 'Отдалить', 'Zoom out'),
        /* Joylashuv yozuvlari — YAGONA manbadan (`MyLocationLayer`):
           ayni shu tugma safar marshruti varag'ida ham bor. */
        ...meLabels,
      }}
    />
  );

  /*
   * TARTIB — «ILOVADEK JONLI» (egasi tanladi, 17.09.2026).
   *
   * 🔴 NEGA QAYTA QURILDI: oldingi ko'rinish saytdagi boshqa sahifalarga
   * o'xshatib qo'yilgandi va egasi «creativlik yo'q, qulaylik yo'q»
   * dedi. Haq edi: xarita ramkaga solingan OYNA edi, sana formada
   * yashiringan, belgi bosilsa kartochka ekrandan pastda qolardi.
   *
   * Endi xarita — ish maydoni, qolgani uning USTIDA suzadi:
   *   • tepada qidiruv qatori va SANA LENTASI (bosilsa narx o'zgaradi);
   *   • pastda natijalar — GORIZONTAL suriladigan kartochkalar;
   *   • kartochka ⇄ belgi JUFT: biri tanlansa ikkinchisi o'ziga tortadi;
   *   • «Men shu yerdaman» eng yaqin shaharni Qayerdanga qo'yadi.
   *
   * ⚠️ Brend yo'qolmaydi: sarlavha `font-display`, xarita ostida atlas
   * jiyagi, bo'sh holatda peshtoq medalyoni — saytning qolgan qismi
   * bilan bir oila.
   */
  return (
    <div className="flex min-h-0 flex-1 select-none flex-col bg-bg">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {tr('Xarita', 'Карта', 'Map')}
          </h1>
          <p className="text-xs text-text-muted sm:text-sm">{statusLine}</p>
        </div>
        <Link
          href={searchHref}
          aria-label={tr('Barcha filtrlar', 'Все фильтры', 'All filters')}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-bold text-text-muted shadow-sm transition-colors hover:border-accent hover:text-accent"
        >
          <List className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">
            {tr('Barcha filtrlar', 'Все фильтры', 'All filters')}
          </span>
        </Link>
      </div>

      <section className="relative min-h-[420px] flex-1 border-y border-border">
        <div className="absolute inset-0">{mapBlock}</div>

        {/* ═══ TEPA QATLAMI: yo'nalish, sana, so'nggi yo'nalishlar ═══ */}
        <div
          ref={barRef}
          className="pointer-events-none absolute inset-x-2 top-2 z-[900] space-y-2 sm:inset-x-4 lg:max-w-[420px]"
        >
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="pointer-events-auto flex min-h-12 w-full items-center gap-2 rounded-2xl border border-border bg-surface/95 px-3 py-2 text-left shadow-lg backdrop-blur-md"
          >
            <SearchIcon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-text">
                {fromText || tr('Qayerdan', 'Откуда', 'From')} →{' '}
                {toText || tr('Qayerga', 'Куда', 'To')}
              </span>
              <span className="block truncate text-[11px] font-semibold text-text-muted">
                {seats} {tr("o'rin", 'мест', 'seats')}
                {date ? ` · ${date}` : ''}
              </span>
            </span>
            <Sliders className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          </button>

          {/* SANA LENTASI — xarita USTIDA. Kun bosilsa qidiruv darhol
              qayta ishlaydi; har kunning tagida SHU yo'nalishdagi safar
              soni turadi (son to'qib chiqarilmaydi — bitta sanasiz
              qidiruvdan sanaladi). */}
          {hasRoute && dayCounts && Object.keys(dayCounts).length > 0 && (
            <div className="pointer-events-auto rounded-2xl border border-border bg-surface/95 px-2 py-1.5 shadow-lg backdrop-blur-md">
              <DateStrip counts={dayCounts} selected={date} onPick={(d) => setDate(d)} />
            </div>
          )}

          {/* SO'NGGI YO'NALISHLAR — qidiruv boshlanmagan paytda, bir
              bosishda qaytish uchun. Ular BIZDA saqlanardi-yu, hech
              qayerda ko'rinmasdi. */}
          {!hasRoute && recent.length > 0 && (
            <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1">
              {recent.slice(0, 4).map((r) => (
                <button
                  key={`${r.from}-${r.to}`}
                  type="button"
                  onClick={() => applyRoute(r.from, r.to)}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 text-xs font-bold text-text shadow-md backdrop-blur-md transition-colors hover:border-accent"
                >
                  <Clock className="h-3.5 w-3.5 text-accent" aria-hidden />
                  {r.from} → {r.to}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ PAST QATLAMI: natijalar ═══ */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[900]">
          {!hasRoute ? (
            <div className="pointer-events-auto mx-2 mb-2 rounded-2xl border border-border bg-surface/95 p-3 shadow-xl backdrop-blur-md sm:mx-4 lg:max-w-[420px]">
              <SectionLabel icon={<MapPin />}>{listTitle}</SectionLabel>
              <div className="mt-2">
                <PopularList routes={recs?.popular ?? []} onPick={applyRoute} />
              </div>
            </div>
          ) : isFetching ? (
            <div className="pointer-events-auto flex gap-2 px-2 pb-2 sm:px-4">
              <Skeleton className="h-24 w-[248px] shrink-0 rounded-2xl" />
              <Skeleton className="h-24 w-[248px] shrink-0 rounded-2xl" />
            </div>
          ) : results.length === 0 ? (
            /* BO'SH YO'NALISH — «safar yo'q» deb qo'yib ketmaymiz:
               shu yerda yo'nalishga OBUNA bo'lish mumkin (backend
               ruchkasi bor va u shu paytgacha faqat qidiruv sahifasida
               ishlatilardi). */
            <div className="pointer-events-auto mx-2 mb-2 rounded-2xl border border-border bg-surface/95 p-4 shadow-xl backdrop-blur-md sm:mx-4 lg:max-w-[420px]">
              <div className="flex items-start gap-3">
                <PeshtoqBadge icon={<MapPin aria-hidden />} className="hidden shrink-0 sm:block" />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-text">
                    {tr(
                      "Bu yo'nalishda hozircha safar yo'q",
                      'На этом направлении пока нет поездок',
                      'No rides on this route yet'
                    )}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {/* ⚠️ MEHMONGA VA'DA BERMAYMIZ: obuna tugmasi faqat
                        kirgan odamga ko'rinadi (`WatchRouteButton`), ya'ni
                        «xabar beramiz» deyish yolg'on bo'lardi. */}
                    {isAuthed
                      ? tr(
                          'Boshqa kunni tanlang yoki safar qo\u2018yilganda xabar beramiz',
                          'Выберите другой день или мы сообщим, когда появится поездка',
                          'Pick another day, or we will let you know when a ride appears'
                        )
                      : tr(
                          'Boshqa kunni tanlang \u2014 yoki kiring, safar qo\u2018yilganda xabar beramiz',
                          'Выберите другой день \u2014 или войдите, и мы сообщим о новой поездке',
                          'Pick another day \u2014 or sign in and we will notify you about a new ride'
                        )}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <WatchRouteButton
                      origin={fromCoord ?? undefined}
                      dest={toCoord ?? undefined}
                      fromName={fromText}
                      toName={toText}
                    />
                    <Link
                      href={searchHref}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      <SearchIcon className="h-3.5 w-3.5" aria-hidden />
                      {tr("Qidiruvga o'tish", 'Перейти в поиск', 'Go to search')}
                    </Link>
                    {!isAuthed && (
                      <Link
                        href={`/${locale}/login`}
                        className="inline-flex min-h-11 items-center gap-1 rounded-full border border-accent px-3 text-xs font-bold text-accent transition-colors hover:bg-brand-pink-light/60"
                      >
                        {tr('Kirish', 'Войти', 'Sign in')}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* NATIJALAR — gorizontal suriladigan kartochkalar.
               `snap-x`: barmoq qo'yib yuborganda kartochka o'z joyiga
               qo'nadi (ilovadagi his). */
            <div
              ref={listRef}
              className="pointer-events-auto flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-3 sm:px-4"
            >
              {results.map(rideCard)}
            </div>
          )}
        </div>
      </section>

      {/* Jiyak — xarita maydonining poydevori (bo'sh holat medalyonida
          ham aynan shu qoida). */}
      <AtlasEdge className="h-[5px] w-full" />

      <div className="flex justify-end px-4 py-1 sm:px-6 lg:px-8">
        <OsmCredit />
      </div>

      {/* TO'LIQ FORMA — qidiruv qatori bosilganda. */}
      <BottomSheet
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={tr("Yo'nalish", 'Маршрут', 'Route')}
      >
        <div className="text-text">{routeFields}</div>
        <Button className="mt-4 w-full" onClick={() => setFormOpen(false)}>
          {tr("Xaritada ko'rsatish", 'Показать на карте', 'Show on the map')}
        </Button>
      </BottomSheet>
    </div>
  );
}

/** Mashhur yo'nalishlar — qidiruv boshlanmagan paytdagi ro'yxat. */
function PopularList({
  routes,
  onPick,
}: {
  routes: { from: string; to: string; tripsCount?: number }[];
  onPick: (from: string, to: string) => void;
}) {
  const tr = useTr();
  const usable = routes
    .filter((r) => resolveCityCoord(r.from) && resolveCityCoord(r.to))
    .slice(0, 5);

  if (usable.length === 0) {
    /*
     * Mehmonda tavsiyalar so'ralmaydi (ruchka 401 qaytaradi), ya'ni bu
     * holat NORMAL — «xato» demaymiz.
     *
     * 🔴 LEKIN FAQAT MATN QO'YIB BO'LMAYDI: loyihada qoida bor —
     * bo'sh holat CHIQISH YO'LI bilan bo'lsin (`check-qulaylik`).
     * Shuning uchun tez tanlash qatorlari turadi. Ular SERVER
     * ma'lumoti EMAS va shunday ataladi ham («tez tanlash»), ya'ni
     * «bu yo'nalishda safar bor» degan yolg'on va'da yo'q.
     */
    return (
      <div>
        <p className="text-xs font-semibold text-text-muted">
          {tr(
            "Yo'nalishni xaritadan tanlang yoki quyidagidan boshlang",
            'Выберите направление на карте или начните с этих',
            'Pick a route on the map, or start with these'
          )}
        </p>
        <ul className="mt-3 space-y-1.5">
          {QUICK_ROUTES.map(([a, c]) => (
            <li key={`${a}-${c}`}>
              <button
                type="button"
                onClick={() => onPick(a, c)}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-left transition-colors hover:border-accent"
              >
                <span className="min-w-0 truncate text-sm font-bold text-text">
                  {a} → {c}
                </span>
                {/* «Bu yo'nalishga o'tish» — almashtirish belgisi bo'lsa
                    (⇄) odam uni «joylarini almashtir» deb o'qiydi. */}
                <ChevronRight className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-text-muted">
        {tr("Mashhur yo'nalishlar", 'Популярные направления', 'Popular routes')}
      </p>
      <ul className="space-y-1.5">
        {usable.map((r) => (
          <li key={`${r.from}-${r.to}`}>
            <button
              type="button"
              onClick={() => onPick(r.from, r.to)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-left transition-colors hover:border-accent"
            >
              <span className="min-w-0 truncate text-sm font-bold text-text">
                {r.from} → {r.to}
              </span>
              {r.tripsCount ? (
                <span className="shrink-0 text-[11px] font-extrabold text-accent">
                  {tr(`${r.tripsCount} ta`, `${r.tripsCount}`, `${r.tripsCount}`)}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MapSectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      }
    >
      <MapSectionContent />
    </Suspense>
  );
}
