import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Colors } from '@/constants/theme';

const STORAGE_KEY = 'youth_league_app_theme';

export type AppColorScheme = 'light' | 'dark';

export type AppThemeColors = (typeof Colors)['light'];

type AppThemeContextValue = {
  colorScheme: AppColorScheme;
  setColorScheme: (scheme: AppColorScheme) => void;
  toggleTheme: () => void;
  colors: AppThemeColors;
  hydrated: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<AppColorScheme>('light');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (stored === 'dark' || stored === 'light')) {
          setColorSchemeState(stored);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setColorScheme = useCallback(async (scheme: AppColorScheme) => {
    setColorSchemeState(scheme);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, scheme);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    void setColorScheme(colorScheme === 'light' ? 'dark' : 'light');
  }, [colorScheme, setColorScheme]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      colorScheme,
      setColorScheme,
      toggleTheme,
      colors: Colors[colorScheme] as AppThemeColors,
      hydrated,
    }),
    [colorScheme, setColorScheme, toggleTheme, hydrated]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}

/** Za komponente koje mogu da budu van providera (retko) — podrazumevano light */
export function useAppThemeOptional(): AppThemeContextValue | null {
  return useContext(AppThemeContext);
}
