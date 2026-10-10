'use client';

import React from 'react';
import { Gauge, MapPin, Navigation, Clock } from 'lucide-react';

import { RoutePreview } from './RoutePreview';
import { useRoadRoute } from '@/entities/ride/api/useRoadRoute';
import type { DriverPosition } from '@/shared/api/telematics';
import { STALE_MS } from '@/shared/lib/livePosition';
import { cumulativeKm, progressOnRoute, simplifyRoute, type Pt } from '@/shared/lib/routeMath';
import { remainingMinutes } from '@/shared/lib/routeMath';
import { nearestCityName, resolveCityCoord } from '@/shared/data/uzCities';
import { haversineKm } from '@/shared/lib/geo';
import { useTr } from '@/shared/lib/useTr';

/**
 * «YO'LDA» — safar ketayotganda xarita JAVOB BERADIGAN panel.
 *
 * 🔴 NEGA YOZILDI (egasi, 17.09.2026): «karta noto'g'ri ishlayapti…
 * tekkis chizib qo'yyapti, safar boshlanganda qayerda ketayotganini
 * ko'rish imkoni yo'q — yana Yandex kartaga kirvolishadi. Bunaqa
 * qulayliklarni qilmasdan qanday qilib tugatamiz».
 *
 * To'g'ri tanqid edi. Xaritada mashina nuqtasi bor edi-yu, u faqat
 * «nuqta» edi: odam undan QANCHA QOLGANINI ham, QAYERDAN o'tayotganini
 * ham bilolmasdi. Ikkalasi ham bizda BOR edi va ishlatilmasdan yotardi:
 *
 *   • `GET /routing/route` — yo'lning haqiqiy geometriyasi, masofasi va
 *     davomiyligi (Toshkent–Samarqand: 3204 nuqta, 322 km, 4 s 55 daq);
 *   • `GET /rides/{id}/location` — jonli nuqta, tezlik va PING VAQTI.
 *
 * Panel shu ikkisini birlashtiradi va to'rt savolga javob beradi:
 *   1. qayerdan o'tyapti  → eng yaqin shahar nomi;
 *   2. qancha qoldi       → yo'l bo'ylab qolgan km;
 *   3. qachon yetadi      → yo'l davomiyligining qolgan ulushi;
 *   4. ma'lumot TIRIKMI   → oxirgi ping qachon bo'lgan.
 *
 * ⚠️ 4-band eng muhimi: haydovchi ilovani yopsa nuqta joyida qotadi va
 * xarita «hammasi joyida» deb ko'rsataveradi. Vaqtni aytmasdan jonli
 * kuzatuv YOLG'ON bo'ladi.
 *
 * ⚠️ MASHINA YO'LDAN CHETDA bo'lsa (boshqa yo'ldan ketyapti yoki ping
 * eskirgan) masofa va vaqt KO'RSATILMAYDI: noto'g'ri raqamdan ko'ra
 * raqamsiz xarita yaxshi.
 */

/** Undan narisida «yo'lda emas» deb hisoblaymiz (km). */
const OFF_ROUTE_KM = 12;
/**
 * Undan eski ping — «ma'lumot eskirgan» (daqiqa).
 *
 * 🔑 Qiymat `livePosition.STALE_MS` dan olinadi: aynan shu chegara
 * xaritadagi nuqtani SURISH-SURMASLIKNI ham hal qiladi. Ikki joyda ikki
 * xil raqam tursa, yozuv «eskirgan» deb turib, nuqta jonli mashinadek
 * suzib ketishi mumkin edi.
 */
const STALE_MIN = STALE_MS / 60_000;

