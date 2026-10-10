'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/entities/user/api/useProfile';
import { useUIStore } from '@/shared/model/uiStore';
import { ATLAS_COLORS, AtlasCloth, AtlasEdge } from '@/shared/ui/brand/Atlas';
import {
  GanchPattern,
  GirihPattern,
  Islimi,
  Muqarnas,
  OrnamentMark,
  Pakhta,
  PalakRosette,
  PeshtoqFrame,
  QochqorShox,
} from '@/shared/ui/brand/Ornament';
import { PLAY_URL, hasApp } from '@/shared/lib/appLinks';
import { LocaleSwitch } from '@/shared/ui/LocaleSwitch';
import RotatingText from '@/shared/ui/reactbits/RotatingText';
import ClickSpark from '@/shared/ui/reactbits/ClickSpark';

import { LogoMark } from '@/shared/ui/brand/LogoMark';
import { SuzaniSeal } from '@/shared/ui/brand/SuzaniSeal';
import { DateField } from '@/shared/ui/DateField';
import { SplitText, wordCount } from '@/shared/ui/motion';
import { tashkentNow } from '@/shared/lib/format';
import { RouteChooserMap } from '@/shared/ui/RouteChooserMap';
import { useSessionState } from '@/shared/lib/useSessionState';
import {
  Smartphone,
  Search,
  MapPin,
  CalendarDays,
  Users,
  ArrowRight,
  ArrowUpRight,
  Compass,
  UsersRound,
  PiggyBank,
  ShieldCheck,
  Megaphone,
  Car,
} from 'lucide-react';

import './landing.css';
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM, SUPPORT_TELEGRAM_URL } from '@/shared/config/contacts';
import { useTr } from '@/shared/lib/useTr';

/* ------------------------------------------------------------------ */
/*  YOLYOLAKAY — Premium Light Landing (brend tizimi)                 */
/*  Ranglar FAQAT token orqali: wine-ash / turquoise / brand-pink.    */
/*  Animatsiya FAQAT bir martalik fade+slide (spec 5), CSS orqali —   */
/*  rAF muzlasa ham (occluded oyna, WebView) kontent ko'rinadi.      */
/* ------------------------------------------------------------------ */

/* Bo'lim — viewport'ga kirganda bir marta paydo bo'ladi (once).
   IntersectionObserver .is-in qo'yadi; ochilish landing.css'dagi
   .ll-reveal transition'da — yakuniy holat JS animatsiyasiga bog'liq emas. */
function Section({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      setInView(true);
      cleanup();
    };

    // Zaxira tekshiruv: bo'lim ko'rinish zonasiga kirgan YOKI ustidan o'tib ketilgan bo'lsa
    // ochamiz. IntersectionObserver tez ("fling") scroll'da oraliq holatni o'tkazib yuborishi
    // mumkin — o'shanda bo'lim opacity:0 bo'lib MANGU ko'rinmay qolardi (landing yarmi bo'sh).
    const check = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9 || r.bottom <= 0) show();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) show();
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    // Oxirgi kafolat: nima bo'lganda ham 3 soniyadan keyin kontent ko'rinadi.
    const failsafe = window.setTimeout(show, 3000);

    function cleanup() {
      io.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      window.clearTimeout(failsafe);
    }

    check();
    return cleanup;
  }, []);

  return (
    <section ref={ref} id={id} className={`ll-section ${inView ? 'is-in' : ''} ${className}`}>
      {children}
    </section>
  );
}

/**
 * SCROLL PARALLAKSI — bitta tinglovchi, hamma element uchun.
 *
 * 🔴 NEGA HOOK (egasi tanlagan 8-band): har element o'z `scroll`
 * tinglovchisini yaratsa, surish paytida o'nlab hisoblash ketadi va
 * sahifa «og'irlashadi». Bu yerda BITTA tinglovchi element
 * ko'rinishga qanchalik kirganini `--ll-p` (0…1) qilib yozadi,
 * qolganini CSS qiladi.
 *
 * ⚠️ `requestAnimationFrame` bilan siyraklashtirilgan: scroll
 * hodisasi sekundiga yuz marta keladi, kadr esa 60 marta.
 *
 * ⚠️ Harakatni kamaytirish yoqilgan bo'lsa UMUMAN ishlamaydi —
 * `--ll-p` 0 bo'lib qoladi va CSS ham `transform: none` beradi.
 */
function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 — element pastdan endi kirdi, 1 — tepadan chiqib ketdi.
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      el.style.setProperty('--ll-p', p.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return ref;
}

/* Stagger kechikishi (spec: 0.08s qadam) */
const delay = (i: number) => ({ '--d': `${i * 0.08}s` }) as React.CSSProperties;

