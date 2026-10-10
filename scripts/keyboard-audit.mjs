/**
 * KLAVIATURA AUDITI — Tab bilan yurib bo'ladimi?
 *
 * 🔴 NEGA YOZILDI (2026-09-04). Saytda qulaylikning to'rt o'qi
 * o'lchandi (toshish, barmoq nishoni, kesilgan matn, kontrast, ekran
 * o'qigich), lekin BESHINCHISI — klaviatura — hech qachon
 * tekshirilmagan. Holbuki sichqonchasiz ishlaydigan odam uchun
 * saytning butun boshqaruvi shu.
 *
 * Bu yerda tekshiriladigan uch xil nuqson KO'Z BILAN KO'RINMAYDI —
 * ular faqat Tab bosilganda bilinadi:
 *
 *   1. KO'RINMAS BEKAT — element ekranda yo'q (yopiq menyu, yashirin
 *      panel), lekin Tab unga TUSHADI. Odam «fokus qayerga ketdi?»
 *      deb qoladi: ekranda hech nima o'zgarmaydi, keyingi Enter esa
 *      ko'rinmagan tugmani bosadi.
 *   2. YASHIRINGAN, LEKIN BOSILADIGAN — `aria-hidden="true"` ichidagi
 *      fokuslanadigan element. Ekran o'qigich uni «yo'q» deydi,
 *      klaviatura esa unga olib boradi. Ikkalasi bir-biriga zid.
 *   3. KESILGAN HALQA — `globals.css` da global `:focus-visible`
 *      qoidasi bor (2px halqa + 2px oraliq), lekin `overflow: hidden`
 *      ichidagi element chekkaga tiralib tursa halqa QIRQILADI. Odam
 *      fokus qayerdaligini ko'rmaydi — halqa «bor», lekin ko'rinmaydi.
 *   4. ORQAGA SAKRASH — tor ekranda (bitta ustun) Tab tartibi yuqoridan
 *      pastga borishi kerak. Keyingi bekat oldingisidan sezilarli
 *      YUQORIDA bo'lsa, DOM tartibi ko'rinish tartibiga mos emas va
 *      odam sahifa bo'ylab sakraydi.
 *
 * ⚠️ «Fokus `<body>` ga qaytdi» tekshiruvi ATAYIN YO'Q: Tab ro'yxat
 * oxiriga yetganda brauzer manzil qatoriga o'tadi va bu NORMAL. Uni
 * xato deb sanash 26 ta yolg'on qizil bergandi (birinchi urinish).
 *
 * ISHLATISH:
 *   node scripts/keyboard-audit.mjs                 # mehmon
 *   node scripts/keyboard-audit.mjs <token>         # kirgan holda
 *   AUDIT_BASE=https://yolyolakay.co.uz node scripts/keyboard-audit.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.AUDIT_BASE || 'http://localhost:3111';
const access = process.argv[2] || '';
const PAGES = [
  ['landing', '/uz'],
  ['login', '/uz/login'],
  ['search', '/uz/search'],
  ['tariffs', '/uz/tariffs'],
  ['profile', '/uz/profile'],
  ['parcels', '/uz/parcels'],
  ['history', '/uz/history'],
  ['notifications', '/uz/notifications'],
  ['chats', '/uz/chats'],
  ['dashboard', '/uz/dashboard'],
  ['create-trip', '/uz/driver/create-trip'],
  ['privacy', '/uz/privacy'],
  ['404', '/uz/qwerty'],
];
const STEPS = 60;

const b = await chromium.launch();
let problems = 0;
for (const [w, label] of [[390, '390'], [1280, '1280']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  if (access) {
    await ctx.addCookies([
      { name: 'access_token', value: access, url: BASE },
      { name: 'refresh_token', value: access, url: BASE },
    ]);
    await ctx.addInitScript((a) => {
      localStorage.setItem('access_token', a);
      localStorage.setItem('refresh_token', a);
    }, access);
  }
  const p = await ctx.newPage();
  for (const [n, path] of PAGES) {
    /*
     * 🔴 O'TISH XATOSI JIMGINA YUTILMASIN (10.09.2026).
     *
     * Ilgari bu yerda `.catch(() => {})` turardi. Sahifa ochilmasa
     * (server o'chiq, boshqa portda, yoki 5xx) audit avvalgi — yoki
     * bo'sh — sahifada Tab bosishda davom etardi va natijani
     * SAHIFANING nuqsoni deb yozardi. `ui-audit.mjs` da aynan shu
     * bir marta 92 ta soxta «h1 YO'Q» yasagan edi.
     *
     * 4xx TUTILMAYDI: 404 sahifasi ham to'liq chiziladi va uni ham
     * klaviatura bilan aylanib chiqish kerak.
     */
    let navOk = true;
    try {
      const resp = await p.goto(BASE + path, { waitUntil: 'networkidle' });
      if (resp && resp.status() >= 500) {
        console.log(`${n.padEnd(14)} OCHILMADI: HTTP ${resp.status()}`);
        problems++;
        navOk = false;
      }
    } catch (e) {
      console.log(`${n.padEnd(14)} OCHILMADI: ${String(e).split('\n')[0].slice(0, 80)}`);
      problems++;
      navOk = false;
    }
    if (!navOk) continue;
    await p.waitForTimeout(1200);
    const hidden = new Set();
    const ariaHidden = new Set();
    const clipped = new Set();
    const backJump = new Set();
    let seen = 0;
    let prevTop = null;
    let prevName = '';
    for (let i = 0; i < STEPS; i++) {
      await p.keyboard.press('Tab');
      const info = await p.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return { body: true };
        const c = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        const name = (
          el.getAttribute('aria-label') ||
          (el.textContent || '').trim() ||
          el.getAttribute('placeholder') ||
          el.tagName
        ).slice(0, 26);
        /*
         * HALQA HAQIQATAN CHIZILADIMI. Ikki savol:
         *   • halqa TASHQARIDA chiziladimi (`outline`)? Unda uni
         *     kesadigan ota-ona (`overflow: hidden`, `mask`,
         *     `clip-path`) bormi va element chekkaga tiralganmi;
         *   • yo'q bo'lsa, ICHKARIDAN chizilganmi (`inset` soya)?
         * Ichkaridagi halqa niqob ostida ham qoladi — shuning uchun
         * u kesilgan hisoblanmaydi.
         */
        const st2 = getComputedStyle(el);
        const hasOutline = st2.outlineStyle !== 'none' && parseFloat(st2.outlineWidth) > 0;
        const hasInset = /inset/.test(st2.boxShadow || '');
        let clip = false;
        if (hasOutline && !hasInset) {
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const as = getComputedStyle(a);
            const masked =
              (as.maskImage && as.maskImage !== 'none') ||
              (as.clipPath && as.clipPath !== 'none');
            const cutX = as.overflowX !== 'visible';
            const cutY = as.overflowY !== 'visible';
            if (!masked && !cutX && !cutY) continue;
            const r = a.getBoundingClientRect();
            /*
             * ⚠️ SURILADIGAN o'q kesilgan hisoblanmaydi: halqa chetda
             * qolsa ham odam uni surib ko'radi. Faqat surishga JOY
             * YO'Q bo'lgan o'q muhim — mashhur yo'nalishlar tasmasi
             * aynan shunday edi: `overflow-y: auto`, lekin balandligi
             * chipga TIQ teng, ya'ni halqaning tepasi qirqilardi.
             */
            const scrollsX = a.scrollWidth > a.clientWidth + 1;
            const scrollsY = a.scrollHeight > a.clientHeight + 1;
            if (masked) clip = true;
            if (cutX && !scrollsX && (c.left - r.left < 4 || r.right - c.right < 4)) clip = true;
            if (cutY && !scrollsY && (c.top - r.top < 4 || r.bottom - c.bottom < 4)) clip = true;
            break;
          }
          // Elementning O'ZI niqob/kesim bilan chizilsa, uning tashqi
          // halqasi ham kesiladi (ravoq shaklidagi kartochka).
          if (
            !clip &&
            ((st2.maskImage && st2.maskImage !== 'none') ||
              (st2.clipPath && st2.clipPath !== 'none'))
          ) clip = true;
        }
        return {
          body: false,
          name,
          top: Math.round(c.top + window.scrollY),
          // ⚠️ `sticky`/`fixed` OTA-ONA ham hisobga olinadi: suriladigan
          // sarlavha ekran tepasida qoladi, ya'ni uning hujjatdagi
          // o'rni surish bilan «pastga siljiydi». Elementning o'zi
          // `relative` bo'lsa ham (sarlavhadagi qo'ng'iroqcha), tartib
          // tekshiruvi yolg'on «orqaga sakradi» berardi.
          fixed: (() => {
            for (let a = el; a && a !== document.body; a = a.parentElement) {
              if (/fixed|sticky/.test(getComputedStyle(a).position)) return true;
            }
            return false;
          })(),
          clip,
          tag: el.tagName.toLowerCase(),
          // `offsetParent === null` — element chizilmagan (display:none
          // yoki ota-onasi yashirilgan). `position: fixed` bunda ham
          // null beradi, shuning uchun u alohida hisobga olinadi.
          drawn: el.offsetParent !== null || st.position === 'fixed',
          size: c.width > 0 && c.height > 0,
          visible: st.visibility !== 'hidden' && +st.opacity > 0.01,
          inAriaHidden: !!el.closest('[aria-hidden="true"]'),
          srOnly: el.classList.contains('sr-only'),
        };
      });
      if (info.body) {
        // Ro'yxat oxiri — brauzer manzil qatoriga o'tdi. Bu NORMAL.
        prevTop = null;
        continue;
      }
      seen++;
      if (!info.srOnly && (!info.drawn || !info.size || !info.visible))
        hidden.add(`${info.tag} «${info.name}»`);
      if (info.inAriaHidden) ariaHidden.add(`${info.tag} «${info.name}»`);
      if (info.clip && !info.srOnly) clipped.add(`${info.tag} «${info.name}»`);
      // Orqaga sakrash — FAQAT tor ekranda (keng ekranda ustunlar bor).
      if (w === 390 && !info.fixed && prevTop !== null && info.top < prevTop - 120)
        backJump.add(`«${prevName}» → «${info.name}»`);
      if (!info.fixed) {
        prevTop = info.top;
        prevName = info.name;
      }
    }
    if (hidden.size || ariaHidden.size || clipped.size || backJump.size) {
      problems++;
      console.log(
        `${label} ${n.padEnd(13)} ${hidden.size ? 'KO\'RINMAS:' + JSON.stringify([...hidden].slice(0, 3)) : ''} ` +
          `${ariaHidden.size ? 'YASHIRIN-BOSILADI:' + JSON.stringify([...ariaHidden].slice(0, 3)) : ''} ` +
          `${clipped.size ? 'HALQA KESILADI:' + JSON.stringify([...clipped].slice(0, 3)) : ''} ` +
          `${backJump.size ? 'ORQAGA SAKRAYDI:' + JSON.stringify([...backJump].slice(0, 2)) : ''}`
      );
    }
  }
  await ctx.close();
}
console.log(problems ? `\n${problems} ta muammo` : '\nHammasi toza');
await b.close();
process.exit(problems ? 1 : 0);
