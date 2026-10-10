/**
 * MANZILDAGI OB-HAVO — safar kunidagi eng yuqori harorat.
 *
 * 🔴 MANBA: Open-Meteo — KALIT talab qilmaydi va bizning backendimizga
 * bog'liq emas. So'rov TO'G'RIDAN brauzerdan ketadi (proxy kerak emas).
 *
 * ⚠️ LITSENZIYA: Open-Meteo bepul tarifi NOTIJORAT foydalanish uchun.
 * YolYolakay tijorat mahsuloti, ya'ni relizdan oldin ularning tijorat
 * tarifiga o'tish yoki bu funksiyani olib tashlash kerak. Egasi
 * xabardor qilingan (2026-08-21).
 *
 * ⚠️ Xato YUTILADI: ob-havo QO'SHIMCHA ma'lumot va uning yiqilishi safar
 * sahifasini buzmasligi kerak.
 */
export interface DayWeather {
  maxTemp: number;
  code: number;
}

export async function fetchDayWeather(
  lat: number,
  lon: number,
  isoDay: string
): Promise<DayWeather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,weather_code&timezone=Asia%2FTashkent` +
      `&start_date=${isoDay}&end_date=${isoDay}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: { temperature_2m_max?: number[]; weather_code?: number[] };
    };
    const temp = json.daily?.temperature_2m_max?.[0];
    if (typeof temp !== 'number') return null;
    return { maxTemp: temp, code: json.daily?.weather_code?.[0] ?? 0 };
  } catch {
    return null;
  }
}

/** Harorat — butun songa yaxlitlangan: "+31.7°" soxta aniqlik beradi. */
export const tempLabel = (maxTemp: number): string => {
  const rounded = Math.round(maxTemp);
  return `${rounded > 0 ? '+' : ''}${rounded}°`;
};

/**
 * WMO kodi -> qisqa tavsif. To'liq jadval EMAS, faqat guruhlar: aniq kod
 * ("o'rtacha kuchli yomg'ir") odamga qo'shimcha hech nima bermaydi.
 */
export const weatherLabel = (
  code: number,
  pick: (uz: string, ru: string, en: string) => string
): string => {
  if (code === 0) return pick('ochiq', 'ясно', 'clear');
  if (code <= 3) return pick('bulutli', 'облачно', 'cloudy');
  if (code <= 49) return pick('tuman', 'туман', 'fog');
  if (code <= 69) return pick("yomg'ir", 'дождь', 'rain');
  if (code <= 79) return pick('qor', 'снег', 'snow');
  if (code <= 89) return pick('jala', 'ливень', 'showers');
  return pick('momaqaldiroq', 'гроза', 'thunderstorm');
};