export default function HomePage() {
  const locale = useLocale();
  const router = useRouter();
  const { data: profile } = useProfile();
  const { activeRole } = useUIStore();
  const t = useTr();

  // Hero chipida almashadigan yo'nalishlar.
  //
  // TO'LIQ JUFTLIK ko'rsatiladi, "Toshkentdan ..." emas: platformada jo'nash
  // ham, borish ham ISTALGAN viloyat bo'lishi mumkin va poytaxtni qattiq
  // yozib qo'yish mahsulotni noto'g'ri tasvirlardi — go'yo hamma safar
  // Toshkentdan boshlanadigandek. Ro'yxat mamlakat bo'ylab tanlangan:
  // Farg'ona vodiysi, Zarafshon, janub, Xorazm-Qoraqalpog'iston va markaz.
  const HERO_ROUTES = [
    t('Samarqand → Buxoro', 'Самарканд → Бухара', 'Samarkand → Bukhara'),
    t("Andijon → Farg'ona", 'Андижан → Фергана', 'Andijan → Fergana'),
    t('Nukus → Urganch', 'Нукус → Ургенч', 'Nukus → Urgench'),
    t('Qarshi → Termiz', 'Карши → Термез', 'Karshi → Termez'),
    t('Namangan → Toshkent', 'Наманган → Ташкент', 'Namangan → Tashkent'),
    t('Jizzax → Guliston', 'Джизак → Гулистан', 'Jizzakh → Gulistan'),
    t('Navoiy → Samarqand', 'Навои → Самарканд', 'Navoi → Samarkand'),
  ];

  // Hero sarlavhasi — so'zma-so'z animatsiya uchun ikki qatorga ajratilgan.
  const heroLine1 = t('Manzilga yeting,', 'Доберитесь до цели,', 'Get where you are going,');
  const heroLine2 = t('hamroh bilan', 'вместе с попутчиком', 'together');

  const heroArt = useParallax<HTMLDivElement>();
  const clothRef = useParallax<HTMLDivElement>();

  // Qidiruv formasi qiymatlari `sessionStorage` da saqlanadi. Sabab: tilni
  // almashtirish butun `[locale]` daraxtini qayta mount qiladi va oddiy
  // `useState` da kiritilgan shahar/sana YO'QOLARDI (izohi `useSessionState` da).
  const [from, setFrom] = useSessionState('ll-search-from', '');
  const [to, setTo] = useSessionState('ll-search-to', '');
  const [date, setDate] = useSessionState('ll-search-date', '');
  const [seats, setSeats] = useSessionState('ll-search-seats', '1');
  // Qidiruv formasining xato matni (bo'sh yo'nalish). Oddiy `useState` — bu
  // saqlanishi kerak bo'lgan kiritma emas, bir martalik javob.
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (profile) {
      router.replace(`/${locale}/${activeRole === 'driver' ? 'dashboard' : 'search'}`);
    }
  }, [profile, activeRole, locale, router]);

  const features = [
    {
      icon: Compass,
      title: t('Sayohat qiling', 'Путешествуйте', 'Travel further'),
      text: t(
        "Toshkentdan Xivagacha — O'zbekistonning istalgan burchagiga qulay yetib oling. Vaqt va yo'nalishni o'zingiz tanlaysiz.",
        'От Ташкента до Хивы — добирайтесь в любую точку Узбекистана с комфортом. Время и маршрут выбираете вы.',
        'From Tashkent to Khiva — reach any corner of Uzbekistan in comfort. You choose the time and the route.'
      ),
    },
    {
      icon: UsersRound,
      title: t('Yangi tanishuvlar', 'Новые знакомства', 'New connections'),
      text: t(
        "Har bir safar — yangi suhbat va do'stlik. Hujjatlari tekshirilgan ishonchli hamrohlar bilan.",
        'Каждая поездка — новая беседа и дружба. С попутчиками, чьи документы проверены.',
        'Every ride is a new conversation — with companions whose documents are verified.'
      ),
    },
    {
      icon: PiggyBank,
      title: t('Pulni tejang', 'Экономьте', 'Save money'),
      text: t(
        "Yo'l xarajatini bo'ling — yashirin komissiyasiz. Narxni siz taklif qilasiz yoki haydovchi narxiga rozi bo'lasiz.",
        'Делите расходы — без скрытых комиссий. Вы предлагаете цену или соглашаетесь с водителем.',
        "Split the travel costs — with no hidden fees. You suggest the price or accept the driver's."
      ),
    },
  ];

  const steps = [
    {
      icon: ShieldCheck,
      title: t(
        "Telefon raqami bilan ro'yxatdan o'ting",
        'Регистрация по номеру телефона',
        'Sign up with your phone number'
      ),
      text: t(
        'Telefon raqamingizni kiriting va SMS kodini tasdiqlang — bir daqiqada.',
        'Введите номер телефона и подтвердите код из SMS — за минуту.',
        'Enter your phone number and confirm the code from the SMS — in under a minute.'
      ),
    },
    {
      icon: Megaphone,
      title: t(
        "Safar e'lon qiling yoki qidiring",
        'Создайте или найдите поездку',
        'Publish or find a ride'
      ),
      text: t(
        "Haydovchi bo'lsangiz — yo'nalish, vaqt va joylarni belgilang. Yo'lovchi bo'lsangiz — mos safarni toping.",
        'Водитель — укажите маршрут, время и места. Пассажир — найдите подходящую поездку.',
        'As a driver, set your route, time and seats. As a passenger, find a ride that suits you.'
      ),
    },
    {
      icon: Car,
      title: t("Kelishing va yo'lga chiqing", 'Договоритесь и в путь', 'Agree and hit the road'),
      text: t(
        "Narxni kelishing, chat orqali bog'laning va birgalikda qulay sayohat qiling.",
        'Согласуйте цену, свяжитесь в чате и отправляйтесь в комфортную поездку.',
        'Agree on the price, chat with your companion and enjoy a comfortable ride.'
      ),
    },
  ];

  /*
   * MASHHUR YO'NALISHLAR — HAR BIRIDA HAQIQIY SURAT.
   *
   * 🔴 NEGA TO'RTTA, OLTITA EMAS (egasi, 2026-08-30: «yana Farg'ona
   * bilan Toshkentga rasm qo'ymagansan»).
   *
   * Loyihada atigi to'rtta shahar surati bor: Samarqand, Buxoro, Xiva,
   * Toshkent. Farg'onaniki YO'Q. Oldingi yechim — ikkita kartochkani
   * suratsiz qoldirish — aynan shu tanqidga sabab bo'ldi, va haqli:
   * to'rtta suratli kartochka yonida ikkita suratsizi «yuklanmadi»
   * bo'lib ko'rinadi.
   *
   * Bir xil suratni ikki kartochkaga qo'yish ham yechim emas — u
   * dangasalik bo'lib ko'rinadi.
   *
   * Shuning uchun: SURATI BOR manzillar bo'yicha to'rtta yirik
   * kartochka, qolgan yo'nalishlar esa ostida ixcham RO'YXAT bo'lib
   * turadi. Ro'yxatda surat kutilmaydi — ya'ni hech narsa yetishmaydi.
   * Kam, lekin butun.
   *
   * ⚠️ Farg'ona/Namangan surati kelsa — shu yerga kartochka qilib
   * qo'shiladi va ro'yxatdan olinadi.
   *
   * 🔴 NARX YO'Q (egasi, 31.08: «aynan 50 mingdan ketmaydiku hech»).
   * Haqli: bu raqamlar O'YLAB TOPILGAN edi va biz ularni «...dan»
   * deb VA'DA qilib qo'ygandik. Narxni haydovchi o'zi qo'yadi va u
   * kelishiladi — bizda esa o'rtacha narxni aytadigan ma'lumot yo'q.
   *
   * 🔑 Yolg'on raqam bir marta ishlaydi: odam qidiruvga o'tib
   * boshqa narxni ko'radi va butun saytga ishonchi yo'qoladi.
   * Davomiylik esa QOLADI — u geografik fakt, taxminiy belgisi
   * («~») bilan aytiladi.
   */
  const routes = [
    {
      from: 'Toshkent',
      to: 'Samarqand',
      fromRu: 'Ташкент',
      toRu: 'Самарканд',
      hours: '~4',
      img: '/images/destinations/samarkand.png',
    },
    {
      from: 'Toshkent',
      to: 'Buxoro',
      fromRu: 'Ташкент',
      toRu: 'Бухара',
      hours: '~6',
      img: '/images/destinations/bukhara.png',
    },
    {
      from: 'Samarqand',
      to: 'Xiva',
      fromRu: 'Самарканд',
      toRu: 'Хива',
      hours: '~8',
      img: '/images/destinations/khiva.png',
    },
    {
      from: 'Andijon',
      to: 'Toshkent',
      fromRu: 'Андижан',
      toRu: 'Ташкент',
      hours: '~5',
      img: '/images/destinations/tashkent.png',
    },
  ];

  /**
   * Narx ko'rgichi uchun BIRLASHGAN ro'yxat.
   *
   * ⚠️ Narx va davomiylik AYNAN shu ikki manbadan olinadi —
   * kartochkada bir raqam, ko'rgichda boshqasi chiqmasin.
   */

  /** Suratsiz, lekin BOR yo'nalishlar — ixcham ro'yxat. */
  const moreRoutes = [
    { from: 'Toshkent', to: "Farg'ona", fromRu: 'Ташкент', toRu: 'Фергана', hours: '~5' },
    { from: 'Namangan', to: 'Toshkent', fromRu: 'Наманган', toRu: 'Ташкент', hours: '~5' },
    { from: 'Qarshi', to: 'Termiz', fromRu: 'Карши', toRu: 'Термез', hours: '~4' },
    { from: 'Nukus', to: 'Urganch', fromRu: 'Нукус', toRu: 'Ургенч', hours: '~3' },
    { from: 'Jizzax', to: 'Guliston', fromRu: 'Джизак', toRu: 'Гулистан', hours: '~2' },
    { from: 'Navoiy', to: 'Samarqand', fromRu: 'Навои', toRu: 'Самарканд', hours: '~2' },
  ];

  const allRoutes = [...routes, ...moreRoutes];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Yo'nalishsiz qidiruvga O'TKAZMAYMIZ.
    //
    // Ilgari bo'sh forma bilan bosilsa ham `/search?seats=1` ga uloqtirardi:
    // odam landingdan chiqib, bo'sh natijalar sahifasida qolardi va "sayt meni
    // qayoqqadir otib yubordi" degan taassurot olardi (2026-08-09 egasi aytdi).
    // Endi shu yerda qolamiz va nima yetishmayotganini aytamiz.
    if (!from.trim() || !to.trim()) {
      setSearchError(
        t(
          "Qayerdan va qayerga — ikkalasini to'ldiring",
          'Заполните «Откуда» и «Куда»',
          'Fill in both "From" and "To"'
        )
      );
      return;
    }
    setSearchError('');
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (date) params.set('date', date);
    if (seats) params.set('seats', seats);
    router.push(`/${locale}/search${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="landing-page min-h-screen w-full overflow-x-hidden bg-background text-foreground antialiased">
      {/* ===================== HEADER ===================== */}
      {/* header-safe: status bar/old kamera "tishi" ostiga yozuv tushmasin (globals.css). */}
      {/*
        SARLAVHA — endi TO'Q emas, sahifa bilan bir xil zaminda.
        Ostida ingichka ATLAS lentasi: mato «to'p»ining chekkasi kabi.
        Bu bezak emas — u butun sahifaning milliy ohangini birinchi
        50 pikseldayoq e'lon qiladi.
      */}
      <header className="ll-header header-safe sticky top-0 z-50 w-full bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">
          {/* ⚠️ Logotip 36 → 32: sarlavhada endi ikkita boshqaruv
              turadi va 320 px ekranda uchalasi sig'ishi kerak.
              O'lcham `style` bilan beriladi, ya'ni uni sinf bilan
              moslashtirib bo'lmaydi — shuning uchun bitta qiymat. */}
          <Link href={`/${locale}`} className="flex h-11 items-center gap-2 sm:gap-2.5">
            <LogoMark size={32} />
            {/* 320 px da logotip va til tugmasi TEGIB turardi (o'lchandi:
                oraliq 1 px) — eng tor ekranda yozuv yana bir pog'ona
                kichrayadi. */}
            <span className="text-[15px] font-extrabold tracking-tight text-foreground max-[359px]:text-[13px] sm:text-xl">
              YOL<span className="text-brand-pink">YOLAKAY</span>
            </span>
          </Link>

          {/*
            🔴 UCH CHIZIQLI MENYU OLIB TASHLANDI (egasi, 2026-09-03:
            «3ta chiziqni yo'qotgin, ichida kirish bilan tilni
            almashtirish turibdi, tilni almashtirish ham uchta chiziqda
            ham tashqarida turibdi»).

            Ikkita alohida nuqson bir joyda edi:

            1. MENYU IKKI NARSA UCHUN ochilardi — «Kirish» va til.
               Marketing sahifasida boshqa yo'nalish yo'q (bo'limlar
               bitta sahifada, pastga surilib ochiladi), ya'ni menyu
               hech qanday NAVIGATSIYA tashimasdi. Eng muhim amalni
               (kirish) bir bosish ortiga yashirish — sof yo'qotish.

            2. TIL ALMASHTIRGICH IKKI NUSXADA edi. Sarlavhadagisiga
               `hidden sm:inline-flex` berilgan, LEKIN u ishlamasdi:
               `LocaleSwitch` ning ildizida `inline-flex` QOTIRIB
               yozilgan va `className` bilan berilgan `hidden` uni
               bosa olmasdi (bir xil xususiyat, CSS tartibi hal qiladi).
               Jonli o'lchandi: 390 px da almashtirgich sarlavhada
               `display: flex` bilan turardi.
               ⚠️ Shuning uchun endi ko'rinishni O'ROVCHI boshqaradi,
               komponentga `hidden` berilmaydi.

            Endi telefonda sarlavhada AYNAN ikkita boshqaruv bor va
            ikkalasi ham BIR BOSISHDA: globusli til tugmasi va
            «Kirish». Menyu umuman yo'q.
          */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Telefon — ixcham: joriy til + globus, bosilsa uchtasi
                to'liq nomi bilan ochiladi. */}
            <span className="sm:hidden">
              <LocaleSwitch variant="compact" />
            </span>
            {/* Kompyuter — uchala til yonma-yon (joy yetadi). */}
            <span className="hidden sm:inline-flex">
              <LocaleSwitch size="sm" />
            </span>
            <Link
              href={`/${locale}/login`}
              className="inline-flex h-11 items-center rounded-full bg-brand-pink px-3.5 text-[13px] font-bold text-white sm:text-sm transition-transform duration-200 hover:scale-[1.03] active:scale-95 sm:px-5"
            >
              {t('Kirish', 'Войти', 'Sign in')}
            </Link>
          </div>
        </div>

        <AtlasEdge className="h-1.5 w-full" />
      </header>

      {/*
        ===================== HERO =====================

        🔴 QAYTA QURILDI (egasi, 2026-08-30): «hozirgi landing juda
        rasvo chiqqan, haqiqiy brand kompaniyalardek yondash, milliylikka
        urg'u berib atlas matolarini ishlat».

        Nima o'zgardi va NEGA:

        • To'q «aurora» gradient OLIB TASHLANDI. U yashil-pushti loyqa
          dog' bo'lib turardi va hech qanday ma'no tashimasdi — shunchaki
          shablon foni edi. Endi zamin toza, gap esa TIPOGRAFIYA va
          ATLASda.

        • O'ng tomonda HAQIQIY surat (Registon). Ilgari hero'da bironta
          ham surat yo'q edi — sayt nima haqidaligini ko'z bilan
          aytmasdi. Suratning chap chekkasida atlas «gazlama chekkasi»:
          surat matoga tikilgandek ko'rinadi.

        • Pastdagi «yo'l + mashina» rasmi OLIB TASHLANDI. Egasi aynan
          shuni ko'rsatgan: SVG `preserveAspectRatio="none"` bilan
          chizilgandi, ya'ni keng ekranda mashina CHO'ZILIB ketardi.
          Uning o'rnida atlas lentasi — u cho'zilsa ham to'g'ri
          ko'rinadi, chunki u naqsh, tasvir emas.
      */}
      <section className="ll-silk ll-grain relative overflow-hidden bg-background text-foreground">
        {/* Zaminda GIRIH — Registon peshtoqlaridagi to'r. Ilgari bu
            yerda ikatning romb naqshi turardi; romb har qanday
            madaniyatda bor, girih esa AYNAN shu me'morchilikniki. */}
        {/* Yorug' zaminda GANCH relyefi: naqsh rang bilan emas,
            SOYA bilan ko'rinadi (izohi `GanchPattern` da). Ilgari bu
            yerda 0.07 quyuqlikdagi girih turardi va oq fonda u
            deyarli yo'qolib ketardi — egasi shuni ko'rsatdi. */}
        {/* Hero'da naqsh ENG KUCHLI: birinchi taassurot shu yerda
            beriladi. Mazmun bo'limlarida esa u ataylab yengilroq —
            aks holda kartochkalar va matn naqsh bilan raqobat qiladi
            va sahifa charchatadi. Naqsh yordamchi, bosh qahramon
            emas. */}
        <GanchPattern size={82} depth={1} />
        {/* PALAK — sarlavha ortida katta va xira. Chap ustunning
            pastki qismi bo'm-bo'sh edi; endi u yerda so'zana
            quyoshi turadi va sahifa chuqurlik oladi. */}
        <PalakRosette
          className="pointer-events-none absolute -left-24 top-24 hidden h-[30rem] w-[30rem] text-brand-pink lg:block"
          color="currentColor"
          opacity={0.07}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-14 lg:px-8">
          {/*
            🔴 HERO QAYTA QURILDI (egasi tanlagan 5-band).

            «Chapda matn, o'ngda surat» — dunyodagi eng standart
            joylashuv va u hech qanday xotira qoldirmaydi.

            Endi surat kadrning O'NG CHEKKASIGACHA chiqadi (konteyner
            chegarasidan tashqariga), qidiruv kartasi esa uning
            USTIGA suzib chiqadi. Ikki qatlam paydo bo'ladi —
            sahifa yassi bo'lmay qoladi.

            ⚠️ Chekkaga chiqish `lg` dan boshlanadi: telefonda surat
            oddiy tartibda, matn ostida qoladi.
          */}
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            {/* ——— Chap ustun: gap ——— */}
            <div className="min-w-0 text-center lg:text-left">
              {/* Yo'nalishlar almashib turadi (reactbits `RotatingText`).
                  Bu SOF bezak emas — mahsulot nima qilishini bir qarashda
                  ko'rsatadi va shahar nomlari tanish bo'lgani uchun har
                  yoshdagi foydalanuvchiga tushunarli. */}
              <span className="ll-enter inline-flex items-center gap-2 rounded-full border border-border bg-bg-soft px-3 py-1.5 text-[0.8125rem] font-medium text-text-muted sm:px-4 sm:text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-pink" />
                {t("Yo'nalishlar:", 'Направления:', 'Routes:')}
                <RotatingText
                  texts={HERO_ROUTES}
                  rotationInterval={2600}
                  mainClassName="font-bold text-foreground"
                  // `overflow-hidden` + qat'iy balandlik: so'z o'z qutisi
                  // ichida pastdan surilib chiqadi va chip balandligi
                  // sakramaydi.
                  splitLevelClassName="overflow-hidden h-[1.35em] items-center"
                />
              </span>

              {/* H1 — serif display (Fraunces). Sarlavha so'zma-so'z
                  ochiladi (`SplitText`); ikkinchi qator birinchisidan keyin
                  davom etadi, `startIndex` shuning uchun. */}
              <h1 className="font-display mt-5 text-[clamp(2.1rem,8.6vw,3rem)] font-black leading-[1.06] tracking-[-0.02em] sm:mt-6 sm:text-6xl lg:text-[4.25rem]">
                <SplitText text={heroLine1} delay={0.05} />
                <br />
                <span className="text-brand-pink">
                  <SplitText text={heroLine2} delay={0.05} startIndex={wordCount(heroLine1)} />
                </span>
              </h1>

              <p
                style={{ '--d': '0.1s' } as React.CSSProperties}
                className="ll-enter mx-auto mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-text-muted sm:mt-5 sm:text-lg lg:mx-0"
              >
                {t(
                  "O'zbekiston bo'ylab arzon, qulay va xavfsiz safarlar. Hamroh toping, yo'l xarajatini bo'ling — bir necha bosqichda.",
                  'Дёшево, удобно и безопасно по всему Узбекистану. Найдите попутчика и разделите расходы — за пару шагов.',
                  'Cheap, comfortable and safe rides across Uzbekistan. Find a companion and split the costs — in just a few steps.'
                )}
              </p>
            </div>

            {/* ——— O'ng ustun: surat + atlas chekkasi ———
                Telefonda ham CHIZILADI (`hidden` emas): sahifaning yagona
                katta surati shu va uni yashirish mobil foydalanuvchini eng
                muhim vizual dalildan mahrum qilardi. Balandligi esa
                telefonda kichikroq. */}
            <div style={{ '--d': '0.12s' } as React.CSSProperties} className="ll-enter relative">
              {/*
                🔴 SURAT PESHTOQ RAVOG'IDA (2026-08-30, ikkinchi
                to'lqin). Ilgari u oddiy yumaloq burchakli to'rtburchak
                edi — ya'ni dunyoning har qanday saytidagi surat.

                Endi u madrasa ravog'i shaklida kesiladi. Bu bezak
                emas, SHAKL: Registon, Bibixonim, Ko'kaldosh — hammasi
                shu siluetda, va odam uni tushuntirishsiz taniydi.
                Ichidagi surat ham aynan Registon — silued va mazmun
                bir gapni aytadi.

                Ravoq ostida ingichka atlas: mato va me'morchilik —
                ikkalasi ham bizniki, biri ikkinchisini bosmaydi.
              */}
              <div ref={heroArt} className="ll-parallax relative lg:-mr-6 xl:-mr-16 2xl:-mr-28">
                <PeshtoqFrame className="aspect-[4/5] w-full sm:aspect-[5/6] lg:aspect-[3/4]">
                  <Image
                    src="/images/destinations/samarkand.png"
                    alt={t(
                      'Samarqand, Registon maydoni',
                      'Самарканд, площадь Регистан',
                      'Samarkand, Registan Square'
                    )}
                    fill
                    priority
                    sizes="(max-width:1024px) 100vw, 45vw"
                    className="ll-hero-img ll-photo object-cover"
                  />
                </PeshtoqFrame>
                <AtlasEdge
                  className="absolute inset-x-0 bottom-0 h-1.5 rounded-full"
                  palette={0}
                  seed={4}
                />
              </div>
            </div>
          </div>

          {/* Qidiruv paneli — oq karta (wine-ash hero ustida suzadi) */}
          <form
            onSubmit={handleSearch}
            style={{ '--d': '0.15s' } as React.CSSProperties}
            className="ll-enter ll-lift relative z-20 mx-auto mt-8 max-w-5xl rounded-3xl bg-background p-3 sm:mt-10 sm:p-5 lg:-mt-12 lg:max-w-6xl"
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
              <LightField icon={MapPin} label={t('Qayerdan', 'Откуда', 'From')}>
                <input
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder={t('Toshkent', 'Ташкент', 'Tashkent')}
                  className="ll-input"
                />
              </LightField>
              <LightField icon={MapPin} label={t('Qayerga', 'Куда', 'To')}>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder={t('Samarqand', 'Самарканд', 'Samarkand')}
                  className="ll-input"
                />
              </LightField>
              <LightField icon={CalendarDays} label={t('Sana', 'Дата', 'Date')}>
                {/* Ilova ichidagi bilan BIR XIL kalendar (native `<input type="date">`
                    o'rniga) — birinchi ekrandanoq brend ko'rinishi buzilmaydi.
                    `bare` — ramkani LightField o'zi chizadi. */}
                <DateField
                  value={date}
                  onChange={setDate}
                  min={tashkentNow().date}
                  variant="bare"
                  placeholder={t('Sanani tanlang', 'Выберите дату', 'Choose a date')}
                />
              </LightField>
              <LightField icon={Users} label={t("Yo'lovchilar", 'Пассажиры', 'Passengers')}>
                <select
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
                  className="ll-input"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} {t('kishi', 'чел.', 'people')}
                    </option>
                  ))}
                </select>
              </LightField>
            </div>
            {/* Bosilganda mayda uchqun (reactbits `ClickSpark`). Sensorli ekranda
                ham ishlaydi — bosish "yetib bordi" degan darhol javob beradi.
                Doimiy animatsiya sikli olib tashlangan (README ga qarang), ya'ni
                hech narsa bosilmasa hech qanday ish bajarilmaydi. */}
            <ClickSpark sparkColor="#ffffff" sparkCount={10} sparkRadius={22} duration={420}>
              <button
                type="submit"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-pink px-6 py-3.5 text-base font-bold text-white transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] sm:mt-4 sm:py-4"
              >
                <Search className="h-5 w-5" />
                {t('Safar qidirish', 'Найти поездку', 'Find a ride')}
              </button>
            </ClickSpark>
            {searchError && (
              <p role="alert" className="mt-2 text-center text-sm font-semibold text-error">
                {searchError}
              </p>
            )}

            {/*
              XARITADAN TANLASH — 16.09.2026
              (egasi: «karta to'liq ishlatilsin»).

              🔴 Landingda xarita UMUMAN yo'q edi: birinchi ekranda ikkita
              BO'SH matn maydoni turardi. Yangi odam uchun aynan shu eng
              qiyin qadam — u platformada QAYSI shaharlar borligini
              bilmaydi va bo'sh maydonga nima yozishni tushunmaydi.

              ⚠️ Xarita HAQIQIY safarlarni ko'rsatmaydi va ko'rsata olmaydi:
              `GET /rides/search` jo'nash VA borish nuqtasini birga talab
              qiladi, `GET /rides/recommendations` esa mehmonga 401
              qaytaradi (16.09.2026 da o'lchandi). O'ylab topilgan nuqta
              chizish yolg'on bo'lardi. Shuning uchun u KIRISH NUQTASI:
              shahar bosiladi, maydon to'ladi, qidiruvni o'sha bitta
              tugma ishga tushiradi.
            */}
            <div className="mt-3 sm:mt-4">
              <p className="mb-2 text-center text-xs font-bold text-text-muted">
                {t('Yoki xaritadan tanlang', 'Или выберите на карте', 'Or pick on the map')}
              </p>
              <RouteChooserMap from={from} to={to} onFrom={setFrom} onTo={setTo} />
            </div>
          </form>

          {/*
            ISHONCH QATORI — qidiruvdan keyin darhol.

            🔴 NEGA KERAK: hero odamga «qidir» deydi, lekin NEGA aynan
            bizda qidirishi kerakligini aytmasdi — javob sahifaning
            o'rtasidagi kartochkalarda ko'milgan edi va u yergacha
            hamma ham yetib bormaydi.

            Uchala da'vo ham HAQIQIY va tekshirilishi mumkin: hujjat
            moderatsiyadan o'tadi, to'lov haydovchiga naqd beriladi,
            biz undan foiz olmaymiz.
          */}
          <ul
            style={{ '--d': '0.2s' } as React.CSSProperties}
            className="ll-enter mx-auto mt-5 flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[0.8125rem] font-semibold text-text-muted sm:mt-6 sm:text-sm"
          >
            {[
              {
                c: ATLAS_COLORS.turquoise,
                label: t(
                  'Hujjatlari tekshirilgan haydovchilar',
                  'Водители с проверенными документами',
                  'Drivers with verified documents'
                ),
              },
              {
                c: ATLAS_COLORS.saffron,
                label: t(
                  "To'lov haydovchiga — naqd",
                  'Оплата водителю — наличными',
                  'You pay the driver in cash'
                ),
              },
              {
                c: ATLAS_COLORS.crimson,
                label: t("Bizdan komissiya yo'q", 'Мы не берём комиссию', 'We take no commission'),
              },
            ].map((x) => (
              <li key={x.label} className="flex items-center gap-2">
                {/* Nuqta emas, PAXTA GULI — sahifa bo'ylab takrorlanib,
                    uni bir butun qiladigan mayda belgi. */}
                <Pakhta className="h-3 w-3 shrink-0" color={x.c} />
                {x.label}
              </li>
            ))}
          </ul>
        </div>

        {/*
          🔴 «YO'L + MASHINA» RASMI OLIB TASHLANDI (egasi ko'rsatdi,
          2026-08-30: «mashina ikonchasi cho'zilib ketgan»).

          Sabab aniq edi: u 1200×120 `viewBox` ni
          `preserveAspectRatio="none"` bilan butun ekran eniga
          cho'zardi. 1440 pikselli ekranda mashina 1.2 barobar yassi
          bo'lib qolardi — bu «uslub» emas, buzilgan tasvir.

          O'rniga atlas: u NAQSH, ya'ni cho'zilganda ham to'g'ri
          qoladi — matoning o'zi shunday to'qiladi. Va u SOKIN:
          to'liq enli lenta emas, qisqa belgi.
        */}
        {/* Bo'lim ajratgichi — chiziq emas, ISLIMI NOVDASI. Girih
            geometriya bo'lsa, islimi tiriklik: ikkalasi an'anada
            doim yonma-yon ishlatiladi. */}
        <Islimi
          className="relative z-10 h-10 pb-2"
          color="var(--ll-teal)"
          opacity={0.45}
          width={170}
        />
      </section>

      {/*
        ===================== RAQAMLAR =====================

        ⚠️ HAMMA RAQAM HAQIQIY va tekshiriladigan. Foydalanuvchi yoki
        safar soni ATAYIN yo'q: bizda u raqam yo'q va o'ylab topilgan
        son — yolg'on. Yolg'on raqam bir marta ishlaydi, keyin brendni
        o'ldiradi.
      */}
      <Section className="ll-silk relative overflow-hidden py-10 sm:py-14">
        <GanchPattern size={90} depth={0.5} />
        <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-3 gap-4 px-4 sm:gap-8 sm:px-6 lg:px-8">
          {[
            {
              n: '14',
              label: t('hudud', 'регионов', 'regions'),
              hint: t(
                "Butun O'zbekiston bo'ylab",
                'По всему Узбекистану',
                'Across all of Uzbekistan'
              ),
            },
            {
              n: '3',
              label: t('til', 'языка', 'languages'),
              hint: t(
                "O'zbek, rus, ingliz",
                'Узбекский, русский, английский',
                'Uzbek, Russian, English'
              ),
            },
            {
              n: '0%',
              label: t('komissiya', 'комиссия', 'commission'),
              hint: t(
                "Pul to'liq haydovchiga",
                'Деньги полностью водителю',
                'The money goes to the driver'
              ),
            },
          ].map((x, i) => (
            <div key={x.label} style={delay(i + 1)} className="ll-reveal text-center">
              <div
                className="font-display text-4xl font-black leading-none tracking-tight sm:text-6xl"
                style={{ color: 'var(--ll-ink)' }}
              >
                {x.n}
              </div>
              <div
                className="mt-1.5 text-xs font-bold uppercase tracking-[0.16em] sm:text-sm"
                style={{ color: 'var(--ll-teal)' }}
              >
                {x.label}
              </div>
              <p className="mt-1.5 text-[0.8125rem] leading-snug text-text-muted sm:text-sm">
                {x.hint}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ===================== ILOVA ===================== */}
      {/* 🔴 Sahifada ilova haqida bir og'iz ham yo'q edi (2026-08-28):
          bildirishnoma, ovozli signal, offline safar kartasi va chat —
          hammasi ILOVADA. Odamni faqat saytda ushlab qolish uni eng
          zaif kanalda qoldirish demak: safar bekor qilinganini u o'z
          vaqtida bilmaydi.

          ⚠️ Blok hozircha CHIZILMAYDI — izohi `appLinks.ts` da. */}
      {hasApp && (
        <Section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="ll-reveal flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface px-5 py-8 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
            <div>
              <h2 className="font-display text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {t('Telefoningizda qulayroq', 'В телефоне удобнее', 'Better on your phone')}
              </h2>
              <p className="mt-2 max-w-md text-sm text-text-muted">
                {t(
                  'Safar haqidagi xabar ovoz bilan keladi, safar kartasi internetsiz ham ochiladi.',
                  'Сообщения о поездке приходят со звуком, карточка поездки открывается и без интернета.',
                  'Ride notifications arrive with a sound, and the ride card opens without internet.'
                )}
              </p>
            </div>
            <a
              href={PLAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-wine-ash px-6 py-3.5 text-sm font-bold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-95"
            >
              <Smartphone className="h-4 w-4" />
              {t('Ilovani yuklab olish', 'Скачать приложение', 'Get the app')}
            </a>
          </div>
        </Section>
      )}

      {/* ===================== USTUNLIKLAR ===================== */}
      <Section className="ll-silk relative overflow-hidden px-4 py-14 sm:py-20">
        <GanchPattern size={90} depth={0.55} />
        <div className="relative z-10 mx-auto max-w-7xl sm:px-2 lg:px-4">
          <div className="ll-reveal mx-auto max-w-2xl text-center">
            {/* Yorliq — bo'lim nima haqidaligini bir so'zda aytadi va
              sahifaga tahririy ritm beradi. Kuchli brend saytlarida
              sarlavha hech qachon yolg'iz turmaydi. */}
            <SectionEyebrow>{t('Ustunliklar', 'Преимущества', 'Why us')}</SectionEyebrow>
            <h2 className="ll-mask font-display mt-3 text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {t('Nega aynan', 'Почему именно', 'Why')}{' '}
              <span className="text-brand-pink">YolYolakay?</span>
            </h2>
            <p className="mt-3 text-[0.95rem] text-text-muted sm:mt-4 sm:text-base">
              {t(
                'Xavfsiz, qulay va arzon hamroh topish platformasi.',
                'Безопасная, удобная и доступная платформа поиска попутчиков.',
                'A safe, convenient and affordable way to find travel companions.'
              )}
            </p>
          </div>

          <OrnamentMark className="ll-weave my-8 sm:my-10" />

          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            {features.map((f, i) => (
              <div key={f.title} style={delay(i + 1)} className="ll-reveal h-full">
                <div className="ll-lift group relative h-full overflow-hidden rounded-3xl bg-surface p-6 sm:p-8">
                  {/* Yuqori chekkada atlas rangi — kartochka o'z rangiga
                    ega bo'ladi va uchtasi bir-biridan ajraladi. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1"
                    style={{
                      background: [
                        ATLAS_COLORS.turquoise,
                        ATLAS_COLORS.indigo,
                        ATLAS_COLORS.crimson,
                      ][i % 3],
                    }}
                  />
                  {/* Ikonka ramkasi ATLAS rangida — uchtasi uch xil.
                    Hammasi bir xil turkuaz bo'lsa, kartochkalar bir-biridan
                    ajralmaydi va sahifa yassi ko'rinadi. */}
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-white sm:h-14 sm:w-14"
                    style={{
                      background: [
                        ATLAS_COLORS.turquoise,
                        ATLAS_COLORS.indigo,
                        ATLAS_COLORS.crimson,
                      ][i % 3],
                    }}
                  >
                    <f.icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-foreground sm:mt-6 sm:text-2xl">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-text-muted sm:mt-3">
                    {f.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ===================== 3 QADAM (statik nuqta-chiziq) ===================== */}
      {/*
        QADAMLAR — IKKI USTUN (2026-08-30).

        🔴 Ilgari sarlavha markazda, qadamlar esa chapda tor ustunda
        turardi va ekranning o'ng YARMI BO'M-BO'SH qolardi. Keng
        ekranda bu «sahifa tugab qolgan» degan taassurot berardi.

        Endi chapda sarlavha va bitta jumla YOPISHIB turadi
        (`lg:sticky`), o'ngda esa qadamlar suriladi — o'qish
        davomida sarlavha ko'z oldida qoladi.
      */}
      <Section className="ll-silk relative overflow-hidden py-14 sm:py-20">
        <GanchPattern size={90} depth={0.55} />
        <div className="relative z-10 mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:px-8">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow className="justify-center lg:justify-start">
              {t('Qanday ishlaydi', 'Как это работает', 'How it works')}
            </SectionEyebrow>
            <h2 className="ll-mask font-display mt-3 text-center text-3xl font-black tracking-tight text-foreground sm:text-4xl lg:text-left lg:text-5xl">
              {t("3 qadamda yo'lda", 'В пути за 3 шага', 'On the road in 3 steps')}
            </h2>
            <OrnamentMark className="ll-weave mt-5 sm:mt-6 lg:justify-start" />
            <p
              style={delay(1)}
              className="ll-reveal mt-4 text-center text-[0.95rem] text-text-muted sm:mt-5 lg:text-left lg:text-base"
            >
              {t(
                "Ro'yxatdan o'tishdan birinchi safargacha — o'rtacha besh daqiqa.",
                'От регистрации до первой поездки — в среднем пять минут.',
                'From signing up to your first ride — about five minutes.'
              )}
            </p>
          </div>

          <div className="relative">
            {/* STATIK vertikal dashed chiziq (scroll-linked EMAS) */}
            <div
              className="absolute left-[1.65rem] top-4 hidden h-[calc(100%-2rem)] border-l-2 border-dashed border-[color:var(--ll-teal)]/35 sm:block"
              aria-hidden
            />
            <div className="space-y-8 sm:space-y-12">
              {steps.map((s, i) => (
                <div
                  key={s.title}
                  style={delay(i + 1)}
                  className="ll-reveal relative grid grid-cols-[auto_1fr] items-start gap-4 sm:gap-8"
                >
                  {/* Pushti EMAS: qadam ikonkasi amal emas, belgi.
                      Pushti sahifada faqat bosiladigan asosiy amalda
                      qoladi — shunda u kuchini yo'qotmaydi.

                      ⚠️ `--ll-ink` HAM EMAS: u temada TESKARI bo'ladi
                      va tungi rejimda oq ikonka oq doirada yo'qolib
                      qolgandi (ekranda ko'rildi). Atlas ranglari esa
                      ikkala temada ham bir xil turadi — xususiyat
                      kartochkalaridagi bilan aynan bitta terma. */}
                  <div
                    className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md sm:h-14 sm:w-14"
                    style={{
                      background: [
                        ATLAS_COLORS.turquoise,
                        ATLAS_COLORS.indigo,
                        ATLAS_COLORS.crimson,
                      ][i % 3],
                    }}
                  >
                    <s.icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div className="min-w-0 pt-0.5 sm:pt-1">
                    <div className="flex items-baseline gap-2 sm:gap-3">
                      {/* Raqam QO'CHQOR SHOXI orasida — chorvador xalq
                          naqshi, kuch belgisi. Oddiy «01» har joyda bor. */}
                      {/* ⚠️ Kenglik QAT'IY (`w-12`): shoxi mutlaq
                          joylashgani uchun o'rovchi faqat raqam eniga
                          qisqarardi va sarlavha raqamga YOPISHIB
                          qolardi (ekranda ko'rildi). */}
                      <span className="relative inline-flex w-12 shrink-0 items-center justify-center sm:w-16">
                        <QochqorShox
                          className="absolute inset-0 h-full w-full"
                          color="var(--ll-teal)"
                          opacity={0.42}
                        />
                        <span className="font-display relative text-xl font-black text-text-muted sm:text-2xl">
                          0{i + 1}
                        </span>
                      </span>
                      <h3 className="text-lg font-bold text-foreground sm:text-2xl">{s.title}</h3>
                    </div>
                    <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-text-muted">
                      {s.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/*
        ===================== ATLAS TASMASI =====================

        🔴 NEGA (egasi: «atlasni ishlatishni bilmabsan, tekkis qilib
        qo'yibsan, matoligi bilinmayapti»).

        Ilgari atlas faqat 4–6 pikselli chiziq edi. Bunday enlikda
        hech qanday mato ko'rinmaydi — na bodom, na taroq, na ipak
        nuri. Ya'ni men matoni ishlatmagan, uni CHIZIQQA aylantirib
        yuborgan edim.

        Bu yerda u O'ZI BO'LIB turadi: butun en bo'ylab, yetarli
        balandlikda — abr naqshlari, chekkalarning sizishi va nur
        yo'li ko'rinadi. Sahifada mato AYNAN BIR MARTA shu qadar
        yirik: takrorlansa devor qog'oziga aylanadi.
      */}
      {/* Muqarnas — yorug' zamindan matoga o'tish. Registon
          peshtoqlari ostidagi asal uyasi qatorlari: tekis chiziq
          o'rniga me'moriy o'tish. */}
      <Muqarnas className="-mb-px h-5 text-wine-ash sm:h-7" color="currentColor" flip />
      {/*
        ===================== ATLAS + YOZUV (B varianti) =====================

        🔴 NEGA BIRLASHTIRILDI (egasi tanladi, 31.08).

        Ilgari bu IKKI ALOHIDA element edi: katta yozuv yuqorida,
        atlas tasmasi ostida — va ular bir-biriga TEGMASDI. Yozuvning
        pastdan kesilib qolgani ham shundan edi: men ularni manfiy
        chekka bilan zo'rlab yaqinlashtirgandim va mato harflarning
        oyog'ini yeb qo'ygandi.

        Endi ular BITTA KADR: mato — fon, yozuv — mazmun.

        ⚠️ Mato ola-bula va oq matn unda YO'QOLADI. Shuning uchun
        PARDA: chekkalarda shaffof (mato ko'rinsin), markazda
        quyuqroq (matn o'qilsin). Bu «qora quti» emas — naqsh parda
        ostidan baribir sezilib turadi.

        ⚠️ Yozuv `aria-hidden` EMAS: bu bezak emas, gap.
      */}
      <div className="relative overflow-hidden">
        {/* Mato scroll bo'yicha YOYILADI — to'p ochilayotgandek.
            Kengligi ataylab ortiqcha (`w-[130%]`), shunda siljiganda
            chekkada bo'shliq ochilmaydi. */}
        <div aria-hidden ref={clothRef} className="ll-unroll w-[130%]">
          <AtlasCloth
            className="h-36 w-full sm:h-48 lg:h-56"
            palette={0}
            vertical={false}
            scale={0.62}
            seed={21}
          />
        </div>

        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(26,10,16,0.16) 0%, rgba(26,10,16,0.6) 32%, rgba(26,10,16,0.66) 68%, rgba(26,10,16,0.16) 100%)',
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center px-3">
          <p
            className="ll-mask font-display select-none whitespace-nowrap text-center font-black leading-[0.95] tracking-[-0.03em] text-white"
            style={{
              fontSize: 'clamp(1.9rem, 9.5vw, 8rem)',
              textShadow: '0 2px 26px rgba(26,10,16,0.5)',
            }}
          >
            {t("O'zbekiston bo'ylab", 'По всему Узбекистану', 'Across Uzbekistan')}
          </p>
        </div>
      </div>

      {/* ===================== MASHHUR YO'NALISHLAR ===================== */}
      <Section className="bg-bg-soft py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Sarlavhalar sahifa bo'ylab BIR XIL tartibda: markazda va
              ostida atlas belgisi. Ilgari bu bittasi chapda turardi va
              sahifa yig'ilmagan ko'rinardi. */}
          <SectionEyebrow>{t("Yo'nalishlar", 'Маршруты', 'Routes')}</SectionEyebrow>
          <h2 className="ll-mask font-display mt-3 text-center text-3xl font-black tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {t("Mashhur yo'nalishlar", 'Популярные маршруты', 'Popular routes')}
          </h2>
          <OrnamentMark className="ll-weave mt-5 sm:mt-6" />
          {/*
            KARTOCHKALAR — surat KADRNI TO'LDIRADI, matn esa uning
            USTIDA turadi.

            🔴 Ilgari surat kichkina lenta (144px) edi va ostida oq
            quti — ya'ni surat kartochkaning bezagi edi, mazmuni emas.
            Endi teskarisi: Registon, Kalon, Ichan qal'a — ular
            odamni yo'lga chorlaydigan yagona narsa, shuning uchun
            butun kartochka o'sha suratdir.
          */}
          {/*
            RITM — to'rtta TENG kartochka ro'yxat edi, kompozitsiya
            emas. Endi birinchisi ikki barobar katta va ikki qatorni
            egallaydi, qolgani uning atrofida teriladi.

            🔑 Go'zallik TAKRORDAN emas, IERARXIYADAN keladi: ko'z
            qayerdan boshlashni biladi va kadr bo'ylab yuradi.

            Katak: 4 ustun × 2 qator.
              0-kartochka  2×2   (bosh kadr)
              1, 2         1×1   (yuqori o'ng)
              3            2×1   (pastki o'ng, keng)
          */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:grid-rows-2">
            {routes.map((r, i) => (
              <div
                key={`${r.from}-${r.to}`}
                style={delay(i + 1)}
                className={
                  'll-reveal ' +
                  (i === 0
                    ? 'lg:col-span-2 lg:row-span-2'
                    : i === 3
                      ? 'sm:col-span-2 lg:col-span-2'
                      : '')
                }
              >
                <Link
                  // Marketing kartochkasi — bosilganda o'sha yo'nalish bo'yicha HAQIQIY qidiruvni
                  // ishga tushiradi (from+to qidiruv formasiga uzatiladi), fake natija ko'rsatmaydi.
                  href={`/${locale}/search?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`}
                  className={
                    'll-card ll-lift ll-peshtoq group relative block h-full overflow-hidden ' +
                    // Bosh kadr baland, qolganlari past — nisbatlar
                    // katakka mos, aks holda ular cho'zilib ketardi.
                    (i === 0
                      ? 'aspect-[4/5] lg:aspect-auto lg:min-h-[30rem]'
                      : i === 3
                        ? 'aspect-[4/5] sm:aspect-[16/9] lg:aspect-auto lg:min-h-[14.5rem]'
                        : 'aspect-[4/5] lg:aspect-auto lg:min-h-[14.5rem]')
                  }
                >
                  <Image
                    src={r.img}
                    alt={t(r.to, r.toRu, r.to)}
                    fill
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                    className="ll-card-img ll-photo object-cover"
                  />
                  {/* Pastdan yuqoriga to'q parda — matn HAR QANDAY
                      suratda o'qilsin. Yuqorisi ochiq qoladi: surat
                      ko'rinishi kerak. */}
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(20,8,14,0) 38%, rgba(20,8,14,0.55) 68%, rgba(20,8,14,0.9) 100%)',
                    }}
                  />
                  {/* Atlas chekkasi — kartochka pastida ingichka chiziq. */}
                  {/* Har kartochkada BOSHQA terma — atlasda ham har
                      to'p o'z rangida bo'ladi. */}
                  <AtlasEdge
                    className="absolute inset-x-0 bottom-0 z-10 h-1.5"
                    palette={i}
                    seed={i + 2}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    <div
                      className={
                        'flex items-center gap-1.5 font-extrabold text-white ' +
                        (i === 0 ? 'text-lg sm:text-2xl' : 'text-[0.9375rem] sm:text-base')
                      }
                    >
                      <span className="truncate">{t(r.from, r.fromRu, r.from)}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-turquoise" />
                      <span className="truncate">{t(r.to, r.toRu, r.to)}</span>
                    </div>
                    <div className="mt-1 text-[0.8125rem] text-white/75">
                      <span>
                        {t("Yo'lda", 'В пути', 'On the road')} {r.hours} {t('soat', 'ч', 'h')}
                      </span>
                    </div>
                  </div>
                  <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
            ))}
          </div>

          {/*
            QOLGAN YO'NALISHLAR — ixcham ro'yxat.

            🔑 Bu «suratni topa olmadik» degani emas. Ro'yxatda surat
            KUTILMAYDI: u katalog, afisha emas. Shuning uchun hech
            narsa yetishmayotgandek ko'rinmaydi — kartochkalar esa
            faqat haqiqiy suratlar bilan qoladi.
          */}
          <div
            style={delay(5)}
            className="ll-lift ll-reveal mt-8 rounded-[1.5rem] bg-surface p-2 sm:mt-10"
          >
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {moreRoutes.map((r) => (
                <li key={`${r.from}-${r.to}`}>
                  <Link
                    href={`/${locale}/search?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`}
                    className="group flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors hover:bg-bg-soft"
                  >
                    <span
                      data-user-text
                      className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold text-foreground"
                    >
                      {t(r.from, r.fromRu, r.from)}
                      <ArrowRight
                        className="mx-1.5 inline h-3.5 w-3.5"
                        style={{ color: 'var(--ll-teal)' }}
                      />
                      {t(r.to, r.toRu, r.to)}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-text-muted">
                      {r.hours} {t('soat', 'ч', 'h')}
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-border transition-colors group-hover:text-[color:var(--ll-ink)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/*
        ===================== NARX QANDAY BELGILANADI =====================

        🔴 QAYTA YOZILDI (egasi, 31.08: «narxni olib tashlash kerak,
        chunki aynan 50 mingdan ketmaydiku hech»).

        Haqli edi: bu yerda «50 000 so'mdan» degan raqamlar turardi va
        ular O'YLAB TOPILGAN edi. Yolg'on raqam bir marta ishlaydi —
        odam qidiruvga o'tib boshqa narxni ko'radi va butun saytga
        ishonchi yo'qoladi.

        🔑 Lekin SAVOLNI o'chirmadik: «qancha turadi?» — odamning
        birinchi savoli va unga javob berilmasa u shunchaki chiqib
        ketadi. Javob endi HALOL: narxni haydovchi qo'yadi, siz
        kelisha olasiz, real raqamlar esa qidiruvda.

        Yo'nalish tanlagichlari qoldi — ular endi narx ko'rsatmaydi,
        to'g'ridan-to'g'ri o'sha yo'nalish qidiruviga olib boradi.
      */}
      <Section className="ll-dark-panel relative overflow-hidden bg-wine-ash py-14 text-white sm:py-20">
        <GirihPattern color="var(--turquoise)" opacity={0.1} size={86} />
        <PalakRosette
          className="pointer-events-none absolute -right-20 -top-24 h-[24rem] w-[24rem] text-turquoise"
          color="currentColor"
          opacity={0.12}
        />
        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="ll-reveal flex items-center justify-center gap-2">
              <Pakhta className="h-3 w-3" color="var(--turquoise)" />
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-white/60">
                {t('Narx', 'Цена', 'Price')}
              </span>
            </div>
            <h2 className="ll-mask font-display mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              {t('Qancha turadi?', 'Сколько это стоит?', 'What does it cost?')}
            </h2>
            <p
              style={delay(1)}
              className="ll-reveal mt-4 text-[0.9375rem] leading-relaxed text-white/70 sm:text-base"
            >
              {t(
                "Qat'iy narx yo'q va biz uni belgilamaymiz. Har safarga narxni haydovchining o'zi qo'yadi, siz esa o'z narxingizni taklif qilishingiz mumkin. Shuning uchun bu yerda raqam yozib qo'ymaymiz — qidiruvda bugungi haqiqiy narxlarni ko'rasiz.",
                'Фиксированной цены нет, и мы её не устанавливаем. Цену на каждую поездку ставит сам водитель, а вы можете предложить свою. Поэтому мы не пишем здесь цифру — реальные цены на сегодня вы увидите в поиске.',
                "There is no fixed price and we do not set one. The driver sets the price for each ride and you may counter. That is why we do not print a number here — you will see today's real prices in the search."
              )}
            </p>
          </div>

          <ul className="mx-auto mt-8 grid grid-cols-1 max-w-3xl gap-3 sm:grid-cols-3">
            {[
              {
                c: ATLAS_COLORS.turquoise,
                t: t("Haydovchi qo'yadi", 'Ставит водитель', 'The driver sets it'),
                d: t(
                  "U yo'l xarajatini biladi.",
                  'Он знает свои расходы на дорогу.',
                  'They know what the trip costs them.'
                ),
              },
              {
                c: ATLAS_COLORS.saffron,
                t: t('Siz kelishasiz', 'Вы договариваетесь', 'You negotiate'),
                d: t(
                  "O'z narxingizni taklif qilishingiz mumkin.",
                  'Вы можете предложить свою цену.',
                  'You can offer your own price.'
                ),
              },
              {
                c: ATLAS_COLORS.crimson,
                t: t('Biz olmaymiz', 'Мы не берём', 'We take nothing'),
                d: t(
                  "Komissiya yo'q, pul to'liq haydovchiga.",
                  'Комиссии нет, деньги полностью водителю.',
                  'No commission — the money goes to the driver.'
                ),
              },
            ].map((x, i) => (
              <li
                key={x.t}
                style={delay(i + 2)}
                className="ll-reveal rounded-2xl bg-white/[0.06] p-4 text-center sm:p-5"
              >
                <span
                  aria-hidden
                  className="mx-auto block h-1 w-8 rounded-full"
                  style={{ background: x.c }}
                />
                <h3 className="mt-3 text-base font-bold">{x.t}</h3>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-white/60">{x.d}</p>
              </li>
            ))}
          </ul>

          {/* Yo'nalish tanlagichlari — endi narx ko'rsatmaydi, o'sha
              yo'nalish bo'yicha HAQIQIY qidiruvni ochadi. */}
          <div
            style={delay(5)}
            // `py-1` — FOKUS HALQASI uchun joy (2026-09-04, o'lchandi):
            // chip tasmaning tepasiga 0 px tiralib turardi va
            // klaviatura halqasining yuqori qismi qirqilardi.
            className="ll-reveal -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 py-1 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0"
          >
            {allRoutes.map((r) => (
              <Link
                key={`p-${r.from}-${r.to}`}
                href={`/${locale}/search?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`}
                /* ⚠️ `min-h-11`: chiplar 36 px edi va yonma-yon turadi — barmoq
                   qo'shnisini bosardi (PRODDA o'lchandi 2026-09-04). */
                className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white/10 px-4 py-2 text-[0.8125rem] font-bold text-white/75 transition-colors hover:bg-white hover:text-wine-ash sm:text-sm"
              >
                {t(r.from, r.fromRu, r.from)} → {t(r.to, r.toRu, r.to)}
              </Link>
            ))}
          </div>

          <div style={delay(6)} className="ll-reveal mt-8 text-center">
            <Link
              href={`/${locale}/search`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-pink px-7 py-3.5 text-base font-bold text-white transition-transform duration-200 hover:scale-[1.03]"
            >
              {t("Bugungi narxlarni ko'rish", 'Посмотреть цены на сегодня', "See today's prices")}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </Section>

      {/*
        ===================== XAVFSIZLIK =====================

        🔴 NEGA (2-band): «hujjatlari tekshirilgan» degan gap sahifada
        BIR MARTA, chip ichida aytilardi — xolos. Aslida bizda
        aytadigan narsa ko'p va u raqobatchida yo'q. Aytilmagan
        ustunlik — ustunlik emas.

        ⚠️ HAMMA BAND — MAHSULOTDA BOR NARSA. «Rejalashtirilmoqda»
        yoki «tez orada» degan va'da YO'Q: xavfsizlik haqidagi
        bajarilmagan va'da oddiy marketing yolg'oni emas, odamning
        xavfsizligi haqidagi yolg'on bo'ladi.
      */}
      <Section className="ll-silk relative overflow-hidden py-14 sm:py-20">
        <GanchPattern size={90} depth={0.5} />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>{t('Xavfsizlik', 'Безопасность', 'Safety')}</SectionEyebrow>
            <h2 className="ll-mask font-display mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {t(
                "Notanish odam bilan yo'lga chiqasiz",
                'Вы едете с незнакомым человеком',
                'You travel with someone you have not met'
              )}
            </h2>
            <p
              style={delay(1)}
              className="ll-reveal mt-4 text-[0.9375rem] leading-relaxed text-text-muted sm:text-base"
            >
              {t(
                'Buni biz ham bilamiz. Shuning uchun har safar ortida oltita aniq qoida turadi — hammasi bugun ishlaydi.',
                'Мы это понимаем. Поэтому за каждой поездкой стоят шесть конкретных правил — и все они работают уже сегодня.',
                'We know that. Which is why six concrete rules stand behind every ride — and all of them work today.'
              )}
            </p>
          </div>

          <ul className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {[
              {
                c: ATLAS_COLORS.turquoise,
                icon: ShieldCheck,
                title: t(
                  "Hujjat moderatsiyadan o'tadi",
                  'Документы проходят модерацию',
                  'Documents are moderated'
                ),
                text: t(
                  "Haydovchi guvohnoma va texpasportini ikki tomondan yuboradi. Tasdiqlanmaguncha safar e'lon qila olmaydi.",
                  'Водитель загружает права и техпаспорт с обеих сторон. Пока их не одобрят, он не может опубликовать поездку.',
                  'The driver uploads both sides of their licence and registration. Until approved, they cannot publish a ride.'
                ),
              },
              {
                c: ATLAS_COLORS.indigo,
                icon: Smartphone,
                title: t(
                  'Raqam faqat tasdiqdan keyin',
                  'Номер — только после подтверждения',
                  'Number only after confirmation'
                ),
                text: t(
                  "Telefon raqami bron tasdiqlanganda va faqat o'sha odamga ochiladi. Undan oldin gaplashish chat orqali.",
                  'Телефон открывается при подтверждении брони и только этому человеку. До этого — чат.',
                  'The phone number opens when a booking is confirmed, and only to that person. Before that, chat.'
                ),
              },
              {
                c: ATLAS_COLORS.crimson,
                icon: UsersRound,
                title: t(
                  "Kimni olayotganingizni ko'rasiz",
                  'Вы видите, кого берёте',
                  'You see who is riding'
                ),
                text: t(
                  "Har so'rovda ism, reyting va oldingi safarlardagi sharhlar ko'rinadi — qabul qilishdan oldin.",
                  'В каждой заявке видны имя, рейтинг и отзывы за прошлые поездки — до того, как вы её примете.',
                  'Every request shows a name, rating and past reviews — before you accept it.'
                ),
              },
              {
                c: ATLAS_COLORS.saffron,
                icon: Megaphone,
                title: t(
                  'Safarni yaqinlaringizga yuboring',
                  'Отправьте поездку близким',
                  'Share your ride'
                ),
                text: t(
                  "Bir bosishda yo'nalish, vaqt va haydovchi ma'lumoti yaqiningizga ketadi.",
                  'Одним нажатием маршрут, время и данные водителя уходят близкому человеку.',
                  'One tap sends the route, time and driver details to someone close to you.'
                ),
              },
              {
                c: ATLAS_COLORS.pink,
                icon: Compass,
                title: t("Yo'lda SOS tugmasi", 'Кнопка SOS в пути', 'SOS button on the road'),
                text: t(
                  "Safar ekranida favqulodda xizmatga qo'ng'iroq bir bosishda — izlab o'tirmaysiz.",
                  'На экране поездки вызов экстренной службы в одно нажатие — не нужно ничего искать.',
                  'On the ride screen, calling emergency services is one tap away.'
                ),
              },
              {
                c: ATLAS_COLORS.turquoise,
                icon: PiggyBank,
                title: t(
                  "Pul faqat qo'ldan qo'lga",
                  'Деньги только из рук в руки',
                  'Money only hand to hand'
                ),
                text: t(
                  "Sayt to'lovni ushlab turmaydi va karta ma'lumotini so'ramaydi — so'ralsa, bu biz emasmiz.",
                  'Сайт не удерживает оплату и не просит данные карты — если просят, это не мы.',
                  'The site never holds payments or asks for card details — if something does, it is not us.'
                ),
              },
            ].map((x, i) => (
              <li
                key={x.title}
                style={delay(i + 1)}
                className="ll-lift ll-reveal rounded-3xl bg-surface p-5 sm:p-6"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ background: x.c }}
                >
                  <x.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground sm:text-lg">{x.title}</h3>
                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-text-muted">{x.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/*
        ===================== SUZANI MUHRI =====================

        🔴 NEGA (egasi tanlagan 6-band): bizda ALLAQACHON bor, lekin
        sahifada hech qachon aytilmagan funksiya — har foydalanuvchi
        ID'sidan noyob so'zana naqshi yaratiladi va u rasm o'rniga
        turadi (`SuzaniSeal`, ilovada ham AYNAN shu algoritm).

        Bu brend hikoyasi bilan mahsulot funksiyasini bir joyda
        aytadi: «har hamroh — o'z naqshi». Va u bo'sh gap emas —
        pastdagi muhrlar HAQIQIY, shu yerda hisoblanadi.
      */}
      <Section className="ll-silk relative overflow-hidden py-14 sm:py-20">
        <GanchPattern size={90} depth={0.5} />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <SectionEyebrow>{t("So'zana muhri", 'Печать сюзане', 'Suzani seal')}</SectionEyebrow>
          <h2 className="ll-mask font-display mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {t(
              "Har hamroh — o'z naqshi",
              'У каждого попутчика свой узор',
              'Every companion has their own pattern'
            )}
          </h2>
          <p
            style={delay(1)}
            className="ll-reveal mx-auto mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-text-muted sm:text-base"
          >
            {t(
              "Surat qo'ymagan odam bo'sh kulrang doira bo'lib qolmaydi: uning nomidan takrorlanmas so'zana naqshi tug'iladi. Bir odam — bir naqsh, har doim bir xil.",
              'Тот, кто не поставил фото, не остаётся серым кружком: из его имени рождается неповторимый узор сюзане. Один человек — один узор, всегда тот же.',
              'Someone without a photo is never a grey circle: a unique suzani pattern is generated from their name. One person, one pattern, always the same.'
            )}
          </p>
          <div
            style={delay(2)}
            className="ll-reveal mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6"
          >
            {['Aziz', 'Nilufar', 'Bekzod', 'Malika', 'Sardor', 'Zilola'].map((seed) => (
              <div key={seed} className="flex flex-col items-center gap-2">
                <SuzaniSeal seed={seed} size={64} />
                <span className="text-xs font-semibold text-text-muted">{seed}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/*
        ===================== HAYDOVCHILAR UCHUN =====================

        🔴 NEGA QO'SHILDI (egasi tanlagan 1-band): butun sahifa
        YO'LOVCHIGA gapirardi. Haydovchi esa taklif tomoni —
        ularsiz platformada qidiradigan hech narsa yo'q. Ya'ni
        sahifaning yarmi umuman yozilmagan edi.

        Panel ATAYIN to'q: bu boshqa odamga, boshqa gap. Suzani
        muhrlari esa quyida — haydovchi profilining o'zi.
      */}
      <Section className="ll-dark-panel relative overflow-hidden bg-wine-ash py-14 text-white sm:py-20">
        <GirihPattern color="var(--turquoise)" opacity={0.12} size={86} />
        <AtlasEdge className="absolute inset-x-0 top-0 h-1.5" palette={2} seed={31} />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
            <div>
              <div className="ll-reveal flex items-center gap-2">
                <Pakhta className="h-3 w-3" color="var(--turquoise)" />
                <span className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-white/60">
                  {t('Haydovchilarga', 'Водителям', 'For drivers')}
                </span>
              </div>
              <h2 className="ll-mask font-display mt-3 text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
                {t(
                  "Mashinangiz bo'sh ketmasin",
                  'Пусть машина не едет пустой',
                  "Don't drive with empty seats"
                )}
              </h2>
              <p
                style={delay(1)}
                className="ll-reveal mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-white/70 sm:text-lg"
              >
                {t(
                  "Baribir yo'lga chiqyapsiz — yoningizdagi bo'sh o'rinlar yo'l xarajatingizni qoplasin. Narxni o'zingiz belgilaysiz, pul to'g'ridan-to'g'ri sizga naqd beriladi.",
                  'Вы всё равно едете — пусть свободные места окупят дорогу. Цену назначаете вы, деньги получаете наличными напрямую.',
                  'You are driving anyway — let the empty seats cover your costs. You set the price and get paid in cash, directly.'
                )}
              </p>
              <div
                style={delay(2)}
                className="ll-reveal mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Link
                  href={`/${locale}/login`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-pink px-6 py-3.5 text-base font-bold text-white transition-transform duration-200 hover:scale-[1.03]"
                >
                  {t("Haydovchi bo'lish", 'Стать водителем', 'Become a driver')}
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <span className="text-sm text-white/50">
                  {t("Ro'yxatdan o'tish bepul", 'Регистрация бесплатна', 'Signing up is free')}
                </span>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
              {[
                {
                  c: ATLAS_COLORS.turquoise,
                  t: t("Narxni siz qo'yasiz", 'Цену ставите вы', 'You set the price'),
                  d: t(
                    "Yo'lovchi taklif qilishi mumkin, oxirgi so'z sizniki.",
                    'Пассажир может предложить свою — последнее слово за вами.',
                    'A passenger may counter — the final word is yours.'
                  ),
                },
                {
                  c: ATLAS_COLORS.saffron,
                  t: t('Kimni olishni tanlaysiz', 'Вы выбираете попутчика', 'You choose who rides'),
                  d: t(
                    "Har so'rovda ism, reyting va sharhlar ko'rinadi.",
                    'В каждой заявке видны имя, рейтинг и отзывы.',
                    'Every request shows the name, rating and reviews.'
                  ),
                },
                {
                  c: ATLAS_COLORS.crimson,
                  t: t("Naqd, qo'ldan qo'lga", 'Наличными, из рук в руки', 'Cash, hand to hand'),
                  d: t(
                    'Biz pulga umuman tegmaymiz va komissiya olmaymiz.',
                    'Мы не касаемся денег и не берём комиссию.',
                    'We never touch the money and take no commission.'
                  ),
                },
                {
                  c: ATLAS_COLORS.indigo,
                  t: t('Hujjat bir marta', 'Документы один раз', 'Documents once'),
                  d: t(
                    'Guvohnoma va texpasport tekshiriladi — keyin erkin ishlaysiz.',
                    'Права и техпаспорт проверяются один раз — дальше вы свободны.',
                    'Licence and registration are checked once — then you are free to drive.'
                  ),
                },
              ].map((x, i) => (
                <li
                  key={x.t}
                  style={delay(i + 1)}
                  className="ll-reveal rounded-2xl bg-white/[0.06] p-4 sm:p-5"
                >
                  <span
                    aria-hidden
                    className="block h-1 w-8 rounded-full"
                    style={{ background: x.c }}
                  />
                  <h3 className="mt-3 text-base font-bold sm:text-lg">{x.t}</h3>
                  <p className="mt-1.5 text-[0.875rem] leading-relaxed text-white/60">{x.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/*
        ===================== SAVOL-JAVOB =====================

        🔴 NEGA (egasi tanlagan 3-band): odamda sahifani o'qib
        bo'lgach ham javobsiz savollar qoladi — «pulni qachon
        beraman?», «bekor qilsam nima bo'ladi?». Javob berilmasa
        u ro'yxatdan o'tmaydi, shunchaki chiqib ketadi.

        ⚠️ HAMMA JAVOB HAQIQIY: mahsulot qanday ishlasa, shunday
        yozilgan. «Tez orada» yoki «rejalashtirilmoqda» degan
        javob YO'Q — ular savolni yopmaydi, ochiq qoldiradi.

        Texnikasi — oddiy `<details>`: JS ham, kutubxona ham kerak
        emas, klaviatura va ekran o'quvchi bilan o'zi ishlaydi.
      */}
      <Section className="ll-silk relative overflow-hidden py-14 sm:py-20">
        <GanchPattern size={90} depth={0.5} />
        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6">
          <SectionEyebrow>{t('Savol-javob', 'Вопросы', 'FAQ')}</SectionEyebrow>
          <h2 className="ll-mask font-display mt-3 text-center text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {t("Ko'p so'raladigan savollar", 'Частые вопросы', 'Common questions')}
          </h2>

          <div className="mt-8 space-y-3 sm:mt-10">
            {[
              {
                q: t(
                  "Pulni qachon va qanday to'layman?",
                  'Когда и как я плачу?',
                  'When and how do I pay?'
                ),
                a: t(
                  "Naqd, haydovchining o'ziga — safar oldidan yoki yo'lda. Sayt pulga umuman tegmaydi va sizdan komissiya olmaydi.",
                  'Наличными водителю — перед поездкой или в пути. Сайт не касается денег и не берёт с вас комиссию.',
                  'In cash, directly to the driver — before or during the ride. The site never touches the money and takes no commission.'
                ),
              },
              {
                q: t("Narx qat'iymi?", 'Цена фиксированная?', 'Is the price fixed?'),
                a: t(
                  "Yo'q. Haydovchi narx qo'yadi, siz esa o'z narxingizni taklif qilishingiz mumkin — u rozi bo'lsa, kelishildi.",
                  'Нет. Водитель ставит цену, вы можете предложить свою — если он согласится, вы договорились.',
                  'No. The driver sets a price and you may counter — if they accept, you have a deal.'
                ),
              },
              {
                q: t(
                  'Haydovchi ishonchlimi?',
                  'Можно ли доверять водителю?',
                  'Can I trust the driver?'
                ),
                a: t(
                  "Haydovchi guvohnoma va texpasportini yuboradi, ular moderatsiyadan o'tadi. Profilda reyting va yo'lovchilar sharhlari ko'rinadi.",
                  'Водитель загружает права и техпаспорт, они проходят модерацию. В профиле видны рейтинг и отзывы пассажиров.',
                  'The driver uploads their licence and registration, which are moderated. Their profile shows a rating and passenger reviews.'
                ),
              },
              {
                q: t(
                  'Telefon raqamim ochiqmi?',
                  'Мой номер виден всем?',
                  'Is my phone number public?'
                ),
                a: t(
                  "Yo'q. Raqam faqat bron TASDIQLANGANDAN keyin va faqat o'sha odamga ochiladi. Undan oldin yozishmalar chat orqali.",
                  'Нет. Номер открывается только после подтверждения брони и только этому человеку. До этого — переписка в чате.',
                  'No. It opens only after a booking is confirmed, and only to that person. Before that you talk in the chat.'
                ),
              },
              {
                q: t("Bekor qilsam nima bo'ladi?", 'Что если я отменю?', 'What if I cancel?'),
                a: t(
                  "Bekor qilish bepul — hech qanday jarima yo'q. Ikkinchi tomonga darhol xabar boradi, shuning uchun imkon qadar erta qiling.",
                  'Отмена бесплатна — штрафов нет. Второй стороне сразу приходит уведомление, поэтому отменяйте как можно раньше.',
                  'Cancelling is free — there is no penalty. The other side is notified immediately, so cancel as early as you can.'
                ),
              },
            ].map((x, i) => (
              <details
                key={x.q}
                style={delay(i + 1)}
                className="ll-lift ll-reveal group rounded-2xl bg-surface px-5 py-4 sm:px-6 sm:py-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.9375rem] font-bold text-foreground marker:hidden sm:text-lg">
                  {x.q}
                  {/* Ochilganda 45° buriladi — «qo'shish» belgisi
                      «yopish»ga aylanadi. */}
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition-transform duration-300 group-open:rotate-45"
                    style={{ background: 'var(--ll-sand)', color: 'var(--ll-teal)' }}
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-text-muted">{x.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* ===================== CTA (Wine Ash + ikat) ===================== */}
      <Section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="ll-dark-panel ll-reveal relative overflow-hidden rounded-3xl bg-wine-ash px-5 py-14 text-center sm:rounded-[2.5rem] sm:px-6 sm:py-20">
          {/* Girih — to'q zaminda u ENDI KO'RINADI va panelga
              me'moriy og'irlik beradi. Ilgari bu yerda ikatning
              rombi turardi: romb har madaniyatda bor, girih esa
              aynan bizning peshtoqlarimizniki. */}
          <GirihPattern color="var(--turquoise)" opacity={0.16} size={86} />
          {/* PALAK — so'zananing markaziy doirasi, suv belgisi bo'lib
              turadi. Panelga chuqurlik beradi va girih bilan bir
              oilada: geometriya + tiriklik. */}
          <PalakRosette
            className="pointer-events-none absolute -right-16 -top-20 h-[22rem] w-[22rem] text-turquoise sm:-right-10 sm:h-[26rem] sm:w-[26rem]"
            color="currentColor"
            opacity={0.14}
          />
          {/* Yuqori va pastki chekkada atlas — panel matoga o'ralgandek.
              Ilgari bu shunchaki to'q quti edi va sahifaning eng oxirgi,
              eng muhim chaqirig'i eng zaif element bo'lib qolgandi. */}
          <AtlasEdge className="absolute inset-x-0 top-0 h-1.5" palette={1} seed={9} />
          <AtlasEdge className="absolute inset-x-0 bottom-0 h-1.5" palette={2} seed={13} />
          <div className="relative z-10">
            <h2 className="font-display text-[clamp(1.9rem,6vw,2.6rem)] font-black leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {t("Bugun yo'lga chiqing", 'Отправляйтесь сегодня', 'Hit the road today')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[0.9375rem] text-white/75 sm:mt-4 sm:text-base">
              {t(
                "Ro'yxatdan o'ting va birinchi hamrohingizni bir necha daqiqada toping.",
                'Зарегистрируйтесь и найдите первого попутчика за пару минут.',
                'Sign up and find your first travel companion in minutes.'
              )}
            </p>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
              <Link
                href={`/${locale}/login`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-pink px-6 py-3.5 text-base font-bold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-95 sm:px-8 sm:py-4"
              >
                {t('Boshlash', 'Начать', 'Get started')}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href={`/${locale}/login`}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-turquoise/50 px-6 py-3.5 text-base font-bold text-turquoise transition-transform duration-200 hover:scale-[1.03] active:scale-95 sm:px-8 sm:py-4"
              >
                <Car className="h-5 w-5" />
                {t("Haydovchi bo'l", 'Стать водителем', 'Become a driver')}
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* ===================== FUTER (Wine Ash + ikat) ===================== */}
      {/* pb-safe — futer pastki tizim paneli (gesture/3-tugma) ostida kesilmasin:
          to'q fon eng pastgacha cho'ziladi, matn esa panel ustida qoladi. */}
      <footer className="ll-dark-panel pb-safe relative overflow-hidden bg-wine-ash text-white">
        {/* Futer ham brendning bir qismi: jiyak, girih va so'zana
            quyoshi. Ilgari u shunchaki to'q quti edi. */}
        <AtlasEdge className="absolute inset-x-0 top-0 z-10 h-1.5" palette={0} seed={17} />
        <GirihPattern color="var(--turquoise)" opacity={0.14} size={86} />
        <PalakRosette
          className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 text-turquoise"
          color="currentColor"
          opacity={0.1}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <span className="text-xl font-extrabold tracking-tight">
                YOL<span className="text-accent-on-dark">YOLAKAY</span>
              </span>
              <p className="mt-3 text-sm text-white/50">
                {t(
                  "O'zbekiston bo'ylab hamroh topish platformasi.",
                  'Платформа поиска попутчиков по Узбекистану.',
                  'A platform for finding travel companions across Uzbekistan.'
                )}
              </p>
            </div>
            <FooterCol
              title={t('Platforma', 'Платформа', 'Platform')}
              links={[
                { label: t('Kirish', 'Войти', 'Sign in'), href: `/${locale}/login` },
                {
                  label: t("Haydovchi bo'lish", 'Стать водителем', 'Become a driver'),
                  href: `/${locale}/login`,
                },
                {
                  label: t('Xizmat holati', 'Статус сервиса', 'Service status'),
                  href: `/${locale}/status`,
                },
              ]}
            />
            <FooterCol
              title={t('Huquqiy', 'Правовое', 'Legal')}
              links={[
                {
                  label: t('Maxfiylik siyosati', 'Конфиденциальность', 'Privacy policy'),
                  href: `/${locale}/privacy`,
                },
                {
                  label: t('Foydalanish shartlari', 'Условия использования', 'Terms of use'),
                  href: `/${locale}/terms`,
                },
                {
                  // Play moderatori bu havolani saytdan topa olishi kerak.
                  label: t("Hisobni o'chirish", 'Удаление аккаунта', 'Delete account'),
                  href: `/${locale}/account-delete`,
                },
              ]}
            />
            <FooterCol
              title={t('Aloqa', 'Контакты', 'Contact')}
              links={[
                // Telegram BIRINCHI: pochta hali ishlamaydi (contacts.ts izohiga qarang),
                // ya'ni bugun odam bizga faqat shu orqali yeta oladi.
                { label: SUPPORT_TELEGRAM, href: SUPPORT_TELEGRAM_URL },
                { label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
              ]}
            />
          </div>

          {/*
            🔴 YO'NALISHLAR KATALOGI OLIB TASHLANDI (egasi, 31.08.2026):
            «biz butun mamlakat bo'ylab yuramiz-ku». O'nta yo'nalishni
            futerda sanab qo'yish xizmatni AYNAN o'shalar bilan
            cheklangandek ko'rsatardi — bu yolg'on: safarni istalgan
            ikki nuqta orasiga yaratish mumkin.

            ⚠️ Uni SEO uchun QAYTA QO'SHMA. Google baribir yetadi:
            narx bo'limidagi tanlagichlar o'sha qidiruvlarga ichki
            havola beradi, `sitemap.ts` esa HAQIQIY safar sahifalarini
            (`/trip/{id}`) ro'yxatlaydi — indeksga tushishi kerak
            bo'lgan sahifa aynan o'sha, o'ylab topilgan yo'nalish emas.
          */}
          <div className="mt-10 border-t border-white/10 pt-6 text-center text-[0.8125rem] text-white/70 sm:mt-12 sm:text-sm">
            © 2026 YolYolakay.{' '}
            {t('Barcha huquqlar himoyalangan.', 'Все права защищены.', 'All rights reserved.')}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Yordamchi komponentlar ---------- */

/**
 * BO'LIM YORLIG'I — kichik, katta harfli, ikki yonida paxta guli.
 *
 * Kuchli brend saytlarida sarlavha yolg'iz turmaydi: ustida bir
 * so'zlik yorliq bo'ladi va u sahifaga ritm beradi — o'quvchi
 * qayerdaligini bir qarashda biladi.
 */
function SectionEyebrow({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`ll-reveal flex items-center justify-center gap-2 ${className}`}>
      <Pakhta className="h-3 w-3" color="var(--ll-teal)" />
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-text-muted">
        {children}
      </span>
    </div>
  );
}

function LightField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    /*
     * 🔴 `<label>`, `<div>` EMAS (2026-09-04, o'lchandi): yozuv maydonning
     * TEPASIDA turardi-yu, u bilan bog'lanmagandi. Ekran o'qigich bosh
     * sahifadagi qidiruv maydonlarini «tahrirlash maydoni» deb o'qirdi —
     * ya'ni saytning ENG BIRINCHI formasi nomsiz edi. O'rovchi `<label>`
     * ichidagi boshqaruv bilan O'ZI bog'lanadi, `id` kerak emas.
     */
    <label className="ll-field flex items-center gap-2.5 rounded-2xl border border-border bg-bg-soft px-3.5 py-2.5 transition-colors focus-within:border-transparent sm:gap-3 sm:px-4 sm:py-3">
      <Icon className="h-5 w-5 shrink-0" style={{ color: 'var(--ll-teal)' }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-text-muted">{label}</div>
        {children}
      </div>
    </label>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      {/* Futer ustuni — mustaqil bo'lim, ya'ni `h2`. Ilgari `h4` edi
          va orada `h3` yo'q edi: ekran o'qigich sarlavhalar ro'yxatida
          bo'sh bo'g'in ko'rardi (h2 → h4). */}
      <h2 className="text-sm font-bold text-white">{title}</h2>
      <ul className="mt-1">
        {links.map((l) => (
          <li key={l.label}>
            {/* min-h-11 (44px) — mobil touch-target (inline <a> global min-height olmaydi) */}
            <Link
              href={l.href}
              className="inline-flex min-h-11 items-center text-sm text-white/50 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
