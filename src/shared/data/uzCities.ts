// O'zbekiston asosiy shaharlarining BARQAROR (curated) koordinatalari.
//
// Nega kerak: backend qidiruvi jo'nash/manzil nuqtasini KOORDINATA RADIUSI bo'yicha
// filtrlaydi (shahar nomi bo'yicha emas). Ilgari koordinata ikkala tomonda ham (e'lon
// yaratish + qidiruv) Nominatim'dan matn orqali olinardi — bir xil "Toshkent" ikki xil
// koordinata berib, e'lon yo'lovchi radiusidan tashqarida qolib qidiruvda ko'rinmasdi.
// Endi ma'lum shahar nomi HAR IKKI tomonda ham AYNAN shu ro'yxatdagi bitta koordinataga
// aylanadi → radius kafolatli mos keladi. Ro'yxatda yo'q joylar uchun Nominatim fallback.
//
// Koordinatalar shahar markaziga yaqin; aniqlik radius uchun yetarli (metr aniqligi shart emas).

export type CityCoord = [number, number]; // [lat, lon]

interface CityEntry {
  /** Ko'rsatiladigan kanonik nom (lotin, o'zbekcha). */
  name: string;
  coord: CityCoord;
  /** Muqobil yozuvlar: o'zbekcha apostrofli, ruscha kirill, keng tarqalgan variantlar. */
  aliases: string[];
}

