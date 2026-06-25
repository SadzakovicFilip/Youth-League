import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { bindAppFeedbackPrefs, preloadAppFeedbackSounds } from '@/lib/app-feedback';

const SOUNDS_STORAGE_KEY = 'youth_league_app_sounds_enabled';
const VIBRATION_STORAGE_KEY = 'youth_league_app_vibration_enabled';

type AppFeedbackContextValue = {
  soundsEnabled: boolean;
  vibrationEnabled: boolean;
  setSoundsEnabled: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  toggleSounds: () => void;
  toggleVibration: () => void;
  hydrated: boolean;
  isMatchFeedbackMuted: (matchId: number) => boolean;
  setMatchFeedbackMuted: (matchId: number, muted: boolean) => void;
  toggleMatchFeedbackMuted: (matchId: number) => void;
};

const AppFeedbackContext = createContext<AppFeedbackContextValue | null>(null);

export function AppSoundsProvider({ children }: { children: React.ReactNode }) {
  const [soundsEnabled, setSoundsEnabledState] = useState(true);
  const [vibrationEnabled, setVibrationEnabledState] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [mutedMatchIds, setMutedMatchIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedSounds, storedVibration] = await Promise.all([
          AsyncStorage.getItem(SOUNDS_STORAGE_KEY),
          AsyncStorage.getItem(VIBRATION_STORAGE_KEY),
        ]);
        if (!cancelled) {
          if (storedSounds != null) setSoundsEnabledState(storedSounds === '1');
          if (storedVibration != null) setVibrationEnabledState(storedVibration === '1');
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void preloadAppFeedbackSounds();
  }, []);

  const isMatchFeedbackMuted = useCallback(
    (matchId: number) => mutedMatchIds.has(matchId),
    [mutedMatchIds],
  );

  const setMatchFeedbackMuted = useCallback((matchId: number, muted: boolean) => {
    setMutedMatchIds((prev) => {
      const next = new Set(prev);
      if (muted) next.add(matchId);
      else next.delete(matchId);
      return next;
    });
  }, []);

  const toggleMatchFeedbackMuted = useCallback((matchId: number) => {
    setMutedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  }, []);

  const mutedRef = useRef(mutedMatchIds);
  mutedRef.current = mutedMatchIds;

  useEffect(() => {
    bindAppFeedbackPrefs({
      soundsEnabled,
      vibrationEnabled,
      isMatchMuted: (matchId) => mutedRef.current.has(matchId),
    });
  }, [soundsEnabled, vibrationEnabled, mutedMatchIds]);

  const setSoundsEnabled = useCallback(async (enabled: boolean) => {
    setSoundsEnabledState(enabled);
    try {
      await AsyncStorage.setItem(SOUNDS_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const setVibrationEnabled = useCallback(async (enabled: boolean) => {
    setVibrationEnabledState(enabled);
    try {
      await AsyncStorage.setItem(VIBRATION_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSounds = useCallback(() => {
    void setSoundsEnabled(!soundsEnabled);
  }, [setSoundsEnabled, soundsEnabled]);

  const toggleVibration = useCallback(() => {
    void setVibrationEnabled(!vibrationEnabled);
  }, [setVibrationEnabled, vibrationEnabled]);

  const value = useMemo<AppFeedbackContextValue>(
    () => ({
      soundsEnabled,
      vibrationEnabled,
      setSoundsEnabled,
      setVibrationEnabled,
      toggleSounds,
      toggleVibration,
      hydrated,
      isMatchFeedbackMuted,
      setMatchFeedbackMuted,
      toggleMatchFeedbackMuted,
    }),
    [
      soundsEnabled,
      vibrationEnabled,
      setSoundsEnabled,
      setVibrationEnabled,
      toggleSounds,
      toggleVibration,
      hydrated,
      isMatchFeedbackMuted,
      setMatchFeedbackMuted,
      toggleMatchFeedbackMuted,
    ],
  );

  return <AppFeedbackContext.Provider value={value}>{children}</AppFeedbackContext.Provider>;
}

export function useAppFeedback(): AppFeedbackContextValue {
  const ctx = useContext(AppFeedbackContext);
  if (!ctx) {
    throw new Error('useAppFeedback must be used within AppSoundsProvider');
  }
  return ctx;
}

export function useAppFeedbackOptional(): AppFeedbackContextValue | null {
  return useContext(AppFeedbackContext);
}

/** @deprecated Koristi useAppFeedback */
export function useAppSounds(): Pick<
  AppFeedbackContextValue,
  'soundsEnabled' | 'setSoundsEnabled' | 'toggleSounds' | 'hydrated'
> {
  const ctx = useAppFeedback();
  return {
    soundsEnabled: ctx.soundsEnabled,
    setSoundsEnabled: ctx.setSoundsEnabled,
    toggleSounds: ctx.toggleSounds,
    hydrated: ctx.hydrated,
  };
}

export function useAppSoundsOptional(): ReturnType<typeof useAppSounds> | null {
  const ctx = useAppFeedbackOptional();
  if (!ctx) return null;
  return {
    soundsEnabled: ctx.soundsEnabled,
    setSoundsEnabled: ctx.setSoundsEnabled,
    toggleSounds: ctx.toggleSounds,
    hydrated: ctx.hydrated,
  };
}
