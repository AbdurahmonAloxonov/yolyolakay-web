import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tashkentNow } from '@/shared/lib/format';
import type { DrivingSpeed } from '@/shared/api/types/ride';

/** Oraliq shahar (yo'l-yo'lakay kirib o'tiladigan) — coords autocomplete/geocode'dan */
export interface StopDraft {
  name: string;
  coords: [number, number] | null;
}

interface CreateTripState {
  step: number;
  from: string;
  fromCoords: [number, number];
  to: string;
  toCoords: [number, number];
  pickupPoint: string;
  /**
   * UCHRASHUV NUQTASINING KOORDINATASI — xaritadan tanlangan bo'lsa.
   *
   * 🔴 17.09.2026 gacha xaritadan tanlangan nuqta TESKARI GEOKOD orqali
   * matnga aylantirilib, koordinataning O'ZI tashlab yuborilardi:
   * «backendda maydon yo'q» deb. Endi bor — `pickup_lat/pickup_lon`
   * saqlanadi va qaytadi (jonli o'lchandi). Matn qo'lda o'zgartirilsa
   * bu qiymat TOZALANADI: eski nuqta yangi matnga mos kelmaydi.
   */
  pickupCoords: [number, number] | null;
  date: string;
  time: string;
  seats: number;
  hasAC: boolean;
  hasLuggage: boolean;
  acceptsParcel: boolean;
  noSmoking: boolean;
  noPets: boolean;
  drivingSpeed: DrivingSpeed;
  maxTwoBack: boolean;
  /**
   * Yo'lda musiqa — `''` («farqi yo'q») | `quiet` | `loud` | `talk`.
   *
   * 🔑 Ixtiyoriy va TARIFGA BOG'LIQ EMAS: bu qulaylik emas,
   * ogohlantirish. Sokin salon kutgan odam «musiqa baland» ni
   * OLDINDAN bilsin — buni pulli qilish nizoni safar ichiga surardi.
   */
  musicTaste: '' | 'quiet' | 'loud' | 'talk';
  /**
   * `'female'` — safarga FAQAT ayol yo'lovchi olinadi, `''` — cheklovsiz.
   *
   * 🔑 Haydovchining JINSI emas, SALON haqidagi e'loni: erkak haydovchi
   * ham qo'ya oladi (egasi, 08.09.2026).
   *
   * ⚠️ `'male'` ATAYIN yo'q — 13.08.2026 da olib tashlangan va qayta
   * tiklanmadi.
   */
  genderRestriction: '' | 'female';
  stops: StopDraft[];
  price: number;
  setStep: (step: number) => void;
  setField: (
    field:
      | 'from'
      | 'to'
      | 'pickupPoint'
      | 'pickupCoords'
      | 'date'
      | 'time'
      | 'seats'
      | 'hasAC'
      | 'hasLuggage'
      | 'acceptsParcel'
      | 'noSmoking'
      | 'noPets'
      | 'drivingSpeed'
      | 'maxTwoBack'
      | 'musicTaste'
      | 'genderRestriction'
      | 'stops'
      | 'price'
      | 'fromCoords'
      | 'toCoords',
    value: unknown
  ) => void;
  reset: () => void;
  /**
   * QAYTISH SAFARI: e'lon qilingan safardan teskari yo'nalishli yangi qoralama.
   *
   * Nega kerak (CEO 2026-08-04): haydovchi borgan joyidan qaytadi va o'sha
   * qaytishga ham yo'lovchi kerak. Ilgari u butun formani qo'lda qaytadan
   * to'ldirardi — shahar, yig'ilish joyi, narx, belgilar.
   *
   * Nima ko'chadi: yo'nalish ALMASHADI (from<->to), qulaylik belgilari, o'rindiq
   * soni va narx saqlanadi. Nima KO'CHMAYDI: sana/vaqt (yangisini tanlash SHART —
   * shu sabab 2-qadamdan boshlanadi), yig'ilish nuqtasi (boshqa shaharda boshqa
   * joy) va oraliq shaharlar (teskari tartibda avtomatik taxmin qilish xato bo'lardi).
   */
  startRepeatTrip: (source: {
    from: string;
    fromCoords: [number, number];
    to: string;
    toCoords: [number, number];
    seats?: number;
    price?: number;
    hasAC?: boolean;
    hasLuggage?: boolean;
    acceptsParcel?: boolean;
    noSmoking?: boolean;
    noPets?: boolean;
    drivingSpeed?: string;
    maxTwoBack?: boolean;
    /** Erkin matn kelishi mumkin — `normalizeMusic` kesib beradi. */
    musicTaste?: string;
    genderRestriction?: '' | 'female';
    pickupPoint?: string;
    /** Uchrashuv nuqtasi xaritada belgilangan bo'lsa — u ham ko'chadi. */
    pickupCoords?: [number, number] | null;
  }) => void;
  startReturnTrip: (source: {
    from: string;
    fromCoords: [number, number];
    to: string;
    toCoords: [number, number];
    seats?: number;
    price?: number;
    hasAC?: boolean;
    hasLuggage?: boolean;
    acceptsParcel?: boolean;
    noSmoking?: boolean;
    noPets?: boolean;
    drivingSpeed?: DrivingSpeed;
    maxTwoBack?: boolean;
    /** Erkin matn kelishi mumkin — `normalizeMusic` kesib beradi. */
    musicTaste?: string;
    genderRestriction?: '' | 'female';
  }) => void;
}

