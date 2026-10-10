'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Camera, Car, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useProfile } from '@/entities/user/api/useProfile';
import { useTr } from '@/shared/lib/useTr';
import { isInternalBackendError } from '@/shared/lib/format';
import { PhotoUpload } from '@/shared/ui/PhotoUpload';
import { ApplicationStatus } from '@/features/driver/ApplicationStatus';
import { KycStatusCard } from '@/features/driver/KycStatusCard';
import { upgradeToDriver } from '@/shared/api/users';

/** Qoralama kaliti — brauzer xotirasida. */
const DRAFT_KEY = 'driver_onboarding_draft';

export default function DriverOnboardingPage() {
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const tr = useTr();

  /*
   * ✅ MyID QADAMI OLIB TASHLANDI (2026-08-22): backend `myid_code` ni
   * endi talab qilmaydi (jonli o'lchandi). Egasining qarori — MyID
   * ortiqcha chiqim, ~6 oydan keyin kerak bo'lsa qaytariladi.
   *
   * Shuning uchun oqim endi 2-qadamdan BOSHLANADI: hujjatlar va mashina
   * (ichida o'z qadamlari bor), keyin 3 — yakun.
   */
  const [step, setStep] = useState(2);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const schema = zod.object({
    brand: zod
      .string()
      .min(2, tr('Mashina markasini kiriting', 'Введите марку авто', 'Enter the car make')),
    model: zod.string().min(1, tr('Modelini kiriting', 'Введите модель', 'Enter the model')),
    plate: zod
      .string()
      .min(6, tr('Davlat raqamini kiriting', 'Введите гос. номер', 'Enter the plate number')),
  });

  type FormValues = zod.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    getValues,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  // Texpasport surati — moderatsiya mashinani AYNAN shu surat bo'yicha tasdiqlaydi.
  // Ilgari forma uni umuman so'ramasdi va har bir mashina "moderatsiyada" holatida
  // qolib ketardi (tekshiruvchida hujjat yo'q edi).
  // Hujjatlar IKKI TOMONDAN va mashina UCH RAKURSDA (backend `.com`,
  // 2026-08-27). Ilgari har hujjatdan bitta kadr ketardi: guvohnomaning
  // orqasidagi TOIFALAR (odam yo'lovchi tashishga haqlimi) va
  // texpasportning orqasidagi egalik yozuvlari moderatsiyaga umuman
  // yetib bormasdi.
  const [techFront, setTechFront] = useState('');
  const [techBack, setTechBack] = useState('');
  /*
   * HUJJATLAR — har biri ALOHIDA qadamda (egasi, 2026-08-21: "bitta
   * pageda bo'lib qolmasin"). Ilgari mashina ma'lumotlari va texpasport
   * bitta uzun formada edi.
   *
   * ⚠️ Shaxs hujjati backendga HOZIRCHA yetib bormaydi — maydon yo'q
   * (xat §12). Baribir yuboriladi: Go noma'lum kalitni jimgina tashlaydi,
   * maydon qo'shilgan kuni o'zi ishlab ketadi.
   * 🔴 Haydovchilarga e'lon qilishdan OLDIN backend tasdig'i SHART.
   */
  /** Odamning O'Z surati — pasport/ID o'rniga (egasi, 2026-08-28). */
  const [selfie, setSelfie] = useState('');
  const [licenseFront, setLicenseFront] = useState('');
  const [licenseBack, setLicenseBack] = useState('');
  const [carFront, setCarFront] = useState('');
  const [carBack, setCarBack] = useState('');
  // Mashina UCH rakursda: old, orqa, yon (egasi 2026-08-28 da aniqladi —
  // chap/o'ng ajratish kerak emas).
  const [carSide, setCarSide] = useState('');
  /**
   * Hujjat qadamlari ichidagi o'rin: 0 shaxs, 1 guvohnoma, 2 texpasport,
   * 3 mashina suratlari, 4 mashina ma'lumotlari.
   */
  const [docStep, setDocStep] = useState(0);
  /** Oxirgi qadam raqami — qadam qo'shilsa shu yerdan yuriladi. */
  const LAST_DOC_STEP = 4;

  /*
   * QORALAMA — brauzer xotirasida.
   *
   * 🔴 NEGA KERAK: oqim SAKKIZTA suratga o'sdi (hujjatlar ikki tomondan,
   * mashina uch rakursda). Sahifa yangilansa, tab yopilsa yoki telefonda
   * brauzer fon rejimida o'chirilsa — hammasi yo'qolardi va odam qaytib
   * kelmasdi. Suratlar allaqachon SERVERDA, ya'ni saqlanadigan narsa
   * atigi manzillar ro'yxati.
   *
   * ⚠️ `localStorage` bo'lmasligi mumkin (private rejim, xotira to'la) —
   * shuning uchun hamma murojaat `try` ichida: saqlash mexanizmi oqimni
   * TO'SIB QO'YMASIN.
   */
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
      setSelfie(str('selfie'));
      setLicenseFront(str('license_front'));
      setLicenseBack(str('license_back'));
      setTechFront(str('tech_front'));
      setTechBack(str('tech_back'));
      setCarFront(str('car_front'));
      setCarBack(str('car_back'));
      setCarSide(str('car_side'));
      reset({ brand: str('brand'), model: str('model'), plate: str('plate') });
      // Qadam KO'R-KO'RONA olinmaydi: eski ko'rinishdan qolgan qoralamada
      // mavjud bo'lmagan raqam bo'lishi mumkin.
      const step = d.step;
      if (typeof step === 'number' && step >= 0 && step <= LAST_DOC_STEP) {
        setDocStep(step);
      }
    } catch {
      /* qoralama o'qilmadi — oqim baribir ishlaydi */
    }
  }, [reset, LAST_DOC_STEP]);

  /**
   * Qoralamani yozish — BITTA joyda.
   *
   * ⚠️ `watch()` ni to'g'ridan-to'g'ri bog'liqlik ro'yxatiga qo'yib
   * bo'lmaydi: u har renderda YANGI obyekt qaytaradi va effekt har
   * renderda ishlab, `localStorage` ga bekordan-bekor yozaverardi.
   * Shuning uchun matn maydonlari OBUNA orqali kuzatiladi, qolgan
   * holat esa odatdagi bog'liqlik ro'yxati bilan.
   */
  const saveDraft = useCallback(
    (form: Partial<FormValues>) => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            step: docStep,
            selfie,
            license_front: licenseFront,
            license_back: licenseBack,
            tech_front: techFront,
            tech_back: techBack,
            car_front: carFront,
            car_back: carBack,
            car_side: carSide,
            brand: form.brand ?? '',
            model: form.model ?? '',
            plate: form.plate ?? '',
          })
        );
      } catch {
        /* xotira yo'q — qoralamasiz davom etamiz */
      }
    },
    [docStep, selfie, licenseFront, licenseBack, techFront, techBack, carFront, carBack, carSide]
  );

  // Surat yuklansa yoki qadam almashsa.
  useEffect(() => {
    if (!restoredRef.current) return;
    saveDraft(getValues());
  }, [saveDraft, getValues]);

  // Matn maydonlariga yozilsa — obuna orqali.
  //
  // ⚠️ ESLint bu yerda "Compilation Skipped" ogohlantirishi beradi:
  // `react-hook-form` ning `watch()` i memoizatsiya qilinmaydi, ya'ni
  // React Compiler shu komponentni optimallashtirmaydi. QABUL QILINGAN:
  // bu bir marta ochiladigan forma sahifasi, memoizatsiyadan yutuq
  // sezilmaydi. Qiymatlar boshqa komponentga UZATILMAYDI (faqat shu
  // effekt ichida ishlatiladi), ya'ni ogohlantirishdagi xavf yuzaga
  // kelmaydi. Buni "tuzatish" uchun qoralamani yo'qotmang.
  useEffect(() => {
    const sub = watch((values) => {
      if (!restoredRef.current) return;
      saveDraft(values as Partial<FormValues>);
    });
    return () => sub.unsubscribe();
  }, [watch, saveDraft]);

  /**
   * Hujjat qadamlarining SARLAVHALARI — bitta joyda.
   *
   * Tartib: HUJJATLAR avval, mashina ma'lumotlari OXIRIDA. Hujjatlar —
   * tekshiruvning asosi; mashina raqamini esa odam texpasport suratiga
   * qarab kiritadi, ya'ni surat allaqachon qo'lida bo'ladi.
   */
  const DOC_STEPS = (t: typeof tr) => [
    { title: t('Sizning suratingiz', 'Ваше фото', 'Your photo') },
    { title: t('Haydovchilik guvohnomasi', 'Водительское удостоверение', "Driver's licence") },
    { title: t('Texnik pasport', 'Технический паспорт', 'Vehicle registration') },
    { title: t('Mashina suratlari', 'Фотографии автомобиля', 'Car photos') },
    { title: t("Mashina ma'lumotlari", 'Данные автомобиля', 'Car details') },
  ];

  const mutation = useMutation({
    mutationFn: async (data: { brand: string; model: string; plate: string }) => {
      // ✅ To'g'ridan gateway'ga: `myid_code` yo'q, ya'ni HttpOnly
      // cookie'ni o'qiydigan oraliq route ham kerak emas (u o'chirildi).
      await upgradeToDriver({
        brand: data.brand.trim(),
        model: data.model.trim(),
        gov_number: data.plate.replace(/\s+/g, '').toUpperCase(),
        ...(techFront
          ? // Eski maydon ham to'ldiriladi: moderatsiya paneli hamon
            // o'shani o'qiyotgan bo'lishi mumkin (izohi tur ta'rifida).
            { tech_passport_front: techFront, tech_passport_photo: techFront }
          : {}),
        ...(techBack ? { tech_passport_back: techBack } : {}),
        ...(licenseFront
          ? { driver_license_front: licenseFront, driver_license_photo: licenseFront }
          : {}),
        ...(licenseBack ? { driver_license_back: licenseBack } : {}),
        ...(carFront ? { car_front_photo: carFront } : {}),
        ...(carBack ? { car_back_photo: carBack } : {}),
        ...(carSide ? { car_side_photo: carSide } : {}),
        // Odamning surati — `avatar_url` sxemada ALLAQACHON bor.
        ...(selfie ? { avatar_url: selfie } : {}),
      });
    },
    onSuccess: async () => {
      // Ariza ketdi — qoralama keraksiz. Tozalanmasa, odam keyingi safar
      // allaqachon yuborilgan hujjatlarni qaytadan ko'rib, ikkinchi marta
      // yuborardi.
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* muhim emas */
      }
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(
        tr(
          "Muvaffaqiyatli ro'yxatdan o'tdingiz!",
          'Успешная регистрация!',
          'Registration complete!'
        )
      );
      setStep(3);
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || '';
      console.error('Driver upgrade failed:', msg);
      toast.error(
        /duplicate key|already exists/i.test(String(msg))
          ? tr(
              "Bu davlat raqami allaqachon ro'yxatdan o'tgan. Raqamni tekshirib qayta kiriting.",
              'Этот гос. номер уже зарегистрирован. Проверьте номер.',
              'This plate number is already registered. Please check it and try again.'
            )
          : /*
             * 🔴 XOM BAZA XATOSI ODAMGA CHIQMASIN (egasi qurilmada
             * ko'rdi, 27.08.2026): `cars` jadvalida ustun yetishmagani
             * uchun backend shuni qaytardi va u AYNAN SHU YERDA,
             * haydovchi bo'lish oqimining OXIRIDA ekranga chiqardi:
             *   «Xatolik: ERROR: column "tech_passport_front" of
             *    relation "cars" does not exist (SQLSTATE 42703)»
             * Odam butun formani to'ldirib, yettita suratni yuklab
             * bo'lgach shuni o'qirdi — va nima qilishni bilmasdi.
             */
            isInternalBackendError(msg)
            ? tr(
                "Hozir ro'yxatdan o'tkazib bo'lmaydi — serverda vaqtincha nosozlik. Bu sizning xatongiz emas, ma'lumotlaringiz saqlanib qoldi. Biroz keyin qayta yuboring",
                'Сейчас не получается зарегистрировать — временный сбой на сервере. Это не ваша ошибка, данные сохранены. Отправьте ещё раз чуть позже',
                'Registration cannot go through right now — a temporary server problem. This is not your fault and your data is saved. Please send it again a little later'
              )
            : tr(`Xatolik: ${msg}`, `Ошибка: ${msg}`, `Error: ${msg}`)
      );
    },
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-screen p-4 pb-24 md:pb-8">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col pt-8">
        {/* Ariza RAD ETILGAN bo'lsa — sabab AYNAN SHU YERDA kerak.
            Odam profildagi "Qaytadan yuborish" ni bosib shu formaga
            keladi va nima noto'g'ri bo'lganini shu yerda unutadi:
            banner faqat profilda qolsa, u orqaga qaytib o'qishi kerak.
            `KycStatusCard` `none`/`approved` da o'zi ko'rinmaydi. */}
        {profile?.kyc_status === 'rejected' && (
          <div className="mb-6">
            <KycStatusCard
              status={profile.kyc_status}
              reason={profile.kyc_rejection_reason}
              locale={locale}
              showRetry={false}
            />
          </div>
        )}

        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= i ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>

        {/* 1-qadam: odamning surati (pasport/ID o'rniga). */}
        {/* Step 2: Info */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-pink-light dark:bg-accent/10 flex items-center justify-center text-accent mb-4 border border-accent/20">
                <Car className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-display font-black text-foreground tracking-tight">
                {DOC_STEPS(tr)[docStep].title}
              </h1>
              <p className="text-sm font-bold text-text-muted">
                {tr(
                  `${docStep + 1}-qadam / ${DOC_STEPS(tr).length}`,
                  `Шаг ${docStep + 1} из ${DOC_STEPS(tr).length}`,
                  `Step ${docStep + 1} of ${DOC_STEPS(tr).length}`
                )}
              </p>
              {/* Oldinga siljish — raqamsiz chiziq "qancha qoldi" degan
                  savolga javob bermaydi, shuning uchun ikkalasi ham. */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${((docStep + 1) / DOC_STEPS(tr).length) * 100}%` }}
                />
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* 1) ODAMNING O'Z SURATI.
                  🔴 PASPORT VA ID KARTA OLIB TASHLANDI (egasi,
                  2026-08-28): ular backendga hech qachon yetib bormagan
                  — sxemada bunday maydon umuman yo'q edi. Ya'ni odamdan
                  hech qayerga bormaydigan hujjat so'ralardi.

                  O'rniga odamning surati olinadi va u `avatar_url` ga
                  ketadi — bu maydon sxemada ALLAQACHON bor. Yo'lovchi
                  uchrashuv joyida haydovchini shu surat bilan taniydi. */}
              {docStep === 0 && (
                <>
                  <LiveOnlyNote />
                  <PhotoUpload
                    label={tr('Sizning suratingiz', 'Ваше фото', 'Your photo')}
                    hints={[
                      tr(
                        "Yuzingiz to'liq ko'rinsin — bosh kiyim va ko'zoynaksiz",
                        'Лицо должно быть полностью видно — без головного убора и очков',
                        'Your face must be fully visible — no hat or sunglasses'
                      ),
                      tr(
                        "Yorug' joyda turing, orqangizdan yorug'lik tushmasin",
                        'Встаньте при хорошем свете, источник света не должен быть сзади',
                        'Stand in good light; do not have the light source behind you'
                      ),
                      tr(
                        "Bu surat profilingizda ko'rinadi — yo'lovchi sizni taniydi",
                        'Это фото будет в вашем профиле — пассажир вас узнает',
                        'This photo appears in your profile — passengers will recognise you'
                      ),
                    ]}
                    value={selfie}
                    onChange={setSelfie}
                    disabled={mutation.isPending}
                    live
                    frontCamera
                  />
                </>
              )}

              {/* 2) HAYDOVCHILIK GUVOHNOMASI — IKKI TOMONDAN.
                  🔴 Orqa tomonda TOIFALAR (B, C, D) yozilgan: odam
                  yo'lovchi tashishga haqlimi yoki yo'qmi aynan o'sha
                  yerda ko'rinadi. Faqat old tomon bilan moderatsiya
                  buni hech qachon aniqlay olmasdi. */}
              {docStep === 1 && (
                <div className="space-y-8">
                  <LiveOnlyNote />
                  <PhotoUpload
                    label={tr(
                      'Guvohnoma — old tomoni',
                      'Удостоверение — лицевая сторона',
                      'Licence — front side'
                    )}
                    hints={[
                      tr(
                        'Guvohnomaning old tomonini oling',
                        'Снимите лицевую сторону удостоверения',
                        'Photograph the front of the licence'
                      ),
                      tr(
                        "Toifa va amal qilish muddati ko'rinsin",
                        'Категория и срок действия должны быть видны',
                        'Category and expiry date must be visible'
                      ),
                      tr(
                        "Yozuvlar aniq o'qilsin",
                        'Текст должен читаться',
                        'Text must be readable'
                      ),
                      tr(
                        "Muddati o'tmagan bo'lsin",
                        'Срок действия не должен быть истёкшим',
                        'The licence must not be expired'
                      ),
                    ]}
                    value={licenseFront}
                    onChange={setLicenseFront}
                    disabled={mutation.isPending}
                    live
                  />
                  <PhotoUpload
                    label={tr(
                      'Guvohnoma — orqa tomoni',
                      'Удостоверение — оборотная сторона',
                      'Licence — back side'
                    )}
                    hints={[
                      tr(
                        "Toifalar jadvali (B, C, D) to'liq ko'rinsin",
                        'Таблица категорий (B, C, D) должна быть видна полностью',
                        'The category table (B, C, D) must be fully visible'
                      ),
                      tr(
                        "Har toifaning muddati o'qilsin",
                        'Срок по каждой категории должен читаться',
                        'The expiry for each category must be readable'
                      ),
                      tr(
                        "To'rtala burchagi ham kadrga tushsin",
                        'Все четыре угла должны попасть в кадр',
                        'All four corners must be in the frame'
                      ),
                      tr("Yorug'lik aks etmasin", 'Без бликов', 'No glare'),
                    ]}
                    value={licenseBack}
                    onChange={setLicenseBack}
                    disabled={mutation.isPending}
                    live
                  />
                </div>
              )}

              {/* 5) MASHINA MA'LUMOTLARI — oxirgi qadam. */}
              {docStep === 4 && (
                <>
                  <Input
                    {...register('brand')}
                    label={tr('Markasi', 'Марка', 'Make')}
                    placeholder="Chevrolet"
                    error={errors.brand?.message}
                  />
                  <Input
                    {...register('model')}
                    label={tr('Modeli', 'Модель', 'Model')}
                    placeholder="Cobalt"
                    error={errors.model?.message}
                  />
                  <Input
                    {...register('plate')}
                    label={tr('Davlat raqami', 'Гос. номер', 'Plate number')}
                    placeholder="01 A 123 AA"
                    error={errors.plate?.message}
                    className="uppercase"
                  />
                </>
              )}

              {/* 3) TEXNIK PASPORT — IKKI TOMONDAN, mashina
                  ma'lumotlaridan OLDIN: odam raqamni aynan shu suratga
                  qarab kiritadi. Orqa tomonda egalik va ishonchnoma
                  yozuvlari bo'ladi — mashina haydovchiniki ekanini
                  moderatsiya faqat o'sha tomondan ko'radi. */}
              {docStep === 2 && (
                <div className="space-y-8">
                  <LiveOnlyNote />
                  <PhotoUpload
                    label={tr(
                      'Texnik pasport — old tomoni',
                      'Техпаспорт — лицевая сторона',
                      'Vehicle registration — front side'
                    )}
                    hints={[
                      tr(
                        "Egasi va mashina ma'lumotlari bor tomonni oling",
                        'Снимите сторону с данными владельца и автомобиля',
                        'Photograph the side with owner and vehicle details'
                      ),
                      tr(
                        "Davlat raqami aniq ko'rinsin",
                        'Гос. номер должен быть чётко виден',
                        'The plate number must be clearly visible'
                      ),
                      tr(
                        "To'rtala burchagi ham kadrga tushsin",
                        'Все четыре угла должны попасть в кадр',
                        'All four corners must be in the frame'
                      ),
                      tr(
                        "Yozuvlar xira bo'lmasin",
                        'Текст не должен быть размытым',
                        'Text must not be blurry'
                      ),
                    ]}
                    value={techFront}
                    onChange={setTechFront}
                    disabled={mutation.isPending}
                    live
                  />
                  <PhotoUpload
                    label={tr(
                      'Texnik pasport — orqa tomoni',
                      'Техпаспорт — оборотная сторона',
                      'Vehicle registration — back side'
                    )}
                    hints={[
                      tr(
                        "Egalik va ishonchnoma yozuvlari ko'rinsin",
                        'Записи о владельце и доверенности должны быть видны',
                        'Ownership and proxy entries must be visible'
                      ),
                      tr(
                        'Muhrlar kesilmasin',
                        'Печати не должны быть обрезаны',
                        'Stamps must not be cut off'
                      ),
                      tr(
                        "To'rtala burchagi ham kadrga tushsin",
                        'Все четыре угла должны попасть в кадр',
                        'All four corners must be in the frame'
                      ),
                      tr(
                        "Yozuvlar xira bo'lmasin",
                        'Текст не должен быть размытым',
                        'Text must not be blurry'
                      ),
                    ]}
                    value={techBack}
                    onChange={setTechBack}
                    disabled={mutation.isPending}
                    live
                  />
                </div>
              )}

              {/* 4) MASHINA UCH RAKURSDA.
                  🔴 NEGA UCHTA: yo'lovchi uchrashuv joyida mashinani
                  TANIY olishi kerak, moderatsiya esa davlat raqami
                  texpasportdagisi bilan bir xilligini tekshiradi. Bitta
                  kadr ikkala vazifaga ham yetmaydi. */}
              {docStep === 3 && (
                <div className="space-y-8">
                  <LiveOnlyNote />
                  <PhotoUpload
                    label={tr('Old tomondan', 'Спереди', 'Front view')}
                    hints={[
                      tr(
                        "Mashina to'liq kadrga sig'sin",
                        'Автомобиль должен полностью помещаться в кадр',
                        'The whole car must fit in the frame'
                      ),
                      tr(
                        "Old davlat raqami o'qilsin",
                        'Передний гос. номер должен читаться',
                        'The front plate must be readable'
                      ),
                      tr(
                        "Kunduzi, yaxshi yorug'likda oling",
                        'Снимайте днём, при хорошем освещении',
                        'Shoot in daylight, with good lighting'
                      ),
                    ]}
                    value={carFront}
                    onChange={setCarFront}
                    disabled={mutation.isPending}
                    live
                  />
                  <PhotoUpload
                    label={tr('Orqa tomondan', 'Сзади', 'Rear view')}
                    hints={[
                      tr(
                        "Orqa davlat raqami aniq o'qilsin",
                        'Задний гос. номер должен чётко читаться',
                        'The rear plate must be clearly readable'
                      ),
                      tr(
                        "Bagaj qopqog'i to'liq ko'rinsin",
                        'Крышка багажника должна быть видна полностью',
                        'The boot lid must be fully visible'
                      ),
                      tr(
                        "Boshqa mashina to'sib qolmasin",
                        'Другие машины не должны перекрывать обзор',
                        'Other cars must not block the view'
                      ),
                    ]}
                    value={carBack}
                    onChange={setCarBack}
                    disabled={mutation.isPending}
                    live
                  />
                  <PhotoUpload
                    // 🔴 «(ixtiyoriy)» OLIB TASHLANDI: yon tomon endi
                    // majburiy (egasi, 2026-08-28), ya'ni yorliq
                    // tugmaning haqiqiy holatiga ZID edi — odam
                    // «ixtiyoriy» deb o'qib o'tkazib yubormoqchi
                    // bo'lardi, tugma esa o'chiq turardi.
                    label={tr('Yon tomondan', 'Сбоку', 'Side view')}
                    hints={[
                      tr(
                        "Mashinaning butun yon tomoni ko'rinsin",
                        'Должна быть видна вся боковая сторона',
                        'The entire side of the car must be visible'
                      ),
                      tr(
                        "To'rtala eshik ham kadrda bo'lsin",
                        'Все четыре двери должны попасть в кадр',
                        'All four doors must be in the frame'
                      ),
                      tr(
                        'Rangi asl holidek chiqsin',
                        'Цвет должен быть передан достоверно',
                        'The colour must look true to life'
                      ),
                    ]}
                    value={carSide}
                    onChange={setCarSide}
                    disabled={mutation.isPending}
                    live
                  />
                </div>
              )}

              {/* Qadamlar bo'ylab yurish. Hujjatsiz OLDINGA O'TKAZMAYDI:
                  hujjatsiz ariza baribir rad etiladi, ya'ni oldinga
                  o'tkazish faqat odamning vaqtini oldiradi. */}
              <div className="mt-8 flex items-center gap-2">
                {docStep > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDocStep((v) => v - 1)}
                    disabled={mutation.isPending}
                  >
                    {tr('Orqaga', 'Назад', 'Back')}
                  </Button>
                )}
                {docStep < LAST_DOC_STEP ? (
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={
                      (docStep === 0 && !selfie) ||
                      (docStep === 1 && (!licenseFront || !licenseBack)) ||
                      (docStep === 2 && (!techFront || !techBack)) ||
                      // Yon rakurs IXTIYORIY: old va orqa davlat raqamini
                      // beradi (moderatsiya shuni texpasport bilan
                      // solishtiradi), yon tomon esa faqat tanish uchun
                      // qulaylik. Uchalasini majburiy qilish onboardingni
                      // cho'zadi va tashlab ketishlarni oshiradi.
                      // Uchalasi ham MAJBURIY (egasi, 2026-08-28): ilgari
                      // yon tomon ixtiyoriy edi va amalda hech kim
                      // yubormasdi.
                      (docStep === 3 && (!carFront || !carBack || !carSide))
                    }
                    onClick={() => setDocStep((v) => v + 1)}
                  >
                    <span>{tr('Keyingisi', 'Далее', 'Next')}</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!isValid || !mounted}
                    className="flex-1"
                    isLoading={mutation.isPending}
                  >
                    <span>
                      {tr('Tekshiruvga yuborish', 'Отправить на проверку', 'Send for review')}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          // Ilgari bu yerda "Tabriklaymiz! Endi buyurtmalarni ko'rishingiz
          // mumkin" turardi — bu HAQIQAT EMAS edi: backend yangi mashinani
          // `moderation_status: "pending"` bilan qaytaradi va admin
          // tasdiqlamaguncha haydovchi e'lon bera olmaydi. `ApplicationStatus`
          // haqiqiy holatni ko'rsatadi va tasdiqlanganda o'zi yangilanadi.
          <ApplicationStatus onStart={() => router.push(`/${locale}/dashboard`)} />
        )}
      </div>
    </div>
  );
}

/**
 * «Suratlar ayni paytda olinadi» eslatmasi.
 *
 * 🔴 NEGA KERAK: galereya tugmasi yo'qolgani odamga TUSHUNTIRILMASA, u
 * buni nosozlik deb o'ylaydi — «tayyor suratim bor edi, nega qo'shib
 * bo'lmayapti». Sababni oldindan aytish murojaatni kamaytiradi.
 *
 * ⚠️ HALOL CHEGARA: telefonda `capture` kamerani to'g'ridan-to'g'ri
 * ochadi, kompyuterda esa brauzer uni e'tiborsiz qoldiradi va fayl
 * tanlash oynasi chiqadi — veb-standart bunga boshqa yo'l bermaydi.
 * Ilovada cheklov QAT'IY.
 */
function LiveOnlyNote() {
  const tr = useTr();
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-text-muted">
      <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {tr(
          "Suratlar shu yerda, ayni paytda olinadi — galereyadan tanlab bo'lmaydi",
          'Фото делаются здесь и сейчас — выбрать из галереи нельзя',
          'Photos are taken here and now — you cannot pick from the gallery'
        )}
      </span>
    </p>
  );
}
