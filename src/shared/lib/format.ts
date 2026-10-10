import { pickFor, trFor, intlTag } from './i18n';

/**
 * Backend statusini KATTA harfga normallashtiradi. Backend v2 (2026-07-09) statuslarni
 * kichik harfda beradi (active/in_progress/completed/cancelled) — barcha solishtirishlar
 * shu helper orqali o'tsin, aks holda 'completed' !== 'COMPLETED' turidagi jim buglar
 * chiqadi (create-trip hasActiveTrip, trip/[id] isActive shu sabab singan edi).
 */
export const normalizeStatus = (status: unknown): string => {
  const s = String(status ?? '').toUpperCase();
  // Yangi Gateway (2026-07-17 jonli): bron holati ACCEPTED emas CONFIRMED nomi bilan keladi
  // (pending/confirmed/rejected). UI taqqoslashlari ACCEPTED atrofida qurilgan — shu yerda
  // bir marta xaritalaymiz, 20+ chaqiruv joyi o'zgarishsiz qoladi.
  return s === 'CONFIRMED' ? 'ACCEPTED' : s;
};

/** Trip "band qilsa bo'ladigan" holatdami (eski CREATED / yangi ACTIVE). DRAFT — hali faollashmagan. */
export const isTripOpen = (status: unknown): boolean => {
  const s = normalizeStatus(status);
  return s === 'CREATED' || s === 'ACTIVE';
};

/**
 * KECHIKISHGA BERILADIGAN VAQT — undan keyin safar "jo'nab ketgan" sanaladi.
 *
 * Nega nol emas: haydovchi kechikadi va bu NORMAL. 09:00 dagi safar 09:20 da
 * hamon o'tirsa bo'ladigan safar — `departureLabel` ham shuning uchun
 * "Kechikmoqda" yozuvini biladi. Uch soatdan keyin esa u safar emas.
 *
 * Flutter tomonda ayni shu qiymat: `SearchFilters.lateGrace`.
 */
export const LATE_GRACE_MS = 3 * 60 * 60 * 1000;

/**
 * Safar allaqachon jo'nab ketganmi.
 *
 * 🔴 NEGA YOZILDI (10.09.2026, jonli o'lchov): backend jo'nash vaqti o'tgan
 * safarni HAMON `status: active` deb qaytaradi. Natijada qidiruvda
 * 4-sentabrda ketgan safar turardi, safar sahifasida esa bir kartada
 * BIR VAQTNING O'ZIDA "FAOL" yorlig'i, "Jo'nab ketdi" yozuvi va
 * ISHLAYDIGAN "Savdolarga kirish" tugmasi ko'rinardi.
 *
 * Vaqtni shu yerda o'qiymiz (chaqiruvchi render ichida `Date.now()`
 * yozmasin — React uni nopok deb hisoblaydi); `now` esa testda vaqtni
 * qotirish uchun.
 *
 * ⚠️ Bu funksiya shu faylda ILGARI ham bor edi, lekin CHEGARASIZ
 * ("vaqt o'tdimi") va uni HECH KIM chaqirmasdi — izohida "ro'yxatda
 * xiralashtirish uchun" deb yozilgan bo'lsa-da, xiralashtirish
 * yozilmagan edi. Ikkita deyarli bir xil nom saqlash o'rniga o'sha
 * o'lik variant olib tashlandi.
 */
export const hasDeparted = (iso: string | null | undefined, now?: Date): boolean => {
  const d = parseBackendDate(iso);
  if (!d) return false;
  const current = now ?? new Date();
  return d.getTime() < current.getTime() - LATE_GRACE_MS;
};

/**
 * Safar qidiruv natijasida KO'RSATILISHI mumkinmi — holat va vaqt bo'yicha.
 *
 * DENYLIST shaklida: yangi "bron qilsa bo'ladigan" status qo'shilsa jim
 * yashirinib qolmasin. Flutter tomonda: `SearchFilters.isBookable`.
 */
export const isRideBookable = (
  status: unknown,
  departureTime: string | null | undefined,
  now?: Date
): boolean => {
  const s = normalizeStatus(status);
  if (s === 'COMPLETED' || s === 'CANCELLED') return false;
  return !hasDeparted(departureTime, now);
};

/**
 * Backend user obyektidan ko'rsatiladigan ismni oladi.
 * Rides-replika ismni `display_name`da beradi (PII auth'da), auth `name`da;
 * eski yassi maydonlar (driver_name/passenger_name) uchun `flat` parametri.
 */
export const personName = (
  p?: { name?: string | null; display_name?: string | null } | null,
  flat?: string | null,
  fallback = ''
): string => (p?.name || p?.display_name || flat || fallback).trim();

/**
 * To'liq ismni backend kutadigan first_name/last_name juftligiga bo'ladi.
 * Backend ismni FAQAT shu maydonlarda saqlaydi; PATCH'da {name} ham split talab qiladi.
 */
export const splitFullName = (name: string): { first_name?: string; last_name?: string } => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
};

/**
 * Booking statusi uchun o'qiladigan yorliq (case-insensitive).
 * PENDING_NEGOTIATION = yo'lovchi o'z narxini taklif qilgan, haydovchi javobini kutmoqda.
 */
