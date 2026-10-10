'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCreateTripStore } from '@/entities/trip/model/createTripStore';
import { toast } from 'sonner';
import {
  Calendar,
  Users,
  Wallet,
  MapPin,
  Share2,
  ExternalLink,
  Copy,
  RotateCcw,
  Repeat,
} from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { useTr } from '@/shared/lib/useTr';
import { shareOrCopy } from '@/shared/lib/share';
import { GirihPattern, OrnamentMark } from '@/shared/ui/brand/Ornament';
import { FeatureBadge, rideFeatures } from '@/shared/ui/rideFeatures';
import { formatCurrency, formatTripDateTime, normalizeStatus } from '@/shared/lib/format';
import type { MyRide } from '@/shared/api/types/ride';

/**
 * "Safar ma'lumotlari" — haydovchi e'lon qilgan safarining TO'LIQ kartochkasi.
 *
 * NEGA KERAK: e'lon berilgandan keyin haydovchi kiritgan ma'lumotlarning ko'pi
 * (narx, o'rindiqlar, yig'ilish joyi, oraliq shaharlar, qulaylik belgilari, haydash
 * uslubi) hech qayerda ko'rinmasdi — panelda faqat yo'nalish, vaqt va tugmalar bor edi.
 * Ya'ni haydovchi "men nima e'lon qilgan edim?" degan savolga javob topa olmasdi va
 * xatoni (masalan noto'g'ri narx) faqat yo'lovchi aytganda bilardi.
 *
 * KO'RINISHI — CHIPTA (boarding pass): tepasi wine-ash "koreshok" (ikat teksturasi
 * bilan), pastida perforatsiya chizig'i va yon tomonlarida o'yiq doiralar. Bezak
 * BUTUNLAY statik (spec: animatsiya yo'q, ranglar faqat tokendan).
 *
 * Ma'lumot MANBAI — chaqiruvchidagi `MyRide` obyekti (`GET /rides/my`). Alohida
 * so'rov YO'Q: `GET /rides/{id}` gateway'da hali barqaror emas va offline holatda
 * ham karta ochilishi kerak.
 */

const STATUS_FLOW = ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED'] as const;

