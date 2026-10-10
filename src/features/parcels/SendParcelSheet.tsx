'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createParcel } from '@/shared/api/parcels';
import type { ParcelSize } from '@/shared/api/types/parcel';
import { resolveCityCoord } from '@/shared/data/uzCities';
import { forwardGeocode } from '@/shared/lib/geo';
import { tashkentNow } from '@/shared/lib/format';
import { DateField } from '@/shared/ui/DateField';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { CityAutocomplete } from '@/shared/ui/CityAutocomplete';
import { useTr } from '@/shared/lib/useTr';

/**
 * "Posilka yuborish" — `POST /parcels`.
 *
 * 🔴 Nima yetishmasdi: ruchka `shared/api/parcels.ts` da yozilgan edi, LEKIN
 * interfeysda uni chaqiradigan joy YO'Q edi. Ya'ni yo'lovchi "Pochta" bo'limiga
 * kirardi va u yerda faqat "Hozircha posilka yubormagansiz" yozuvi turardi —
 * yuborishning imkoni ham yo'q edi (boshi berk ekran).
 *
 * ✅ 2026-08-13: HAJM, TAVSIF va MUDDAT qo'shildi. Ilgari bu yerda "backend
 * ularni saqlamaydi, shuning uchun so'ramaymiz" deb yozilgandi — bu 2026-08-07
 * dan beri to'g'ri emas edi (`from_address`/`to_address` bilan birga qo'shilgan),
 * mobil ilova esa 08-12 dan beri yuborib turibdi. Ya'ni saytdan joylangan
 * posilka haydovchiga "Toshkent → Samarqand, 50 000 so'm" bo'lib ko'rinardi:
 * u NIMA tashishini bilmasdi va shuning uchun javob bermasdi.
 *
 * Maydonlar tartibi ILOVA bilan bir xil: hajm narxdan OLDIN turadi, chunki
 * odam avval nima yuborayotganini o'ylaydi, keyin necha pul turishini.
 *
 * Koordinata: avval KANONIK shaharlar ro'yxati (qidiruv bilan bir xil manba —
 * shunda posilka haydovchining radius filtriga kafolatli tushadi), topilmasa
 * geokoder.
 */
