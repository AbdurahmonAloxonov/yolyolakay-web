import React from 'react';

/**
 * ATLAS (abr bandi) — MATO, chiziq emas.
 *
 * 🔴 NEGA QAYTA YOZILDI (egasi, 2026-08-30: «atlasni ham ishlatishni
 * bilmabsan, tekkis qilib qo'yibsan, matoligi bilinmayapti»).
 *
 * Haqli. Birinchi variant shunchaki patli chekkali TIK CHIZIQLAR edi.
 * Haqiqiy xonatlasda esa uchta narsa bor va uchalasi ham yetishmasdi:
 *
 *  1. NAQSH. Atlas — chiziq emas. Unda tanilgan abr shakllari bor:
 *     bodom (qalampir), taroq, alanga. Ular ustun bo'ylab teriladi va
 *     har biri o'z rangida «erib» ketadi.
 *
 *  2. IPAK YALTIROG'I. Atlas to'quvining yuzasi silliq va yorug'likni
 *     AKS ETTIRADI: matoda doim bir tomondan ikkinchisiga o'tuvchi nur
 *     yo'li bor. Tekis rang — bu bosma chit, atlas emas.
 *
 *  3. TO'QUV. Yaqindan qaralganda tik ip sezilib turadi.
 *
 * Shuning uchun mato TO'RT QATLAMDAN yig'iladi:
 *     zamin bandlar → abr naqshlari → tik ip (to'quv) → nur yo'li
 *
 * ⚠️ ABR CHEKKASI — matoning butun siri. Marg'ilonda ipni bo'yashdan
 * oldin bog'lashadi, bo'yoq bog'lam ostiga sizadi va chekka patli
 * chiqadi. `feTurbulence` + `feDisplacementMap` shuni beradi, va
 * shovqin ikki o'qda HAR XIL bo'lishi shart: sizish faqat ip bo'ylab
 * ketadi. Teng qo'ysang naqsh «bulut»ga aylanadi va o'zbekistonlik
 * odam uni darhol soxta deb biladi.
 */

/** Xonatlasning klassik palitrasi. */
export const ATLAS_COLORS = {
  crimson: '#A81F2A',
  saffron: '#D08A2C',
  turquoise: '#17796F',
  indigo: '#22306B',
  pink: '#C4157A',
  ivory: '#EFE3D2',
  ink: '#241017',
} as const;

type Palette = {
  ground: string;
  motif: string;
  core: string;
  accent: string;
  light: string;
};

/** Uchta klassik terma — kartochkadan kartochkaga almashadi. */
const PALETTES: Palette[] = [
  {
    ground: ATLAS_COLORS.crimson,
    motif: ATLAS_COLORS.indigo,
    core: ATLAS_COLORS.saffron,
    accent: ATLAS_COLORS.turquoise,
    light: ATLAS_COLORS.ivory,
  },
  {
    ground: ATLAS_COLORS.indigo,
    motif: ATLAS_COLORS.turquoise,
    core: ATLAS_COLORS.crimson,
    accent: ATLAS_COLORS.saffron,
    light: ATLAS_COLORS.ivory,
  },
  {
    ground: ATLAS_COLORS.turquoise,
    motif: ATLAS_COLORS.crimson,
    core: ATLAS_COLORS.ivory,
    accent: ATLAS_COLORS.pink,
    light: ATLAS_COLORS.saffron,
  },
];

/**
 * ATLAS MATOSI — takrorlanuvchi abr naqshi.
 *
 * [vertical] — ip yo'nalishi. `true` da naqsh tik teriladi (mato
 * osilgan holat), `false` da yotiq (chekka lentasi).
 */
