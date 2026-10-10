'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useProfile } from '@/entities/user/api/useProfile';
import { useUIStore } from '../model/uiStore';
import { Map, PlusCircle, Search, Clock, User, MessageCircle, Package } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';
import { useQuery } from '@tanstack/react-query';
import { getChatSummaries } from '@/shared/api/notifications';

export const BottomNav: React.FC = () => {
  const locale = useLocale();
  const pathname = usePathname();
  const { data: profile } = useProfile();
  const { activeRole } = useUIStore();
  // Hooklar ERTA return'dan OLDIN chaqirilishi shart (rules-of-hooks).
  const tr = useTr();

  /*
   * 🔴 O'QILMAGAN XABAR NISHONI.
   *
   * Server o'qilmaganlar sonini beryapti (`unread_count`), lekin u hech
   * qayerda ko'rsatilmasdi: odam "Chatlar" bo'limiga o'zi kirib
   * ko'rmaguncha yangi xabar borligini bilmasdi.
   *
   * So'rov yiqilsa `getChatSummaries` bo'sh ro'yxat qaytaradi, ya'ni
   * uzilishda nishon shunchaki ko'rinmaydi — "0 xabar" deb ALDAMAYDI.
   */
  const { data: chatSummaries = [] } = useQuery({
    queryKey: ['chat-summaries'],
    queryFn: getChatSummaries,
    enabled: !!profile,
    // Panel ilova bo'yi ochiq turadi — tez-tez emas, lekin xabar kelganini
    // odam bilib turishi uchun yetarli.
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const unreadChats = chatSummaries.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  if (!profile) return null; // Faqat avtorizatsiyadan o'tganlar uchun

  const navItems =
    activeRole === 'driver'
      ? [
          // CEO 2026-07-30: haydovchi panellari — Safarlar, Safar yaratish,
          // Pochta, Tarix, Chatlar. TARIX ilgari haydovchida UMUMAN yo'q edi
          // (faqat yo'lovchida) — telefonda haydovchi o'z tarixiga kira olmasdi.
          // Profil bu ro'yxatda qoladi: mobil menyu drawer'i olib tashlangan,
          // sozlamalarga yagona yo'l shu (Header izohiga qarang).
          { label: tr('Safarlar', 'Поездки', 'Trips'), icon: Map, href: `/${locale}/dashboard` },
          // "Yaratish" ATAYIN bu ro'yxatda YO'Q — u endi qalqib turuvchi
          // tugma (pastda). Sabab: haydovchida 6 ta band bor edi va 360px
          // telefonda ular siqilib, yozuvlari kesilardi. Safar yaratish esa
          // haydovchining ASOSIY amali — u boshqa bandlar bilan bir xil
          // og'irlikda turishi noto'g'ri edi.
          { label: tr('Pochta', 'Посылки', 'Parcel'), icon: Package, href: `/${locale}/parcels` },
          { label: tr('Tarix', 'История', 'History'), icon: Clock, href: `/${locale}/history` },
          { label: tr('Chatlar', 'Чаты', 'Chats'), icon: MessageCircle, href: `/${locale}/chats` },
          { label: tr('Profil', 'Профиль', 'Profile'), icon: User, href: `/${locale}/profile` },
        ]
      : [
          /*
           * «XARITA» BIRINCHI — 17.09.2026 (egasi: «bizga Yandex Go'dek
           * kartani joylashuvi kerak, haqiqiy qulaylik bo'lsin»).
           *
           * 🔑 Yo'lovchi uchun asosiy amal — safar TOPISH, xaritada esa u
           * bir ekranda bo'ladi: ikki shahar bosiladi, natijalar o'sha
           * yerda narx belgisi bo'lib chiqadi. «Qidiruv» yonida qoladi —
           * u yerda filtrlar bor (narx, «faqat ayollar», qulayliklar).
           *
           * ⚠️ Panelda endi OLTI band: yettinchisi 320 px ekranga
           * sig'maydi (`Header` izohi, 2026-08-03 da o'lchangan).
           */
          { label: tr('Xarita', 'Карта', 'Map'), icon: Map, href: `/${locale}/map` },
          { label: tr('Qidiruv', 'Поиск', 'Search'), icon: Search, href: `/${locale}/search` },
          { label: tr('Pochta', 'Посылки', 'Parcel'), icon: Package, href: `/${locale}/parcels` },
          { label: tr('Tarix', 'История', 'History'), icon: Clock, href: `/${locale}/history` },
          { label: tr('Chatlar', 'Чаты', 'Chats'), icon: MessageCircle, href: `/${locale}/chats` },
          { label: tr('Profil', 'Профиль', 'Profile'), icon: User, href: `/${locale}/profile` },
        ];

  // Landing (marketing /uz|/ru ildizi) O'Z chrome'iga ega — app bottom-nav'ni ko'rsatmaymiz
  // (login qilgan foydalanuvchi landing'ni ochsa ikkita navigatsiya chiqmasin). Chat'da ham.
  if (pathname.includes('/chat/') || /^\/(uz|ru|en)\/?$/.test(pathname)) {
    return null;
  }

  return (
    <>
      {/*
        Sahifa oxiri uchun BO'SHLIQ.

        🔴 O'LCHANDI (2026-09-03, daromad sahifasi): bo'shliq 60 px edi,
        ya'ni faqat pastki panelni qoplardi. Haydovchida esa panel
        USTIDA yana «+» tugmasi turadi — u 72 px dan boshlanib 56 px
        balandlikda, ya'ni 128 px gacha ko'tariladi. Natijada oxirgi
        karta tugmaning TAGIDA qolardi: daromad sahifasida «Bekor
        qilingan: 29» yozuvining ustiga tushib turgandi.

        Shuning uchun bo'shliq rolga bog'liq.
      */}
      <div
        className="md:hidden w-full shrink-0"
        style={{ height: activeRole === 'driver' ? 136 : 60 }}
      ></div>
      {/* Safar yaratish — panel USTIDA qalqib turadi, o'ng tomonda.
          Markazda emas: markazda bo'lsa o'rtadagi band ustiga tushardi.
          O'ng tomon — bosh barmoq eng oson yetadigan joy. */}
      {activeRole === 'driver' && (
        <Link
          href={`/${locale}/driver/create-trip`}
          aria-label={tr('Safar yaratish', 'Создать поездку', 'Create a trip')}
          /* Balandlik pastki panelga bog'liq: panel `pb-safe` bilan tizim
             inseti qadar kengayadi, tugma esa qat'iy 72px da turgani uchun
             Android 15+ da uning ustiga tushib qolardi. */
          className="md:hidden fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition-transform active:scale-95"
          style={{ bottom: 'calc(72px + var(--safe-bottom))' }}
        >
          <PlusCircle className="h-7 w-7" />
        </Link>
      )}

      <div className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-t border-border/60 pb-safe">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                // `flex-1 min-w-0` — qattiq w-16 (64px) EMAS: tor telefonda
                // bandlar teng bo'linsin (endi ikkala rolda ham 5 ta band).
                className={`relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? 'text-foreground' : 'text-text-muted hover:text-text'
                }`}
              >
                {/* Faol tab indikatori — turquoise chiziq (spec: faol-holat turquoise) */}
                {isActive && <span className="absolute top-0 h-1 w-8 rounded-full bg-turquoise" />}
                <span className="relative">
                  <item.icon
                    className={`w-5 h-5 shrink-0 ${isActive ? 'fill-turquoise/25' : ''}`}
                  />
                  {/* 99 dan oshsa "99+": uch xonali son yorliqni surib yuboradi. */}
                  {item.href.endsWith('/chats') && unreadChats > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[0.6rem] font-extrabold leading-none text-white">
                      {unreadChats > 99 ? '99+' : unreadChats}
                    </span>
                  )}
                </span>
                <span className="w-full truncate px-0.5 text-center text-[10px] font-bold leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
};