/**
 * Booking obyektini yagona shaklga keltiradi. Yangi Gateway ride-domain JSON'i
 * camelCase (2026-07-17 swagger: offeredPrice, passengerID, rideID, seatsBooked,
 * isFullCarBuyout), HTTP javob qatlamida esa snake_case bo'lishi mumkin —
 * IKKALASINI ham o'qib, UI kutadigan snake_case + katta-harf statusga o'tkazamiz.
 */
// Jonli (2026-07-18): gateway booking'ni PASCALCASE beradi (ID, RideID, PassengerID,
// SeatsBooked, OfferedPrice — null bo'lishi mumkin, TotalPrice, IsFullCarBuyout, Status);
// swagger domen modeli esa camelCase deb yozilgan edi — uchala variantni ham o'qiymiz.
// Statuslar: pending | pending_negotiation (narx haydovchinikidan farqli) | confirmed | rejected.
export const normalizeBooking = <T extends Record<string, any>>(b: T) => ({
  ...b,
  ID: String(b.ID ?? b.id ?? ''),
  // `confirmed`ni UI kutadigan ACCEPTED'ga xaritalaymiz (bitta normallashuv nuqtasi).
  status:
    normalizeStatus(b.status ?? b.Status) === 'CONFIRMED'
      ? 'ACCEPTED'
      : normalizeStatus(b.status ?? b.Status),
  trip_id: b.trip_id ?? b.rideID ?? b.RideID ?? b.ride_id,
  passenger_id: b.passenger_id ?? b.passengerID ?? b.PassengerID,
  // TotalPrice zaxirasi faqat NOLDAN FARQLI bo'lsa (jonlida OfferedPrice:null + TotalPrice:0
  // juftligi keladi — 0 ni "narx bor" deb qoldirsak, chaqiruvchidagi keshdagi haqiqiy
  // narx fallback'i hech qachon ishlamasdi).
  offered_price: b.offered_price ?? b.offeredPrice ?? b.OfferedPrice ?? (b.TotalPrice || undefined),
  seats: b.seats ?? b.seatsBooked ?? b.SeatsBooked,
  is_full_car_buyout: b.is_full_car_buyout ?? b.isFullCarBuyout ?? b.IsFullCarBuyout,
});

/**
 * Bron YAKUNLANGANMI — ya'ni ustida boshqa amal qilib bo'lmaydimi.
 *
 * 🔴 NEGA RAD ETISH RO'YXATI, RUXSAT RO'YXATI EMAS (2026-08-16 dagi
 * savdolashish nosozligining ILDIZI):
 *
 * Kod har joyda `status === 'PENDING' || status === 'PENDING_NEGOTIATION'`
 * deb yozilgan edi. Backend savdolashish statusini boshqacha nomlashi
 * bilanoq (yoki yangisini qo'shishi bilan) tugmalar BUTUNLAY yo'qolardi:
 * haydovchi yo'lovchining taklifini ko'rmasdi, yo'lovchi haydovchining
 * qarshi taklifini ko'rmasdi. Aynan shu bo'ldi.
 *
 * Bron statuslari swaggerda `type: string` — ro'yxat YO'Q. Ya'ni biz
 * ularni to'liq bilamiz deb faraz qila olmaymiz. Yakunlangan holatlar
 * esa aniq va o'zgarmas: qabul qilindi, rad etildi, bekor qilindi,
 * kelmadi. Qolgani — hali ochiq, demak tugmalar KO'RINSIN.
 *
 * Xato tomoni ham to'g'ri tanlangan: noma'lum statusda ortiqcha tugma
 * ko'rinsa odam bosadi va server "bo'lmaydi" deydi; tugma ko'rinmasa
 * esa odam nima qilishini umuman bilmaydi.
 */
export const isBookingSettled = (status: unknown): boolean =>
  ['ACCEPTED', 'REJECTED', 'CANCELLED', 'NO_SHOW'].includes(normalizeStatus(status));

export const bookingStatusLabel = (status: string, locale: string): string => {
  const map: Record<string, [string, string, string]> = {
    PENDING: ['Kutilmoqda', 'Ожидает', 'Pending'],
    // Yo'lovchi haydovchi narxidan FARQLI narx taklif qilgan — jonli tasdiqlangan status.
    PENDING_NEGOTIATION: [
      'Narxga javob kutilmoqda',
      'Ожидает ответа на цену',
      'Awaiting price reply',
    ],
    ACCEPTED: ['Qabul qilindi', 'Принята', 'Accepted'],
    CONFIRMED: ['Qabul qilindi', 'Принята', 'Accepted'],
    REJECTED: ['Rad etildi', 'Отклонена', 'Declined'],
    CANCELLED: ['Bekor qilindi', 'Отменена', 'Cancelled'],
    NO_SHOW: ['Kelmadi', 'Не явился', 'No-show'],
  };
  const row = map[String(status || '').toUpperCase()];
  return row ? pickFor(locale)(row[0], row[1], row[2]) : status;
};

/**
 * Trip statusi uchun o'qiladigan yorliq (case-insensitive). Backend v2 kichik harf beradi
 * (active/in_progress/...) — normalizeStatus ichida katta harfga keltiriladi. Noma'lum
 * status bo'lsa xom qiymat qaytadi (regressiyaga xavfsiz).
 */
