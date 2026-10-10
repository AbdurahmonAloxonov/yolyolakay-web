'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM, SUPPORT_TELEGRAM_URL } from '@/shared/config/contacts';
import { useTr } from '@/shared/lib/useTr';
import { pickFor } from '@/shared/lib/i18n';

// Maxfiylik siyosati — to'liq matn (uz/ru/en). Yuridik rekvizitlar aniqlashgach
// "Operator" bo'limiga kompaniya nomi/manzili qo'shiladi.
export default function PrivacyPage() {
  const locale = useLocale();
  const tr = useTr();

  const sections: { t: string; body: string[] }[] = pickFor(locale)(
    [
      {
        t: '1. Umumiy qoidalar',
        body: [
          "Ushbu Maxfiylik siyosati YolYolakay xizmati (keyingi o'rinlarda — «Xizmat») foydalanuvchilarining shaxsiy ma'lumotlari qanday to'planishi, ishlatilishi va himoya qilinishini belgilaydi. Xizmatdan foydalanish orqali siz ushbu siyosatga rozilik bildirasiz.",
        ],
      },
      {
        t: "2. To'planadigan ma'lumotlar",
        body: [
          "• Telefon raqami, ism va jins — ro'yxatdan o'tishda;",
          "• Avtomobil ma'lumotlari (rusumi, rangi, davlat raqami) — haydovchilar uchun;",
          "• Safar ma'lumotlari: yo'nalish shaharlari, jo'nash nuqtasi koordinatalari, sana/vaqt, narx;",
          "• Haydovchi va yo'lovchi o'rtasidagi chat xabarlari — safarni tashkil qilish doirasida;",
          "• Baholar va sharhlar; texnik ma'lumotlar (qurilma identifikatori, sessiya);",
          "• Rasmlar — faqat siz yuklasangiz: profil surati; haydovchi bo'lish uchun avtomobil va texpasport surati. Texpasport surati arizani tekshirish uchun ishlatiladi va ochiq ko'rsatilmaydi;",
          "• Xizmatdan foydalanish statistikasi: qidiruv qilinganligi va nechta natija chiqqani, safar ochilgani, bron va e'lon berilgani, tarif tanlangani. Bu yozuvlarga ism, telefon raqami, chat matni va aniq manzil KIRMAYDI — faqat sonlar va identifikatorlar. Maqsad: qaysi yo'nalishlarda safar yetishmayotganini ko'rish va xizmatni tuzatish.",
        ],
      },
      {
        t: "3. Ma'lumotlardan foydalanish maqsadi",
        body: [
          "Ma'lumotlar faqat Xizmat ishlashi uchun ishlatiladi: safarlarni topish va bron qilish, tomonlarni bir-biriga ko'rsatish (ism, reyting, avtomobil), xavfsizlik (haydovchi identifikatsiyasi), to'lovlarni qayta ishlash va qonun talablari doirasidagi majburiyatlar.",
          "Telefon raqamingiz qidiruvda va begonalarga KO'RSATILMAYDI. U faqat bron TASDIQLANGANDAN keyin va faqat o'sha safarning ikkinchi tarafiga ochiladi — uchrashish joyini aniqlash uchun. Bundan tashqari aloqa ilova ichidagi chat orqali amalga oshiriladi.",
        ],
      },
      {
        t: '4. Uchinchi shaxslarga berish',
        body: [
          "Ma'lumotlar sotilmaydi. Ular faqat: (a) safar bo'yicha ikkinchi tomonga zarur hajmda (ism, reyting, avtomobil); (b) to'lov provayderlariga to'lovni o'tkazish uchun; (c) qonunda belgilangan hollarda vakolatli organlarga beriladi.",
        ],
      },
      {
        t: '5. Saqlash va himoya',
        body: [
          "Ma'lumotlar shifrlangan kanal (HTTPS) orqali uzatiladi va cheklangan kirishli serverlarda saqlanadi. Hisob o'chirilganda shaxsiy ma'lumotlar qonunda talab qilingan muddatlardan tashqari saqlanmaydi.",
        ],
      },
      {
        t: '6. Foydalanuvchi huquqlari',
        body: [
          "Siz o'z ma'lumotlaringizni ko'rish, tuzatish (profil orqali) va hisobni o'chirishni so'rash huquqiga egasiz. Murojaat uchun quyidagi manzilga yozing.",
        ],
      },
      {
        // 🔴 2026-08-30: HAYDOVCHIDA FON REJIMI PAYDO BO'LDI (oldingi
        // plan xizmati). Bu yerda ilgari «Fon rejimida kuzatish yo'q»
        // deb yozilgan edi va u endi YOLG'ON bo'lardi — Play siyosatni
        // manifest bilan solishtiradi va aynan shunday nomuvofiqlik
        // uchun relizni rad etadi.
        //
        // 🔴 PLAY TALABI (2026-08-24): 1020 versiyada mikrofon ruxsati
        // paydo bo'ldi (ovozli qidiruv). Play "Data safety" deklaratsiyasini
        // SHU sahifa bilan solishtiradi — manifestda ruxsat bor-u siyosatda
        // aytilmagan bo'lsa, bu nomuvofiqlik va relizni rad etish sababi.
        // Ro'yxat manifestdagi ruxsatlar bilan MOS turishi kerak: yangi
        // ruxsat qo'shsangiz shu yerga ham qo'shing.
        t: '7. Qurilma ruxsatlari',
        body: [
          "• Mikrofon — faqat safar qidirishda yo'nalishni ovoz bilan aytish uchun. U faqat siz mikrofon tugmasini bosganingizda yoqiladi va gap tugashi bilan o'chadi. Ovoz yozib olinmaydi, saqlanmaydi va serverga yuborilmaydi: nutqni qurilmangizning o'z xizmati taniydi, ilova esa faqat matnni oladi va uni telefon ichida shahar nomiga aylantiradi;",
          "• Joylashuv — ikki holatda. Birinchisi: xaritadan nuqta tanlashda «mening joylashuvim» tugmasi bosilganda. Ikkinchisi: siz HAYDOVCHI bo'lsangiz va safarni «boshlandi» deb belgilagan bo'lsangiz — o'sha safar davomida joylashuvingiz o'sha safarga chiqqan yo'lovchilarga xaritada ko'rinib turadi, telefon qulflangan bo'lsa ham. Bu paytda tizim panelida doimiy bildirishnoma turadi va uni yashirib bo'lmaydi. Safar tugashi bilan yuborish DARHOL to'xtaydi. Yo'lovchi sifatida joylashuvingiz hech qachon fonda yuborilmaydi;",
          '• Bildirishnomalar — safar, bron va chat haqida xabar berish uchun;',
          '• Kamera va galereya — faqat siz surat yuklaganingizda (profil surati, avtomobil, texpasport).',
          'Har bir ruxsatni istalgan vaqtda telefon sozlamalarida bekor qilishingiz mumkin; ilovaning qolgan qismi ishlashda davom etadi.',
        ],
      },
      {
        t: "8. O'zgarishlar",
        body: [
          "Siyosat yangilanishi mumkin; muhim o'zgarishlar haqida ilova orqali xabar beramiz. Amaldagi tahrir: 2026-yil avgust.",
        ],
      },
    ],
    [
      {
        t: '1. Общие положения',
        body: [
          'Настоящая Политика конфиденциальности определяет, как сервис YolYolakay (далее — «Сервис») собирает, использует и защищает персональные данные пользователей. Используя Сервис, вы соглашаетесь с этой политикой.',
        ],
      },
      {
        t: '2. Какие данные мы собираем',
        body: [
          '• Номер телефона, имя и пол — при регистрации;',
          '• Данные автомобиля (марка, цвет, гос. номер) — для водителей;',
          '• Данные поездок: города маршрута, координаты точки отправления, дата/время, цена;',
          '• Сообщения чата между водителем и пассажиром — в рамках организации поездки;',
          '• Оценки и отзывы; технические данные (идентификатор устройства, сессия);',
          '• Фотографии — только если вы загрузили их сами: фото профиля; для водителей — фото автомобиля и фото техпаспорта. Фото техпаспорта используется для проверки заявки и публично не показывается;',
          '• Статистика использования: факт поиска и число найденных поездок, открытие поездки, создание брони и объявления, выбор тарифа. В эти записи НЕ входят имя, номер телефона, текст чата и точный адрес — только числа и идентификаторы. Цель: видеть, на каких направлениях не хватает поездок, и исправлять сервис.',
        ],
      },
      {
        t: '3. Цели использования',
        body: [
          'Данные используются только для работы Сервиса: поиск и бронирование поездок, отображение сторон друг другу (имя, рейтинг, автомобиль), безопасность (идентификация водителей), обработка платежей и выполнение требований закона.',
          'Ваш номер телефона НЕ показывается в поиске и посторонним. Он открывается только после ПОДТВЕРЖДЕНИЯ брони и только второй стороне этой поездки — чтобы вы могли найти друг друга на месте встречи. В остальном общение идёт через чат внутри приложения.',
        ],
      },
      {
        t: '4. Передача третьим лицам',
        body: [
          'Данные не продаются. Они передаются только: (а) второй стороне поездки в необходимом объёме (имя, рейтинг, автомобиль); (б) платёжным провайдерам для проведения оплаты; (в) уполномоченным органам в случаях, установленных законом.',
        ],
      },
      {
        t: '5. Хранение и защита',
        body: [
          'Данные передаются по шифрованному каналу (HTTPS) и хранятся на серверах с ограниченным доступом. При удалении аккаунта персональные данные не хранятся дольше сроков, требуемых законом.',
        ],
      },
      {
        t: '6. Права пользователя',
        body: [
          'Вы вправе просматривать и исправлять свои данные (через профиль) и запросить удаление аккаунта. Для обращений используйте адрес ниже.',
        ],
      },
      {
        t: '7. Разрешения устройства',
        body: [
          '• Микрофон — только для того, чтобы сказать маршрут голосом при поиске поездки. Включается лишь когда вы нажимаете кнопку микрофона, и выключается сразу после фразы. Аудио не записывается, не сохраняется и не отправляется на сервер: распознаёт системная служба вашего устройства, приложение получает только текст и превращает его в название города прямо на телефоне;',
          '• Геолокация — в двух случаях. Первый: при нажатии «моё местоположение» на карте. Второй: если вы ВОДИТЕЛЬ и отметили поездку начатой — во время этой поездки ваше местоположение видно на карте пассажирам этой же поездки, даже когда телефон заблокирован. В это время в панели уведомлений висит постоянное уведомление, скрыть его нельзя. Как только поездка завершена, отправка сразу прекращается. Как пассажир вы никогда не отправляете местоположение в фоне;',
          '• Уведомления — сообщения о поездках, бронированиях и чате;',
          '• Камера и галерея — только когда вы сами загружаете фото (аватар, автомобиль, техпаспорт).',
          'Любое разрешение можно отозвать в настройках телефона — остальная часть приложения продолжит работать.',
        ],
      },
      {
        t: '8. Изменения',
        body: [
          'Политика может обновляться; о существенных изменениях мы сообщим через приложение. Действующая редакция: август 2026 г.',
        ],
      },
    ],
    [
      {
        t: '1. General provisions',
        body: [
          "This Privacy Policy explains how the YolYolakay service (the “Service”) collects, uses and protects users' personal data. By using the Service you agree to this policy.",
        ],
      },
      {
        t: '2. What data we collect',
        body: [
          '• Phone number, name and gender — at sign-up;',
          '• Car details (make, colour, plate number) — for drivers;',
          '• Trip data: route cities, departure point coordinates, date/time, price;',
          '• Chat messages between driver and passenger — as part of arranging the trip;',
          '• Ratings and reviews; technical data (device identifier, session);',
          '• Photos — only if you upload them yourself: profile picture; for drivers, a photo of the car and of the vehicle registration certificate. The registration photo is used to review the application and is never shown publicly;',
          '• Usage statistics: that a search happened and how many rides it returned, opening a ride, creating a booking or a listing, choosing a plan. These records do NOT include your name, phone number, chat text or exact address — only numbers and identifiers. Purpose: to see which routes lack rides and to fix the service.',
        ],
      },
      {
        t: '3. How the data is used',
        body: [
          'The data is used only to run the Service: finding and booking trips, showing the parties to each other (name, rating, car), safety (driver identification), payment processing and obligations required by law.',
          'Your phone number is NOT shown in search or to strangers. It is revealed only after a booking is CONFIRMED, and only to the other party of that ride, so you can find each other at the pickup point. Otherwise communication happens through the in-app chat.',
        ],
      },
      {
        t: '4. Sharing with third parties',
        body: [
          'We do not sell data. It is shared only: (a) with the other party of a trip, to the extent needed (name, rating, car); (b) with payment providers to process payments; (c) with authorities in the cases established by law.',
        ],
      },
      {
        t: '5. Storage and protection',
        body: [
          'Data is transmitted over an encrypted channel (HTTPS) and stored on servers with restricted access. When an account is deleted, personal data is not kept beyond the periods required by law.',
        ],
      },
      {
        t: '6. Your rights',
        body: [
          'You may view and correct your data (through your profile) and request deletion of your account. Use the address below to contact us.',
        ],
      },
      {
        t: '7. Device permissions',
        body: [
          "• Microphone — only to say your route out loud when searching for a ride. It turns on solely when you tap the microphone button and turns off as soon as you finish speaking. Audio is not recorded, not stored and never sent to our servers: your device's own system service performs the recognition, and the app receives only the text, turning it into a city name on the phone itself;",
          '• Location — in two cases. First, when you tap "my location" on the map. Second, if you are a DRIVER and have marked a trip as started: for the duration of that trip your location is shown on the map to the passengers of that same trip, even while the phone is locked. While this happens a permanent notification stays in your status bar and cannot be hidden. Sending stops immediately when the trip ends. As a passenger your location is never sent in the background;',
          '• Notifications — for ride, booking and chat updates;',
          '• Camera and gallery — only when you upload a photo yourself (avatar, car, vehicle registration).',
          'You can revoke any permission in your phone settings at any time; the rest of the app keeps working.',
        ],
      },
      {
        t: '8. Changes',
        body: [
          'This policy may be updated; we will announce material changes in the app. Current version: August 2026.',
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
          {tr('Maxfiylik siyosati', 'Политика конфиденциальности', 'Privacy policy')}
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
