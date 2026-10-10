/**
 * JOY NOMLARI QO'RIQCHISI — sayt va ilova bir xil tushunishi shart.
 *
 * 🔴 NEGA YOZILDI (egasi, 2026-08-25: «ovozdan olingan natija qidiruvga
 * qo'yilmayapti»): joylar ro'yxatida faqat LOTIN va RUSCHA nomlar bor edi,
 * o'zbek KIRILLI umuman yo'q. «Самарканд» va «Наманган» ruscha yozilishi
 * bilan ustma-ust tushgani uchun ishlayotgandek KO'RINARDI, «Тошкент» va
 * «Бухоро» esa topilmasdi. Bu ovozli qidiruvni ham (brauzer `uz-UZ` da
 * kirill qaytaradi), kirill klaviaturada yozadigan odamni ham to'sardi.
 *
 * Ilovada bu `test/places_test.dart` va `test/voice_route_test.dart` bilan
 * qulflangan. Saytda unit-test yurituvchisi yo'q, shuning uchun shu skript —
 * `pnpm test:cities` (pre-commit'da ham ishlaydi).
 */
import { resolveCityCoord, searchCities } from '../src/shared/data/uzCities';
import { parseVoiceRoute } from '../src/shared/lib/voiceRoute';

let failed = 0;
const check = (label: string, actual: string | undefined, expected: string) => {
  if (actual === expected) return;
  failed += 1;
  console.error(`❌ ${label}: kutilgan «${expected}», olingan «${actual}»`);
};

// 1. O'zbek kirilli — shaharlar.
const CYRILLIC = {
  Тошкент: 'Toshkent',
  Самарқанд: 'Samarqand',
  Бухоро: 'Buxoro',
  Андижон: 'Andijon',
  Фарғона: "Farg'ona",
  Қўқон: "Qo'qon",
  Урганч: 'Urganch',
  Қарши: 'Qarshi',
  Термиз: 'Termiz',
  Жиззах: 'Jizzax',
  Гулистон: 'Guliston',
  Навоий: 'Navoiy',
  Чирчиқ: 'Chirchiq',
  Олмалиқ: 'Olmaliq',
  Бекобод: 'Bekobod',
};
for (const [cyrillic, latin] of Object.entries(CYRILLIC)) {
  check(cyrillic, resolveCityCoord(cyrillic)?.name, latin);
}

// 2. Kelishik qo'shimchasi bilan.
check('Тошкентдан', resolveCityCoord('Тошкентдан')?.name, 'Toshkent');
check('Самарқандга', resolveCityCoord('Самарқандга')?.name, 'Samarqand');

// 3. RUSCHA nomlar buzilmasin — o'girish ular ishlamagandan keyin chaqiriladi.
check('Ташкент', resolveCityCoord('Ташкент')?.name, 'Toshkent');
check('Ташкента', resolveCityCoord('Ташкента')?.name, 'Toshkent');
check('Самарканд', resolveCityCoord('Самарканд')?.name, 'Samarqand');

// 4. Ro'yxat filtri kirillda.
check('filtr: тошкент', searchCities('тошкент', 1)[0]?.name, 'Toshkent');
check('filtr: чирчиқ', searchCities('чирчиқ', 1)[0]?.name, 'Chirchiq');

// 5. Ovozli yo'nalish — ilovadagi `test/voice_route_test.dart` bilan bir xil.
const ROUTES = [
  ['Тошкентдан Самарқандга', 'Toshkent', 'Samarqand'],
  ['Самарқандга Тошкентдан', 'Toshkent', 'Samarqand'],
  ['Toshkent dan Samarqand ga', 'Toshkent', 'Samarqand'],
  ['Samarqand ga Toshkent dan', 'Toshkent', 'Samarqand'],
  ['Фарғонадан Тошкентга', "Farg'ona", 'Toshkent'],
  ['из Ташкента в Самарканд', 'Toshkent', 'Samarqand'],
  ['from Tashkent to Samarkand', 'Toshkent', 'Samarqand'],
];
for (const [text, from, to] of ROUTES) {
  const route = parseVoiceRoute(text);
  check(`«${text}» jo'nash`, route?.from?.name, from);
  check(`«${text}» manzil`, route?.to?.name, to);
}

if (failed > 0) {
  console.error(`\n${failed} ta tekshiruv yiqildi.`);
  process.exit(1);
}
console.log(`✅ Joy nomlari: ${Object.keys(CYRILLIC).length} kirill shahar, ${ROUTES.length} ovozli yo'nalish — hammasi to'g'ri.`);
