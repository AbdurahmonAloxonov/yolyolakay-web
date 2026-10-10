import { test, expect } from '@playwright/test';
import uz from '../../messages/uz.json';
import ru from '../../messages/ru.json';
import en from '../../messages/en.json';

/**
 * 2026-08-03 da qo'shilgan yuzalar uchun backendsiz smoke testlar:
 * uchinchi til (en), til almashtirgich, PWA kirish nuqtasi, brend kalendar/soat,
 * qidiruv filtrlari shtorkasi va tavsiyalar blokining mehmonda YASHIRINLIGI.
 *
 * Hech biri backendga bormaydi — hammasi klient/middleware darajasida.
 */

/** Ichma-ich JSON kalitlarini yassi ro'yxatga aylantiradi ("Common.logout"). */
function flatKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

test.describe('Uch til', () => {
  test('messages fayllarida kalit to‘plami BIR XIL', () => {
    // Bitta kalit unutilsa next-intl o'sha joyda kalit nomini chizadi ("Common.logout").
    const [kUz, kRu, kEn] = [uz, ru, en].map((m) => flatKeys(m).sort());
    expect(kEn, 'en.json kalitlari uz.json bilan mos emas').toEqual(kUz);
    expect(kRu, 'ru.json kalitlari uz.json bilan mos emas').toEqual(kUz);
  });

  test('en — login sahifasi inglizcha render bo‘ladi', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Sign in$/ }).first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('en — qidiruv sahifasi inglizcha va indekslanadi', async ({ page }) => {
    const res = await page.goto('/en/search');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Find a ride/);
  });

  test('hreflang uz/ru/en/x-default', async ({ page }) => {
    await page.goto('/uz');
    for (const lang of ['uz', 'ru', 'en', 'x-default']) {
      await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
    }
  });

  test('sitemap uchala tilni qamraydi', async ({ page }) => {
    const txt = await (await page.request.get('/sitemap.xml')).text();
    for (const l of ['/uz/search', '/ru/search', '/en/search']) {
      expect(txt, `sitemap ${l} ni o‘z ichiga olishi kerak`).toContain(l);
    }
  });
});

