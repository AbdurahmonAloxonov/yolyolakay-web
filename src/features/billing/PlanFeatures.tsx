'use client';

import React from 'react';
import {
  Snowflake,
  CigaretteOff,
  Armchair,
  Gauge,
  Luggage,
  PawPrint,
  Truck,
  Lock,
  CalendarCheck,
  Car,
  Package,
} from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';

/**
 * Tarif tafsiloti — KARTANING O'ZIDA.
 *
 * 🔴 NEGA OYNA EMAS (egasi, 2026-08-19: "batafsil tugmasi bo'lmasin,
 * ma'lumotlar kartaning o'zida berilsin, uzunasiga tushaversin"):
 * ilgari kartada faqat raqamlar turardi, qolgan hammasi "Batafsil ›"
 * ortidagi pastki oynada edi (`PlanDetailsSheet`). Bu ikki narxni buzardi:
 *
 *  1. TARIFLARNI SOLISHTIRIB BO'LMASDI. Oyna bir vaqtda BITTA tarifni
 *     ko'rsatadi — Plus va Pro farqini bilish uchun odam oynani ochib,
 *     yopib, ikkinchisini ochib, birinchisidagini ESLAB turishi kerak edi.
 *     Yonma-yon turgan kartalarda esa farq ko'z bilan ko'rinadi.
 *  2. Eng muhim javoblar ("40 safar" nima degani, pul o'zidan yechiladimi)
 *     bosishni talab qilardi — ya'ni ularni ko'pchilik umuman o'qimasdi.
 *
 * Endi hamma narsa kartada, tepadan pastga bitta o'qish yo'nalishida.
 * Karta uzayadi — bu ATAYIN: tarif sahifasiga odam bir marta, pul
 * sarflashdan oldin kiradi; u yerda qisqalikdan ko'ra to'liqlik qimmatroq.
 *
 * 🔴 FILTRLAR RO'YXATI mobil ilova bilan bir xil bo'lishi SHART: u yerda
 * `create_ride_screen._premiumLocked` aynan shu to'rttasini qulflaydi
 * (`plan_filters_sync_test.dart` qo'riqlaydi). Bu yerdagi ro'yxat o'zgarsa
 * — sayt sotib olishdan OLDIN yolg'on va'da bergan bo'ladi.
 */
