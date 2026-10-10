/**
 * Backend qaytargan media manzilini OCHILADIGAN holga keltiradi.
 *
 * 🔴 NEGA KERAK (egasi, 2026-08-16: "rasm backendga saqlanyapti, lekin na
 * saytda na ilovada ko'rinmayapti"): `POST /media/upload` manzilni NISBIY
 * qaytarishi mumkin (`/uploads/abc.jpg`). Bunday satr profilga yozilib,
 * bazada to'g'ri turadi — lekin brauzer uni SAYT domeniga nisbatan ochadi
 * (`yolyolakay.co.uz/uploads/abc.jpg`), u yerda esa hech nima yo'q. Natijada
 * rasm saqlanadi-yu hech qayerda ko'rinmaydi, hech qanday xato ham chiqmaydi
 * — `Avatar` jimgina bosh harflarga qaytadi.
 *
 * Yechim: nisbiy yo'lni `/api-proxy` orqali o'tkazamiz (next.config.ts
 * rewrites uni `BACKEND_URL` ga uzatadi). Backend to'liq manzil qaytarsa
 * satr TEGILMAYDI.
 *
 * Flutter tomonda ayni mantiq: `lib/core/media_url.dart`.
 *
 * ✅ 2026-08-27: media ENDI OCHIQ, `?token=` yamog'i OLIB TASHLANDI.
 * 2026-08-22 dan beri bu yerda token manzilga qo'shilardi, chunki
 * `.xyz` da media tokensiz 401 qaytarardi va `<img src>` `Authorization`
 * sarlavhasini yubormaydi. Token manzilda ketgani uchun proksi jurnaliga
 * tushardi — bu bila turib qabul qilingan vaqtinchalik yechim edi.
 * `.com` ga ko'chgach ikki mustaqil o'lchov uni yopdi: (1) mavjud bo'lmagan
 * faylga tokensiz so'rov **404** qaytaradi (401 emas — ya'ni auth
 * middleware'i marshrutdan oldin ishlamaydi), (2) swaggerda
 * `GET /media/{filename}` da `security` YO'Q, `POST /media/upload` da esa BOR.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api-proxy';

export const mediaUrl = (raw?: string | null): string | undefined => {
  const value = raw?.trim();
  if (!value) return undefined;

  // `data:`/`blob:` — bular bizning serverimizdan emas, tegilmaydi.
  if (/^(data:|blob:)/i.test(value)) return value;

  // Allaqachon to'liq manzil.
  if (/^https?:/i.test(value)) return value;

  // Protokolsiz (`//cdn.example.com/a.jpg`) — brauzer o'zi hal qiladi.
  if (value.startsWith('//')) return value;

  return `${API_URL}/${value.replace(/^\/+/, '')}`;
};
