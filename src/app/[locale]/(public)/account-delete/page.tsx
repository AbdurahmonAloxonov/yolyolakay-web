'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft, Mail, Smartphone, Clock, Trash2, MessageCircle } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM, SUPPORT_TELEGRAM_URL } from '@/shared/config/contacts';
import { useTr } from '@/shared/lib/useTr';
import { pickFor } from '@/shared/lib/i18n';

/**
 * Hisobni o'chirish — Google Play MAJBURIY talabi (2024-yildan).
 *
 * Play ikkita narsani so'raydi: (a) ilova ichida o'chirish yo'li, (b) ilovasiz,
 * KIRMASDAN ochiladigan veb-sahifa — moderator uni brauzerda tekshiradi.
 * Shuning uchun bu sahifa `(public)` guruhida va AuthGuard'da `isLegal` ga
 * qo'shilgan (privacy/terms bilan bir qatorda).
 *
 * ✅ 2026-07-31: `DELETE /users/me` backendda paydo bo'ldi (yumshoq o'chirish +
 * telefon raqamini anonimlashtirish), ilova ichidagi tugma ham ishlaydi. Pochta
 * yo'li ikkinchi variant sifatida QOLDIRILDI — ilovasiz foydalanuvchi uchun.
 *
 * ⚠️ Saqlanish muddatlari YURIDIK jihatdan tasdiqlanishi kerak — bu yerda
 * taxminiy raqam YOZILMAGAN, ataylab umumiy ta'rif berilgan.
 */
