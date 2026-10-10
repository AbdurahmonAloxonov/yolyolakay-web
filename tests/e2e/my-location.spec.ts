import { test, expect } from '@playwright/test';

/**
 * «MEN SHU YERDAMAN» — KO'K NUQTA (18.09.2026).
 *
 * 🔴 NEGA JONLI SINOV KERAK: bu funksiyani kod o'qib tekshirib
 * bo'lmaydi. GPS brauzerdan keladi, nuqta Leaflet ichida chiziladi,
 * ergashish esa kadr bilan bog'liq — uchalasi ham faqat ISHLAYOTGAN
 * sahifada ko'rinadi. Xuddi shu sahifada 17.09 da uchta xato aynan
 * jonli sinovda tutilgan edi (`map-section.spec.ts`).
 *
 * 🔑 Playwright GPS'ni SOXTALASHTIRA oladi (`setGeolocation`) — ya'ni
 * odam yurganini ham ko'rsatish mumkin. Sinov aynan shuni o'lchaydi:
 * koordinata o'zgarganda EKRANDAGI nuqta ham ko'chdimi.
 */

const PAGE = '/uz/map';

/* Toshkent markazi va undan ~1 km shimoli — «odam yurdi» holati.
   ⚠️ `accuracy` ATAYIN beriladi: Playwright standart 0 qaytaradi, biz
   esa nol aniqlikda doira CHIZMAYMIZ (nol aniqlik — fizik ma'nosiz
   qiymat). Busiz sinov o'z soxta ma'lumotini o'lchab yiqilardi. */
const HERE = { latitude: 41.2995, longitude: 69.2401, accuracy: 30 };
const MOVED = { latitude: 41.309, longitude: 69.2401, accuracy: 30 };

test.use({ permissions: ['geolocation'], geolocation: HERE });

/** Ko'k nuqtaning ekrandagi joyi (bo'lmasa `null`). */
async function bluePos(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('.leaflet-marker-icon')].find((e) => {
      const kid = e.firstElementChild as HTMLElement | null;
      return !!kid && kid.style.background.includes('--my-location');
    });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y };
  });
}

test.describe("«Men shu yerdaman»", () => {
  test('tugma bosilsa ko\'k nuqta va ANIQLIK DOIRASI chiziladi', async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForSelector('.leaflet-tile', { timeout: 15000 });

    // Tugma bosilmaguncha GPS'ga TEGILMAYDI — nuqta ham bo'lmasligi kerak.
    expect(await bluePos(page), 'so\'ralmasdan turib joylashuv chizilgan').toBeNull();

    await page.getByRole('button', { name: 'Men shu yerdaman' }).click();

    await expect
      .poll(async () => (await bluePos(page)) !== null, {
        timeout: 15000,
        message: 'ko\'k nuqta chizilmadi',
      })
      .toBe(true);

    /* ANIQLIK DOIRASI — `Circle` SVG `path` bo'lib chiziladi.
       🔑 U yolg'onni to'sadi: doirasiz nuqta «men AYNAN shu yerdaman»
       deb turadi, GPS esa 50 metrgacha xato qiladi. */
    const circles = await page.evaluate(
      () =>
        [...document.querySelectorAll('.leaflet-overlay-pane path')].filter((p) => {
          const stroke = (p.getAttribute('stroke') || '').toLowerCase();
          // Ko'k doira — marshrut chizig'idan (pushti/feruza) farq qiladi.
          return stroke.startsWith('#2f6bff') || stroke.startsWith('#5c8cff') || stroke.startsWith('#6aa8ff');
        }).length
    );
    expect(circles, 'aniqlik doirasi chizilmadi').toBeGreaterThan(0);
  });

  test('odam YURSA nuqta ham ko\'chadi', async ({ page, context }) => {
    await page.goto(PAGE);
    await page.waitForSelector('.leaflet-tile', { timeout: 15000 });
    await page.getByRole('button', { name: 'Men shu yerdaman' }).click();

    await expect
      .poll(async () => (await bluePos(page)) !== null, { timeout: 15000 })
      .toBe(true);
    const before = await bluePos(page);

    // GPS yangi joy berdi (odam ~1 km shimolga yurdi).
    await context.setGeolocation(MOVED);

    /* Kadr ERGASHADI, ya'ni nuqta ekran markazida qoladi-yu, XARITA
       siljiydi. Shuning uchun plitkalarning siljishini o'lchaymiz:
       nuqtaning ekrandagi pikseli o'zgarmasligi ham MUMKIN. */
    const moved = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const pane = document.querySelector('.leaflet-map-pane') as HTMLElement | null;
          const start = pane?.style.transform ?? '';
          const t0 = Date.now();
          const id = setInterval(() => {
            const now = (document.querySelector('.leaflet-map-pane') as HTMLElement)?.style
              .transform;
            if (now !== start) {
              clearInterval(id);
              resolve(true);
            } else if (Date.now() - t0 > 12000) {
              clearInterval(id);
              resolve(false);
            }
          }, 200);
        })
    );
    expect(moved, 'GPS o\'zgardi, lekin xarita ergashmadi').toBe(true);
    expect(before, 'nuqta yo\'qolib qoldi').not.toBeNull();
  });

  test('xarita QO\'L bilan surilsa ergashish to\'xtaydi, nuqta QOLADI', async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForSelector('.leaflet-tile', { timeout: 15000 });
    const btn = page.getByRole('button', { name: 'Men shu yerdaman' });
    await btn.click();
    await expect.poll(async () => (await bluePos(page)) !== null, { timeout: 15000 }).toBe(true);

    // Xaritani qo'l bilan surish.
    const box = (await page.locator('.leaflet-container').first().boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 - 80, { steps: 8 });
    await page.mouse.up();

    /* 🔑 ASOSIY TEKSHIRUV: nuqta QOLADI (odam o'z joyini yo'qotmasin),
       lekin tugma endi «to'xtatish» emas — u qaytarish uchun. */
    expect(await bluePos(page), 'surilgach nuqta yo\'qoldi').not.toBeNull();
    await expect(
      page.getByRole('button', { name: /Joylashuvni kuzatishni to'xtatish/ })
    ).toBeVisible();
  });
});
