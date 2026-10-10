/**
 * YO'L HISOBI — «qancha qoldi / qachon yetadi» to'g'ri chiqadimi.
 *
 * 🔴 NEGA YOZILDI (egasi, 17.09.2026): «safar boshlanganda qayerda
 * ketayotganini ko'rish imkoni yo'q — yana Yandex kartaga
 * kirvolishadi». Javob endi bor va u HISOBGA tayanadi: mashinaning
 * jonli nuqtasi yo'l geometriyasiga solishtiriladi.
 *
 * Bu hisob JIMGINA buzilishi mumkin — masalan «qoldi» manfiy chiqsa
 * yoki mashina yo'ldan chetda bo'lsa ham raqam ko'rsatilsa. Ekranda esa
 * u ishonarli ko'rinadi: 200 km ham, 20 km ham bir xil chiroyli yozuv.
 * Shuning uchun tekshiruv MATEMATIKANI o'lchaydi.
 *
 * Ishga tushirish: `pnpm test:route-math` (pre-commit'da).
 */
import {
  cumulativeKm,
  progressOnRoute,
  remainingMinutes,
  simplifyRoute,
  splitRoute,
  type Pt,
} from '../src/shared/lib/routeMath';

let failed = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) {
    console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
    failed += 1;
  }
};

/* Toshkent → Samarqand: to'g'ri chiziq emas, burilishlari bor «yo'l». */
const ROUTE: Pt[] = [
  [41.311, 69.2405],
  [41.0, 68.7],
  [40.6, 68.2],
  [40.1158, 67.8422], // Jizzax atrofi
  [39.9, 67.3],
  [39.6542, 66.9597],
];
const CUM = cumulativeKm(ROUTE);
const TOTAL = CUM[CUM.length - 1];

console.log("\nYo'l hisobi:");

ok('umumiy masofa oqilona (250–450 km)', TOTAL > 250 && TOTAL < 450, `${TOTAL.toFixed(0)} km`);

// 1. Boshida turgan mashina — hammasi qolgan.
const start = progressOnRoute(ROUTE, CUM, ROUTE[0]);
ok('boshida: ulush 0', !!start && start.fraction < 0.01);
ok('boshida: qolgan masofa = umumiy', !!start && Math.abs(start.leftKm - TOTAL) < 1);

// 2. O'rtada (Jizzax atrofida).
const mid = progressOnRoute(ROUTE, CUM, [40.1158, 67.8422]);
ok('o‘rtada: ulush 0 va 1 orasida', !!mid && mid.fraction > 0.3 && mid.fraction < 0.9);
ok('o‘rtada: qolgan + o‘tilgan = umumiy', !!mid && Math.abs(mid.doneKm + mid.leftKm - TOTAL) < 1);
ok('o‘rtada: yo‘ldan chetlashish ~0', !!mid && mid.offRouteKm < 1, `${mid?.offRouteKm.toFixed(2)} km`);

// 3. Oxirida — qolgani nol.
const end = progressOnRoute(ROUTE, CUM, ROUTE[ROUTE.length - 1]);
ok('oxirida: qolgan 0 ga yaqin', !!end && end.leftKm < 1);
ok('qolgan masofa hech qachon manfiy emas', !!end && end.leftKm >= 0);

// 4. YO'LDAN CHETDA — bu holat RAQAM KO'RSATILMASLIGI kerakligini bildiradi.
const off = progressOnRoute(ROUTE, CUM, [43.2, 70.5]); // Shimolda, Qozog'iston tomonda
ok('yo‘ldan chetda: chetlashish katta', !!off && off.offRouteKm > 50, `${off?.offRouteKm.toFixed(0)} km`);

// 5. Qolgan vaqt — yo'l davomiyligining ulushi.
ok('vaqt: yarim yo‘lda yarmi qoladi', remainingMinutes(3600, 0.5) === 30);
ok('vaqt: oxirida 0', remainingMinutes(3600, 1) === 0);
ok('vaqt: davomiylik yo‘q bo‘lsa null', remainingMinutes(null, 0.5) === null);
ok('vaqt: ulush 1 dan katta bo‘lsa ham manfiy emas', (remainingMinutes(3600, 1.5) ?? -1) === 0);

// 6. Siyraklashtirish — ko'rsatish uchun.
const dense: Pt[] = Array.from({ length: 3000 }, (_, i) => [41 - i / 3000, 69 - i / 3000] as Pt);
const thin = simplifyRoute(dense, 600);
ok('siyraklashtirish: chegaradan oshmaydi', thin.length <= 601, `${thin.length} nuqta`);
ok('siyraklashtirish: boshi saqlanadi', thin[0][0] === dense[0][0]);
ok(
  'siyraklashtirish: OXIRI saqlanadi',
  thin[thin.length - 1][0] === dense[dense.length - 1][0],
  "chunki oxirgi nuqta manzil — u tushib qolsa chiziq manzilga YETMAYDI"
);
ok('siyraklashtirish: kichik yo‘l tegilmaydi', simplifyRoute(ROUTE, 600).length === ROUTE.length);

// 7. Chiziqni bo'lish — ikki rangda chizish uchun.
const split = splitRoute(ROUTE, 3);
ok('bo‘lish: ikkala qism ham chiziladigan', split.done.length >= 2 && split.left.length >= 2);
ok(
  'bo‘lish: qismlar TUTASHADI',
  split.done[split.done.length - 1][0] === split.left[0][0],
  'aks holda chiziqda uzilish ko‘rinardi'
);

if (failed > 0) {
  console.error(`\n❌ Yo'l hisobida ${failed} ta xato`);
  process.exit(1);
}
console.log("\n✅ Yo'l hisobi: hammasi to'g'ri.\n");
