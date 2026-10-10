'use client';

import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Circle, MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { useMapColors } from '@/shared/lib/mapColors';
import { Minus, Plus } from 'lucide-react';
import { useTileUrl } from '@/shared/lib/mapTiles';
import type { MyLocationLabels } from '@/shared/lib/myLocationLabels';
import {
  MyLocationButton,
  MyLocationLayer,
  useMyLocationControl,
  type MyLocationControl,
} from './MyLocationLayer';
import { SmoothDriverMarker } from './SmoothDriverMarker';
import { RouteLine } from './RouteLine';
import {
  HIT,
  cityIcon,
  destIcon,
  originIcon,
  pickupIcon,
  priceIcon,
  routeCountIcon,
} from './mapIcons';

/**
 * «XARITA» BO'LIMINING O'ZI — sahifani to'ldiradigan jonli xarita.
 *
 * 🔴 NEGA KERAK BO'LDI (egasi, 17.09.2026): «karta faqat landingda
 * qo'shilgan, bizga Yandex Go'dek kartani ko'rinishi, qayerga qo'yilishi
 * kerak — haqiqiy qulaylik bo'lsin». Va bu haq edi: saytda o'nta xarita
 * bor edi-yu, hammasi TUGMA ORTIDA yoki sahifa ichidagi kichik ko'rik
 * edi. Ya'ni xarita hech qachon ISH JOYI bo'lmagan: odam avval ro'yxat
 * bilan ishlab, keyin «xaritaga qarayinmi?» deb qaror qilardi.
 *
 * Bu yerda aksincha: XARITA — sahifaning o'zi, forma va natijalar esa
 * uning USTIDA suzadi (Yandex Go'dagi joylashuv).
 *
 * ⚠️ «ATROFIMDAGI MASHINALAR» EMAS va bo'la olmaydi: `GET /rides/search`
 * jo'nash VA borish koordinatasini BIRGA talab qiladi (o'lchandi — faqat
 * origin bilan `400 Key: 'SearchRidesRequest.DestLat'`), ya'ni «yaqinimda
 * nima bor» degan so'rovning O'ZI yo'q. Shuning uchun xarita uch ROST ish
 * qiladi: yo'nalish tanlash, topilgan safarlarni ko'rsatish va
 * uchrashuv nuqtasini ko'rsatish. O'ylab topilgan mashina chizilmaydi.
 */

export interface LiveMapCity {
  name: string;
  coord: [number, number];
}

export interface LiveMapRoute {
  from: [number, number];
  to: [number, number];
  /**
   * HAQIQIY YO'L nuqtalari (`GET /routing/route`), kelgan bo'lsa.
   *
   * 🔴 NEGA (egasi, 17.09.2026): «tekkis chizib qo'yyapti». Ikki shahar
   * orasidagi to'g'ri chiziq — chizg'ich izi, yo'l emas: u tog'dan ham,
   * cho'ldan ham o'tib ketadi va odam undan hech narsa o'qiy olmaydi.
   * Yo'l kelmaguncha to'g'ri chiziq turadi (xarita bo'sh qolmasin).
   */
  points?: [number, number][];
  /** «12 ta safar» — server bergan HAQIQIY son (bo'lmasa yozuv chizilmaydi). */
  countLabel?: string;
}

export interface LiveMapResult {
  id: string;
  origin: [number, number];
  dest: [number, number];
  /** Haydovchi xaritada belgilagan aniq uchrashuv joyi (bo'lmasa — yo'q). */
  pickup?: [number, number] | null;
  priceLabel: string;
}

/**
 * Tugma yozuvlari — ekran o'qigich uchun MAJBURIY.
 *
 * `locateStop` ATAYIN alohida: yoqiq tugmaning yozuvi o'zgarmasa,
 * ko'rmaydigan odam uni QAYTA BOSIB o'chirish mumkinligini bilmaydi.
 */
export interface LiveMapLabels extends MyLocationLabels {
  zoomIn: string;
  zoomOut: string;
}

