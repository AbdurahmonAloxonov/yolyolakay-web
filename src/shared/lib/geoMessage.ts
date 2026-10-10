/**
 * CHATDA JOY ULASHISH — xabar formati.
 *
 * 🔴 MIJOZLAR BIR-BIRINI TUSHUNMASDI (16.09.2026 da topildi). Saytda
 * «joyimni yuborish» ALLAQACHON bor edi va u OSM HAVOLASINI yuborardi:
 *
 *     https://www.openstreetmap.org/?mlat=41.31&mlon=69.24#map=16/...
 *
 * Ilovada esa bunday imkoniyat umuman yo'q edi va kelgan havola oddiy
 * uzun matn bo'lib ko'rinardi — telefonda uni bosish OSM saytini ochib,
 * odamni ilovadan chiqarib yuborardi. Bu loyihaning eski kasali
 * («mijozlar nomuvofiqligi»): ikki mijoz bir ishni ikki xil qiladi.
 *
 * 🔑 YAGONA FORMAT — standart `geo:` URI:
 *
 *     geo:41.311081,69.240562
 *     Toshkent, Amir Temur ko'chasi
 *
 * Sabablari:
 *   1. BACKEND O'ZGARMAYDI — chat xabari oddiy matn (`content`), unda
 *      tur maydoni yo'q;
 *   2. eski mijoz buni MATN bo'lib ko'radi va matn baribir foydali —
 *      ikkinchi qatorda joy nomi turadi;
 *   3. `geo:` — standart URI, telefon uni o'zi taniydi.
 *
 * ⚠️ ESKI OSM HAVOLASI ham o'qiladi: tarixda allaqachon yuborilgan
 * xabarlar bor va ular xarita bo'lib chizilishi kerak. Biz ularni
 * YUBORMAYMIZ, faqat O'QIYMIZ.
 *
 * Bu fayl `yolyolakay_flutter/lib/core/geo_message.dart` ning aynan
 * juftligi — ikkalasi bir vaqtda o'zgarishi shart.
 */

export interface GeoMessage {
  lat: number;
  lon: number;
  /** Joy nomi — teskari geokoderdan. Bo'lmasa `null`. */
  label: string | null;
}

/** Yuboriladigan xabar matni. */
export function encodeGeoMessage(lat: number, lon: number, label?: string | null): string {
  const head = `geo:${lat},${lon}`;
  const name = (label ?? '').trim();
  return name ? `${head}\n${name}` : head;
}

function valid(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  // Yaroqsiz koordinata xaritani okean o'rtasiga sudrab ketardi.
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  return !(lat === 0 && lon === 0);
}

/**
 * Xabar matnidan joyni ajratadi. Joy bo'lmasa `null` — xabar oddiy matn
 * sifatida chiziladi.
 */
export function parseGeoMessage(content: string): GeoMessage | null {
  const text = (content ?? '').trim();
  if (!text) return null;

  // ─── Yangi format: `geo:lat,lon` ───
  //
  // ⚠️ FAQAT xabar `geo:` bilan BOSHLANSA: odam xabar o'rtasida `geo:`
  // deb yozsa, uni butun boshli xaritaga aylantirish noto'g'ri bo'lardi.
  if (text.toLowerCase().startsWith('geo:')) {
    const newline = text.indexOf('\n');
    const head = (newline === -1 ? text : text.slice(0, newline)).slice(4);
    const label = newline === -1 ? '' : text.slice(newline + 1).trim();

    // Qo'shimcha parametrlar (`;u=`, `?q=`) tashlanadi: biz ularni
    // yubormaymiz, lekin boshqa ilovadan kelishi mumkin.
    const parts = head.split(/[;?]/)[0].split(',');
    if (parts.length < 2) return null;
    const lat = Number(parts[0].trim());
    const lon = Number(parts[1].trim());
    if (!valid(lat, lon)) return null;
    return { lat, lon, label: label || null };
  }

  // ─── ESKI format: saytning OSM havolasi (faqat o'qish uchun) ───
  if (text.includes('openstreetmap.org') && text.includes('mlat=')) {
    const lat = Number(/[?&]mlat=(-?[\d.]+)/.exec(text)?.[1]);
    const lon = Number(/[?&]mlon=(-?[\d.]+)/.exec(text)?.[1]);
    if (!valid(lat, lon)) return null;
    return { lat, lon, label: null };
  }

  return null;
}
