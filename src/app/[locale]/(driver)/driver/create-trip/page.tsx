'use client';

import React, { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useCreateTripStore } from '@/entities/trip/model/createTripStore';
import { useProfile } from '@/entities/user/api/useProfile';
import {
  useSubscription,
  planHasPremiumFilters,
  isSubscriptionUsable,
} from '@/entities/billing/api/useSubscription';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRide, activateRide, getMyRides } from '@/shared/api/rides';
import { AnalyticsEvent, logEvent } from '@/shared/lib/analytics';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { FeatureIcon, rideFeatureIcons } from '@/shared/ui/rideFeatures';
import { Lock, CloudOff, Navigation, Venus as VenusIcon } from 'lucide-react';
import { getMyCars } from '@/shared/api/users';
import type { PublishRideRequest } from '@/shared/api/types/ride';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { CityAutocomplete } from '@/shared/ui/CityAutocomplete';
import { Select } from '@/shared/ui/Select';
import { Switch } from '@/shared/ui/Switch';
import { DateField } from '@/shared/ui/DateField';
import { TimeField } from '@/shared/ui/TimeField';
import { Dialog } from '@/shared/ui/Dialog';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import {
  formatCurrency,
  normalizeStatus,
  tashkentLocalToUTCISO,
  tashkentNow,
} from '@/shared/lib/format';
import { forwardGeocode } from '@/shared/lib/geo';
import { resolveCityCoord } from '@/shared/data/uzCities';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Calendar,
  Info,
  Plus,
  X,
  Hourglass,
} from 'lucide-react';
import type { StopDraft } from '@/entities/trip/model/createTripStore';
import { useUIStore } from '@/shared/model/uiStore';
import { toast } from 'sonner';
import { MapPicker } from '@/shared/ui/MapPicker';
import { RoutePreview } from '@/shared/ui/RoutePreview';
import { PointPreview } from '@/shared/ui/PointPreview';
import { CurrentPlanCard } from '@/shared/ui/billing/CurrentPlanCard';
import { useTr } from '@/shared/lib/useTr';

