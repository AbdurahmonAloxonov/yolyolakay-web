'use client';

import Link from 'next/link';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useProfile, useUpdateProfile, useUpdateAvatar } from '@/entities/user/api/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { performLogout } from '@/shared/lib/logout';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import { MyRoadsMap } from '@/shared/ui/MyRoadsMap';
import { GirihPattern, OrnamentMark } from '@/shared/ui/brand/Ornament';
import { Button } from '@/shared/ui/Button';
import { Switch } from '@/shared/ui/Switch';
import {
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  LogOut,
  ArrowRight,
  Edit2,
  Sun,
  Moon,
  Sparkles,
  Camera,
  Trash2,
  SlidersHorizontal,
  Check,
  AlertTriangle,
  Car,
  LifeBuoy,
  FileText,
  Activity,
} from 'lucide-react';
import { useUIStore } from '@/shared/model/uiStore';
import { useTheme } from '@/shared/model/ThemeContext';
import { toast } from 'sonner';
import { PasswordSection } from '@/features/security/PasswordSection';
import { SessionsSection } from '@/features/security/SessionsSection';
import { RatingBadge } from '@/shared/ui/StarRating';
import { VehiclesSection } from '@/features/vehicles/VehiclesSection';
import { KycStatusCard } from '@/features/driver/KycStatusCard';
import { ProfileCompleteness } from '@/features/account/ProfileCompleteness';
import { InviteCard } from '@/features/account/InviteCard';
import { BigTextToggle } from '@/features/account/BigTextToggle';
import { TrustLadder } from '@/shared/ui/TrustLadder';
import { CurrentPlanCard } from '@/shared/ui/billing/CurrentPlanCard';
import { DeleteAccountSection } from '@/features/account/DeleteAccountSection';
import { Avatar } from '@/shared/ui/Avatar';
import { Skeleton } from '@/shared/ui/Skeleton';
import { BlockedUsersSection } from '@/features/moderation/BlockedUsersSection';
import { useTr } from '@/shared/lib/useTr';
import { LocaleSwitch } from '@/shared/ui/LocaleSwitch';
import { useCurrentPlan } from '@/entities/billing/api/useSubscription';
import { formatBalance } from '@/shared/lib/format';
import { SUPPORT_TELEGRAM_URL } from '@/shared/config/contacts';
import { SupportSheet } from '@/features/support/SupportSheet';

/**
 * Bo'lim sarlavhasi — akkordeon O'RNINI bosadi.
 *
 * Yig'iladigan guruh ikki ish qilardi: bo'limni NOMLAYDI va uni YASHIRADI.
 * Birinchisi kerak, ikkinchisi zarar edi (izohi sahifa tanasida). Bu
 * komponent faqat birinchisini qoldiradi: nomi, bir qatorlik izohi va chapda
 * ingichka turkuaz ustun — ko'z sahifani "sakrab" o'qishi uchun langar.
 */
const SectionHead: React.FC<{ icon: React.ReactNode; title: string; hint: string }> = ({
  icon,
  title,
  hint,
}) => (
  /*
   * 🔑 Yorliqning O'ZI — sayt bo'ylab umumiy `SectionLabel` (islimi
   *    novdasi bilan). Ilgari bu yerda o'ziga xos «chapdagi turkuaz
   *    ustun» bor edi: u langar vazifasini bajarardi-yu, boshqa hech
   *    bir sahifada uchramasdi. Novda o'sha vazifani bajaradi va
   *    qidiruv, posilkalar, haydovchi ekranlari bilan bir xil.
   *    Bu blokning FARQI faqat bitta: yorliq ostida bir qatorlik izoh.
   */
  <div>
    <SectionLabel icon={icon}>{title}</SectionLabel>
    <p className="mt-1 text-xs font-medium text-text-muted">{hint}</p>
  </div>
);

