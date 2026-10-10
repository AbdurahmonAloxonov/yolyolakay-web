// Swagger: http.PublishRideRequest / http.RideStopRequest / http.RideSearchResponse /
// http.BookRideRequest / http.CancelRideRequest / ride_domain.Booking / ride_domain.DriverProfile
// (2026-07-18 dump).

/** Haydash uslubi — haydovchi o'zi e'lon qiladi: calm (sekin) | normal (o'rtacha) | fast (tez) */
export type DrivingSpeed = 'calm' | 'normal' | 'fast' | (string & {});

/** Safar hayot sikli: draft -> active -> in_progress -> completed (yoki cancelled) */
export type RideStatus =
  | 'draft'
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | (string & {});

/** Bron statusi — jonli tasdiqlangan: accept'dan keyin `confirmed` (accepted EMAS) */
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'no_show' | (string & {});

export interface RideStop {
  address: string;
  lat: number;
  lon: number;
  /* Javobda qaytadigan (yuborishda kerak emas) maydonlar — swagger 2026-08-03. */
  id?: string;
  ride_id?: string;
  /** Marshrutdagi tartib raqami (0 dan) */
  order_index?: number;
}

/** POST /rides/ — MUHIM: yaratilgan safar `draft`, DARHOL activate chaqirilmasa qidiruvda chiqmaydi */
export interface PublishRideRequest {
  /** RFC3339, masalan 2026-07-19T09:00:00+05:00 */
  departure_time: string;
  origin_address: string;
  origin_lat: number;
  origin_lon: number;
  destination_address: string;
  destination_lat: number;
  destination_lon: number;
  price_per_seat: number;
  total_seats: number;
  /** users/me/cars dagi mashina IDsi — majburiy */
  vehicle_id: string;
  gender_restriction?: string;
  has_ac?: boolean;
  has_luggage?: boolean;
  is_negotiable?: boolean;
  pickup_point?: string;
  /**
   * UCHRASHUV NUQTASI — ANIQ KOORDINATA.
   *
   * 🔑 17.09.2026 da JONLI O'LCHANDI: backend bu ikki maydonni
   * saqlaydi va `GET /rides/{id}` da ham, `GET /rides/search` javobida
   * ham qaytaradi. Shu paytgacha ikkala mijoz ham xaritadan nuqta
   * tanlatib, koordinatani TASHLAB YUBORARDI (faqat matn saqlanardi)
   * va yo'lovchi tomonda matn qayta geokodlanib, boshqa joyga tushishi
   * mumkin edi.
   *
   * ⚠️ Matn (`pickup_point`) O'CHIRILMAYDI: u mo'ljal («3-chiqish
   * yonida») va koordinata bermaydigan ma'noni tashiydi.
   */
  pickup_lat?: number;
  pickup_lon?: number;
  stops?: RideStop[];
  takes_parcels?: boolean;
  /** Salonda chekish taqiqlangan */
  no_smoking?: boolean;
  /** Hayvon olib kirish taqiqlangan */
  no_pets?: boolean;
  /** Haydash uslubi (sekin/o'rtacha/tez) — yo'lovchi qulaylik uchun */
  driving_speed?: DrivingSpeed;
  /** Komfort: orqa o'rindiqda ko'pi bilan 2 yo'lovchi */
  max_two_back?: boolean;
  /**
   * Yo'lda musiqa — `quiet` | `loud` | `talk`. «Farqi yo'q» bo'lsa
   * maydon UMUMAN yuborilmaydi (ixtiyoriy maydonlar qoidasi).
   */
  music_taste?: string;
}

/** POST /rides/ javobi: 201 {ride_id} */
export interface PublishRideResponse {
  ride_id: string;
}

