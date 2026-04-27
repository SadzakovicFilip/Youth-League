import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type AuthHeaderContextValue = {
  displayName: string;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthHeaderContext = createContext<AuthHeaderContextValue | null>(null);

function resolveDisplayLabel(
  profile: {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
  } | null,
  email: string | null | undefined
): string {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (profile?.username?.trim()) return profile.username.trim();
  if (email?.includes('@')) return email.split('@')[0] ?? 'Korisnik';
  if (email?.trim()) return email.trim();
  return 'Korisnik';
}

export function AuthHeaderProvider({ children }: { children: ReactNode }) {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setDisplayName('');
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, first_name, last_name, username')
      .eq('id', user.id)
      .maybeSingle();
    setDisplayName(resolveDisplayLabel(profile, user.email));
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ displayName, loading, refresh }),
    [displayName, loading, refresh]
  );

  return <AuthHeaderContext.Provider value={value}>{children}</AuthHeaderContext.Provider>;
}

export function useAuthHeader() {
  const ctx = useContext(AuthHeaderContext);
  if (!ctx) {
    throw new Error('useAuthHeader must be used within AuthHeaderProvider');
  }
  return ctx;
}

export function useAuthHeaderOptional() {
  return useContext(AuthHeaderContext);
}
