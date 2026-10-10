'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyCars, addCar } from '@/shared/api/users';
import type { Car as CarType } from '@/shared/api/types/user';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { userFacingError, isInternalBackendError } from '@/shared/lib/format';
import { Car, Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useTr } from '@/shared/lib/useTr';
import { PhotoUpload } from '@/shared/ui/PhotoUpload';
import { Skeleton } from '@/shared/ui/Skeleton';

// Haydovchi mashinalari (profil bo'limi). Yangi Gateway: FAQAT GET/POST /users/me/cars —
// tahrirlash/o'chirish endpointi YO'Q, shuning uchun bunday tugmalar ham yo'q.
// Davlat raqami maydoni `gov_number` (plate_number -> 400, jonli tasdiqlangan).
// `color`/`seats` backend'da saqlanmaydi (xat v5 №7.3) — forma ham so'ramaydi.
// Yangi mashina `moderation_status: "pending"` bilan keladi — moderatsiya belgisi ko'rsatiladi.

interface FormState {
  brand: string;
  model: string;
  plate: string;
  /** Texpasport surati (media/upload URL'i) — moderatsiya shu bo'yicha tasdiqlaydi. */
  techFront: string;
  techBack: string;
  carFront: string;
  carBack: string;
  carSide: string;
}

const emptyForm: FormState = {
  brand: '',
  model: '',
  plate: '',
  techFront: '',
  techBack: '',
  carFront: '',
  carBack: '',
  carSide: '',
};

