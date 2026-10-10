import React from 'react';

/**
 * O'ZBEK NAQSHLARI — dizayn tili, bezak emas.
 *
 * 🔴 NEGA YOZILDI (egasi, 2026-08-30): «milliylashtirish deganda faqat
 * atlasni tushunasanmi? naqshlar bor o'zbekona, topda uyg'unlashtir.
 * Gap bilan bo'lmasin ishlarimiz».
 *
 * To'g'ri tanqid. Birinchi urinishda men milliylikni MATNGA solib
 * qo'ygandim — atlas haqida chiroyli xatboshi yozib, dizaynni esa
 * o'sha shablon holida qoldirgandim. Naqsh esa o'qish uchun emas,
 * KO'RISH uchun.
 *
 * Bu faylda uchta haqiqiy naqsh bor va ularning har biri sahifada
 * TUZILMAVIY vazifa bajaradi, fon bo'lib yotmaydi:
 *
 *   • GIRIH   — Registon, Shohi Zinda peshtoqlaridagi geometrik
 *               to'r. Sahifa zamini shundan.
 *   • PAXTA   — paxta guli, o'zbek naqshining eng tanish belgisi.
 *               Ro'yxat nuqtalari va bo'lim belgisi shundan.
 *   • PESHTOQ — madrasa ravog'i. Suratlar shu shaklda kesiladi.
 *
 * ⚠️ Hammasi BITTA qoidaga bo'ysunadi: naqsh mazmunni bosmaydi.
 * Zaminda quyuqlik 0.04 dan oshmaydi, ravoq esa suratni kesadi —
 * ustiga chiqmaydi.
 */

/* ══════════════════════════════════════════════════════════════════
   GIRIH — HAQIQIY O'RALGAN TASMA (khatam).

   🔴 NEGA QAYTA YOZILDI (egasi, 2026-08-31: «san o'zbek naqshlarini
   olmagansan, shunchaki yulduz chizib qo'yibsan»).

   To'g'ri tanqid edi. Men sakkiz nurli KO'PBURCHAK chizgandim — bu
   yulduzning SILUETI, girih emas.

   Haqiqiy girihda yulduz umuman «chizilmaydi». U TASMALARNING
   KESISHUVIDAN kelib chiqadi:

     • naqsh uzluksiz TASMALARDAN yig'iladi (chiziq emas, ENI BOR
       lenta — shuning uchun har lentaning ikkita qirrasi bo'ladi);
     • tasmalar bir-birining goh USTIDAN, goh OSTIDAN o'tadi
       («o'ralish») — mana shu girihni girih qiladi;
     • yulduz — shu o'ralishlar orasida QOLGAN bo'shliq.

   Shuning uchun bu yerda:
     1. tasma ikki marta chiziladi — avval ZAMIN rangida keng
        («kesim»), keyin ustidan ingichka rang. Kesim pastdan
        o'tayotgan tasmani uzib ko'rsatadi;
     2. chizish TARTIBI almashib boradi, ya'ni A tasma B ning goh
        ustida, goh ostida qoladi.

   Naqshning o'zi — Temuriylar davrining «xatam» tuguni: markazda
   sakkizburchak, undan to'rt tomonga tasma ketadi va qo'shni
   katakdagi tugun bilan qo'shiladi. Registon va Shohi Zinda
   panjaralarida aynan shu.
   ══════════════════════════════════════════════════════════════════ */

/** Sakkizburchak tuguni — burchaklari (aylana bo'ylab 8 nuqta). */
function knot(cx: number, cy: number, r: number): [number, number][] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

const poly = (pts: [number, number][]) =>
  pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/**
 * Bitta katakning tasmalari. Har biri alohida yo'l — shunda ularni
 * navbat bilan «ustidan/ostidan» chizish mumkin.
 */