export const tripStatusLabel = (status: string, locale: string): string => {
  const map: Record<string, [string, string, string]> = {
    // 🔴 `draft` YO'Q edi va xom qiymat chiqardi: haydovchi panelida
    // o'zbekcha ro'yxat ichida «DRAFT» deb inglizcha turardi (o'lchandi
    // 2026-09-03, sinov haydovchisining 10 ta safari). Mashina
    // tasdiqlanmagan bo'lsa safar aynan shu holatda qoladi, ya'ni bu
    // kamdan-kam emas — eng ko'p uchraydigan holat.
    // Matn ilova bilan bir xil (`l10n/strings.dart`: 'Qoralama').
    DRAFT: ['Qoralama', 'Черновик', 'Draft'],
    CREATED: ['Faol', 'Активна', 'Active'],
    ACTIVE: ['Faol', 'Активна', 'Active'],
    IN_PROGRESS: ["Yo'lda", 'В пути', 'On the way'],
    COMPLETED: ['Tugallandi', 'Завершена', 'Completed'],
    CANCELLED: ['Bekor qilindi', 'Отменена', 'Cancelled'],
  };
  const row = map[normalizeStatus(status)];
  return row ? pickFor(locale)(row[0], row[1], row[2]) : status;
};

/**
 * Posilka statusi uchun o'qiladigan yorliq (case-insensitive). Backend kichik harf beradi
 * (pending/cancelled/... — jonli tasdiqlangan). Noma'lum status xom qaytadi.
 */
export const parcelStatusLabel = (status: string, locale: string): string => {
  const map: Record<string, [string, string, string]> = {
    PENDING: ['Kutilmoqda', 'Ожидает', 'Pending'],
    ACTIVE: ['Faol', 'Активна', 'Active'],
    OPEN: ['Ochiq', 'Открыта', 'Open'],
    MATCHED: ['Haydovchi topildi', 'Водитель найден', 'Driver found'],
    ACCEPTED: ['Qabul qilindi', 'Принята', 'Accepted'],
    // 🔴 `picked_up` ro'yxatda YO'Q edi va xom qiymat ekranga chiqardi:
    // posilka sahifasida o'zbekcha matn orasida «picked_up» deb turardi
    // (ko'rildi 2026-09-04). Aynan shu holat eng ko'p ko'riladi —
    // haydovchi olgandan yetkazgunicha posilka shunda turadi.
    PICKED_UP: ["Yo'lda", 'В пути', 'In transit'],
    IN_TRANSIT: ["Yo'lda", 'В пути', 'In transit'],
    DELIVERED: ['Yetkazildi', 'Доставлена', 'Delivered'],
    COMPLETED: ['Tugallandi', 'Завершена', 'Completed'],
    CANCELLED: ['Bekor qilindi', 'Отменена', 'Cancelled'],
  };
  const row = map[normalizeStatus(status)];
  return row ? pickFor(locale)(row[0], row[1], row[2]) : status;
};

/**
 * Форматирует числовое значение стоимости в строковый вид с разделением тысяч
 * и суффиксом валюты на основе текущей локали (ru/uz).
 * Пример: 150000 -> "150 000 сум" / "150 000 so'm"
 */
