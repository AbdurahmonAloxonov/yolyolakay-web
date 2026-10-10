'use client';

import { GirihPattern } from '@/shared/ui/brand/Ornament';
import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Sparkles, ArrowRight, Compass } from 'lucide-react';
import { useRideRecommendations } from '@/entities/ride/api/useRideRecommendations';
import type { RecommendedRoute, RecommendedCity } from '@/shared/api/rides';
import { useTr } from '@/shared/lib/useTr';
import type { Tr } from '@/shared/lib/i18n';

/**
 * «Siz uchun» — `GET /rides/recommendations`.
 *
 * 🔴 2026-08-07 QAYTA YOZILDI. Ilgari bu blok SAFAR kartochkalarini chizardi va
 * HECH QACHON ko'rinmasdi: ruchka safar emas, YO'NALISH STATISTIKASI qaytaradi
 * (`RouteStats{from,to,trips_count}` / `CityStats{city,lat,lon}`), parser esa
 * elementda `id` bo'lishini talab qilardi — bunday maydon yo'q edi.
 *
 * Endi blok yo'nalish ko'rsatadi va bosilganda qidiruvni to'ldirib ochadi
 * (`/search?from=…&to=…`). Sarlavhalar ham TAXMIN emas — kalitlar hujjatlashtirilgan.
 *
 * `from`/`to` — backend bergan matn. Qidiruv sahifasi shahar nomini `uzCities`
 * orqali yechadi va u yozilishiga befarq (apostrof/kirill/lotin), shuning uchun
 * nom qaysi shaklda kelishidan qat'i nazar ishlaydi. Yechilmasa — foydalanuvchi
 * qidiruvda odatdagidek tanlaydi, blok baribir zarar keltirmaydi.
 */

const MAX_ROUTES = 4;
const MAX_CITIES = 6;

/** Bir yo'nalish ikki guruhda takrorlanmasin. */
const routeKey = (r: RecommendedRoute) => `${r.from.toLowerCase()}>${r.to.toLowerCase()}`;

function RouteCard({ route, locale, tr }: { route: RecommendedRoute; locale: string; tr: Tr }) {
  const href = `/${locale}/search?from=${encodeURIComponent(route.from)}&to=${encodeURIComponent(route.to)}`;
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
        <span data-user-text className="min-w-0 truncate">
          {route.from}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span data-user-text className="min-w-0 truncate">
          {route.to}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold text-text-muted">
          {typeof route.tripsCount === 'number'
            ? tr(
                `${route.tripsCount} ta safar`,
                `${route.tripsCount} поездок`,
                `${route.tripsCount} trips`
              )
            : tr("Yo'nalish", 'Направление', 'Route')}
        </span>
        <span className="text-[11px] font-bold text-text-muted group-hover:text-accent group-hover:underline">
          {tr('Qidirish', 'Искать', 'Search')}
        </span>
      </div>
    </Link>
  );
}

function CityChip({ city, locale }: { city: RecommendedCity; locale: string }) {
  return (
    <Link
      href={`/${locale}/search?to=${encodeURIComponent(city.city)}`}
      /* ⚠️ `min-h-11`: chip balandligi 34 px edi (o'lchandi 2026-09-04).
         Ular yonma-yon 8 px oraliqda turadi — past chip barmoq uchun
         qo'shnisidan ajralmaydi. */
      className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-accent hover:text-accent"
    >
      <Compass className="h-3.5 w-3.5 shrink-0 text-accent" />
      <span className="truncate">{city.city}</span>
    </Link>
  );
}

export function RecommendedRides({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const tr = useTr();
  const { data } = useRideRecommendations();

  const seen = new Set<string>();
  const dedupe = (routes: RecommendedRoute[]) =>
    routes
      .filter((r) => {
        const k = routeKey(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, MAX_ROUTES);

  // Tartib muhim: shaxsiy tavsiya ommabopdan ustun, shuning uchun avval u dedupe qilinadi.
  const mine = dedupe(data?.byYourRoutes ?? []);
  const popular = dedupe(data?.popular ?? []);
  const cities = (data?.newDirections ?? []).slice(0, MAX_CITIES);

  // Bo'sh/tanib bo'lmagan javob, xato, mehmon — hech narsa chizmaymiz.
  if (mine.length === 0 && popular.length === 0 && cities.length === 0) return null;

  const groups: { key: string; title: string; routes: RecommendedRoute[] }[] = [
    {
      key: 'mine',
      title: tr('Tarixingiz asosida', 'На основе ваших поездок', 'Based on your trips'),
      routes: mine,
    },
    {
      key: 'popular',
      title: tr("Ommabop yo'nalishlar", 'Популярные направления', 'Popular routes'),
      routes: popular,
    },
  ].filter((g) => g.routes.length > 0);

  return (
    <section className={`space-y-4 ${className}`}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4">
        <GirihPattern size={92} color="var(--turquoise)" opacity={0.05} />
        <div className="relative z-10 flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-turquoise/30 bg-turquoise-light/50 text-wine-ash">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-black tracking-tight text-foreground">
              {tr('Siz uchun', 'Для вас', 'For you')}
            </h3>
            <p className="text-[11px] font-bold text-text-muted">
              {tr(
                "Ommabop va sizga mos yo'nalishlar — bosing, qidiruv to'ladi",
                'Популярные и подходящие направления — нажмите, поиск заполнится',
                'Popular and fitting routes — tap and the search fills in'
              )}
            </p>
          </div>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-text-muted">
            {group.title}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.routes.map((route) => (
              <RouteCard key={routeKey(route)} route={route} locale={locale} tr={tr} />
            ))}
          </div>
        </div>
      ))}

      {cities.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-text-muted">
            {tr("Yangi yo'nalishlar", 'Новые направления', 'Somewhere new')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {cities.map((city) => (
              <CityChip key={city.city} city={city} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
