import { test, expect } from '@playwright/test';

/**
 * «XARITA» BO'LIMI — qo'riqchi sinovlar (17.09.2026).
 *
 * 🔴 NEGA AYNAN SHULAR: bu sahifani qurishda uchta xato JONLI SINOVDA
 * tutildi, uchalasi ham kod o'qib topilmaydigan turdan edi:
 *
 *   1. Birinchi shahar bosilishi bilan xarita o'sha shaharga ZUMLAB
 *      ketardi va ikkinchi shahar ekrandan chiqib qolardi — ya'ni
 *      «ikki shaharni bosing» degan yo'l birinchi qadamdayoq uzilardi.
 *   2. Samarqand nuqtasi bosilganda SHAHRISABZ tanlanardi: mamlakat
 *      ko'rinishida 44 px bosish maydonlari ustma-ust tushadi.
 *   3. Narx belgisining bosiladigan maydoni 20 px edi (ko'rinadigan
 *      belgi ~100 px) — o'ng yarmiga bosilganda hech nima bo'lmasdi.
 *
 * Shuning uchun sinov AYNAN bosishni va natijani o'lchaydi.
 */

const PAGE = '/uz/map';

/** Xaritadagi belgi — ELEMENT emas, uning ko'rinadigan qismi bosiladi. */
async function clickMarker(page: import('@playwright/test').Page, title: string) {
  const box = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('.leaflet-marker-icon')].find((e) =>
      (e.getAttribute('title') || '').includes(t)
    );
    if (!el) return null;
    // `iconSize: [0,0]` bo'lgan belgilarda o'lcham BOLASIDA bo'ladi.
    const r = ((el.firstElementChild as HTMLElement) || (el as HTMLElement)).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }, title);
  if (!box) throw new Error(`xaritada «${title}» belgisi topilmadi`);
  await page.mouse.click(box.x, box.y);
  return box;
}

test.describe('Xarita bo\'limi', () => {
  test('mehmonga ochiq: xarita va shahar nuqtalari chiziladi', async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForSelector('.leaflet-tile', { timeout: 15000 });
    const stats = await page.evaluate(() => ({
      tiles: document.querySelectorAll('.leaflet-tile').length,
      cities: [...document.querySelectorAll('.leaflet-marker-icon')].filter((e) =>
        (e.getAttribute('title') || '').startsWith('Shahar')
      ).length,
      // OSM litsenziyasi (ODbL) attributsiyani TALAB qiladi.
      credit: !!document.querySelector('a[href*="openstreetmap.org/copyright"]'),
    }));
    expect(stats.tiles, 'xarita plitkalari yuklanmadi').toBeGreaterThan(0);
    expect(stats.cities, 'shahar nuqtalari yo\'q').toBeGreaterThan(2);
    expect(stats.credit, 'OpenStreetMap attributsiyasi yo\'q').toBe(true);
  });

  test('ikki shahar bosilsa qidiruv O\'ZI ishga tushadi', async ({ page }) => {
    const searches: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/rides/search')) searches.push(r.url());
    });
    await page.goto(PAGE);
    await page.waitForSelector('.leaflet-tile', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await clickMarker(page, 'Toshkent');
    await page.waitForTimeout(800);

    /*
     * 🔴 BIRINCHI BOSISHDAN KEYIN IKKINCHISI HAM BOSILISHI KERAK.
     * Aynan shu yerda xarita Toshkentga zumlab ketib, Samarqand
     * ekrandan chiqib qolgandi.
     */
    await clickMarker(page, 'Samarqand');
    await page.waitForTimeout(2500);

    expect(searches.length, 'ikki shahar tanlangach qidiruv yuborilmadi').toBeGreaterThan(0);
    // Tanlangan shahar AYNAN bosilgani bo'lsin (qo'shnisi emas).
    expect(searches[0]).toContain('dest_lat=39.6542');
  });

  test('tor telefonda xarita KO\'RINIB turadi va surish paydo bo\'lmaydi', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(PAGE);
    await page.waitForSelector('.leaflet-tile', { timeout: 15000 });
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      const map = document.querySelector('.leaflet-container')!.getBoundingClientRect();
      // Xarita USTIDA suzadigan yagona element — qidiruv qatori.
      const bar = document.querySelector('.leaflet-container')!.parentElement!.querySelector('button');
      const barH = bar ? bar.getBoundingClientRect().height : 0;
      return { hScroll: doc.scrollWidth > doc.clientWidth, mapH: map.height, mapW: map.width, barH };
    });
    expect(m.hScroll, "gorizontal surish paydo bo'ldi").toBe(false);
    /*
     * Xarita sahifaning QAHRAMONI: ramkasi sezilarli bo'lishi kerak.
     * (Uyg'unlashtirish «xaritani kichraytirish» degani emas.)
     */
    expect(m.mapH, 'xarita juda past').toBeGreaterThan(300);
    // Ustidagi qator xaritaning choragidan ko'pini yopmasin.
    expect(m.barH, "qidiruv qatori xaritaning ko'p qismini yopdi").toBeLessThan(m.mapH / 4);
  });

  test('sahifa sayt tilida: sarlavha, bo\'lim yorlig\'i va atlas jiyagi', async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForSelector('.leaflet-tile', { timeout: 15000 });
    const brand = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const style = h1 ? getComputedStyle(h1) : null;
      return {
        h1: h1?.textContent?.trim() ?? '',
        // Sarlavha `font-display` (saytdagi boshqa sahifalar bilan bir xil).
        display: style?.fontFamily.toLowerCase() ?? '',
        weight: style?.fontWeight ?? '',
        // Atlas jiyagi — xarita ramkasining poydevori.
        atlas: document.querySelectorAll('svg filter[id^="jiyak-"]').length,
      };
    });
    expect(brand.h1, "sahifaning ko'rinadigan sarlavhasi yo'q").not.toBe('');
    expect(brand.display, 'sarlavha brend shriftida emas').toContain('display');
    expect(brand.atlas, "xarita ostida atlas jiyagi yo'q").toBeGreaterThan(0);
  });
});