export interface DriverProfile {
  /** Haydovchi UUID — chat recipient_id/user_id_2 uchun (backend javobi v6 §3;
   *  2026-07-19 hali stagingga deploy qilinmagan — kelguncha undefined bo'ladi). */
  id?: string;
  name?: string;
  avatar?: string;
  rating?: number;
  /**
   * Telefon raqami — FAQAT bron tasdiqlangach ko'rsatiladi (`ContactRow`).
   *
   * ⚠️ IKKI NOM: jonli swagger (2026-08-16) `PassengerProfile` da
   * `phone_number` deb yozadi. Biz xatda `phone` deb so'ragan edik,
   * shuning uchun IKKALASINI ham qabul qilamiz — kelajakda nom
   * o'zgarsa ham raqam jimgina yo'qolmaydi.
   *
   * ✅ 2026-08-28: backend qo'shdi va JONLI o'lchandi — telefon FAQAT
   * tasdiqlangan bronda keladi (mehmon, begona va kutayotgan
   * yo'lovchida maydon umuman yo'q).
   */
  phone?: string;
  phone_number?: string;
  /**
   * Hujjat tekshiruvi holati — `approved` / `verified` / `accepted`.
   * Backend `DriverProfile` da qaytaradi (jonli o'lchandi 2026-08-28).
   * Tekshirish uchun `isKycApproved()` — uch qiymatni bittasiga
   * qarab hukm chiqarmaslik uchun.
   */
  kyc_status?: string;
  created_at?: string;
  /**
   * `male` | `female` — MA'LUMOT sifatida ko'rsatiladi (filtr emas).
   * `/rides/{id}/passengers` javobida keladi; hamrohlar ro'yxatida
   * jins yozuvi uchun ishlatiladi.
   */
  gender?: string;
}

/** GET /rides/search elementi — koordinatalar YASSI (lat/lon), manzillar MATN */
export interface RideSearchItem {
  id: string;
  origin_address: string;
  origin_lat: number;
  origin_lon: number;
  destination_address: string;
  destination_lat: number;
  destination_lon: number;
  departure_time: string;
  total_seats: number;
  available_seats: number;
  price_per_seat: number;
  status: RideStatus;
  driver?: DriverProfile;
  gender_restriction?: string;
  has_ac?: boolean;
  has_luggage?: boolean;
  has_fair_price_badge?: boolean;
  is_negotiable?: boolean;
  pickup_point?: string;
  /** Uchrashuv nuqtasining koordinatasi — izohi `PublishRideRequest` da. */
  pickup_lat?: number;
  pickup_lon?: number;
  takes_parcels?: boolean;
  no_smoking?: boolean;
  no_pets?: boolean;
  driving_speed?: DrivingSpeed;
  max_two_back?: boolean;
  /**
   * Yo'lda musiqa — `quiet` | `loud` | `talk` (ixtiyoriy).
   *
   * ⚠️ Serverda ERKIN MATN ustuni (09.09.2026 o'lchovi: uzun jumla ham
   * saqlandi va qaytdi), lekin ikkala mijoz ATAYIN uch qiymat bilan
   * cheklaydi — aks holda belgi mos kelmay qoladi.
   * ⚠️ `GET /rides/search` javobida YO'Q, `GET /rides/{id}` da BOR.
   */
  music_taste?: string;
  /** Oraliq shaharlar (yo'l-yo'lakay kirib o'tiladigan) — create'da yuboriladi, javobda kutiladi */
  stops?: RideStop[];

  /**
   * Mashina — 2026-08-07 swaggerida `RideResponse` VA `RideSearchResponse` ikkalasida
   * `car: domain.Vehicle` bo'lib turibdi, ya'ni alohida `GET /vehicles/{id}` shart emas.
   * Shakl `shared/api/vehicles.ts` dagi `normalizeVehicle` bilan o'qiladi (u `gov_number`
   * va `license_plate` ikkalasini ham tushunadi — backend ikki xil ataydi).
   *
   * Ixtiyoriy: jonli javobda yo'q bo'lsa sahifa `vehicle_id` bo'yicha alohida so'raydi.
   */
  car?: unknown;
  vehicle_id?: string;