export default function CreateTripPage() {
  const t = useTranslations('Trips');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { setActiveRole } = useUIStore();

  const tr = useTr();

  const { data: profile } = useProfile();

  React.useEffect(() => {
    setActiveRole('driver');
    // if (profile && !profile.is_driver) {
    //   router.replace(`/${locale}/driver/onboarding`);
    // }
  }, [setActiveRole, profile, locale, router]);

  // BITTA FAOL SAFAR QOIDASI: haydovchining faol (CREATED yoki IN_PROGRESS) safari
  // bo'lsa, yangisini yaratishga ruxsat bermaymiz — avval uni yakunlasin/bekor qilsin.
  const {
    data: myTripsData,
    isLoading: tripsLoading,
    isError: tripsError,
    refetch: refetchTrips,
  } = useQuery({
    queryKey: ['trips'],
    // Xatoni jim [] bilan YUTMAYMIZ: faol safar bor-yo'qligini bila olmay qolsak, forma
    // ochilib ikkinchi safar yaratishga urinish bo'lardi. Xato -> pastda qayta-urinish UI.
    queryFn: () => getMyRides('driver'),
  });
  const myTripsArr: { status?: string }[] = myTripsData ?? [];
  // normalizeStatus SHART: backend v2 statuslari kichik harfda ('completed' !== 'COMPLETED')
  // — usiz birinchi safardan keyin yangi safar yaratish abadiy bloklanardi.
  const hasActiveTrip = myTripsArr.some((tr) => {
    const s = normalizeStatus(tr.status);
    return s !== 'COMPLETED' && s !== 'CANCELLED';
  });

  // Haydovchining avtomobillari — bir nechta bo'lsa, safar uchun qaysi birini tanlash mumkin.
  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => getMyCars().catch(() => []),
  });
  // useMemo — `?? []` har renderda YANGI massiv yaratardi, quyidagi useEffect esa uni
  // bog'liqlikda ushlab turadi (har renderda qayta ishga tushardi).
  const vehicles = React.useMemo(() => vehiclesData ?? [], [vehiclesData]);

  /*
   * Mashina moderatsiyadan o'tganmi. Backend faollashtirishda AYNAN shuni
   * tekshiradi: «driver does not have an approved car».
   * `ApplicationStatus` bilan bir xil qoida (uch xil nom qabul qilinadi —
   * gateway tarixida ular almashib turgan).
   */
  const carApproved = React.useMemo(
    () =>
      vehicles.some((v) => {
        const status = String(
          (v as unknown as Record<string, unknown>)?.moderation_status ?? ''
        ).toLowerCase();
        return status === 'approved' || status === 'active' || status === 'verified';
      }),
    [vehicles]
  );
  const vehicleId = (v: { id: string }) => String(v.id ?? '');
  const vehicleOptions = vehicles.map((v) => ({
    value: vehicleId(v),
    label: [v.brand || v.model, v.gov_number].filter(Boolean).join(' · ') || vehicleId(v),
  }));
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  // Birinchi avtomobilni standart tanlov qilib qo'yamiz.
  React.useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(vehicleId(vehicles[0]));
    }
  }, [vehicles, selectedVehicleId]);

  const {
    step,
    from,
    fromCoords,
    to,
    toCoords,
    pickupPoint,
    pickupCoords,
    date,
    time,
    seats,
    hasAC,
    hasLuggage,
    acceptsParcel,
    noSmoking,
    noPets,
    drivingSpeed,
    maxTwoBack,
    musicTaste,
    genderRestriction,
    stops,
    price,
    setStep,
    setField,
    reset,
    startReturnTrip,
  } = useCreateTripStore();

  // Oraliq shaharlar boshqaruvi (maks 3) — massiv butunlay setField orqali yangilanadi.
  const updateStop = (i: number, s: StopDraft) =>
    setField(
      'stops',
      stops.map((old, idx) => (idx === i ? s : old))
    );
  const removeStop = (i: number) =>
    setField(
      'stops',
      stops.filter((_, idx) => idx !== i)
    );
  const addStop = () =>
    stops.length < 3 && setField('stops', [...stops, { name: '', coords: null }]);

  const [isSuccessSheetOpen, setIsSuccessSheetOpen] = useState(false);
  // Yaratilgan safar ID'si — panelga `?created=` bilan o'tib, kartochkani ochish uchun.
  const [createdRideId, setCreatedRideId] = useState<string | null>(null);
  // E'lon qilingan safar nusxasi — "qaytish safari" formasini to'ldirish uchun.
  const [lastPublished, setLastPublished] = useState<Parameters<typeof startReturnTrip>[0] | null>(
    null
  );
  /**
   * Premium filtrlar (konditsioner, chekilmaydi, orqada maks 2, haydash
   * uslubi) tarif bo'yicha qulflanganmi.
   *
   * So'rov hali TUGAMAGAN bo'lsa yoki YIQILGAN bo'lsa qulflamaymiz: tarmoq
   * sekin bo'lganda Pro haydovchining tumblerlari bir zum o'chib turishi,
   * keyin yonishi nosozlikdek ko'rinardi. Noaniq holatni backend o'zi 400
   * bilan tushunarli hal qiladi.
   *
   * Javob KELGAN va obuna yo'q bo'lsa (`data === null`) — QULFLANADI.
   * Ilgari bu holat ochiq qolardi va obunasiz haydovchi belgilarni yoqib,
   * e'lon qilishda 400 olardi (backend xati 2026-08-13).
   */
  const { data: subscription, isSuccess: subscriptionLoaded } = useSubscription();
  const premiumFiltersLocked =
    subscriptionLoaded &&
    !(
      isSubscriptionUsable(subscription ?? null) &&
      // `plan_key` kelsa o'sha ustun (backend xati 2026-08-14).
      planHasPremiumFilters(subscription?.plan_key || subscription?.plan_name)
    );
  const proOnlyHint = tr(
    'Pro va yuqori tarifda mavjud',
    'Доступно на тарифе Pro и выше',
    'Available on the Pro plan and above'
  );

  // Muvaffaqiyat oynasi yopilganda panelga o't-o'tmasligini hal qiladi.
  // `state` EMAS, `ref`: qiymat o'sha handler ichida O'QILADI va qayta
  // render kutib turishga vaqt yo'q — yopilish bilan navigatsiya bir tikda.
  const goingToReturnTrip = useRef(false);

  /*
   * 🔴 PAKET TUGADI (402) — sotuv oqimidagi eng muhim lahza.
   *
   * 09.09.2026 gacha bu yo'l HECH QACHON ishga tushmagan: backend kvotani
   * sanamasdi, `activate` doim 200 berardi. O'sha kuni sanay boshladi va
   * ma'lum bo'ldiki, saytda 402 oxirgi `else` ga tushib «birozdan so'ng
   * qayta urinib ko'ring» degan YOLG'ON xabar berardi — qayta urinish esa
   * hech qachon yordam bermaydi — va ustiga MUVAFFAQIYAT oynasi ochilib
   * «qaytish safarini ham e'lon qilasizmi?» deb so'rardi.
   *
   * Ilovada bu 13.08.2026 da tuzatilgan edi, sayt qolib ketgan.
   */
  const quotaBlocked = useRef(false);
  const [draftConfirmOpen, setDraftConfirmOpen] = useState(false);
  const [openMap, setOpenMap] = useState<'from' | 'to' | 'pickup' | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  /*
   * QAYTISH SAFARI rejimi (`?return=1`). "Bitta faol safar" qoidasi — bizning UI
   * qoidamiz, uning maqsadi haydovchi bir vaqtda ikkita YO'LDAGI safarni
   * boshqarib qolmasligi edi. Qaytish safari esa boshqa kun/boshqa yo'nalish va
   * uni oldindan e'lon qilish aynan kerak (CEO 2026-08-04) — shu sabab faqat shu
   * oqim uchun to'siq ochiladi.
   * ✅ 2026-08-13 backend xati: ikkita faol safar QABUL QILINADI, server
   * tomonda hech qanday to'siq yo'q. Ya'ni bu cheklov faqat BIZNIKI va uni
   * istalgan vaqtda olib tashlash mumkin (qaror egasiniki).
   */
  const isReturnTrip = searchParams.get('return') === '1';

  // Vaqt tanlash (24-soat) + o'tgan vaqt to'sig'i — Toshkent "hozir"iga nisbatan.
  const tkNow = tashkentNow();
  const isToday = date === tkNow.date;

  // E'londan keyin panelga o'tish manzili: ID bo'lsa kartochka avtomatik ochiladi.
  const dashboardHref = createdRideId
    ? `/${locale}/dashboard?created=${encodeURIComponent(createdRideId)}`
    : `/${locale}/dashboard`;

  // Валидация шагов
  const isStep1Valid =
    from.trim().length > 2 && to.trim().length > 2 && pickupPoint.trim().length > 2;
  const isStep2Valid = date.trim().length > 0 && time.trim().length > 0;
  const isStep3Valid = price > 0;

  const createTripMutation = useMutation({
    mutationFn: async () => {
      // Xavfsizlik: faol safar bo'lsa, yangisini yaratmaymiz (UI ham to'sadi).
      if (hasActiveTrip && !isReturnTrip) {
        return Promise.reject(new Error('HAS_ACTIVE'));
      }
      // Tanlangan avtomobil (yo'q bo'lsa — birinchisi). Umuman bo'lmasa -> onboarding.
      const chosenVehicleId =
        selectedVehicleId || (vehicles.length > 0 ? vehicleId(vehicles[0]) : '');
      if (!chosenVehicleId) {
        return Promise.reject(new Error('NO_VEHICLE'));
      }

      // KOORDINATANI HAL QILISH: foydalanuvchi xaritani ochmay faqat shahar nomini
      // yozган bo'lsa, fromCoords/toCoords standart Toshkent qiymatida qoladi.
      // Bunday holda avval BARQAROR shaharlar ro'yxatidan (qidiruv sahifasi bilan bir xil
      // manba) koordinatani olamiz — shunda e'lon va qidiruv AYNAN bir koordinataga tushib,
      // backend radius filtri kafolatli mos keladi. Ro'yxatda yo'q bo'lsagina Nominatim.
      const DEFAULT: [number, number] = [41.311081, 69.240562];
      const isDefault = (c: [number, number]) =>
        Math.abs(c[0] - DEFAULT[0]) < 1e-6 && Math.abs(c[1] - DEFAULT[1]) < 1e-6;

      // Ma'lum shahar bo'lsa — MATN hal qiladi: qidiruv sahifasi bilan AYNAN bir koordinata
      // chiqadi (foydalanuvchi ro'yxatdan Nominatim variantini tanlagan yoki xaritadan nuqta
      // qo'ygan bo'lsa ham). Aniq yig'ilish joyi baribir alohida `pickup_point`da saqlanadi.
      const depCity = resolveCityCoord(from);
      let depCoords = depCity ? depCity.coord : fromCoords;
      if (!depCity && isDefault(depCoords)) {
        const g = await forwardGeocode(from);
        if (g) depCoords = g;
      }
      const arrCity = resolveCityCoord(to);
      let arrCoords = arrCity ? arrCity.coord : toCoords;
      if (!arrCity && isDefault(arrCoords)) {
        const g = await forwardGeocode(to);
        if (g) arrCoords = g;
      }

      // ORALIQ SHAHARLAR: har biriga koordinata (from/to bilan bir xil manba tartibida:
      // ma'lum shaharlar ro'yxati -> autocomplete coords -> Nominatim). Koordinatasi
      // topilmagan stop PAYLOADdan tushiriladi (backend lat/lon talab qiladi), nomi
      // bo'sh qatorlar ham o'tkazib yuboriladi.
      const stopsPayload: { address: string; lat: number; lon: number }[] = [];
      for (const s of stops) {
        const nm = s.name.trim();
        if (!nm) continue;
        const known = resolveCityCoord(nm);
        let c: [number, number] | null = known ? known.coord : s.coords;
        if (!c) {
          c = await forwardGeocode(nm);
        }
        if (c) stopsPayload.push({ address: known?.name ?? nm, lat: c[0], lon: c[1] });
      }

      // ESLATMA: koordinata aniqlanmasa ham e'lonni TO'XTATMAYMIZ. Backend qidiruvi endi
      // shahar NOMI (departure_city/arrival_city) bo'yicha filtrlaydi — koordinata radiusi emas.
      // Shuning uchun koordinata default (Toshkent) bo'lib qolsa ham, e'lon qidiruvda o'z
      // shahar nomi bilan baribir chiqadi. Koordinata faqat masofa ko'rsatish uchun ishlatiladi.
      // (Ilgari bu yerda "Manzilni aniqlab bo'lmadi" (NO_COORDS) bloki bor edi — u geocode
      // topmagan shaharlarda e'lon berishni to'sib qo'yardi; olib tashlandi.)

      // PublishRideRequest (Swagger 2026-08-03): yassi lat/lon + address matn, vehicle_id
      // MAJBURIY, departure_time RFC3339.
      // 2026-08-03 JONLI TEKSHIRUV: qulaylik belgilari (has_ac/has_luggage/no_smoking/
      // no_pets/max_two_back/driving_speed/takes_parcels), `pickup_point` va `stops`
      // endi HAQIQATAN saqlanadi va `/rides/search` javobida qaytadi (ilgari jimgina
      // yo'qolardi — xat v5 №4). Ya'ni bu maydonlar oxirigacha ishlaydi.
      const payload: PublishRideRequest = {
        origin_lat: depCoords[0],
        origin_lon: depCoords[1],
        destination_lat: arrCoords[0],
        destination_lon: arrCoords[1],
        // Manzil MATNI bevosita DTO'da (`*_address`) — ko'rsatishda backend shuni qaytaradi,
        // reverse-geocode YO'Q. Ma'lum shahar KANONIK nomda ("Tashkent"/"toshkent" chalkashmasin).
        origin_address: resolveCityCoord(from)?.name ?? from.trim(),
        destination_address: resolveCityCoord(to)?.name ?? to.trim(),
        departure_time: tashkentLocalToUTCISO(date, time),
        total_seats: seats,
        price_per_seat: price,
        is_negotiable: true,
        vehicle_id: chosenVehicleId,
        pickup_point: pickupPoint,
        /*
         * UCHRASHUV NUQTASI — ANIQ KOORDINATA (17.09.2026).
         *
         * 🔴 Ilgari xaritadan tanlangan nuqta faqat MATNGA aylanardi va
         * koordinata tashlanardi («backendda maydon yo'q» degan izoh bilan).
         * Jonli o'lchandi: `pickup_lat`/`pickup_lon` SAQLANADI va
         * `GET /rides/{id}` hamda `GET /rides/search` javoblarida QAYTADI.
         * Ya'ni yo'lovchi endi matnni qayta geokodlamaydi — u aynan
         * haydovchi bosgan joyni ko'radi.
         *
         * Xaritadan tanlanmagan bo'lsa maydonlar UMUMAN yuborilmaydi:
         * nol koordinata Afrika o'rtasiga nuqta qo'yardi.
         */
        ...(pickupCoords ? { pickup_lat: pickupCoords[0], pickup_lon: pickupCoords[1] } : {}),
        takes_parcels: acceptsParcel,
        // Qulflangan belgilar HAR DOIM standart holatda ketadi — UI holatiga
        // ishonmaymiz. Haydovchi belgilarni yoqib qo'yib, keyin tarifi tugashi
        // yoki obuna kech kelishi mumkin; o'shanda eski `true` qolib, backend
        // 400 berardi. Bagaj va posilka Plus'da ham ochiq.
        has_ac: premiumFiltersLocked ? false : hasAC,
        has_luggage: hasLuggage,
        no_smoking: premiumFiltersLocked ? false : noSmoking,
        no_pets: noPets,
        driving_speed: premiumFiltersLocked ? 'normal' : drivingSpeed,
        max_two_back: premiumFiltersLocked ? false : maxTwoBack,
        // ⚠️ TARIFGA BOG'LIQ EMAS (`premiumFiltersLocked` yo'q):
        // xavfsizlik pullik funksiya bo'lmasligi kerak.
        // Bo'sh qiymat UMUMAN yuborilmaydi — backend `null`/`''` ni
        // yoqtirmaydi va ixtiyoriy maydonlar qoidasi shunday.
        // Musiqa: «farqi yo'q» bo'lsa maydon UMUMAN yuborilmaydi —
        // bo'sh qiymat safar kartasida bo'sh belgi chizardi.
        // ⚠️ TARIFGA BOG'LIQ EMAS (`premiumFiltersLocked` yo'q).
        ...(musicTaste ? { music_taste: musicTaste } : {}),
        ...(genderRestriction ? { gender_restriction: genderRestriction } : {}),
        ...(stopsPayload.length > 0 ? { stops: stopsPayload } : {}),
      };

      // Safar `draft` yaratiladi — ACTIVATE qilinmaguncha qidiruvda KO'RINMAYDI va bron
      // qilib bo'lmaydi. Shu sabab yaratish + activate BIR OQIMDA.
      quotaBlocked.current = false;
      const created = await createRide(payload);
      let activated = true;
      try {
        await activateRide(created.ride_id);
      } catch (e) {
        activated = false;
        // Activate yiqilsa ham e'lon YARATILGAN — muvaffaqiyat oqimidan chiqarmaymiz,
        // lekin ogohlantiramiz (backend gRPC blokeri bo'lgan davr uchun, xat v5 №1).
        console.warn('Ride activate failed', e);

        // ⚠️ 400 — TARIF cheklovi (backend xati 2026-08-12: Plus'da premium
        // filtrlar). "Birozdan so'ng qayta urinib ko'ring" bu holatda YOLG'ON:
        // qayta urinish hech qachon yordam bermaydi. Serverning o'z matnini
        // ko'rsatamiz, chunki unda aynan qaysi filtr aybdorligi yozilgan.
        const err = e as {
          response?: { status?: number; data?: { error?: string; message?: string } };
        };
        const serverMessage = err?.response?.data?.error ?? err?.response?.data?.message;
        const status = err?.response?.status;

        // 🔴 MASHINA TASDIQLANMAGAN — eng ko'p uchraydigan sabab (egasi
        // 2026-08-21: "nega safar yaratishda 400 qaytaryapti"). Backend
        // bu holatda INGLIZCHA texnik jumla qaytaradi
        // («cannot activate ride: driver does not have an approved car»)
        // va biz uni o'sha holicha ko'rsatardik. Odam na tilni, na nima
        // qilish kerakligini tushunmasdi.
        //
        // E'lon YO'QOLMAYDI — qoralama bo'lib turadi. Xabar shuni aytishi
        // SHART, aks holda odam e'loni yo'qoldi deb qaytadan yozadi.
        // 🔴 PAKET TUGADI — HOLAT KODIGA qarab aniqlanadi, matnga EMAS.
        // Backend hozir `{"error":"payment required: insufficient ride limits"}`
        // qaytaradi (09.09.2026 da o'lchandi), lekin matnga bog'lansak
        // backend uni o'zgartirgan kuni paywall JIMGINA o'chib qolardi.
        if (status === 402) {
          quotaBlocked.current = true;
          logEvent(AnalyticsEvent.paywallShown, {
            reason: 'quota_exceeded',
            from: 'create_trip',
          });
          toast.warning(
            tr(
              "Paketingizdagi e'lonlar tugadi. E'lon SAQLANDI, lekin tarif yangilanmaguncha qidiruvda ko'rinmaydi.",
              'Объявления в вашем пакете закончились. Объявление СОХРАНЕНО, но не появится в поиске, пока вы не продлите тариф.',
              'You have no listings left in your plan. The listing is SAVED but will not appear in search until you renew.'
            ),
            { duration: 10000 }
          );
        } else if (
          String(serverMessage ?? '')
            .toLowerCase()
            .includes('approved car')
        ) {
          toast.warning(
            tr(
              "E'lon saqlandi, lekin hali ko'rinmaydi: mashinangiz tekshiruvdan o'tmagan. Tasdiqlangach uni panelda faollashtirasiz.",
              'Объявление сохранено, но пока не видно: ваш автомобиль не прошёл проверку. После подтверждения активируйте его в панели.',
              'Your listing is saved but not visible yet: your car has not been approved. Once approved, activate it from the panel.'
            ),
            { duration: 10000 }
          );
        } else if (err?.response?.status === 400 && serverMessage) {
          toast.error(serverMessage);
        } else {
          toast.warning(
            tr(
              "E'lon yaratildi, lekin hali faollashmadi — birozdan so'ng qayta urinib ko'ring",
              'Поездка создана, но пока не активирована — попробуйте позже',
              'The trip was created but is not active yet — please try again shortly'
            )
          );
        }
      }
      // Taklif tomonining o'lchovi: haydovchilar e'lon berayaptimi.
      // `activated` ham yuboriladi — faollashmagan e'lon qidiruvda
      // KO'RINMAYDI, ya'ni u amalda yo'q hisoblanadi.
      logEvent(AnalyticsEvent.ridePublished, { activated });

      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      // History sahifasi alohida kalitdan o'qiydi — yangi safar darhol ko'rinishi uchun.
      queryClient.invalidateQueries({ queryKey: ['history'] });

      /*
       * PAKET TUGAGAN BO'LSA — muvaffaqiyat oynasi YO'Q.
       *
       * Odam bitta e'lonni joylay olmay turib, unga «qaytish safarini ham
       * e'lon qilasizmi?» deb quvnoq taklif qilish mantiqsiz. Buning
       * o'rniga to'g'ridan-to'g'ri tariflar sahifasi — u yerda `?paywall=true`
       * sababni tushuntiradi va `paywall_shown` o'lchanadi.
       */
      if (quotaBlocked.current) {
        quotaBlocked.current = false;
        reset();
        router.push(`/${locale}/tariffs?paywall=true`);
        return;
      }

      setCreatedRideId(created?.ride_id ? String(created.ride_id) : null);
      // Qaytish safari uchun SNAPSHOT — `reset()` dan OLDIN olinadi, aks holda
      // muvaffaqiyat oynasida to'ldiradigan ma'lumot qolmaydi.
      setLastPublished({
        from,
        fromCoords,
        to,
        toCoords,
        seats,
        price,
        hasAC,
        hasLuggage,
        acceptsParcel,
        noSmoking,
        noPets,
        drivingSpeed,
        maxTwoBack,
        genderRestriction,
      });
      // Har yangi e'londa gard tozalanadi: oldingi safar qaytish safariga
      // ketgan bo'lsa ham, bu safar yopilish yana panelga olib borsin.
      goingToReturnTrip.current = false;
      setIsSuccessSheetOpen(true);
      reset(); // сбрасываем Zustand
    },

    onError: (error: any) => {
      if (error.message === 'NO_VEHICLE') {
        toast.error(
          tr(
            "Avtomobil topilmadi. Avtomobil qo'shing.",
            'Автомобиль не найден. Добавьте авто.',
            'No car found. Please add a car.'
          )
        );
        router.push(`/${locale}/driver/onboarding`);
        return;
      }
      if (error.message === 'NO_COORDS') {
        toast.error(
          tr(
            "Manzilni aniqlab bo'lmadi. Iltimos, shaharni xaritadan tanlang.",
            'Не удалось определить адрес. Пожалуйста, выберите город на карте.',
            'Could not resolve the address. Please pick the city on the map.'
          )
        );
        return;
      }
      if (error.message === 'HAS_ACTIVE') {
        toast.error(
          tr(
            'Sizda faol safar bor. Avval uni yakunlang yoki bekor qiling.',
            'У вас есть активная поездка. Сначала завершите или отмените её.',
            'You already have an active trip. Finish or cancel it first.'
          )
        );
        router.push(`/${locale}/dashboard`);
        return;
      }
      const status = error.response?.status;
      const msg =
        error.response?.data?.error || error.response?.data?.message || error.message || '';
      const lower = String(msg).toLowerCase();

      // Tekshiruv yoki mashina muammosi (403/404) -> haydovchi onboarding.
      // MUHIM: 'myid' ni 'tariff' dan OLDIN tekshiramiz (o'sha xabarda ham
      // "tariff" so'zi bor).
      //
      // 🔴 MATN TUZATILDI (2026-08-28): bu yerda «MyID tasdig'idan o'ting»
      // deb yozilgan edi, MyID esa mahsulotdan 2026-08-22 da OLIB
      // TASHLANGAN — ya'ni odamga MAVJUD BO'LMAGAN qadam aytilardi va u
      // nima qilishni bilmasdi. Shart o'z joyida qoladi: backend hamon
      // shu so'zli xato qaytarishi mumkin va bizni to'g'ri ekranga
      // yuboradi (u yerda hujjat tekshiruvi turibdi).
      if (lower.includes('myid') || lower.includes('vehicle')) {
        toast.error(
          lower.includes('myid')
            ? tr(
                "Safar e'lon qilish uchun avval haydovchi tekshiruvidan o'ting",
                'Чтобы опубликовать поездку, сначала пройдите проверку водителя',
                'To publish a ride, first complete the driver verification'
              )
            : tr(
                "Avtomobil topilmadi. Avtomobil qo'shing.",
                'Автомобиль не найден. Добавьте авто.',
                'No car found. Please add a car.'
              )
        );
        router.push(`/${locale}/driver/onboarding`);
        return;
      }

      // Mashina moderatsiyasi — avto hali tasdiqlanmagan (backend: "driver does not have an
      // approved car"). Aks holda foydalanuvchi xom inglizcha matn ko'rardi va nima qilishни
      // bilmasdi. Bu haydovchi bloker (backend moderatsiya paneli kutilmoqda — reliz xati №4).
      if (
        lower.includes('approved') ||
        lower.includes('moderation') ||
        lower.includes('not have an approved') ||
        lower.includes('pending')
      ) {
        toast.error(
          tr(
            "Avtomobilingiz hali tasdiqlanmagan — moderatsiyadan o'tishini kuting.",
            'Ваш автомобиль ещё не одобрен — дождитесь проверки модерацией.',
            'Your car is not approved yet — please wait for the review.'
          )
        );
        return;
      }

      // Balans/tarif tugagan -> paywall (to'lov sahifasi).
      if (status === 403 || lower.includes('tariff') || lower.includes('balance')) {
        router.push(`/${locale}/tariffs?paywall=true`);
        return;
      }

      // Server (5xx) yoki tarmoq xatosi — xom "Request failed with status code 500" matnini
      // KO'RSATMAYMIZ (foydalanuvchiga tushunarsiz). Aniq lokalizatsiyalangan xabar beramiz.
      if (!error.response || status >= 500) {
        const m = tr(
          "Safar yaratib bo'lmadi — serverda vaqtinchalik xatolik. Birozdan so'ng qayta urinib ko'ring.",
          'Не удалось создать поездку — временная ошибка сервера. Попробуйте позже.',
          'Could not create the trip — temporary server error. Please try again later.'
        );
        setBackendError(m);
        toast.error(m);
        return;
      }

      // Qolgan (4xx, backend xabari bor) -> tushunarli xabar (xom JSON ko'rsatilmaydi).
      const friendly =
        msg ||
        tr(
          'Safar yaratishda xatolik yuz berdi',
          'Произошла ошибка при создании поездки',
          'An error occurred while creating the trip'
        );
      setBackendError(friendly);
      toast.error(friendly);
    },
  });

  const handleNext = () => {
    if (step === 1 && !isStep1Valid) {
      toast.error(
        tr("Barcha maydonlarni to'ldiring", 'Заполните все поля', 'Fill in all the fields')
      );
      return;
    }
    if (step === 2 && !isStep2Valid) {
      toast.error(tr('Sana va vaqtni tanlang', 'Выберите дату и время', 'Choose a date and time'));
      return;
    }
    // Jo'nash sana/vaqti o'tmishda bo'lmasligi kerak (o'tgan sana yoki bugun bo'lsa o'tgan soat).
    if (step === 2) {
      if (date < tkNow.date) {
        toast.error(
          tr(
            "O'tgan vaqtni tanlay olmaysiz",
            'Нельзя выбрать прошедшее время',
            'You cannot pick a time in the past'
          )
        );
        return;
      }
      const departureMs = new Date(tashkentLocalToUTCISO(date, time)).getTime();
      if (!Number.isNaN(departureMs) && departureMs < Date.now()) {
        toast.error(
          tr(
            "O'tgan vaqtni tanlay olmaysiz",
            'Нельзя выбрать прошедшее время',
            'You cannot pick a time in the past'
          )
        );
        return;
      }
    }
    if (step === 3 && !isStep3Valid) {
      toast.error(tr("To'g'ri narx kiriting", 'Введите корректную цену', 'Enter a valid price'));
      return;
    }

    if (step < 3) {
      setStep(step + 1);
    } else {
      setBackendError(null);
      createTripMutation.mutate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      // Инициируем проверку сохранения в черновики, если поля заполнены
      if (from.trim() || to.trim()) {
        setDraftConfirmOpen(true);
      } else {
        router.push(`/${locale}/profile`);
      }
    }
  };

  const saveDraft = () => {
    setDraftConfirmOpen(false);
    toast.success(
      tr(
        'Safar qoralama sifatida saqlandi',
        'Поездка сохранена в черновики!',
        'Trip saved as a draft'
      )
    );
    router.push(`/${locale}/profile`);
  };

  const discardDraft = () => {
    setDraftConfirmOpen(false);
    reset();
    router.push(`/${locale}/profile`);
  };

  // Faol safar holatini tekshirayotganda — qisqa yuklanish ekrani (forma "miltillamasligi" uchun).
  if (tripsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        {/* Yuklanish paytida ham sahifaning nomi bo'lsin: audit aynan
            shu holatni tutdi (`h1 YO'Q` faqat bitta o'lchovda chiqdi —
            o'sha safar sahifa hali yuklanayotgan edi). */}
        <h1 className="sr-only">{t('createTitle')}</h1>
        <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  // /trips/my xato bersa formani ochmaymiz (faol safar holati noma'lum) — qayta urinish taklif qilamiz.
  if (tripsError) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh] px-4">
        <h1 className="sr-only">{t('createTitle')}</h1>
        <EmptyState
          className="w-full max-w-md rounded-2xl border border-border bg-surface"
          icon={<CloudOff />}
          title={tr("Ma'lumot yuklanmadi", 'Данные не загрузились', 'Could not load your trips')}
          description={tr(
            "Safar ma'lumotlarini yuklab bo'lmadi. Qayta urinib ko'ring.",
            'Не удалось загрузить данные поездок. Попробуйте ещё раз.',
            'Could not load trip data. Please try again.'
          )}
          action={
            <Button variant="secondary" onClick={() => refetchTrips()}>
              {tr('Qayta urinish', 'Повторить', 'Try again')}
            </Button>
          }
        />
      </div>
    );
  }

  // BITTA FAOL SAFAR: faol safar bo'lsa, yangisini yaratish o'rniga ogohlantirish ko'rsatamiz.
  if (hasActiveTrip && !isReturnTrip) {
    return (
      <div className="flex-1 bg-bg px-4 py-8 flex items-center justify-center min-h-[60vh]">
        {/* 🔴 SAHIFANING SARLAVHASI (2026-09-04, o'lchandi): bu holatda
            sahifada faqat bo'sh holat kartasi qoladi va `h1` UMUMAN
            yo'q edi — ekran o'qigich qaysi sahifada ekanini ayta
            olmasdi. Ko'rinmas, chunki karta o'z sarlavhasini
            ko'rsatib turibdi. */}
        <h1 className="sr-only">{t('createTitle')}</h1>
        <EmptyState
          className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-sm"
          icon={<Navigation />}
          title={tr(
            'Sizda faol safar bor',
            'У вас есть активная поездка',
            'You have an active trip'
          )}
          description={tr(
            "Bir vaqtning o'zida faqat bitta faol safar bo'lishi mumkin. Yangi safar yaratish uchun avval joriy safaringizni yakunlang yoki bekor qiling.",
            'Одновременно может быть только одна активная поездка. Чтобы создать новую, сначала завершите или отмените текущую.',
            'You can only have one active trip at a time. To create a new one, finish or cancel your current trip first.'
          )}
          action={
            <Button onClick={() => router.push(`/${locale}/dashboard`)}>
              {tr("Joriy safarga o'tish", 'Перейти к текущей поездке', 'Go to current trip')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8 select-none">
      <div className="mx-auto max-w-md space-y-6">
        {/* Шапка формы */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border text-text-muted hover:text-accent transition-colors shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-text leading-tight">{t('createTitle')}</h1>
            <p className="text-xs font-bold text-text-muted">
              {tr(`Qadam ${step} ning 3`, `Шаг ${step} из 3`, `Step ${step} of 3`)}
            </p>
          </div>
        </div>

        {/* Amaldagi tarif va balans (CEO 2026-07-30: safar yaratish ekranida
            foydalanuvchi qaysi tarifda ekani va balansi ko'rinib tursin —
            balans tugasa forma oxirida 403 -> paywall bo'ladi, buni OLDINDAN
            bilgani yaxshi). */}
        <CurrentPlanCard compact />

        {/* Прогресс-бар шагов */}
        <div className="flex gap-2 h-1.5 w-full bg-border/40 rounded-full overflow-hidden">
          <div
            className={`h-full bg-accent ${step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'}`}
          />
        </div>

        {/* Тело формы */}
        <div className="glass-panel rounded-3xl p-6 shadow-2xl shadow-accent/5 min-h-[340px] flex flex-col justify-between">
          <div className="space-y-4">
            {/* 🔴 MASHINA TASDIQLANMAGAN bo'lsa OLDINDAN aytamiz (egasi
                2026-08-21: "nega safar yaratishda 400 qaytaryapti").
                Backend e'lonni yaratadi-yu FAOLLASHTIRMAYDI — ya'ni odam
                butun formani to'ldirib bo'lgach xato ko'radi.

                E'lon berish TO'SILMAYDI: qoralama saqlanadi va mashina
                tasdiqlangach faollashtiriladi. */}
            {step === 1 && vehicles.length > 0 && !carApproved && (
              <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-text">
                <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>
                  {tr(
                    "Mashinangiz tekshiruvda. E'lon berishingiz mumkin, lekin u tasdiqlangunicha qidiruvda ko'rinmaydi.",
                    'Ваш автомобиль на проверке. Объявление можно создать, но до подтверждения оно не появится в поиске.',
                    'Your car is under review. You can create a listing, but it will not appear in search until approval.'
                  )}
                </span>
              </div>
            )}

            {/* ШАГ 1: Города и точки сбора */}
            {step === 1 && (
              <div className="space-y-4">
                <SectionLabel icon={<MapPin />}>
                  {tr("Shaharlar va yig'ilish joyi", 'Маршрут и сбор', 'Route and pickup')}
                </SectionLabel>

                <div className="space-y-4">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      {/* CityAutocomplete — qidiruv sahifasi bilan BIR XIL manba. Shahar tanlanganда
                          o'sha shaharning aynan bir xil koordinatasi olinadi, shuning uchun yo'lovchi
                          qidirganда safar kafolatli mos keladi (koordinata farqi yo'q). */}
                      <CityAutocomplete
                        label={tr('Qayerdan (Shahar)', 'Откуда (Город)', 'From (city)')}
                        placeholder={tr('Masalan, Toshkent', 'Напр. Ташкент', 'e.g. Tashkent')}
                        value={from}
                        onChange={(v) => setField('from', v)}
                        onSelect={(name, lat, lon) => {
                          setField('from', name);
                          setField('fromCoords', [lat, lon]);
                        }}
                        onBestMatch={(lat, lon) => setField('fromCoords', [lat, lon])}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-[46px] px-3 shrink-0"
                      onClick={() => setOpenMap('from')}
                    >
                      <MapPin className="h-5 w-5 text-accent" />
                    </Button>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <CityAutocomplete
                        label={tr('Qayerga (Shahar)', 'Куда (Город)', 'To (city)')}
                        placeholder={tr('Masalan, Samarqand', 'Напр. Самарканд', 'e.g. Samarkand')}
                        value={to}
                        onChange={(v) => setField('to', v)}
                        onSelect={(name, lat, lon) => {
                          setField('to', name);
                          setField('toCoords', [lat, lon]);
                        }}
                        onBestMatch={(lat, lon) => setField('toCoords', [lat, lon])}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-[46px] px-3 shrink-0"
                      onClick={() => setOpenMap('to')}
                    >
                      <MapPin className="h-5 w-5 text-accent" />
                    </Button>
                  </div>
                </div>

                {/* ORALIQ SHAHARLAR (ixtiyoriy, maks 3) — BlaBlaCar uslubidagi "kirib o'tish"
                    nuqtalari. Yo'lovchi shu shaharlardan qidirganda ham safar topilsin
                    (Swagger'da `stops` 2026-07-18'dan bor edi — endi UI ham bor). */}
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-text-muted">
                    {tr(
                      "Yo'l-yo'lakay shaharlar (ixtiyoriy)",
                      'Промежуточные города (необязательно)',
                      'Cities along the way (optional)'
                    )}
                  </span>
                  {stops.map((s, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <CityAutocomplete
                          placeholder={tr('Masalan, Jizzax', 'Напр. Джизак', 'e.g. Jizzakh')}
                          value={s.name}
                          onChange={(v) => updateStop(i, { name: v, coords: null })}
                          onSelect={(name, lat, lon) => updateStop(i, { name, coords: [lat, lon] })}
                          onBestMatch={(lat, lon) =>
                            updateStop(i, { name: s.name, coords: [lat, lon] })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStop(i)}
                        aria-label={tr('Shaharni olib tashlash', 'Убрать город', 'Remove city')}
                        className="flex h-[46px] w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-muted hover:text-error hover:border-error/40 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {stops.length < 3 && (
                    <button
                      type="button"
                      onClick={addStop}
                      className="flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
                    >
                      <Plus className="h-4 w-4" />
                      {tr("Shahar qo'shish", 'Добавить город', 'Add city')}
                    </button>
                  )}
                  {stops.length > 0 && (
                    <p className="text-[11px] text-text-muted leading-snug">
                      {tr(
                        "Yo'lovchilar shu shaharlardan qidirganda ham safaringizni topadi",
                        'Пассажиры из этих городов тоже найдут вашу поездку',
                        'Passengers searching from these cities will also find your trip'
                      )}
                    </p>
                  )}

                  {/*
                    YO'L KO'RIGI — 16.09.2026
                    (egasi: «karta to'liq ishlatilsin»).

                    🔴 Haydovchi oraliq shahar QO'SHARDI, lekin yo'lini
                    HECH QACHON ko'rmasdi: forma faqat NOMLARNI
                    ko'rsatardi. Ya'ni «Jizzax haqiqatan yo'lim ustidami
                    yoki chekkadami?» degan savolga javob yo'q edi — xato
                    bekat esa e'lon berilgandan keyin, yo'lovchi
                    qo'shilganda ma'lum bo'lardi.

                    Bekatlar qatoridan DARHOL keyin turadi: qo'shdi —
                    ko'rdi. Yo'nalish to'liq bo'lmasa `RoutePreview` o'zi
                    hech nima chizmaydi.
                  */}
                  <RoutePreview
                    from={fromCoords}
                    to={toCoords}
                    via={stops.map((s) => s.coords).filter((c): c is [number, number] => !!c)}
                    height={170}
                  />
                </div>

                <Input
                  label={tr(
                    "Yig'ilish nuqtasi (Batafsil)",
                    'Точка сбора (Ориентир)',
                    'Pickup point (landmark)'
                  )}
                  placeholder={tr(
                    'Metroning Chilonzor bekati yonida',
                    'Напр. м. Чиланзар, стоянка',
                    'e.g. next to Chilonzor metro station'
                  )}
                  value={pickupPoint}
                  onChange={(e) => {
                    setField('pickupPoint', e.target.value);
                    // Matn qo'lda o'zgartirildi — xaritadagi eski nuqta
                    // endi boshqa joyni ko'rsatadi, ya'ni u YAROQSIZ.
                    if (pickupCoords) setField('pickupCoords', null);
                  }}
                />
                {/* 🔴 XARITADAN TANLASH — uchrashuv nuqtasi shu paytgacha
                    FAQAT erkin matn edi ("Chilonzor, stoyanka"). Bunday
                    yozuvdan yo'lovchi qayerga borishini bilmaydi va
                    navigator ham uni topa olmaydi.

                    ✅ 17.09.2026: endi KOORDINATA ham saqlanadi
                    (`pickup_lat/pickup_lon` — jonli o'lchandi), ya'ni
                    yo'lovchi aynan shu nuqtani xaritada ko'radi. Matn
                    qoladi: u mo'ljal («3-chiqish yonida»), koordinata
                    bermaydigan ma'noni tashiydi. */}
                <button
                  type="button"
                  onClick={() => setOpenMap('pickup')}
                  className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <MapPin className="h-4 w-4 text-accent" />
                  {pickupCoords
                    ? tr('Nuqtani o\u2018zgartirish', 'Изменить точку', 'Change the point')
                    : tr('Xaritadan tanlash', 'Выбрать на карте', 'Pick on map')}
                </button>

                {/* Tanlangan nuqta KO'RINADI: aks holda haydovchi nuqta
                    saqlanganini faqat ishonch bilan bilardi. */}
                {pickupCoords && (
                  <div className="mt-2 space-y-1">
                    <PointPreview lat={pickupCoords[0]} lon={pickupCoords[1]} height={120} />
                    <p className="text-[11px] font-semibold text-turquoise-ink dark:text-turquoise">
                      {tr(
                        'Yo\u2018lovchi shu nuqtani xaritada ko\u2018radi',
                        'Пассажир увидит эту точку на карте',
                        'The passenger will see this point on the map'
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ШАГ 2: Время выезда */}
            {step === 2 && (
              <div className="space-y-4">
                <SectionLabel icon={<Calendar />}>
                  {tr("Jo'nash vaqti", 'Время выезда', 'Departure time')}
                </SectionLabel>

                {/* Brend kalendari (native `<input type="date">` EMAS — sabab: DateField izohi).
                    `min` — bugun: o'tgan kunga safar e'lon qilinmaydi. */}
                <DateField
                  label={tr('Sana', 'Дата поездки', 'Date')}
                  value={date}
                  min={tkNow.date}
                  onChange={(v) => setField('date', v)}
                />

                {/* 24-soatlik vaqt (AM/PM YO'Q — brauzer locale'iga bog'liq emas).
                    Bugun tanlangan bo'lsa, o'tib ketgan soat/daqiqa o'chiq turadi. */}
                <TimeField
                  label={tr("Jo'nash soati", 'Время отправления', 'Departure time')}
                  value={time}
                  minTime={isToday ? tkNow.time : undefined}
                  onChange={(v) => setField('time', v)}
                />
              </div>
            )}

            {/* ШАГ 3: Свободные места + кондиционер/багаж + цена */}
            {step === 3 && (
              <div className="space-y-4">
                <SectionLabel icon={<Info />}>
                  {tr('Safar tafsilotlari', 'Детали поездки', 'Trip details')}
                </SectionLabel>

                {/* Кол-во свободных мест */}
                <Select
                  label={tr("Bo'sh joylar soni", 'Свободных мест', 'Free seats')}
                  value={String(seats)}
                  onChange={(e) => setField('seats', Number(e.target.value))}
                  options={[
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                    { value: '4', label: '4' },
                    { value: '5', label: '5' },
                    { value: '6', label: '6' },
                  ]}
                />

                {/* Avtomobil tanlash — bir nechta avtomobili bo'lsa, qaysi biri ekanini tanlaydi */}
                {vehicles.length > 0 && (
                  <Select
                    label={tr('Avtomobil', 'Автомобиль', 'Car')}
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    options={vehicleOptions}
                  />
                )}

                {/* Доп опции */}
                <div className="flex flex-col min-[360px]:flex-row gap-3 py-2">
                  {/* Qulflangani YASHIRILMAYDI: yashirilgan narsa "yo'q" deb
                      tushuniladi, qulf esa nima uchun tarifni oshirish
                      kerakligini ko'rsatadi. */}
                  <div
                    className={`flex-1 flex items-center justify-between p-4 bg-surface input-inner-shadow border border-border/80 rounded-2xl transition-colors ${
                      premiumFiltersLocked ? 'opacity-60' : 'hover:border-accent/40'
                    }`}
                    title={premiumFiltersLocked ? proOnlyHint : undefined}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase">
                      <FeatureIcon icon={rideFeatureIcons.ac} locked={premiumFiltersLocked} />
                      {tr('Konditsioner', 'Кондиционер', 'Air conditioning')}
                    </span>
                    <Switch
                      ariaLabel={tr('Konditsioner', 'Кондиционер', 'Air conditioning')}
                      checked={premiumFiltersLocked ? false : hasAC}
                      disabled={premiumFiltersLocked}
                      onChange={(checked) => setField('hasAC', checked)}
                    />
                  </div>
                  <div className="flex-1 flex items-center justify-between p-4 bg-surface input-inner-shadow border border-border/80 rounded-2xl hover:border-accent/40 transition-colors">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase">
                      <FeatureIcon icon={rideFeatureIcons.luggage} />
                      {tr('Bagaj', 'Багаж', 'Luggage')}
                    </span>
                    <Switch
                      ariaLabel={tr('Bagaj', 'Багаж', 'Luggage')}
                      checked={hasLuggage}
                      onChange={(checked) => setField('hasLuggage', checked)}
                    />
                  </div>
                </div>

                {/* 🔴 "Faqat ayollar" kaliti OLIB TASHLANDI (egasi,
                    2026-08-13): «faqat ayollar cheklovi olib tashlansin,
                    erkaklar ham uni qidira olsin». */}
                <div className="flex flex-col min-[360px]:flex-row gap-3 py-2">
                  <div className="flex-1 flex items-center justify-between p-4 bg-success/5 border border-success/20 rounded-2xl">
                    <span className="text-xs font-bold text-success uppercase flex items-center gap-1">
                      <FeatureIcon icon={rideFeatureIcons.parcel} />
                      {tr('Pochta', 'Посылка', 'Parcel')}
                    </span>
                    <Switch
                      ariaLabel={tr('Pochta', 'Посылка', 'Parcel')}
                      checked={acceptsParcel}
                      onChange={(checked) => setField('acceptsParcel', checked)}
                    />
                  </div>
                </div>

                {/* Salon qoidalari: chekish / hayvon */}
                <div className="flex flex-col min-[360px]:flex-row gap-3 py-2">
                  <div
                    className={`flex-1 flex items-center justify-between p-4 bg-surface input-inner-shadow border border-border/80 rounded-2xl transition-colors ${
                      premiumFiltersLocked ? 'opacity-60' : 'hover:border-accent/40'
                    }`}
                    title={premiumFiltersLocked ? proOnlyHint : undefined}
                  >
                    <span className="text-xs font-bold text-text-muted uppercase flex items-center gap-1">
                      <FeatureIcon
                        icon={rideFeatureIcons.noSmoking}
                        locked={premiumFiltersLocked}
                      />
                      {tr('Chekilmaydi', 'Не курить', 'No smoking')}
                    </span>
                    <Switch
                      ariaLabel={tr('Chekilmaydi', 'Не курить', 'No smoking')}
                      checked={premiumFiltersLocked ? false : noSmoking}
                      disabled={premiumFiltersLocked}
                      onChange={(checked) => setField('noSmoking', checked)}
                    />
                  </div>
                  <div className="flex-1 flex items-center justify-between p-4 bg-surface input-inner-shadow border border-border/80 rounded-2xl hover:border-accent/40 transition-colors">
                    <span className="text-xs font-bold text-text-muted uppercase flex items-center gap-1">
                      <FeatureIcon icon={rideFeatureIcons.noPets} />
                      {tr('Hayvonsiz', 'Без животных', 'No pets')}
                    </span>
                    <Switch
                      ariaLabel={tr('Hayvonsiz', 'Без животных', 'No pets')}
                      checked={noPets}
                      onChange={(checked) => setField('noPets', checked)}
                    />
                  </div>
                </div>

                {/* Komfort: orqa o'rindiqda maks 2 yo'lovchi (BlaBlaCar "Max 2 in the back") */}
                <div
                  className={`flex items-center justify-between p-4 bg-surface input-inner-shadow border border-border/80 rounded-2xl transition-colors ${
                    premiumFiltersLocked ? 'opacity-60' : 'hover:border-accent/40'
                  }`}
                  title={premiumFiltersLocked ? proOnlyHint : undefined}
                >
                  <span className="text-xs font-bold text-text-muted uppercase flex items-center gap-1">
                    <FeatureIcon icon={rideFeatureIcons.twoBack} locked={premiumFiltersLocked} />
                    {tr(
                      'Orqada maks 2 kishi',
                      'Сзади максимум 2 человека',
                      'Max 2 people in the back'
                    )}
                  </span>
                  <Switch
                    ariaLabel={tr(
                      'Orqada maks 2 kishi',
                      'Сзади максимум 2 человека',
                      'Max 2 people in the back'
                    )}
                    checked={premiumFiltersLocked ? false : maxTwoBack}
                    disabled={premiumFiltersLocked}
                    onChange={(checked) => setField('maxTwoBack', checked)}
                  />
                </div>

                {/*
                  KIMNI OLASIZ — «faqat ayollar» tanlovi.

                  🔴 13.08.2026 da olib tashlangandi, 08.09.2026 da
                  egasining talabi bilan qaytarildi. Ma'nosi boshqa: bu
                  haydovchining JINSI haqida emas, SALON haqida — erkak
                  haydovchi ham «faqat ayol yo'lovchi olaman» deya oladi.

                  ⚠️ TARIFGA BOG'LANMAGAN: xavfsizlik pullik bo'lmasin.

                  ⚠️ Ostidagi izoh MAJBURIY — bunday e'lon oddiy
                  qidiruvda ko'rinmaydi (08.09.2026 da prodda o'lchandi)
                  va haydovchi buni BILIB tanlashi kerak.
                */}
                <div className="flex flex-col gap-2 py-2">
                  <span className="text-xs font-bold text-text-muted uppercase">
                    {tr('Kimni olasiz', 'Кого берёте', 'Who you take')}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: '', uz: 'Hammani', ru: 'Всех', en: 'Anyone' },
                        {
                          key: 'female',
                          uz: 'Faqat ayollar',
                          ru: 'Только женщин',
                          en: 'Women only',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = genderRestriction === opt.key;
                      return (
                        <button
                          key={opt.key || 'any'}
                          type="button"
                          onClick={() => setField('genderRestriction', opt.key)}
                          aria-pressed={active}
                          className={`flex items-center justify-center gap-1.5 py-3 rounded-2xl border text-xs font-bold transition-colors ${
                            active
                              ? 'bg-brand-pink-light dark:bg-accent/10 border-accent text-accent'
                              : 'bg-surface border-border/80 text-text-muted hover:border-accent/40'
                          }`}
                        >
                          {opt.key === 'female' && (
                            <VenusIcon className="h-4 w-4 shrink-0" aria-hidden />
                          )}
                          <span>{tr(opt.uz, opt.ru, opt.en)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {genderRestriction === 'female' && (
                    <p className="text-[11px] font-semibold leading-snug text-text-muted">
                      {tr(
                        "Bunday safar qidiruvda faqat «Faqat ayollar» filtri yoqilganda ko'rinadi",
                        'Такая поездка видна в поиске только с включённым фильтром «Только женщины»',
                        'Such a ride appears in search only with the "Women only" filter on'
                      )}
                    </p>
                  )}
                </div>

                {/* Haydash uslubi — 3 darajali segment tanlagich (bittasi tanlanadi) */}
                <div className="flex flex-col gap-2 py-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase">
                    {premiumFiltersLocked && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                    {tr('Haydash uslubi', 'Стиль вождения', 'Driving style')}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        {
                          key: 'calm',
                          icon: rideFeatureIcons.calm,
                          uz: 'Sekin',
                          ru: 'Спокойно',
                          en: 'Calm',
                        },
                        {
                          key: 'normal',
                          icon: rideFeatureIcons.normal,
                          uz: "O'rtacha",
                          ru: 'Средне',
                          en: 'Moderate',
                        },
                        {
                          key: 'fast',
                          icon: rideFeatureIcons.fast,
                          uz: 'Tez',
                          ru: 'Быстро',
                          en: 'Fast',
                        },
                      ] as const
                    ).map((opt) => {
                      // Qulflanganda `normal` da qotib turadi — backend aynan
                      // shuni "standart" deb kutadi.
                      const effective = premiumFiltersLocked ? 'normal' : drivingSpeed;
                      const active = effective === opt.key;
                      const optionLocked = premiumFiltersLocked && opt.key !== 'normal';
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => !premiumFiltersLocked && setField('drivingSpeed', opt.key)}
                          disabled={optionLocked}
                          title={optionLocked ? proOnlyHint : undefined}
                          aria-pressed={active}
                          className={`flex flex-col items-center gap-1 py-3 rounded-2xl border text-xs font-bold transition-colors ${
                            active
                              ? 'bg-brand-pink-light dark:bg-accent/10 border-accent text-accent'
                              : optionLocked
                                ? 'bg-surface border-border/80 text-text-muted opacity-50 cursor-not-allowed'
                                : 'bg-surface border-border/80 text-text-muted hover:border-accent/40'
                          }`}
                        >
                          <opt.icon className="h-5 w-5" aria-hidden />
                          <span>{tr(opt.uz, opt.ru, opt.en)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* YO'LDA MUSIQA — ixtiyoriy va HAMMAGA ochiq.

                    🔑 Haydash uslubidan farqli o'laroq QULFLANMAYDI: bu
                    qulaylik emas, OGOHLANTIRISH. Sokin salon kutgan odam
                    «musiqa baland» ni oldindan bilsin — buni pulli qilish
                    nizoni safar ichiga surardi.

                    🔴 27.08.2026 dan beri belgilar chizilgan edi-yu, hech
                    qachon ko'rinmasdi: qiymatni yuboradigan joy YO'Q edi
                    (o'shanda backendda maydon yo'q deb hisoblagandik —
                    09.09.2026 o'lchovi buni rad etdi). */}
                <div className="flex flex-col gap-2 py-2">
                  <span className="text-xs font-bold text-text-muted uppercase">
                    {tr("Yo'lda musiqa", 'Музыка в дороге', 'Music on the road')}
                  </span>
                  <p className="-mt-1 text-xs text-text-muted">
                    {tr(
                      "Ixtiyoriy — yo'lovchi nima kutishini bilsin",
                      'Необязательно — чтобы пассажир знал, чего ожидать',
                      'Optional — so passengers know what to expect'
                    )}
                  </p>
                  {/* `grid-cols-2` — 320 px li ekranda 4 ta tugma bitta
                      qatorga sig'maydi (loyihada bu xato qaytgan). */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        { key: '', icon: null, uz: "Farqi yo'q", ru: 'Без разницы', en: 'Any' },
                        {
                          key: 'quiet',
                          icon: rideFeatureIcons.musicQuiet,
                          uz: 'Sokin',
                          ru: 'Тихо',
                          en: 'Quiet',
                        },
                        {
                          key: 'loud',
                          icon: rideFeatureIcons.musicLoud,
                          uz: 'Baland',
                          ru: 'Громко',
                          en: 'Loud',
                        },
                        {
                          key: 'talk',
                          icon: rideFeatureIcons.musicTalk,
                          uz: 'Suhbat',
                          ru: 'Поговорим',
                          en: 'We chat',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = musicTaste === opt.key;
                      return (
                        <button
                          key={opt.key || 'any'}
                          type="button"
                          onClick={() => setField('musicTaste', opt.key)}
                          aria-pressed={active}
                          className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs font-bold transition-colors ${
                            active
                              ? 'bg-brand-pink-light dark:bg-accent/10 border-accent text-accent'
                              : 'bg-surface border-border/80 text-text-muted hover:border-accent/40'
                          }`}
                        >
                          {opt.icon ? (
                            <opt.icon className="h-5 w-5" aria-hidden />
                          ) : (
                            <span className="h-5 w-5" aria-hidden />
                          )}
                          <span>{tr(opt.uz, opt.ru, opt.en)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Стоимость */}
                <Input
                  label={tr(
                    "Tavsiya etilgan narx (so'mda)",
                    'Рекомендуемая цена (сум)',
                    'Suggested price (UZS)'
                  )}
                  type="number"
                  placeholder="80000"
                  value={price === 0 ? '' : price}
                  onChange={(e) => setField('price', Number(e.target.value))}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />

                <div className="bg-gradient-to-r from-accent/10 to-transparent border border-accent/20 p-4 rounded-2xl flex items-center justify-between shadow-inner">
                  <span className="text-xs font-extrabold text-text uppercase tracking-wide">
                    {tr("Yo'lovchidan olinadigan sum", 'Сумма за место', 'Price per seat')}:
                  </span>
                  <span className="text-lg font-black text-accent text-glow">
                    {formatCurrency(price, locale)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {backendError && (
            <div className="mt-4 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-semibold text-center">
              {backendError}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <Button
                onClick={handleBack}
                variant="secondary"
                className="flex-1"
                disabled={createTripMutation.isPending}
              >
                {tr('Orqaga', 'Назад', 'Back')}
              </Button>
            )}

            <Button
              onClick={handleNext}
              disabled={
                createTripMutation.isPending ||
                (step === 1 && !isStep1Valid) ||
                (step === 2 && !isStep2Valid) ||
                (step === 3 && !isStep3Valid)
              }
              isLoading={createTripMutation.isPending}
              className="flex-1"
            >
              <span>
                {step === 3
                  ? tr("E'lon qilish", 'Опубликовать', 'Publish')
                  : tr('Keyingi', 'Далее', 'Next')}
              </span>
              {step < 3 && <ArrowRight className="h-4 w-4 ml-1.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Мягкий диалог сохранения в черновики */}
      <Dialog
        isOpen={draftConfirmOpen}
        onClose={() => setDraftConfirmOpen(false)}
        title={tr('Qoralama saqlansinmi?', 'Сохранить в черновики?', 'Save as draft?')}
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-text-muted leading-relaxed">
            {tr(
              "Siz marshrutni to'ldirishni boshladingiz. Uni qoralama sifatida saqlab qolishni xohlaysizmi?",
              'Вы заполнили часть данных о маршруте. Хотите сохранить эту поездку в черновики, чтобы продолжить позже?',
              'You have started filling in the route. Would you like to save it as a draft?'
            )}
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={saveDraft} className="w-full">
              {tr('Ha, saqlash', 'Да, сохранить', 'Yes, save')}
            </Button>
            <Button onClick={discardDraft} variant="secondary" className="w-full">
              {tr("Yo'q, o'chirish", 'Нет, стереть', 'No, discard')}
            </Button>
            <Button onClick={() => setDraftConfirmOpen(false)} variant="ghost" className="w-full">
              {tr('Tahrirlashda davom etish', 'Вернуться к заполнению', 'Keep editing')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Выдвижная Bottom Sheet шторка успеха создания поездки */}
      <BottomSheet
        isOpen={isSuccessSheetOpen}
        onClose={() => {
          setIsSuccessSheetOpen(false);
          // Qaytish safariga ketayotgan bo'lsak — panelga YO'NALTIRMAYMIZ.
          // BottomSheet `onOpenChange` orqali yopiladi, ya'ni `isOpen` ni
          // false qilishning O'ZI ham bu handler'ni ishga tushirishi mumkin.
          // Gardsiz bo'lsa u qaytish safari sahifasining ustidan yozib,
          // haydovchini panelga tashlab yuborardi.
          if (goingToReturnTrip.current) return;
          // Haydovchi safar yaratgach HAYDOVCHI sahifasida qoladi (yo'lovchi /search EMAS).
          router.push(dashboardHref);
        }}
        title={tr(
          'Safar muvaffaqiyatli yaratildi!',
          'Поездка успешно создана!',
          'Trip created successfully!'
        )}
      >
        <div className="space-y-4 text-center pb-4 select-none">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success border border-success/20">
            <Check className="h-8 w-8" />
          </div>
          <p className="text-sm text-text-muted leading-relaxed">
            {tr(
              "Sizning safaringiz muvaffaqiyatli ro'yxatdan o'tdi. Endi yo'lovchilar stavkalarini kutishingiz mumkin!",
              'Ваш попутный маршрут успешно опубликован в системе. Теперь вы можете просматривать радар встречных ставок пассажиров!',
              'Your trip has been published. You can now wait for passenger offers!'
            )}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => {
                setIsSuccessSheetOpen(false);
                // /bidding YO'LOVCHI sahifasi. Haydovchi o'z safarini va kelgan
                // arizalarni HAYDOVCHI dashboard'ida ko'radi -> /dashboard.
                // `?created=` — panel e'lonning to'liq kartochkasini O'ZI ochadi.
                router.push(dashboardHref);
              }}
              className="w-full"
            >
              {tr("Safar ma'lumotlarini ko'rish", 'Посмотреть данные поездки', 'View trip details')}
            </Button>

            {/* QAYTISH SAFARI — aynan shu joy uchun `lastPublished` snapshot'i
                olinadi (mutation'da, `reset()` dan oldin). Ilgari snapshot
                YOZILARDI-yu HECH QAYERDA O'QILMASDI: taklif chiqmagani uchun
                haydovchi qaytish safarini faqat panelga borib, safar
                tafsilotlari oynasidan topishi mumkin edi — ya'ni amalda
                funksiya yo'qday tuyulardi. Ilovada bu e'londan keyin darhol
                dialog bilan so'raladi, endi sayt ham xuddi shunday. */}
            {lastPublished && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    goingToReturnTrip.current = true;
                    setIsSuccessSheetOpen(false);
                    startReturnTrip(lastPublished);
                    router.push(`/${locale}/driver/create-trip?return=1`);
                  }}
                  className="w-full"
                >
                  {tr(
                    "Qaytish safarini ham e'lon qilish",
                    'Опубликовать и обратную поездку',
                    'Publish the return trip as well'
                  )}
                </Button>
                <p className="text-xs text-text-muted">
                  {tr(
                    "Yo'nalish teskari to'ldiriladi — sizga faqat sana va vaqtni tanlash qoladi.",
                    'Маршрут заполнится в обратную сторону — останется выбрать дату и время.',
                    'The route is filled in reverse — you only need to pick the date and time.'
                  )}
                </p>
              </>
            )}
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
              defaultLocation={fromCoords}
              onChange={(coords, address) => {
                setField('fromCoords', coords);
                if (address) setField('from', address);
              }}
            />
          )}
          {openMap === 'pickup' && (
            <MapPicker
              defaultLocation={pickupCoords ?? fromCoords}
              onChange={(coords, address) => {
                // KOORDINATA ham saqlanadi (17.09.2026 dan backend uni
                // qabul qiladi) — yo'lovchi matnni qayta geokodlamaydi,
                // xaritada AYNAN shu nuqtani ko'radi.
                setField('pickupCoords', coords);
                /*
                 * 🔴 TESKARI GEOKOD JAVOB BERMASLIGI MUMKIN (jonli
                 * sinovda uchradi: Nominatim bo'sh qaytardi). O'shanda
                 * maydon BO'SH qolardi, forma esa yig'ilish joyini
                 * majburiy deb biladi — ya'ni haydovchi xaritada nuqta
                 * qo'yib turib «Keyingi» tugmasini bosa olmasdi.
                 * Endi zaxira matn yoziladi: nuqta bor, uni tahrirlash
                 * ham mumkin.
                 */
                setField(
                  'pickupPoint',
                  address ||
                    tr(
                      `Xaritadagi nuqta (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`,
                      `Точка на карте (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`,
                      `Point on the map (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`
                    )
                );
              }}
            />
          )}
          {openMap === 'to' && (
            <MapPicker
              defaultLocation={toCoords}
              onChange={(coords, address) => {
                setField('toCoords', coords);
                if (address) setField('to', address);
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