export const PlanFeatures: React.FC<{
  /** Oylik safar paketi, formatlangan ("40" yoki "Cheksiz"). */
  trips: number | string;
  /** Oylik bepul posilka, formatlangan. Bo'sh = paketda yo'q. */
  parcels: string;
  /** Shu tarifda premium filtrlar ochiqmi. */
  hasPremiumFilters: boolean;
  isUnlimited: boolean;
  /** To'q (wine-ash) kartada boshqa rang jufti ishlatiladi. */
  dark?: boolean;
}> = ({ trips, parcels, hasPremiumFilters, isUnlimited, dark = false }) => {
  const tr = useTr();

  const premiumFilters = [
    { icon: Snowflake, label: tr('Konditsioner', 'Кондиционер', 'Air conditioning') },
    { icon: CigaretteOff, label: tr('Chekilmaydi', 'Не курят', 'No smoking') },
    { icon: Armchair, label: tr('Orqada 2 kishi', 'Сзади двое', 'Two in the back') },
    { icon: Gauge, label: tr('Haydash uslubi', 'Стиль вождения', 'Driving style') },
  ];
  const freeFilters = [
    { icon: Luggage, label: tr('Yuk joyi bor', 'Есть багаж', 'Luggage space') },
    { icon: PawPrint, label: tr('Hayvonsiz', 'Без животных', 'No pets') },
    { icon: Truck, label: tr('Pochta', 'Посылка', 'Parcel') },
  ];

  // Rang jufti bir joyda: qatorlarga tarqalsa to'q va oq karta vaqt o'tib
  // bir-biridan uzoqlashib ketadi.
  const c = {
    label: dark ? 'text-white/70' : 'text-text-muted',
    text: dark ? 'text-white' : 'text-text',
    muted: dark ? 'text-white/70' : 'text-text-muted',
    /*
     * 🔴 «BOR» BELGISI IKKALA KARTADA HAM FERUZA (2026-09-04).
     *
     * Yorug' kartada u PUSHTI edi va bitta kartada uch xil pushti
     * to'planardi: «1 safar ≈ 2 500 so'm», xususiyat ikonkalari va
     * pastdagi «Sotib olish» tugmasi. Ko'z qaysi biri AMAL ekanini
     * ajratolmasdi.
     *
     * Ilovada bu qoida allaqachon yozilgan (`tariffs_screen.dart`):
     * pushti — FAQAT tugmada, feruza esa «bor / yaxshi» degan MA'NOni
     * tashiydi. Sayt shu qoidaga tenglashtirildi.
     */
    icon: 'text-turquoise',
    /*
     * ⚠️ IKONKA va YOZUV bir xil feruza BO'LA OLMAYDI. Ikonka — shakl,
     * u oq kartada ham ko'rinadi; yozuv esa 1.49:1 bo'lib qolardi
     * («Shu tarifda ochiq» oq kartada deyarli yo'q edi). To'q kartada
     * aksincha — yorug' feruza to'g'ri.
     */
    on: dark ? 'text-turquoise' : 'text-turquoise-ink',
    box: dark ? 'bg-white/5' : 'bg-bg/60',
    line: dark ? 'border-white/15' : 'border-border',
    chip: dark ? 'bg-white/5 border-white/10' : 'bg-bg/60 border-border',
    off: dark ? 'text-white/60' : 'text-text-muted',
  };
  // Bo'lim sarlavhasi. Alohida komponent EMAS: render ichida yaratilgan
  // komponent har chizishda qaytadan tug'iladi (React qoidasi buzilardi).
  const labelCls = `text-[0.65rem] font-bold uppercase tracking-wider ${c.label}`;

  return (
    <div className={`space-y-5 border-t pt-5 ${c.line}`}>
      {/* ===== NIMA KIRADI ===== */}
      <div className="space-y-2.5">
        <p className={labelCls}>{tr('Nima kiradi', 'Что входит', 'What you get')}</p>

        {/*
          🔴 Belgilar bir xil "check" EMAS — har birining o'z ikonkasi bor.
          Ilgari qatorlar bir xil ko'rinardi va tariflar farqini ko'rish uchun
          matnni o'qib chiqish kerak edi. Mobil ilovada ham shu qaror.
        */}
        <div className={`flex items-start gap-2.5 text-sm ${c.text}`}>
          <Car className={`h-5 w-5 shrink-0 ${c.icon}`} />
          <span className="font-semibold">
            {trips} {tr('safar balansingizga', 'поездок на баланс', 'rides added to your balance')}
          </span>
        </div>

        {/* Posilka kvotasi. Backendning `features` ro'yxati ATAYIN chizilmaydi:
            u aynan shu ikki faktni QOTIRILGAN inglizcha matn bilan qaytaradi
            ("Up to 2 rides"), ya'ni uch tilli saytda o'zi xato. */}
        {parcels && (
          <div className={`flex items-start gap-2.5 text-sm ${c.muted}`}>
            <Package className={`h-5 w-5 shrink-0 ${c.icon}`} />
            <span>
              {parcels} {tr('bepul pochta', 'бесплатных посылок', 'free parcels')}
            </span>
          </div>
        )}

        {/* Raqamning MA'NOSI. Eng ko'p beriladigan savol: balans qachon kamayadi. */}
        <p className={`rounded-xl p-3 text-xs leading-relaxed ${c.box} ${c.muted}`}>
          {isUnlimited
            ? tr(
                "E'lonlar soni cheklanmaydi.",
                'Количество объявлений не ограничено.',
                'The number of listings is not limited.'
              )
            : tr(
                `Bir oyda ${trips} ta e'lon berasiz. Balans e'lon QILGANDA kamayadi, yo'lovchi qidirganda emas.`,
                `В месяц вы публикуете ${trips} объявлений. Баланс уменьшается при ПУБЛИКАЦИИ, а не при поиске.`,
                `You publish ${trips} listings per month. The balance is spent when you publish, not when someone searches.`
              )}
        </p>
      </div>

      {/* ===== FILTRLAR =====
          🔴 Bu tariflar orasidagi ENG KATTA farq: backend konditsioner/
          chekilmaydi/haydash uslubi belgilarini faqat Pro va Premium'da
          o'tkazadi. Usiz sahifada Pro nega Plus'dan qimmat ekani KO'RINMASDI.
          Yo'q imkoniyat QULF bilan ko'rsatiladi: "bor"ni ko'rsatishning
          o'zi solishtirish uchun yetmaydi. */}
      <div className="space-y-2.5">
        <p className={labelCls}>{tr('Safar filtrlari', 'Фильтры поездки', 'Ride filters')}</p>
        <p className={`text-xs leading-relaxed ${c.muted}`}>
          {tr(
            "Yo'lovchi qidiruvda aynan shu belgilar bo'yicha tanlaydi.",
            'Пассажир выбирает поездку именно по этим меткам.',
            'Passengers filter rides by exactly these tags.'
          )}
        </p>

        <p className={`text-xs font-extrabold ${hasPremiumFilters ? c.on : c.off}`}>
          {hasPremiumFilters
            ? tr('Shu tarifda ochiq', 'Открыто на этом тарифе', 'Open on this plan')
            : tr(
                'Yuqoriroq tarifda ochiladi',
                'Откроется на тарифе выше',
                'Opens on a higher plan'
              )}
        </p>
        {/* Ikki ustunli setka: to'rtta belgi bitta nigohga sig'adi, ustma-ust
            qator esa kartani yana to'rt qatorga uzaytirardi. */}
        <div className="grid grid-cols-2 gap-1.5">
          {premiumFilters.map(({ icon: Icon, label }) => (
            <span
              key={label}
              /* ⚠️ `items-start` + o'ralishga ruxsat: 320 px da chipga
                 73 px matn joyi qoladi, «Haydash uslubi» esa 91 px
                 talab qiladi va «Haydash usl…» bo'lib kesilardi
                 (o'lchandi 2026-09-04). Uzun yorliq endi ikkinchi
                 qatorga o'tadi, ikki ustunli tartib esa saqlanadi. */
              className={`flex items-start gap-1.5 rounded-lg border px-2 py-1.5 text-xs leading-tight ${c.chip} ${
                hasPremiumFilters ? c.text : c.off
              }`}
            >
              {hasPremiumFilters ? (
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c.icon}`} />
              ) : (
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
              )}
              <span className="min-w-0">{label}</span>
            </span>
          ))}
        </div>

        <p className={`pt-1 text-xs font-extrabold ${c.muted}`}>
          {tr('Hamma tarifda bor', 'Есть на всех тарифах', 'Included in every plan')}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {freeFilters.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className={`flex items-start gap-1.5 rounded-lg border px-2 py-1.5 text-xs leading-tight ${c.chip} ${c.text}`}
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c.icon}`} />
              <span className="min-w-0">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Eng ko'p qo'rqiladigan savol: pul o'zidan yechiladimi. */}
      <div className={`flex items-start gap-2.5 rounded-xl p-3 text-xs ${c.box} ${c.muted}`}>
        <CalendarCheck className="h-4 w-4 shrink-0" />
        <span className="leading-relaxed">
          {tr(
            "Tarif bir oyga amal qiladi va avtomatik yangilanmaydi — pul o'zidan yechilmaydi.",
            'Тариф действует месяц и не продлевается автоматически — деньги сами не спишутся.',
            'The plan lasts one month and does not renew automatically — nothing is charged by itself.'
          )}
        </span>
      </div>
    </div>
  );
};