export interface LiveMapInnerProps {
  cities: LiveMapCity[];
  routes: LiveMapRoute[];
  results: LiveMapResult[];
  from: [number, number] | null;
  to: [number, number] | null;
  activeId: string | null;
  /** Tanlangan SAFARNING haqiqiy yo'li (kelgan bo'lsa). */
  activeRoute?: [number, number][] | null;
  /** Tanlangan ikki SHAHAR orasidagi haqiqiy yo'l (kelgan bo'lsa). */
  pairRoute?: [number, number][] | null;
  /**
   * Jonli nuqta — safar yo'lda bo'lsa.
   *
   * `updatedAt` — serverdagi ping vaqti. Berilsa, ESKIRGAN ping
   * SURILMAYDI (izohi `livePosition.ts` da): eskirgan ma'lumotni silliq
   * harakat bilan chizish «aloqa bor» deb yolg'on gapirish bo'lardi.
   */
  driver?: { coord: [number, number]; heading?: number | null; updatedAt?: string | null } | null;
  onPickCity: (name: string, coord: [number, number]) => void;
  onSelectResult: (id: string) => void;
  cityLabel: string;
  /**
   * Xarita USTIDA turgan panellarning o'lchami (px).
   *
   * 🔴 O'LCHANADI, taxmin qilinmaydi (17.09.2026): avval bu yerda
   * «telefonda pastki chekka balandlikning 45% i» degan taxmin turardi
   * va u 320 px ekranda kadrni shu qadar uzoqlashtirib yubordiki,
   * ko'rinishga Hindiston va Arab dengizi kirib kelgandi. Sahifa
   * panellarning HAQIQIY balandligini o'lchab beradi.
   */
  insets?: { top: number; bottom: number; left: number };
  /** Boshqaruv tugmalarining nomlari — ekran o'qigich uchun MAJBURIY. */
  labels: LiveMapLabels;
  /**
   * «Men shu yerdaman» bosilgach joylashuv SAHIFAGA beriladi.
   *
   * 🔴 NEGA (egasi, 17.09.2026: «qulaylik yo'q»): tugma faqat kadrni
   * siljitardi. Odamga esa kadr emas, JAVOB kerak — u qaysi shahardan
   * chiqishini bilsin va qidiruv o'zi boshlansin.
   */
  onLocated?: (lat: number, lon: number) => void;
}

const UZ_CENTER: [number, number] = [41.5, 64.5];

/** Undan uzoqlashsa ekranda O'zbekiston emas, qo'shni davlatlar ko'rinadi. */
const MIN_COUNTRY_ZOOM = 5;

/**
 * KADR — nimani ko'rsatish kerakligi HOLATGA qarab o'zgaradi.
 *
 * 🔴 `MapContainer` ning `bounds` propi ISHLAMAYDI (16.09.2026 da prodda
 * ko'z bilan ko'rilgan) — saytdagi hamma xarita `useMap` + `fitBounds`
 * naqshini ishlatadi, bu ham shunday.
 *
 * ⚠️ `key` — nimaga moslashganini bildiradigan SATR. Massivning o'zini
 * bog'liqlikka qo'ysak, har renderda yangi massiv yasaladi va kadr
 * foydalanuvchi qo'li bilan surgan joyidan orqaga SAKRAB ketaveradi.
 */
