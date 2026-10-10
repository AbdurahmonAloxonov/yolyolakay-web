'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { userFacingError } from '@/shared/lib/format';
import { handleCheckout, subscribeTariff } from '@/shared/lib/checkout';
import { GirihPattern } from '@/shared/ui/brand/Ornament';
import { Button } from '@/shared/ui/Button';
import { PremiumCorner } from '@/shared/ui/brand/PremiumCorner';
import SpotlightCard from '@/shared/ui/reactbits/SpotlightCard';
import { Lock, Sparkles, Check, Car, Package, SlidersHorizontal } from 'lucide-react';
import { formatCurrency, formatQuota, isUnlimitedQuota } from '@/shared/lib/format';
import { bestValueType, perRidePrice, unlimitedBreakEven } from '@/shared/lib/planValue';
import { planHasPremiumFilters } from '@/entities/billing/api/useSubscription';
import { PlanFeatures } from '@/features/billing/PlanFeatures';
import { AnalyticsEvent, logEvent } from '@/shared/lib/analytics';
import { toast } from 'sonner';
import { usePlanQuotas } from '@/entities/billing/api/usePlans';
import { useCurrentPlan } from '@/entities/billing/api/useSubscription';
import { CurrentPlanCard } from '@/shared/ui/billing/CurrentPlanCard';
import { useUIStore } from '@/shared/model/uiStore';
import { useTr } from '@/shared/lib/useTr';

interface Tariff {
  id: string;
  name: string;
  price: number;
  trips: number | string;
  /**
   * Oylik bepul posilka paketi, FORMATLANGAN. Atayin `string` (`number` emas):
   * qator `{tariff.parcels && …}` bilan chiziladi va raqam bo'lsa `0` JSX'ga
   * "0" bo'lib sizib chiqardi. Posilkasiz paketda bo'sh satr.
   */
  parcels: string;
  /** "1 safar ≈ 1 500 so'm" — narx paketga bo'linadi. Cheksiz/bepulda yo'q. */
  perRide?: number | null;
  /** Cheksiz tarif uchun: nechta safardan keyin va qaysi tarifdan arzon. */
  breakEven?: { rides: number; planName: string } | null;
  /** Tafsilot oynasi uchun: shu tarifda premium filtrlar ochiqmi. */
  premiumFilters?: boolean;
  /** Tafsilot oynasi uchun: safar paketi cheksizmi. */
  unlimited?: boolean;
  popular: boolean;
  description?: string;
}

