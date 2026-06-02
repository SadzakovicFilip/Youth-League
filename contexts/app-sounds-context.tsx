import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'youth_league_app_sounds_enabled';

type AppSoundsContextValue = {
  soundsEnabled: boolean;
  setSoundsEnabled: (enabled: boolean) => void;
  toggleSounds: () => void;
  hydrated: boolean;
};

const AppSoundsContext = createContext<AppSoundsContextValue | null>(null);

export function AppSoundsProvider({ children }: { children: React.ReactNode }) {
  const [soundsEnabled, setSoundsEnabledState] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && stored != null) {
          setSoundsEnabledState(stored === '1');
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSoundsEnabled = useCallback(async (enabled: boolean) => {
    setSoundsEnabledState(enabled);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSounds = useCallback(() => {
    void setSoundsEnabled(!soundsEnabled);
  }, [setSoundsEnabled, soundsEnabled]);

  const value = useMemo<AppSoundsContextValue>(
    () => ({
      soundsEnabled,
      setSoundsEnabled,
      toggleSounds,
      hydrated,
    }),
    [soundsEnabled, setSoundsEnabled, toggleSounds, hydrated],
  );

  return <AppSoundsContext.Provider value={value}>{children}</AppSoundsContext.Provider>;
}

export function useAppSounds(): AppSoundsContextValue {
  const ctx = useContext(AppSoundsContext);
  if (!ctx) {
    throw new Error('useAppSounds must be used within AppSoundsProvider');
  }
  return ctx;
}

export function useAppSoundsOptional(): AppSoundsContextValue | null {
  return useContext(AppSoundsContext);
}