function fmtKm(km: number): string {
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

export function TripLive({
  from,
  to,
  via,
  pickup,
  driver,
  trackingDenied = false,
  onOpen,
  openLabel,
}: {
  from: Pt;
  to: Pt;
  via?: Pt[];
  pickup?: Pt | null;
  driver: DriverPosition | null | undefined;
  /**
   * Server jonli joyni BERMADI (403) — ma'lumot bor, lekin bu odamga emas.
   *
   * 🔴 Busiz mehmonga «haydovchi joylashuvni hali yubormagan» deb
   * yozilardi va bu YOLG'ON edi: haydovchi yuborgan, ko'rish huquqi
   * yo'q. Yolg'on xabar ishonchni ma'lumot yo'qligidan ko'ra ko'proq
   * buzadi.
   */
  trackingDenied?: boolean;
  onOpen?: () => void;
  openLabel?: string;
}) {
  const tr = useTr();

  const waypoints = React.useMemo<Pt[]>(() => [from, ...(via ?? []), to], [from, via, to]);
  const { data: road } = useRoadRoute(waypoints);

  /* Faqat HAQIQIY yo'l: to'g'ri chiziq bo'ylab «qancha qoldi» hisoblash
     yolg'on raqam beradi, chizilganda esa yo'l bo'lib ko'rinardi. */
  const full = road?.isReal && road.points.length >= 2 ? road.points : null;
  // Chizish uchun siyrak, HISOB uchun to'liq — izohi `routeMath` da.
  const shown = React.useMemo(() => (full ? simplifyRoute(full) : null), [full]);
  const cum = React.useMemo(() => (full ? cumulativeKm(full) : null), [full]);

  const progress = React.useMemo(() => {
    if (!full || !cum || !driver) return null;
    return progressOnRoute(full, cum, [driver.lat, driver.lon]);
  }, [full, cum, driver]);

  const onRoute = !!progress && progress.offRouteKm <= OFF_ROUTE_KM;
  const leftMin = onRoute ? remainingMinutes(road?.seconds ?? null, progress!.fraction) : null;

  // Siyraklashtirilgan chiziqdagi mos indeks (to'liq ro'yxatdagi ulushdan).
  const doneIndex =
    onRoute && shown && full
      ? Math.round((progress!.index / (full.length - 1)) * (shown.length - 1))
      : null;

  /*
   * QAYERDAN O'TYAPTI.
   *
   * ⚠️ Standart radius (35 km) TOR: shaharlararo yo'lda mashina ko'pincha
   * hech bir shahardan 35 km ichida bo'lmaydi va javob «ma'lumot yo'q»
   * bo'lib chiqardi — holbuki ma'lumot BOR. Radius kengaytirildi, lekin
   * matn HALOL: yaqin bo'lsa «yaqinida», uzoq bo'lsa masofasi aytiladi.
   */
  const place = React.useMemo(() => {
    if (!driver) return null;
    const name = nearestCityName(driver.lat, driver.lon, 90);
    if (!name) return null;
    const c = resolveCityCoord(name);
    const km = c ? haversineKm([driver.lat, driver.lon], c.coord) : null;
    return { name, km };
  }, [driver]);

  /*
   * «HOZIR» — HOLATDA, render ichida EMAS.
   *
   * 🔴 Ikki sabab: (1) render paytida `Date.now()` chaqirish React
   * qoidasiga zid (chizish natijasi har safar boshqa chiqadi);
   * (2) ping yangilanmasa ham «necha daqiqa oldin» degan raqam
   * O'SIB borishi kerak — aks holda ekran «1 daqiqa oldin» deb
   * qotib qolardi va bu YOLG'ON bo'lardi.
   */
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const pingAt = driver?.updatedAt;
  const ageMin = React.useMemo(() => {
    if (!pingAt) return null;
    const t = Date.parse(pingAt);
    if (!Number.isFinite(t)) return null;
    return Math.max(0, Math.round((now - t) / 60000));
  }, [pingAt, now]);

  const arrival =
    leftMin != null
      ? new Date(now + leftMin * 60000).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Tashkent',
        })
      : null;

  const stale = ageMin != null && ageMin > STALE_MIN;

  return (
    <div className="space-y-3">
      <RoutePreview
        from={from}
        to={to}
        via={via}
        pickup={pickup}
        points={shown}
        doneIndex={doneIndex}
        driver={
          driver
            ? {
                coord: [driver.lat, driver.lon],
                heading: driver.heading ?? null,
                /* Ping VAQTI ham beriladi: eskirgan nuqta xaritada
                   SURILMASLIGI kerak — harakat «aloqa bor» degan
                   signal (izohi `livePosition.ts` da). */
                updatedAt: driver.updatedAt ?? null,
              }
            : null
        }
        onOpen={onOpen}
        openLabel={openLabel}
        height={220}
      />

      {/* Yo'l chizig'i — bosib o'tilgan ulush. Raqamni o'qimasdan ham
          «yarmiga yetdi» degan javobni beradi. */}
      {onRoute && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700"
            style={{ width: `${Math.round(progress!.fraction * 100)}%` }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<MapPin className="h-3.5 w-3.5" aria-hidden />}
          label={tr('Hozir', 'Сейчас', 'Now')}
          value={
            !place
              ? tr("Ma'lumot yo'q", 'Нет данных', 'No data')
              : place.km != null && place.km > 20
                ? tr(
                    `${place.name}dan ${Math.round(place.km)} km`,
                    `${Math.round(place.km)} км от г. ${place.name}`,
                    `${Math.round(place.km)} km from ${place.name}`
                  )
                : tr(`${place.name} yaqinida`, `возле г. ${place.name}`, `near ${place.name}`)
          }
        />
        <Stat
          icon={<Navigation className="h-3.5 w-3.5" aria-hidden />}
          label={tr('Qoldi', 'Осталось', 'Left')}
          value={onRoute ? fmtKm(progress!.leftKm) : '—'}
        />
        <Stat
          icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
          label={tr('Yetib boradi', 'Прибытие', 'Arrives')}
          value={
            leftMin != null
              ? tr(
                  `${arrival} · ${leftMin} daq`,
                  `${arrival} · ${leftMin} мин`,
                  `${arrival} · ${leftMin} min`
                )
              : '—'
          }
        />
        <Stat
          icon={<Gauge className="h-3.5 w-3.5" aria-hidden />}
          label={tr('Tezlik', 'Скорость', 'Speed')}
          value={driver?.speedKmh != null ? `${Math.round(driver.speedKmh)} km/h` : '—'}
        />
      </div>

      {/*
        MA'LUMOT TIRIKMI. Eng muhim qator: mashina nuqtasi ping to'xtasa
        joyida qotib qoladi va xarita «hammasi joyida» deb ko'rsataveradi.
      */}
      <p className={`text-[11px] font-semibold ${stale ? 'text-error-ink' : 'text-text-muted'}`}>
        {trackingDenied
          ? tr(
              "Mashinaning jonli joyi faqat bron qilgan yo'lovchiga va kuzatuv havolasi orqali ko'rinadi",
              'Живое местоположение видно только пассажиру с бронью и по ссылке отслеживания',
              'The live location is visible to booked passengers and via a tracking link'
            )
          : ageMin == null
            ? /*
               * ⚠️ «Hali yubormagan» DEB AYTMAYMIZ: server oxirgi pingni
               * cheklangan vaqt saqlaydi va u eskirsa `404 driver location
               * not available or offline` qaytaradi (17.09.2026 da
               * o'lchandi: ~40 daqiqadan keyin). Ya'ni nuqta bo'lmasligi
               * «yubormadi» degani ham, «aloqadan chiqdi» degani ham
               * bo'lishi mumkin — ikkalasini ham qamraydigan HALOL matn.
               */
              tr(
                "Mashina joyi hozir ko'rinmayapti — haydovchi ilovada bo'lsa qayta paydo bo'ladi",
                'Местоположение сейчас недоступно — появится, когда водитель будет в приложении',
                'The location is unavailable right now — it returns when the driver is in the app'
              )
            : stale
              ? tr(
                  `Ma'lumot ${ageMin} daqiqa oldingi — haydovchi aloqadan chiqqan bo'lishi mumkin`,
                  `Данные ${ageMin} мин назад — водитель мог потерять связь`,
                  `Data is ${ageMin} min old — the driver may have lost connection`
                )
              : tr(
                  `Yangilandi: ${ageMin} daqiqa oldin`,
                  `Обновлено: ${ageMin} мин назад`,
                  `Updated ${ageMin} min ago`
                )}
      </p>

      {/* Mashina yo'ldan uzoqda — RAQAM KO'RSATMAYMIZ va sababini aytamiz. */}
      {progress && !onRoute && (
        <p className="text-[11px] font-semibold text-text-muted">
          {tr(
            "Mashina marshrutdan chetda ko'rinyapti — qolgan masofa hisoblanmadi",
            'Машина вне маршрута — оставшееся расстояние не рассчитано',
            'The car appears off the route — remaining distance not calculated'
          )}
        </p>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </span>
      {/* ⚠️ `break-words`: «Shahrisabz yaqinida» tor ustunga sig'maydi va
          kesilgan matn eng yomon variant bo'lardi. */}
      <span className="mt-0.5 block break-words text-xs font-extrabold text-text">{value}</span>
    </div>
  );
}
