import type { QueryClient } from '@tanstack/react-query';
import { deleteSession } from '@/shared/api/auth';
import { getDeviceId } from '@/shared/api/device';
import { clearTokens, clearStoredUserName, clearStoredUserId } from '@/shared/lib/token';

/**
 * Markaziy logout — Header ham, Profil ham SHU funksiyani chaqiradi (ilgari ikki joyda
 * ikki xil edi: Header user_phone/user_name'ni tozalamas va /auth/logout'ni chaqirmasdi,
 * shu qurilmada keyingi hisobda eski ism "sizib" chiqishi mumkin edi).
 *
 * Tartib: server logout (xato bo'lsa ham davom) -> tokenlar + lokal ism/telefon tozalash ->
 * react-query keshi tozalash -> login'ga to'liq redirect (window.location — barcha in-memory
 * holat, WS ulanishlar toza boshlanishi uchun).
 */
export async function performLogout(queryClient: QueryClient, locale: string): Promise<void> {
  try {
    // Yangi backend: /auth/logout YO'Q. Sessiya DELETE /auth/sessions/{device_id} bilan yopiladi
    // (refresh token'ni serverda bekor qiladi). Fire-and-forget.
    const deviceId = typeof window !== 'undefined' ? getDeviceId() : '';
    if (deviceId) {
      await deleteSession(encodeURIComponent(deviceId));
    }
  } catch {
    // Server sessiyani yopa olmasa ham, client tomonda baribir tozalaymiz.
  }
  clearTokens();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user_phone');
  }
  clearStoredUserName();
  clearStoredUserId();
  queryClient.setQueryData(['profile'], null);
  queryClient.clear();
  if (typeof window !== 'undefined') {
    window.location.href = `/${locale}/login`;
  }
}
