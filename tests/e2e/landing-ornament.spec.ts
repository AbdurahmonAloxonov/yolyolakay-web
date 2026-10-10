import { test, expect } from '@playwright/test';

/**
 * LANDING NAQSHLARI — ikkala temada ham TO'G'RI ko'rinsin.
 *
 * 🔴 NEGA BU TEST BOR (egasi, 2026-08-31: «sayt oq bo'lganda naqshlar
 * bilinmay qolyapti»).
 *
 * Naqsh yorug' zaminda ko'rinishi uchun ganch relyefi qo'llandi: oq
 * qirra + to'q soya. Lekin ranglar qotirib yozilgan edi va TUNGI
 * rejimda oq to'r butun sahifani qoplab, matn umuman o'qilmay
 * qoldi — ekranda ko'rildi.
 *
 * 🔑 Bu xatoni ko'z bilan topish qiyin: yorug' temada hammasi joyida
 * ko'rinadi va tungi temaga o'tmasang bilmaysan. Shuning uchun test
 * ikkala temada ham qiymatni O'LCHAYDI.
 */

const PAGE = '/uz';

test.describe('Landing naqshlari', () => {
  test('ganch relyefi ikkala temada ham o\'z rangida', async ({ page }) => {
    await page.goto(PAGE);

    const read = async () =>
      page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        return {
          light: s.getPropertyValue('--ganch-light').trim(),
          shadow: s.getPropertyValue('--ganch-shadow').trim(),
        };
      });

    const lightTheme = await read();
    // Tokenlar UMUMAN bo'lmasa ham test yiqilsin: qotirib yozilgan
    // rangga qaytish aynan shundan boshlanadi.
    expect(lightTheme.light, 'ganch tokeni yo\'q').not.toBe('');
    expect(lightTheme.shadow).not.toBe('');

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    const darkTheme = await read();

    // 🔑 ENG MUHIMI: tungida qirra rangi BOSHQACHA bo'lishi shart.
    // Bir xil bo'lsa — demak ranglar temaga bog'lanmagan va qorong'i
    // sahifa oq to'r bilan qoplanadi.
    expect(
      darkTheme.light,
      'tungi temada ganch qirrasi yorug\' temanikidek qolgan — sahifa oq to\'r bilan qoplanadi'
    ).not.toBe(lightTheme.light);
  });

  test('yo\'nalish kartochkalarining HAMMASIDA surat bor', async ({ page }) => {
    await page.goto(PAGE);
    // 🔴 Egasi ikki marta aytdi: «rasm qo'ymagansan». Kartochkalar
    // faqat surati bor manzillar uchun; suratsizlari pastdagi
    // RO'YXATDA turadi va u yerda surat kutilmaydi.
    /*
     * 🔴 SURAT YUKLANISHINI KUTAMIZ (17.09.2026).
     *
     * Tekshiruv `goto` dan KEYIN darhol o'lchardi va `tashkent.png`
     * (next/image, 3840 px varianti) hali yuklanmagan bo'lardi:
     * `naturalWidth` 0 chiqib, test HAR SAFAR yiqilardi. Ya'ni qo'riqchi
     * «rasm yo'q» deb qichqirardi, rasm esa BOR — bir soniyadan keyin
     * ko'rinardi (o'lchandi: kutilsa buzuq surat 0 ta).
     *
     * Testning maqsadi o'zgarmadi: kartochkada surat BO'LISHI shart.
     */
    /* Suratlar DANGASA yuklanadi (`loading="lazy"`): ekranga chiqmaguncha
       ular umuman so'ralmaydi. Shuning uchun avval sahifani oxirigacha
       suramiz, keyin hammasi yuklanishini KUTAMIZ. */
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle');
    await page
      .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 })
      .catch(() => {});
    const broken = await page.evaluate(
      () => [...document.querySelectorAll('img')].filter((i) => i.naturalWidth === 0).length
    );
    expect(broken, 'yuklanmagan surat bor').toBe(0);
  });

  test('gorizontal surish yo\'q — tor telefonda ham', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(PAGE);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, 'sahifa yon tomonga suriladi').toBeLessThanOrEqual(1);
  });
});
