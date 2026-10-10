import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Eslatma: tema (light/dark) BU store'da EMAS — u ThemeContext'da boshqariladi
// (tizim afzalligi + qo'lda tanlash). Bu yerda faqat rol/menyu holati.
interface UIState {
  activeRole: 'passenger' | 'driver';
  isMenuOpen: boolean;
  setActiveRole: (role: 'passenger' | 'driver') => void;
  setMenuOpen: (isOpen: boolean) => void;
  toggleMenu: () => void;
}

/**
 * Rolni cookie'ga ham yozamiz — `proxy.ts` (server) uchun.
 *
 * NEGA: kirgan foydalanuvchi PWA'ni ochganda `/login` ga tushadi va faqat JS
 * yuklangach o'z paneliga o'tadi (ortiqcha redirect + butun bir sahifa SSR'i).
 * Buni serverda kesish uchun proxy `access_token` cookie'sini ko'radi, lekin
 * QAYSI panelga yuborishni bilishi kerak — rol esa localStorage'da (zustand),
 * serverga ko'rinmaydi. Shu bitta qiymat cookie'ga dublikat qilinadi.
 *
 * Maxfiy ma'lumot emas (faqat 'driver'/'passenger'), shuning uchun HttpOnly emas.
 */
export const ROLE_COOKIE = 'yy_role';

const writeRoleCookie = (role: 'passenger' | 'driver'): void => {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=2592000; SameSite=Lax${secure}`;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeRole: 'passenger', // Passenger by default
      isMenuOpen: false,
      setActiveRole: (activeRole) => {
        writeRoleCookie(activeRole);
        set({ activeRole });
      },
      setMenuOpen: (isMenuOpen) => set({ isMenuOpen }),
      toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
    }),
    {
      name: 'ui-storage', // name of the item in the storage (must be unique)
      partialize: (state) => ({ activeRole: state.activeRole }), // only save this
      // Mavjud foydalanuvchilarda cookie hali yo'q (rol allaqachon tanlangan va
      // `setActiveRole` boshqa chaqirilmasligi mumkin) — tiklanishda bir marta yozamiz.
      onRehydrateStorage: () => (state) => {
        if (state) writeRoleCookie(state.activeRole);
      },
    }
  )
);