/**
 * Backenddan kelgan musiqa qiymatini formaga TUSHIRISHDAN OLDIN kesadi.
 *
 * 🔴 SHART: `music_taste` serverda ERKIN MATN ustuni (09.09.2026 o'lchovi:
 * «Sokin fon musiqasi» degan jumla o'sha holicha saqlandi va qaytdi).
 * Begona satr formaga tushsa, hech bir tugma tanlangan ko'rinmaydi-yu,
 * e'lon berilganda o'sha satr qaytib yuborilardi.
 */
const normalizeMusic = (raw?: string): '' | 'quiet' | 'loud' | 'talk' => {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  return v === 'quiet' || v === 'loud' || v === 'talk' ? v : '';
};

const initialFields = () => ({
  step: 1,
  from: '',
  fromCoords: [41.311081, 69.240562] as [number, number], // Tashkent
  to: '',
  toCoords: [41.311081, 69.240562] as [number, number],
  pickupPoint: '',
  pickupCoords: null as [number, number] | null,
  // Toshkent sanasi — qurilma vaqt zonasi emas (chetdagi foydalanuvchida kun adashmasin).
  date: tashkentNow().date,
  time: '09:00',
  seats: 4,
  hasAC: true,
  hasLuggage: true,
  acceptsParcel: false,
  // Yangi qulaylik belgilari — standart: chekish/hayvon cheklovi yo'q, haydash "o'rtacha".
  noSmoking: false,
  noPets: false,
  drivingSpeed: 'normal' as DrivingSpeed,
  maxTwoBack: false,
  // Musiqa — standart «farqi yo'q»: belgi chizilmaydi.
  musicTaste: '' as '' | 'quiet' | 'loud' | 'talk',
  // Cheklovsiz — standart. Odam O'ZI tanlaydi.
  genderRestriction: '' as '' | 'female',
  // Oraliq shaharlar (ixtiyoriy, maks 3) — bo'sh boshlanadi.
  stops: [] as StopDraft[],
  // 0 = maydon bo'sh ochiladi — haydovchi narxni O'ZI erkin kiritadi (ilgari 80000
  // oldindan turib, foydalanuvchilar buni "minimal narx" deb o'ylashardi).
  price: 0,
});

// persist: "Qoralama saqlandi" endi HAQIQAT — forma localStorage'da qoladi (reload/chiqib-kirishda
// tiklanadi). E'lon muvaffaqiyatli berilganda reset() qoralamani tozalaydi.
export const useCreateTripStore = create<CreateTripState>()(
  persist(
    (set) => ({
      ...initialFields(),
      setStep: (step) => set({ step }),
      setField: (field, value) => set((state) => ({ ...state, [field]: value })),
      reset: () => set(initialFields()),
      /**
       * TAKRORLASH — yo'nalish O'SHA qoladi (qaytish safaridan farqli).
       *
       * 🔴 NEGA ALOHIDA: ko'p haydovchi HAR KUNI bir xil yo'nalishda
       * yuradi. `startReturnTrip` yo'nalishni ALMASHTIRADI — bu esa
       * o'shani qoldiradi. Ikkalasi boshqa ehtiyoj.
       */
      startRepeatTrip: (source) =>
        set({
          ...initialFields(),
          from: source.from,
          fromCoords: source.fromCoords,
          to: source.to,
          toCoords: source.toCoords,
          seats: source.seats ?? initialFields().seats,
          price: source.price ?? 0,
          hasAC: source.hasAC ?? true,
          hasLuggage: source.hasLuggage ?? true,
          acceptsParcel: source.acceptsParcel ?? false,
          noSmoking: source.noSmoking ?? false,
          noPets: source.noPets ?? false,
          drivingSpeed: source.drivingSpeed ?? 'normal',
          maxTwoBack: source.maxTwoBack ?? false,
          musicTaste: normalizeMusic(source.musicTaste),
          // Cheklov ham KO'CHIRILADI: bir marta «faqat ayollar» deb
          // yozgan haydovchi odatda buni doim qiladi.
          genderRestriction: source.genderRestriction ?? '',
          // Uchrashuv nuqtasi KO'CHIRILADI: yo'nalish o'sha, demak
          // yig'ilish joyi ham o'sha bo'lishi ehtimoli katta.
          pickupPoint: source.pickupPoint ?? '',
          pickupCoords: source.pickupCoords ?? null,
          step: 2,
          date: tashkentNow().date,
          time: '',
        }),
      startReturnTrip: (source) =>
        set({
          ...initialFields(),
          // Teskari yo'nalish.
          from: source.to,
          fromCoords: source.toCoords,
          to: source.from,
          toCoords: source.fromCoords,
          seats: source.seats ?? initialFields().seats,
          price: source.price ?? 0,
          hasAC: source.hasAC ?? true,
          hasLuggage: source.hasLuggage ?? true,
          acceptsParcel: source.acceptsParcel ?? false,
          noSmoking: source.noSmoking ?? false,
          noPets: source.noPets ?? false,
          drivingSpeed: source.drivingSpeed ?? 'normal',
          maxTwoBack: source.maxTwoBack ?? false,
          musicTaste: normalizeMusic(source.musicTaste),
          // Cheklov ham KO'CHIRILADI: bir marta «faqat ayollar» deb
          // yozgan haydovchi odatda buni doim qiladi.
          genderRestriction: source.genderRestriction ?? '',
          // Sana/vaqt qadamidan boshlanadi — qaytish vaqti ALBATTA yangisi.
          step: 2,
          date: tashkentNow().date,
          time: '',
        }),
    }),
    { name: 'create-trip-draft' }
  )
);