// DIQQAT: Toshkent koordinatasi search/create default [41.311081, 69.240562] bilan AYNAN mos —
// "qayerdan" bo'sh qoldirilganda ham (default Toshkent) yozib tanlanganda ham bir xil bo'lsin.
const CITIES: CityEntry[] = [
  { name: 'Toshkent', coord: [41.311081, 69.240562], aliases: ['tashkent', 'ташкент'] },
  // Nurafshon — eski nomi To'ytepa. Alias'da lotin `то'ytepa` bor edi: `то` KIRILLCHA,
  // `ytepa` lotincha — bunday aralash yozuvni hech kim termaydi, ya'ni o'lik alias edi.
  {
    name: 'Nurafshon',
    coord: [41.0139, 69.3608],
    aliases: ['нурафшон', 'tuytepa', "to'ytepa", 'туйтепа'],
  },
  { name: 'Samarqand', coord: [39.6542, 66.9597], aliases: ['samarkand', 'самарканд'] },
  { name: 'Buxoro', coord: [39.7681, 64.421], aliases: ['bukhara', 'buxara', 'бухара'] },
  { name: 'Andijon', coord: [40.7821, 72.3442], aliases: ['andijan', 'андижан'] },
  { name: 'Namangan', coord: [41.0058, 71.6436], aliases: ['наманган'] },
  { name: "Farg'ona", coord: [40.3894, 71.7867], aliases: ['fargona', 'fergana', 'фергана'] },
  { name: "Qo'qon", coord: [40.5389, 70.9425], aliases: ['qoqon', 'kokand', 'коканд'] },
  { name: "Marg'ilon", coord: [40.4711, 71.7247], aliases: ['margilon', 'margilan', 'маргилан'] },
  { name: 'Navoiy', coord: [40.0994, 65.3792], aliases: ['navoi', 'навои'] },
  { name: 'Zarafshon', coord: [41.5789, 64.205], aliases: ['zarafshan', 'зарафшан'] },
  { name: 'Qarshi', coord: [38.8606, 65.7989], aliases: ['karshi', 'карши'] },
  { name: 'Shahrisabz', coord: [39.0578, 66.8342], aliases: ['shakhrisabz', 'шахрисабз'] },
  { name: 'Termiz', coord: [37.2242, 67.2783], aliases: ['termez', 'термез'] },
  { name: 'Denov', coord: [38.2669, 67.8931], aliases: ['denau', 'денау'] },
  { name: 'Jizzax', coord: [40.125, 67.8422], aliases: ['jizzakh', 'djizak', 'джизак'] },
  { name: 'Guliston', coord: [40.4897, 68.7842], aliases: ['gulistan', 'гулистан'] },
  // `xiva` alias'i olib tashlandi — nomning O'ZI bilan bir xil kalitga tushardi.
  { name: 'Xiva', coord: [41.3775, 60.3619], aliases: ['khiva', 'хива'] },
  { name: 'Urganch', coord: [41.5506, 60.6314], aliases: ['urgench', 'ургенч'] },
  { name: 'Nukus', coord: [42.4611, 59.6111], aliases: ['нукус'] },
  { name: 'Angren', coord: [41.0167, 70.1436], aliases: ['ангрен'] },
  { name: 'Chirchiq', coord: [41.4689, 69.5822], aliases: ['chirchik', 'чирчик'] },
  { name: 'Olmaliq', coord: [40.8447, 69.5983], aliases: ['almalyk', 'алмалык'] },
  { name: 'Bekobod', coord: [40.2206, 69.2683], aliases: ['bekabad', 'бекабад'] },
  { name: 'Kogon', coord: [39.7228, 64.5528], aliases: ['kagan', 'коган', 'каган'] },
  // Qo'shimcha yirik shahar/tuman markazlari (viloyatlar bo'yicha).
  { name: "Yangiyo'l", coord: [41.1122, 69.0483], aliases: ['yangiyol', 'янгиюль'] },
  { name: 'Ohangaron', coord: [40.9078, 69.6386], aliases: ['ahangaran', 'ахангаран'] },
  { name: 'Chinoz', coord: [40.9369, 68.7639], aliases: ['chinaz', 'чиназ'] },
  { name: 'Gazalkent', coord: [41.5583, 69.7736], aliases: ['газалкент'] },
  { name: "Kattaqo'rg'on", coord: [39.8994, 66.2683], aliases: ['kattakurgan', 'каттакурган'] },
  { name: 'Urgut', coord: [39.4008, 67.2439], aliases: ['ургут'] },
  { name: "G'ijduvon", coord: [40.1044, 64.6797], aliases: ['gijduvon', 'гиждуван'] },
  { name: 'Beruniy', coord: [41.6889, 60.7517], aliases: ['beruni', 'беруни'] },
  { name: "To'rtko'l", coord: [41.55, 61.0], aliases: ['turtkul', 'турткуль'] },
  { name: "Xo'jayli", coord: [42.3956, 59.4506], aliases: ['khodjeyli', 'ходжейли'] },
  { name: 'Chimboy', coord: [42.9389, 59.7717], aliases: ['chimbay', 'чимбай'] },
  { name: "Mo'ynoq", coord: [43.7683, 59.0219], aliases: ['muynak', 'муйнак'] },
  { name: 'Uchquduq', coord: [42.155, 63.5567], aliases: ['uchkuduk', 'учкудук'] },
  { name: 'Nurota', coord: [40.5636, 65.6889], aliases: ['nurata', 'нурата'] },
  { name: 'Kitob', coord: [39.13, 66.8817], aliases: ['kitab', 'китаб'] },
  { name: 'Koson', coord: [39.0403, 65.5878], aliases: ['kasan', 'касан'] },
  { name: 'Boysun', coord: [38.2044, 67.1994], aliases: ['baysun', 'байсун'] },
  { name: 'Zomin', coord: [39.9628, 68.3956], aliases: ['zaamin', 'заамин'] },
  { name: 'Chust', coord: [41.0069, 71.2381], aliases: ['чуст'] },
  { name: 'Rishton', coord: [40.3567, 71.2828], aliases: ['rishtan', 'риштан'] },
  { name: 'Quvasoy', coord: [40.2989, 71.9739], aliases: ['kuvasay', 'кувасай'] },
  { name: 'Asaka', coord: [40.6417, 72.2394], aliases: ['асака'] },
  { name: 'Shahrixon', coord: [40.7139, 72.0561], aliases: ['shakhrikhan', 'шахрихан'] },
  { name: 'Yangiyer', coord: [40.2683, 68.8256], aliases: ['янгиер'] },
];

// O'zbekcha kelishik qo'shimchalari (uzunidan boshlab) — "Toshkentdan" -> "Toshkent".
const CASE_SUFFIXES = ['gacha', 'ning', 'niki', 'dan', 'ga', 'ka', 'qa', 'da', 'ta', 'ni'];
const ADMIN_SUFFIX =
  /\s+(shahri|shahar|viloyati|viloyat|tumani|tuman|district|region|city|oblast)$/i;

