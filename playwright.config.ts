import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke testlar — backendsiz ishlaydigan UI oqimlari (login render, rejim almashuvi,
 * i18n cookie-ustunlik regressiyasi, PWA manifest). Haqiqiy backend/OTP talab qilmaydi.
 * Ishga tushirish: `pnpm test:e2e` (dev serverni o'zi ko'taradi).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    /*
     * DEV EMAS, PROD BUILD: `next dev` bu loyihada ishonchsiz (sahifalar ba'zan
     * yarim render bo'ladi, rewrites qayta hisoblanadi) va testlar "yiqildi" deb
     * yolg'on signal berardi. Prod build esa aynan foydalanuvchi ko'radigan
     * artefakt. Lokalda `next start` allaqachon 3000-portda tursa, qayta
     * ko'tarilmaydi (`reuseExistingServer`).
     */
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
