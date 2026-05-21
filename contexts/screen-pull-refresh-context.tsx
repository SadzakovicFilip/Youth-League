import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';

export type ScreenRefreshHandler = () => void | Promise<void>;

type Ctx = {
  handlerRef: MutableRefObject<ScreenRefreshHandler | null>;
  register: (fn: ScreenRefreshHandler | null) => void;
};

const ScreenPullRefreshContext = createContext<Ctx | null>(null);

export function ScreenPullRefreshProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<ScreenRefreshHandler | null>(null);

  const register = useCallback((fn: ScreenRefreshHandler | null) => {
    handlerRef.current = fn;
  }, []);

  const value = useMemo(() => ({ handlerRef, register }), [register]);

  return <ScreenPullRefreshContext.Provider value={value}>{children}</ScreenPullRefreshContext.Provider>;
}

export function useScreenPullRefresh(loader: ScreenRefreshHandler) {
  const ctx = useContext(ScreenPullRefreshContext);
  if (!ctx) {
    throw new Error('useScreenPullRefresh requires ScreenPullRefreshProvider');
  }
  const { register } = ctx;

  useFocusEffect(
    useCallback(() => {
      register(loader);
      return () => register(null);
    }, [loader, register]),
  );
}

export function useScreenPullRefreshContext() {
  const ctx = useContext(ScreenPullRefreshContext);
  if (!ctx) {
    throw new Error('useScreenPullRefreshContext requires ScreenPullRefreshProvider');
  }
  return ctx;
}