export default function ProfilePage() {
  const t = useTranslations('Profile');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, refetch } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const updateAvatarMutation = useUpdateAvatar();
  const { activeRole, setActiveRole } = useUIStore();
  // Yordam oynasi — "Yordam" havolasi bosilganda.
  const [supportOpen, setSupportOpen] = React.useState(false);
  const { theme, setTheme, style, setStyle } = useTheme();
  // Balans/cheksizlik — tariflar sahifasi bilan BIR XIL manbadan.
  const { ridesLeft, isUnlimited: planIsUnlimited, plan: currentPlan } = useCurrentPlan();
  const planKnown = !!currentPlan;

  const tr = useTr();

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [editedName, setEditedName] = React.useState('');
  const [editedGender, setEditedGender] = React.useState<'male' | 'female' | null>(null);

  // Avatar: yashirin <input type="file"> — rasm bosilganda ochiladi.
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const MAX_AVATAR_MB = 5;

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Inputni DARHOL tozalaymiz — bir xil faylni qayta tanlaganda `change` otilishi uchun.
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(tr('Faqat rasm fayli', 'Только изображение', 'Images only'));
      return;
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      toast.error(
        tr(
          `Rasm ${MAX_AVATAR_MB} MB dan katta`,
          `Изображение больше ${MAX_AVATAR_MB} МБ`,
          `The image is larger than ${MAX_AVATAR_MB} MB`
        )
      );
      return;
    }
    // Ism to'liq bo'lmasa PATCH /users/me 400 beradi (first_name+last_name required) —
    // avatar "sababsiz" yiqilmasin, sababini aytamiz.
    if (!profile?.name?.trim() || profile.name.trim().split(/\s+/).length < 2) {
      toast.error(
        tr(
          'Avval ism va familiyangizni kiriting',
          'Сначала укажите имя и фамилию',
          'Please enter your first and last name first'
        )
      );
      return;
    }

    try {
      await updateAvatarMutation.mutateAsync(file);
      toast.success(tr('Avatar yangilandi', 'Аватар обновлён', 'Avatar updated'));
    } catch {
      /* global interceptor toasti yetadi */
    }
  };

  const handleAvatarRemove = async () => {
    try {
      await updateAvatarMutation.mutateAsync(null);
      toast.success(tr('Avatar olib tashlandi', 'Аватар удалён', 'Avatar removed'));
    } catch {
      /* global interceptor toasti yetadi */
    }
  };

  const handleNameSave = async () => {
    if (editedName.trim().length >= 2) {
      try {
        await updateProfileMutation.mutateAsync({
          name: editedName.trim(),
          gender: editedGender || undefined,
        });
        setIsEditingName(false);
      } catch (e) {
        // Backend first_name+last_name'ni qat'iy talab qiladi — bitta so'z kiritilsa shu xato.
        if (e instanceof Error && e.message === 'FULL_NAME_REQUIRED') {
          toast.error(
            tr(
              'Ism va familiyangizni kiriting (masalan: Palonchi Pistonchiyev)',
              'Введите имя и фамилию (например: Палончи Пистончиев)',
              'Enter your first and last name (e.g. Palonchi Pistonchiyev)'
            )
          );
        }
        // Boshqa xatolar uchun global interceptor toasti yetadi.
      }
    }
  };

  const handleRoleToggle = (isDriverChecked: boolean) => {
    const role = isDriverChecked ? 'driver' : 'passenger';
    setActiveRole(role);

    if (role === 'driver') {
      if (profile?.is_driver) {
        router.push(`/${locale}/dashboard`);
      } else {
        router.push(`/${locale}/driver/onboarding`);
      }
    } else {
      router.push(`/${locale}/search`);
    }
  };

  if (isLoading) {
    /* Sahifa SHAKLIDAGI skelet — markazdagi "Yuklanmoqda..." matni o'rniga.
       Profil har kirishda ochiladigan sahifa: matnli kutish har safar bo'sh
       ekran ko'rsatardi, skelet esa kelayotgan joylashuvni oldindan chizadi
       va ma'lumot kelganda sahifa SAKRAMAYDI. */
    return (
      <div className="flex-1 bg-bg px-4 py-6 sm:px-6 lg:px-8" aria-busy="true">
        <div className="mx-auto max-w-md space-y-8 lg:max-w-5xl">
          {/* Hero */}
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-2xl" />
              ))}
            </div>
          </div>
          {/* Sozlamalar setkasi */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Token bor, lekin profil so'rovi ham, JWT fallback ham yiqildi (kamyob chekka-holat).
  // Oq sahifa (return null) o'rniga tushunarli xato + qayta urinish ko'rsatamiz.
  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg px-4 min-h-[60vh] text-center">
        <p className="max-w-xs text-sm font-semibold text-text-muted">
          {tr(
            "Profil ma'lumotlarini yuklab bo'lmadi. Qayta urinib ko'ring.",
            'Не удалось загрузить профиль. Попробуйте ещё раз.',
            'Could not load your profile. Please try again.'
          )}
        </p>
        <Button variant="secondary" onClick={() => refetch()}>
          {tr('Qayta urinish', 'Повторить', 'Try again')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-bg px-4 py-6 sm:px-6 lg:px-8 select-none">
      {/*
        ===== PROFIL SAHIFASINING TUZILISHI (qayta yig'ildi 2026-08-19) =====

        🔴 NEGA YIG'ILADIGAN "NAVBAR"LAR OLIB TASHLANDI (egasi: "profilga
        qo'shilgan navbarlarni olib tashlab, tartibli va ijodkorlik bilan
        joylashtir"): sozlamalar uchta yopiq akkordeon ichida turardi
        (`SettingsGroup`). U uzunlikni yashirardi-yu, muammoni hal
        qilmasdi — aksincha yangisini qo'shdi:
          • har sozlamaga yetish uchun QO'SHIMCHA bosish kerak edi;
          • yopiq bo'limda nima borligini faqat kichkina izoh satri aytardi;
          • brauzerning "sahifadan qidirish"i (Ctrl+F) yopiq bo'limdagi
            matnni umuman topmasdi.

        Endi hech narsa yashirilmagan. Tartib esa akkordeondan emas,
        UCH VOSITADAN keladi:
          1. HERO — kim ekaningiz va hisobingiz holati bitta to'q kartada
             (ikat teksturasi bilan; brend hero uslubi landing bilan bir xil).
          2. BO'LIM SARLAVHALARI (`SectionHead` → umumiy `SectionLabel`)
             — har blokning tepasida nomi, islimi novdasi va bir
             qatorlik izohi; ko'z sahifani "sakrab" o'qiy oladi.
          3. SETKA — bog'liq sozlamalar yonma-yon (rol/mavzu/til uchta
             teng kartada), katta bo'limlar esa desktopda ikki ustunda.

        ⚠️ EVAZIGA: ichida so'rov yuboradigan uchta blok (qurilmalar,
        mashinalar, bloklanganlar) endi sahifa ochilishi bilan yuklanadi
        (ilgari faqat akkordeon ochilganda). Bu ATAYIN qabul qilindi:
        uchta yengil GET so'rov profil sahifasi uchun arzon, yashiringan
        sozlama esa qimmat.
      */}
      <div className="mx-auto max-w-md space-y-8 lg:max-w-5xl">
        {/* ===== 1. HERO — kim ekaningiz + hisob holati ===== */}
        {/*
          🔴 TUNGI REJIM (egasi tasdiqladi, 2026-08-19): to'q karta to'q fonda
          "eriydi". Ikkita sabab bor edi:
            • chegara `border-wine-ash` — fon bilan deyarli bir xil rang,
              ya'ni kartaning cheti UMUMAN ko'rinmasdi;
            • `shadow-lg` qora fonda hech narsa chizmaydi — yorug' temada
              chuqurlik beradigan yagona vosita tungida yo'qoladi.
          Yechim: tungida chegara turkuazga o'tadi (brend aksenti, spec
          bo'yicha "faol holat" rangi) va soya olib tashlanadi. Bu mobil
          ilovadagi qoida bilan ham bir xil: "qorong'ida soya chizilmaydi,
          sirt fondan ochroq bo'ladi" (`theme.dart`).
        */}
        <section className="relative overflow-hidden rounded-3xl border border-wine-ash bg-wine-ash p-5 text-white shadow-lg dark:border-turquoise/25 dark:shadow-none sm:p-6">
          <GirihPattern size={92} color="var(--turquoise)" opacity={0.07} />

          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() =>
                  router.push(
                    activeRole === 'driver' ? `/${locale}/dashboard` : `/${locale}/search`
                  )
                }
                /* ⚠️ `min-h-11`: «Orqaga» balandligi 28 px edi — hero
                   ustidagi eng chap tugma, barmoq eng ko'p adashadigan
                   joy (o'lchandi 2026-09-04). */
                className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-bold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ArrowRight className="h-4 w-4 rotate-180" />
                {tr('Orqaga', 'Назад', 'Back')}
              </button>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-wider text-turquoise">
                {activeRole === 'driver' ? t('roleDriver') : t('rolePassenger')}
              </span>
            </div>

            <div className="flex items-start gap-4">
              {/* Avatar — bosilsa fayl tanlash oynasi ochiladi (media/upload -> PUT /users/profile) */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={updateAvatarMutation.isPending}
                  aria-label={tr('Avatarni almashtirish', 'Изменить аватар', 'Change avatar')}
                  /* Hover/bosilganda SHAFFOF qilmaymiz (ilgari `hover:opacity-80`
                     avatarni "so'ndirardi") — urg'u halqa bilan beriladi. */
                  className="block rounded-full ring-2 ring-white/20 transition-[box-shadow] hover:ring-turquoise disabled:cursor-wait disabled:ring-turquoise/60"
                >
                  <Avatar src={profile.avatar_url} name={profile.name} size={64} />
                </button>
                <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-wine-ash text-white/70">
                  <Camera className="h-3.5 w-3.5" />
                </span>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarPick}
                  className="hidden"
                />
                {profile.avatar_url && !updateAvatarMutation.isPending && (
                  <button
                    type="button"
                    onClick={handleAvatarRemove}
                    aria-label={tr('Avatarni olib tashlash', 'Удалить аватар', 'Remove avatar')}
                    className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-wine-ash text-white/70 transition-colors hover:border-error/60 hover:text-error"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {isEditingName ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white placeholder:text-white/40 focus:border-turquoise focus:outline-none"
                      placeholder={tr('Ismingiz', 'Ваше имя', 'Your name')}
                      autoFocus
                    />

                    {/* Gender toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditedGender('male')}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition-colors ${
                          editedGender === 'male'
                            ? 'border-turquoise bg-turquoise/20 text-turquoise'
                            : 'border-white/20 text-white/60 hover:border-turquoise/50'
                        }`}
                      >
                        {tr('Erkak', 'Мужской', 'Male')}
                      </button>
                      <button
                        onClick={() => setEditedGender('female')}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition-colors ${
                          editedGender === 'female'
                            ? 'border-turquoise bg-turquoise/20 text-turquoise'
                            : 'border-white/20 text-white/60 hover:border-turquoise/50'
                        }`}
                      >
                        {tr('Ayol', 'Женский', 'Female')}
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsEditingName(false)}
                        className="px-3 py-1.5 text-xs font-bold text-white/60 transition-colors hover:text-white"
                      >
                        {tr('Bekor qilish', 'Отмена', 'Cancel')}
                      </button>
                      <button
                        onClick={handleNameSave}
                        disabled={updateProfileMutation.isPending || editedName.length < 2}
                        className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover"
                      >
                        {tr('Saqlash', 'Сохранить', 'Save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <h1
                        data-user-text
                        className={`truncate font-display text-2xl font-black leading-tight ${
                          profile.name?.trim() ? 'text-white' : 'text-white/50 italic'
                        }`}
                      >
                        {profile.name?.trim() ||
                          tr("Ismingizni qo'shing", 'Добавьте имя', 'Add your name')}
                      </h1>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold text-white/70">{profile.phone}</p>
                        {profile.gender && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
                            {profile.gender === 'male'
                              ? tr('Erkak', 'Мужской', 'Male')
                              : tr('Ayol', 'Женский', 'Female')}
                          </span>
                        )}
                      </div>
                      {/* Reyting — backend qo'shgach ko'rinadi (yo'q bo'lsa yashirin) */}
                      <RatingBadge
                        rating={(profile as { rating?: number }).rating}
                        count={(profile as { reviews_count?: number }).reviews_count}
                        className="mt-0.5 text-white"
                      />
                    </div>
                    <button
                      onClick={() => {
                        // profile.name backend'dan bo'sh/undefined kelishi mumkin — har doim
                        // string bo'lishini kafolatlaymiz (aks holda editedName.length yiqiladi).
                        setEditedName(profile.name || '');
                        setEditedGender(profile.gender || null);
                        setIsEditingName(true);
                      }}
                      aria-label={tr('Tahrirlash', 'Редактировать', 'Edit')}
                      /* ⚠️ Ikonka 16 px qoladi, MAYDONI 44 px bo'ladi:
                         qalam ismning yonida turadi va kichkina bo'lsa
                         ism ustiga bosib yuboriladi. */
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 transition-colors hover:border-turquoise/40 hover:text-turquoise"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/*
              HISOB HOLATI — uchta eng ko'p qaraladigan fakt bitta qatorda.
              Ilgari ular sahifaning uch xil joyida edi: tarif tepada,
              balans "Haydovchi" akkordeonining ichida, xavfsizlik esa "Hisob va
              xavfsizlik" akkordeonida. Uchtasini birga ko'rish uchun ikki
              marta bosish kerak edi.
            */}
            {/*
              🔴 IKKI XATO BIRGA TUZATILDI (2026-08-27):
              1. TARIF ustuni pastdagi «Tarifingiz» bo'limida BATAFSIL
                 turardi — odam bir xil narsani ikki joyda o'qirdi.
              2. Grid `grid-cols-3` deb yozilgan-u, ichida ATIGI IKKITA
                 ustun bor edi — o'ngdan uchdan bir qism BO'SH qolardi va
                 blok qiyshiq ko'rinardi.
              Qolgani bitta fakt, ya'ni endi grid ham kerak emas: oddiy
              qator qiyshiq bo'lolmaydi.
            */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-white/70">
                {t('balance')}
              </p>
              <p className="truncate text-sm font-extrabold text-turquoise">
                {/* Manba — obuna (`useCurrentPlan`), profil keshidagi xom son EMAS:
                    backend `rides_left: -1` berganda bu yerda "-1" turardi. */}
                {formatBalance(
                  { isUnlimited: planIsUnlimited, ridesLeft, planKnown: planKnown },
                  locale
                )}
              </p>
            </div>
          </div>
        </section>

        {/* PROFIL TO'LIQLIGI — sarlavhadan DARHOL keyin.
            Rasmsiz profil bron olishi qiyin, lekin odam buni bilmaydi:
            u «nega meni qabul qilishmayapti?» deb o'ylaydi. Hammasi
            to'ldirilgan bo'lsa karta O'ZI chizilmaydi (shovqin bo'lmasin).
            Izohi `ProfileCompleteness` da. */}
        <ProfileCompleteness profile={profile} onName={() => setIsEditingName(true)} />

        {/* ISHONCH NARVONI — «meni qanday ko'rishadi». Ilgari dalillar
            sahifaga tarqoq sochilgan edi. Izohi `shared/lib/trust.ts` da. */}
        <TrustLadder user={{ rating: profile.rating, rating_count: profile.reviews_count }} />

        {/* «YO'LLARIM» — 16.09.2026 (egasi: «karta to'liq ishlatilsin»).

            🔴 Profilda reyting va sharhlar bor edi, lekin odam QAYERLARDA
            bo'lgani — platformadagi eng shaxsiy narsa — hech qayerda
            ko'rinmasdi.

            To'liqlik va ishonchdan KEYIN turadi: ular ish (bajarish
            kerak), yo'llar esa mukofot. Safar bo'lmasa karta umuman
            chizilmaydi. Izohi `MyRoadsMap` da. */}
        <MyRoadsMap />

        {/* ===== 2. SOZLAMALAR — uchta teng karta ===== */}
        <div className="space-y-3">
          <SectionHead
            icon={<SlidersHorizontal className="h-4.5 w-4.5" />}
            title={tr('Sozlamalar', 'Настройки', 'Preferences')}
            hint={tr(
              'Rol, mavzu va til — uchtasi ham shu yerda',
              'Роль, тема и язык — всё здесь',
              'Role, theme and language — all in one place'
            )}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Rol */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-text-muted">
                {tr('Faol rolingiz', 'Активная роль', 'Active role')}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-extrabold transition-colors ${activeRole === 'passenger' ? 'text-accent' : 'text-text-muted'}`}
                >
                  {tr("Yo'lovchi", 'Пассажир', 'Passenger')}
                </span>
                <Switch
                  ariaLabel={tr('Haydovchi rejimi', 'Режим водителя', 'Driver mode')}
                  checked={activeRole === 'driver'}
                  onChange={handleRoleToggle}
                />
                <span
                  className={`text-xs font-extrabold transition-colors ${activeRole === 'driver' ? 'text-accent' : 'text-text-muted'}`}
                >
                  {tr('Haydovchi', 'Водитель', 'Driver')}
                </span>
              </div>
            </div>

            {/* Mavzu (light/dark) — kechasi qulaylik uchun. Tanlov saqlanadi. */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-text-muted">
                {tr('Mavzu', 'Тема', 'Theme')}
              </p>
              {/* ⚠️ Bandlar balandligi 28 px edi (o'lchandi 2026-09-04).
                  Segment BUTUN ENGDA turadi, ya'ni band eni katta — shu
                  sababdan bu yerda 44 emas, 40 px yetarli (o'ram bilan
                  birga 44 chiqadi va karta cho'zilib ketmaydi). */}
              <div className="mt-3 flex items-center gap-0.5 rounded-xl border border-border bg-bg p-0.5">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-extrabold transition-colors ${
                    theme === 'light'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  {tr("Yorug'", 'Светлая', 'Light')}
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-extrabold transition-colors ${
                    theme === 'dark'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  {tr('Tungi', 'Тёмная', 'Dark')}
                </button>
              </div>

              {/* USLUB — Klassik / Neon (egasi, 2026-08-20). Yorug'likдан
                  alohida o'lchov, lekin bog'liq (ko'rinish), shu sabab shu
                  kartada. */}
              <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wider text-text-muted">
                {tr('Uslub', 'Стиль', 'Style')}
              </p>
              <div className="mt-2 flex items-center gap-0.5 rounded-xl border border-border bg-bg p-0.5">
                <button
                  onClick={() => setStyle('classic')}
                  className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-extrabold transition-colors ${
                    style === 'classic'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {tr('Klassik', 'Классический', 'Classic')}
                </button>
                <button
                  onClick={() => setStyle('neon')}
                  className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-extrabold transition-colors ${
                    style === 'neon'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {tr('Neon', 'Неон', 'Neon')}
                </button>
              </div>
            </div>

            {/* Til */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-text-muted">
                {tr('Til sozlamasi', 'Язык интерфейса', 'Interface language')}
              </p>
              <div className="mt-3">
                <LocaleSwitch />
              </div>
            </div>
          </div>
        </div>

        {/* KATTAROQ MATN — sozlamalar bilan bir joyda. Foydalanuvchilarning
            katta qismi keksa odamlar; brauzer masshtabi butun sahifani
            (jumladan xaritani) cho'zadi, bu esa faqat matnni. */}
        <BigTextToggle />

        {/* ===== 3. TARIF ===== */}
        <div className="space-y-3">
          <SectionHead
            icon={<CreditCard className="h-4.5 w-4.5" />}
            title={tr('Tarifingiz', 'Ваш тариф', 'Your plan')}
            hint={tr(
              "E'lon berish uchun safar paketi",
              'Пакет поездок для публикации объявлений',
              'The ride package you publish listings from'
            )}
          />
          <CurrentPlanCard compact showBalance={false} />
        </div>

        {/* ===== 4. HAYDOVCHI =====
            🔴 TARTIB TUZATILDI (2026-08-27): tekshiruv holati TARIF bilan
            MASHINALAR orasida turardi. Haydovchi uchun «hujjatim
            o'tdimi», «mashinalarim» va «daromadim» — BITTA ish, ular
            ajratilgan edi va odam ular orasida tarifni o'qirdi.

            TEKSHIRUV HOLATI roldan QAT'IY NAZAR ko'rsatiladi: odam hujjat
            yuborgach "nima bo'ldi?" degan savolga javobni birinchi
            navbatda profilda izlaydi. */}
        <KycStatusCard
          status={profile.kyc_status}
          reason={profile.kyc_rejection_reason}
          locale={locale}
        />

        {activeRole === 'driver' && profile.is_driver && (
          <div className="space-y-3">
            <SectionHead
              icon={<Car className="h-4.5 w-4.5" />}
              title={tr('Mashinalarim', 'Мои автомобили', 'My cars')}
              hint={tr(
                "E'lon berishda shu ro'yxatdan tanlanadi",
                'Из этого списка выбирается авто при публикации',
                'You pick from this list when publishing a ride'
              )}
            />
            <VehiclesSection />
          </div>
        )}

        {/* ===== 5. HISOB VA XAVFSIZLIK — desktopda ikki ustun ===== */}
        <div className="space-y-3">
          <SectionHead
            icon={<ShieldCheck className="h-4.5 w-4.5" />}
            title={tr('Hisob va xavfsizlik', 'Аккаунт и безопасность', 'Account and security')}
            hint={tr(
              'Parol, kirilgan qurilmalar',
              'Пароль, устройства',
              'Password, signed-in devices'
            )}
          />
          {/*
            `items-start` MUHIM: usiz setka qatorlari eng baland kartaga
            tenglashadi va kalta kartaning ostida katta bo'shliq qoladi
            (tariflar sahifasida aynan shu xato tuzatilgan edi).
          */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {/* Parol o'rnatish — keyin SMS'siz kirish uchun */}
            <PasswordSection />

            {/* Kirilgan qurilmalar — `GET /auth/sessions`. */}
            <SessionsSection />

            {/* Bloklanganlar — bloklash chatdan qilinadi, bekor qilish faqat shu yerda.
                Ro'yxat bo'sh bo'lsa komponent o'zi hech narsa chizmaydi. */}
            <BlockedUsersSection />
          </div>
        </div>

        {/* ===== 6. YORDAM VA HUJJATLAR ===== */}
        <div className="space-y-3">
          {/* DO'STNI CHAQIRISH — o'sishning eng arzon kanali. Bazada odam
              kam bo'lgani uchun yangi foydalanuvchi bo'sh qidiruvni ko'radi
              va qaytmaydi. Izohi `InviteCard` da. */}
          <InviteCard />

          <SectionHead
            icon={<LifeBuoy className="h-4.5 w-4.5" />}
            title={tr('Yordam va hujjatlar', 'Помощь и документы', 'Help and documents')}
            hint={tr(
              'Murojaat, maxfiylik siyosati, ommaviy oferta',
              'Обращение, политика конфиденциальности, оферта',
              'Contact support, privacy policy, terms of service'
            )}
          />
          {/*
            🔴 Bu uchtasi ilgari sahifaning eng pastida, kulrang mayda
            havolalar qatori edi. Maxfiylik siyosati va oferta esa do'kon
            talabi — ular topilmasa reliz rad etiladi. Endi ular boshqa
            bo'limlar bilan bir xil og'irlikdagi kartalarda.
            "Yordam" Telegramga TO'G'RIDAN olib chiqmaydi: sayt ichidagi
            murojaat oynasi texnik ma'lumotni (brauzer, sahifa) o'zi
            qo'shadi, ya'ni operator so'ramaydi.
          */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition-colors hover:border-accent/40"
            >
              <LifeBuoy className="h-5 w-5 shrink-0 text-accent" />
              <span className="text-sm font-bold text-text">{tr('Yordam', 'Помощь', 'Help')}</span>
            </button>
            {/* XIZMAT HOLATI — sahifa bor edi, lekin unga FAQAT bo'sh
                qidiruvdan borish mumkin edi. Odam «sayt ishlayaptimi?»
                degan savolni aynan profilda izlaydi. */}
            <Link
              href={`/${locale}/status`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent/40"
            >
              <Activity className="h-5 w-5 shrink-0 text-accent" />
              <span className="text-sm font-bold text-text">
                {tr('Xizmat holati', 'Состояние сервиса', 'Service status')}
              </span>
            </Link>
            <Link
              href={`/${locale}/privacy`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent/40"
            >
              <ShieldCheck className="h-5 w-5 shrink-0 text-accent" />
              <span className="text-sm font-bold text-text">
                {tr('Maxfiylik', 'Конфиденциальность', 'Privacy')}
              </span>
            </Link>
            <Link
              href={`/${locale}/terms`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent/40"
            >
              <FileText className="h-5 w-5 shrink-0 text-accent" />
              <span className="text-sm font-bold text-text">{tr('Oferta', 'Оферта', 'Terms')}</span>
            </Link>
          </div>
        </div>

        {/* Suzani ajratgich — oxirgi (qaytarib bo'lmaydigan) amallardan oldin
            ko'zga ko'rinadigan chegara. Bezak ham, ogohlantirish ham. */}
        <OrnamentMark className="py-2" />

        {/* Chiqish — to'liq kenglikda */}
        <button
          onClick={() => performLogout(queryClient, locale)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-error/20 bg-error/10 py-3.5 text-sm font-bold text-error transition-colors hover:bg-error/20 active:scale-[0.98]"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span>{tCommon('logout')}</span>
        </button>

        {/* Hisobni o'chirish — Google Play 2024-dan MAJBURIY qilgan (ilova ichida
            + ochiq veb-sahifa; sahifa /[locale]/account-delete da tayyor).
            Chiqishdan pastda va kamroq urg'u bilan: tasodifan bosilmasin. */}
        <DeleteAccountSection locale={locale} />

        <SupportSheet open={supportOpen} onClose={() => setSupportOpen(false)} />
      </div>
    </div>
  );
}
