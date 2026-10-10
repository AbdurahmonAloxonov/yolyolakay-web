import { ImageResponse } from 'next/og';

import { fetchRideForMetadata } from '@/shared/api/server/rides';
import { asLang, pickFor, trFor, type Lang, intlTag } from '@/shared/lib/i18n';

/**
 * SAFAR KARTOCHKASI — Telegramga tashlangan havolaning RASMI.
 *
 * 🔴 NEGA YOZILDI (08.09.2026): `/uz/trip/{id}` ilgari ildizdagi
 * `[locale]/opengraph-image.tsx` ni MEROS qilib olardi, ya'ni ming
 * xil safar havolasi Telegramda BIR XIL umumiy rasm bilan chiqardi.
 * Eng qiziq ma'lumot — qayerdan qayerga, qachon, qancha, nechta joy —
 * kartochkada umuman ko'rinmasdi.
 *
 * O'zbekistonda safar aynan Telegram guruhlarida tarqaladi. Ya'ni bu
 * rasm — bizning eng arzon reklama kanalimiz: har ulashilgan e'lon
 * lentada to'xtatadigan plakatga aylanadi.
 *
 * Ilovadagi juftligi — `lib/features/rides/ride_poster.dart` (u
 * rasmni telefonda chizadi va Telegramga fayl bo'lib ketadi). Ranglar
 * va tuzilish ATAYIN bir xil: bir mahsulotdan ikki xil plakat
 * chiqmasin.
 *
 * ⚠️ FAQAT ROST MA'LUMOT (plakat va `TripPassport` qoidasi bilan bir
 * xil): qiymat kelmasa qator UMUMAN chizilmaydi. «—» belgisi
 * ulashilgan rasmda «ma'lumot buzuq» bo'lib ko'rinadi.
 *
 * ⚠️ Safar topilmasa yoki backend javob bermasa — UMUMIY brend
 * kartochkasi chiziladi, xato emas: havola baribir ochiladi va
 * kartochkasi buzuq rasm bo'lib qolmasligi kerak.
 *
 * ⚠️ Shrift ATAYIN standart (ildizdagi kartochka bilan bir xil
 * qaror): tashqi shrift fayli build'ni tarmoqqa bog'lab qo'yadi.
 */

export const alt = 'YolYolakay';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brend tokenlari (globals.css) — bu yerda qiymat sifatida takrorlanadi,
// chunki ImageResponse CSS o'zgaruvchilarini o'qiy olmaydi.
const WINE_ASH = '#32292f';
const BRAND_PINK = '#c71578';
const TURQUOISE = '#99e1d9';

/**
 * Xonatlasning klassik palitrasi — pastdagi jiyak uchun.
 *
 * Ranglar TEMAGA BOG'LIQ EMAS: atlas — haqiqiy mato va uning rangi
 * tungi rejimda o'zgarmaydi. Ilovadagi `AtlasColors` bilan bir xil.
 */
const ATLAS = ['#a81f2a', '#d08a2c', '#17796f', '#22306b', '#c4157a', '#efe3d2'];

/**
 * Manzilni kartochka uchun qisqartiradi.
 *
 * 🔴 NEGA QO'LDA: Telegram kartochkani KICHIK ko'rsatadi va u yerda
 * «Toshkent shahri, Chilonzor tumani, Bunyodkor ko'chasi» satri
 * o'qilmaydigan mayda yozuvga aylanadi. Vergulgacha bo'lgan qism —
 * odam aytadigan nom («Toshkent»), qolgani manzil tafsiloti.
 *
 * ⚠️ `textOverflow` ISHLATILMAYDI: Satori uni ishonchli qo'llamaydi
 * va matn kartochkadan toshib ketardi.
 */
function shortPlace(raw: string | undefined, max = 22): string {
  const head = (raw || '').split(',')[0].trim();
  if (head.length <= max) return head;
  return `${head.slice(0, max - 1).trimEnd()}…`;
}

/** «9-sentabr, 07:00» — Toshkent vaqtida, serverning zonasidan qat'i nazar. */
function whenLabel(iso: string | undefined, locale: Lang): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // ⚠️ `pickFor` EMAS: u kirill uchun o'zbekcha qiymatni (`uz-UZ`)
  // qaytaradi va kirill sahifada oy nomi lotinda chiqib qolardi.
  const tag = intlTag(locale);
  try {
    return new Intl.DateTimeFormat(tag, {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tashkent',
    }).format(d);
  } catch {
    return null;
  }
}

/**
 * Narx — bo'sh joy bilan ajratilgan («80 000»).
 *
 * `Intl.NumberFormat` ATAYIN emas: u tilga qarab uzuq bo'shliq
 * (U+202F) qo'yadi va Satori uni ba'zan kvadrat qilib chizadi.
 */
