/**
 * JONLI NUQTA — silliq harakat YOLG'ON gapirmaydimi?
 *
 * 🔴 NEGA YOZILDI (18.09.2026): nuqtani ikki ping orasida surish —
 * ko'rinishdan kichik o'zgarish, mohiyatdan esa MA'LUMOTGA ARALASHUV.
 * Ekranda mashina biz CHIZGAN joyda turadi, serverdan kelgan joyda
 * emas. Shuning uchun uchta qoida bor va ularning har biri jimgina
 * buzilishi mumkin:
 *
 *   • katta sakrash surilsa — mashina yo'q joydan «o'tib ketadi»;
 *   • eskirgan ping surilsa — aloqasi uzilgan mashina jonli ko'rinadi;
 *   • ekstrapolyatsiya qilinsa — biz joyni O'YLAB TOPGAN bo'lamiz.
 *
 * Bularning hech biri ekranda xato bo'lib ko'rinmaydi: harakat chiroyli,
 * ishonarli va NOTO'G'RI bo'ladi. Shu sabab tekshiruv matematikani
 * o'lchaydi.
 *
 * Ishga tushirish: `pnpm test:live-point` (pre-commit'da).
 */
import {
  MAX_SMOOTH_KM,
  STALE_MS,
  canSmooth,
  easeInOut,
  frameAt,
  lerpHeading,
  lerpPoint,
  pingAgeMs,
  type LivePoint,
} from '../src/shared/lib/livePosition';
import { haversineKm } from '../src/shared/lib/geo';

let failed = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) {
    console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
    failed += 1;
  }
};

const A: LivePoint = { lat: 41.2995, lon: 69.2401, heading: 200 };
/* ~1.2 km janubi-g'arbda — 100 km/soat bilan ~43 soniyalik yo'l,
   ya'ni ikki ping orasidagi ODATIY farq. */
const B: LivePoint = { lat: 41.2895, lon: 69.2301, heading: 210 };

console.log('\nJonli nuqta:');

/* ── 1. Oddiy harakat suriladi ─────────────────────────────────── */
const stepKm = haversineKm([A.lat, A.lon], [B.lat, B.lon]);
ok('sinov nuqtalari oqilona masofada', stepKm > 0.5 && stepKm < MAX_SMOOTH_KM, `${stepKm.toFixed(2)} km`);
ok('odatiy qadam SURILADI', canSmooth(A, B, { staleMs: 5_000 }));

/* ── 2. Katta sakrash SURILMAYDI ───────────────────────────────── */
const far: LivePoint = { lat: 39.6542, lon: 66.9597 }; // Samarqand
ok(
  'katta sakrash surilMAYDI',
  !canSmooth(A, far, { staleMs: 5_000 }),
  'GPS qayta ushlagan yoki aloqasiz yurib kelgan — bu harakat emas'
);

/* ── 3. Eskirgan ping SURILMAYDI ───────────────────────────────── */
ok('eskirgan ping surilMAYDI', !canSmooth(A, B, { staleMs: STALE_MS + 1 }));
ok('chegaradagi ping hali suriladi', canSmooth(A, B, { staleMs: STALE_MS - 1 }));
ok(
  "yoshi NOMA'LUM ping suriladi",
  canSmooth(A, B, { staleMs: null }),
  "`updated_at` ko'p javobda umuman kelmaydi — harakatni taqiqlash uchun asos emas"
);

/* ── 4. Joyida turgan nuqta ────────────────────────────────────── */
ok('qimirlamagan nuqta animatsiya QILINMAYDI', !canSmooth(A, { ...A }, { staleMs: 1_000 }));

/* ── 5. Kadrlar — boshi, o'rtasi, oxiri ────────────────────────── */
const f0 = frameAt(A, B, 0);
const f1 = frameAt(A, B, 1);
ok('boshida AYNAN eski nuqtada', Math.abs(f0.lat - A.lat) < 1e-9 && Math.abs(f0.lon - A.lon) < 1e-9);
ok(
  'oxirida AYNAN yangi nuqtada',
  Math.abs(f1.lat - B.lat) < 1e-9 && Math.abs(f1.lon - B.lon) < 1e-9,
  'aks holda nuqta serverdagi joydan bir necha metr chetda qolardi'
);

