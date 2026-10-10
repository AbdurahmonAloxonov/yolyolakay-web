/**
 * Real-time WebSocket URL — gateway yo'li ILDIZDA: /ws (eski /api/v1/ws EMAS).
 * Auth: ?token=<access_jwt> — backend user id'ni tokendan oladi (user_id query YUBORILMAYDI).
 *
 * `token` HAR chaqiruvda uzatiladi — chaqiruvchi reconnect'da joriy (yangi) tokenni qayta
 * o'qib berishi SHART (getAccessToken()), aks holda refresh'dan keyin eski token bilan aylanadi.
 */
export function buildWsUrl(token: string): string {
  if (typeof window === 'undefined') return '';
  let wsBase = process.env.NEXT_PUBLIC_WS_URL;
  // HTTPS sahifada ws:// mixed-content sifatida bloklanadi — wss://'ga ko'taramiz.
  if (wsBase && window.location.protocol === 'https:' && wsBase.startsWith('ws://')) {
    wsBase = 'wss://' + wsBase.slice('ws://'.length);
  }
  if (!wsBase) {
    // Env qo'yilmagan bo'lsa same-origin /ws (Next proxy WS o'tkazmaydi — faqat backend
    // shu hostda bo'lsa ishlaydi; staging'da NEXT_PUBLIC_WS_URL majburiy).
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsBase = `${proto}//${window.location.host}/ws`;
  }
  return `${wsBase}${wsBase.includes('?') ? '&' : '?'}token=${token}`;
}
