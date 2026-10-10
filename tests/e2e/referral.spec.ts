import { test, expect } from '@playwright/test';

/**
 * TAKLIF KODI — havoladan olinadi, saqlanadi va URL'dan tozalanadi.
 *
 * 🔴 NEGA E2E: bu mantiq faqat BRAUZERDA yashaydi (`localStorage` +
 * `history.replaceState`). Uni birlik testi bilan tekshirib bo'lmaydi,
 * xatosi esa JIM: kod ushlanmasa hech narsa buzilmaydi — shunchaki
 * hisobot bo'sh qoladi va biz reklama ishlayaptimi-yo'qmi bilmay
 * qolamiz. Aynan shunday «indamas» xato uchun qo'riqchi kerak.
 *
 * Backend TALAB QILINMAYDI: kod hech qayerga yuborilmaydi (sababi
 * `shared/lib/referral.ts` da).
 */

const STORE = 'referral';

test.describe('Taklif havolasi', () => {
  test('kod saqlanadi va manzildan OLIB TASHLANADI', async ({ page }) => {
    await page.goto('/uz?r=a1b2c3d4');

    // URL tozalanishi SHART: aks holda odam shu manzilni boshqasiga
    // uzatganda BEGONA kod bilan uzatardi.
    await expect.poll(() => new URL(page.url()).searchParams.get('r')).toBeNull();

    const stored = await page.evaluate((key) => localStorage.getItem(key), STORE);
    expect(stored, 'kod localStorage ga yozilmagan').toBeTruthy();
    expect(JSON.parse(stored as string).code).toBe('a1b2c3d4');
  });

  test('BIRINCHI kod g‘olib — ikkinchi havola uni almashtirmaydi', async ({ page }) => {
    await page.goto('/uz?r=aaaa1111');
    /*
     * ⚠️ KUTISH SHART: `page.goto` sahifa YUKLANGANDA qaytadi, kod esa
     * hidratsiyadan keyin (`useEffect`) yoziladi. Kutmasak ikkinchi
     * o'tish birinchisining yozuvidan OLDIN ketadi va test yolg'on
     * xato beradi (birinchi yozishda aynan shunday bo'ldi).
     */
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), STORE)).toBeTruthy();

    await page.goto('/uz?r=bbbb2222');
    await expect.poll(() => new URL(page.url()).searchParams.get('r')).toBeNull();

    const stored = await page.evaluate((key) => localStorage.getItem(key), STORE);
    expect(JSON.parse(stored as string).code).toBe('aaaa1111');
  });

  test('yaroqsiz kod SAQLANMAYDI', async ({ page }) => {
    // Havoladagi qiymat begona odam yozgan matn — u hisobotga tushadi,
    // shuning uchun shakli qat'iy tekshiriladi.
    await page.goto('/uz?r=<script>alert(1)</script>');

    const stored = await page.evaluate((key) => localStorage.getItem(key), STORE);
    expect(stored).toBeNull();
  });
});
