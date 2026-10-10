/**
 * XARITA PLITKALARI — bitta manba va almashtirish YO'LI.
 *
 * 🔴 NEGA YOZILDI (18.09.2026): plitka manzili TO'QQIZTA faylda qo'lda
 * takrorlangan edi va hammasi OSM Foundation'ning BEPUL serveriga
 * ketardi — ularning qoidasi ommaviy mahsulotga ruxsat bermaydi.
 * Bloklansa saytdagi HAMMA xarita bir vaqtda bo'm-bo'sh bo'lib
 * qolardi, almashtirish esa to'qqiz faylni tahrirlash degani edi.
 *
 * Tekshiruv ikki narsani qo'riqlaydi:
 *   1. yangi xarita komponenti manzilni QO'LDA yozib qo'ymasin;
 *   2. almashtirish ROSTDAN ishlasin (kalit o'rniga tushsin,
 *      attributsiya provayder nomini olsin).
 *
 * Ishga tushirish: `pnpm test:map-tiles`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`);
  else {
    console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
    failed += 1;
  }
};

console.log('\n🗺️  Plitka manbasi\n');

/* ═══ 1. QO'LDA YOZILGAN MANZIL QOLMASIN ═══ */
const roots = ['src/shared/ui', 'src/app', 'src/features', 'src/widgets'];
const offenders: string[] = [];
const walk = (dir: string) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // papka yo'q — muammo emas
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name) && readFileSync(p, 'utf8').includes('tile.openstreetmap.org')) {
      offenders.push(p);
    }
  }
};
roots.forEach(walk);
ok('manzil faqat `shared/lib/mapTiles.ts` da', offenders.length === 0, offenders.join(', '));

/* ═══ 2. ALMASHTIRISH ISHLAYDIMI ═══
 *
 * 🔴 SINOV IKKI MARTA YUGURADI (`pnpm test:map-tiles`): standart va
 * provayder sozlangan holat. Sabab — modul qiymatni YUKLANGANDA
 * o'qiydi (`process.env.NEXT_PUBLIC_X` Next.js tomonidan paketga
 * qidirib-almashtiriladi), ya'ni bitta jarayonda ikkala holatni
 * ko'rib bo'lmaydi. Har yugurish o'z muhitini o'lchaydi.
 */
const run = async () => {
  const m = await import('../src/shared/lib/mapTiles');
  const url = m.tileUrl();
  const attr = m.tileAttributionText();
  const key = (process.env.NEXT_PUBLIC_MAP_TILES_KEY ?? '').trim();
  const provider = (process.env.NEXT_PUBLIC_MAP_TILES_ATTRIBUTION ?? '').trim();
  const darkUrl = (process.env.NEXT_PUBLIC_MAP_TILES_DARK_URL ?? '').trim();

  console.log(`  (muhit: ${key ? 'provayder sozlangan' : 'standart'})`);

  ok('{z}/{x}/{y} joyida', ['{z}', '{x}', '{y}'].every((s) => url.includes(s)), url);
  // 🔴 Kalit qo'yilmasa `key={key}` bo'lib ketardi → provayder 403.
  ok('shablon o\'rni qolmaydi', !url.includes('{key}'), url);
  // ⚠️ ODbL: ma'lumot OSM'niki — bu yozuv HAR DOIM qoladi.
  ok('attributsiyada OSM HAMON bor', attr.includes('OpenStreetMap'), attr);

  if (key) {
    ok('kalit manzilga tushadi', url.includes(key), url);
  } else {
    ok('standart manba — OSM', url.includes('tile.openstreetmap.org'), url);
  }

  if (provider) {
    ok('attributsiyada provayder nomi', attr.startsWith(provider), attr);
  } else {
    ok('provayder nomi yo\'q — faqat OSM', attr === '© OpenStreetMap', attr);
  }

  ok(
    'tungi uslub holati to\'g\'ri',
    m.hasProviderDarkTiles() === (darkUrl !== ''),
    darkUrl || '(yo\'q)'
  );
  if (darkUrl) ok('tungi manzil alohida', m.tileUrl(true) !== url, m.tileUrl(true));

  console.log(failed === 0 ? '\n✅ Plitka manbasi joyida\n' : `\n❌ ${failed} ta muammo\n`);
  process.exit(failed === 0 ? 0 : 1);
};

void run();