export function TripDetailsSheet({
  trip,
  isOpen,
  onClose,
}: {
  trip: MyRide | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const locale = useLocale();
  const tr = useTr();
  const router = useRouter();
  const startReturnTrip = useCreateTripStore((st) => st.startReturnTrip);
  const startRepeatTrip = useCreateTripStore((st) => st.startRepeatTrip);

  if (!trip) return null;

  const status = normalizeStatus(trip.status || 'ACTIVE');
  // CREATED — backendning eski nomi, oqimda ACTIVE bilan bir xil bosqich.
  const flowIndex = STATUS_FLOW.indexOf(
    (status === 'CREATED' ? 'ACTIVE' : status) as (typeof STATUS_FLOW)[number]
  );
  const isCancelled = status === 'CANCELLED';

  const steps = [
    tr('Qoralama', 'Черновик', 'Draft'),
    tr("E'lon qilindi", 'Опубликована', 'Published'),
    tr("Yo'lda", 'В пути', 'On the way'),
    tr('Tugallandi', 'Завершена', 'Completed'),
  ];

  const stops = (trip.stops ?? []).map((s) => s.address).filter(Boolean);
  const seatsTotal = trip.total_seats ?? 0;
  const seatsLeft = trip.available_seats ?? seatsTotal;

  // Belgilar — qidiruv natijalaridagi bilan AYNAN bir xil to'plam, shunda
  // haydovchi o'z e'lonini yo'lovchi ko'radigan ko'rinishda taniydi.
  //
  // 🔴 2026-08-16: emoji o'rniga IKONKA va ro'yxat YAGONA manbadan
  // (`shared/ui/rideFeatures`). Ilgari aynan shu belgilar to'rtta faylda
  // qo'lda takrorlanardi — biri o'zgarsa qolganlari eskirardi.
  const badges = rideFeatures(trip, tr);

  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/${locale}/trip/${trip.id}` : '';
  // `navigator.share` faqat mobil/HTTPS'da bor — bo'lmasa havolani nusxalaymiz.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const share = async () => {
    const text = `${trip.origin_address} → ${trip.destination_address}\n${formatTripDateTime(trip.departure_time)}`;
    await shareOrCopy(
      { title: 'YolYolakay', text, url: publicUrl },
      {
        copied: tr('Havola nusxalandi', 'Ссылка скопирована', 'Link copied'),
        failed: tr("Ulashib bo'lmadi", 'Не удалось поделиться', "Couldn't share"),
      }
    );
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={tr("Safar ma'lumotlari", 'Данные поездки', 'Trip details')}
    >
      <div className="space-y-5 pb-2">
        {/* ===== CHIPTA KORESHOGI ===== */}
        <div className="relative overflow-hidden rounded-2xl border border-wine-ash bg-wine-ash p-5 text-white">
          <GirihPattern size={92} color="var(--turquoise)" opacity={0.06} />
          <div className="relative z-10 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                YOLYOLAKAY
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  isCancelled ? 'bg-error/20 text-error' : 'bg-turquoise/20 text-turquoise'
                }`}
              >
                {isCancelled
                  ? tr('Bekor qilingan', 'Отменена', 'Cancelled')
                  : steps[flowIndex] || status}
              </span>
            </div>

            <div className="font-display text-2xl font-black leading-tight tracking-tight">
              {trip.origin_address || '—'}
              <span className="mx-2 text-turquoise">→</span>
              {trip.destination_address || '—'}
            </div>

            <div className="flex items-center gap-1.5 text-sm font-bold text-white/70">
              <Calendar className="h-4 w-4 shrink-0 text-turquoise" />
              {formatTripDateTime(trip.departure_time) || '—'}
            </div>
          </div>

          {/* Perforatsiya — chipta yirtiladigan joy. Yon o'yiqlar sheet foni rangida. */}
          {/* `-mx-5` — qator karta chetigacha cho'ziladi, doiralar yarmi tashqarida qoladi
              va `overflow-hidden` ularni qirqib O'YIQ hosil qiladi (haqiqiy chipta effekti). */}
          <div className="relative z-10 -mx-5 mt-4 flex items-center px-5">
            <span className="absolute -left-2.5 h-5 w-5 rounded-full bg-surface" aria-hidden />
            <span className="h-px w-full border-t border-dashed border-white/25" aria-hidden />
            <span className="absolute -right-2.5 h-5 w-5 rounded-full bg-surface" aria-hidden />
          </div>

          {/* Asosiy raqamlar — chiptaning "otryvnoy" qismi */}
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-white/70">
                {tr("O'rin uchun narx", 'Цена за место', 'Price per seat')}
              </p>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums">
                {formatCurrency(trip.price_per_seat ?? 0, locale)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-white/70">
                {tr("Bo'sh o'rin", 'Свободно мест', 'Free seats')}
              </p>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums">
                {seatsLeft} / {seatsTotal}
              </p>
            </div>
          </div>
        </div>

        {/* ===== HOLAT BOSQICHLARI ===== */}
        {!isCancelled && (
          <div className="flex items-center gap-1.5">
            {steps.map((label, i) => {
              const done = flowIndex >= 0 && i <= flowIndex;
              return (
                <div key={label} className="flex-1 space-y-1.5">
                  <span
                    className={`block h-1.5 rounded-full ${done ? 'bg-turquoise' : 'bg-border'}`}
                  />
                  <span
                    className={`block text-[10px] font-bold leading-tight ${
                      i === flowIndex ? 'text-foreground' : 'text-text-muted'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== MARSHRUT TASMASI ===== */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-text-muted">
            {tr('Marshrut', 'Маршрут', 'Route')}
          </p>
          <ol className="space-y-0">
            {[
              { label: trip.origin_address || '—', kind: 'from' as const },
              ...stops.map((s) => ({ label: s, kind: 'stop' as const })),
              { label: trip.destination_address || '—', kind: 'to' as const },
            ].map((point, i, arr) => (
              <li key={`${point.label}-${i}`} className="flex gap-3">
                {/* Chap ustun: nuqta + ulovchi chiziq */}
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      point.kind === 'stop'
                        ? 'border-2 border-turquoise bg-surface'
                        : 'bg-turquoise ring-4 ring-turquoise/20'
                    }`}
                  />
                  {i < arr.length - 1 && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className={i < arr.length - 1 ? 'pb-4' : ''}>
                  <p className="text-sm font-bold text-text">{point.label}</p>
                  {point.kind === 'stop' && (
                    <p className="text-[11px] font-bold text-text-muted">
                      {tr('Oraliq shahar', 'Промежуточный город', 'Stop along the way')}
                    </p>
                  )}
                  {point.kind === 'from' && trip.pickup_point && (
                    <p className="mt-0.5 flex items-start gap-1 text-[11px] font-bold text-text-muted">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-turquoise" />
                      {trip.pickup_point}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ===== QULAYLIK BELGILARI ===== */}
        {badges.length > 0 && (
          <div className="space-y-2">
            <OrnamentMark />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {badges.map((b) => (
                <FeatureBadge
                  key={b.key}
                  icon={b.icon}
                  label={b.label}
                  className="bg-surface text-[11px]"
                />
              ))}
            </div>
          </div>
        )}

        {/* ===== QO'SHIMCHA RAQAMLAR ===== */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-text-muted">
              <Users className="h-3.5 w-3.5 text-accent" />
              {tr('Arizalar', 'Заявки', 'Requests')}
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-foreground">
              {(trip.bookings ?? []).length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-text-muted">
              <Wallet className="h-3.5 w-3.5 text-accent" />
              {tr("To'liq salon", 'Весь салон', 'Whole car')}
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-foreground">
              {formatCurrency((trip.price_per_seat ?? 0) * (seatsTotal || 1), locale)}
            </p>
          </div>
        </div>

        {/* QAYTISH SAFARI — e'lon qilingan safarga qarab teskari yo'nalishli yangi
            qoralama. Faqat safar hali tugamaganda ma'noli (tugagan safardan
            "qaytish" — bu shunchaki yangi safar). */}
        {!isCancelled && status !== 'COMPLETED' && (
          <>
            <button
              type="button"
              onClick={() => {
                startReturnTrip({
                  from: trip.origin_address || '',
                  fromCoords: [trip.origin_lat, trip.origin_lon],
                  to: trip.destination_address || '',
                  toCoords: [trip.destination_lat, trip.destination_lon],
                  seats: trip.total_seats,
                  price: trip.price_per_seat,
                  hasAC: trip.has_ac,
                  hasLuggage: trip.has_luggage,
                  acceptsParcel: trip.takes_parcels,
                  noSmoking: trip.no_smoking,
                  noPets: trip.no_pets,
                  drivingSpeed: trip.driving_speed,
                  musicTaste: trip.music_taste,
                  maxTwoBack: trip.max_two_back,
                });
                onClose();
                router.push(`/${locale}/driver/create-trip?return=1`);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-turquoise bg-turquoise-light/40 py-3 text-sm font-bold text-wine-ash transition-colors hover:bg-turquoise-light/70 dark:bg-turquoise/10 dark:text-turquoise dark:hover:bg-turquoise/20"
            >
              <RotateCcw className="h-4 w-4" />
              {tr(
                `Qaytish safari · ${trip.destination_address} → ${trip.origin_address}`,
                `Обратная поездка · ${trip.destination_address} → ${trip.origin_address}`,
                `Return trip · ${trip.destination_address} → ${trip.origin_address}`
              )}
            </button>

            {/* TAKRORLASH — qaytish safaridan BOSHQA ehtiyoj: ko'p haydovchi
              har kuni AYNAN bir xil yo'nalishda yuradi. */}
            <button
              type="button"
              onClick={() => {
                startRepeatTrip({
                  from: trip.origin_address || '',
                  fromCoords: [trip.origin_lat, trip.origin_lon],
                  to: trip.destination_address || '',
                  toCoords: [trip.destination_lat, trip.destination_lon],
                  seats: trip.total_seats,
                  price: trip.price_per_seat,
                  hasAC: trip.has_ac,
                  hasLuggage: trip.has_luggage,
                  acceptsParcel: trip.takes_parcels,
                  noSmoking: trip.no_smoking,
                  noPets: trip.no_pets,
                  drivingSpeed: trip.driving_speed,
                  musicTaste: trip.music_taste,
                  maxTwoBack: trip.max_two_back,
                  pickupPoint: trip.pickup_point ?? '',
                });
                onClose();
                router.push(`/${locale}/driver/create-trip?return=1`);
              }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border py-3 text-sm font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <Repeat className="h-4 w-4" />
              {tr(
                "Ertaga ham shunday e'lon",
                'Такое же объявление на завтра',
                'Same listing for tomorrow'
              )}
            </button>
          </>
        )}

        {/* ===== AMALLAR ===== */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={share}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface py-3 text-sm font-bold text-text transition-colors hover:border-accent hover:text-accent"
          >
            {canShare ? <Share2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {tr('Ulashish', 'Поделиться', 'Share')}
          </button>
          <Link
            href={`/${locale}/trip/${trip.id}`}
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface py-3 text-sm font-bold text-text transition-colors hover:border-accent hover:text-accent"
          >
            <ExternalLink className="h-4 w-4" />
            {tr("Yo'lovchi ko'zi bilan", 'Глазами пассажира', "Passenger's view")}
          </Link>
        </div>
      </div>
    </BottomSheet>
  );
}