function TariffsContent() {
  const t = useTranslations('Tariffs');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const tr = useTr();
  // Rol — sarlavha matni uchun. Tarif SETKASI ikkala rolda bir xil (bitta
  // `GET /billing/plans`), farq faqat so'zlarda edi — shuning uchun ilgari
  // ikkita deyarli bir xil sahifa turardi (412 + 344 qator).
  const { activeRole } = useUIStore();
  const isPassenger = activeRole !== 'driver';
  const isPaywall = searchParams.get('paywall') === 'true';
  // Paket tugab tariflar MAJBURAN ochilgani — sotuv oqimidagi eng muhim
  // nuqta. Bir marta, sahifa ochilganda.
  const paywallLogged = React.useRef(false);
  React.useEffect(() => {
    if (!isPaywall || paywallLogged.current) return;
    paywallLogged.current = true;
    logEvent(AnalyticsEvent.paywallShown, { reason: 'quota_exceeded', from: 'web' });
  }, [isPaywall]);

  // Tarif setkasi endi JONLI manbadan: GET /billing/plans (hardcode o'chirildi —
  // haqiqiy narxlar: Plus 50k/50 safar, Pro 100k/cheksiz, Premium 150k/cheksiz).
  const {
    data: planRows = [],
    isLoading: plansLoading,
    isError: plansError,
    refetch: refetchPlans,
  } = usePlanQuotas();
  const dataTariffs = {
    tariffs: planRows
      .filter((p) => p.type !== 'trial')
      .map(
        (p): Tariff => ({
          id: p.type,
          name: p.name,
          price: p.price,
          trips: formatQuota(p.quota, locale),
          // Posilka kvotasi ilgari kartaga UMUMAN tushmasdi: `PlanQuota.parcels`
          // o'qilardi-yu, shu joyda tashlab ketilardi. Kartada esa uni faqat
          // backendning inglizcha `features` qatori ("2 free parcels") ko'rsatib
          // turardi — u ham `features` bu yerda uzatilmagani uchun hech qachon
          // chizilmasdi. Natijada sayt paketning yarmini yashirardi (mobil ilova
          // ikkalasini ham ko'rsatadi).
          // Bo'sh satr = paketda posilka yo'q → qator butunlay chizilmaydi
          // ("0 bepul pochta" deb yozish paketni yomonroq ko'rsatardi).
          parcels: p.parcels === 0 ? '' : formatQuota(p.parcels, locale),
          /*
           * 🔴 "MASHHUR" NISHONI ENDI HISOBLANADI (egasi, 2026-08-16:
           * "reklamani kuchliroq, bo'rttirib lekin TO'G'RISINI").
           *
           * Ilgari `p.type === 'premium'` deb QOTIRIB qo'yilgan edi —
           * ya'ni u hech qanday faktga tayanmasdi, shunchaki eng qimmatini
           * ko'rsatardi. Narxlar o'zgarsa yozuv yolg'onga aylanardi.
           *
           * Endi nishon bitta safar eng arzonga tushadigan tarifda va
           * setka o'zgarsa o'zi ko'chadi. Mobil ilovada ayni qoida.
           */
          popular: p.type === bestValueType(planRows),
          perRide: perRidePrice(p),
          breakEven: isUnlimitedQuota(p.quota) ? unlimitedBreakEven(planRows, p) : null,
          premiumFilters: planHasPremiumFilters(p.type),
          unlimited: isUnlimitedQuota(p.quota),
        })
      ),
    addons: [] as Tariff[],
  };

  const buyTariffMutation = useMutation({
    mutationFn: (tariffId: string) => {
      // To'lov oqimidagi uzilishni ko'rish uchun: nechtasi tarifni tanlaydi
      // va nechtasi to'lovni oxiriga yetkazadi.
      const chosen = dataTariffs.tariffs.find((x) => x.id === tariffId);
      logEvent(AnalyticsEvent.planPurchaseStarted, {
        plan: tariffId,
        price: chosen?.price ?? 0,
      });
      // `locale` — Click qaytaradigan manzil uchun (`return_url`).
      return subscribeTariff(tariffId, { locale });
    },
    onSuccess: (data: { checkout_url?: string; message?: string }) => {
      // Yangilangan obuna holati ['profile'] query ichida (useProfile) — shu yetadi.
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      // Mock rejimda backend to'lovni O'ZI o'tkazadi — o'lik checkout_url'ga
      // redirect qilinmaydi (tafsilot: shared/lib/checkout.ts).
      const redirected = handleCheckout(data, locale);
      if (!redirected) {
        if (isPaywall) {
          router.back();
        } else {
          router.push(`/${locale}/profile`);
        }
      }
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      const generic = tr('Xatolik yuz berdi', 'Произошла ошибка', 'Something went wrong');
      // `userFacingError` — ichki baza xatosi ekranga chiqmasin
      // (izohi `format.ts` da).
      toast.error(userFacingError(error.response?.data?.message, generic));
    },
  });

  const {
    mode: planMode,
    plan: activePlan,
    isError: planFailed,
    refetch: refetchPlan,
    isExpired: planExpired,
  } = useCurrentPlan();

  // CEO talabi 2026-07-30: eng qimmat tarifdagi foydalanuvchiga sotadigan narsa yo'q —
  // unga faqat tarif va balans ko'rsatiladi, setka umuman chizilmaydi.
  // 'upgrade' rejimida esa faqat JORIY tarifdan QIMMATROQLARI qoladi (pastga
  // "tushirish" taklifi ma'nosiz va chalg'ituvchi).
  const activePrice = activePlan?.price ?? -1;
  const tariffsList = dataTariffs.tariffs.filter((tariff) => {
    if (planMode === 'top') return false;
    if (planMode !== 'upgrade') return true;
    return tariff.price > activePrice;
  });
  const addonsList = dataTariffs.addons;

  // Setka nega bo'sh — buni AJRATISH shart edi. Ilgari uch xil holat (yuklanmoqda,
  // so'rov yiqildi, eng qimmat tarif) bir xil ko'rinardi: sahifada tariflar
  // BO'LIMI umuman chizilmasdi va haydovchi "tariflar yo'q" deb qolardi.
  const plansUnavailable = !plansLoading && !plansError && dataTariffs.tariffs.length === 0;

  return (
    <div className="flex-1 bg-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Obuna holati YUKLANMADI. Bu "tarifingiz yo'q" degani emas — usiz ekran
            joriy tarifni ko'rsatmay, hammasini sotuvga qo'yardi va odam ikkinchi
            marta to'lab yuborishi mumkin edi. */}
        {planFailed && (
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-sm">
            <p className="text-sm font-semibold text-text">
              {tr(
                "Joriy tarifingizni aniqlab bo'lmadi",
                'Не удалось определить ваш текущий тариф',
                "Couldn't check your current plan"
              )}
            </p>
            <p className="text-sm text-text-muted">
              {tr(
                "Quyidagi ro'yxat to'liq bo'lmasligi mumkin. To'lovdan oldin qayta urinib ko'ring — tarifingiz allaqachon faol bo'lishi mumkin.",
                'Список ниже может быть неполным. Перед оплатой попробуйте ещё раз — тариф может быть уже активен.',
                'The list below may be incomplete. Please retry before paying — your plan may already be active.'
              )}
            </p>
            <Button variant="secondary" onClick={() => refetchPlan()}>
              {tr('Qayta urinish', 'Повторить', 'Try again')}
            </Button>
          </div>
        )}

        {/* Пейвол баннер */}
        {isPaywall && (
          <div className="rounded-2xl bg-error/10 border border-error/20 p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-error/20 text-error border border-error/30">
              <Lock className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text">{t('paywallTitle')}</h3>
              <p className="text-sm text-text-muted">{t('paywallDesc')}</p>
            </div>
          </div>
        )}

        {/* Amaldagi tarif + balans + muddat — setkadan OLDIN, chunki foydalanuvchi
            avval "menda nima bor?" degan savolga javob izlaydi. */}
        <CurrentPlanCard />

        {/* Yuklanmoqda — setka o'rnida SHU O'LCHAMDAGI skeletonlar turadi,
            shuning uchun kartalar kelganda sahifa sakramaydi. */}
        {plansLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[340px] animate-pulse rounded-2xl border border-border bg-surface"
              />
            ))}
          </div>
        )}

        {/* So'rov yiqildi — sukut saqlash o'rniga sababi va qayta urinish tugmasi. */}
        {plansError && (
          <div className="space-y-3 rounded-2xl border border-error/20 bg-error/5 p-6 text-center">
            <p className="text-sm font-bold text-text">
              {tr(
                "Tariflarni yuklab bo'lmadi",
                'Не удалось загрузить тарифы',
                'Could not load the plans'
              )}
            </p>
            <p className="text-xs text-text-muted">
              {tr(
                "Internet aloqasini tekshirib, qayta urinib ko'ring.",
                'Проверьте соединение и попробуйте ещё раз.',
                'Check your connection and try again.'
              )}
            </p>
            <Button variant="secondary" onClick={() => refetchPlans()}>
              {tr('Qayta urinish', 'Повторить', 'Try again')}
            </Button>
          </div>
        )}

        {/* So'rov muvaffaqiyatli, lekin backend bo'sh ro'yxat qaytardi. */}
        {plansUnavailable && (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-text-muted">
            {tr(
              "Hozircha sotuvda tarif yo'q. Birozdan so'ng qayta kiring.",
              'Сейчас тарифы недоступны. Зайдите чуть позже.',
              'No plans are available right now. Please check back later.'
            )}
          </div>
        )}

        {tariffsList.length > 0 && (
          <div className="text-center space-y-2">
            {/*
              Muddati tugagan odamga "tanishib chiqing" deyish noto'g'ri: u
              allaqachon to'lagan, unga kerak bo'lgani — YANGILASH. Setka
              o'zi ham aynan shuning uchun qaytadi (izohi `useSubscription`da).
            */}
            <h1 className="text-3xl font-display font-black text-foreground tracking-tight sm:text-4xl">
              {planExpired
                ? tr('Tarifni yangilash', 'Продлить тариф', 'Renew your plan')
                : planMode === 'upgrade'
                  ? tr('Limitni oshirish', 'Повысить лимиты', 'Increase your limits')
                  : isPassenger
                    ? tr('Sayohatlar paketlari', 'Пакеты поездок', 'Ride packages')
                    : t('title')}
            </h1>
            <p className="text-text-muted max-w-md mx-auto text-sm">
              {planExpired
                ? tr(
                    "Obunangiz muddati tugadi. O'sha tarifni qayta tanlashingiz yoki boshqasiga o'tishingiz mumkin.",
                    'Срок подписки истёк. Можно продлить тот же тариф или выбрать другой.',
                    'Your subscription has expired. Renew the same plan or pick another one.'
                  )
                : planMode === 'upgrade'
                  ? tr(
                      "Joriy tarifingizdan kengroq imkoniyatlar — istalgan vaqtda o'tishingiz mumkin.",
                      'Больше возможностей, чем на текущем тарифе — перейти можно в любой момент.',
                      'More than your current plan offers — you can upgrade any time.'
                    )
                  : isPassenger
                    ? tr(
                        'Safarlarga chiqish uchun paket tanlang — istalgan vaqtda almashtirishingiz mumkin.',
                        'Выберите пакет для поездок — сменить можно в любой момент.',
                        'Pick a package for your rides — you can change it any time.'
                      )
                    : t('subtitle')}
            </p>
          </div>
        )}

        {/* Сетка тарифов — 'top' rejimida bo'sh bo'ladi va umuman chizilmaydi */}
        {/* `mo-stagger`: kartalar ketma-ket ochiladi (sof CSS, JS yo'q). Mobil'da
            ular ustma-ust joylashadi va bu ochilish sezilarli bo'ladi. */}
        <div
          className={`mo-stagger grid grid-cols-1 gap-6 ${tariffsList.length === 0 ? 'hidden' : ''} ${
            tariffsList.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 sm:max-w-2xl sm:mx-auto'
          }`}
        >
          {tariffsList.map((tariff, i) => {
            // Premium (popular) karta — Wine Ash fon + ikat + burchak bezak (spec 5).
            const isPremium = tariff.popular;
            return (
              // `SpotlightCard` (reactbits): kursor ortidan yumshoq yorug'lik
              // yuradi. rAF ishlatmaydi — faqat sichqoncha hodisalari, ya'ni
              // sensorli ekranda umuman ishga tushmaydi va hech narsa yemaydi.
              // Yorug'lik rangi kartaga qarab: to'q premium kartada oq, oq
              // kartada turkuaz (aks holda ko'rinmasdi).
              <SpotlightCard
                key={tariff.id}
                spotlightColor={
                  isPremium ? 'rgba(153, 225, 217, 0.22)' : 'rgba(153, 225, 217, 0.35)'
                }
                style={{ '--i': Math.min(i, 8) } as React.CSSProperties}
                /* Karta endi BOSILMAYDI: butun ma'lumot uning ichida
                   (`PlanFeatures`), ya'ni ochadigan oyna qolmadi. `hover:scale`
                   ham olib tashlandi — bosilmaydigan narsani "bosiladi" deb
                   ko'rsatish yolg'on ishora. */
                className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 shadow-md justify-between ${
                  isPremium
                    ? // Tungida chegara turkuazga o'tadi va soya olib tashlanadi:
                      // to'q karta to'q fonda "erib" ketmasin (profil hero'si
                      // bilan bir xil qoida — izohi o'sha yerda).
                      'border-wine-ash bg-wine-ash text-white dark:border-turquoise/25 dark:shadow-none'
                    : 'border-border bg-surface'
                }`}
              >
                {isPremium && <GirihPattern size={92} color="var(--turquoise)" opacity={0.06} />}
                {isPremium && <PremiumCorner />}
                {isPremium && (
                  <span className="absolute top-0 right-6 z-10 flex -translate-y-1/2 items-center gap-1 rounded-full bg-brand-pink px-3 py-0.5 text-xs font-bold text-white shadow-md">
                    <Sparkles className="h-3 w-3" />
                    {t('popular')}
                  </span>
                )}

                <div className="relative z-10 space-y-4">
                  <div>
                    {/* Tarif kartasi — sahifa sarlavhasidan keyingi
                        BIRINCHI daraja, ya'ni `h2`. Ilgari `h3` edi va
                        orada `h2` yo'q edi (h1 → h3 sakrash). */}
                    <h2 className={`text-lg font-bold ${isPremium ? 'text-white' : 'text-text'}`}>
                      {tariff.name}
                    </h2>
                    {tariff.description && (
                      <p
                        className={`mt-1 text-xs ${isPremium ? 'text-white/60' : 'text-text-muted'}`}
                      >
                        {tariff.description}
                      </p>
                    )}
                    <p
                      className={`mt-2 text-3xl font-extrabold ${isPremium ? 'text-white' : 'text-text'}`}
                    >
                      {formatCurrency(tariff.price, locale)}
                    </p>

                    {/* Kartadagi eng kuchli va eng halol raqam — oddiy bo'lish
                        amali. Cheksiz tarifda esa u qachondan foydali bo'lishi
                        yoziladi: bu ham reklama, ham ogohlantirish.

                        ⚠️ Rangi FERUZA, pushti EMAS: pushti kartada faqat
                        «Sotib olish» tugmasiga tegishli (izohi
                        `PlanFeatures` da).

                        ⚠️ Feruzaning IKKI ko'rinishi bor: yorug' kartada
                        `turquoise-ink` (to'q, 5.4:1), premium kartaning
                        to'q zaminida esa oddiy `turquoise`. Ilgari
                        ikkalasida ham yorug'i turardi va oq kartada bu
                        raqam 1.49:1 — ko'z bilan deyarli topilmasdi. */}
                    {tariff.perRide != null && (
                      <p
                        className={`mt-1 text-sm font-extrabold ${
                          isPremium ? 'text-turquoise' : 'text-turquoise-ink'
                        }`}
                      >
                        {tr('1 safar ≈', '1 поездка ≈', '1 ride ≈')}{' '}
                        {formatCurrency(Math.round(tariff.perRide), locale)}
                      </p>
                    )}
                    {tariff.breakEven && (
                      <p
                        className={`mt-1 text-xs font-bold ${isPremium ? 'text-white/70' : 'text-text-muted'}`}
                      >
                        {tr(
                          `${tariff.breakEven.rides} safardan boshlab ${tariff.breakEven.planName} dan arzon`,
                          `Выгоднее ${tariff.breakEven.planName} начиная с ${tariff.breakEven.rides} поездок`,
                          `Cheaper than ${tariff.breakEven.planName} from ${tariff.breakEven.rides} rides`
                        )}
                      </p>
                    )}
                  </div>

                  {/* HAMMA MA'LUMOT KARTADA — "Batafsil" tugmasi yo'q
                      (egasi, 2026-08-19). Sabablari komponent izohida. */}
                  <PlanFeatures
                    trips={tariff.trips}
                    parcels={tariff.parcels}
                    hasPremiumFilters={tariff.premiumFilters ?? false}
                    isUnlimited={tariff.unlimited ?? false}
                    dark={isPremium}
                  />
                </div>

                <div className="relative z-10 mt-4">
                  <Button
                    onClick={(e?: React.MouseEvent) => {
                      // Kartaning `onClick`i ham ishlab ketmasin.
                      e?.stopPropagation();
                      buyTariffMutation.mutate(tariff.id);
                    }}
                    isLoading={
                      buyTariffMutation.isPending && buyTariffMutation.variables === tariff.id
                    }
                    disabled={buyTariffMutation.isPending}
                    className="w-full"
                    variant={isPremium ? 'primary' : 'secondary'}
                  >
                    {t('buyBtn', { price: formatCurrency(tariff.price, locale) })}
                  </Button>
                </div>
              </SpotlightCard>
            );
          })}
        </div>

        {/* Qo'shimcha paketlar */}
        {addonsList.length > 0 && (
          <div className="pt-12 mt-12 border-t border-border space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-text">
                {tr("Qo'shimcha safarlar", 'Дополнительные поездки', 'Extra rides')}
              </h2>
              <p className="text-text-muted text-sm max-w-md mx-auto">
                {tr(
                  "Asosiy obunangiz limitidan oshib ketgan bo'lsangiz, qo'shimcha safarlarni xarid qiling.",
                  'Покупайте дополнительно, если превысили лимит основной подписки.',
                  'Buy extra rides if you have used up your subscription limit.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-2xl mx-auto">
              {addonsList.map((addon) => (
                <div
                  key={addon.id}
                  className={`relative flex flex-col rounded-2xl border bg-surface p-6 shadow-sm justify-between transition-transform duration-200 hover:scale-[1.02] ${
                    addon.popular ? 'border-accent/50 bg-accent/5' : 'border-border'
                  }`}
                >
                  {addon.popular && (
                    <span className="absolute top-0 left-6 -translate-y-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-white shadow-md shadow-accent/20">
                      {t('popular')}
                    </span>
                  )}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-text">{addon.name}</h3>
                      <p className="mt-2 text-2xl font-extrabold text-text">
                        {formatCurrency(addon.price, locale)}
                      </p>
                    </div>

                    <div className="flex items-start gap-2 text-sm text-text">
                      <Check className="h-5 w-5 text-turquoise shrink-0" />
                      <span className="font-medium">
                        +{addon.trips}{' '}
                        {tr('safar qoshiladi', 'поездок добавится', 'rides will be added')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button
                      onClick={() => buyTariffMutation.mutate(addon.id)}
                      isLoading={
                        buyTariffMutation.isPending && buyTariffMutation.variables === addon.id
                      }
                      disabled={buyTariffMutation.isPending}
                      className="w-full"
                      variant={addon.popular ? 'primary' : 'secondary'}
                    >
                      {t('buyBtn', { price: formatCurrency(addon.price, locale) })}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TariffsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
        </div>
      }
    >
      <TariffsContent />
    </Suspense>
  );
}