export function SendParcelSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const tr = useTr();
  const queryClient = useQueryClient();

  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [phone, setPhone] = React.useState('+998');
  const [size, setSize] = React.useState<ParcelSize | null>(null);
  const [description, setDescription] = React.useState('');
  /** YYYY-MM-DD; bo'sh = "muhim emas" (maydon IXTIYORIY). */
  const [deliverBy, setDeliverBy] = React.useState('');

  const reset = () => {
    setFrom('');
    setTo('');
    setPrice('');
    setPhone('+998');
    setSize(null);
    setDescription('');
    setDeliverBy('');
  };

  const cleanPhone = (v: string) => '+' + v.replace(/\D/g, '');
  const phoneOk = /^\+998\d{9}$/.test(cleanPhone(phone));
  const valid = from.trim().length > 1 && to.trim().length > 1 && Number(price) > 0 && phoneOk;

  const mutation = useMutation({
    mutationFn: async () => {
      const origin = resolveCityCoord(from)?.coord ?? (await forwardGeocode(from));
      const dest = resolveCityCoord(to)?.coord ?? (await forwardGeocode(to));
      if (!origin || !dest) throw new Error('NO_COORDS');

      return createParcel({
        origin_lat: origin[0],
        origin_lon: origin[1],
        destination_lat: dest[0],
        destination_lon: dest[1],
        price: Number(price),
        receiver_phone: cleanPhone(phone),
        from_address: resolveCityCoord(from)?.name ?? from.trim(),
        to_address: resolveCityCoord(to)?.name ?? to.trim(),
        // Ixtiyoriylar BO'SH bo'lsa umuman yuborilmaydi (ilovadagi qoida):
        // bo'sh satr "tavsif kiritilgan, lekin bo'sh" degan yolg'on holat
        // yaratardi. Sana kun boshiga UTC'da aylantiriladi.
        ...(size ? { size } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(deliverBy ? { deliver_by: new Date(`${deliverBy}T00:00:00Z`).toISOString() } : {}),
      });
    },
    onSuccess: () => {
      toast.success(tr("Posilka e'lon qilindi", 'Посылка опубликована', 'Parcel published'));
      queryClient.invalidateQueries({ queryKey: ['parcels'] });
      reset();
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { message?: string; response?: { status?: number } };
      if (err.message === 'NO_COORDS') {
        toast.error(
          tr(
            "Shaharni aniqlab bo'lmadi — ro'yxatdan tanlang",
            'Не удалось определить город — выберите из списка',
            'Could not resolve the city — pick one from the list'
          )
        );
        return;
      }
      if (err.response?.status === 404 || err.response?.status === 501) {
        toast.error(
          tr(
            'Posilkalar serveri hali ulanmagan',
            'Сервер посылок ещё не подключён',
            'The parcels server is not connected yet'
          )
        );
        return;
      }
      toast.error(
        tr(
          "Posilkani e'lon qilib bo'lmadi. Qayta urinib ko'ring",
          'Не удалось опубликовать посылку. Попробуйте ещё раз',
          'Could not publish the parcel. Please try again'
        )
      );
    },
  });

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={tr('Posilka yuborish', 'Отправить посылку', 'Send a parcel')}
    >
      <div className="space-y-4 pb-2">
        <CityAutocomplete
          label={tr('Qayerdan', 'Откуда', 'From')}
          placeholder={tr('Masalan, Toshkent', 'Напр. Ташкент', 'e.g. Tashkent')}
          value={from}
          onChange={setFrom}
          onSelect={(name) => setFrom(name)}
        />
        <CityAutocomplete
          label={tr('Qayerga', 'Куда', 'To')}
          placeholder={tr('Masalan, Samarqand', 'Напр. Самарканд', 'e.g. Samarkand')}
          value={to}
          onChange={setTo}
          onSelect={(name) => setTo(name)}
        />
        {/* HAJM — haydovchi uchun eng muhim savol: mashinaga sig'adimi. */}
        <div>
          <p className="mb-2 text-xs font-bold text-text-muted">{tr('Hajmi', 'Размер', 'Size')}</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: 'small', uz: 'Kichik', ru: 'Маленькая', en: 'Small' },
                { key: 'medium', uz: "O'rta", ru: 'Средняя', en: 'Medium' },
                { key: 'large', uz: 'Katta', ru: 'Большая', en: 'Large' },
              ] as const
            ).map((opt) => {
              const active = size === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={active}
                  // Qayta bosilsa tanlov OLIB TASHLANADI — maydon ixtiyoriy,
                  // aks holda bir marta bosgan odam uni bekor qila olmasdi.
                  onClick={() => setSize(active ? null : opt.key)}
                  className={`rounded-2xl border py-3 text-xs font-bold transition-colors ${
                    active
                      ? 'bg-brand-pink-light dark:bg-accent/10 border-accent text-accent'
                      : 'bg-surface border-border/80 text-text-muted hover:border-accent/40'
                  }`}
                >
                  {tr(opt.uz, opt.ru, opt.en)}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-text-muted">
            {tr(
              'Hujjat · sumka · chamadon',
              'Документы · сумка · чемодан',
              'Documents · bag · suitcase'
            )}
          </p>
        </div>

        <Input
          label={tr('Nima yuborilyapti', 'Что отправляете', 'What are you sending')}
          maxLength={120}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={tr(
            'Masalan: hujjatlar, 2 kg meva',
            'Например: документы, 2 кг фруктов',
            'For example: documents, 2 kg of fruit'
          )}
        />

        {/* Muddat IXTIYORIY: majburiy qilish yuboruvchini o'ylab topilgan sana
            yozishga majburlardi va haydovchini aldardi. */}
        <DateField
          label={tr('Qachongacha yetkazilsin', 'Доставить до', 'Deliver by')}
          value={deliverBy}
          onChange={setDeliverBy}
          min={tashkentNow().date}
          allowClear
          placeholder={tr('Muhim emas', 'Не важно', 'No deadline')}
        />

        <Input
          label={tr("Yetkazish narxi (so'm)", 'Цена доставки (сум)', 'Delivery price (UZS)')}
          type="number"
          inputMode="numeric"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="50 000"
        />
        <Input
          label={tr('Qabul qiluvchi raqami', 'Телефон получателя', "Receiver's phone")}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+998 90 123 45 67"
        />

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            {tr('Bekor qilish', 'Отмена', 'Cancel')}
          </button>
          <Button
            className="flex-1"
            disabled={!valid || mutation.isPending}
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {tr("E'lon qilish", 'Опубликовать', 'Publish')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