function girihStraps(S: number) {
  const R = S * 0.27;
  const c = S / 2;

  // Markaziy va burchak tugunlari — burchakdagilari qo'shni katak
  // bilan birlashib butun tugun hosil qiladi (naqsh cheksiz davom
  // etadi, girihning butun siri shunda).
  const knots: string[] = [
    poly(knot(c, c, R)),
    poly(knot(0, 0, R)),
    poly(knot(S, 0, R)),
    poly(knot(0, S, R)),
    poly(knot(S, S, R)),
  ];

  // Bog'lovchi tasmalar: markaziy tugundan burchak tugunlariga —
  // diagonal bo'ylab. Aynan shular kesishib yulduzni «ochadi».
  const d = R * 0.7071;
  const links: string[] = [
    `M${c - d} ${c - d} L${d} ${d}`,
    `M${c + d} ${c - d} L${S - d} ${d}`,
    `M${c - d} ${c + d} L${d} ${S - d}`,
    `M${c + d} ${c + d} L${S - d} ${S - d}`,
    // O'q bo'ylab tasmalar — qo'shni katakka o'tadi.
    `M${c} ${c - R} L${c} ${-R}`,
    `M${c} ${c + R} L${c} ${S + R}`,
    `M${c - R} ${c} L${-R} ${c}`,
    `M${c + R} ${c} L${S + R} ${c}`,
  ];

  return { knots, links };
}

/**
 * GIRIH NAQSHI — o'ralgan tasma.
 *
 * [relief] — yorug' zamin uchun ganch o'ymasi rejimi: tasma rang
 * bilan emas, soya va qirra bilan ko'rinadi (izohi pastda).
 */
export function GirihPattern({
  className = '',
  color = 'currentColor',
  opacity = 1,
  size = 128,
  relief = false,
}: {
  className?: string;
  color?: string;
  opacity?: number;
  /** Bitta tugun katagi (piksel). Naqsh cho'zilmaydi, takrorlanadi. */
  size?: number;
  /**
   * 🔴 GANCH REJIMI — yorug' zamin uchun.
   *
   * Oq devorda naqshni quyuqlashtirish matnga raqib bo'ladi. Buxoro
   * va Samarqand ichki devorlarida ganch OQ ustiga OQ o'yiladi va u
   * RANG bilan emas, YORUG'LIK bilan ko'rinadi: o'yiq chetida soya,
   * qirrasida yorug' chiziq.
   *
   * ⚠️ Ranglar TOKENDAN (`--ganch-*`, `landing.css`): qotirib
   * yozilganda tungi rejimda oq to'r butun sahifani qoplab, matn
   * o'qilmay qolgandi.
   */
  relief?: boolean;
}) {
  const uid = React.useId().replace(/:/g, '');
  const S = 100;
  const { knots, links } = girihStraps(S);

  /** Tasmaning bir qatlami: `cut` — pastdan o'tayotganini uzadi. */
  const layer = (
    stroke: string,
    w: number,
    dx = 0,
    dy = 0,
    order: 'knots-first' | 'links-first' = 'links-first'
  ) => {
    const K = (
      <g key="k">
        {knots.map((pts, n) => (
          <polygon key={n} points={pts} />
        ))}
      </g>
    );
    const L = (
      <g key="l">
        {links.map((d, n) => (
          <path key={n} d={d} />
        ))}
      </g>
    );
    return (
      <g
        fill="none"
        stroke={stroke}
        strokeWidth={w}
        strokeLinejoin="miter"
        strokeLinecap="butt"
        transform={`translate(${dx} ${dy})`}
      >
        {order === 'links-first' ? [L, K] : [K, L]}
      </g>
    );
  };

  /**
   * Bitta to'liq naqsh: KESIM + TASMA, ikki bosqichda.
   *
   * 1-bosqich: bog'lovchi tasmalar chiziladi, so'ng tugunlar KENG
   *   zamin rangi bilan «kesib» o'tadi va o'z rangida chiziladi —
   *   ya'ni tugun bog'lovchining USTIDA.
   * 2-bosqich: teskarisi — bog'lovchi tugunning ustidan o'tadi.
   * Natijada tasmalar goh ustidan, goh ostidan o'tadi: o'ralish.
   */
  const weave = (band: string, cut: string, w: number, dx = 0, dy = 0) => (
    <>
      {layer(cut, w * 2.6, dx, dy, 'links-first')}
      {layer(band, w, dx, dy, 'links-first')}
      {/* Tugunlar ustidan qayta o'tadi — kesim bilan birga. */}
      <g transform={`translate(${dx} ${dy})`}>
        <g fill="none" stroke={cut} strokeWidth={w * 2.6}>
          {knots.map((pts, n) => (
            <polygon key={`c${n}`} points={pts} />
          ))}
        </g>
        <g fill="none" stroke={band} strokeWidth={w} strokeLinejoin="miter">
          {knots.map((pts, n) => (
            <polygon key={`b${n}`} points={pts} />
          ))}
        </g>
      </g>
    </>
  );

  const d = 1.2;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={`girih-${uid}`}
            patternUnits="userSpaceOnUse"
            width={size}
            height={size}
            viewBox={`0 0 ${S} ${S}`}
          >
            {relief ? (
              <>
                {/* O'yiq soyasi va yorug' qirrasi — ganch. */}
                {weave('var(--ganch-shadow)', 'transparent', 1.7, d, d)}
                {weave('var(--ganch-light)', 'transparent', 1.7, -d, -d)}
                {weave('var(--ganch-core)', 'var(--ganch-cut)', 1.5)}
              </>
            ) : (
              weave(color, 'var(--girih-cut)', 1.5)
            )}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#girih-${uid})`} />
      </svg>
    </div>
  );
}