test.describe('Til almashtirgich (login ekranida)', () => {
  /*
   * 🔴 SINOV ESKIRGANDI (08.09.2026 da topildi). U uchta tugma —
   * UZ · RU · EN — sarlavhada YONMA-YON turishini kutardi. 03.09.2026
   * dan boshqacha: telefonda ular ikki nusxada ko'rinib qolgani uchun
   * almashtirgich IXCHAM ko'rinishga o'tkazilgan (globus + joriy til,
   * bosilganda ro'yxat ochiladi).
   *
   * Ya'ni sinov ishlamay qolgani MAHSULOT xatosi emas edi, lekin u
   * shu holicha turgani ham yomon: yashil bo'lmagan sinov o'qilmay
   * qoladi va keyingi haqiqiy xatoni yashiradi.
   */
  test('uch til ro‘yxatda bor va EN tilga o‘tkazadi', async ({ page }) => {
    await page.goto('/uz/login');
    await page.getByRole('button', { name: 'Language' }).first().click();

    const list = page.getByRole('listbox');
    await expect(list.getByRole('option', { name: /O'zbekcha|Oʻzbekcha/ })).toBeVisible();
    await expect(list.getByRole('option', { name: 'Русский' })).toBeVisible();
    await expect(list.getByRole('option', { name: 'English' })).toBeVisible();

    await list.getByRole('option', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/login/);
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();

    // Tanlov cookie'ga yozilishi SHART — aks holda keyingi ochilishda til qaytib ketadi.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('en');
  });
});

test.describe('PWA ilovadek ochiladi', () => {
  test('manifest start_url = /login va u tilga yo‘naltiradi', async ({ page, request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    // Ekranga o'rnatilgan ilova marketing landing'ini emas, kirish ekranini ochadi.
    expect(manifest.start_url).toBe('/login');
    // `id` o'zgarsa o'rnatilgan ilova "boshqa ilova" bo'lib qoladi.
    expect(manifest.id).toBe('/');

    await page.goto('/login');
    await expect(page).toHaveURL(/\/(uz|ru|en)\/login/);
  });

  /**
   * SAYT O'ZINI «ILOVA» DEB TAQDIM QILMASIN (22.09.2026).
   *
   * 🔴 Egasi: «ba'zi qurilmalar android, ba'zilari WEB bo'lib
   * ko'rinyapti — asosan Redmi telefonlarida». Sabab shu yerda:
   * sayt to'liq huquqli PWA (manifest + service worker), ya'ni
   * brauzer uni ekranga «ilova» qilib o'rnatishni taklif qiladi.
   * O'rnatgan odam YolYolakay'ning veb nusxasida qoladi — har
   * sessiyasi `X-OS-Type: web` bo'lib yoziladi va u Play'dagi
   * haqiqiy ilovani umuman ko'rmaydi.
   *
   * `related_applications` + `prefer_related_applications` brauzerga
   * «haqiqiy ilova Play'da» deb aytadi. PWA'ning o'zi o'chmaydi
   * (offline rejim, push, `start_url` qoladi) — faqat veb nusxani
   * ilova sifatida o'rnatishga undash to'xtaydi.
   */
  test('manifest Play\'dagi ilovani ASOSIY deb ko\'rsatadi', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.prefer_related_applications).toBe(true);
    expect(manifest.related_applications?.[0]).toMatchObject({
      platform: 'play',
      id: 'uz.yolyolakay.mobile',
    });
  });
});

test.describe('Brend kalendari (native input EMAS)', () => {
  test('qidiruvda sana maydoni kalendar shtorkasini ochadi va tanlov ishlaydi', async ({
    page,
  }) => {
    await page.goto('/uz/search');

    // Native `<input type="date">` qolmagan bo'lishi kerak.
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    await page
      .getByRole('button', { name: /Bugun|Ertaga|-\w+,/ })
      .first()
      .click();
    await expect(page.getByRole('button', { name: 'Ertaga', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Ertaga', exact: true }).click();
    // Tanlangach shtorka yopiladi va tugmada "Ertaga" ko'rinadi.
    await expect(page.getByRole('button', { name: /Ertaga/ }).first()).toBeVisible();
  });
});

test.describe('Qidiruv filtrlari', () => {
  test('“Filtrlar” shtorkasi ochiladi va qulayliklar ro‘yxati bor', async ({ page }) => {
    await page.goto('/uz/search');
    await page.getByRole('button', { name: /Filtrlar/ }).click();

    await expect(page.getByText('Qulayliklar')).toBeVisible();
    for (const label of ['Konditsioner', 'Bagaj joyi', 'Chekilmaydi', 'Hayvonsiz']) {
      await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /Ko.?rsatish/ })).toBeVisible();
  });

  test('saralash tugmalari qatorda turadi', async ({ page }) => {
    await page.goto('/uz/search');
    for (const s of ['Yaqin', 'Arzon', 'Erta']) {
      await expect(page.getByRole('button', { name: new RegExp(s) })).toBeVisible();
    }
  });
});

test.describe('Tavsiyalar bloki', () => {
  test('mehmonga KO‘RSATILMAYDI (ruchka token talab qiladi)', async ({ page }) => {
    await page.goto('/uz/search');
    await expect(page.getByRole('heading', { name: 'Siz uchun' })).toHaveCount(0);
  });
});

test.describe('Haydovchi daromadi', () => {
  test('himoyalangan: mehmon login‘ga yuboriladi', async ({ page }) => {
    await page.goto('/uz/driver/earnings');
    await expect(page).toHaveURL(/\/uz\/login/);
  });

  test('robots.txt daromad sahifasini indeksdan yopadi', async ({ page }) => {
    const txt = await (await page.request.get('/robots.txt')).text();
    for (const p of ['/uz/driver', '/ru/driver', '/en/driver']) {
      expect(txt).toContain(`Disallow: ${p}`);
    }
  });
});

test.describe('OTP `type` (backend MAJBURIY talab qiladi)', () => {
  /**
   * 🔴 2026-08-03 jonli xato: `POST /auth/send-otp` `type`siz 400 beradi —
   * "invalid request body or missing 'type'". Ya'ni ro'yxatdan o'tish UMUMAN
   * ishlamasdi. Test so'rov TANASINI ushlaydi (backendga bormaydi).
   */
  const purposeOf = async (page: import('@playwright/test').Page, action: () => Promise<void>) => {
    let body: Record<string, unknown> | null = null;
    await page.route('**/api-proxy/**/auth/send-otp', async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'OTP sent' }),
      });
    });
    await action();
    return body as Record<string, unknown> | null;
  };

  test("ro'yxatdan o'tish -> type: register", async ({ page }) => {
    await page.goto('/uz/login');
    const body = await purposeOf(page, async () => {
      await page.getByRole('button', { name: /Ro.?yxatdan o.?tish/ }).click();
      await page.locator('input[type="tel"]').fill('+998901234567');
      await page.getByRole('button', { name: /Kod olish/ }).click();
      await page.waitForTimeout(500);
    });
    expect(body?.type).toBe('register');
  });

  test('parolni tiklash -> type: frgt_pswd', async ({ page }) => {
    await page.goto('/uz/login');
    const body = await purposeOf(page, async () => {
      await page.getByRole('button', { name: /Parolni unutdingizmi/ }).click();
      await page.locator('input[type="tel"]').fill('+998901234567');
      await page.getByRole('button', { name: /Kod olish/ }).click();
      await page.waitForTimeout(500);
    });
    expect(body?.type).toBe('frgt_pswd');
  });
});
