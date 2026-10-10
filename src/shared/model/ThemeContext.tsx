'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light';
type Style = 'classic' | 'neon';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Interfeys uslubi — Classic yoki Neon. Yorug'likдан mustaqil. */
  style: Style;
  setStyle: (style: Style) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => null,
  toggleTheme: () => null,
  style: 'classic',
  setStyle: () => null,
});

// Boshlang'ich tema: qo'lda saqlangan tanlov ustun; bo'lmasa — tizim afzalligi
// (prefers-color-scheme), ya'ni kechasi avtomatik dark. Foydalanuvchi qo'lda tanlagach
// localStorage'ga yoziladi va tizim o'zgarishlari kuzatilmaydi.
const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeClass = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
};

const getInitialStyle = (): Style => {
  if (typeof window === 'undefined') return 'classic';
  return localStorage.getItem('theme_style') === 'neon' ? 'neon' : 'classic';
};

// `html.neon` klassи — uslub. Yorug'lik klassi (light/dark) dan alohida.
const applyStyleClass = (style: Style) => {
  document.documentElement.classList.toggle('neon', style === 'neon');
};

export const ThemeProvider = ({
  children,
  defaultTheme = 'light',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [style, setStyleState] = useState<Style>('classic');
  const [mounted, setMounted] = useState(false);

  // Mount'da haqiqiy boshlang'ich temani aniqlaymiz (layout'dagi no-flash skript allaqachon
  // klassni qo'ygan — bu state'ni u bilan moslashtiradi).
  useEffect(() => {
    setThemeState(getInitialTheme());
    setStyleState(getInitialStyle());
    setMounted(true);
  }, []);

  // Tema o'zgarganda DOM klassini yangilaymiz. MUHIM: bu yerda localStorage'ga YOZMAYMIZ —
  // aks holda tizim-afzallik rejimidagi qiymat saqlanib, "tizimga ergashish" buzilardi.
  useEffect(() => {
    if (!mounted) return;
    applyThemeClass(theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    applyStyleClass(style);
  }, [style, mounted]);

  // Foydalanuvchi qo'lda tanlamagan bo'lsa — tizim temasi o'zgarishini kuzatamiz (auto dark/light).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('theme')) return; // qo'lda tanlangan — tegmaymiz
      setThemeState(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Qo'lda tanlash — localStorage'ga yoziladi (endi doimiy, tizimga ergashmaydi).
  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem('theme', next);
    setThemeState(next);
  }, []);

  const setStyle = useCallback((next: Style) => {
    localStorage.setItem('theme_style', next);
    setStyleState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme: theme, setTheme, toggleTheme, style, setStyle }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