/** Ganch o'ymasi — yorug' zamin uchun `GirihPattern` ning qulay nomi. */
export function GanchPattern({
  className = '',
  size = 128,
  depth = 1,
}: {
  className?: string;
  size?: number;
  /** Relyef kuchi: bo'limga qarab sozlanadi. */
  depth?: number;
}) {
  return <GirihPattern className={className} size={size} relief opacity={depth} />;
}

/* ══════════════════════════════════════════════════════════════════
   PAXTA GULI — ochilgan ko'sak.

   O'zbek naqshining eng tanish belgisi: beshta yumaloq barg va
   o'rtada urug'. Ro'yxat nuqtasi, bo'lim belgisi va tugma
   bezagi sifatida ishlatiladi — ya'ni sahifa bo'ylab TAKRORLANIB,
   uni bir butun qiladi.
   ══════════════════════════════════════════════════════════════════ */
export function Pakhta({
  className = '',
  color = 'currentColor',
  petals = 5,
}: {
  className?: string;
  color?: string;
  petals?: number;
}) {
  const R = 34;
  const petalR = 21;
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: petals }, (_, i) => {
        const rad = (2 * Math.PI * i) / petals - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={50 + R * Math.cos(rad)}
            cy={50 + R * Math.sin(rad)}
            r={petalR}
            fill={color}
          />
        );
      })}
      {/* Urug' — markazda, fon rangida «o'yiq» bo'lib turadi. */}
      <circle cx="50" cy="50" r="13" fill={color} />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PESHTOQ — madrasa ravog'i.

   🔑 Bu eng kuchli milliy belgi va u BEZAK EMAS, SHAKL: surat shu
   ravoq bo'ylab kesiladi. Registon, Bibixonim, Ko'kaldosh — hammasi
   shu siluetda. Odam uni tushuntirishsiz taniydi.
   ══════════════════════════════════════════════════════════════════ */

/** Ravoq shakli — `clipPath` uchun (0…1 oralig'ida, o'lchamga moslashadi). */
/*
 * 🔴 RAVOQ YUMALOQ EDI — «QABR TOSHI», MADRASA EMAS (2026-09-03).
 *
 * Eski yo'l tepada deyarli TEKIS edi (0.335…0.665 oralig'ida) va
 * shakl hech qanday peshtoqni eslatmasdi. Ilovada bu allaqachon
 * tuzatilgan; sayt esa eski shaklda qolib, bitta mahsulotda IKKI XIL
 * ravoq paydo bo'lgandi.
 *
 * Endi haqiqiy IKKI MARKAZLI uchli ravoq — ilovadagi
 * `pointedArch(spring: 0.62)` bilan AYNAN bir xil:
 *   yon devor 0.62 gacha tik ko'tariladi;
 *   yoy markazlari o'qdan `d = 0.62² − 0.25 = 0.1344` ga suriladi;
 *   radius `0.5 + d = 0.6344`.
 * Markazlar surilmasa yarim doira chiqadi — eski shaklning aybi
 * aynan shu edi.
 *
 * ⚠️ `landing.css` dagi `--peshtoq-mask` NISBATLARI shu bilan bir
 * xil bo'lishi SHART, aks holda hero surati va kartochkalar
 * boshqa-boshqa ravoqli bo'lib qoladi.
 */
export const PESHTOQ_PATH =
  'M0,1 L0,0.62 ' + 'A0.6344,0.6344 0 0 1 0.5,0 ' + 'A0.6344,0.6344 0 0 1 1,0.62 ' + 'L1,1 Z';

