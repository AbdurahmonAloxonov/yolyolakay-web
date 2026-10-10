import { resolveCityDetailed, type CityCoord } from '@/shared/data/uzCities';

/**
 * OVOZLI YO'NALISH TAHLILI — bitta aytilgan gapdan IKKI shahar ajratadi.
 *
 * 🔴 NEGA YOZILDI (egasi, 2026-08-24): ovozli qidiruv faqat JO'NASH joyini
 * to'ldirardi. Odam "Toshkentdan Samarqandga" desa, butun gap "qayerdan"
 * maydoniga tushardi va "qayerga" bo'sh qolardi — qidiruv esa ishlamasdi.
 * Ya'ni funksiya bor-u, aytilgan gapning yarmi tashlab ketilardi.
 *
 * QOIDA: gapda ikki joy nomi bo'lsa — birinchisi jo'nash, ikkinchisi manzil.
 * Lekin TARTIB emas, GRAMMATIKA ustun turadi: "Samarqandga Toshkentdan
 * boraman" ham to'g'ri tushuniladi, chunki `-dan` jo'nashni, `-ga` manzilni
 * bildiradi.
 *
 * Uch tilning ko'rsatkichlari:
 *   • o'zbek — kelishik qo'shimchasi: `-dan` (jo'nash), `-ga/-ka/-qa/-gacha` (manzil);
 *   • rus    — old ko'makchi: `из/от/с` (jo'nash), `в/во/до/на/к` (manzil);
 *   • ingliz — `from` (jo'nash), `to` (manzil).
 *
 * ⚠️ HALOL CHEKLOV: nutqni tanish BRAUZERNING ishi. Bu fayl faqat TANILGAN
 * matnni bo'ladi. Bitta ham shahar topilmasa `null` qaytadi va chaqiruvchi
 * xom matnni maydonga qo'yadi — ya'ni eski xatti-harakat saqlanadi, hech nima
 * yo'qolmaydi.
 */

export interface VoicePlace {
  name: string;
  coord: CityCoord;
}

export interface VoiceRoute {
  from: VoicePlace | null;
  to: VoicePlace | null;
  /** Tanilgan joylar soni — chaqiruvchi "yarmi tushunildi" holatini ajratishi uchun. */
  matched: number;
}

/** Eng ko'p necha so'zli nom izlanadi ("Yangi Bozor" kabi qo'shma nomlar uchun). */
const MAX_NAME_WORDS = 3;

/** Jo'nashni bildiruvchi o'zbek kelishik qo'shimchalari (chiqish kelishigi). */
const FROM_SUFFIXES = ['dan'];

/** Manzilni bildiruvchi o'zbek kelishik qo'shimchalari (jo'nalish kelishigi). */
const TO_SUFFIXES = ['ga', 'ka', 'qa', 'gacha'];

/** Nomdan OLDIN turganda jo'nashni bildiruvchi so'zlar (rus/ingliz). */
const FROM_WORDS = new Set(['from', 'iz', 'ot', 'so', 's', 'из', 'от', 'с', 'со']);

/** Nomdan OLDIN turganda manzilni bildiruvchi so'zlar (rus/ingliz). */
const TO_WORDS = new Set(['to', 'v', 'vo', 'do', 'na', 'k', 'в', 'во', 'до', 'на', 'к']);

/**
 * Nomdan KEYIN alohida so'z bo'lib turgan kelishik qo'shimchalari.
 *
 * 🔴 NEGA (2026-08-25): nutqni tanish qo'shimchani nomdan AJRATIB yozadi —
 * "Toshkent dan Samarqand ga". O'lchab ko'rildi: "Samarqand ga Toshkent dan"
 * TESKARI tushunilardi (Samarqand → Toshkent), chunki hech qanday belgi
 * topilmay AYTILISH TARTIBI qoidasiga tushardi. Odam yo'nalishni aniq
 * aytgan edi — ilova uni eshitib turib, aksini qildi.
 */
const FROM_SUFFIX_WORDS = new Set(['dan', 'дан']);
const TO_SUFFIX_WORDS = new Set(['ga', 'ka', 'qa', 'gacha', 'га', 'ка', 'қа', 'гача']);

type Direction = 'from' | 'to' | null;

interface Candidate {
  place: VoicePlace;
  direction: Direction;
}

/**
 * Gapni so'zlarga bo'ladi. Ajratgich sifatida harf VA apostrofdan boshqa
 * hammasi ishlaydi: nutqni tanish vergul, nuqta va "→" ham qo'shib beradi.
 *
 * Apostrof SAQLANADI ("Farg'ona"), keyin `normalizeKey` uni o'zi tashlaydi.
 */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}ʻʼ'`ʹ‘’]+/u)
    .filter((w) => w.length > 0);
}

