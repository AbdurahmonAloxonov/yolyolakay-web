import { test, expect } from '@playwright/test';

/**
 * O'ZBEK KIRILI — to'rtinchi til.
 *
 * 🔴 NEGA E2E: kirill matn RUNTIME'da o'giriladi, ya'ni uni birlik
 * testi to'liq tekshira olmaydi — marshrutlash, `<html lang>`,
 * xabarlar fayli va sahifadagi matn birga ishlashi kerak.
 *
 * Xatosi jim bo'lardi: sahifa ochiladi, faqat matn lotinda qoladi va
 * kirillda o'qiydigan odam farqni ko'radi, biz esa ko'rmaymiz.
 */
test.describe('Kirill', () => {
  test('sahifa ochiladi va matn KIRILLDA', async ({ page }) => {
    await page.goto('/uz-cyrl/login');

    // Kirill harflari bor va lotincha o'zbekcha yozuv YO'Q.
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/[ЎҚҒҲ]/);

    // `<html lang>` — BCP-47 shaklida: ekran o'qigich `uz-cyrl` ni
    // tanimaydi.
    await expect(page.locator('html')).toHaveAttribute('lang', 'uz-Cyrl');
  });

  test('til almashtirgichda TO‘RT variant bor', async ({ page }) => {
    await page.goto('/uz/login');
    await page.getByRole('button', { name: 'Language' }).first().click();

    const list = page.getByRole('listbox');
    await expect(list.getByRole('option', { name: 'Ўзбекча' })).toBeVisible();
    await expect(list.getByRole('option', { name: /O'zbekcha|Oʻzbekcha/ })).toBeVisible();
    await expect(list.getByRole('option', { name: 'Русский' })).toBeVisible();
    await expect(list.getByRole('option', { name: 'English' })).toBeVisible();
  });

  test('kirillga o‘tsa MANZIL ham o‘zgaradi', async ({ page }) => {
    await page.goto('/uz/login');
    await page.getByRole('button', { name: 'Language' }).first().click();
    await page.getByRole('listbox').getByRole('option', { name: 'Ўзбекча' }).click();

    await expect(page).toHaveURL(/\/uz-cyrl\/login/);
    // Tanlov cookie'ga yozilsin — aks holda keyingi ochilishda til qaytadi.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('uz-cyrl');
  });

  test('hreflang ro‘yxatida kirill bor', async ({ page }) => {
    await page.goto('/uz');
    const link = page.locator('link[hreflang="uz-Cyrl"]');
    await expect(link).toHaveAttribute('href', /\/uz-cyrl/);
  });
});