function Frame({
  points,
  fitKey,
  insets,
  maxZoom = 13,
}: {
  points: [number, number][];
  fitKey: string;
  insets: { top: number; bottom: number; left: number };
  maxZoom?: number;
}) {
  const map = useMap();
  /* Chekka qiymatlari REF orqali: ular panel o'lchami bilan tez-tez
     o'zgaradi, kadr esa faqat MAZMUN o'zgarganda qayta tortilishi kerak
     (aks holda ro'yxat uzayishi bilan xarita o'zicha sakrayveradi). */
  const insetsRef = React.useRef(insets);
  // Render paytida ref'ga yozib bo'lmaydi (React qoidasi) — effektda yangilaymiz.
  React.useEffect(() => {
    insetsRef.current = insets;
  }, [insets]);

  /*
   * 🔴 KADR PANELLAR O'LCHANGACH QAYTA TORTILADI (17.09.2026 da o'lchandi).
   *
   * Birinchi chizilishda panellar hali joyiga tushmagan bo'ladi va
   * `fitBounds` nol chekka bilan hisoblanadi — 320 px ekranda natija
   * 5-zoom o'rniga 4-zoom bo'lib chiqqandi (o'lchandi: mamlakat eni
   * 272 px joyga sig'ardi-yu, xarita ikki barobar uzoqda turardi).
   *
   * Chekka QUANTLANADI (24 px qadam): ro'yxat bir qator o'sgani uchun
   * kadr sakramasin, lekin panel sezilarli o'zgarsa moslashsin.
   */
  const insetKey = [insets.top, insets.bottom, insets.left]
    .map((v) => Math.round(v / 24))
    .join('|');

  React.useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], Math.min(13, maxZoom));
      return;
    }
    /*
     * 🔴 KADR PANELLAR OSTIDA QOLMASIN (17.09.2026, ko'z bilan ko'rildi).
     *
     * Xarita butun ekranni egallaydi, lekin uning bir qismi DOIM forma va
     * natijalar paneli ostida turadi. Oddiy `fitBounds` markazni BUTUN
     * konteynerga qarab hisoblaydi va natijada shaharlar panel ostiga
     * tushib qolardi — ya'ni «kadrga sig'di» deb hisoblansa ham, odam
     * ularni ko'rmasdi.
     *
     * Shuning uchun chekka assimetrik: tepada forma, pastda natijalar,
     * kompyuterda esa chapda ustun turadi (368 px + oraliq).
     */
    const box = map.getSize();
    const edge = Math.max(12, Math.min(40, Math.round(Math.min(box.x, box.y) * 0.06)));
    const ins = insetsRef.current;
    /*
     * ⚠️ CHEKKA KADRNING YARMIDAN OSHMASIN. Panel ekranning yarmini
     * egallaganda (tor telefon + uzun ro'yxat) `fitBounds` qoladigan
     * tasmaga sig'dirish uchun juda uzoqlashib ketardi — mamlakat
     * nuqtadek bo'lib qolardi. Bunday holda kadr biroz panel ostiga
     * tushadi, lekin MIQYOS to'g'ri qoladi: odam surib ko'ra oladi.
     */
    const capY = Math.round(box.y * 0.35);
    const capX = Math.round(box.x * 0.5);
    const topLeft: [number, number] = [
      Math.min(capX, Math.max(edge, ins.left)),
      Math.min(capY, Math.max(edge, ins.top)),
    ];
    const bottomRight: [number, number] = [edge, Math.min(capY, Math.max(edge, ins.bottom))];
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: topLeft,
      paddingBottomRight: bottomRight,
      maxZoom,
      /* ⚠️ ANIMATSIYASIZ: aks holda `getZoom()` HALI ESKI qiymatni
         qaytaradi va pastdagi chegara tekshiruvi ishlamaydi (320 px
         da aynan shu sabab kadr 4-zumda qolib ketgandi). */
      animate: false,
    });

    /*
     * 🔴 MAMLAKAT KADRNI TO'LDIRSIN (17.09.2026, 320 px da ko'z bilan
     * ko'rildi).
     *
     * Nukus bilan Andijon orasi 12.7° — tor ekranda bu masofa 5-zumga
     * SIG'MAYDI (o'lchandi: 290 px kerak, 254 px bor) va `fitBounds`
     * majburan 4-zumga tushardi. Natijada ekranda O'zbekiston emas,
     * Eron bilan Pokiston ko'rinardi: xarita «bizniki» bo'lib
     * tuyulmasdi.
     *
     * Shuning uchun quyi chegara qo'yamiz. Bunda eng chetdagi shahar
     * kadrdan biroz chiqib qolishi mumkin — lekin u YO'QOLMAYDI:
     * xarita suriladi va nomini formaga yozib ham tanlash mumkin.
     * Miqyos to'g'ri bo'lgani muhimroq.
     */
    if (map.getZoom() < MIN_COUNTRY_ZOOM) map.setZoom(MIN_COUNTRY_ZOOM);
    // `points` ATAYIN bog'liqlikda yo'q — izohga qarang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, insetKey, map]);
  return null;
}

