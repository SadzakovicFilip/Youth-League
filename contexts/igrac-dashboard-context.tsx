import type { IgracDashboardPayload } from '@/lib/igrac-dashboard-types';
import { supabase } from '@/lib/supabase';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type IgracDashboardContextValue = {
  loading: boolean;
  errorMessage: string;
  data: IgracDashboardPayload | null;
  reload: () => Promise<void>;
};

const emptyPayload: IgracDashboardPayload = {
  club_context: null,
  trainings: [],
  fees: [],
  stats: [],
  tactics: [],
  group_clubs: [],
  match_hub: null,
};

const IgracDashboardContext = createContext<IgracDashboardContextValue | null>(null);

export function IgracDashboardProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<IgracDashboardPayload | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage('Nema aktivne sesije. Uloguj se ponovo.');
      setData(emptyPayload);
      setLoading(false);
      return;
    }

    const { data: dash, error: dashErr } = await supabase.rpc('get_igrac_dashboard');
    if (dashErr) {
      setErrorMessage(dashErr.message);
      setData(emptyPayload);
      setLoading(false);
      return;
    }

    const payload = (dash ?? {}) as Partial<IgracDashboardPayload>;
    setData({
      club_context: payload.club_context ?? null,
      trainings: payload.trainings ?? [],
      fees: payload.fees ?? [],
      stats: payload.stats ?? [],
      tactics: payload.tactics ?? [],
      group_clubs: payload.group_clubs ?? [],
      match_hub: payload.match_hub ?? null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(
    () => ({ loading, errorMessage, data, reload }),
    [loading, errorMessage, data, reload],
  );

  return (
    <IgracDashboardContext.Provider value={value}>{children}</IgracDashboardContext.Provider>
  );
}

export function useIgracDashboard() {
  const ctx = useContext(IgracDashboardContext);
  if (!ctx) {
    throw new Error('useIgracDashboard mora biti unutar IgracDashboardProvider');
  }
  return ctx;
}
