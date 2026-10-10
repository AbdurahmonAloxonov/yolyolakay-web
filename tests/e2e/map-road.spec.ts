import { test, expect } from '@playwright/test';

/**
 * XARITADA HAQIQIY YO'L (17.09.2026).
 *
 * 🔴 NEGA YOZILDI (egasi): «karta noto'g'ri ishlayapti… TEKKIS chizib
 * qo'yyapti». Xarita bo'limida marshrut ikki shahar orasidagi to'g'ri
 * chiziq bilan chizilardi — u tog'dan ham, cho'ldan ham o'tib ketadi va
 * odam undan hech narsa o'qiy olmaydi. Yo'lning haqiqiy geometriyasi
 * esa bizda BOR (`GET /routing/route`).
 *
 * Sinov AYNAN shuni o'lchaydi: chiziqda ikkitadan KO'P nuqta bormi.
 * Ikki nuqta — bu «tekkis chiziq» degani.
 *
 * ⚠️ Backend STUB: sinov prodda safar bor-yo'qligiga bog'liq bo'lmasin.
 * Stubdagi «yo'l» ATAYIN zigzag — to'g'ri chiziqdan farqi ko'rinsin.
 */

const GEOMETRY = [
  { latitude: 41.311, longitude: 69.2405 },
  { latitude: 41.0, longitude: 68.7 },
  { latitude: 40.6, longitude: 68.2 },
  { latitude: 40.1158, longitude: 67.8422 },
  { latitude: 39.9, longitude: 67.3 },
  { latitude: 39.6542, longitude: 66.9597 },
];

const RIDES = {
  rides: [
    {
      id: 'a1',
      origin_address: 'Toshkent',
      origin_lat: 41.311,
      origin_lon: 69.2405,
      destination_address: 'Samarqand',
      destination_lat: 39.6542,
      destination_lon: 66.9597,
      departure_time: new Date(Date.now() + 86_400_000).toISOString(),
      total_seats: 4,
      available_seats: 3,
      price_per_seat: 120000,
      status: 'active',
      driver: { name: 'Aziz' },
    },
  ],
};

/** Chiziqlardagi nuqtalar yig'indisi (Leaflet `d` atributидан). */
async function linePoints(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.leaflet-overlay-pane path')]
      .map((x) => (x.getAttribute('d') || '').split(/[ML]/).length - 1)
      .reduce((a, b) => a + b, 0)
  );
}

test.describe("Xaritada haqiqiy yo'l", () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api-proxy/api/v1/routing/route*', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ distance: 322000, duration: 17700, geometry: GEOMETRY }),
      })
    );
  });

  test("tanlangan yo'nalish YO'L bo'ylab chiziladi", async ({ page }) => {
    /*
     * ⚠️ NATIJASIZ holat ATAYIN: natija chiqqanda kadr jo'nash shahriga
     * yaqinlashadi va Leaflet chiziqni EKRAN CHEGARASIDA QIRQADI —
     * o'shanda `d` atributida ikkita nuqta qoladi va o'lchov yolg'on
     * «tekkis chiziq» degan xulosa berardi (shu sinovni yozayotib
     * uchradi). Bu yerda butun yo'nalish ko'rinib turishi kerak.
     */
    await page.route('**/rides/search*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"rides":[]}' })
    );
    await page.goto('/uz/map?from=Toshkent&to=Samarqand');
    await page.waitForSelector('.leaflet-tile', { timeout: 20000 });
    await page.waitForTimeout(3500);

    const n = await linePoints(page);
    expect(n, "yo'l TO'G'RI CHIZIQ bo'lib qoldi").toBeGreaterThan(2);

    /*
     * 🔴 UZUQ CHIZIQ QOLMASIN: uzuqlik «yo'l hali kelmadi» degan
     * VAQTINCHALIK belgi. Leaflet esa uslubni almashtirmay, qo'shib
     * qo'yadi — yo'l kelgandan keyin ham uzuqligi qolib ketgandi
     * (prodda ko'rilgan).
     */
    const dashed = await page.evaluate(() =>
      [...document.querySelectorAll('.leaflet-overlay-pane path')].some((x) =>
        x.getAttribute('stroke-dasharray')
      )
    );
    expect(dashed, "haqiqiy yo'l UZUQ chiziq bo'lib qoldi").toBe(false);
  });

  test("tanlangan SAFAR ham yo'l bo'ylab chiziladi", async ({ page }) => {
    await page.route('**/rides/search*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RIDES) })
    );
    await page.goto('/uz/map?from=Toshkent&to=Samarqand');
    await page.waitForSelector('.leaflet-tile', { timeout: 20000 });
    await page.waitForTimeout(3000);

    // Narx belgisini bosamiz (ko'rinadigan qismi — bolasi).
    const box = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.leaflet-marker-icon')].find((e) =>
        (e.getAttribute('title') || '').includes('120')
      );
      if (!el) return null;
      const r = ((el.firstElementChild as HTMLElement) || (el as HTMLElement)).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    expect(box, "narx belgisi topilmadi").not.toBeNull();
    await page.mouse.click(box!.x, box!.y);
    await page.waitForTimeout(3500);

    const n = await linePoints(page);
    expect(n, "tanlangan safar yo'li TO'G'RI CHIZIQ bo'lib qoldi").toBeGreaterThan(2);
  });
});