  /**
   * TASDIQLANGAN yo'lovchilar — `GET /rides/{id}` javobining O'ZIDA keladi.
   *
   * 🔑 NEGA MUHIM (jonli o'lchandi 14.09.2026): bu ro'yxat HAMMAGA ochiq —
   * mehmonga ham, hali bron qilmagan begonaga ham. Telefon esa faqat
   * haydovchi va TASDIQLANGAN yo'lovchiga qo'shiladi, qolganiga maydon
   * umuman kelmaydi (bo'sh satr emas — KALIT YO'Q).
   *
   * ⚠️ `GET /rides/{id}/passengers` bilan ADASHTIRMANG: o'sha endpoint
   * telefon bilan birga keladi va shuning uchun RBAC ostida —
   * begonaga 403, hatto TASDIQLANMAGAN (pending) bron egasiga ham 403.
   * Ya'ni "kim bilan ketaman" degan savolga javobni aynan qaror
   * qilayotgan odam ololmasdi. Sahifa shu sababli SHU maydonni
   * o'qiydi, `/passengers` ni emas.
   */
  passengers?: DriverProfile[];
}

/**
 * `GET /rides/earnings` javobi — swagger `http.DriverStatisticsResponse`
 * (2026-08-03 da sxemasi paydo bo'ldi). Davr (oy/hafta) filtri YO'Q: raqamlar
 * butun vaqt uchun.
 */
export interface DriverStatistics {
  total_earnings?: number;
  total_rides?: number;
  completed_rides?: number;
  cancelled_rides?: number;
}

export interface RideSearchParams {
  origin_lat: number;
  origin_lon: number;
  dest_lat: number;
  dest_lon: number;
  /** Radius KM'da — origin VA dest ikkalasidan (AND); backend default bilan kelishilgani 25 */
  radius_km: number;
  min_seats?: number;

  /* ---- 2026-07-31 da backend qo'shgan filtrlar (jonli tekshirilgan) ----
     Ilgari bular KLIENT tomonda hisoblanardi va yolg'on natija berardi:
     backend qaytargan qismdan tashqaridagi arzon safar ko'rinmay qolardi. */

  /** Narx (o'rindiq uchun, UZS). Ikki tomoni ham inklyuziv. */
  price_min?: number;
  price_max?: number;

  /**
   * ⚠️ TO'LIQ RFC3339 bo'lishi SHART: "2026-07-31T00:00:00Z".
   * Oddiy "2026-07-31" yuborilsa backend 400 qaytaradi
   * (`cannot parse "" as "T"`) — jonli tasdiqlangan 2026-07-31.
   * <input type="date"> YYYY-MM-DD beradi, shuning uchun konvertatsiya shart:
   * shared/lib/format.ts -> dateToRangeISO().
   */
  date_from?: string;
  date_to?: string;

  /** "female" — faqat ayollar uchun safarlar. */
  gender_restriction?: string;

  /* Eslatma: `city` parametri KERAK EMAS. Backend qidiruvi fazoviy (ST_DWithin)
     va shahar koordinatasi origin/dest/stops bilan solishtiriladi — ya'ni
     oraliq to'xtashdagi shahar ham topiladi (backend javobi §1). */
}

/**
 * Bron — JONLI shakl (2026-07-18): gateway PASCALCASE qaytaradi (Swagger'dagi camelCase
 * YOLG'ON chiqdi). UI'da to'g'ridan ishlatilmaydi — normalizeBooking (shared/lib/format)
 * snake_case'ga keltiradi va confirmed->ACCEPTED xaritalaydi.
 */
export interface Booking {
  ID: string;
  RideID: string;
  PassengerID: string;
  SeatsBooked: number;
  /** null bo'lishi mumkin (rides/my ro'yxatida jonli kuzatilgan) */
  OfferedPrice: number | null;
  TotalPrice?: number;
  IsFullCarBuyout?: boolean;
  Status: BookingStatus;
  CreatedAt?: string;
  UpdatedAt?: string;
}

/** POST /rides/{id}/book — maydon `seats` (seats_booked EMAS) */
export interface BookRideRequest {
  seats: number;
  offered_price?: number;
  /** Butun salonni sotib olish — seats e'tiborga olinmaydi */
  is_full_car_buyout?: boolean;
}

export interface CancelRideRequest {
  reason?: string;
}

/**
 * GET /rides/my?role=driver|passenger[&status=] elementi — Swagger shaklni ochiq qoldirgan
 * (additionalProperties), jonlida: search'dagi maydonlar + bookings[] (camelCase) keladi.
 */
export interface MyRide extends RideSearchItem {
  bookings?: Booking[];
  vehicle_id?: string;
  created_at?: string;
}