function priceLabel(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Pastdagi atlas jiyagi — ilovadagi `AtlasEdge` ning yassi ko'rinishi.
 *
 * 🔴 BIRINCHI URINISH SHASHKA TAXTASI BO'LIB CHIQDI (o'z xatom, ko'z
 * bilan ko'rildi): `i * 3 + i % 2` formulasi olti rangdan atigi
 * IKKITASINI aylantirardi va jiyak «qizil-pushti katak» bo'lib
 * qolgandi — matoga umuman o'xshamasdi.
 *
 * Atlasda bo'lak kengligi ham, rang tartibi ham TENG EMAS. Shuning
 * uchun ritm qo'lda yozilgan: rang indeksi + og'irligi. Tasodif
 * ISHLATILMAYDI — har build'da bir xil chiqishi kerak.
 */
const ATLAS_RHYTHM: Array<[number, number]> = [
  [0, 5],
  [5, 1],
  [3, 3],
  [1, 2],
  [2, 4],
  [5, 1],
  [4, 2],
  [1, 1],
  [3, 4],
  [5, 1],
  [0, 2],
  [2, 2],
];

function AtlasEdge() {
  // Uch takror — 1200 px da bo'laklar mato bo'lagidek ko'rinadi,
  // undan ko'p bo'lsa chiziqchalarga aylanib ketadi.
  const cells = [...ATLAS_RHYTHM, ...ATLAS_RHYTHM, ...ATLAS_RHYTHM];
  return (
    <div style={{ display: 'flex', width: '100%', height: 16 }}>
      {cells.map(([color, weight], i) => (
        <div key={i} style={{ flexGrow: weight, height: '100%', background: ATLAS[color] }} />
      ))}
    </div>
  );
}

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function Image({ params }: Props) {
  const { locale: rawLocale, id } = await params;
  const locale = asLang(rawLocale);
  const tr = trFor(locale);

  const result = await fetchRideForMetadata(id);
  const ride = result.kind === 'ok' ? result.ride : null;

  const from = shortPlace(ride?.origin_address);
  const to = shortPlace(ride?.destination_address);
  const when = whenLabel(ride?.departure_time, locale);
  const price = priceLabel(ride?.price_per_seat);
  const seats = typeof ride?.available_seats === 'number' ? ride.available_seats : null;
  const womenOnly = ride?.gender_restriction === 'female';

  // Yo'nalishsiz plakatning ma'nosi yo'q — o'shanda umumiy brend
  // kartochkasi chiziladi (izohi fayl boshida).
  const hasRoute = !!from && !!to;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: WINE_ASH,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          padding: '48px 72px 36px 72px',
        }}
      >
        {/* Brend qatori */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: BRAND_PINK }} />
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', letterSpacing: 5 }}>
            YOL YOLAKAY
          </div>
        </div>

        {hasRoute ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%' }}>
            {/*
                CHAP: yo'nalish — kartochkadagi eng katta yozuv.

                🔴 BIRINCHI URINISHDA IKKI SHAHAR BOG'LANMAGANDI (ko'z
                bilan ko'rildi): ular orasida qisqa bezak chiziq turardi
                va kartochka «ikkita alohida so'z» bo'lib o'qilardi.
                Endi chapda YO'L RELSI bor — bo'sh doira (jo'nash) va
                to'la doira (manzil) ustundagi chiziq bilan bog'langan.
                Bu shakl tushuntirishsiz o'qiladi.
              */}
            <div style={{ display: 'flex', flex: 1, paddingRight: 40 }}>
              {/* Rels — matn qatorlarining o'rtasiga to'g'rilangan */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: 26,
                  paddingRight: 26,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    border: `5px solid ${TURQUOISE}`,
                  }}
                />
                <div
                  style={{
                    width: 5,
                    height: 62,
                    background: 'rgba(153,225,217,0.45)',
                  }}
                />
                <div style={{ width: 22, height: 22, borderRadius: 11, background: TURQUOISE }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 64, fontWeight: 800, color: '#ffffff', lineHeight: 1.15 }}>
                  {from}
                </div>
                <div
                  style={{
                    fontSize: 64,
                    fontWeight: 800,
                    color: '#ffffff',
                    lineHeight: 1.15,
                    paddingTop: 20,
                  }}
                >
                  {to}
                </div>
                {when && (
                  <div style={{ fontSize: 34, color: 'rgba(255,255,255,0.72)', paddingTop: 22 }}>
                    {when}
                  </div>
                )}
              </div>
            </div>

            {/* O'NG: narx — odam aynan shuni qidiradi */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                textAlign: 'right',
              }}
            >
              {price && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <div style={{ fontSize: 76, fontWeight: 900, color: TURQUOISE }}>{price}</div>
                  <div style={{ fontSize: 34, color: TURQUOISE }}>{tr("so'm", 'сум', 'UZS')}</div>
                </div>
              )}
              {seats !== null && seats > 0 && (
                <div style={{ fontSize: 34, color: 'rgba(255,255,255,0.72)', paddingTop: 6 }}>
                  {tr(`${seats} joy bor`, `мест: ${seats}`, `${seats} seats`)}
                </div>
              )}
              {womenOnly && (
                <div
                  style={{
                    display: 'flex',
                    marginTop: 18,
                    padding: '8px 20px',
                    borderRadius: 999,
                    border: `2px solid ${BRAND_PINK}`,
                    fontSize: 26,
                    color: '#ffffff',
                  }}
                >
                  {tr('Faqat ayollar', 'Только женщины', 'Women only')}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Safar topilmadi — umumiy brend kartochkasi (izohi fayl boshida) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                fontSize: 68,
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.15,
                maxWidth: 900,
              }}
            >
              {tr(
                "O'zbekiston bo'ylab hamroh topish",
                'Поиск попутчиков по Узбекистану',
                'Carpooling across Uzbekistan'
              )}
            </div>
            <div style={{ fontSize: 34, color: TURQUOISE, maxWidth: 900 }}>
              {tr(
                "Yo'l xarajatini bo'ling — komissiyasiz",
                'Делите расходы на дорогу — без комиссии',
                'Split the travel costs — no commission'
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 96, height: 6, borderRadius: 3, background: BRAND_PINK }} />
          <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.72)' }}>yolyolakay.co.uz</div>
        </div>
      </div>

      <AtlasEdge />
    </div>,
    size
  );
}