export const formatCurrency = (amount: number, locale: string = 'ru'): string => {
  const formatter = new Intl.NumberFormat(intlTag(locale), {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // Заменяем узкие пробелы и другие разделители на обычный пробел для избежания Hydration Error в Next.js
  const formatted = formatter.format(amount).replace(/[\s\u202F\u00A0,]/g, ' ');
  const suffix = pickFor(locale)("so'm", 'сум', 'UZS');

  return `${formatted} ${suffix}`;
};

/**
 * Backend tarif "quota" qiymati: 999999 (yoki manfiy/null) = CHEKSIZ (Premium).
 * GET /tariffs har tarif uchun faqat { type, price, quota } qaytaradi.
 */
export const UNLIMITED_QUOTA = 999999;

export const isUnlimitedQuota = (quota: number | null | undefined): boolean =>
  quota == null || quota < 0 || quota >= UNLIMITED_QUOTA;

/** Quota'ni o'qiladigan matnga aylantiradi: cheksiz bo'lsa "Cheksiz"/"Безлимит", aks holda son. */
export const formatQuota = (quota: number | null | undefined, locale: string = 'ru'): string =>
  isUnlimitedQuota(quota)
    ? pickFor(locale)('Cheksiz', 'Безлимит', 'Unlimited')
    : String(quota ?? 0);

/**
 * Balans yorlig'i — "Cheksiz" TARIF xususiyati (kvotasi), balans RAQAMINIKI emas.
 *
 * 🔴 Nima buzilgan edi (CEO shikoyati 2026-08-04): backend `rides_left` ni ba'zan
 * MANFIY (`-1`) qaytaradi. `formatQuota` esa har qanday manfiy sonni "Cheksiz" deb
 * o'qiydi (tarif kvotasida -1 haqiqatan cheksiz degani). Natijada:
 *   • cheklangan tarif sotib olgan odam "Cheksiz" ko'rardi;
 *   • profilda esa xom "-1" turardi.
 * Ikkalasi ham bitta manbadan chiqqan. Endi qoida bitta: cheksizlikni FAQAT
 * tarif kvotasi belgilaydi, balans raqami esa hech qachon manfiy ko'rsatilmaydi.
 */
export const formatBalance = (
  {
    isUnlimited,
    ridesLeft,
    planKnown = true,
  }: { isUnlimited: boolean; ridesLeft: number | null; planKnown?: boolean },
  locale: string = 'ru'
): string => {
  if (isUnlimited) return pickFor(locale)('Cheksiz', 'Безлимит', 'Unlimited');
  if (ridesLeft == null || !Number.isFinite(ridesLeft)) return '—';
  // Tarif noma'lum bo'lsa manfiy son "cheksiz"mi yoki "qarz"mi — bilmaymiz,
  // shuning uchun 0 deb ham, cheksiz deb ham ko'rsatmaymiz.
  if (ridesLeft < 0 && !planKnown) return '—';
  return String(Math.max(0, ridesLeft));
};

/**
 * O'zbekiston yagona timezone'da ishlaydi (UTC+5, yozgi vaqt yo'q).
 * Backend departure_time ni UTC ISO string (".../...Z") sifatida qaytaradi,
 * shuning uchun ko'rsatishda doim Asia/Tashkent'ga o'tkazamiz — foydalanuvchi
 * mashinasining timezone'idan qat'i nazar bir xil natija chiqadi.
 */
const TASHKENT_TZ = 'Asia/Tashkent';

/**
 * Backend sanasini o'qish — Go'ning "nol vaqti" `null` bo'lib qaytadi.
 *
 * 🔴 NEGA KERAK: `0001-01-01T00:00:00Z` — bu SANA EMAS, "qiymat yo'q" degani
 * (Go strukturasidagi to'ldirilmagan maydon). Backend uni jonli yuboradi: WS
 * `new_message` kadrida `created_at` aynan shunday keladi (o'lchandi
 * 2026-08-20), safar `departure_time` da ham uchradi. `new Date()` buni
 * bemalol o'qiydi va natijada:
 *   • jonli kelgan xabar yozishmaning eng TEPASIGA sakraydi (1-yil eng eski);
 *   • ekranda "01.01.0001" ko'rinadi.
 *
 * Chegara 2000-yil: undan oldingi sana bu ilovada haqiqiy bo'la olmaydi.
 * Chaqiruvchilar `null` ni allaqachon to'g'ri ishlaydi (vaqtsiz xabar
 * qo'shnisining vaqtini oladi, ya'ni o'z joyida qoladi).
 */
export const parseBackendDate = (iso?: string | null): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear() < 2000 ? null : d;
};

/** UTC ISO string'dan faqat vaqt: "08:00" (Toshkent vaqti, 24-soatlik). */
export const formatTripTime = (iso?: string | null): string => {
  const d = parseBackendDate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TASHKENT_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
};

/** UTC ISO string'dan Toshkent mahalliy sanasi (YYYY-MM-DD) — sana filtrlari uchun. */
export const tashkentLocalDate = (iso?: string | null): string => {
  const d = parseBackendDate(iso);
  if (!d) return '';
  // en-CA locale YYYY-MM-DD formatini beradi (<input type="date"> bilan mos).
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TASHKENT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

/** UTC ISO string'dan sana + vaqt: "28.06.2026, 08:00" (Toshkent vaqti). */
export const formatTripDateTime = (iso?: string | null): string => {
  const d = parseBackendDate(iso);
  if (!d) return '';
  const formatted = new Intl.DateTimeFormat('ru-RU', {
    timeZone: TASHKENT_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  // Narrow/nbsp probellarni oddiy probelga almashtiramiz (Hydration xatosi oldini olish)
  return formatted.replace(/[  ]/g, ' ');
};

/** UTC ISO string'dan faqat sana: "28.06.2026" (Toshkent). Tarif muddati kabi joylar uchun. */
export const formatDateOnly = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TASHKENT_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(d)
    .replace(/[  ]/g, ' ');
};

/**
 * Berilgan ISO sanagacha necha kun qolganini qaytaradi (Toshkent kunlari bo'yicha).
 * O'tib ketgan bo'lsa manfiy. Tarif tugashiga sanoq uchun.
 */
export const daysUntil = (iso?: string | null): number | null => {
  const target = tashkentLocalDate(iso);
  if (!target) return null;
  const today = tashkentLocalDate(new Date().toISOString());
  const diffMs =
    new Date(`${target}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
  return Math.round(diffMs / 86_400_000);
};

/**
 * `<input type="date">` beradigan "YYYY-MM-DD" ni backend kutadigan RFC3339
 * oraliqqa aylantiradi: o'sha kunning boshi va oxiri (Toshkent vaqtida, UTC'da).
 *
 * KERAK, chunki `GET /rides/search` date_from/date_to uchun TO'LIQ vaqtni talab
 * qiladi — oddiy "2026-07-31" yuborilsa 400 qaytadi (`cannot parse "" as "T"`,
 * jonli tasdiqlangan 2026-07-31). Toshkent UTC+5, yozgi vaqt yo'q.
 */
export const dateToRangeISO = (date?: string | null): { from?: string; to?: string } => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return {};
  // Toshkent 00:00 = UTC 19:00 (oldingi kun); 23:59:59 = UTC 18:59:59 (o'sha kun).
  const from = new Date(`${date}T00:00:00+05:00`).toISOString();
  const to = new Date(`${date}T23:59:59+05:00`).toISOString();
  return { from, to };
};

/*
 * ⚠️ `to` HISOBLANADI, lekin qidiruvda ISHLATILMAYDI (`search/page.tsx`):
 * tanlangan sana "eng erta qachon" degani, yuqori chegara qo'yilmaydi.
 * Egasi buni 2026-08-16 da tasdiqladi va mobil ilova ham shunga
 * moslashtirildi (ilgari u `date_to` yuborib, bitta kun bilan cheklardi —
 * bitta qidiruv ikki qurilmada boshqa-boshqa javob berardi).
 * `to` boshqa joyda kerak bo'lishi mumkin, shuning uchun qoldirildi.
 */

/** Toshkent "hozir": sana (YYYY-MM-DD), vaqt (HH:mm) va soat/daqiqa sonlari — min/validatsiya uchun. */
export const tashkentNow = (): { date: string; time: string; hour: number; minute: number } => {
  const iso = new Date().toISOString();
  const date = tashkentLocalDate(iso); // YYYY-MM-DD (Toshkent)
  const time = formatTripTime(iso); // HH:mm (24-soat, Toshkent)
  const [hour, minute] = time.split(':').map(Number);
  return { date, time, hour: hour || 0, minute: minute || 0 };
};

/**
 * Toshkent mahalliy sanasi (YYYY-MM-DD) va vaqtini (HH:mm) backend kutadigan
 * UTC ISO string'ga aylantiradi. Masalan: 08:00 Toshkent -> "...T03:00:00.000Z".
 */
export const tashkentLocalToUTCISO = (date: string, time: string): string => {
  const d = new Date(`${date}T${time}:00+05:00`);
  return d.toISOString().split('.')[0] + 'Z';
};

/**
 * Извлекает строковое сообщение об ошибке из любого объекта или строки.
 */
/**
 * MA'LUM backend xabarlarini foydalanuvchi tiliga o'giradi — backend xatolarni
 * inglizcha (ba'zan ruscha) qaytaradi va ular uz interfeysida xom chiqib, til
 * aralashuviga sabab bo'lardi. Lug'at substring bo'yicha ishlaydi (backend matni
 * o'zgarsa ham qisman mos keladi); topilmasa xom matn qaytadi (ma'lumot yo'qolmasin).
 */
const BACKEND_MSG: Array<[RegExp, string, string, string]> = [
  [
    /invalid or expired otp/i,
    "Kod noto'g'ri yoki eskirgan",
    'Неверный или просроченный код',
    'The code is invalid or expired',
  ],
  [
    /invalid or expired token|invalid or expired session/i,
    'Sessiya eskirgan — qaytadan kiring',
    'Сессия истекла — войдите заново',
    'Your session has expired — please sign in again',
  ],
  [
    /invalid credentials|invalid phone or password/i,
    "Telefon yoki parol noto'g'ri",
    'Неверный телефон или пароль',
    'Wrong phone number or password',
  ],
  [
    /does not have an approved car/i,
    "Mashinangiz hali moderatsiyadan o'tmagan",
    'Ваш автомобиль ещё на модерации',
    'Your car is still under review',
  ],
  [
    /ride not active/i,
    'Safar hali faol emas',
    'Поездка ещё не активна',
    'The trip is not active yet',
  ],
  [
    /already exists/i,
    "Bu ma'lumot allaqachon ro'yxatdan o'tgan",
    'Такая запись уже существует',
    'This record already exists',
  ],
  [/invalid plan name/i, 'Tarif topilmadi', 'Тариф не найден', 'Plan not found'],
  [
    /not enough seats|no seats/i,
    "Bo'sh o'rin yetarli emas",
    'Недостаточно свободных мест',
    'Not enough free seats',
  ],
  [
    /token mismatch/i,
    'Xavfsizlik sababli qaytadan kiring',
    'Из соображений безопасности войдите заново',
    'Please sign in again for security reasons',
  ],
  [/invalid user_id/i, 'Foydalanuvchi topilmadi', 'Пользователь не найден', 'User not found'],
  [
    /invalid input data/i,
    "Ma'lumotlar to'liq/to'g'ri emas",
    'Данные заполнены неверно',
    'The data is incomplete or invalid',
  ],
];

/**
 * SERVERNING ICHKI XATOSIMI — baza, ORM, tarmoq darajasidagi.
 *
 * 🔴 NEGA KERAK (jonli o'lchov, 2026-08-27): prodda `cars` jadvalida ustun
 * yetishmagani uchun backend 400 bilan XOM POSTGRES XATOSINI qaytardi:
 *
 *     ERROR: column "tech_passport_front" of relation "cars"
 *     does not exist (SQLSTATE 42703)
 *
 * `localizeBackendMessage` tanish naqsh topmasa xom matnni QAYTARARDI —
 * ya'ni odam mashina qo'shmoqchi bo'lganda ekranda aynan shuni ko'rardi.
 * Uch tomonlama zarar: odam hech nima tushunmaydi, bizning UI orqali
 * backendning jadval va ustun nomlari oshkor bo'ladi, aybdor esa sayt
 * bo'lib ko'rinadi.
 *
 * ⚠️ Bu tekshiruv xom matnni ko'rsatish qoidasini BEKOR QILMAYDI —
 * «narx juda past» kabi aniq gaplar foydali va ular qolaveradi. Bu faqat
 * ICHKI axlatga to'siq.
 *
 * Belgilar ATAYIN keng: yangi ORM yoki drayver boshqacha yozsa ham
 * tutilsin. Yolg'on ijobiy zarari kichik — odam umumiy xabar ko'radi;
 * yolg'on salbiyniki esa katta — SQL ekranga chiqadi.
 *
 * Mobil ekvivalenti: `ApiException.isInternalError`.
 */
const INTERNAL_ERROR =
  /sqlstate|error:\s*(column|relation)|does not exist|relation "|column "|\bpq:|\bsql:|gorm|panic|nil pointer|goroutine|dial tcp|context deadline|connection refused|can'?t scan|cannot scan|no such table|duplicate key value|syntax error at or near/i;

export const isInternalBackendError = (msg: unknown): boolean =>
  INTERNAL_ERROR.test(extractErrorMessage(msg, ''));

export const localizeBackendMessage = (msg: unknown, locale: string): string => {
  const raw = extractErrorMessage(msg, '');
  for (const [re, uz, ru, en] of BACKEND_MSG) {
    if (re.test(raw)) return trFor(locale)(uz, ru, en);
  }
  // 🔴 Ichki xato — hech qachon ko'rsatilmaydi. Bo'sh satr qaytariladi,
  // chaqiruvchi esa o'z umumiy xabarini ko'rsatadi.
  if (INTERNAL_ERROR.test(raw)) return '';
  return raw;
};

/**
 * ODAMGA KO'RSATILADIGAN xato matni — ichki axlat hech qachon o'tmaydi.
 *
 * 🔴 NEGA ALOHIDA FUNKSIYA (27.08.2026): `extractErrorMessage` XOM matnni
 * qaytaradi va u to'g'ri — u ichki ishlar uchun kerak (jurnal, naqsh
 * tekshiruvi). Muammo shundaki, uni EKRANGA ham ishlatishardi, va shu
 * yo'l bilan Postgres xatosi uch xil joydan chiqib ketdi:
 * mashina qo'shish, tarif sotib olish, kirish.
 *
 * Nomi ATAYIN «userFacing»: keyingi safar qaysi birini olish kerakligi
 * chaqiruv joyidan ko'rinib tursin.
 */
export const userFacingError = (msg: unknown, fallback: string): string => {
  const raw = extractErrorMessage(msg, '');
  if (!raw || isInternalBackendError(raw)) return fallback;
  return raw;
};

export const extractErrorMessage = (msg: unknown, fallback: string = 'Error'): string => {
  if (!msg) return fallback;
  if (typeof msg === 'string') return msg;
  if (typeof msg === 'object') {
    const o = msg as { message?: unknown; error?: unknown };
    if (o.message) return String(o.message);
    if (o.error && typeof o.error === 'string') return o.error;
    try {
      return JSON.stringify(msg);
    } catch {
      return fallback;
    }
  }
  return String(msg);
};

/**
 * Serverdan kelgan matndagi HTML belgilarini asliga qaytaradi.
 *
 * 🔴 2026-08-13 jonli o'lchov: backend chat matnini HTML sifatida KODLAB
 * saqlaydi. `so'm va "qo'shtirnoq" sinovi` deb yozilgan xabar bazadan
 * `so&#39;m va &#34;qo&#39;shtirnoq&#34; sinovi` bo'lib qaytadi. O'zbek
 * tilida apostrof deyarli har jumlada bor ("so'm", "yo'q", "bo'ladi"),
 * ya'ni odam chatda tinimsiz `&#39;` ko'rardi.
 *
 * Tuzatish backendda bo'lishi kerak (xat yozildi), lekin o'shangacha odamga
 * buzuq matn ko'rsatib turolmaymiz.
 *
 * XAVFSIZMI: ha. Matn React'da oddiy matn tuguni sifatida chiziladi
 * (`dangerouslySetInnerHTML` ISHLATILMAYDI), ya'ni `<b>` ham oddiy harf.
 */
export function unescapeHtml(input?: string | null): string {
  const text = input ?? '';
  if (!text.includes('&')) return text;
  let out = text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(x?)([0-9a-fA-F]+);/g, (whole, hex: string, code: string) => {
      const n = parseInt(code, hex ? 16 : 10);
      return Number.isNaN(n) ? whole : String.fromCodePoint(n);
    });
  // `&amp;` OXIRIDA: aks holda `&amp;#39;` ikki marta ochilib ketardi.
  out = out.replace(/&amp;/g, '&');
  return out;
}

/**
 * ===== APOSTROF («'») MUAMMOSI — YAGONA JOYDA HAL QILINADI =====
 *
 * 🔴 Backend saqlashdan oldin matnni HTML sifatida KODLAYDI. "Farg'ona"
 * bazadan `Farg&#39;ona` bo'lib qaytadi, ruscha qo'shtirnoq `&#34;` bo'ladi.
 * O'zbek tilida apostrof deyarli har jumlada bor ("so'm", "yo'q", "bo'ladi"),
 * ya'ni ekranda tinimsiz `&#39;` ko'rinardi — ismda, manzilda, mashina
 * modelida, posilka izohida, sharhda, bildirishnomada.
 *
 * Ilgari bu FAQAT chatda tuzatilgan edi (`unescapeHtml` ikkita joyda qo'lda
 * chaqirilardi). Qolgan o'nlab joyda matn buzuq chiqaverardi va har yangi
 * ekranda chaqiruvni yana unutish mumkin edi.
 *
 * Endi tuzatish TRANSPORT qatlamida: serverdan kelgan har qanday JSON
 * matni bir marta ochiladi va domen kodi bu haqda umuman bilmaydi.
 *
 * XAVFSIZMI: ha. Matn React'da oddiy matn tuguni sifatida chiziladi
 * (`dangerouslySetInnerHTML` butun loyihada ishlatilmaydi), ya'ni ochilgan
 * `<b>` ham oddiy harf bo'lib qoladi.
 *
 * ⚠️ IKKI MARTA OCHMANG: shu sabab chatdagi qo'lda chaqiriqlar olib
 * tashlandi. `&amp;#39;` ni ikki marta ochish `'` berib, foydalanuvchi
 * chindan yozgan matnni buzadi.
 *
 * Chuqurlik cheklangan: kutilmagan halqali obyektda cheksiz rekursiya
 * bo'lmasin (JSON'da halqa bo'lmaydi, lekin himoya arzon).
 */
export function deepUnescape(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === 'string') return unescapeHtml(value);
  if (Array.isArray(value)) return value.map((v) => deepUnescape(v, depth + 1));
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    for (const key of Object.keys(src)) {
      src[key] = deepUnescape(src[key], depth + 1);
    }
    return src;
  }
  return value;
}

/**
 * Oraliqni odam o'qiydigan ko'rinishga keltiradi: "2 soat 40 daqiqa",
 * "5 kun 19 soat".
 *
 * 🔴 KUN BIRLIGI SHART: eng katta birlik soat bo'lsa sutkadan oshgan
 * oraliq "139 soat 1 daqiqa" bo'lib chiqadi va odam uni miyasida 24 ga
 * bo'lishga majbur. Ilovada shu xato 10.09.2026 da aynan «Kechikmoqda»
 * yozuvida ko'ringan edi.
 *
 * Ilovadagi `formatDuration` (core/format.dart) bilan SO'ZMA-SO'Z bir xil.
 */
export const formatDuration = (ms: number, locale: string): string => {
  const pick = pickFor(locale);
  const total = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const d = pick('kun', 'д', 'd');
  const h = pick('soat', 'ч', 'h');
  const m = pick('daqiqa', 'мин', 'min');
  // Kun bo'lsa DAQIQA tushiriladi: "5 kun 19 soat" yetarli aniq.
  if (days > 0) return hours === 0 ? `${days} ${d}` : `${days} ${d} ${hours} ${h}`;
  if (hours <= 0) return `${minutes} ${m}`;
  if (minutes === 0) return `${hours} ${h}`;
  return `${hours} ${h} ${minutes} ${m}`;
};

/**
 * JO'NASH YOZUVI, SAFAR HOLATI bilan — «kechikish shaffofligi».
 *
 * 🔴 NEGA YOZILDI (14.09.2026, backend xati bilan birga o'lchandi):
 * [departureLabel] jo'nash vaqti o'tgan zahoti «Jo'nab ketdi» deb
 * yozardi — HOLATDAN QAT'I NAZAR. Lekin bron o'sha zahoti yopilmaydi:
 * backend ham, biz ham UCH SOAT kechikish oynasini ishlatamiz
 * ([LATE_GRACE_MS], jonli o'lchandi — jo'nash vaqtidan keyingi bron
 * 200 qaytaradi). Natijada o'sha uch soat ichida bitta kartada
 * bir vaqtning o'zida «FAOL» yorlig'i, «Jo'nab ketdi» yozuvi va
 * ISHLAYDIGAN «Joy band qilish» tugmasi turardi.
 *
 * Ilovada bu allaqachon to'g'ri edi (`departureStatusLabel`,
 * core/format.dart) — ya'ni bir safarni ikkala mijoz IKKI XIL
 * ta'riflardi. Endi matnlar so'zma-so'z bir xil.
 *
 * Uch holat ajratiladi:
 *   • safar boshlangan (`in_progress`) → «Yo'lda»;
 *   • vaqt o'tgan, lekin boshlanmagan → «Kechikmoqda — 12 daqiqa»;
 *   • qolgani → avvalgidek [departureLabel].
 */
export const departureStatusLabel = (
  iso: string | null | undefined,
  status: unknown,
  locale: string,
  now?: Date
): string => {
  const d = parseBackendDate(iso);
  if (!d) return '';
  const pick = pickFor(locale);
  const s = normalizeStatus(status);

  if (s === 'IN_PROGRESS') return pick("Yo'lda", 'В пути', 'On the way');

  const current = now ?? new Date();
  const lateMs = current.getTime() - d.getTime();
  // Faqat TIRIK safarda «kechikmoqda» deymiz: tugagan yoki bekor
  // qilingan safarda bu gap ma'nosiz.
  // `CREATED` — `ACTIVE` ning eski nomi (`isTripOpen` bilan bir xil ro'yxat).
  const live = isTripOpen(s) || s === 'DRAFT';
  if (live && lateMs >= 60_000) {
    return pick(
      `Kechikmoqda — ${formatDuration(lateMs, locale)}`,
      `Задерживается — ${formatDuration(lateMs, locale)}`,
      `Running late — ${formatDuration(lateMs, locale)}`
    );
  }
  return departureLabel(iso, locale, now);
};

/**
 * Jo'nashgacha qancha qolgani — "2 soat 40 daqiqadan keyin", "Ertaga 08:00".
 *
 * 🔴 NEGA KERAK: hamma joyda MUTLAQ vaqt turardi ("28.06.2026, 08:00"). Odam
 * uni har safar boshida hisoblaydi: "hozir soat necha, ulgurmanmi?". Eng ko'p
 * so'raladigan savol — "qancha qoldi", eng qiyin javob esa aynan shu edi.
 *
 * Yaqin vaqt uchun nisbiy, uzoq uchun BO'SH qaytadi — chaqiruvchi o'zining
 * odatiy sanasini ko'rsatishda davom etadi ("5 kundan keyin" hech kimga
 * yordam bermaydi, "Ertaga 08:00" esa beradi).
 *
 * `now` ATAYIN parametr: testda/SSR'da vaqtni qotirish uchun.
 *
 * Ilova `departureLabel` bilan BIR XIL qoidalar bo'yicha ishlaydi — ikkala
 * mijoz bir xil safarni bir xil ta'riflashi kerak.
 */
export const departureLabel = (
  iso: string | null | undefined,
  locale: string,
  now?: Date
): string => {
  const d = parseBackendDate(iso);
  if (!d) return '';
  const pick = pickFor(locale);
  const current = now ?? new Date();
  const ms = d.getTime() - current.getTime();

  if (ms < 0) return pick("Jo'nab ketdi", 'Отправился', 'Departed');

  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return pick("Hozir jo'naydi", 'Отправляется', 'Departing now');

  if (minutes < 12 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const unitH = pick('soat', 'ч', 'h');
    const unitM = pick('daqiqa', 'мин', 'min');
    const body =
      h <= 0 ? `${m} ${unitM}` : m === 0 ? `${h} ${unitH}` : `${h} ${unitH} ${m} ${unitM}`;
    // O'zbekchada qo'shimcha OXIRGI so'zga qo'shiladi va ikkala holatda ham
    // to'g'ri chiqadi: "3 soat" + "dan keyin", "2 soat 40 daqiqa" + "dan keyin".
    return pick(`${body}dan keyin`, `через ${body}`, `in ${body}`);
  }

  // Bugun/ertaga — Toshkent kunlari bo'yicha (foydalanuvchi soati emas).
  const dayOf = tashkentLocalDate(d.toISOString());
  const todayStr = tashkentLocalDate(current.toISOString());
  const tomorrow = new Date(current.getTime() + 24 * 3600 * 1000);
  const tomorrowStr = tashkentLocalDate(tomorrow.toISOString());

  if (dayOf === todayStr)
    return `${pick('Bugun', 'Сегодня', 'Today')} ${formatTripTime(d.toISOString())}`;
  if (dayOf === tomorrowStr)
    return `${pick('Ertaga', 'Завтра', 'Tomorrow')} ${formatTripTime(d.toISOString())}`;

  // Uzoq sana — chaqiruvchidagi odatiy sana yozuvi yetarli.
  return '';
};

/**
 * Kun ajratgichi yozuvi: "Bugun" / "Kecha" / "18.08.2026".
 *
 * Ilovadagi `chatDayLabel` bilan bir xil qoida. Kunlar TOSHKENT bo'yicha
 * hisoblanadi, foydalanuvchi qurilmasining vaqt mintaqasi bo'yicha emas —
 * aks holda chet eldagi odam "Bugun" o'rniga "Kecha" ni ko'rardi.
 */
export const dayLabel = (iso: string | null | undefined, locale: string): string => {
  const d = parseBackendDate(iso);
  if (!d) return '';
  const pick = pickFor(locale);
  const now = new Date();
  const day = tashkentLocalDate(d.toISOString());
  const today = tashkentLocalDate(now.toISOString());
  const yesterday = tashkentLocalDate(new Date(now.getTime() - 24 * 3600 * 1000).toISOString());

  if (day === today) return pick('Bugun', 'Сегодня', 'Today');
  if (day === yesterday) return pick('Kecha', 'Вчера', 'Yesterday');
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TASHKENT_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(d)
    .replace(/[\u202F\u00A0]/g, ' ');
};

/**
 * Ro'yxatni KUNLAR bo'yicha guruhlaydi (tartibi saqlanadi).
 *
 * 🔴 NEGA KERAK: bildirishnomalar tekis ro'yxat edi — o'ntasi ketma-ket
 * turardi va qaysi biri bugungi, qaysi biri o'tgan haftaniki ekani faqat
 * kichkina sanadan bilinardi. Chatda ajratgichlar allaqachon bor, bu esa
 * o'sha qoidaning ro'yxatlarga ko'chirilgani.
 */
export const groupByDay = <T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  locale: string
): { label: string; items: T[] }[] => {
  const out: { label: string; items: T[] }[] = [];
  for (const item of items) {
    // Sanasi yo'q element TASHLANMAYDI — oldingi guruhda qoladi, guruh
    // hali ochilmagan bo'lsa bo'sh sarlavha bilan boshlanadi. Elementni
    // yo'qotgandan ko'ra sarlavhasiz ko'rsatgan yaxshi.
    const label = dayLabel(getDate(item), locale);
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(item);
    else out.push({ label, items: [item] });
  }
  return out;
};