/* Harakat FAQAT oldinga: har kadr oldingisidan manzilga yaqinroq.
   🔑 Egri chiziq (`easeInOut`) orqaga qaytmasligi kerak. */
let mono = true;
let prev = haversineKm([A.lat, A.lon], [B.lat, B.lon]);
for (let i = 1; i <= 20; i += 1) {
  const f = frameAt(A, B, i / 20);
  const left = haversineKm([f.lat, f.lon], [B.lat, B.lon]);
  if (left > prev + 1e-9) mono = false;
  prev = left;
}
ok('harakat faqat OLDINGA (orqaga qaytmaydi)', mono);

/* ── 6. EKSTRAPOLYATSIYA YO'Q ──────────────────────────────────── */
const beyond = frameAt(A, B, 2.5);
ok(
  "manzildan NARIGA o'tmaydi",
  Math.abs(beyond.lat - B.lat) < 1e-9 && Math.abs(beyond.lon - B.lon) < 1e-9,
  'ping kechiksa nuqta TO\'XTAYDI — «shu tezlikda davom etdi» deb chizish joyni o\'ylab topish bo\'lardi'
);
ok('`t` manfiy bo\'lsa ham eski nuqtada qoladi', frameAt(A, B, -3).lat === A.lat);

/* ── 7. Yo'nalish QISQA tomondan buriladi ──────────────────────── */
const spin = lerpHeading(350, 10, 0.5);
ok(
  "350° → 10° QISQA tomondan (0° dan o'tib)",
  spin != null && (spin > 355 || spin < 5),
  `${spin?.toFixed(1)}° — uzun tomondan borsa strelka g'ildirakdek aylanardi`
);
ok('burilish 0–360 oralig\'ida qoladi', [0, 0.25, 0.5, 0.75, 1].every((t) => {
  const v = lerpHeading(350, 10, t);
  return v != null && v >= 0 && v < 360;
}));
ok("yo'nalish noma'lum bo'lsa null qaytadi", lerpHeading(null, null, 0.5) === null);
ok(
  "faqat YANGISI ma'lum bo'lsa — o'sha olinadi",
  lerpHeading(null, 90, 0.3) === 90,
  'oldingi noma\'lum yo\'nalishdan burab kelish YO\'Q joydan burish bo\'lardi'
);

/* ── 8. Egri chiziq ────────────────────────────────────────────── */
ok('egri chiziq 0 va 1 ni saqlaydi', easeInOut(0) === 0 && easeInOut(1) === 1);
ok('egri chiziq chegaradan chiqmaydi', easeInOut(-1) === 0 && easeInOut(5) === 1);
ok("o'rtasi ~0.5", Math.abs(easeInOut(0.5) - 0.5) < 1e-9);

/* ── 9. Ping yoshi ─────────────────────────────────────────────── */
const now = Date.parse('2026-09-18T10:00:00Z');
ok('yosh to\'g\'ri hisoblanadi', pingAgeMs('2026-09-18T09:55:00Z', now) === 5 * 60_000);
ok(
  "Go'ning nol vaqti (`0001-01-01`) — YOSH EMAS",
  pingAgeMs('0001-01-01T00:00:00Z', now) === null,
  'usiz yosh million daqiqa bo\'lib, nuqta DOIM «eskirgan» ko\'rinardi'
);
ok('vaqt yo\'q bo\'lsa null', pingAgeMs(null, now) === null && pingAgeMs('', now) === null);
ok(
  'KELAJAKDAGI ping 0 yoshda (manfiy emas)',
  pingAgeMs('2026-09-18T10:05:00Z', now) === 0,
  'telefon soati oldinda bo\'lishi — odatiy hol'
);

/* ── 10. Chiziqli aralashtirish ────────────────────────────────── */
const half = lerpPoint(A, B, 0.5);
ok(
  "yarmi AYNAN o'rtada",
  Math.abs(half[0] - (A.lat + B.lat) / 2) < 1e-12 &&
    Math.abs(half[1] - (A.lon + B.lon) / 2) < 1e-12
);

if (failed > 0) {
  console.error(`\n❌ Jonli nuqtada ${failed} ta xato`);
  process.exit(1);
}
console.log('\n✅ Jonli nuqta: hammasi to\'g\'ri.\n');
