import { useAppThemeOptional } from '@/contexts/app-theme-context';

/**
 * Aktivna tema aplikacije (korisnički izbor), ne sistemski color scheme.
 */
export function useColorScheme(): 'light' | 'dark' {
  const ctx = useAppThemeOptional();
  return ctx?.colorScheme ?? 'light';
}