/** Nomni taqqoslash uchun kalitga aylantiradi: kichik harf, apostrof/ma'muriy qo'shimchasiz. */
function normalizeKey(input: string): string {
  let s = (input || '').toLowerCase().trim();
  s = s.split(',')[0].trim(); // "Toshkent, O'zbekiston" -> "Toshkent"
  s = s.replace(/[ʻʼ'`ʹ‘’]/g, ''); // farg'ona -> fargona, qo'qon -> qoqon
  s = s.replace(ADMIN_SUFFIX, '').trim();
  s = s.replace(/\s+/g, ' ');
  return s;
}

/**
 * O'ZBEK KIRILLIDAN LOTINGA: "Тошкентдан" -> "toshkentdan".
 *
 * 🔴 NEGA YOZILDI (egasi, 2026-08-25: «ovozdan olingan natija qidiruvga
 * qo'yilmayapti»): ro'yxatda faqat LOTIN va RUSCHA nomlar bor edi, o'zbek
 * KIRILLI umuman yo'q. O'lchab ko'rildi — bularning hech biri topilmasdi:
 *
 *   Тошкент, Бухоро, Андижон, Фарғона, Қўқон, Урганч, Қарши, Термиз,
 *   Жиззах, Гулистон, Навоий, Чирчиқ, Олмалиқ, Бекобод, Самарқанд
 *
 * Ishlaganlari faqat ruscha yozilishi bilan ustma-ust tushganlari edi
 * (Самарканд, Наманган, Нукус) — shuning uchun xato uzoq payqalmadi.
 *
 * Ikki joyni birdan buzardi: ovozli qidiruv (brauzer `uz-UZ` da kirill
 * qaytaradi) va kirill klaviaturada yozadigan odam.
 *
 * ⚠️ Ruscha nomlarga TEGMAYDI: faqat aniq moslash va kelishik kesish
 * ishlamagandan keyin chaqiriladi.
 *
 * ⚠️ Ilovadagi juftligi: `lib/core/cities.dart` dagi `uzLatinise`.
 * Birida o'zgartirsang — ikkinchisida ham.
 */
const UZ_CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ғ: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  қ: 'q',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ў: 'o',
  ф: 'f',
  х: 'x',
  ҳ: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ы: 'i',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/**
 * XARITADA ko'rsatiladigan YIRIK shaharlar (16.09.2026).
 *
 * 🔴 NEGA CHEKLANGAN: ro'yxatda 60 dan ortiq joy bor (shahar + tuman).
 * Hammasini landing xaritasiga chizsak, O'zbekiston miqyosidagi kadrda
 * nuqtalar bir-birining ustiga tushib, o'qib bo'lmaydigan tugunga
 * aylanadi (Farg'ona vodiysida ayniqsa). Bu ro'yxat — viloyat
 * markazlari va yirik shaharlar: ular bir-biridan yetarlicha uzoqda.
 *
 * `CITIES` dagi koordinata BILAN BIR XIL manba — ikkinchi ro'yxat
 * yaratmaymiz (loyiha qoidasi: bir ma'lumot, bir manba).
 */
const MAJOR = [
  'Toshkent',
  'Samarqand',
  'Buxoro',
  'Andijon',
  'Namangan',
  "Farg'ona",
  'Navoiy',
  'Qarshi',
  'Termiz',
  'Nukus',
  'Urganch',
  'Jizzax',
  'Guliston',
  'Xiva',
  'Shahrisabz',
  "Qo'qon",
];

export function majorCities(): Array<{ name: string; coord: CityCoord }> {
  const out: Array<{ name: string; coord: CityCoord }> = [];
  for (const name of MAJOR) {
    const hit = CITIES.find((c) => c.name === name);
    // Nom o'zgarsa JIMGINA tushib qolmasin — ro'yxat kodda, xato ham
    // kodda tuzatiladi. Shuning uchun shunchaki o'tkazib yuboramiz:
    // xarita bitta shaharsiz ham ishlaydi.
    if (hit) out.push({ name: hit.name, coord: hit.coord });
  }
  return out;
}

const ANY_CYRILLIC = /[\u0400-\u04FF]/;

/** Kirill harflarni lotinga o'giradi. Kirill yo'q bo'lsa matn O'ZGARMAYDI. */
export function uzLatinise(input: string): string {
  if (!input || !ANY_CYRILLIC.test(input)) return input;
  let out = '';
  for (const ch of input.toLowerCase()) out += UZ_CYRILLIC_TO_LATIN[ch] ?? ch;
  return out;
}

/** Kelishik qo'shimchasini olib tashlaydi (agar bo'lsa): "toshkentga" -> "toshkent". */
function stripCase(key: string): string {
  for (const suf of CASE_SUFFIXES) {
    if (key.length > suf.length + 2 && key.endsWith(suf)) {
      return key.slice(0, -suf.length);
    }
  }
  return key;
}

// normalizatsiya qilingan alias -> entry
const LOOKUP = new Map<string, CityEntry>();
for (const c of CITIES) {
  LOOKUP.set(normalizeKey(c.name), c);
  for (const a of c.aliases) LOOKUP.set(normalizeKey(a), c);
}

/**
 * Shahar nomini (yozilishidan qat'i nazar) barqaror koordinataga aylantiradi.
 * Topilmasa null — chaqiruvchi Nominatim'ga fallback qilishi mumkin.
 */
/**
 * 🔴 `resolveCityDetailed` ga TAYANADI (2026-08-25): ilgari bu funksiyaning
 * o'z qisqartirilgan mantig'i bor edi — kirill taxminini ham, kirilldan
 * lotinga o'girishni ham bilmasdi. Bir xil matn bir joyda topilib, boshqa
 * joyda topilmasdi. Ikki manba = ikki xil javob.
 */
export function resolveCityCoord(name: string): { name: string; coord: CityCoord } | null {
  const hit = resolveCityDetailed(name);
  return hit ? { name: hit.name, coord: hit.coord } : null;
}

/**
 * Koordinataga eng yaqin kanonik shahar nomi — TARMOQSIZ (offline).
 *
 * Nega kerak: backend posilkada manzil MATNINI saqlamaydi (faqat lat/lon), shu
 * sabab ro'yxatda "— → —" chiqardi. Reverse-geocode qilish har qator uchun tashqi
 * so'rov degani va nomlar "suzib" ketardi. Bu yerda esa aksincha: e'lon
 * yaratishda shahar nomi AYNAN shu ro'yxatdagi koordinataga aylantiriladi
 * (`resolveCityCoord`), demak teskari moslashtirish o'sha nomni QAYTA beradi.
 *
 * `maxKm` dan uzoq bo'lsa null — yolg'on nom ko'rsatmaymiz.
 */
export function nearestCityName(
  lat: number | null | undefined,
  lon: number | null | undefined,
  maxKm = 35
): string | null {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  let best: { name: string; km: number } | null = null;
  for (const c of CITIES) {
    // Oddiy tekis yaqinlashuv — O'zbekiston kengliklarida xatosi bir necha yuz metr,
    // shahar tanlash uchun yetarli va haversine'dan tez (ro'yxat har qatorda kezadi).
    const dLat = (c.coord[0] - lat) * 111.32;
    const dLon = (c.coord[1] - lon) * 111.32 * Math.cos((lat * Math.PI) / 180);
    const km = Math.sqrt(dLat * dLat + dLon * dLon);
    if (!best || km < best.km) best = { name: c.name, km };
  }
  return best && best.km <= maxKm ? best.name : null;
}

/** Autocomplete uchun: yozuvga mos curated shaharlar (eng ko'pi `limit` ta). */
export function searchCities(query: string, limit = 6): Array<{ name: string; coord: CityCoord }> {
  const normalized = normalizeKey(query);
  if (normalized.length < 1) return [];

  // Ikki kalit bo'yicha izlaymiz: yozilgani va uning LOTIN o'girmasi.
  // Kirillda yozadigan odam ("тошкент") ilgari HECH NIMA topmasdi —
  // ro'yxatdagi kalitlar lotin, uning so'rovi esa kirill edi.
  const latin = normalizeKey(uzLatinise(normalized));
  const queries = [...new Set([stripCase(normalized), stripCase(latin)])].filter(Boolean);
  if (queries.length === 0) return [];

  const starts: CityEntry[] = [];
  const includes: CityEntry[] = [];
  const seen = new Set<string>();
  for (const c of CITIES) {
    if (seen.has(c.name)) continue;
    const keys = [normalizeKey(c.name), ...c.aliases.map(normalizeKey)];
    if (keys.some((k) => queries.some((q) => k.startsWith(q)))) {
      starts.push(c);
      seen.add(c.name);
    } else if (keys.some((k) => queries.some((q) => k.includes(q)))) {
      includes.push(c);
      seen.add(c.name);
    }
  }
  return [...starts, ...includes].slice(0, limit).map((c) => ({ name: c.name, coord: c.coord }));
}

/**
 * `resolveCityCoord` ning KENGAYTIRILGAN varianti — nom qanday topilganini
 * ham qaytaradi.
 *
 * NEGA KERAK: ovozli yo'nalish tahlili (`shared/lib/voiceRoute.ts`) yo'nalishni
 * aynan KELISHIK qo'shimchasidan biladi: "Toshkent**dan**" — jo'nash,
 * "Samarqand**ga**" — manzil. Oddiy `resolveCityCoord` ikkalasi uchun ham bir xil
 * natija beradi va bu ma'lumot yo'qoladi.
 *
 * `caseSuffix` FAQAT qo'shimcha haqiqatan kesilgan bo'lsa to'ladi. Ya'ni
 * nomning o'zi shu harflar bilan tugasa (masalan "Nuro**ta**") — u qo'shimcha
 * deb hisoblanmaydi, chunki aniq mos kelish AVVAL tekshiriladi.
 *
 * Uchinchi bosqich — KIRILL uchun taxminiy moslash. Ruscha kelishiklar
 * lotincha ro'yxatga tushmaydi ("Ташкент**а**", "Бухар**у**"), ularni
 * qo'shimchalar ro'yxati bilan sanab bo'lmaydi. Shuning uchun umumiy
 * o'zak solishtiriladi: farq 2 harfdan oshmasa — o'sha shahar.
 * Bu FAQAT kirillga tegishli, lotin nomlarga tegmaydi (u yerda kelishik
 * ro'yxati aniq ishlaydi va taxmin qilish xato natija berishi mumkin).
 */
export function resolveCityDetailed(
  name: string
): { name: string; coord: CityCoord; caseSuffix: string | null } | null {
  if (!name) return null;
  const key = normalizeKey(name);
  if (!key) return null;

  const exact = LOOKUP.get(key);
  if (exact) return { name: exact.name, coord: exact.coord, caseSuffix: null };

  const stripped = stripCase(key);
  const hit = LOOKUP.get(stripped);
  if (hit) {
    return { name: hit.name, coord: hit.coord, caseSuffix: key.slice(stripped.length) };
  }

  // 3. O'ZBEK KIRILLI -> lotin. Taxminiy moslashdan (4-bosqich) OLDIN:
  //    o'girish ANIQ, taxmin esa taxmin. "Тошкентдан" bu yerda
  //    "toshkentdan" bo'ladi va kelishik ham to'g'ri kesiladi.
  const latin = normalizeKey(uzLatinise(key));
  if (latin !== key) {
    const latinExact = LOOKUP.get(latin);
    if (latinExact) {
      return { name: latinExact.name, coord: latinExact.coord, caseSuffix: null };
    }
    const latinStripped = stripCase(latin);
    const latinHit = LOOKUP.get(latinStripped);
    if (latinHit) {
      return {
        name: latinHit.name,
        coord: latinHit.coord,
        caseSuffix: latin.slice(latinStripped.length),
      };
    }
  }

  if (!/^[Ѐ-ӿ\s]+$/.test(key)) return null;
  for (const [candidateKey, entry] of LOOKUP) {
    if (!/^[Ѐ-ӿ\s]+$/.test(candidateKey)) continue;
    let shared = 0;
    while (
      shared < key.length &&
      shared < candidateKey.length &&
      key[shared] === candidateKey[shared]
    ) {
      shared += 1;
    }
    // O'zak yetarlicha uzun VA ikkala tomonda ham ortiqcha qism kichik bo'lsin:
    // "ташкента"/"ташкент" (7/7/8) mos, "навои"/"наманган" (3/5/8) mos emas.
    if (shared >= 5 && candidateKey.length - shared <= 2 && key.length - shared <= 2) {
      return { name: entry.name, coord: entry.coord, caseSuffix: null };
    }
  }
  return null;
}
