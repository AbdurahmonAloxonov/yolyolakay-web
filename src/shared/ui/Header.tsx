'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useProfile } from '@/entities/user/api/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { User, LogOut, CreditCard, Bell, Sun, Moon } from 'lucide-react';
import { useUIStore } from '../model/uiStore';
import { decodeJwtPayload } from '@/shared/lib/token';
import { useTheme } from '../model/ThemeContext';
import { Switch } from './Switch';
import { AtlasEdge } from './brand/Atlas';
import { LogoMark } from './brand/LogoMark';
import { Avatar } from './Avatar';
import { performLogout } from '@/shared/lib/logout';
import { useNotifications, isRead } from '@/entities/notification/api/useNotifications';
import { LocaleSwitch } from './LocaleSwitch';
import { useTr } from '@/shared/lib/useTr';
import { useQuery } from '@tanstack/react-query';
import { getChatSummaries } from '@/shared/api/notifications';
import { useCurrentPlan } from '@/entities/billing/api/useSubscription';
import { formatBalance } from '@/shared/lib/format';

export const Header: React.FC = () => {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const tr = useTr();
  const { data: profile } = useProfile();
  const { ridesLeft, isUnlimited, plan } = useCurrentPlan();
  const { isMenuOpen, setMenuOpen, activeRole, setActiveRole } = useUIStore();
  const { theme, setTheme } = useTheme();

  // O'qilmagan bildirishnomalar soni — qo'ng'iroqcha badge'i uchun.
  const { data: notifications = [] } = useNotifications();
  const unreadCount = profile ? notifications.filter((n) => !isRead(n)).length : 0;

  /*
   * O'qilmagan CHAT xabarlari — bildirishnomalardan ALOHIDA hisob.
   *
   * Server sonni `GET /notifications/chats` da beryapti, lekin u hech
   * qayerda ko'rsatilmasdi: odam "Chatlar" bo'limiga kirmaguncha yangi
   * xabar borligini bilmasdi.
   *
   * Kalit BottomNav bilan BIR XIL (`chat-summaries`) — ikkalasi bitta
   * keshdan o'qiydi, ya'ni telefonda ikki marta so'ralmaydi.
   */
  const { data: chatSummaries = [] } = useQuery({
    queryKey: ['chat-summaries'],
    queryFn: getChatSummaries,
    enabled: !!profile,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const unreadChats = chatSummaries.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  // Qo'ng'iroqcha: bildirishnomalar sahifasiga o'tish + badge (9+ dan keyin qisqartiriladi).
  const bellLink = (
    <Link
      href={`/${locale}/notifications`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface border border-border/80 text-text-muted hover:text-accent transition-colors shadow-sm"
      title={tr('Bildirishnomalar', 'Уведомления', 'Notifications')}
    >
      <Bell className="h-4.5 w-4.5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-pink px-1 text-[9px] font-black text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );

  const handleRoleChange = (isDriverChecked: boolean) => {
    const newRole = isDriverChecked ? 'driver' : 'passenger';
    setActiveRole(newRole);
    setMenuOpen(false);

    if (newRole === 'driver') {
      /*
       * 🔴 HAYDOVCHI "ANKETA TO'LDIRISH"GA TUSHIB QOLARDI (2026-08-24).
       *
       * Shart faqat `profile?.is_driver` edi, ya'ni profil HALI YUKLANMAGAN
       * bo'lsa (`undefined`) haqiqiy haydovchi ham onboarding'ga uchardi.
       * Bu tez-tez sodir bo'ladi: tabga qaytilganda `refetchOnWindowFocus`
       * profilni qayta so'raydi va o'sha soniyalarda `profile` bo'sh bo'ladi —
       * aynan odam rolni almashtiradigan payt.
       *
       * Zaxira manba — tokenning O'ZI: JWT ichida `role` claim'i bor
       * (jonli tekshirildi: `{"sub":…,"role":"driver",…}`). U profil
       * so'rovini KUTMAYDI va serverdan kelgan haqiqat.
       */
      const roleClaim = decodeJwtPayload()?.role;
      const isDriver = profile?.is_driver ?? roleClaim === 'driver';
      router.push(isDriver ? `/${locale}/dashboard` : `/${locale}/driver/onboarding`);
    } else {
      router.push(`/${locale}/search`);
    }
  };

  // Profil menyusi: tashqariga bosilganda yoki Esc bosilganda yopiladi.
  //
  // Ilgari buning uchun menyu ichida `fixed inset-0` backdrop turardi, LEKIN u
  // ishlamasdi: header'da `backdrop-blur-2xl` bor, va `backdrop-filter` element'ni
  // `position: fixed` avlodlar uchun CONTAINING BLOCK qilib qo'yadi. Ya'ni backdrop
  // butun ekranni emas, faqat header lentasini qoplardi — sahifaning qolgan joyiga
  // bosganda menyu yopilmasdi (aynan shu shikoyat qilingan bug).
  //
  // Shuning uchun stacking'ga umuman tayanmaydigan yechim: hujjat darajasidagi
  // tinglovchi. `pointerdown` — `click` EMAS, aks holda menyu ichidagi havolaga
  // bosilganda navigatsiyadan oldin yopilib ulguradi.
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen, setMenuOpen]);

  // Sync active role with current path
  useEffect(() => {
    if (pathname.includes('/driver') || pathname.includes('/dashboard')) {
      setActiveRole('driver');
    } else if (pathname.includes('/search')) {
      setActiveRole('passenger');
    }
  }, [pathname, setActiveRole]);

  /*
   * «XARITA» — 17.09.2026 (egasi: «karta faqat landingda qo'shilgan,
   * bizga Yandex Go'dek kartani joylashuvi kerak»).
   *
   * 🔑 Mehmonga ham ko'rsatiladi: xarita — platformada QAYSI shaharlar
   * borligini ko'rsatadigan yagona joy, ya'ni ro'yxatdan o'tmagan odam
   * uchun eng foydali sahifa. Ro'yxat (`/search`) o'z joyida qoladi:
   * filtrlar o'sha yerda.
   */
  const mapItem = { label: tr('Xarita', 'Карта', 'Map'), href: `/${locale}/map` };

  const navItems = !profile
    ? [{ label: tr('Asosiy', 'Главная', 'Home'), href: `/${locale}` }, mapItem]
    : [
        ...(activeRole === 'passenger'
          ? [
              mapItem,
              { label: tr('Qidiruv', 'Поиск поездок', 'Search'), href: `/${locale}/search` },
              {
                label: tr('Tariflar', 'Тарифы', 'Plans'),
                href: `/${locale}/tariffs`,
              },
            ]
          : [
              // CEO 2026-07-30: panel "Safarlar" deb ataladi (ilgari "Radar") —
              // u endi faqat safarlar va ularga kelgan arizalar haqida.
              { label: tr('Safarlar', 'Поездки', 'Trips'), href: `/${locale}/dashboard` },
              {
                label: tr('Safar yaratish', 'Создать поездку', 'Create a trip'),
                href: `/${locale}/driver/create-trip`,
              },
              // Haydovchiga ham kerak: xaritada MASHHUR yo'nalishlar va
              // ulardagi safar soni ko'rinadi — ya'ni «qaysi yo'nalishda
              // talab bor» degan savolga javob.
              mapItem,
              // Haydovchida "Tariflar" UMUMAN yo'q edi: dashboard'dagi tarif setkasi
              // olib tashlangach (CEO 2026-07-30) haydovchi uchun /tariffs sahifasiga
              // yagona yo'l profil ichida qolgan edi — yo'lovchida esa bu bo'lim
              // header'da turardi. Ikkala rol uchun ham bir xil qilamiz.
              { label: tr('Tariflar', 'Тарифы', 'Plans'), href: `/${locale}/tariffs` },
              // Daromad — `GET /rides/earnings` (swagger 2026-08-03). Mobil pastki
              // menyuda 6 ta element bor, 7-si sig'maydi; shu sabab telefonda unga
              // yo'l panel ustidagi karta orqali.
              { label: tr('Daromad', 'Заработок', 'Earnings'), href: `/${locale}/driver/earnings` },
            ]),
        { label: tr('Pochta', 'Посылки', 'Parcels'), href: `/${locale}/parcels` },
        { label: tr('Tarix', 'История', 'History'), href: `/${locale}/history` },
        { label: tr('Chatlar', 'Чаты', 'Chats'), href: `/${locale}/chats` },
      ];

  // Landing (marketing) sahifasi — /uz yoki /ru ildizi — O'Z header/footer'iga ega.
  // App Header'ni ko'rsatsak IKKI header ustma-ust chiqadi. Chat'da ham yashiramiz.
  if (pathname.includes('/chat/') || /^\/(uz|ru|en)\/?$/.test(pathname)) {
    return null;
  }

  /*
   * KIRISH SAHIFASI — sarlavhada «Kirish» tugmasi BO'LMAYDI.
   *
   * 🔴 Odam allaqachon kirish sahifasida turibdi va tepada uni yana
   * o'sha yerga chaqiruvchi tugma turardi. Ustiga til almashtirgich
   * IKKI NUSXADA edi: biri sarlavhada, biri sahifaning o'zida
   * (u yerda ATAYIN qo'yilgan — PWA aynan shu manzildan ochiladi).
   * Landingda bu takror tuzatilgandi, bu sahifa esa o'tkazib
   * yuborilgandi.
   */
  const onLogin = pathname.includes('/login');

  // Balans rolga bog'liq: haydovchi -> driver_balance (Radar), yo'lovchi -> passenger_balance.
  /*
   * Balans YAGONA manbadan — obunadan (`useCurrentPlan`). Ilgari bu yerda
   * profil keshidagi xom son turardi va backend `rides_left: -1` berganda
   * header'da "-1" ko'rinardi. Cheksizlikni faqat TARIF kvotasi belgilaydi.
   */
  const roleBalance = profile
    ? formatBalance({ isUnlimited, ridesLeft, planKnown: !!plan }, locale)
    : '0';

  return (
    /* header-safe — status bar/old kamera ostiga tushib qolmasin (globals.css: --safe-top). */
    /*
      Fon 0.70 emas, 0.90 shaffoflikda.

      🔴 O'LCHANDI (2026-09-03, daromad sahifasi): sahifa surilganda
      «Daromadim» sarlavhasi header ORTIDAN o'qilib turardi — 40 px
      blur katta qalin sarlavhani yo'qotolmaydi, u brend nomining
      ustiga tushib «ikki qavat matn» bo'lardi. Shisha effekti qoladi
      (blur bor), lekin ortidagi matn endi o'qilmaydi.
    */
    <header className="header-safe sticky top-0 z-40 w-full border-b border-border/50 bg-surface/90 backdrop-blur-2xl transition-colors select-none shadow-[0_4px_30px_rgba(0,0,0,0.02)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Логотип */}
        <Link
          href={
            profile
              ? activeRole === 'driver'
                ? `/${locale}/dashboard`
                : `/${locale}/search`
              : `/${locale}`
          }
          // `h-11` — logotip ham bosiladigan havola: balandligi 32 px
          // edi (o'lchandi), barmoq uchun kam.
          className="flex h-11 items-center gap-2 group"
        >
          <LogoMark
            size={32}
            className="shadow-md shadow-accent/20 transition-transform group-hover:scale-105"
          />
          {/* ⚠️ 320 px da yozuv KICHRAYADI: mehmon sarlavhasida endi til
              tugmasi ham bor va «Kirish» ekran chekkasidan chiqib
              ketardi (o'lchandi — tugmaning o'ng yarmi kesilgan edi). */}
          <span className="text-lg font-extrabold tracking-tight text-foreground max-[359px]:text-[13px] sm:text-xl">
            YOL<span className="text-brand-pink">YOLAKAY</span>
          </span>
        </Link>

        {/* Навигация для десктопа */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // `py-3 -my-3` — matn joyidan qimirlamaydi, tegib
              // turadigan maydon esa 20 px dan 44 px ga o'sadi.
              className={`relative -my-3 py-3 text-sm font-semibold transition-colors hover:text-accent ${
                pathname === item.href ? 'text-accent' : 'text-text-muted'
              }`}
            >
              {item.label}
              {/*
                O'qilmagan xabarlar — kompyuterda ham ko'rinsin. Telefonda
                nishon pastki panelda, bu yerda esa yagona yo'l shu havola.
              */}
              {item.href.endsWith('/chats') && unreadChats > 0 && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[0.6rem] font-extrabold leading-none text-white">
                  {unreadChats > 99 ? '99+' : unreadChats}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Правая панель (Десктоп) */}
        <div className="hidden md:flex items-center gap-4">
          {profile && bellLink}
          {profile ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!isMenuOpen)}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                /*
                  Fon QAT'IY xira (opaque) bo'lishi shart. Ilgari `dark:bg-surface/60` +
                  `hover:bg-surface/80` turardi: header'ning o'zi ham yarim shaffof
                  (bg-surface/70 + backdrop-blur), shuning uchun tugma bosilganda/ustiga
                  kelinganda orqadagi sahifa unga urib ko'rinardi — "tugma shaffof bo'lib
                  qoldi" shikoyati aynan shu. Bosilgan (menyu ochiq) holat endi rang bilan
                  emas, ACCENT chegara va fon urg'usi bilan ko'rsatiladi.
                */
                className={`flex items-center gap-3 rounded-full border px-4 py-1.5 shadow-sm transition-colors ${
                  isMenuOpen
                    ? 'border-accent/50 bg-bg ring-2 ring-accent/15'
                    : 'border-border/80 bg-surface hover:bg-bg'
                }`}
              >
                <div className="flex flex-col items-end">
                  <span className="text-sm font-extrabold text-text leading-tight">
                    {profile.name}
                  </span>
                  <span className="text-[10px] font-black text-accent uppercase tracking-widest">
                    {activeRole === 'passenger'
                      ? tr("Yo'lovchi", 'Пассажир', 'Passenger')
                      : tr('Haydovchi', 'Водитель', 'Driver')}
                  </span>
                </div>
                <Avatar src={profile.avatar_url} name={profile.name} size={36} />
              </button>

              {/* Desktop Profile Dropdown */}
              {isMenuOpen && (
                <>
                  {/*
                    Menyu foni ham xira: `glass-panel` (rgba .7/.6 + blur) ostidan sahifa
                    matni o'qilib turardi va menyu "singan"dek ko'rinardi. Endi to'liq
                    `bg-surface` + aniq chegara/soya — dizayn tokenlari o'zgarmagan.
                  */}
                  <div className="absolute right-0 top-full mt-3 w-72 rounded-2xl border border-border bg-surface shadow-2xl shadow-black/10 dark:shadow-black/40 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                    <div className="p-4 border-b border-border/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-muted">
                          {tr('Balans', 'Баланс', 'Balance')}:
                        </span>
                        <div className="flex items-center gap-1.5 bg-brand-pink-light dark:bg-accent/10 px-2 py-1 rounded-full">
                          <CreditCard className="w-3.5 h-3.5 text-accent" />
                          <span className="text-xs font-extrabold text-accent">
                            {roleBalance} {tr('safar', 'поездок', 'rides')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      {/* Роль */}
                      <div className="flex items-center justify-between px-3 py-2 hover:bg-bg/50 rounded-xl transition-colors">
                        <span className="text-sm font-semibold">{tr('Rol', 'Роль', 'Role')}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold ${activeRole === 'passenger' ? 'text-accent' : 'text-text-muted'}`}
                          >
                            Pass
                          </span>
                          <Switch
                            ariaLabel={tr('Haydovchi rejimi', 'Режим водителя', 'Driver mode')}
                            checked={activeRole === 'driver'}
                            onChange={handleRoleChange}
                          />
                          <span
                            className={`text-[10px] font-bold ${activeRole === 'driver' ? 'text-accent' : 'text-text-muted'}`}
                          >
                            Driv
                          </span>
                        </div>
                      </div>

                      {/* Язык */}
                      <div className="flex items-center justify-between px-3 py-2 hover:bg-bg/50 rounded-xl transition-colors">
                        <span className="text-sm font-semibold">
                          {tr('Til', 'Язык', 'Language')}
                        </span>
                        <LocaleSwitch size="sm" />
                      </div>

                      {/* Mavzu (light/dark) — kechasi qulaylik uchun. Tanlov saqlanadi. */}
                      <div className="flex items-center justify-between px-3 py-2 hover:bg-bg/50 rounded-xl transition-colors">
                        <span className="text-sm font-semibold">
                          {tr('Mavzu', 'Тема', 'Theme')}
                        </span>
                        <div className="flex items-center gap-1 bg-bg border border-border/50 rounded-lg p-0.5">
                          <button
                            onClick={() => setTheme('light')}
                            aria-label={tr("Yorug'", 'Светлая', 'Light')}
                            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${theme === 'light' ? 'bg-accent text-white' : 'text-text-muted'}`}
                          >
                            <Sun className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setTheme('dark')}
                            aria-label={tr('Tungi', 'Тёмная', 'Dark')}
                            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${theme === 'dark' ? 'bg-accent text-white' : 'text-text-muted'}`}
                          >
                            <Moon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="h-px bg-border/40 my-1 mx-2"></div>

                      <Link
                        href={`/${locale}/profile`}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-bg/50 rounded-xl transition-colors text-sm font-semibold text-text"
                      >
                        <User className="w-4 h-4 text-text-muted" />
                        {tr('Mening profilim', 'Мой профиль', 'My profile')}
                      </Link>

                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          performLogout(queryClient, locale);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-error/10 rounded-xl transition-colors text-sm font-semibold text-error"
                      >
                        <LogOut className="w-4 h-4" />
                        {tr('Chiqish', 'Выйти', 'Log out')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <LocaleSwitch variant="compact" />
              {!onLogin && (
                <Link
                  href={`/${locale}/login`}
                  className="rounded-xl bg-brand-pink hover:bg-accent-hover px-6 py-2.5 text-sm font-bold text-white shadow-md transition-[background-color,transform] hover:-translate-y-0.5 flex items-center justify-center"
                >
                  {tr('Kirish', 'Войти', 'Sign in')}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex md:hidden items-center gap-1.5 sm:gap-2">
          {profile && bellLink}
          {profile ? (
            <div className="flex items-center gap-1 rounded-full bg-brand-pink-light dark:bg-accent/10 border border-accent/20 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs text-accent">
              <CreditCard className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="font-bold">{roleBalance}</span>
            </div>
          ) : (
            <>
              {/*
                🔴 MEHMONDA TIL ALMASHTIRGICH YO'Q EDI (2026-09-03).
                Sayt mehmon rejimida ishlaydi — qidiruv va safar
                sahifalari kirmasdan ochiladi. Telefonda esa bu
                sahifalarda tilni almashtiradigan HECH NARSA yo'q edi:
                landingdan chiqib ketgan ruszabon odam yana o'zbekcha
                sahifada qolardi. Kirgan foydalanuvchida almashtirgich
                profil menyusida (u yerda joy bor).
              */}
              <LocaleSwitch variant="compact" />
              {!onLogin && (
                <Link
                  href={`/${locale}/login`}
                  className="inline-flex h-11 items-center rounded-xl bg-brand-pink hover:bg-accent-hover px-4 text-xs font-bold text-white shadow-md transition-colors"
                >
                  {tr('Kirish', 'Войти', 'Sign in')}
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/*
        ATLAS JIYAGI — landing bilan BIR XIL chiziq.
        🔴 Ilgari u FAQAT landingda edi: odam bosh sahifadan qidiruvga
        o'tishi bilan sayt boshqa mahsulotga aylanardi. Jiyak — eng
        arzon va eng kuchli bog'lovchi: u har sahifada bir xil.
      */}
      <AtlasEdge className="h-1.5 w-full" />
    </header>
  );
};
