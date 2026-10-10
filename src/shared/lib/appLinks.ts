/**
 * Mobil ilova havolalari — BITTA joyda.
 *
 * 🔴 NEGA BO'SH (2026-08-28): `uz.yolyolakay.mobile` Play do'konida
 * OCHIQ ro'yxatda YO'Q — jonli tekshirildi, 404 qaytaradi (nazorat
 * uchun boshqa ilova o'sha usulda 200 berdi). Ilova ichki sinov
 * yo'lagida tarqatilyapti, unday havola esa faqat taklif qilingan
 * sinovchida ochiladi.
 *
 * Shuning uchun landingdagi ilova bloki HOZIRCHA CHIZILMAYDI: o'lik
 * havola qo'yish — sahifadagi eng yomon narsa, odam bosadi va «404»
 * ko'radi.
 *
 * ✅ Ilova ochiq chiqarilgach shu qatorga manzil yozilsa, blok o'zi
 * paydo bo'ladi — boshqa hech nima o'zgartirilmaydi.
 */
export const PLAY_URL = '';

/** Havola bormi — bloklar shunga qarab chiziladi. */
export const hasApp = PLAY_URL.length > 0;
