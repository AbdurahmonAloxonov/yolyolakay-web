/**
 * LOTINDAN KIRILLGA — o'zbek matnini o'giradi.
 *
 * 🔴 NEGA (2026-09-08): O'zbekistonda katta yoshli qatlam aynan
 * kirillda o'qiydi. Saytda 1005 ta `tr(uz, ru, en)` chaqiruvi bor —
 * ularning har biriga to'rtinchi argument qo'shish 1005 ta joyni
 * tahrirlash degani edi. O'zbek lotini va kirili bir-biriga qat'iy
 * mos, ya'ni o'girish MEXANIK: bitta funksiya yetadi.
 *
 * ⚠️ ILOVADAGI JUFTLIGI: `lib/l10n/cyrillic.dart`. Qoidalar AYNAN bir
 * xil bo'lishi shart — aks holda bir xil matn saytda va ilovada
 * boshqacha yozilib qoladi. Qoida o'zgarsa IKKALASI ham o'zgaradi;
 * `cyrillic.test.ts` va `cyrillic_test.dart` ham juft yuradi.
 *
 * ⚠️ FAQAT BIZNING MATNIMIZ uchun. Foydalanuvchi yozgani (ism,
 * manzil, chat) HECH QACHON o'girilmaydi: «John» → «Жоҳн» bo'lardi.
 */

/** Ikki harfli birikmalar — birinchi tekshiriladi (`sh` dan oldin `s` olsak «сҳ»). */
const DIGRAPHS: Record<string, string> = {
  yo: 'ё',
  yu: 'ю',
  ya: 'я',
  ye: 'е',
  sh: 'ш',
  ch: 'ч',
  ts: 'ц',
};

const SINGLE: Record<string, string> = {
  a: 'а',
  b: 'б',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'ҳ',
  i: 'и',
  j: 'ж',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'қ',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  x: 'х',
  y: 'й',
  z: 'з',
  // Tutuq belgisi — barcha ko'rinishlarida.
  "'": 'ъ',
  '‘': 'ъ',
  '’': 'ъ',
  ʼ: 'ъ',
  ʻ: 'ъ',
};

/** Apostrofning barcha ko'rinishlari — matnda aralash uchraydi. */
const APOSTROPHES = "'‘’ʼʻ";

/**
 * LOTINCHA QOLADIGAN so'zlar.
 *
 * 🔑 Kirillda ham lotincha yoziladi: odam «SMS» ni aynan shu
 * ko'rinishda taniydi, brend nomi esa har qanday tilda bir xil.
 */
const KEEP_LATIN = new Set([
  'yolyolakay',
  'myid',
  'sms',
  'id',
  'play',
  'google',
  'telegram',
  'click',
  'payme',
  'wi-fi',
  'gps',
  'ok',
  'bc',
  'pro',
  'plus',
  'premium',
  'free',
  'trial',
]);

function word(w: string): string {
  if (KEEP_LATIN.has(w.toLowerCase())) return w;
  // Bitta lotin harfi — format namunasi («01 A 123 BC»), so'z emas.
  if (w.length === 1 && /[A-Za-z]/.test(w)) return w;

  const low = w.toLowerCase();
  let out = '';
  let i = 0;

  while (i < low.length) {
    /*
     * 🔴 «yo'» — bu «ё» EMAS, y + o' = «йў» (yo'l → йўл).
     *
     * ⚠️ `low[i + 2] ?? ''` YOZIB BO'LMAYDI: JavaScript'da
     * `'...'.includes('')` HAR DOIM `true`. Ya'ni so'z oxiridagi «yo»
     * ham apostrofli deb hisoblanardi. Aynan shu xato «Buxoro» ni
     * «Бухорў» qilib qo'ygandi (saytda ko'z bilan ko'rildi).
     * Dart nusxasida bu yo'q — u uzunlikni tekshiradi.
     */
    if (
      i + 2 < low.length &&
      low[i] === 'y' &&
      low[i + 1] === 'o' &&
      APOSTROPHES.includes(low[i + 2])
    ) {
      out += 'йў';
      i += 3;
      continue;
    }

    // ⚠️ Uzunlik tekshiruvi SHART (yuqoridagi izoh) — usiz so'z
    // oxiridagi «o» va «g» ham ў/ғ bo'lib ketardi.
    if (i + 1 < low.length && APOSTROPHES.includes(low[i + 1])) {
      if (low[i] === 'o') {
        out += 'ў';
        i += 2;
        continue;
      }
      if (low[i] === 'g') {
        out += 'ғ';
        i += 2;
        continue;
      }
    }

    const pair = low.slice(i, i + 2);
    if (pair.length === 2 && DIGRAPHS[pair]) {
      out += DIGRAPHS[pair];
      i += 2;
      continue;
    }

    // So'z boshidagi «e» → «э» (eshik → эшик), o'rtada → «е» (kel → кел).
    if (low[i] === 'e' && i === 0) {
      out += 'э';
      i += 1;
      continue;
    }

    out += SINGLE[low[i]] ?? low[i];
    i += 1;
  }

  // TO'LIQ KATTA yozuv — urg'u vositasi, saqlanadi.
  if (w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase()) {
    return out.toUpperCase();
  }
  if (w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase()) {
    return out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

const WORD = new RegExp(`[A-Za-z${APOSTROPHES}]+`, 'g');

/** Matnni kirillga o'giradi. Raqam va tinish belgisi tegilmaydi. */
export const toCyrillic = (text: string): string => text.replace(WORD, word);

/**
 * Obyekt ichidagi HAMMA satrni o'giradi (tarjima fayllari uchun).
 *
 * 🔑 `messages/uz-cyrl.json` YARATILMAYDI: u `uz.json` dan runtime'da
 * hosil bo'ladi. Ikkinchi fayl bo'lsa, ertaga birini tuzatib
 * ikkinchisini unutish muqarrar edi.
 */
export function deepCyrillic<T>(value: T): T {
  if (typeof value === 'string') return toCyrillic(value) as T;
  if (Array.isArray(value)) return value.map(deepCyrillic) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepCyrillic(v)])
    ) as T;
  }
  return value;
}
