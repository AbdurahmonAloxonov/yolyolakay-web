'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { Package, Search, Wrench, X } from 'lucide-react';
import { useUIStore } from '@/shared/model/uiStore';
import {
  useMyParcels,
  useParcelResponses,
  useParcelSearch,
} from '@/entities/parcel/api/useParcels';
import type { Parcel } from '@/shared/api/types/parcel';
import {
  pickupParcel,
  deliverParcel,
  confirmParcelDelivery,
  isParcelPickedUp,
  cancelParcel,
  decideParcelResponse,
  respondToParcel,
} from '@/shared/api/parcels';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ParcelsMap } from '@/shared/ui/ParcelsMap';
import { RoutePreview } from '@/shared/ui/RoutePreview';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { CityAutocomplete } from '@/shared/ui/CityAutocomplete';
import { forwardGeocode } from '@/shared/lib/geo';
import { nearestCityName } from '@/shared/data/uzCities';
import { SendParcelSheet } from '@/features/parcels/SendParcelSheet';
import { toast } from 'sonner';
import {
  formatCurrency,
  formatTripDateTime,
  parcelStatusLabel,
  personName,
} from '@/shared/lib/format';
import { useTr } from '@/shared/lib/useTr';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useConfirm } from '@/shared/ui/useConfirm';

/**
 * Posilkalar bo'limi (CEO 2026-07-30).
 *
 * Talab: "должно работать как в поиске поездок, но там должно быть проще" —
 * tavsiyalar YO'Q, filtr faqat narx va shahar bo'yicha. Haydovchi tomonida
 * safarlardagi bilan bir xil tartib: ro'yxat -> tanlash -> detal + otkliklar.
 *
 * ✅ 2026-07-31 (kech): endpointlar gateway'da paydo bo'ldi va Swagger'da
 * tasdiqlandi (`/parcels/my`, `/{id}`, `/{id}/responses`, `/{id}/respond`,
 * `/{id}/cancel`, `responses/{id}/accept|reject`).
 *
 * ✅ 2026-08-07: `role` (haydovchi o'z posilkalarini ko'radi) va `from_address`/
 * `to_address` (manzil MATNI saqlanadi) qo'shildi. Accept/reject yo'li ham
 * o'zgardi: `/parcels/{id}/responses/{response_id}/accept`.
 *
 * ⚠️ Qolgan cheklov: qidiruvda `lat`/`lon` hamon majburiy (`radius` metrda), shahar
 * geokoder orqali nuqtaga aylantiriladi (`runSearch`). Swagger'da `city` parametri
 * paydo bo'ldi, lekin u `lat`/`lon` ni ALMASHTIRMAYDI — ikkalasi ham majburiyligicha
 * qolgan, shuning uchun geokoder qadami saqlanadi.
 *
 * UCHTA holat ATAYIN ajratilgan (2026-08-07 da tuzatilgan):
 *   `notReady` — endpoint backendda YO'Q (aniq 404). "Bo'lim tayyorlanmoqda".
 *   `failed`   — o'tkinchi nosozlik (tarmoq, 502, 401). "Yuklab bo'lmadi" + qayta urinish.
 *   bo'sh ro'yxat — haqiqatan posilka yo'q.
 * Ilgari birinchi ikkisi BITTA bayroq edi: har qanday uzilish "server hali
 * ulanmagan" deb ko'rsatilardi, ya'ni odamga yolg'on aytilardi (endpointlar bor).
 *
 * "Posilka topilmadi" va "bo'lim ishlamayapti" ATAYIN farqlanadi — birinchisi
 * backend tayyor bo'lgandagina chiqadi, aks holda foydalanuvchi bo'limni bo'sh
 * deb o'ylab ketardi.
 */
