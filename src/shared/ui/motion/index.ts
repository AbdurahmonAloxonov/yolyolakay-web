/**
 * Harakat primitivlari — reactbits.dev katalogidan bizning qoidalardan O'TGAN
 * g'oyalar, o'z kodimizda qayta yozilgan.
 *
 * Nega ko'chirib olinmadi: reactbits komponentlari GSAP/framer-motion (rAF)
 * ustida. rAF brauzer oynani ko'rinmayapti deb hisoblasa to'xtaydi va element
 * `opacity: 0` da qotib qoladi — bu bizda 2026-07-25 da landing'ni bo'sh
 * qoldirgan haqiqiy bug. Bu yerdagilar CSS ustida, yakuniy holat kafolatlangan.
 *
 * 78 komponentdan HAQIQATAN qo'llanganlari — 3 ta:
 *   SplitText    -> `SplitText` (shu papka) — landing hero sarlavhasi
 *   CountUp      -> `CountUp` (shu papka) — haydovchi daromadi
 *   AnimatedList -> `.mo-stagger` / `.mo-stagger-item` (globals.css) —
 *                   qidiruv natijalari, safarlar tarixi, tariflar setkasi
 *
 * `AnimatedContent`/`FadeContent` (scroll bilan ochilish) YOZILMADI: landing'da
 * o'sha mexanizm allaqachon bor (`.ll-reveal` + IntersectionObserver + 4
 * soniyalik failsafe, jonli sinalgan). Ikkinchi parallel amalga oshirish faqat
 * ikki karra qo'llab-quvvatlash bo'lardi.
 *
 * `Stepper` — onboarding'dagi mavjud progress bar bilan qoplanadi.
 *
 * reactbits'ga ALOQASI YO'Q, o'zimizniki: `.mo-lift` (karta ko'tarilishi),
 * `.mo-page` + `[locale]/template.tsx` (sahifa o'tishi — reactbits'da route
 * o'tishi uchun komponent umuman yo'q).
 *
 * O'TMAGANLARI va sababi:
 *   Backgrounds (20 ta: Aurora, Silk, Threads, Particles...) — WebGL/canvas
 *   Kursor effektlari (BlobCursor, SplashCursor, ImageTrail...) — sensorli ekranda ma'nosiz
 *   ShinyText, GradientText, StarBorder — cheksiz dekorativ harakat
 *   BlurText — `filter: blur` animatsiyasi arzon GPU'da qimmat
 *   ScrollVelocity, ScrollFloat — scroll-parallaks
 */
export { SplitText, wordCount } from './SplitText';
export { CountUp } from './CountUp';
