import { useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { BreadcrumbItem } from '@/components/savez/savez-breadcrumbs';

export type TakmicenjeDrillChromePayload = {
  title: string;
  items: BreadcrumbItem[];
};

type Ctx = {
  chrome: TakmicenjeDrillChromePayload | null;
  setChrome: (p: TakmicenjeDrillChromePayload | null) => void;
};

const TakmicenjeDrillChromeContext = createContext<Ctx | null>(null);

export function TakmicenjeDrillChromeProvider({ children }: { children: React.ReactNode }) {
  const [chrome, setChromeState] = useState<TakmicenjeDrillChromePayload | null>(null);
  const setChrome = useCallback((p: TakmicenjeDrillChromePayload | null) => {
    setChromeState(p);
  }, []);
  const value = useMemo(() => ({ chrome, setChrome }), [chrome, setChrome]);
  return (
    <TakmicenjeDrillChromeContext.Provider value={value}>{children}</TakmicenjeDrillChromeContext.Provider>
  );
}

export function useTakmicenjeDrillChrome(): Ctx | null {
  return useContext(TakmicenjeDrillChromeContext);
}

/**
 * Sinhronizuje naslov + breadcrumbs pri fokusu ekrana (`useFocusEffect` — pri Back-u se ponovo
 * postavlja ispravan sadržaj iako su zavisnosti iste dok je ekran u memoriji).
 * Bez `setChrome(null)` u blur cleanup-u (redosled bi mogao da obriše novi naslov posle fokusa).
 * Čišćenje kad se izađe iz drill putanje radi `TakmicenjeDrillChromeBar`.
 *
 * @param enabled npr. `syncDrillChrome` na deljenim view-ima — kada je false, ne dira kontekst.
 */
export function useSyncTakmicenjeDrillChrome(
  enabled: boolean,
  title: string,
  items: BreadcrumbItem[],
): void {
  const setChrome = useContext(TakmicenjeDrillChromeContext)?.setChrome;
  const trailKey = items.map((i) => `${i.label}\t${i.path ?? ''}`).join('\n');

  useFocusEffect(
    useCallback(() => {
      if (!setChrome || !enabled) {
        return;
      }
      setChrome({ title, items });
    }, [setChrome, enabled, title, trailKey]),
  );
}