export default function ParcelsPage() {
  const locale = useLocale();
  const t = useTr();
  // Qaytarib bo'lmaydigan amallar uchun ilovaning O'Z tasdiq oynasi.
  const { confirm, confirmDialog } = useConfirm();
  const { activeRole } = useUIStore();
  const queryClient = useQueryClient();
  const isDriver = activeRole === 'driver';
  const [sendOpen, setSendOpen] = useState(false);

  /**
   * Posilka nuqtasi nomi. ✅ 2026-08-07 dan backend `from_address`/`to_address` ni
   * SAQLAYDI, ya'ni odam kiritgan matn ko'rinadi. Koordinatadan shahar topish
   * zaxira bo'lib qoladi — bu sanadan OLDIN yaratilgan posilkalarda matn yo'q.
   */
  const placeName = (address?: string | null, lat?: number | null, lon?: number | null) =>
    (address && address.trim()) || nearestCityName(lat, lon) || '—';

  // Filtrlar — CEO: faqat shahar va narx (safar qidiruvidan soddaroq).
  const [city, setCity] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Backend posilkalarni FAQAT nuqta + radius bo'yicha qidiradi (lat/lon majburiy,
  // radius metrda) — shahar nomini tushunmaydi. Shuning uchun shahar geokoder
  // orqali koordinataga aylantiriladi va shundan keyingina so'rov yuboriladi.
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // Shahar markazidan 40 km: "yo'nalishim bo'yicha yuk" uchun 5 km (backend
  // default) juda kichik — bitta tumandan nariga chiqmaydi.
  const SEARCH_RADIUS_M = 40_000;

  const searchParams = {
    lat: coords?.[0] ?? 0,
    lon: coords?.[1] ?? 0,
    radius: SEARCH_RADIUS_M,
    ...(priceMin ? { price_min: Number(priceMin) } : {}),
    ...(priceMax ? { price_max: Number(priceMax) } : {}),
  };

  const runSearch = async () => {
    const q = city.trim();
    if (!q) {
      toast.error(t('Avval shaharni tanlang', 'Сначала выберите город', 'Choose a city first'));
      return;
    }
    setGeocoding(true);
    try {
      const found = await forwardGeocode(q);
      if (!found) {
        toast.error(t('Shahar topilmadi', 'Город не найден', 'City not found'));
        return;
      }
      setCoords(found);
      setSubmitted(true);
    } finally {
      setGeocoding(false);
    }
  };

  // Haydovchi — yo'lidagi posilkalarni QIDIRADI; jo'natuvchi — o'zinikini ko'radi.
  // ✅ 2026-08-07: `/parcels/my?role=driver` paydo bo'ldi, shuning uchun haydovchi
  // O'ZI OLIB KETAYOTGAN posilkalarni ham ko'radi. Ilgari bunday ro'yxat yo'q edi
  // va taklifi qabul qilingan posilka haydovchi ekranidan butunlay yo'qolardi —
  // u nima olib ketayotganini eslab qolishi kerak edi.
  const search = useParcelSearch(searchParams, isDriver && submitted && !!coords);
  const mine = useMyParcels(!isDriver, 'sender');
  const carrying = useMyParcels(isDriver, 'driver');

  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * 🔴 Haydovchida ikki xil posilka BITTA ro'yxatga qo'shib yuborilardi:
   * o'zi olib ketayotganlari va endi topilganlari. Kartochkalar bir xil
   * ko'rinardi va haydovchi qaysi biri allaqachon uniki ekanini faqat
   * ochib ko'rgandan keyin bilardi. Ilovada bu ikkisi alohida yorliqda —
   * saytda ham ajratamiz (bu yerda joy ko'p, shuning uchun ikki guruh).
   */
  const carryingList: Parcel[] = isDriver ? carrying.data : [];
  const foundList: Parcel[] = isDriver
    ? submitted
      ? search.data.filter((p) => !carryingList.some((c) => c.id === p.id))
      : []
    : mine.data;
  const list: Parcel[] = [...carryingList, ...foundList];
  const selected = list.find((p) => p.id === selectedId) ?? list[0] ?? null;
  const responses = useParcelResponses(selected?.id ?? null);

  const notReady = isDriver ? submitted && search.notReady : mine.notReady;
  // O'tkinchi nosozlik (tarmoq / 502 / 401) — "bo'lim tayyorlanmoqda" DAN alohida.
  // Ilgari ikkalasi bitta bayroq edi va vaqtinchalik uzilish ham "server hali
  // ulanmagan" deb ko'rsatilardi (yolg'on: endpointlar backendda bor).
  const failed = isDriver ? submitted && search.failed : mine.failed;
  const isLoading = isDriver ? submitted && search.isLoading : mine.isLoading;
  const retry = () => (isDriver ? search.refetch() : mine.refetch());

  // Haydovchi taklifini qabul qilish / rad etish. `decidingId` — qaysi tugmada
  // spinner aylanishi kerakligini bildiradi (ro'yxatda bir nechta taklif bo'ladi).
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'accept' | 'reject' }) =>
      // Gateway 2026-08-07 dan POSILKA ID'sini ham talab qiladi.
      decideParcelResponse(String(selected?.id), id, decision),
    onSuccess: (_data, { decision }) => {
      toast.success(
        decision === 'accept'
          ? t('Taklif qabul qilindi', 'Предложение принято', 'Offer accepted')
          : t('Taklif rad etildi', 'Предложение отклонено', 'Offer declined')
      );
      // Ikkalasi ham yangilanadi: otkliklar ro'yxati VA posilka holati
      // (qabul qilinganda posilka "haydovchi topildi" holatiga o'tadi).
      queryClient.invalidateQueries({ queryKey: ['parcel-responses'] });
      queryClient.invalidateQueries({ queryKey: ['parcels-my'] });
    },
    onError: () => {
      toast.error(
        t(
          "Amalni bajarib bo'lmadi. Qayta urinib ko'ring.",
          'Не удалось выполнить. Попробуйте ещё раз.',
          'The action failed. Please try again.'
        )
      );
    },
    onSettled: () => setDecidingId(null),
  });

  const decide = (id: string, decision: 'accept' | 'reject') => {
    setDecidingId(`${id}:${decision}`);
    decideMutation.mutate({ id, decision });
  };

  /**
   * Posilkani bekor qilish (jo'natuvchi).
   *
   * `cancelParcel` API funksiyasi ANCHADAN BERI bor edi, lekin hech qayerdan
   * chaqirilmasdi: e'lon joylangach uni qaytarib bo'lmasdi. Yanglish narx yoki
   * noto'g'ri shahar bilan joylangan posilka bazada qolib, haydovchilar
   * qidiruvida ko'rinib turaverardi. Mobil ilovaga 2026-08-12 da qo'shildi,
   * bu — o'sha ishning veb yarmi.
   */
  /**
   * Haydovchi amallari — "Oldim" va "Yetkazdim".
   *
   * ✅ Backend 2026-08-16 kechqurun qo'shdi (biz so'ragan edik). Ungacha
   * posilka `accepted` da ABADIY qolardi: jo'natuvchi yetkazilganini
   * bilmasdi, ro'yxat tozalanmasdi, baholash ham ishga tushmasdi.
   */
  const carryMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pickup' | 'deliver' }) =>
      action === 'pickup' ? pickupParcel(id) : deliverParcel(id),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === 'pickup'
          ? t('Posilka olindi', 'Посылка забрана', 'Parcel picked up')
          : t('Posilka yetkazildi', 'Посылка доставлена', 'Parcel delivered')
      );
      queryClient.invalidateQueries({ queryKey: ['parcels-my'] });
    },
    onError: () => {
      toast.error(
        t(
          "Bajarib bo'lmadi. Qayta urinib ko'ring.",
          'Не удалось. Попробуйте ещё раз.',
          'Could not complete. Please try again.'
        )
      );
    },
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: (id: string) => confirmParcelDelivery(id),
    onSuccess: () => {
      toast.success(t('Posilka yopildi', 'Посылка закрыта', 'Parcel closed'));
      queryClient.invalidateQueries({ queryKey: ['parcels-my'] });
    },
    onError: () => {
      toast.error(
        t(
          "Tasdiqlab bo'lmadi. Qayta urinib ko'ring.",
          'Не удалось подтвердить. Попробуйте ещё раз.',
          'Could not confirm. Please try again.'
        )
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelParcel(id),
    onSuccess: () => {
      toast.success(t('Posilka bekor qilindi', 'Посылка отменена', 'Parcel cancelled'));
      queryClient.invalidateQueries({ queryKey: ['parcels-my'] });
    },
    onError: () => {
      toast.error(
        t(
          "Bekor qilib bo'lmadi. Qayta urinib ko'ring.",
          'Не удалось отменить. Попробуйте ещё раз.',
          'Could not cancel. Please try again.'
        )
      );
    },
  });

  /**
   * Haydovchi taklifi.
   *
   * 🔴 2026-08-13 gacha saytda bu tugma UMUMAN YO'Q edi: haydovchi posilkani
   * qidirib topardi, kartochkasini ochardi — va hech narsa qila olmasdi.
   * `respondToParcel` API funksiyasi yozilgan, lekin hech qayerdan
   * chaqirilmagan edi. Ya'ni saytdagi haydovchi uchun posilka bo'limi
   * boshi berk ko'cha edi.
   *
   * Narx maydoni jo'natuvchi aytgan narx bilan to'ldiriladi: ko'pincha
   * haydovchi shunga rozi bo'ladi va hech narsa yozmasdan yuboradi.
   */
  const [offerPrice, setOfferPrice] = useState('');
  const offerMutation = useMutation({
    mutationFn: (price: number) => respondToParcel(String(selected?.id), price),
    onSuccess: () => {
      toast.success(
        t(
          "Taklif yuborildi — jo'natuvchining javobini kuting",
          'Предложение отправлено — ждите ответа отправителя',
          'Offer sent — wait for the sender to reply'
        )
      );
      setOfferPrice('');
      queryClient.invalidateQueries({ queryKey: ['parcel-responses'] });
    },
    onError: () => {
      toast.error(
        t(
          "Taklif yuborilmadi. Qayta urinib ko'ring.",
          'Предложение не отправлено. Попробуйте ещё раз.',
          'The offer was not sent. Please try again.'
        )
      );
    },
  });

  /** Taklif berish mumkinmi: posilka hali kutayotgan va haydovchi biriktirilmagan. */
  const canOffer = (() => {
    if (!selected || !isDriver) return false;
    if (selected.driver_id) return false;
    const status = String(selected.status ?? 'pending').toLowerCase();
    return status === 'pending';
  })();

  /**
   * Bekor qilingan yoki yetkazilgan posilkani qayta bekor qilib bo'lmaydi —
   * backend 400/403 berardi va odam sababini tushunmasdi.
   */
  const canCancel = (() => {
    if (!selected || isDriver) return false;
    const status = String(selected.status ?? 'pending').toLowerCase();
    return status !== 'cancelled' && status !== 'canceled' && status !== 'delivered';
  })();

  const activeFilters = [
    ...(city ? [{ k: 'city', label: city, clear: () => setCity('') }] : []),
    ...(priceMin ? [{ k: 'min', label: `≥ ${priceMin}`, clear: () => setPriceMin('') }] : []),
    ...(priceMax ? [{ k: 'max', label: `≤ ${priceMax}`, clear: () => setPriceMax('') }] : []),
  ];

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {t('Posilkalar', 'Посылки', 'Parcels')}
          </h1>
          <p className="text-sm text-text-muted">
            {isDriver
              ? t(
                  "Yo'lingizda olib ketish mumkin bo'lgan yuklar",
                  'Грузы, которые можно взять по пути',
                  'Parcels you can take along your route'
                )
              : t(
                  'Yuboradigan yuklaringiz va haydovchi takliflari',
                  'Ваши отправления и предложения водителей',
                  'Your shipments and driver offers'
                )}
          </p>
        </div>

        {/* Backend tayyor emasligi ANIQ aytiladi — "bo'sh ro'yxat" sifatida yashirilmaydi. */}
        {notReady && (
          <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-5">
            <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
            <div className="space-y-1">
              <h2 className="font-bold text-text">
                {t("Bo'lim tayyorlanmoqda", 'Раздел готовится', 'Section in progress')}
              </h2>
              <p className="text-sm text-text-muted">
                {t(
                  "Posilkalar serveri hali ulanmagan. Interfeys tayyor — server tayyor bo'lishi bilan bu bo'lim avtomatik ishlaydi.",
                  'Сервер посылок ещё не подключён. Интерфейс готов — раздел заработает автоматически, как только сервер будет готов.',
                  'The parcels server is not connected yet. The interface is ready — this section will start working as soon as the server is live.'
                )}
              </p>
            </div>
          </div>
        )}

        {/* O'tkinchi nosozlik — "hali yozilmagan" EMAS, shunchaki hozir yuklanmadi.
            Qayta urinish tugmasi bor: backend uy mashinasida va 502 bo'lib turadi. */}
        {failed && !notReady && (
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5">
            <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" aria-hidden />
            <div className="space-y-2">
              <h2 className="font-bold text-text">
                {t("Yuklab bo'lmadi", 'Не удалось загрузить', 'Could not load')}
              </h2>
              <p className="text-sm text-text-muted">
                {t(
                  "Aloqa uzildi yoki server javob bermadi. Qayta urinib ko'ring.",
                  'Связь прервалась или сервер не ответил. Попробуйте ещё раз.',
                  'The connection dropped or the server did not respond. Please try again.'
                )}
              </p>
              <button
                onClick={retry}
                className="rounded-xl border border-border bg-bg px-4 py-2 text-sm font-bold text-text transition-colors hover:border-accent hover:text-accent"
              >
                {t('Qayta urinish', 'Повторить', 'Try again')}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,360px)_1fr] lg:items-start">
          {/* CHAP: filtrlar (haydovchi qidiradi) yoki qisqacha izoh */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-md">
              {isDriver ? (
                <>
                  <CityAutocomplete
                    label={t('Shahar', 'Город', 'City')}
                    placeholder={t('Masalan, Toshkent', 'Напр. Ташкент', 'e.g. Tashkent')}
                    value={city}
                    onChange={setCity}
                    onSelect={(name) => setCity(name)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label={t('Narx: dan', 'Цена: от', 'Price: from')}
                      type="number"
                      inputMode="numeric"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="0"
                    />
                    <Input
                      label={t('gacha', 'до', 'to')}
                      type="number"
                      inputMode="numeric"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="100000"
                    />
                  </div>
                  <Button
                    onClick={runSearch}
                    isLoading={geocoding}
                    disabled={notReady}
                    className="h-12 w-full rounded-2xl"
                  >
                    <Search className="mr-1.5 h-5 w-5" />
                    {t('Qidirish', 'Найти', 'Search')}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-text-muted">
                    {t(
                      "Bu yerda siz yuborgan posilkalar va ularga kelgan haydovchi takliflari ko'rinadi.",
                      'Здесь отображаются отправленные вами посылки и предложения водителей по ним.',
                      'Here you will see the parcels you sent and the offers drivers made for them.'
                    )}
                  </p>
                  {/* 🔴 Ilgari bu ekran BOSHI BERK edi: `POST /parcels` yozilgan, lekin
                      uni chaqiradigan forma yo'q — foydalanuvchi posilka yubora olmasdi. */}
                  <Button
                    onClick={() => setSendOpen(true)}
                    disabled={notReady}
                    className="h-12 w-full rounded-2xl"
                  >
                    <Package className="mr-1.5 h-5 w-5" />
                    {t('Posilka yuborish', 'Отправить посылку', 'Send a parcel')}
                  </Button>
                </>
              )}
            </div>
          </aside>

          {/* O'NG: ro'yxat -> tanlangan posilka detali -> otkliklar */}
          <section className="space-y-4">
            {/* Tanlangan filtrlar — qidiruv sahifasidagi kabi natijalar USTIDA
                (CEO 2026-08-04): chap panelning tagida ular ko'zga tashlanmasdi. */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {activeFilters.map((f) => (
                  <span
                    key={f.k}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-brand-pink-light dark:bg-accent/10 px-3 py-2 text-xs font-bold text-accent"
                  >
                    {f.label}
                    <button
                      type="button"
                      onClick={f.clear}
                      aria-label={t('Olib tashlash', 'Убрать', 'Remove')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {isLoading ? (
              /* Kartochka shaklidagi skelet — matnli kutish o'rniga
                 (sabab: `history` va qidiruv sahifalaridagi bilan bir xil). */
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-border bg-surface p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                ))}
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                className="mo-in rounded-2xl border border-border bg-surface/50"
                icon={<Package />}
                title={
                  isDriver
                    ? t('Yuk topilmadi', 'Груз не найден', 'No parcels found')
                    : t("Posilka yo'q", 'Посылок нет', 'No parcels')
                }
                description={
                  notReady
                    ? t(
                        "Server ulangach posilkalar shu yerda ko'rinadi.",
                        'Посылки появятся здесь после подключения сервера.',
                        'Parcels will appear here once the server is connected.'
                      )
                    : isDriver
                      ? submitted
                        ? t(
                            "Bu shartlar bo'yicha posilka topilmadi.",
                            'По этим условиям посылок не найдено.',
                            'No parcels match these conditions.'
                          )
                        : t(
                            "Yo'nalishingizni tanlab, qidiruvni boshlang.",
                            'Укажите направление и запустите поиск.',
                            'Choose your route and start the search.'
                          )
                      : t(
                          'Hozircha posilka yubormagansiz.',
                          'Вы пока не отправляли посылок.',
                          'You have not sent any parcels yet.'
                        )
                }
                action={
                  !isDriver && !notReady ? (
                    <Button onClick={() => setSendOpen(true)}>
                      {t('Posilka yuborish', 'Отправить посылку', 'Send a parcel')}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="mo-in space-y-4">
                {/*
                  POSILKALAR XARITADA — 16.09.2026.

                  🔴 Ro'yxat haydovchining ASOSIY savoliga javob bermasdi:
                  «bu posilka mening yo'limga tushadimi?». Ro'yxatda
                  "Chortoq → Namangan" degan ikki nom turadi, ular yo'l
                  ustidami yoki chekkadami — bilinmaydi. Qidiruv radiusi
                  ham ko'r edi: 40 km qayergacha yetishini odam tasavvur
                  qilishi kerak edi.

                  Xarita FAQAT haydovchi qidiruvida ko'rsatiladi: o'z
                  posilkalari ro'yxatida (jo'natuvchi) har biri alohida
                  yo'nalish va ularni bitta xaritaga yig'ish chalkash
                  bo'lardi — u yerda tanlangan posilkaning YO'LI ko'rinadi.
                */}
                {isDriver && coords && list.some((p) => p.origin_lat || p.origin_lon) && (
                  <ParcelsMap
                    center={coords}
                    radiusMeters={SEARCH_RADIUS_M}
                    selectedId={selected?.id ?? null}
                    onSelect={setSelectedId}
                    points={list
                      .filter((p) => p.origin_lat || p.origin_lon)
                      .map((p) => ({
                        id: p.id,
                        lat: p.origin_lat,
                        lon: p.origin_lon,
                        label: p.price ? formatCurrency(p.price, locale) : '—',
                        taken: Boolean(p.driver_id),
                      }))}
                  />
                )}

                {[
                  {
                    key: 'carrying',
                    title: t('Olib ketayotganlarim', 'Я везу', 'I am carrying'),
                    items: carryingList,
                  },
                  {
                    key: 'found',
                    title: isDriver
                      ? t('Topilgan yuklar', 'Найденные грузы', 'Found parcels')
                      : t('Posilkalarim', 'Мои посылки', 'My parcels'),
                    items: foundList,
                  },
                ]
                  .filter((group) => group.items.length > 0)
                  .map((group) => (
                    <div key={group.key} className="space-y-2">
                      {/* Sarlavha faqat IKKALA guruh ham bo'lganda kerak:
                          bittasi bo'lsa u ortiqcha shovqin. */}
                      {carryingList.length > 0 && foundList.length > 0 && (
                        <h3 className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                          {group.title}
                        </h3>
                      )}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {group.items.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedId(p.id)}
                            aria-pressed={p.id === selected?.id}
                            className={`rounded-xl border p-3 text-left transition-colors ${
                              p.id === selected?.id
                                ? 'border-turquoise bg-turquoise-light/40 dark:bg-turquoise/10'
                                : 'border-border bg-surface hover:border-accent'
                            }`}
                          >
                            <span className="block truncate text-sm font-bold text-foreground">
                              {placeName(p.from_address, p.origin_lat, p.origin_lon)} →{' '}
                              {placeName(p.to_address, p.destination_lat, p.destination_lon)}
                            </span>
                            <span className="mt-1 block text-[11px] font-bold text-text-muted">
                              {p.price ? formatCurrency(p.price, locale) : '—'} ·{' '}
                              {parcelStatusLabel(String(p.status ?? ''), locale)}
                            </span>
                            {/* 🔴 "N ta taklif" — jo'natuvchining eng eski
                                shikoyati: taklif kelganini bilishning yagona
                                yo'li har posilkani ochib ko'rish edi.
                                Backend `responses_count` ni 2026-08-16 da
                                qo'shdi. Nol bo'lsa chizilmaydi. */}
                            {(p.responses_count ?? 0) > 0 && (
                              <span className="mt-1 inline-block rounded-full bg-brand-pink-light dark:bg-accent/10 px-2 py-0.5 text-[10px] font-extrabold text-accent">
                                {t(
                                  `${p.responses_count} ta taklif`,
                                  `Предложений: ${p.responses_count}`,
                                  `${p.responses_count} offers`
                                )}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                {selected && (
                  <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-extrabold text-foreground">
                          {placeName(
                            selected.from_address,
                            selected.origin_lat,
                            selected.origin_lon
                          )}{' '}
                          →{' '}
                          {placeName(
                            selected.to_address,
                            selected.destination_lat,
                            selected.destination_lon
                          )}
                        </h3>
                        <p className="mt-1 text-xs font-bold text-text-muted">
                          {formatTripDateTime(selected.deliver_by) || '—'} ·{' '}
                          {parcelStatusLabel(String(selected.status ?? ''), locale)}
                        </p>
                      </div>
                      <span className="text-lg font-extrabold text-accent">
                        {selected.price ? formatCurrency(selected.price, locale) : '—'}
                      </span>
                    </div>

                    {selected.description && (
                      <p className="text-sm text-text-muted">{selected.description}</p>
                    )}

                    {/*
                      POSILKANING YO'LI — 16.09.2026.

                      🔴 Tanlangan posilka haqida faqat IKKI NOM va holat
                      so'zi ko'rinardi ("Chortoq → Namangan · qabul
                      qilindi"). Koordinatalar backendda SAQLANGAN va nuqta
                      xaritadan tanlangan bo'lishi mumkin («metro yonida»)
                      — ya'ni nom aslida to'liq manzil emas va uni
                      tekshirib bo'lmasdi.
                    */}
                    <RoutePreview
                      from={[selected.origin_lat, selected.origin_lon]}
                      to={[selected.destination_lat, selected.destination_lon]}
                      height={180}
                    />

                    {/* Otkliklar — safar arizalari bilan bir xil joyda: PASTDA */}
                    <div className="border-t border-border/60 pt-4">
                      <h4 className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                        {isDriver
                          ? // 🔴 Backend posilkada jo'natuvchi ISMINI bermaydi
                            // (faqat sender_id) — sarlavha "Jo'natuvchi" bo'lib,
                            // ostida doim "—" turardi. Ism kelmasa sarlavhani
                            // ham ko'rsatmaymiz: bo'sh maydon savol tug'diradi.
                            personName(selected.sender)
                            ? t("Jo'natuvchi", 'Отправитель', 'Sender')
                            : t('Taklif berish', 'Предложить цену', 'Make an offer')
                          : t('Haydovchi takliflari', 'Предложения водителей', 'Driver offers')}
                      </h4>

                      {isDriver ? (
                        <>
                          {personName(selected.sender) && (
                            <p className="mt-2 text-sm font-bold text-text">
                              {personName(selected.sender)}
                            </p>
                          )}
                          {canOffer ? (
                            <form
                              className="mt-4 flex flex-wrap items-end gap-3"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const value = Number(offerPrice || selected.price || 0);
                                if (!value || value <= 0) {
                                  toast.error(
                                    t('Narxni kiriting', 'Введите цену', 'Enter a price')
                                  );
                                  return;
                                }
                                offerMutation.mutate(value);
                              }}
                            >
                              <div className="min-w-[10rem] flex-1">
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  label={t(
                                    'Qancha narxga olib ketasiz?',
                                    'За сколько повезёте?',
                                    'What is your price?'
                                  )}
                                  placeholder={String(selected.price ?? '')}
                                  value={offerPrice}
                                  onChange={(e) => setOfferPrice(e.target.value)}
                                />
                              </div>
                              <Button
                                type="submit"
                                isLoading={offerMutation.isPending}
                                disabled={offerMutation.isPending}
                              >
                                {t('Taklif berish', 'Предложить', 'Make an offer')}
                              </Button>
                            </form>
                          ) : (
                            <p className="mt-3 text-xs text-text-muted">
                              {carryingList.some((c) => c.id === selected.id)
                                ? t(
                                    'Bu posilkani siz olib ketyapsiz.',
                                    'Эту посылку везёте вы.',
                                    'You are carrying this parcel.'
                                  )
                                : selected.driver_id
                                  ? t(
                                      'Bu posilkaga haydovchi biriktirilgan.',
                                      'Для этой посылки уже назначен водитель.',
                                      'A driver is already assigned to this parcel.'
                                    )
                                  : t(
                                      "Bu posilkaga hozir taklif berib bo'lmaydi.",
                                      'Сейчас предложить по этой посылке нельзя.',
                                      'You cannot make an offer on this parcel right now.'
                                    )}
                            </p>
                          )}
                        </>
                      ) : responses.data.length === 0 ? (
                        <p className="mt-2 text-xs text-text-muted">
                          {t("Hali taklif yo'q.", 'Предложений пока нет.', 'No offers yet.')}
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {responses.data.map((r) => (
                            <li
                              key={r.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg/50 p-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-text">
                                  {personName(r.driver) || '—'}
                                </p>
                                <p className="text-xs text-text-muted">
                                  {r.offered_price ? formatCurrency(r.offered_price, locale) : '—'}
                                </p>
                              </div>
                              {/* ✅ 2026-08-06: `POST /parcels/responses/{id}/accept|reject`
                                  jonli swagger'da tasdiqlandi va ulandi. Ilgari bu
                                  tugmalar O'CHIQ turardi — jo'natuvchi taklifni ko'rardi-yu,
                                  qabul qila olmasdi, ya'ni posilka bo'limi oxirigacha
                                  bormasdi.

                                  🔴 TUGMALAR POSILKA HOLATIGA QARAB CHIZILADI, taklif
                                  holatiga EMAS: backend taklif qabul qilingandan keyin
                                  ham uning `status` ini `pending` da qoldiradi
                                  (o'lchandi 2026-09-04). Ya'ni posilka allaqachon
                                  haydovchining qo'lida ketayotgan bo'lsa ham,
                                  jo'natuvchida «Qabul / Rad etish» turaverardi va
                                  bosilganda 400 qaytardi. Haydovchi biriktirilgan
                                  bo'lsa — hal bo'lgan. */}
                              <div className={`flex gap-2 ${selected?.driver_id ? 'hidden' : ''}`}>
                                <Button
                                  variant="primary"
                                  className="px-4 py-2 text-xs"
                                  isLoading={
                                    decideMutation.isPending && decidingId === `${r.id}:accept`
                                  }
                                  disabled={decideMutation.isPending}
                                  onClick={() => decide(r.id, 'accept')}
                                >
                                  {t('Qabul', 'Принять', 'Accept')}
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="px-4 py-2 text-xs"
                                  isLoading={
                                    decideMutation.isPending && decidingId === `${r.id}:reject`
                                  }
                                  disabled={decideMutation.isPending}
                                  onClick={() => decide(r.id, 'reject')}
                                >
                                  {t('Rad etish', 'Отклонить', 'Decline')}
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Haydovchi amallari: faqat MEN olib ketayotgan posilkada. */}
                    {isDriver &&
                      carryingList.some((c) => c.id === selected.id) &&
                      !['delivered', 'cancelled', 'canceled'].includes(
                        String(selected.status ?? '').toLowerCase()
                      ) && (
                        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                          {/* 🔴 HOLAT NOMI: backend `picked_up` beradi, bu
                              yerda esa `in_transit` kutilardi (o'lchandi
                              2026-09-04). Ya'ni «Yetkazdim» tugmasi HECH
                              QACHON chiqmasdi va posilka oxirgi qadamda
                              qotib qolardi. Tekshiruv `isParcelPickedUp`
                              da — ikkala nom ham qabul qilinadi. */}
                          {!isParcelPickedUp(selected.status) && (
                            <Button
                              variant="secondary"
                              className="flex-1 min-w-[140px]"
                              isLoading={carryMutation.isPending}
                              disabled={carryMutation.isPending}
                              onClick={() =>
                                carryMutation.mutate({
                                  id: String(selected.id),
                                  action: 'pickup',
                                })
                              }
                            >
                              {t('Oldim', 'Забрал', 'Picked up')}
                            </Button>
                          )}
                          {isParcelPickedUp(selected.status) && (
                            <Button
                              className="flex-1 min-w-[140px]"
                              isLoading={carryMutation.isPending}
                              disabled={carryMutation.isPending}
                              onClick={() =>
                                carryMutation.mutate({
                                  id: String(selected.id),
                                  action: 'deliver',
                                })
                              }
                            >
                              {t('Yetkazdim', 'Доставил', 'Delivered')}
                            </Button>
                          )}
                        </div>
                      )}

                    {/*
                      JO'NATUVCHI o'zi yopadi.

                      🔴 Nega kerak: yopish tugmasi faqat haydovchida edi.
                      Haydovchi posilkani berib tugmani bosmasa, posilka
                      `picked_up` da abadiy qolardi — jo'natuvchi esa
                      qarab turishdan boshqa hech narsa qila olmasdi.
                      Backenddan so'ralgan va 04.09 da qo'shilgan
                      (`confirm-delivery`, o'lchandi).
                    */}
                    {!isDriver && isParcelPickedUp(selected.status) && (
                      <div className="border-t border-border/60 pt-4">
                        <Button
                          className="w-full"
                          isLoading={confirmDeliveryMutation.isPending}
                          disabled={confirmDeliveryMutation.isPending}
                          onClick={async () => {
                            const ok = await confirm({
                              title: t(
                                'Posilka yetkazildimi?',
                                'Посылка доставлена?',
                                'Has the parcel been delivered?'
                              ),
                              description: t(
                                "Tasdiqlasangiz posilka yopiladi. Buni qaytarib bo'lmaydi.",
                                'После подтверждения посылка будет закрыта. Отменить нельзя.',
                                'Confirming closes the parcel. This cannot be undone.'
                              ),
                              confirmLabel: t('Tasdiqlash', 'Подтвердить', 'Confirm'),
                            });
                            if (ok) confirmDeliveryMutation.mutate(String(selected.id));
                          }}
                        >
                          {t('Qabul qilib oldim', 'Я получил посылку', 'I received the parcel')}
                        </Button>
                        <p className="mt-2 text-xs text-text-muted">
                          {t(
                            "Haydovchi tugmani bosmagan bo'lsa ham posilkani o'zingiz yopishingiz mumkin.",
                            'Даже если водитель не нажал кнопку, вы можете закрыть посылку сами.',
                            'You can close the parcel yourself even if the driver did not.'
                          )}
                        </p>
                      </div>
                    )}

                    {canCancel && (
                      <div className="border-t border-border/60 pt-4">
                        <Button
                          variant="secondary"
                          className="px-4 py-2 text-xs !text-error"
                          isLoading={cancelMutation.isPending}
                          disabled={cancelMutation.isPending}
                          onClick={async () => {
                            // Qaytarib bo'lmaydigan amal — tasdiq so'raladi.
                            // Brauzer oynasi emas, ilovaning o'z oynasi
                            // (sabablari `useConfirm` izohida). Mobil ilovada
                            // ham tasdiq oynasi bor.
                            const ok = await confirm({
                              title: t(
                                "Posilka e'lonini bekor qilasizmi?",
                                'Отменить заявку на посылку?',
                                'Cancel this parcel?'
                              ),
                              description: t(
                                "Haydovchilar uni boshqa ko'rmaydi va kelgan takliflar bekor bo'ladi. Bu amalni qaytarib bo'lmaydi.",
                                'Водители её больше не увидят, а полученные предложения будут отменены. Действие необратимо.',
                                'Drivers will no longer see it and any offers will be cancelled. This cannot be undone.'
                              ),
                              confirmLabel: t(
                                'Posilkani bekor qilish',
                                'Отменить посылку',
                                'Cancel the parcel'
                              ),
                            });
                            if (ok) cancelMutation.mutate(String(selected.id));
                          }}
                        >
                          {t('Posilkani bekor qilish', 'Отменить посылку', 'Cancel parcel')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      <SendParcelSheet isOpen={sendOpen} onClose={() => setSendOpen(false)} />
      {confirmDialog}
    </div>
  );
}