/**
 * O'LCHAMNI TIKLASH.
 *
 * 🔴 Leaflet konteyner o'lchamini FAQAT o'zi yaratilganda o'lchaydi. Bu
 * xarita esa flex ichida, balandligi ekrandan hisoblanadi: birinchi
 * chizilishda konteyner hali 0 px bo'lishi mumkin va xarita kulrang
 * qolib ketadi (klassik «yarim yuklangan xarita» xatosi). Telefonni
 * burganda ham xuddi shunday.
 */
function KeepSize() {
  const map = useMap();
  React.useEffect(() => {
    const fix = () => map.invalidateSize();
    const t = window.setTimeout(fix, 60);
    window.addEventListener('resize', fix);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

/**
 * USTMA-UST TUSHGAN SHAHARLARNI AJRATADI.
 *
 * 🔴 JONLI SINOVDA TUTILDI (17.09.2026): Samarqand nuqtasi bosilganda
 * SHAHRISABZ tanlanardi. Sabab arifmetik: mamlakat ko'rinishida ikki
 * shahar orasidagi 60 km ≈ 20 px, bosish maydoni esa 44 px (loyiha
 * qoidasi) — ya'ni maydonlar bir-birining ustiga chiqadi va Leaflet
 * janubdagi belgini USTGA qo'yadi. Qoidani kichraytirish yechim emas:
 * u barmoq uchun yozilgan.
 *
 * Shuning uchun kadr uzoq bo'lganda YAQIN turgan shaharlar
 * ko'rsatilmaydi; zum kattalashgani sayin ular o'zi paydo bo'ladi.
 * Ro'yxatdagi tartib — ustuvorlik (yirik shaharlar oldin), tanlangan
 * ikkitasi esa HAR DOIM ko'rinadi.
 *
 * ⚠️ Yashiringan shahar yo'qolib qolmaydi: formadagi maydonga nomini
 * yozib ham tanlash mumkin (ikkinchi yo'l DOIM ochiq).
 */
function useSpacedCities(cities: LiveMapCity[], keep: Array<[number, number] | null>) {
  const map = useMap();
  const [version, setVersion] = React.useState(0);
  useMapEvents({
    zoomend: () => setVersion((v) => v + 1),
    moveend: () => setVersion((v) => v + 1),
  });

  /*
   * 🔴 BIRINCHI KADRNI O'TKAZIB YUBORMASLIK (17.09.2026 da tutildi).
   *
   * Kadrni moslash (`fitBounds`) shu komponent hodisalarga OBUNA
   * bo'lgunicha ishlab bo'ladi va `zoomend` ni hech kim eshitmay qoladi.
   * Natijada hisob DASTLABKI (5-zum) kadr bo'yicha qolib ketardi va
   * hamma narsa «ustma-ust» ko'rinardi: to'rtta narx belgisi bitta
   * bo'lib qolgandi (o'lchandi: `120 000 +3`, hatto keng ekranda ham).
   */
  React.useEffect(() => {
    const id = window.setTimeout(() => setVersion((v) => v + 1), 80);
    return () => window.clearTimeout(id);
  }, []);

  const keepKey = keep.map((k) => (k ? k.join() : '')).join('|');
  return React.useMemo(() => {
    const out: LiveMapCity[] = [];
    const taken: { x: number; y: number }[] = [];
    for (const c of cities) {
      const forced = keep.some((k) => !!k && k[0] === c.coord[0] && k[1] === c.coord[1]);
      const p = map.latLngToLayerPoint(c.coord);
      if (!forced && taken.some((t) => Math.abs(t.x - p.x) < HIT && Math.abs(t.y - p.y) < HIT)) {
        continue;
      }
      taken.push({ x: p.x, y: p.y });
      out.push(c);
    }
    return out;
    // `version` — kadr o'zgargani signali (zum/surish).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, keepKey, version, map]);
}

const mid = (a: [number, number], b: [number, number]): [number, number] => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
];

/**
 * BOSHQARUV TUGMALARI — zum va «men qayerdaman».
 *
 * 🔴 Leaflet'ning O'Z zum boshqaruvi ishlatilmaydi, ikki sabab bilan:
 *   1. uning tugmalari 30 px — loyihaning 44 px qoidasidan kichik;
 *   2. u burchakka yopishadi va telefonda pastdagi natijalar varag'i
 *      ostida qolib ketadi.
 * Shuning uchun tugmalar O'NG YONDA, o'rtada turadi: yuqorida forma,
 * pastda natijalar — bu chiziq ikkalasidan ham xoli.
 *
 * ⚠️ `stopPropagation`: tugma ustidagi bosish xaritaga ham yetib borsa,
 * xarita uni «bo'sh joyga bosildi» deb o'qiydi.
 */
/**
 * BOSHQARUV TUGMALARI — zum va «men shu yerdaman».
 *
 * Joylashuv tugmasining mantig'i va uch holati `MyLocationLayer.tsx` da
 * (ikkinchi xarita — safar marshruti varag'i — ham o'shani ishlatadi).
 */
function MapControls({ labels, ctl }: { labels: LiveMapLabels; ctl: MyLocationControl }) {
  const map = useMap();

  const btn =
    'flex h-11 w-11 items-center justify-center bg-surface text-text transition-colors ' +
    'hover:text-accent active:scale-95 disabled:opacity-60';

  return (
    <div
      className="absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border shadow-lg"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <button type="button" aria-label={labels.zoomIn} className={btn} onClick={() => map.zoomIn()}>
        <Plus className="h-5 w-5" aria-hidden />
      </button>
      <span className="h-px w-full bg-border" />
      <button
        type="button"
        aria-label={labels.zoomOut}
        className={btn}
        onClick={() => map.zoomOut()}
      >
        <Minus className="h-5 w-5" aria-hidden />
      </button>
      <span className="h-px w-full bg-border" />
      <MyLocationButton ctl={ctl} labels={labels} className={btn} />
    </div>
  );
}

/**
 * NARX BELGILARI — ustma-ust tushmaydigan qilib.
 *
 * 🔴 NEGA (17.09.2026, ko'z bilan ko'rildi): bir shahardan chiqadigan
 * safarlar jo'nash nuqtasi bilan bir-biriga juda yaqin tushadi va narx
 * belgilari BIR-BIRINI YOPIB qo'yardi — ekranda «120 000» ning ustida
 * «150 000», tagida yana bittasi. Odam na o'qiy oladi, na bosa oladi.
 *
 * Yechim shaharlarникidek: yaqin tushganlari ko'rsatilmaydi, ko'ringan
 * belgida esa «+N» turadi — ya'ni ular YO'QOLMAYDI, «shu atrofda yana
 * N ta bor» deb aytiladi. Zum kattalashsa o'zi ajraladi.
 *
 * ⚠️ Tanlangan belgi HAR DOIM ko'rinadi: odam bosgan narsasi yo'qolib
 * qolmasin.
 */
function useSpacedResults(
  results: LiveMapResult[],
  activeId: string | null
): { r: LiveMapResult; extra: number }[] {
  const map = useMap();
  const [version, setVersion] = React.useState(0);
  useMapEvents({
    zoomend: () => setVersion((v) => v + 1),
    moveend: () => setVersion((v) => v + 1),
  });

  /*
   * 🔴 BIRINCHI KADRNI O'TKAZIB YUBORMASLIK (17.09.2026 da tutildi).
   *
   * Kadrni moslash (`fitBounds`) shu komponent hodisalarga OBUNA
   * bo'lgunicha ishlab bo'ladi va `zoomend` ni hech kim eshitmay qoladi.
   * Natijada hisob DASTLABKI (5-zum) kadr bo'yicha qolib ketardi va
   * hamma narsa «ustma-ust» ko'rinardi: to'rtta narx belgisi bitta
   * bo'lib qolgandi (o'lchandi: `120 000 +3`, hatto keng ekranda ham).
   */
  React.useEffect(() => {
    const id = window.setTimeout(() => setVersion((v) => v + 1), 80);
    return () => window.clearTimeout(id);
  }, []);

  const key = results.map((r) => r.id).join(',');
  return React.useMemo(() => {
    // Tanlangani BIRINCHI: u boshqasining ortida qolmasin.
    const order = [...results].sort((a, b) => (a.id === activeId ? -1 : b.id === activeId ? 1 : 0));
    const out: { r: LiveMapResult; extra: number }[] = [];
    const taken: { x: number; y: number; i: number }[] = [];
    for (const r of order) {
      const p = map.latLngToLayerPoint(r.origin);
      const hit = taken.find((t) => Math.abs(t.x - p.x) < 90 && Math.abs(t.y - p.y) < HIT);
      if (hit) {
        out[hit.i].extra += 1;
        continue;
      }
      taken.push({ x: p.x, y: p.y, i: out.length });
      out.push({ r, extra: 0 });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, activeId, version, map]);
}

/** Narx belgilari — izohi `useSpacedResults` da. */
function ResultPins({
  results,
  activeId,
  onSelect,
}: {
  results: LiveMapResult[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const shown = useSpacedResults(results, activeId);
  return (
    <>
      {shown.map(({ r, extra }) => {
        const label = extra > 0 ? `${r.priceLabel} +${extra}` : r.priceLabel;
        return (
          <Marker
            /*
             * ⚠️ Kalitga YOZUV ham kiradi: react-leaflet belgi
             * yangilanganda `title` atributini qayta yozmaydi va ekran
             * o'qigich ESKI narxni o'qib qolardi (o'lchandi: ko'rinib
             * turgan yozuv «+2», atribut esa hamon «+3» edi).
             */
            key={`${r.id}:${label}:${r.id === activeId}`}
            position={r.origin}
            icon={priceIcon(label, r.id === activeId)}
            title={label}
            alt={label}
            // Tanlangani USTDA: bir bekatdan chiqadigan ikki safar
            // belgisi ustma-ust tushganda u ko'rinmay qolardi.
            zIndexOffset={r.id === activeId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(r.id) }}
          />
        );
      })}
    </>
  );
}

/** Shahar nuqtalari — ustma-ust tushmaydigan qilib (izohi `useSpacedCities` da). */
function CityDots({
  cities,
  from,
  to,
  onPick,
  cityLabel,
}: {
  cities: LiveMapCity[];
  from: [number, number] | null;
  to: [number, number] | null;
  onPick: (name: string, coord: [number, number]) => void;
  cityLabel: string;
}) {
  const visible = useSpacedCities(cities, [from, to]);
  return (
    <>
      {visible.map((c) => {
        const isFrom = !!from && from[0] === c.coord[0] && from[1] === c.coord[1];
        const isTo = !!to && to[0] === c.coord[0] && to[1] === c.coord[1];
        return (
          <Marker
            key={c.name}
            position={c.coord}
            icon={cityIcon(isFrom ? 'from' : isTo ? 'to' : null)}
            // Ekran o'qigich uchun nom: nuqtaning o'zi hech nima aytmaydi.
            title={`${cityLabel}: ${c.name}`}
            alt={c.name}
            // Tanlangani USTDA: yonma-yon tushganda ham u bosiladigan qoladi.
            zIndexOffset={isFrom || isTo ? 900 : 0}
            eventHandlers={{ click: () => onPick(c.name, c.coord) }}
          />
        );
      })}
    </>
  );
}

export default function LiveMapInner({
  cities,
  routes,
  results,
  from,
  to,
  activeId,
  activeRoute,
  pairRoute,
  driver,
  onPickCity,
  onSelectResult,
  cityLabel,
  labels,
  onLocated,
  insets = { top: 0, bottom: 0, left: 0 },
}: LiveMapInnerProps) {
  const tiles = useTileUrl();
  const active = results.find((r) => r.id === activeId) ?? null;

  /* «Men shu yerdaman» — uch holatli tugma, izohi `MyLocationLayer` da. */
  const locCtl = useMyLocationControl(labels);

  /* Chiziq rangi TOKENDAN, JS orqali — izohi `mapColors` da (klass
     bilan berilgani ishlamagan va chiziqlar ko'k bo'lib qolgandi). */
  const c = useMapColors();

  /*
   * Kadrga nima kiradi:
   *   natija bor      → hamma natija (va tanlangani bo'lsa — uning yo'li);
   *   yo'nalish bor   → ikki shahar;
   *   aks holda       → butun mamlakat (shaharlar).
   */
  const fit = React.useMemo<{ points: [number, number][]; key: string; maxZoom?: number }>(() => {
    if (active) {
      /* Kadr YO'L bo'ylab: to'g'ri chiziqning chegarasi yo'lnikidan
         kichik bo'lib, marshrutning burilishlari kadrdan chiqib
         ketardi. */
      const pts: [number, number][] =
        activeRoute && activeRoute.length >= 2 ? [...activeRoute] : [active.origin, active.dest];
      if (active.pickup) pts.push(active.pickup);
      return { points: pts, key: `active:${active.id}:${activeRoute ? 'road' : 'line'}` };
    }
    if (results.length > 0) {
      /*
       * ⚠️ Natijalar bir shaharda to'plansa kadr ko'cha darajasiga
       * tushib ketardi va odam «qayerdan qayerga» ekanini xaritada
       * KO'RMASDI. Shuning uchun natijalar holatida yaqinlashish
       * cheklanadi (`maxZoom` pastroq) — atrof ko'rinib tursin.
       */
      return {
        points: results.map((r) => r.origin),
        key: `results:${results.map((r) => r.id).join(',')}`,
        maxZoom: 11,
      };
    }
    if (from && to) {
      return { points: [from, to], key: `route:${from.join()}-${to.join()}` };
    }
    /*
     * 🔴 BITTA SHAHAR TANLANGANDA KADR QIMIRLAMAYDI (17.09.2026, jonli
     * sinovda tutildi).
     *
     * Ilgari bu yerda «bitta nuqta → o'sha nuqtaga 13-zum» shoxi bor edi.
     * Natijasi halokatli edi: odam Toshkentni bosishi bilan xarita
     * Toshkentga kirib ketardi va IKKINCHI shahar ekrandan chiqib
     * qolardi — ya'ni «ikki shaharni bosing» degan yo'l o'zining
     * birinchi qadamidayoq uzilardi (Playwright bilan takrorlandi:
     * ikkinchi bosish umuman qidiruv yubormasdi).
     *
     * Endi jo'nash shahri tanlanganda kadr mamlakat ko'rinishida
     * QOLADI — `key` o'zgarmaydi, ya'ni `fitBounds` qayta ishlamaydi.
     */
    return { points: cities.map((c) => c.coord), key: 'cities' };
  }, [active, activeRoute, results, from, to, cities]);

  // Natija chiqqach shahar nuqtalari YASHIRILADI: ular tanlash uchun edi,
  // tanlov esa allaqachon qilingan. Ikkalasi birga tursa xarita nuqta
  // bo'lib ketadi va narx belgilari ularning orasida yo'qoladi.
  const showCities = results.length === 0;

  return (
    <MapContainer
      center={UZ_CENTER}
      zoom={5}
      style={{ width: '100%', height: '100%' }}
      // Bu sahifaning ASOSIY mazmuni — boshqaruv to'liq ochiq (sahifa
      // ichidagi kichik ko'rikdan farqi shu).
      scrollWheelZoom
      zoomControl={false}
      /* Leaflet'ning O'Z yozuvi pastki o'ng burchakka yopishadi va
         telefonda natijalar varag'i ostida qolib ketadi. OSM litsenziyasi
         (ODbL) esa ko'rinadigan attributsiyani TALAB qiladi — shuning
         uchun uni o'zimiz, doim ko'rinadigan joyga chizamiz. */
      attributionControl={false}
    >
      <TileLayer url={tiles.url} className={tiles.className} />
      <MapControls labels={labels} ctl={locCtl} />
      <KeepSize />
      <Frame points={fit.points} fitKey={fit.key} insets={insets} maxZoom={fit.maxZoom} />

      {/* MASHHUR YO'NALISHLAR — server bergan haqiqiy statistika.
          Faqat natija YO'Q paytda: natija chiqqach ular shovqin. */}
      {showCities &&
        routes.map((r, i) => (
          <React.Fragment key={`route-${i}`}>
            {/* Uslub (yaxlit yo'l / uzuq taxmin) — `RouteLine` da. */}
            <RouteLine
              real={!!r.points && r.points.length >= 2}
              positions={r.points && r.points.length >= 2 ? r.points : [r.from, r.to]}
              color={c.soft}
              weight={3}
              opacity={0.75}
            />
            {r.countLabel && (
              <Marker position={mid(r.from, r.to)} icon={routeCountIcon(r.countLabel)} />
            )}
          </React.Fragment>
        ))}

      {/* TANLANGAN JUFTLIK — yo'nalishning HAQIQIY yo'li.
          ⚠️ Natijalar chiqqanda ham chiziladi (faqat aniq safar
          tanlanmagan bo'lsa): odam «bu yo'nalish qayerdan o'tadi»
          degan savolga javobni natijalar bilan BIRGA ko'radi. */}
      {from && to && !active && (
        <RouteLine
          /* ⚠️ `smoothFactor={0}` (`RouteLine` ichida) — Leaflet chiziqni chizishdan OLDIN
             soddalashtiradi va bizning yo'limizning burilishlarini yeb
             qo'yardi (o'lchandi: 6 nuqtali yo'l ekranda 2 nuqta bo'lib
             qolgan — ya'ni yana «tekkis chiziq»). Nuqtalar sonini biz
             O'ZIMIZ cheklaymiz (`simplifyRoute`), shuning uchun bu
             yerda qo'shimcha soddalashtirish keraksiz. */
          real={!!pairRoute && pairRoute.length >= 2}
          positions={pairRoute && pairRoute.length >= 2 ? pairRoute : [from, to]}
          color={c.accent}
        />
      )}

      {/* SHAHARLAR — xaritadan yo'nalish tanlash. */}
      {showCities && (
        <CityDots cities={cities} from={from} to={to} onPick={onPickCity} cityLabel={cityLabel} />
      )}

      {/* TANLANGAN SAFARNING YO'LI — haqiqiy yo'l kelguncha uzuq taxmin. */}
      {active && (
        <>
          <RouteLine
            real={!!activeRoute && activeRoute.length >= 2}
            positions={
              activeRoute && activeRoute.length >= 2 ? activeRoute : [active.origin, active.dest]
            }
            color={c.accent}
          />
          <Marker position={active.origin} icon={originIcon} />
          <Marker position={active.dest} icon={destIcon} />
          {/* UCHRASHUV NUQTASI — haydovchi xaritada belgilagan aniq joy.
              Backend `pickup_lat/pickup_lon` ni saqlaydi va qaytaradi
              (17.09.2026 da jonli o'lchandi). */}
          {active.pickup && <Marker position={active.pickup} icon={pickupIcon()} />}
        </>
      )}

      {/* NATIJALAR — har safar o'z JO'NASH nuqtasida, narxi bilan. */}
      <ResultPins results={results} activeId={activeId} onSelect={onSelectResult} />

      {driver && (
        <SmoothDriverMarker
          coord={driver.coord}
          heading={driver.heading}
          updatedAt={driver.updatedAt}
        />
      )}

      {/* Foydalanuvchining o'zi — hamma narsaning USTIDA chiziladi. */}
      <MyLocationLayer ctl={locCtl} color={c.me} onFix={onLocated} />
    </MapContainer>
  );
}
