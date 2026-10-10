import { api } from '@/shared/api/client';
import { getAccessToken } from '@/shared/lib/token';

/**
 * Foydalanish statistikasi — `POST /analytics/events`.
 *
 * Backend buni ancha oldin qurgan, lekin bizga aytmagan (swagger sverkasi,
 * 2026-08-16). Biz hech narsa yubormasdik, ya'ni egasi "odamlar xizmatda
 * nima qilyapti?" degan savolga javob ololmasdi.
 *
 * ═══ NIMA UCHUN AYNAN SHU HODISALAR ═══
 *
 * Ro'yxat ATAYIN qisqa. Hamma bosishni yozish oson, lekin keyin undan
 * hech narsa o'qib bo'lmaydi — shovqin ichida javob ko'rinmaydi. Har bir
 * hodisa BITTA aniq savolga javob beradi (pastdagi izohlar). Yangi hodisa
 * qo'shishdan oldin "bu qaysi savolga javob beradi?" degan savolga javob
 * bo'lishi kerak.
 *
 * ═══ MAXFIYLIK ═══
 *
 * 🔴 Ism, telefon raqami, chat matni va aniq manzil YUBORILMAYDI —
 * faqat sonlar va ID'lar. Maxfiylik siyosatida ham AYNAN shunday yozilgan
 * (`/privacy`, 2-band). U yerda va'da qilinganidan ko'proq ma'lumot
 * yig'ish eng yomon xil xato.
 *
 * Mobil ilovada ayni modul: `lib/core/analytics.dart`.
 */

/** Yuboriladigan hodisalar. Har biri BITTA savolga javob beradi. */
export const AnalyticsEvent = {
  /**
   * «Qaysi yo'nalishlar qidirilyapti va ularda safar BORMI?»
   *
   * 🔴 Ro'yxatdagi eng qimmatli hodisa: natija SONI bilan birga
   * yuboriladi, ya'ni "talab bor, taklif yo'q" yo'nalishlar ko'rinadi —
   * qayerga haydovchi jalb qilish kerakligini aytadi.
   */
  search: 'search_performed',
  /** «Qidiruvdan safar sahifasiga qanchasi o'tadi?» */
  rideOpened: 'ride_opened',
  /** «Safar sahifasidan bronga qanchasi yetib boradi?» */
  bookingCreated: 'booking_created',
  /** «Haydovchilar e'lon berayaptimi?» — taklif tomonining o'lchovi. */
  ridePublished: 'ride_published',
  /** «Paket tugagani uchun ochilgan tariflar — qanchasi sotuvga aylanadi?» */
  paywallShown: 'paywall_shown',
  /** «Qaysi tarif tanlanyapti va to'lov oqimida qayerda uzilish bor?» */
  planPurchaseStarted: 'plan_purchase_started',
  /**
   * «Taklif havolalari ISHLAYAPTIMI va kim olib kelyapti?»
   *
   * 🔴 Ilgari taklif havolasi oddiy `yolyolakay.co.uz` edi, ya'ni
   * odam ellikta tanishini chaqirsa ham buni hech kim bilmasdi.
   * Bu hodisa YANGI hisob ochilganda va faqat kod bo'lsa yoziladi
   * (izohi `shared/lib/referral.ts` da).
   */
  inviteSignup: 'invite_signup',
} as const;

type EventType = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/**
 * Hodisani yuborish — natija KUTILMAYDI va xato YUTILADI.
 *
 * Statistika hech qachon foydalanuvchi oqimini to'xtatmaydi. Mehmonda
 * (tokensiz) umuman yuborilmaydi: gateway 401 qaytaradi va konsolda
 * bekorga shovqin bo'lardi.
 */
export const logEvent = (
  event: EventType,
  payload: Record<string, string | number | boolean> = {}
): void => {
  if (typeof window === 'undefined' || !getAccessToken()) return;
  void api
    .post('/analytics/events', { event_type: event, payload }, { skipErrorToast: true })
    .catch(() => {
      /* jim — statistika yiqilgani foydalanuvchiga aloqasi yo'q */
    });
};
