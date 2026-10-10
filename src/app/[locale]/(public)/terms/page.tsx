'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM, SUPPORT_TELEGRAM_URL } from '@/shared/config/contacts';
import { useTr } from '@/shared/lib/useTr';
import { pickFor } from '@/shared/lib/i18n';

// Foydalanish shartlari — to'liq matn (uz/ru). Yuridik rekvizitlar aniqlashgach
// "Operator" bo'limi qo'shiladi.
export default function TermsPage() {
  const locale = useLocale();
  const tr = useTr();

  const sections: { t: string; body: string[] }[] = pickFor(locale)(
    [
      {
        t: '1. Xizmat mohiyati',
        body: [
          "YolYolakay — haydovchi va yo'lovchilarni yo'l-yo'lakay safarlar uchun bog'laydigan platforma. Xizmat TASHUVCHI EMAS: safarni haydovchi o'z nomidan taklif qiladi, tomonlar shartlarni (narx, vaqt, joy) o'zaro kelishadi.",
        ],
      },
      {
        t: "2. Ro'yxatdan o'tish",
        body: [
          "Xizmatdan foydalanish uchun haqiqiy telefon raqami bilan ro'yxatdan o'tish talab qilinadi. Hisob shaxsiy; uni boshqaga berish taqiqlanadi. 18 yoshga to'lmagan shaxslar haydovchi sifatida ro'yxatdan o'ta olmaydi.",
        ],
      },
      {
        t: '3. Haydovchi majburiyatlari',
        body: [
          "• Haqiqiy avtomobil ma'lumotlarini ko'rsatish, o'z suratini va avtomobilning old, orqa, yon suratlarini yuklash hamda tekshiruvdan o'tish;",
          "• Haydovchilik guvohnomasi, sug'urta va texnik ko'rikning amal qilishini ta'minlash;",
          "• E'lon qilingan safarga mas'uliyat bilan yondashish: kelishilgan joy va vaqtda bo'lish yoki oldindan bekor qilish.",
        ],
      },
      {
        t: "4. Yo'lovchi majburiyatlari",
        body: [
          "Bron qilingan safarga o'z vaqtida kelish, kelisha olmagan taqdirda bronni oldindan bekor qilish. Kelmay qolish (no-show) hisobga vaqtinchalik cheklov qo'yilishiga olib kelishi mumkin.",
        ],
      },
      {
        t: "5. Tariflar va to'lovlar",
        body: [
          "Xizmat obuna/paket asosida ishlaydi: har bir e'lon yoki bron balansdan bitta amalni sarflaydi. Safar narxi tomonlar o'rtasida kelishiladi va to'g'ridan-to'g'ri hisob-kitob qilinadi — Xizmat safar haqini undirmaydi.",
        ],
      },
      {
        t: '6. Taqiqlar',
        body: [
          "Yolg'on ma'lumot kiritish, boshqa shaxs nomidan hisob ochish, haqoratli muloqot, spam, qonunga zid yuklarni tashish va Xizmatdan tijorat yo'lovchi tashish litsenziyasisiz muntazam daromad maqsadida foydalanish taqiqlanadi. Qoidabuzarlik hisobni bloklashga olib keladi.",
        ],
      },
      {
        t: "7. Mas'uliyat chegarasi",
        body: [
          "Xizmat tomonlar o'rtasidagi kelishuv bajarilishiga, yo'l harakati xavfsizligiga va yetkazilgan zararga javob bermaydi; nizolar tomonlar o'rtasida hal qilinadi. Xizmat platforma ishlashini ta'minlash uchun oqilona choralarni ko'radi, lekin uzluksizlikka mutlaq kafolat bermaydi.",
        ],
      },
      {
        t: "8. O'zgarishlar",
        body: [
          'Shartlar yangilanishi mumkin; davom etayotgan foydalanish yangilangan shartlarga rozilik hisoblanadi. Amaldagi tahrir: 2026-yil iyul.',
        ],
      },
    ],
    [
      {
        t: '1. Суть сервиса',
        body: [
          'YolYolakay — платформа, соединяющая водителей и пассажиров для попутных поездок. Сервис НЕ ЯВЛЯЕТСЯ перевозчиком: поездку предлагает водитель от своего имени, условия (цена, время, место) стороны согласуют между собой.',
        ],
      },
      {
        t: '2. Регистрация',
        body: [
          'Для использования Сервиса требуется регистрация с действующим номером телефона. Аккаунт персональный; передача его другим лицам запрещена. Лица младше 18 лет не могут регистрироваться как водители.',
        ],
      },
      {
        t: '3. Обязанности водителя',
        body: [
          '• Указывать достоверные данные автомобиля, загружать своё фото и снимки автомобиля спереди, сзади и сбоку и проходить проверку;',
          '• Обеспечивать действительность водительского удостоверения, страховки и техосмотра;',
          '• Ответственно относиться к опубликованной поездке: быть в согласованном месте вовремя либо отменять заранее.',
        ],
      },
      {
        t: '4. Обязанности пассажира',
        body: [
          'Приходить к забронированной поездке вовремя, при невозможности — отменять бронь заранее. Неявка (no-show) может привести к временному ограничению аккаунта.',
        ],
      },
      {
        t: '5. Тарифы и оплата',
        body: [
          'Сервис работает по подписке/пакетам: каждое объявление или бронь списывает одно действие с баланса. Цена поездки согласуется сторонами и рассчитывается напрямую — Сервис не взимает плату за проезд.',
        ],
      },
      {
        t: '6. Запреты',
        body: [
          'Запрещены: ложные данные, аккаунты от чужого имени, оскорбительное общение, спам, перевозка незаконных грузов и систематическое коммерческое использование без лицензии на пассажирские перевозки. Нарушения ведут к блокировке аккаунта.',
        ],
      },
      {
        t: '7. Ограничение ответственности',
        body: [
          'Сервис не отвечает за исполнение договорённостей между сторонами, безопасность дорожного движения и причинённый ущерб; споры решаются между сторонами. Сервис принимает разумные меры для стабильной работы платформы, но не даёт абсолютных гарантий непрерывности.',
        ],
      },
      {
        t: '8. Изменения',
        body: [
          'Условия могут обновляться; продолжение использования означает согласие с обновлённой редакцией. Действующая редакция: июль 2026 г.',
        ],
      },
    ],
    [
      {
        t: '1. What the service is',
        body: [
          'YolYolakay is a platform that connects drivers and passengers for shared rides. The Service is NOT a carrier: the trip is offered by the driver in their own name, and the parties agree the terms (price, time, place) between themselves.',
        ],
      },
      {
        t: '2. Registration',
        body: [
          'Using the Service requires registration with a valid phone number. An account is personal; sharing it with others is prohibited. People under 18 cannot register as drivers.',
        ],
      },
      {
        t: '3. Driver obligations',
        body: [
          '• Provide accurate car details, upload your photo and front, rear and side photos of the car, and pass verification;',
          '• Keep the driving licence, insurance and technical inspection valid;',
          '• Treat a published trip responsibly: be at the agreed place on time, or cancel in advance.',
        ],
      },
      {
        t: '4. Passenger obligations',
        body: [
          'Arrive on time for a booked trip and cancel in advance if you cannot make it. A no-show may lead to a temporary restriction on your account.',
        ],
      },
      {
        t: '5. Plans and payments',
        body: [
          'The Service works on a subscription/package basis: each published trip or booking uses one action from your balance. The ride price is agreed between the parties and settled directly — the Service does not collect the fare.',
        ],
      },
      {
        t: '6. Prohibited use',
        body: [
          "It is prohibited to provide false information, create an account in someone else's name, use abusive language, send spam, transport illegal goods, or use the Service for regular commercial passenger transport without a licence. Violations lead to account suspension.",
        ],
      },
      {
        t: '7. Limitation of liability',
        body: [
          'The Service is not liable for the fulfilment of the agreement between the parties, for road safety, or for any damage caused; disputes are resolved between the parties. The Service takes reasonable measures to keep the platform running but does not guarantee uninterrupted availability.',
        ],
      },
      {
        t: '8. Changes',
        body: [
          'These terms may be updated; continued use means acceptance of the updated terms. Current version: July 2026.',
        ],
      },
    ]
  );

  return (
    <div className="flex-1 bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/${locale}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr('Bosh sahifa', 'На главную', 'Home')}
        </Link>

        <h1 className="font-display mt-6 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          {tr('Foydalanish shartlari', 'Условия использования', 'Terms of use')}
        </h1>

        <div className="mt-8 space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          {sections.map((s) => (
            <section key={s.t} className="space-y-2">
              <h2 className="text-base font-extrabold text-text">{s.t}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-text-muted whitespace-pre-line">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <section className="space-y-1 border-t border-border pt-4">
            <h2 className="text-base font-extrabold text-text">
              {tr("Bog'lanish", 'Контакты', 'Contact')}
            </h2>
            {/* Telegram BIRINCHI — pochta hali ishlamaydi (contacts.ts izohi). */}
            <a
              href={SUPPORT_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block py-2 text-sm font-semibold text-accent hover:underline"
            >
              {SUPPORT_TELEGRAM}
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="block py-2 text-sm font-semibold text-accent hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
