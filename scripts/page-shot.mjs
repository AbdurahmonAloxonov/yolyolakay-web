/**
 * SAHIFANI KO'Z BILAN KO'RISH — to'liq sahifa rasmi + nuqson tekshiruvi.
 *
 * 🔴 NEGA YOZILDI (egasi, 2026-08-30): landingda ikkita kartochka
 * rasmsiz turardi va mashina ikonkasi cho'zilgandi — ikkalasi ham bir
 * qarashda ko'rinadigan nuqson edi, lekin men sahifaga HECH QACHON
 * qaramagandim, faqat kodini o'qigandim. Kod to'g'ri bo'lishi mumkin,
 * sahifa esa xunuk.
 *
 * Ishlatish:
 *   node scripts/page-shot.mjs https://yolyolakay.co.uz/uz
 *   node scripts/page-shot.mjs http://localhost:3000/uz
 *
 * Nima qiladi:
 *   • desktop (1440) va mobil (390) da to'liq sahifa PNG;
 *   • 4xx/5xx javoblarni sanaydi (yuklanmagan rasm/skript);
 *   • BUZUQ (naturalWidth=0) va CHO'ZILGAN (nisbati buzilgan) rasmlarni
 *     topadi — `object-fit` qo'yilmagan `<img>` shunday chiqadi;
 *   • gorizontal surish bor-yo'qligini aytadi.
 *
 * ⚠️ Import `@playwright/test` dan: loyihada alohida `playwright`
 * paketi yo'q, e2e uchun o'rnatilgani shu.
 */
import { chromium } from '@playwright/test';
const out = '/tmp/claude-1000/-home-harudefender-Desktop-antigravity-project/ad0d1004-3a2a-42e6-858a-ac3d51c5e6e5/scratchpad';
const url = process.argv[2] || 'https://yolyolakay.co.uz/uz';
const b = await chromium.launch();
for (const [name, w, h] of [['desktop', 1440, 900], ['mobil', 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const bad = [];
  p.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('nav:', e.message));
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(5200);
  await p.screenshot({ path: `${out}/land_${name}.png`, fullPage: true });
  // buzuq rasm va cho'zilgan rasmlarni topamiz
  const imgs = await p.evaluate(() => [...document.querySelectorAll('img')].map(i => ({
    src: i.currentSrc || i.src, nw: i.naturalWidth, nh: i.naturalHeight,
    w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height),
    fit: getComputedStyle(i).objectFit, alt: i.alt,
  })));
  console.log(`\n=== ${name} ${w}x${h} ===`);
  console.log('xato javoblar:', bad.length ? bad.slice(0, 10) : 'yo\'q');
  for (const i of imgs) {
    const broken = i.nw === 0;
    const natRatio = i.nh ? (i.nw / i.nh) : 0;
    const boxRatio = i.h ? (i.w / i.h) : 0;
    const stretched = !broken && i.fit !== 'cover' && i.fit !== 'contain' && natRatio && Math.abs(natRatio - boxRatio) / natRatio > 0.12;
    if (broken || stretched) {
      console.log(`  ${broken ? 'BUZUQ' : 'CHOZILGAN'}: ${i.src.slice(-60)} tabiiy=${i.nw}x${i.nh} chizilgan=${i.w}x${i.h} fit=${i.fit}`);
    }
  }
  const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log('gorizontal surish:', scrollW > w ? `BOR (${scrollW} > ${w})` : 'yo\'q');
  await p.close();
}
await b.close();
