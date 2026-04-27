import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type AppDrawerContextValue = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const AppDrawerContext = createContext<AppDrawerContextValue | null>(null);

export function AppDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openDrawer, closeDrawer, toggleDrawer }),
    [open, openDrawer, closeDrawer, toggleDrawer]
  );

  return <AppDrawerContext.Provider value={value}>{children}</AppDrawerContext.Provider>;
}

export function useAppDrawer() {
  const ctx = useContext(AppDrawerContext);
  if (!ctx) {
    throw new Error('useAppDrawer must be used within AppDrawerProvider');
  }
  return ctx;
}

export function useAppDrawerOptional() {
  return useContext(AppDrawerContext);
}
