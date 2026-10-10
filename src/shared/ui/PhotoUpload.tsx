'use client';

import React from 'react';
import { toast } from 'sonner';
import { Camera, Loader2, X, Check } from 'lucide-react';
import { uploadMedia } from '@/shared/api/media';
import { useTr } from '@/shared/lib/useTr';

/**
 * Rasm yuklash maydoni (texpasport surati va shunga o'xshashlar uchun).
 *
 * `POST /media/upload` URL qaytaradi, chaqiruvchi shu URL'ni o'z so'rovida
 * (`tech_passport_photo`) yuboradi. Ya'ni bu komponent FAQAT fayl -> URL
 * ishini bajaradi, saqlashni chaqiruvchi hal qiladi.
 *
 * Nega alohida komponent: texpasport ikki joyda so'raladi — haydovchi
 * bo'lishdagi onboarding va profildagi "mashina qo'shish". Ikki nusxa forma
 * bo'lsa, biri tuzatilib ikkinchisi eskirib qolardi.
 */
export function PhotoUpload({
  label,
  hint,
  hints,
  value,
  onChange,
  disabled = false,
  maxMb = 5,
  live = false,
  frontCamera = false,
}: {
  label: string;
  hint?: string;
  /**
   * TALABLAR ro'yxati — qanday suratga olish kerak.
   *
   * 🔴 NEGA KERAK: rad etishlarning aksariyati uch sababdan — xira surat,
   * kesilgan burchak, aks etgan yorug'lik. Tekshiruvchi rad etadi, odam
   * esa NEGA rad etilganini bilmaydi va yana o'shanday yuboradi.
   * Talabni YUKLASHDAN OLDIN aytish qayta yuborishlar sonini kamaytiradi.
   *
   * `hint` dan farqi: u bitta jumla, bu esa tekshiriladigan ro'yxat.
   */
  hints?: string[];
  /** Yuklangan rasm URL'i ('' = yo'q). */
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  /**
   * Surat AYNI PAYTDA olinsin (egasi, 2026-08-28).
   *
   * 🔴 NEGA: galereya ochiq qolsa, odam internetdan olingan yoki boshqa
   * odamning hujjatini yuklashi mumkin — moderatsiya buni surat
   * sifatidan ajrata olmaydi.
   *
   * ⚠️ HALOL CHEGARA: `capture` faqat TELEFON brauzerida kamerani
   * to'g'ridan-to'g'ri ochadi. Kompyuterda brauzer buni e'tiborsiz
   * qoldiradi va odatdagi fayl tanlash oynasi chiqadi — veb-standart
   * bunga boshqa yo'l bermaydi. Ilovada esa cheklov QAT'IY
   * (`liveOnly` -> `ImageSource.camera`).
   */
  live?: boolean;
  /** Selfi uchun old kamera; hujjat va mashinada orqasi. */
  frontCamera?: boolean;
  maxMb?: number;
}) {
  const tr = useTr();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Inputni DARHOL tozalaymiz — bir xil faylni qayta tanlaganda `change` otilsin.
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(tr('Faqat rasm fayli', 'Только изображение', 'Images only'));
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(
        tr(
          `Rasm ${maxMb} MB dan katta`,
          `Изображение больше ${maxMb} МБ`,
          `The image is larger than ${maxMb} MB`
        )
      );
      return;
    }

    setBusy(true);
    try {
      const media = await uploadMedia(file);
      if (!media?.url) throw new Error('NO_URL');
      onChange(media.url);
    } catch {
      toast.error(
        tr(
          "Rasmni yuklab bo'lmadi. Qayta urinib ko'ring",
          'Не удалось загрузить изображение. Попробуйте ещё раз',
          'Could not upload the image. Please try again'
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-1.5 text-left">
      <span className="text-sm font-bold text-text-muted select-none">{label}</span>

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
          {/* Yuklangan surat — foydalanuvchi to'g'ri fayl tanlaganini KO'RSIN
              (moderatsiya o'qiy olmaydigan surat sabab rad etilishi mumkin).
              `next/image` EMAS: media backend domeni `next.config` da ro'yxatga
              olinmagan va u backend URL'i o'zgarganda jimgina yiqilardi —
              Avatar komponenti ham shu sababdan oddiy <img> ishlatadi. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-40 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={disabled || busy}
            aria-label={tr('Rasmni olib tashlash', 'Удалить изображение', 'Remove the image')}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:text-error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className="flex min-h-[96px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-surface px-4 py-4 text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          <span className="text-sm font-bold">
            {busy
              ? tr('Yuklanmoqda...', 'Загрузка...', 'Uploading...')
              : tr('Suratni yuklash', 'Загрузить фото', 'Upload a photo')}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // Telefonda kamerani to'g'ridan-to'g'ri ochadi (izohi `live` da).
        capture={live ? (frontCamera ? 'user' : 'environment') : undefined}
        onChange={pick}
        className="hidden"
      />
      {hints && hints.length > 0 && (
        <ul className="space-y-1">
          {hints.map((item) => (
            <li
              key={item}
              className="flex items-start gap-1.5 text-[11px] leading-snug text-text-muted"
            >
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent" strokeWidth={3} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {hint && <span className="text-[11px] leading-snug text-text-muted">{hint}</span>}
    </div>
  );
}
