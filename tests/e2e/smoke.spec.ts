import { test, expect } from '@playwright/test';

/**
 * Backendsiz smoke testlar — login/i18n/PWA'ning brauzerdagi asosiy xatti-harakati.
 * OTP/parol backendga bormaydi; faqat UI render, rejim almashuvi, middleware redirect.
 */

test.describe('Login sahifasi', () => {
  test("uz — asosiy elementlar render bo'ladi", async ({ page }) => {
    await page.goto('/uz/login');
    await expect(page.getByRole('heading', { name: /Xush kelibsiz/ })).toBeVisible();
    // Ikki rejim tabi: Kirish / Ro'yxatdan o'tish
    await expect(page.getByRole('button', { name: /Kirish/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Ro.?yxatdan o.?tish/ })).toBeVisible();
    // Standart holat — login (parol maydoni ko'rinadi)
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('ru — rus tilida render', async ({ page }) => {
    await page.goto('/ru/login');
    await expect(page.getByRole('heading', { name: /Добро пожаловать/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Регистрация/ })).toBeVisible();
  });

  /**
   * YORDAM KIRISHDAN OLDIN HAM (egasi, 22.09.2026).
   *
   * 🔴 NEGA TEST: bu havola jimgina yo'qolishi mumkin — u hech qanday
   * oqimga ta'sir qilmaydi va uning yo'qligi bitta xato ham bermaydi.
   * Holbuki u kira olmayotgan odamning bizga yetib keladigan YAGONA
   * yo'li (ilova ichidagi forma token talab qiladi).
   */
  test('yordam yo\'li kirishdan OLDIN ham bor va Telegramga olib boradi', async ({ page }) => {
    await page.goto('/uz/login');
    const help = page.getByRole('button', { name: /Yordam kerakmi/ });
    await expect(help).toBeVisible();
    await help.click();
    await expect(page.getByRole('link', { name: /qo.?llab-quvvatlashga yozish/i })).toHaveAttribute(
      'href',
      /t\.me/
    );
  });

  test("rejim almashuvi: register -> 'Kod olish', parol maydoni yo'qoladi", async ({ page }) => {
    await page.goto('/ru/login');
    // Login rejimi: parol bor
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // Registerga o'tamiz
    await page.getByRole('button', { name: /Регистрация/ }).click();
    // Kod olish tugmasi chiqadi, parol maydoni ketadi (kod FAQAT registerda)
    await expect(page.getByRole('button', { name: /Получить код/ })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});

test.describe('i18n middleware', () => {
  test('NEXT_LOCALE cookie URL prefiksidan ustun (til-almashuv regressiyasi)', async ({
    page,
    context,
  }) => {
    // Cookie 'ru' — /uz ochsak ham /ru'ga redirect bo'lishi shart (aks holda til qamalib qoladi)
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'ru', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/uz/login');
    await expect(page).toHaveURL(/\/ru\/login/);
  });
});

test.describe('Mehmon rejimi (login talab qilinmaydigan sahifalar)', () => {
  /**
   * Regressiya himoyasi: `/search` va `/trip/{id}` `(public)` guruhida yotsa ham,
   * AuthGuard ularni himoyalangan deb bilardi va mehmonni login'ga otib yuborardi.
   * Oqibati: SSR HTML faqat spinner bo'lardi (Google katalogni ko'rmasdi) va yangi
   * foydalanuvchi ro'yxatdan o'tmasdan bitta e'lonni ham ko'ra olmasdi.
   */
  test("mehmon /uz/search'da qoladi — login'ga otilmaydi", async ({ page }) => {
    await page.goto('/uz/search');
    await expect(page).toHaveURL(/\/uz\/search/);
    // Qidiruv formasi ko'rinadi (spinner emas)
    await expect(page.getByRole('heading', { name: /Safarlarni qidirish/ })).toBeVisible();
    // 2026-08-02: `/rides/search` gateway'da OCHIQ, shuning uchun natijalar o'rnidagi
    // eski "ko'rish uchun tizimga kiring" TO'SIQI bo'lmasligi kerak — mehmon qidira oladi.
    await expect(page.getByText(/ko.?rish va qidirish uchun/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Qidirish/ })).toBeEnabled();
  });

  /*
   * 2026-08-09 (SEO, SSR + haqiqiy 404) dan keyin kontrakt O'ZGARDI:
   *   backend `404 ride not found`  -> sahifa HAQIQIY 404 (notFound())
   *   backend javob bermadi/uzildi  -> 404 EMAS, `unavailable` (kesh/klient yo'li)
   *
   * Test shu ikkalasini AJRATADI. Ilgari bu yerda "tizimga kiring" kutilardi — u
   * mehmon safarni umuman ko'ra olmaydigan davrdan qolgan va endi noto'g'ri.
   */
  test("mavjud bo'lmagan safar HAQIQIY 404 beradi (yumshoq 404 emas)", async ({
    page,
    request,
  }) => {
    /*
     * SHART: backend "bunday safar yo'q" deb ayta olishi kerak.
     *
     * Backend yiqilgan bo'lsa (502) sahifa ATAYIN 200 qaytaradi — uzilishni
     * "safar yo'q" deb ko'rsatish yolg'on bo'lardi va Google mavjud sahifani
     * indeksdan o'chirib yuborardi. Ya'ni bunday paytda test bizning kodni
     * emas, backend holatini o'lchaydi.
     *
     * Shuning uchun avval backendni so'raymiz va javob berolmasa testni
     * O'TKAZIB YUBORAMIZ — aks holda har uzilishda "qizil" chiqib, ishonchni
     * yo'qotadi (2026-08-11 da aynan shunday bo'ldi).
     */
    const probe = await request
      .get('https://api.yolyolakay.com/api/v1/rides/11111111-2222-3333-4444-555555555555', {
        failOnStatusCode: false,
        timeout: 15000,
      })
      .catch(() => null);
    test.skip(
      probe?.status() !== 404,
      `backend "ride not found" deya olmadi (${probe?.status() ?? 'javob yo\'q'}) — tekshirish sharti bajarilmadi`
    );

    // Backend ikki xil rad etadi va IKKALASI ham 404 bo'lishi kerak:
    //   noto'g'ri formatli id -> 400 "invalid ride_id"
    //   mavjud bo'lmagan UUID -> 404 "ride not found"
    for (const id of ['smoke-test-id', '11111111-2222-3333-4444-555555555555']) {
      const res = await page.goto(`/uz/trip/${id}`);
      // Eng muhimi HTTP kodi: Google "yumshoq 404" ni indeksga oladi, haqiqiysini yo'q.
      expect(res?.status(), `/uz/trip/${id}`).toBe(404);
    }
  });

  test("himoyalangan sahifa mehmonni HAMON login'ga yuboradi", async ({ page }) => {
    await page.goto('/uz/profile');
    await expect(page).toHaveURL(/\/uz\/login/);
  });

  test('/search sitemap va metadata bilan indekslanadi', async ({ page }) => {
    const res = await page.goto('/uz/search');
    expect(res?.status()).toBe(200);
    // Landing bilan bir xil sarlavha bo'lmasligi kerak
    await expect(page).toHaveTitle(/Safar qidirish/);

    const sitemap = await page.request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('/uz/search');
  });
});

test.describe('SEO artefaktlari', () => {
  test('robots.txt shaxsiy sahifalarni LOCALE PREFIKSI bilan yopadi', async ({ page }) => {
    const txt = await (await page.request.get('/robots.txt')).text();

    // 🔴 Aynan shu regressiya bo'lgan edi: qoidalar `/profile` deb prefikssiz
    // yozilgan, sayt esa DOIM `/uz/profile` beradi — ya'ni hech nima yopilmagan.
    for (const p of ['/uz/profile', '/ru/profile', '/uz/chats', '/ru/dashboard', '/uz/payment']) {
      expect(txt, `robots.txt ${p} ni yopishi kerak`).toContain(`Disallow: ${p}`);
    }
    // Ochiq sahifalar yopilib qolmasin
    expect(txt).not.toContain('Disallow: /uz/search');
    expect(txt).not.toContain('Disallow: /uz/trip');
  });

  test('og:image bor va haqiqiy PNG qaytaradi', async ({ page }) => {
    await page.goto('/uz');

    // `summary_large_image` e'lon qilinib rasm berilmasa kartochka BO'SH chiqadi —
    // shuning uchun ikkalasi bitta testda tekshiriladi.
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image'
    );
    const src = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(src, 'og:image meta-tegi yo‘q').toBeTruthy();
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      'content',
      '1200'
    );

    // Meta-teg turishi yetarli emas — manzil haqiqatan rasm berishi kerak.
    const img = await page.request.get(new URL(src!).pathname + new URL(src!).search);
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toContain('image/png');
    expect((await img.body()).byteLength).toBeGreaterThan(1000);
  });

  test('hreflang: uz, ru va x-default', async ({ page }) => {
    await page.goto('/uz');
    for (const lang of ['uz', 'ru', 'x-default']) {
      await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
    }
  });
});

test('PWA manifest <head>ga ulangan', async ({ page }) => {
  await page.goto('/uz/login');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/
  );
});
