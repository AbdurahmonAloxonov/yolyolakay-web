'use client';

import React from 'react';
import {
  Venus,
  Snowflake,
  Luggage,
  CigaretteOff,
  PawPrint,
  Armchair,
  Package,
  Turtle,
  Car,
  Gauge,
  Lock,
  VolumeX,
  Music,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-react';
import type { Tr } from '@/shared/lib/i18n';

/**
 * Safar belgilari (filtrlari) — IKONKA + matn, yagona manba.
 *
 * 🔴 NEGA (egasi, 2026-08-16: "saytda hamma filtrlarda emoji ishlatilgan,
 * uni ham ikonkalarga almashtirish kerak"):
 *
 *   1. Emoji QURILMAGA qarab boshqacha chiziladi — Samsung, iPhone va
 *      Windowsda uch xil ko'rinadi, ba'zilarida umuman kvadrat chiqadi.
 *      Ya'ni interfeys biz ko'rgan holida ko'rinishiga kafolat yo'q.
 *   2. Emoji brend ranglariga bo'ysunmaydi: qulflangan filtrni so'nik
 *      qilib bo'lmaydi, to'q kartada esa u yorqin dog' bo'lib qoladi.
 *   3. Mobil ilovada bu allaqachon qoida (`design_system_test.dart`:
 *      «Text() ichida emoji yo'q — Material ikonkalari ishlatiladi»),
 *      sayt esa ortda qolgan edi.
 *
 * 🔴 RO'YXAT BITTA JOYDA. Ilgari aynan shu belgilar TO'RTTA faylda
 * qo'lda takrorlanardi (qidiruv filtri, safar varag'i, safar sahifasi,
 * e'lon formasi) — biri o'zgarsa qolganlari eskirardi va foydalanuvchi
 * bir xil safarni ikki joyda boshqacha ko'rardi.
 */

/** Bitta belgining ko'rinishi. */
export interface RideFeature {
  key: string;
  icon: LucideIcon;
  label: string;
}

/** Belgilar lug'ati — ikonka har joyda BIR XIL bo'lishi uchun. */
export const rideFeatureIcons = {
  parcel: Package,
  ac: Snowflake,
  luggage: Luggage,
  noSmoking: CigaretteOff,
  noPets: PawPrint,
  twoBack: Armchair,
  women: Venus,
  calm: Turtle,
  normal: Car,
  fast: Gauge,
  musicQuiet: VolumeX,
  musicLoud: Music,
  musicTalk: MessagesSquare,
  locked: Lock,
} as const;

/** Belgilar nomlari — uch tilda, yagona manba. */
export const rideFeatureLabels = (tr: Tr) => ({
  parcel: tr('Pochta oladi', 'Берёт посылки', 'Takes parcels'),
  ac: tr('Konditsioner', 'Кондиционер', 'Air conditioning'),
  luggage: tr('Bagaj joyi', 'Багаж', 'Luggage space'),
  noSmoking: tr('Chekilmaydi', 'Не курить', 'No smoking'),
  noPets: tr('Hayvonsiz', 'Без животных', 'No pets'),
  twoBack: tr('Orqada 2 kishi', 'Сзади двое', 'Two in the back'),
  women: tr('Faqat ayollar', 'Только женщины', 'Women only'),
  calm: tr('Sekin haydash', 'Спокойное вождение', 'Calm driving'),
  normal: tr("O'rtacha tezlik", 'Средняя скорость', 'Moderate speed'),
  fast: tr('Tez haydash', 'Быстрое вождение', 'Fast driving'),
  musicQuiet: tr('Sokin', 'Тихо', 'Quiet'),
  musicLoud: tr('Musiqa baland', 'Музыка громко', 'Music loud'),
  musicTalk: tr('Suhbatlashamiz', 'Поговорим', 'We chat'),
});

/** Safar obyektidan ko'rsatiladigan belgilar ro'yxati. */
export const rideFeatures = (
  trip: {
    takes_parcels?: boolean;
    has_ac?: boolean;
    has_luggage?: boolean;
    no_smoking?: boolean;
    no_pets?: boolean;
    max_two_back?: boolean;
    driving_speed?: string;
    /**
     * Yo'lda musiqa — `quiet` | `loud` | `talk`. Ixtiyoriy.
     *
     * ⚠️ QIDIRUV javobida bu maydon YO'Q (09.09.2026 o'lchovi):
     * `GET /rides/search` uni qaytarmaydi, `GET /rides/{id}` qaytaradi.
     * Ya'ni belgi faqat safar sahifasida chiqadi — bu ATAYIN emas,
     * backend shunday. Kartochkada yo'qligi xato emas.
     *
     * ⚠️ Ustun serverda ERKIN MATN: begona qiymat kelsa belgi
     * chizilmaydi (pastdagi qat'iy tekshiruv).
     */
    music_taste?: string;
    /** `'female'` — faqat ayol yo'lovchilar (haydovchining e'loni). */
    gender_restriction?: string;
  },
  tr: Tr,
  /**
   * [includeGender] — «Faqat ayollar» belgisi ro'yxatga kirsinmi.
   *
   * 🔴 SAFAR SAHIFASIDA `false`: u yerda belgilar «qulayliklar» qatori
   * bo'lib chiziladi, bu esa qulaylik EMAS — bron sharti, va u alohida
   * ko'rinishi kerak. Kartochkada esa boshqa joy yo'q, shuning uchun
   * standart qiymat `true`.
   */
  includeGender = true
): RideFeature[] => {
  const labels = rideFeatureLabels(tr);
  const out: RideFeature[] = [];
  const add = (key: keyof typeof rideFeatureIcons) =>
    out.push({ key, icon: rideFeatureIcons[key], label: labels[key as keyof typeof labels] });

  if (trip.takes_parcels) add('parcel');
  if (trip.has_ac) add('ac');
  if (trip.has_luggage) add('luggage');
  if (trip.no_smoking) add('noSmoking');
  if (trip.no_pets) add('noPets');
  if (trip.max_two_back) add('twoBack');
  // ENG OXIRIDA emas, qoidalar orasida: kartochkada u qolganlari bilan
  // bir qatorda o'qiladi.
  if (includeGender && trip.gender_restriction === 'female') add('women');

  const speed = trip.driving_speed;
  if (speed === 'calm' || speed === 'normal' || speed === 'fast') add(speed);

  // «Farqi yo'q» (qiymat yo'q) — belgi UMUMAN chizilmaydi: bo'sh belgi
  // joy oladi-yu, hech nima aytmaydi. Mobil ilovada ham shu qoida.
  const music = trip.music_taste;
  if (music === 'quiet') add('musicQuiet');
  if (music === 'loud') add('musicLoud');
  if (music === 'talk') add('musicTalk');

  return out;
};

/**
 * Belgi nishoni — ikonka + matn.
 *
 * Ikonka matn bilan bir o'lchamda va bir rangda: emoji singari o'zicha
 * "sakrab" turmaydi va qulflangan holatda so'nik bo'la oladi.
 */
export const FeatureBadge: React.FC<{
  icon: LucideIcon;
  label: string;
  className?: string;
}> = ({ icon: Icon, label, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-bold text-text-muted ${className}`}
  >
    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
    {label}
  </span>
);

/**
 * Formadagi belgi ikonkasi — qulflangan holatda QULF ko'rsatiladi.
 *
 * 🔴 NEGA ALOHIDA: e'lon formasida bir xil naqsh olti marta takrorlanardi
 * (`premiumFiltersLocked ? '🔒' : '🚭'`). Bittasi unutilsa, qulflangan
 * filtr ochiqday ko'rinardi va haydovchi uni yoqib, e'lon qilishda
 * 400 olardi.
 */
export const FeatureIcon: React.FC<{ icon: LucideIcon; locked?: boolean }> = ({
  icon: Icon,
  locked = false,
}) => {
  const Shown = locked ? rideFeatureIcons.locked : Icon;
  return <Shown className="h-3.5 w-3.5 shrink-0" aria-hidden />;
};