export function AtlasCloth({
  className = '',
  palette = 0,
  vertical = true,
  scale = 1,
  seed = 7,
  sheen = true,
  style,
}: {
  className?: string;
  /** Terma raqami — kartochkalar bir xil bo'lmasin. */
  palette?: number;
  vertical?: boolean;
  /** Naqsh yirikligi. 1 — asl (katak 120×200 px). */
  scale?: number;
  seed?: number;
  /** Ipak nuri. Ingichka chekka lentalarda o'chiriladi. */
  sheen?: boolean;
  style?: React.CSSProperties;
}) {
  const uid = React.useId().replace(/:/g, '');
  const p = PALETTES[Math.abs(palette) % PALETTES.length];

  const W = 120;
  const H = 200;
  /** Chegaradan tashqariga chiqish (bleed) — izohi zamin qatlamida. */
  const B = 16;
  const tw = Math.round((vertical ? W : H) * scale);
  const th = Math.round((vertical ? H : W) * scale);

  /**
   * BODOM (qalampir) — atlasning eng tanish abr shakli: pastki qismi
   * to'la, uchi cho'zilgan. Suzanidagi bodom bilan bir oila.
   */
  const bodom = (cx: number, cy: number, w: number, h: number) =>
    `M${cx},${cy - h / 2} ` +
    `C${cx + w * 0.62},${cy - h * 0.34} ${cx + w * 0.58},${cy + h * 0.26} ${cx},${cy + h / 2} ` +
    `C${cx - w * 0.58},${cy + h * 0.26} ${cx - w * 0.62},${cy - h * 0.34} ${cx},${cy - h / 2} Z`;

  /** TAROQ — tishli toj, bodomlar orasida turadi. */
  const taroq = (cx: number, cy: number, w: number, h: number) => {
    const teeth = 5;
    const step = w / teeth;
    let d = `M${cx - w / 2},${cy + h / 2} L${cx - w / 2},${cy}`;
    for (let i = 0; i < teeth; i += 1) {
      const x = cx - w / 2 + i * step;
      d += ` L${x + step * 0.25},${cy - h / 2} L${x + step * 0.75},${cy} L${x + step},${cy}`;
    }
    d += ` L${cx + w / 2},${cy + h / 2} Z`;
    return d;
  };

  const content = (
    <g filter={`url(#abr-${uid})`}>
      {/* 1 — ZAMIN: tik bandlar, kengliklari ATAYIN notekis.
             ⚠️ Katak chegarasidan TASHQARIGA chiqib chiziladi (`-B`):
             abr filtri pikselni surganda katak chetida OQ BO'SHLIQ
             ochilib qolardi va mato yamoq-yamoq bo'lib ko'rinardi. */}
      <rect x={-B} y={-B} width={W + 2 * B} height={H + 2 * B} fill={p.ground} />
      <rect x={-B} y={-B} width={14 + B} height={H + 2 * B} fill={p.accent} />
      <rect x="14" y={-B} width="5" height={H + 2 * B} fill={p.light} />
      <rect x={W - 20} y={-B} width={20 + B} height={H + 2 * B} fill={p.motif} />
      <rect x={W - 24} y={-B} width="4" height={H + 2 * B} fill={p.light} />

      {/* 2 — ABR NAQSHLARI: bodom ustuni, ichida yadro. */}
      <path d={bodom(W * 0.5, H * 0.27, 62, 96)} fill={p.motif} />
      <path d={bodom(W * 0.5, H * 0.27, 30, 50)} fill={p.core} />
      <path d={bodom(W * 0.5, H * 0.27, 12, 20)} fill={p.ground} />

      {/* Teskari bodom — ustun jonli bo'lsin. */}
      <g transform={`rotate(180 ${W * 0.5} ${H * 0.74})`}>
        <path d={bodom(W * 0.5, H * 0.74, 54, 84)} fill={p.core} />
        <path d={bodom(W * 0.5, H * 0.74, 26, 44)} fill={p.ground} />
      </g>

      {/* Taroq — ikki bodom orasida. */}
      <path d={taroq(W * 0.5, H * 0.5, 46, 18)} fill={p.light} />
      {/* Katak chegarasidagi taroq — pastda ham, TEPADA ham chiziladi,
          shunda takrorlanganda naqsh uzilmaydi. */}
      <path d={taroq(W * 0.5, H * 0.99, 46, 18)} fill={p.light} />
      <path d={taroq(W * 0.5, -H * 0.01, 46, 18)} fill={p.light} />
    </g>
  );

  return (
    <div aria-hidden className={`relative overflow-hidden ${className}`} style={style}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={`abr-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={vertical ? '0.035 0.008' : '0.008 0.035'}
              numOctaves="4"
              seed={seed}
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={11}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <pattern
            id={`cloth-${uid}`}
            patternUnits="userSpaceOnUse"
            width={tw}
            height={th}
            viewBox={`0 0 ${vertical ? W : H} ${vertical ? H : W}`}
          >
            {/* Yotiq holat: W×H katak 90° burilib H×W bo'ladi.
                ⚠️ `translate` BURILISHDAN OLDIN yozilishi shart
                (SVG chapdan o'ngga qo'llaydi): `rotate(90) translate(...)`
                deb yozilganda nuqtalar manfiy X ga tushib, kataklar
                orasida oq yo'l qolardi — o'lchab ko'rildi. */}
            {vertical ? content : <g transform={`translate(0 ${W}) rotate(-90)`}>{content}</g>}
          </pattern>

          {/* TO'QUV — tik iplar: yaqindan sezilsin, uzoqdan bilinmasin. */}
          <pattern
            id={`warp-${uid}`}
            patternUnits="userSpaceOnUse"
            width={vertical ? 3 : 200}
            height={vertical ? 200 : 3}
          >
            <rect
              width={vertical ? 1 : 200}
              height={vertical ? 200 : 1}
              fill="#000"
              opacity="0.12"
            />
          </pattern>

          <linearGradient
            id={`sheen-${uid}`}
            x1="0"
            y1="0"
            x2={vertical ? '1' : '0'}
            y2={vertical ? '0' : '1'}
          >
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="26%" stopColor="#fff" stopOpacity="0.30" />
            <stop offset="44%" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="62%" stopColor="#000" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.30" />
          </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill={`url(#cloth-${uid})`} />
        <rect width="100%" height="100%" fill={`url(#warp-${uid})`} />
        {/* IPAK NURI — busiz mato bosma qog'ozdek yassi ko'rinadi. */}
        {sheen && <rect width="100%" height="100%" fill={`url(#sheen-${uid})`} />}
      </svg>
    </div>
  );
}

/**
 * INGICHKA ATLAS CHEKKASI — jiyak.
 *
 * 🔴 NEGA ALOHIDA KOMPONENT (egasi, 2026-08-30: «boshida g'alati ko'k
 * chiziq turibdi»).
 *
 * Ilgari bu `AtlasCloth` ning ingichka bo'lagi edi. Xato aniq: 6
 * pikselli chiziqda 36 pikselli katakning ATIGI BIR RANGI ko'rinardi
 * — natijada sahifaning eng tepasida tushunarsiz to'q ko'k chiziq
 * turardi. Bodom naqshi bu balandlikda umuman ko'rinmaydi.
 *
 * Jiyak boshqacha ishlaydi: unda ranglar chiziq BO'YLAB teriladi,
 * ya'ni qanchalik ingichka bo'lmasin, hamma rang ko'rinadi. Chekkasi
 * esa o'sha abr sizishi bilan — ya'ni bu baribir atlas, chizilgan
 * chiziq emas.
 */
export function AtlasEdge({
  className = '',
  palette = 0,
  seed = 3,
}: {
  className?: string;
  palette?: number;
  seed?: number;
}) {
  const uid = React.useId().replace(/:/g, '');
  const p = PALETTES[Math.abs(palette) % PALETTES.length];

  // Jiyak termasi: kengliklar notekis, oq oraliqlar ingichka.
  const bands: { c: string; w: number }[] = [
    { c: p.ground, w: 13 },
    { c: p.light, w: 3 },
    { c: p.motif, w: 10 },
    { c: p.core, w: 6 },
    { c: p.light, w: 2 },
    { c: p.accent, w: 9 },
    { c: p.ground, w: 5 },
    { c: p.light, w: 2 },
  ];
  const unit = bands.reduce((a, b) => a + b.w, 0);

  const cells = bands.reduce<{ c: string; x: number; w: number }[]>((acc, b) => {
    const x = acc.length ? acc[acc.length - 1].x + acc[acc.length - 1].w : 0;
    acc.push({ c: b.c, x, w: b.w });
    return acc;
  }, []);

  return (
    <div aria-hidden className={`overflow-hidden ${className}`}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={`jiyak-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.06 0.3"
              numOctaves="3"
              seed={seed}
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale="3.5"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <pattern id={`edge-${uid}`} patternUnits="userSpaceOnUse" width={unit} height="40">
            <g filter={`url(#jiyak-${uid})`}>
              {cells.map((c) => (
                // Balandlik katakdan TASHQARIGA chiqadi: filtr surganda
                // chekkada bo'shliq ochilmasin.
                <rect key={c.x} x={c.x} y={-8} width={c.w} height={56} fill={c.c} />
              ))}
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#edge-${uid})`} />
      </svg>
    </div>
  );
}