export default function AccountDeletePage() {
  const locale = useLocale();
  const tr = useTr();
  const t = useTr();

  const deleted = pickFor(locale)(
    [
      'Ism, familiya va jins',
      'Telefon raqami va parol',
      'Profil reytingi va sizga yozilgan sharhlar',
      "Avtomobil ma'lumotlari (rusum, rang, davlat raqami, texpasport surati)",
      'Chat xabarlari va suhbatlar tarixi',
      'Bildirishnoma tokenlari (push) va qurilma sessiyalari',
      "Saqlangan yo'nalishlar va qidiruv tarixi",
    ],
    [
      'Имя, фамилия и пол',
      'Номер телефона и пароль',
      'Рейтинг профиля и оставленные вам отзывы',
      'Данные автомобиля (марка, цвет, госномер, фото техпаспорта)',
      'Сообщения в чатах и история переписки',
      'Токены уведомлений (push) и сессии устройств',
      'Сохранённые маршруты и история поиска',
    ],
    [
      'First name, last name and gender',
      'Phone number and password',
      'Profile rating and reviews written about you',
      'Car details (make, colour, plate number, registration photo)',
      'Chat messages and conversation history',
      'Notification (push) tokens and device sessions',
      'Saved routes and search history',
    ]
  );

  const retained = pickFor(locale)(
    [
      "To'lov va hisob-kitob yozuvlari — buxgalteriya va soliq qonunchiligi talab qiladigan muddat davomida",
      "Tugallangan safarlar bo'yicha shaxssizlantirilgan yozuv (sana, yo'nalish, summa) — sizning ismingiz va telefoningizsiz",
      "Nizo yoki huquqbuzarlik bo'yicha ochilgan ish materiallari — ish yakunlanguncha",
    ],
    [
      'Платёжные и расчётные записи — в течение срока, требуемого бухгалтерским и налоговым законодательством',
      'Обезличенная запись о завершённых поездках (дата, маршрут, сумма) — без вашего имени и телефона',
      'Материалы по открытым спорам или нарушениям — до завершения разбирательства',
    ],
    [
      'Payment and accounting records — for the period required by accounting and tax law',
      'An anonymised record of completed trips (date, route, amount) — without your name or phone number',
      'Materials of open disputes or violation cases — until the case is closed',
    ]
  );

  return (
    <div className="flex-1 bg-bg px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* ⚠️ Bosiladigan maydon 44 px: o'lchandi — 20 px edi. */}
        <Link
          href={`/${locale}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('Bosh sahifaga', 'На главную', 'Go home')}
        </Link>

        <header className="space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-error/20 bg-error/10 text-error">
            <Trash2 className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {t("Hisobni o'chirish", 'Удаление аккаунта', 'Delete account')}
          </h1>
          <p className="text-sm leading-relaxed text-text-muted">
            {t(
              "Bu sahifada YolYolakay hisobingizni va u bilan bog'liq ma'lumotlarni qanday o'chirish mumkinligi tushuntiriladi.",
              'На этой странице описано, как удалить аккаунт YolYolakay и связанные с ним данные.',
              'This page explains how to delete your YolYolakay account and the data associated with it.'
            )}
          </p>
        </header>

        {/* Qanday so'rov yuborish */}
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold text-foreground">
            {t("Qanday o'chiriladi", 'Как удалить', 'How to delete')}
          </h2>

          {/*
            Telegram BIRINCHI turadi. Sabab texnik: pochta domenida MX haqiqiy
            provayderni ko'rsatmaydi (contacts.ts izohi), ya'ni pastdagi manzilga
            yozilgan xat hozircha hech kimga bormaydi. Play moderatori esa aynan
            shu sahifadan ISHLAYDIGAN kanal topishi kerak.
          */}
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 space-y-2">
                <h3 className="font-bold text-text">
                  {t(
                    "Telegram orqali so'rov (tezkor)",
                    'Запрос через Telegram (быстрее)',
                    'Request via Telegram (fastest)'
                  )}
                </h3>
                <p className="text-sm leading-relaxed text-text-muted">
                  {t(
                    "Qo'llab-quvvatlash botiga yozing va hisobingiz ro'yxatdan o'tgan telefon raqamini ko'rsating:",
                    'Напишите боту поддержки и укажите номер телефона, на который зарегистрирован аккаунт:',
                    'Message our support bot and state the phone number your account is registered with:'
                  )}
                </p>
                <a
                  href={SUPPORT_TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-bold text-accent underline-offset-4 hover:underline"
                >
                  {SUPPORT_TELEGRAM}
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 space-y-2">
                <h3 className="font-bold text-text">
                  {t("Pochta orqali so'rov", 'Запрос по электронной почте', 'Request by email')}
                </h3>
                <p className="text-sm leading-relaxed text-text-muted">
                  {t(
                    "Hisobingiz ro'yxatdan o'tgan telefon raqamini ko'rsatib, quyidagi manzilga xat yuboring:",
                    'Отправьте письмо на адрес ниже, указав номер телефона, на который зарегистрирован аккаунт:',
                    'Send an email to the address below, stating the phone number your account is registered with:'
                  )}
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                    tr(
                      "Hisobni o'chirish so'rovi",
                      'Запрос на удаление аккаунта',
                      'Account deletion request'
                    )
                  )}`}
                  className="inline-flex min-h-11 items-center font-bold text-accent underline-offset-4 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                <p className="text-xs text-text-muted">
                  {t(
                    "So'rovni faqat hisob egasi yuborishi mumkin — shaxsingizni tasdiqlash uchun qo'shimcha savol berilishi mumkin.",
                    'Запрос может отправить только владелец аккаунта — для подтверждения личности могут быть заданы уточняющие вопросы.',
                    'Only the account owner may send the request — we may ask additional questions to verify your identity.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 space-y-2">
                <h3 className="font-bold text-text">
                  {t('Ilova orqali', 'Через приложение', 'In the app')}
                </h3>
                <p className="text-sm leading-relaxed text-text-muted">
                  {t(
                    "Profil → Hisobni o'chirish. Bu imkoniyat hozir tayyorlanmoqda; shu vaqtgacha yuqoridagi pochta manzilidan foydalaning.",
                    'Профиль → Удалить аккаунт. Эта возможность сейчас готовится; до её появления используйте адрес почты выше.',
                    'Profile → Delete account. This option is being prepared; until then, please use the email address above.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Nima o'chadi */}
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold text-foreground">
            {t("Qanday ma'lumotlar o'chiriladi", 'Какие данные удаляются', 'What data is deleted')}
          </h2>
          <ul className="space-y-2 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            {deleted.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-text">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-error" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Nima saqlanadi */}
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold text-foreground">
            {t("Qanday ma'lumotlar saqlanadi", 'Какие данные сохраняются', 'What data is kept')}
          </h2>
          <ul className="space-y-2 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            {retained.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-text">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Muddat */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div className="space-y-2">
              <h2 className="font-bold text-text">{t('Muddatlar', 'Сроки', 'Timelines')}</h2>
              {/*
                MATN BACKEND XULQIGA MOSLANDI (2026-07-31): o'chirish so'rovi bajarilishi
                bilanoq hisob yopiladi va telefon raqami hisobdan uziladi — demak "kirsangiz
                bekor bo'ladi" degan avvalgi va'da BAJARILMAS edi (kira olmaysiz).
                Sahifadagi va'da bilan haqiqat orasidagi farq — Play uchun alohida buzilish.
              */}
              <p className="text-sm leading-relaxed text-text-muted">
                {t(
                  "So'rov qabul qilingan zahoti hisob yopiladi va unga kirib bo'lmaydi. Ma'lumotlar 30 kun ichida butunlay o'chiriladi.",
                  'Как только запрос принят, аккаунт закрывается и войти в него уже нельзя. Данные полностью удаляются в течение 30 дней.',
                  'Once the request is accepted the account is closed and can no longer be accessed. The data is fully deleted within 30 days.'
                )}
              </p>
              <p className="text-sm leading-relaxed text-text-muted">
                {t(
                  `Xatolik bo'lsa, shu muddat ichida ${SUPPORT_EMAIL} ga yozing — imkoni bo'lsa tiklashga harakat qilamiz.`,
                  `Если это ошибка, напишите в течение этого срока на ${SUPPORT_EMAIL} — постараемся восстановить, если это ещё возможно.`,
                  `If this was a mistake, write to ${SUPPORT_EMAIL} within this period — we will try to restore the account if it is still possible.`
                )}
              </p>
              <p className="text-sm leading-relaxed text-text-muted">
                {t(
                  "O'chirilgandan so'ng hisobni tiklab bo'lmaydi — safarlar tarixi, reyting va sharhlar qaytarilmaydi.",
                  'После удаления аккаунт восстановить нельзя — история поездок, рейтинг и отзывы не возвращаются.',
                  'After deletion the account cannot be restored — trip history, rating and reviews are gone for good.'
                )}
              </p>
            </div>
          </div>
        </section>

        <p className="text-sm text-text-muted">
          {t('Shuningdek: ', 'См. также: ', 'See also: ')}
          <Link
            href={`/${locale}/privacy`}
            className="inline-flex min-h-11 items-center font-bold text-accent underline-offset-4 hover:underline"
          >
            {t('Maxfiylik siyosati', 'Политика конфиденциальности', 'Privacy policy')}
          </Link>
          {' · '}
          <Link
            href={`/${locale}/terms`}
            className="inline-flex min-h-11 items-center font-bold text-accent underline-offset-4 hover:underline"
          >
            {t('Foydalanish shartlari', 'Условия использования', 'Terms of use')}
          </Link>
        </p>
      </div>
    </div>
  );
}