/**
 * Qo'shimchadan yo'nalishni aniqlaydi.
 *
 * `caseSuffix` ni `resolveCityDetailed` beradi va u FAQAT haqiqiy qo'shimcha
 * bo'lganda to'ladi (nomning o'zi shu harflar bilan tugasa — bo'sh).
 */
function directionFromSuffix(caseSuffix: string | null): Direction {
  if (!caseSuffix) return null;
  if (FROM_SUFFIXES.includes(caseSuffix)) return 'from';
  if (TO_SUFFIXES.includes(caseSuffix)) return 'to';
  return null;
}

/** Nomdan KEYINGI so'z yolg'iz kelishik qo'shimchasi bo'lsa. */
function directionFromNextWord(nextWord: string | undefined): Direction {
  if (!nextWord) return null;
  if (FROM_SUFFIX_WORDS.has(nextWord)) return 'from';
  if (TO_SUFFIX_WORDS.has(nextWord)) return 'to';
  return null;
}

/** Oldingi so'zdan yo'nalishni aniqlaydi (rus/ingliz old ko'makchilari). */
function directionFromMarker(previousWord: string | undefined): Direction {
  if (!previousWord) return null;
  if (FROM_WORDS.has(previousWord)) return 'from';
  if (TO_WORDS.has(previousWord)) return 'to';
  return null;
}

/**
 * Aytilgan gapdan yo'nalishni ajratadi. Bitta ham shahar tanilmasa `null`.
 *
 * Misollar (hammasi bir xil natija beradi):
 *   "Toshkentdan Samarqandga"          → Toshkent → Samarqand
 *   "Toshkent Samarqand"               → Toshkent → Samarqand
 *   "Samarqandga Toshkentdan boraman"  → Toshkent → Samarqand
 *   "из Ташкента в Самарканд"          → Toshkent → Samarqand
 *   "from Tashkent to Samarkand"       → Toshkent → Samarqand
 *   "Samarqandga"                      → (jo'nash bo'sh) → Samarqand
 */
export function parseVoiceRoute(text: string): VoiceRoute | null {
  const tokens = words(text || '');
  if (tokens.length === 0) return null;

  const candidates: Candidate[] = [];

  // Chapdan o'ngga yuramiz va eng UZUN mos nomni olamiz: "yangi bozor" ni
  // "yangi" deb kesib tashlamaslik uchun. Topilgan so'zlar iste'mol qilinadi.
  let i = 0;
  while (i < tokens.length) {
    let taken = 0;
    for (let span = Math.min(MAX_NAME_WORDS, tokens.length - i); span >= 1; span -= 1) {
      const phrase = tokens.slice(i, i + span).join(' ');
      const hit = resolveCityDetailed(phrase);
      if (!hit) continue;

      // Yo'nalish: avval qo'shimcha (o'zbek), keyin old ko'makchi (rus/ingliz).
      // Qo'shimcha ustun — u nomning O'ZIDA, ya'ni aniqroq dalil.
      // Dalillar kuchi bo'yicha: nomning O'ZIDAGI qo'shimcha → nomdan
      // KEYINGI alohida qo'shimcha → nomdan OLDINGI old ko'makchi.
      const direction =
        directionFromSuffix(hit.caseSuffix) ??
        directionFromNextWord(tokens[i + span]) ??
        directionFromMarker(tokens[i - 1]);
      candidates.push({ place: { name: hit.name, coord: hit.coord }, direction });
      taken = span;
      break;
    }
    i += taken > 0 ? taken : 1;
  }

  if (candidates.length === 0) return null;

  const explicitFrom = candidates.find((c) => c.direction === 'from') ?? null;
  const explicitTo = candidates.find((c) => c.direction === 'to') ?? null;

  // Ikkalasi ham aniq aytilgan — tartib ahamiyatsiz.
  if (explicitFrom && explicitTo && explicitFrom !== explicitTo) {
    return { from: explicitFrom.place, to: explicitTo.place, matched: candidates.length };
  }

  // Faqat bittasi aniq: qolgan (belgisiz) nomlardan ikkinchisini olamiz.
  if (explicitFrom || explicitTo) {
    const known = explicitFrom ?? explicitTo!;
    const other = candidates.find((c) => c !== known && c.place.name !== known.place.name) ?? null;
    return explicitFrom
      ? { from: known.place, to: other?.place ?? null, matched: candidates.length }
      : { from: other?.place ?? null, to: known.place, matched: candidates.length };
  }

  // Hech qanday belgi yo'q ("Toshkent Samarqand") — AYTILISH TARTIBI.
  // Bu qoida ataylab: odam "qayerdan qayerga" tartibida gapiradi.
  const unique = candidates.filter(
    (c, index) => candidates.findIndex((x) => x.place.name === c.place.name) === index
  );
  return {
    from: unique[0]?.place ?? null,
    to: unique[1]?.place ?? null,
    matched: unique.length,
  };
}
