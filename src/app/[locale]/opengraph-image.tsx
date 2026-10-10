import { ImageResponse } from 'next/og';
import { trFor } from '@/shared/lib/i18n';

/**
 * Ijtimoiy tarmoq kartochkasi rasmi (og:image + twitter:image).
 *
 * Ilgari sayt `twitter:card = summary_large_image` deb E'LON QILARDI, lekin
 * birorta rasm bermasdi — Telegram/WhatsApp/Facebook'da havola bo'sh kartochka
 * bo'lib chiqardi. Bu rasmsiz kartochkadan ham YOMONROQ: yirik joy ajratiladi
 * va bo'sh qoladi.
 *
 * Fayl-konvensiya (`opengraph-image`) ATAYIN tanlandi:
 *   - `<head>` ga og:image ham, twitter:image ham O'ZI ulanadi (metadata'da
 *     `images` qo'lda yozilmaydi — unutilsa yana bo'sh qolardi);
 *   - rasm build paytida generatsiya bo'ladi, `public/` ga binar fayl
 *     qo'shilmaydi va brend rangi o'zgarsa shu yerda o'zgaradi;
 *   - ichki segmentlar (`/search`, `/trip/{id}`) buni MEROS qilib oladi.
 *
 * Shrift ataylab standart — `next/og` ga tashqi shrift faylini yuklash kerak
 * bo'lardi, bu esa build'ni tarmoqqa bog'lab qo'yadi (Fraunces bu yerda arzimaydi).
 */

export const alt = 'YolYolakay';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brend tokenlari (globals.css) — bu yerda qiymat sifatida takrorlanadi, chunki
// ImageResponse CSS o'zgaruvchilarini o'qiy olmaydi.
const WINE_ASH = '#32292f';
const BRAND_PINK = '#c71578';
const TURQUOISE = '#99e1d9';

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tr = trFor(locale);

  const tagline = tr(
    "O'zbekiston bo'ylab hamroh topish",
    'Поиск попутчиков по Узбекистану',
    'Carpooling across Uzbekistan'
  );
  const sub = tr(
    "Arzon, qulay va xavfsiz safarlar — yo'l xarajatini bo'ling",
    'Дёшево, удобно и безопасно — разделите расходы на дорогу',
    'Cheap, comfortable and safe rides — split the travel costs'
  );

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: WINE_ASH,
        padding: '80px 88px',
      }}
    >
      {/* Yuqori chiziq — brend aksenti */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: BRAND_PINK }} />
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: 6,
          }}
        >
          YOL YOLAKAY
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.1,
            maxWidth: 940,
          }}
        >
          {tagline}
        </div>
        <div style={{ fontSize: 36, color: TURQUOISE, maxWidth: 940 }}>{sub}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 120, height: 8, borderRadius: 4, background: BRAND_PINK }} />
        <div style={{ fontSize: 30, color: 'rgba(255,255,255,0.72)' }}>yolyolakay.co.uz</div>
      </div>
    </div>,
    size
  );
}