/**
 * Ravoq niqobi — bolani (odatda surat) peshtoq shaklida kesadi.
 *
 * `clipPathUnits="objectBoundingBox"` — shakl elementning o'lchamiga
 * o'zi moslashadi, ya'ni bitta ta'rif hamma joyda ishlaydi.
 */
export function PeshtoqFrame({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, '');
  return (
    <div className={`relative ${className}`}>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <clipPath id={`peshtoq-${uid}`} clipPathUnits="objectBoundingBox">
            <path d={PESHTOQ_PATH} />
          </clipPath>
        </defs>
      </svg>
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ clipPath: `url(#peshtoq-${uid})` }}
      >
        {children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BO'LIM BELGISI — paxta guli va ikki yon chizig'i.

   🔴 Ilgari bu yerda atlas bo'lagi turardi. Atlas — MATO, va uni
   sahifaning har bo'limiga qo'yish matoni devor qog'oziga
   aylantirardi. Naqsh esa aynan shu vazifa uchun: u tinish belgisi.
   ══════════════════════════════════════════════════════════════════ */
export function OrnamentMark({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center gap-3 text-brand-pink ${className}`}
    >
      {/* Chiziq — ikki yondan gulga qarab quyuqlashadi. Gul esa
          yetarlicha yirik: 16 piksellik gul «changdek» ko'rinardi. */}
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-current opacity-45 sm:w-20" />
      <Pakhta className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" color="currentColor" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-current opacity-45 sm:w-20" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ISLIMI — o'simlik novdasi.

   Ganch o'ymakorligi va lavhalardagi eng keng tarqalgan naqsh:
   uzluksiz S-egri novda, undan burama barglar va g'unchalar chiqadi.
   Girih GEOMETRIYA bo'lsa, islimi — TIRIKLIK; ikkalasi doim yonma-yon
   ishlatiladi va bir-birini to'ldiradi.

   Bu yerda u BO'LIM AJRATGICHI: chiziq emas, novda.
   ══════════════════════════════════════════════════════════════════ */
export function Islimi({
  className = '',
  color = 'currentColor',
  opacity = 1,
  width = 160,
}: {
  className?: string;
  color?: string;
  opacity?: number;
  /** Bitta takror eni (piksel). Naqsh cho'zilmaydi, takrorlanadi. */
  width?: number;
}) {
  const uid = React.useId().replace(/:/g, '');
  return (
    <div aria-hidden className={`w-full overflow-hidden ${className}`} style={{ opacity }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={`islimi-${uid}`}
            patternUnits="userSpaceOnUse"
            width={width}
            height={width * 0.25}
            viewBox="0 0 160 40"
          >
            <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
              {/* Asosiy novda — uzluksiz to'lqin. */}
              <path d="M0 20 C 20 4, 40 4, 60 20 S 100 36, 120 20 S 150 6, 160 20" />
              {/* Burama barglar — novdaning cho'qqilaridan chiqadi. */}
              <path
                d="M30 9 C 24 2, 34 0, 36 6 C 37 10, 32 12, 30 9 Z"
                fill={color}
                stroke="none"
              />
              <path
                d="M90 31 C 84 38, 94 40, 96 34 C 97 30, 92 28, 90 31 Z"
                fill={color}
                stroke="none"
              />
              {/* G'unchalar */}
              <circle cx="60" cy="20" r="2.6" fill={color} stroke="none" />
              <circle cx="120" cy="20" r="2" fill={color} stroke="none" />
              {/* Yon novdachalar */}
              <path d="M60 20 C 66 12, 74 12, 78 18" />
              <path d="M120 20 C 126 28, 134 28, 138 22" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#islimi-${uid})`} />
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   QO'CHQOR SHOXI — juft burama.

   Chorvador xalq naqshi: kuch va farovonlik belgisi. Gilamda ham,
   so'zanada ham, ganchda ham bor. Bu yerda u RAQAM MEDALYONI bo'lib
   ishlaydi — qadam raqamlari shu shoxlar orasida turadi.
   ══════════════════════════════════════════════════════════════════ */
export function QochqorShox({
  className = '',
  color = 'currentColor',
  opacity = 1,
}: {
  className?: string;
  color?: string;
  opacity?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 60"
      className={className}
      style={{ opacity }}
      fill="none"
      stroke={color}
      strokeWidth="4"
      strokeLinecap="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Chap shox — ichkariga o'ralgan */}
      <path d="M50 52 C 30 52, 12 44, 10 28 C 9 16, 20 10, 27 16 C 33 21, 28 30, 20 28" />
      {/* O'ng shox — nometall aks */}
      <path d="M50 52 C 70 52, 88 44, 90 28 C 91 16, 80 10, 73 16 C 67 21, 72 30, 80 28" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PALAK ROZETKASI — so'zananing markaziy doirasi.

   So'zanadagi eng yirik motiv: quyoshni bildiruvchi doira, atrofida
   ikki qator barg. Sahifada u KATTA VA XIRA — «suv belgisi» bo'lib
   turadi, ya'ni mazmun ostidan sezilib turadigan mato.
   ══════════════════════════════════════════════════════════════════ */
export function PalakRosette({
  className = '',
  color = 'currentColor',
  opacity = 0.08,
}: {
  className?: string;
  color?: string;
  opacity?: number;
}) {
  const outer = 16;
  const inner = 10;
  const petal = (i: number, n: number, r: number, rx: number, ry: number) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return (
      <ellipse
        key={`${n}-${i}`}
        cx={100 + r * Math.cos(a)}
        cy={100 + r * Math.sin(a)}
        rx={rx}
        ry={ry}
        transform={`rotate(${(360 * i) / n} ${100 + r * Math.cos(a)} ${100 + r * Math.sin(a)})`}
      />
    );
  };
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className={className}
      style={{ opacity }}
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Tashqi barg qatori */}
      {Array.from({ length: outer }, (_, i) => petal(i, outer, 78, 9, 20))}
      {/* Ichki barg qatori */}
      {Array.from({ length: inner }, (_, i) => petal(i, inner, 48, 8, 16))}
      {/* Markaz — quyosh */}
      <circle cx="100" cy="100" r="22" />
      <circle cx="100" cy="100" r="12" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI / 4) * i;
        return (
          <line
            key={`ray-${i}`}
            x1={100 + 12 * Math.cos(a)}
            y1={100 + 12 * Math.sin(a)}
            x2={100 + 22 * Math.cos(a)}
            y2={100 + 22 * Math.sin(a)}
          />
        );
      })}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MUQARNAS — asal uyasi ravoqcha.

   Peshtoq ostidagi «stalaktit» qatorlari: har qator kichik ravoqlardan
   iborat va pastga qarab siljib boradi. Bu Registon, Bibixonim va
   Sherdorning eng tanish tafsiloti.

   Bo'limlar orasidagi O'TISH sifatida ishlatiladi: bir zamindan
   ikkinchisiga o'tishda tekis chiziq emas, ravoqchalar qatori bo'ladi.
   ══════════════════════════════════════════════════════════════════ */
