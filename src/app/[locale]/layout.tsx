import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Onest, Geist_Mono, Fraunces, Playfair_Display } from 'next/font/google';
import Providers from '../providers';
import { Header } from '@/shared/ui/Header';
import { BottomNav } from '@/shared/ui/BottomNav';
import { ViewTransitions } from '@/shared/ui/ViewTransitions';
import { InstallPromptSuppressor } from '@/shared/ui/InstallPromptSuppressor';
import { BigTextBoot } from '@/shared/ui/BigTextBoot';
import { WhatsNew } from '@/shared/ui/WhatsNew';
import { PullToRefresh } from '@/shared/ui/PullToRefresh';
import { ReferralCapture } from '@/shared/ui/ReferralCapture';
import '../globals.css';
import { trFor, bcp47 } from '@/shared/lib/i18n';
import { LOCALES } from '@/shared/lib/i18n';

/*
 * BODY SHRIFTI — Onest.
 *
 * 🔴 NEGA ALMASHTIRILDI (2026-08-31): ilgari bu Geist edi va
 * `subsets: ['latin']` bilan yuklanardi. Geist'da KIRILL UMUMAN
 * YO'Q — ya'ni ruscha sahifada butun matn tizim shriftiga (har
 * kompyuterda boshqacha) tushib ketardi. Sayt uch tilli, lekin
 * shrift faqat bittasiga ishlagan.
 *
 * Onest — lotin va kirillni birga chizadigan zamonaviy grotesk:
 * uchala tilda ham BIR XIL yuz.
 */
const bodySans = Onest({
  variable: '--font-geist-sans',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

/*
 * 🔴 `preload: false` (10.09.2026): monoshrift butun saytga yuklanardi,
 * lekin `font-mono` klassi IKKI joyda ishlatiladi — `PickupCard`
 * (uchrashuv kodi) va `/pit-stop`. Landingda ham, qidiruvda ham u
 * hech nima chizmaydi. @font-face e'loni qoladi, ya'ni o'sha ikki
 * ekran avvalgidek ishlaydi — shunchaki fayl KERAK BO'LGANDA olinadi.
 */
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  preload: false,
});

// Serif display shrift (Fraunces) — FAQAT katta sarlavhalar (H1/hero) uchun.
// Premium kontrast serif sarlavha + grotesk matn juftligidan keladi.
/*
 * 🔴 FAQAT 900 (10.09.2026, o'lchovdan keyin): bu yerda besh og'irlik
 * yozilgan edi — 400, 500, 600, 700, 900. Kodda esa `font-display`
 * klassi 26 faylda, 36 marta ishlatiladi va O'TTIZ OLTITASI HAM
 * `font-black` bilan keladi. Ya'ni to'rt og'irlik hech qachon
 * chizilmagan: ular @font-face bo'lib e'lon qilinib, brauzerga
 * ortiqcha ish va CSS berardi.
 *
 * Tekshirish usuli (yana kerak bo'lsa): className ichida `font-display`
 * bo'lgan HAMMA satrni olib, har birida og'irlik klassi bor-yo'qligini
 * sanash. «Og'irliksiz» bittasi ham chiqmasligi kerak — chiqsa,
 * brauzer 900 dan soxta og'irlik yasaydi va sarlavha xunuk ko'rinadi.
 */
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['900'],
  display: 'swap',
});

/*
 * KIRILL SARLAVHA SHRIFTI — Playfair Display.
 *
 * 🔴 Fraunces KIRILLNI CHIZMAYDI (loyihada bu allaqachon ma'lum
 * edi). Natijada ruscha sahifadagi HAMMA katta sarlavha Times'ga
 * tushib qolardi — ya'ni brend yuzi faqat o'zbek va ingliz tilida
 * bor edi.
 *
 * Yechim — SKRIPT BO'YICHA ZAXIRA: `--font-display` ro'yxatida
 * Fraunces birinchi, Playfair ikkinchi turadi. Brauzer har harf
 * uchun birinchi mos shriftni oladi: lotin — Fraunces, kirill —
 * Playfair. Ikkalasi ham yuqori kontrastli serif, ya'ni ohang
 * saqlanadi.
 */
/*
 * 🔴 UCH O'ZGARISH (10.09.2026, o'lchovdan keyin):
 *
 *   1. `weight` 700/800/900 → faqat 900. Sabab Fraunces'nikiga bir xil:
 *      `font-display` doim `font-black` bilan keladi.
 *
 *   2. `subsets` dan `latin` OLIB TASHLANDI. Playfair bu yerda FAQAT
 *      kirill uchun turibdi (yuqoridagi izohga qarang) — lotin harflarni
 *      Fraunces chizadi va ro'yxatda u BIRINCHI. Ya'ni lotin subset'i
 *      yuklanardi-yu, undan bitta harf ham chizilmasdi.
 *
 *   3. `preload: false`. O'lchovda ko'rindi: o'zbekcha (lotin) sahifada
 *      brauzer YETTITA shrift faylini tortib olardi, lekin ulardan
 *      faqat TO'RTTASI chizishda ishlatilardi — qolgani `unloaded`
 *      holatida turardi. Playfair kirill sahifada ham FAQAT ZAXIRA:
 *      `display: 'swap'` bor, ya'ni matn darhol chiqadi va shrift
 *      kelganda almashadi. Oldindan tortib olishga arzimaydi.
 */
const displayCyrillic = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['cyrillic'],
  weight: ['900'],
  display: 'swap',
  preload: false,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yolyolakay-frontend.vercel.app';

