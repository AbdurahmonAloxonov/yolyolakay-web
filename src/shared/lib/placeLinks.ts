/**
 * Joyni TASHQI xaritada ochish + `.ics` kalendar fayli.
 *
 * 🔴 NEGA `geo:` EMAS, balki OSM havolasi: brauzerda `geo:` sxemasini
 * ochadigan ishonchli yo'l yo'q (desktop umuman bilmaydi). Shuning uchun
 * saytda openstreetmap.org sahifasi ochiladi — u nuqtani ko'rsatadi.
 * Ilovada esa `geo:` ishlatiladi va u foydalanuvchining O'Z xarita
 * ilovasini ochadi (izohi `place_links.dart` da).
 *
 * ⚠️ OSM'ning O'ZI navigator EMAS, u xarita MA'LUMOTI — yo'l ko'rsatmaydi.
 * Buni yashirmaymiz.
 */
export const osmPlaceUrl = (lat: number, lon: number): string =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;

/** Masofa — yaqin joyda METR, uzoqda KILOMETR (ilova bilan bir xil qoida). */
export const formatDistance = (km: number): string => {
  if (km < 1) {
    // 50 metrgacha yaxlitlanadi: GPS aniqligi baribir undan yaxshi emas
    // va "687 m" soxta aniqlik berardi.
    const meters = Math.round((km * 1000) / 50) * 50;
    return `${Math.min(950, Math.max(50, meters))} m`;
  }
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
};

/**
 * Safar uchun `.ics` (RFC 5545) — telefon/kompyuter kalendariga qo'shish.
 *
 * 🔴 NEGA KERAK: shaharlararo safar bir necha kun oldin rejalashtiriladi va
 * unutiladi. Kalendar ilovadagi eslatmadan kuchliroq: u ilovadan
 * TASHQARIDA yashaydi va boshqa qurilmalarga sinxronlanadi.
 *
 * ⚠️ Vaqt UTC'da (`Z`) yoziladi — kalendar uni o'z mintaqasiga o'giradi.
 * Mahalliy vaqtni mintaqasiz yozish eng ko'p uchraydigan `.ics` xatosi.
 */
export const buildIcs = ({
  uid,
  start,
  title,
  description,
  location,
  durationHours = 2,
}: {
  uid: string;
  start: Date;
  title: string;
  description?: string;
  location?: string;
  durationHours?: number;
}): string => {
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  // Vergul, nuqta-vergul va yangi qator `.ics` da MAXSUS belgilar —
  // qochirilmasa fayl buziladi va kalendar uni umuman ochmaydi.
  const esc = (raw: string) =>
    raw.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\;').replace(/\n/g, '\\n');

  const end = new Date(start.getTime() + durationHours * 3600 * 1000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YolYolakay//UZ//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}@yolyolakay.co.uz`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
    ...(location ? [`LOCATION:${esc(location)}`] : []),
    // Kalendarning O'Z eslatmasi — sayt ochiq bo'lmasa ham ishlaydi.
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

/** `.ics` ni yuklab olish (brauzerda fayl sifatida). */
export const downloadIcs = (fileName: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Brauzer faylni o'qib bo'lgach bo'shatamiz — darhol bo'shatilsa
  // yuklanish uzilib qolishi mumkin.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
