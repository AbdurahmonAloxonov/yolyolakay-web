'use client';

import { LocateFixed } from 'lucide-react';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { trFor } from '@/shared/lib/i18n';
import { reverseGeocode } from '@/shared/lib/geo';

// Leaflet SSR'ni ko'tarmaydi (`window`) — faqat brauzerда yuklaymiz.
const MapPickerInner = dynamic(() => import('./MapPickerInner'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-bg-soft animate-pulse" />,
});

interface MapPickerProps {
  label?: string;
  defaultLocation?: [number, number]; // [lat, lon]
  onChange: (coords: [number, number], address: string) => void;
  className?: string;
}

/**
 * Joy tanlash xaritasi — OSM (Leaflet). 🔴 Egasi (2026-08-20): Yandex OLIB
 * TASHLANDI, OSM ishlatiladi (ilova bilan bir manba). Nuqta -> manzil matni
 * OSM Nominatim reverse orqali (`reverseGeocode`), topilmasa koordinata
 * matni (foydalanuvchi tahrirlashi mumkin).
 */
export const MapPicker: React.FC<MapPickerProps> = ({
  label,
  defaultLocation = [41.311081, 69.240562], // Toshkent
  onChange,
  className = '',
}) => {
  const locale = useLocale();
  const tr = trFor(locale);
  const [coords, setCoords] = useState<[number, number]>(defaultLocation);
  const [address, setAddress] = useState<string>('');

  const pick = async (next: [number, number]) => {
    setCoords(next);
    const addr = await reverseGeocode(next[0], next[1]);
    setAddress(addr);
    onChange(next, addr);
  };

  const autoLocate = () => {
    if (!navigator.geolocation) {
      toast.error(
        tr(
          "Brauzeringiz joylashuvni aniqlashni qo'llab-quvvatlamaydi.",
          'Ваш браузер не поддерживает геолокацию.',
          'Your browser does not support geolocation.'
        )
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => pick([position.coords.latitude, position.coords.longitude]),
      () =>
        toast.error(
          tr(
            "Joylashuvni aniqlab bo'lmadi. Brauzer yoki telefon ruxsatini tekshiring.",
            'Не удалось определить местоположение. Проверьте разрешения браузера или телефона.',
            'Could not determine your location. Check your browser or phone permissions.'
          )
        ),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <span className="text-sm font-semibold text-text-muted">{label}</span>}
      <div className="relative w-full h-[300px] rounded-2xl overflow-hidden border border-border shadow-sm">
        <MapPickerInner coords={coords} onPick={pick} />
        <button
          onClick={autoLocate}
          className="absolute bottom-4 right-4 bg-surface text-text p-3 rounded-full shadow-lg border border-border hover:bg-brand-pink-light dark:hover:bg-accent/10 hover:text-accent transition-colors z-[500] flex items-center justify-center"
          type="button"
          title={tr('Mening joylashuvim', 'Моё местоположение', 'My location')}
          aria-label={tr('Mening joylashuvim', 'Моё местоположение', 'My location')}
        >
          <LocateFixed className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {address && (
        <div className="text-xs text-text-muted mt-1 px-1">
          <span className="font-semibold text-text">
            {tr('Tanlangan:', 'Выбрано:', 'Selected:')}
          </span>{' '}
          {address}
        </div>
      )}
    </div>
  );
};