// viewport-fit=cover — notch/status-bar ostiga kontent to'g'ri joylashsin (safe-area env() ishlashi uchun).
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tr = trFor(locale);
  const title = tr(
    "YolYolakay — O'zbekiston bo'ylab hamroh topish",
    'YolYolakay — поиск попутчиков по Узбекистану',
    'YolYolakay — carpooling across Uzbekistan'
  );
  const description = tr(
    "Arzon, qulay va xavfsiz safarlar. Hamroh toping va yo'l xarajatini bo'ling.",
    'Дёшево, удобно и безопасно. Найдите попутчика и разделите расходы на дорогу.',
    'Cheap, comfortable and safe rides. Find a travel companion and split the costs.'
  );
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: '%s — YolYolakay' },
    description,
    applicationName: 'YolYolakay',
    alternates: {
      canonical: `/${locale}`,
      // `x-default` — qaysi tilga ham mos kelmagan foydalanuvchi (masalan ingliz
      // brauzeri) uchun Google qaysi variantni ko'rsatishini AYTADI. U bo'lmasa
      // tanlov Google ixtiyorida qoladi va rus varianti o'zbek so'roviga chiqib
      // ketishi mumkin. Asosiy bozor O'zbekiston → default `/uz`
      // (proxy.ts dagi `defaultLocale: 'uz'` bilan bir xil).
      // ⚠️ hreflang qiymati BCP-47 shaklida (`uz-Cyrl`), manzil esa
      // kichik harfda (`/uz-cyrl`) — odam manzilni qo'lda ham yozadi.
      languages: {
        uz: '/uz',
        'uz-Cyrl': '/uz-cyrl',
        ru: '/ru',
        en: '/en',
        'x-default': '/uz',
      },
    },
    openGraph: {
      title,
      description,
      siteName: 'YolYolakay',
      type: 'website',
      locale: tr('uz_UZ', 'ru_RU', 'en_US'),
      url: `${SITE_URL}/${locale}`,
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!LOCALES.includes(locale as (typeof LOCALES)[number])) {
    notFound();
  }

  // Fetch translation messages
  const messages = await getMessages();

  return (
    <html
      // ⚠️ `locale` EMAS, BCP-47: ekran o'qigich va brauzer `uz-cyrl`
      // ni tanimaydi, `uz-Cyrl` ni esa taniydi (yozuv belgisi shu
      // shaklda yoziladi).
      lang={bcp47(locale)}
      className={`${bodySans.variable} ${geistMono.variable} ${fraunces.variable} ${displayCyrillic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* No-flash tema + Capacitor aniqlash: hidratsiyagacha to'g'ri klass. Ilova (WebView)
            ichida `in-app` klassi qo'shiladi — native-feel stillar (matn tanlash/zoom yo'q) shunga
            bog'lanadi, oddiy web'da esa qo'llanmaydi. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement;try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}r.classList.remove('light','dark');r.classList.add(t);if(localStorage.getItem('theme_style')==='neon'){r.classList.add('neon');}}catch(e){}try{if(window.Capacitor){r.classList.add('in-app');}}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://yastatic.net" crossOrigin="anonymous" />
        {/* PWA — telefon ekraniga o'rnatiladigan ilova (manifest + ikonкаlar). */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Standart (mobile-web-app-capable) + apple varianti eski iOS Safari uchun saqlanadi. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="YolYolakay" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Toolbar rangi temaga mos (dark'da to'q, light'da oq) — pushti emas, ilova bilan qo'shiladi. */}
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e181c" media="(prefers-color-scheme: dark)" />
      </head>
      <body
        className="min-h-full flex flex-col bg-bg text-text selection:bg-accent selection:text-white"
        suppressHydrationWarning
      >
        <Providers>
          <NextIntlClientProvider messages={messages}>
            {/* Ichki havolalarni ushlab, navigatsiyani brauzerning View
                Transition mexanizmi ichida bajaradi. Hech narsa chizmaydi. */}
            <ViewTransitions />
            {/* Brauzerning "ilovani o'rnating" bannerini o'chiradi — ilova Play
                Market orqali tarqatiladi, saytda uni reklama qilmaymiz. */}
            <InstallPromptSuppressor />
            {/* «Kattaroq matn» sozlamasini tiklaydi (izohi komponentda). */}
            <BigTextBoot />
            {/* Yangilanishdan keyin BIR MARTA — izohi komponentda. */}
            <WhatsNew />
            {/* Tortib yangilash — butun saytda bitta joydan. `body` da
                `overscroll-behavior: none` turgani uchun brauzerning o'z
                yangilash harakati ishlamaydi, PWA'da esa yangilash tugmasi
                ham yo'q (izohi komponent ichida). */}
            <PullToRefresh />
            {/* Taklif kodi (`?r=...`) — birinchi ochilishda ushlanadi. */}
            <ReferralCapture />
            <Header />
            {/* overflow-x-clip (hidden EMAS): hidden bo'lsa main overflow-y'ni ham `auto`ga
                aylantirib, o'z ichida alohida scroll konteyner hosil qilardi — sahifa oxiri
                (futer) kesilgandek ko'rinardi va sticky sarlavha viewport o'rniga shu
                konteynerga bog'lanardi. clip gorizontal toshishni bir xil to'sadi. */}
            <main className="flex-1 flex flex-col overflow-x-clip w-full max-w-[100vw]">
              {children}
            </main>
            <BottomNav />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
