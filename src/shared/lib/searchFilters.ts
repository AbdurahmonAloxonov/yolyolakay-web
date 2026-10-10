/**
 * QIDIRUV FILTRLARI — localStorage'da saqlanadi.
 *
 * 🔴 NEGA (2026-09-05, qulaylik auditining 4-darajasi: «ilova bir marta
 * aytilgan narsani ikkinchi marta so'raydimi»): filtrlar har ochilishda
 * nolga qaytardi. Chekmaydigan odam yoki konditsioner shart bo'lgan odam
 * ularni HAR SAFAR qaytadan belgilardi.
 *
 * 🔑 NARX ATAYIN SAQLANMAYDI. Qulaylik xohishi ODAMNIKI («men
 * chekmayman»), narx oralig'i esa YO'NALISHNIKI: «50–100 ming»
 * Toshkent–Samarqandda ma'noli, Toshkent–Andijonda esa hamma safarni
 * jimgina yashirib qo'yadi — odam buni sezmaydi va «safar yo'q ekan»
 * deb o'ylaydi.
 *
 * Ilovadagi juftligi — `SearchFilters.toJson` (Flutter), AYNI qoida
 * bilan: qulaylik saqlanadi, narx yo'q.
 */

/** Saqlanadigan maydonlar — narx va boshqa ekran holati bu yerda YO'Q. */
export interface StoredFilters {
  /**
   * «Faqat ayollar» — SERVER filtri bo'lsa ham SAQLANADI: bu odamning
   * o'zi haqidagi doimiy xohishi («men notanish erkaklar bilan
   * ketmayman»), yo'nalishga bog'liq narx emas.
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

const KEY = 'search_filters';

const SPEEDS: StoredFilters['speed'][] = ['', 'calm', 'normal', 'fast'];
const SORTS: StoredFilters['sort'][] = ['distance', 'price', 'time'];

export const getStoredFilters = (): Partial<StoredFilters> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const o = parsed as Record<string, unknown>;
    const flag = (k: string) => (o[k] === true ? true : undefined);
    // ⚠️ Noma'lum qiymat JIM tashlanadi, xato emas: eski brauzerdagi
    // yozuv yangi versiyada uchrashi mumkin va u butun qidiruvni
    // yiqitmasligi kerak.
    const speed = SPEEDS.includes(o.speed as StoredFilters['speed'])
      ? (o.speed as StoredFilters['speed'])
      : undefined;
    const sort = SORTS.includes(o.sort as StoredFilters['sort'])
      ? (o.sort as StoredFilters['sort'])
      : undefined;
    const out: Partial<StoredFilters> = {};
    for (const k of [
      'women',
      'ac',
      'luggage',
      'noSmoking',
      'noPets',
      'twoBack',
      'parcel',
    ] as const) {
      const v = flag(k);
      if (v !== undefined) out[k] = v;
    }
    if (speed !== undefined) out.speed = speed;
    if (sort !== undefined) out.sort = sort;
    return out;
  } catch {
    return {};
  }
};

export const saveFilters = (f: StoredFilters): void => {
  if (typeof window === 'undefined') return;
  const empty =
    !f.ac &&
    !f.luggage &&
    !f.noSmoking &&
    !f.noPets &&
    !f.twoBack &&
    !f.parcel &&
    f.speed === '' &&
    f.sort === 'distance';
  try {
    if (empty) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* localStorage to'la/o'chirilgan — jim */
  }
};
