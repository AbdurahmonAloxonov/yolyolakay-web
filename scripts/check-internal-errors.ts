/**
 * ICHKI XATO EKRANGA CHIQMASIN — commit oldidan tekshiriladi.
 *
 * 🔴 NEGA (egasi qurilmada ko'rdi, 2026-08-27): backend `cars` jadvalida
 * ustun yetishmagani uchun xom Postgres xatosini qaytardi va u haydovchi
 * bo'lish oqimining OXIRIDA ekranga chiqdi:
 *
 *   «Xatolik: ERROR: column "tech_passport_front" of relation "cars"
 *    does not exist (SQLSTATE 42703)»
 *
 * Odam butun formani to'ldirib, yettita suratni yuklab bo'lgach shuni
 * o'qidi. Uch tomonlama zarar: odam tushunmaydi, bizning UI orqali
 * backendning jadval va ustun nomlari oshkor bo'ladi, aybdor esa sayt
 * bo'lib ko'rinadi.
 *
 * Xato UCH xil joydan chiqardi va har birini alohida topish kerak bo'ldi.
 * Shuning uchun tekshiruv endi avtomatik: bu skript ikki narsani
 * ta'minlaydi —
 *   1) `isInternalBackendError` haqiqiy xato matnlarini TUTADI;
 *   2) foydali xabarlar («narx juda past») TUTILMAYDI — ular odamga
 *      umumiy jumladan foydaliroq.
 *
 * Mobil juftligi: `test/internal_error_hidden_test.dart`.
 */
import { isInternalBackendError, userFacingError } from '../src/shared/lib/format';

// Jonli o'lchangan HAQIQIY matnlar (27.08.2026).
const MUST_HIDE = [
  'ERROR: column "tech_passport_front" does not exist (SQLSTATE 42703)',
  'ERROR: column "tech_passport_front" of relation "cars" does not exist (SQLSTATE 42703)',
  'car check failed: user car error: ERROR: column "tech_passport_front" does not exist',
  "can't scan into dest[1] (col: event_date): cannot scan date (OID 1082) in binary format into *string",
  'pq: duplicate key value violates unique constraint',
  'dial tcp 10.0.0.5:5432: connect: connection refused',
  'runtime error: invalid memory address or nil pointer dereference',
];

// Bularni YASHIRISH noto'g'ri: odam nima qilishini shulardan biladi.
const MUST_SHOW = [
  'offered price is too low',
  'ride is already full',
  'booking not found for this ride',
  'invalid otp code',
  'subscription expired',
];

const FALLBACK = 'Umumiy xabar';
let failed = false;

for (const msg of MUST_HIDE) {
  if (!isInternalBackendError(msg)) {
    console.error(`❌ TUTILMADI: ${msg}`);
    failed = true;
  }
  if (userFacingError(msg, FALLBACK) !== FALLBACK) {
    console.error(`❌ EKRANGA CHIQADI: ${msg}`);
    failed = true;
  }
}

for (const msg of MUST_SHOW) {
  if (isInternalBackendError(msg)) {
    console.error(`❌ FOYDALI XABAR YASHIRILDI: ${msg}`);
    failed = true;
  }
  if (userFacingError(msg, FALLBACK) !== msg) {
    console.error(`❌ FOYDALI XABAR YO'QOLDI: ${msg}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nIchki xato ekranga chiqishi mumkin — tuzatilsin.');
  process.exit(1);
}

console.log(
  `✅ Ichki xatolar: ${MUST_HIDE.length} ta yashirildi, ${MUST_SHOW.length} ta foydali xabar qoldi.`
);
