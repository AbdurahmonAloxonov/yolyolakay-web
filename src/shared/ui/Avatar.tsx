'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { User as UserIcon, Check } from 'lucide-react';
import { mediaUrl } from '@/shared/lib/mediaUrl';
import { SuzaniSeal } from '@/shared/ui/brand/SuzaniSeal';

/**
 * Foydalanuvchi avatari — rasm bo'lsa rasm, bo'lmasa ism bosh harflari, ism ham
 * bo'lmasa ikonka. UI bo'ylab bitta ko'rinish bo'lishi uchun shu komponent.
 *
 * next/image ATAYIN emas: media hosti oldindan noma'lum (POST /media/upload
 * istalgan domen berishi mumkin), next.config'da `images.remotePatterns` yo'q —
 * next/image bunday URL'da 400 beradi va avatar umuman ko'rinmaydi.
 */
export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  /** Diametr (px) — 36 (header), 56/80 (profil) */
  size?: number;
  className?: string;
  /** Rasm YO'Q bo'lsa shu id/ismdan suzani muhri (ilova bilan bir xil). */
  seed?: string | null;
  /**
   * Tasdiqlangan foydalanuvchi — avatar atrofida turkuaz "ishonch halqasi"
   * va kichik belgi.
   *
   * ⚠️ 07.09.2026: ilgari bu «MyID tasdig'i» deb atalardi va ekran o'qigich
   * ham AYNAN «MyID» deb o'qirdi. MyID 22.08.2026 da mahsulotdan olib
   * tashlangan — tasdiq endi hujjat tekshiruvidan keladi. Halqa qoladi,
   * NOMI o'zgardi.
   *
   * Ilovadagi `PersonAvatar(verified:)` bilan BIR XIL ko'rinish: halqa + o'ng
   * pastda belgi. Rang `--turquoise` tokenidan olinadi, shuning uchun neon
   * temada o'zi moslashadi (hardcode rang YOZILMAYDI — dizayn qoidasi).
   */
  verified?: boolean;
}

const initialsOf = (name?: string | null): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return '';
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 40,
  className = '',
  seed,
  verified = false,
}) => {
  const t = useTranslations('Common');
  // Havola buzuq bo'lsa (media o'chirilgan/CORS) — bosh harflarga qaytamiz.
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);

  // 🔴 Manzilni SHU YERDA to'liqlashtiramiz, chaqiruvchilarda emas: backend
  // nisbiy yo'l (`/uploads/x.jpg`) qaytarganda u sayt domeniga nisbatan
  // ochilib 404 berardi va avatar hamma joyda jimgina bosh harflarga
  // aylanardi. Bitta joyda tuzatilsa — hamma ekran birdan tuzaladi.
  const resolved = mediaUrl(src);

  const initials = initialsOf(name);
  const showImage = !!resolved && !failed;

  const circle = (
    <div
      style={{ width: size, height: size }}
      className={`shrink-0 overflow-hidden rounded-full border border-accent/20 bg-brand-pink-light dark:bg-accent/10 text-accent flex items-center justify-center ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved as string}
          alt={name || ''}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (seed ?? name) ? (
        // Rasm yo'q — ilova bilan bir xil suzani muhri (id/ismdan).
        <SuzaniSeal seed={(seed ?? name) as string} size={size} />
      ) : initials ? (
        <span
          className="font-extrabold leading-none"
          style={{ fontSize: Math.max(11, Math.round(size * 0.38)) }}
        >
          {initials}
        </span>
      ) : (
        <UserIcon style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </div>
  );

  if (!verified) return circle;

  // Halqa avatarni O'RAYDI (ustiga chizilmaydi): ichki `p-[2px]` tufayli
  // rasm bilan halqa orasida nafas qoladi — ilovadagi bilan bir xil.
  // Belgi doiradan tashqariga chiqadi, shuning uchun tashqi o'ram
  // `overflow-hidden` BO'LMASLIGI shart (aks holda kesilib qolardi).
  const badge = Math.max(12, Math.round(size * 0.34));
  return (
    <span className="relative inline-flex shrink-0 rounded-full border-2 border-turquoise p-[2px]">
      {circle}
      <span
        aria-hidden
        style={{ width: badge, height: badge }}
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-white bg-turquoise text-white"
      >
        <Check style={{ width: badge * 0.62, height: badge * 0.62 }} strokeWidth={3} />
      </span>
      <span className="sr-only">{t('verified')}</span>
    </span>
  );
};