export function Muqarnas({
  className = '',
  color = 'currentColor',
  cell = 44,
  flip = false,
}: {
  className?: string;
  color?: string;
  /** Bitta ravoqcha eni (piksel). */
  cell?: number;
  /** Pastga qaragan holat (bo'lim TEPASIDA). */
  flip?: boolean;
}) {
  const uid = React.useId().replace(/:/g, '');
  return (
    <div
      aria-hidden
      className={`w-full overflow-hidden ${className}`}
      style={flip ? { transform: 'scaleY(-1)' } : undefined}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={`muq-${uid}`}
            patternUnits="userSpaceOnUse"
            width={cell}
            height={cell * 0.75}
            viewBox="0 0 40 30"
          >
            {/* Pastki qator — to'la ravoqchalar */}
            <path d="M0 30 L0 16 C0 6 8 0 20 0 C32 0 40 6 40 16 L40 30 Z" fill={color} />
            {/* Yuqori qator — yarim ravoqchalar, siljigan */}
            <path
              d="M-20 30 L-20 20 C-20 12 -13 8 0 8 C13 8 20 12 20 20 L20 30 Z"
              fill={color}
              opacity="0.55"
            />
            <path
              d="M20 30 L20 20 C20 12 27 8 40 8 C53 8 60 12 60 20 L60 30 Z"
              fill={color}
              opacity="0.55"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#muq-${uid})`} />
      </svg>
    </div>
  );
}
