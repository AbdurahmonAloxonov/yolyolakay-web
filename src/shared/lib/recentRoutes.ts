/**
 * Oxirgi qidirilgan yo'nalishlar (from -> to) — localStorage'da, tez qayta qidirish uchun.
 * Faqat mijozda; maksimal 5 ta, eng yangisi birinchi, takroriylari birlashtiriladi.
 */
export interface RecentRoute {
  from: string;
  to: string;
}

const KEY = 'recent_routes';
const MAX = 5;

export const getRecentRoutes = (): RecentRoute[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((r) => r && typeof r.from === 'string' && typeof r.to === 'string').slice(0, MAX)
      : [];
  } catch {
    return [];
  }
};

export const addRecentRoute = (from: string, to: string): void => {
  if (typeof window === 'undefined') return;
  const f = from.trim();
  const t = to.trim();
  if (!f || !t) return;
  const rest = getRecentRoutes().filter(
    (r) => !(r.from.toLowerCase() === f.toLowerCase() && r.to.toLowerCase() === t.toLowerCase())
  );
  try {
    localStorage.setItem(KEY, JSON.stringify([{ from: f, to: t }, ...rest].slice(0, MAX)));
  } catch {
    /* localStorage to'la/o'chirilgan — jim */
  }
};