export function VehiclesSection() {
  const locale = useLocale();
  const tr = useTr();
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const {
    data: vehicles = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<CarType[]>({
    queryKey: ['vehicles'],
    queryFn: getMyCars,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      addCar({
        brand: form.brand.trim(),
        model: form.model.trim(),
        gov_number: form.plate.replace(/\s+/g, '').toUpperCase(),
        // Eski `tech_passport_photo` ham to'ldiriladi: moderatsiya paneli
        // hamon o'shani o'qiyotgan bo'lishi mumkin (izohi turida).
        ...(form.techFront
          ? { tech_passport_front: form.techFront, tech_passport_photo: form.techFront }
          : {}),
        ...(form.techBack ? { tech_passport_back: form.techBack } : {}),
        ...(form.carFront ? { car_front_photo: form.carFront } : {}),
        ...(form.carBack ? { car_back_photo: form.carBack } : {}),
        ...(form.carSide ? { car_side_photo: form.carSide } : {}),
      }),
    onSuccess: () => {
      toast.success(tr("Mashina qo'shildi", 'Автомобиль добавлен', 'Car added'));
      setAdding(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      // users/me ham cars[] qaytaradi — profil keshi eskirmasin.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      const msg = err.response?.data?.error || err.response?.data?.message;
      toast.error(
        /duplicate key|already exists/i.test(String(msg))
          ? tr(
              "Bu davlat raqami allaqachon ro'yxatdan o'tgan",
              'Этот гос. номер уже зарегистрирован',
              'This plate number is already registered'
            )
          : /*
             * 🔴 ICHKI XATO XOM HOLDA CHIQMASIN (jonli, 27.08.2026):
             * `cars` jadvalida ustun yetishmagani uchun backend
             * `ERROR: column "tech_passport_front" ... (SQLSTATE 42703)`
             * qaytardi va u AYNAN SHU YERDA ekranga chiqardi — mashina
             * qo'shayotgan odam Postgres xatosini o'qirdi.
             */
            isInternalBackendError(msg)
            ? tr(
                "Hozir mashina qo'shib bo'lmaydi — serverda vaqtincha nosozlik. Bu sizning xatongiz emas",
                'Сейчас нельзя добавить автомобиль — временный сбой на сервере. Это не ваша ошибка',
                'Cannot add a car right now — a temporary server problem. This is not your fault'
              )
            : userFacingError(
                msg,
                tr(
                  'Mashinani saqlashda xatolik',
                  'Ошибка сохранения автомобиля',
                  'Could not save the car'
                )
              )
      );
    },
  });

  const formValid =
    form.brand.trim().length >= 2 && form.model.trim().length >= 1 && form.plate.trim().length >= 6;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-text uppercase tracking-wider">
          <Car className="h-5 w-5 text-accent" />
          {tr('Mening mashinalarim', 'Мои автомобили', 'My cars')}
        </h3>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setForm(emptyForm);
            }}
            className="flex items-center gap-1 text-xs font-bold text-accent hover:underline"
          >
            <Plus className="h-4 w-4" />
            {tr("Qo'shish", 'Добавить', 'Add')}
          </button>
        )}
      </div>

      {isLoading ? (
        /* Qator shaklidagi skelet — matnli kutish o'rniga. */
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        /*
          🔴 UZILISH "MASHINA YO'Q" DEGANI EMAS (2026-08-16).
          Ilgari so'rov yiqilsa ham pastdagi "Hozircha mashina qo'shilmagan"
          matni chiqardi. Haydovchi mashinasi o'chib ketgan deb o'ylab,
          IKKINCHISINI qo'shishi mumkin edi — keyin ro'yxatda ikkita bir xil
          mashina qoladi va qaysi biri moderatsiyadan o'tganini ajratib
          bo'lmaydi. Xuddi shu naqsh ilgari safarlar ro'yxatida va
          bloklanganlar ro'yxatida ham topilgan edi.
        */
        <div className="space-y-2">
          <p className="text-sm font-bold text-error">
            {tr(
              "Mashinalar ro'yxati yuklanmadi",
              'Не удалось загрузить список автомобилей',
              'Could not load your vehicles'
            )}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            /* ⚠️ Bosiladigan maydon 44 px (o'lchov 2026-09-04). */
            className="inline-flex min-h-11 items-center text-xs font-bold text-accent hover:underline"
          >
            {tr('Qayta urinish', 'Повторить', 'Try again')}
          </button>
        </div>
      ) : vehicles.length === 0 && !adding ? (
        <p className="text-sm text-text-muted">
          {tr(
            "Hozircha mashina qo'shilmagan.",
            'Автомобили пока не добавлены.',
            'No cars added yet.'
          )}
        </p>
      ) : (
        <ul className="mo-in space-y-2">
          {vehicles.map((v) => (
            <li
              key={v.id}
              className="rounded-xl border border-border/60 bg-bg p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-text truncate">
                  {[v.brand, v.model].filter(Boolean).join(' ') || '—'}
                </p>
                <p className="text-xs font-bold text-text-muted">{v.gov_number}</p>
              </div>
              {String(v.moderation_status ?? '').toLowerCase() === 'pending' && (
                <span
                  className="flex items-center gap-1 shrink-0 text-[11px] font-bold text-text-muted"
                  title={tr(
                    "Mashina moderatsiyadan o'tmoqda",
                    'Автомобиль на модерации',
                    'Car is under review'
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {tr('Moderatsiyada', 'На модерации', 'Under review')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
          <p className="text-xs font-extrabold text-accent uppercase tracking-wide">
            {tr('Yangi mashina', 'Новый автомобиль', 'New car')}
          </p>
          <Input
            label={tr('Rusumi (marka)', 'Марка', 'Make')}
            placeholder="Chevrolet"
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          />
          <Input
            label={tr('Modeli', 'Модель', 'Model')}
            placeholder="Cobalt"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          />
          <Input
            label={tr('Davlat raqami', 'Гос. номер', 'Plate number')}
            placeholder="01 A 123 AA"
            value={form.plate}
            onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))}
            className="uppercase"
          />
          {/* Texpasport IKKI TOMONDAN va mashina UCH RAKURSDA (backend
              `.com`, 2026-08-27). Ilgari bitta umumiy surat so'ralardi va
              moderatsiya mashinani bitta kadrdan tasdiqlay olmasdi —
              mashina "tekshiruvda" holatida qolib ketardi. */}
          <PhotoUpload
            label={tr(
              'Texpasport — old tomoni',
              'Техпаспорт — лицевая сторона',
              'Vehicle registration — front'
            )}
            hint={tr(
              "Egasi va mashina ma'lumotlari bor tomon. Surat bo'lmasa mashina moderatsiyada uzoq turishi mumkin.",
              'Сторона с данными владельца и автомобиля. Без фото автомобиль может дольше висеть на модерации.',
              'The side with owner and vehicle details. Without a photo the car may stay under review longer.'
            )}
            value={form.techFront}
            onChange={(url) => setForm((f) => ({ ...f, techFront: url }))}
            disabled={saveMutation.isPending}
            live
          />
          <PhotoUpload
            label={tr(
              'Texpasport — orqa tomoni',
              'Техпаспорт — оборотная сторона',
              'Vehicle registration — back'
            )}
            hint={tr(
              "Egalik va ishonchnoma yozuvlari ko'rinsin.",
              'Должны быть видны записи о владельце и доверенности.',
              'Ownership and proxy entries must be visible.'
            )}
            value={form.techBack}
            onChange={(url) => setForm((f) => ({ ...f, techBack: url }))}
            disabled={saveMutation.isPending}
            live
          />
          <PhotoUpload
            label={tr('Mashina — old tomondan', 'Автомобиль — спереди', 'Car — front')}
            hint={tr(
              "Mashina to'liq kadrga sig'sin, old davlat raqami o'qilsin.",
              'Автомобиль должен помещаться в кадр, передний гос. номер — читаться.',
              'The whole car must fit in the frame, the front plate must be readable.'
            )}
            value={form.carFront}
            onChange={(url) => setForm((f) => ({ ...f, carFront: url }))}
            disabled={saveMutation.isPending}
            live
          />
          <PhotoUpload
            label={tr('Mashina — orqa tomondan', 'Автомобиль — сзади', 'Car — rear')}
            hint={tr(
              "Orqa davlat raqami aniq o'qilsin.",
              'Задний гос. номер должен чётко читаться.',
              'The rear plate must be clearly readable.'
            )}
            value={form.carBack}
            onChange={(url) => setForm((f) => ({ ...f, carBack: url }))}
            disabled={saveMutation.isPending}
            live
          />
          <PhotoUpload
            label={tr('Mashina — yon tomondan', 'Автомобиль — сбоку', 'Car — side')}
            hint={tr(
              "Butun yon tomoni va to'rtala eshik kadrda bo'lsin.",
              'В кадре должна быть вся боковая сторона и все четыре двери.',
              'The entire side and all four doors must be in the frame.'
            )}
            value={form.carSide}
            onChange={(url) => setForm((f) => ({ ...f, carSide: url }))}
            disabled={saveMutation.isPending}
            live
          />
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={saveMutation.isPending}
              onClick={() => {
                setAdding(false);
                setForm(emptyForm);
              }}
            >
              {tr('Bekor qilish', 'Отмена', 'Cancel')}
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!formValid || saveMutation.isPending}
              isLoading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {tr('Saqlash', 'Сохранить', 'Save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
