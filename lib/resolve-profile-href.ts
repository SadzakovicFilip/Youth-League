/**
 * Href ka ekranu profila za ulogu iz trenutnog pathname-a (Expo Router).
 */
export function resolveProfileHrefFromPathname(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  const segments = p.split('/').filter((s) => s.length > 0);
  /** Grupе kao (roles), (tabs) ne ulaze u URL segment za ulogu. */
  const cleaned = segments.filter((s) => !s.startsWith('('));
  const role = cleaned[0];
  const tabRoles = ['trener', 'klub', 'savez'] as const;
  if (tabRoles.includes(role as (typeof tabRoles)[number])) {
    return `/${role}/profile`;
  }
  if (role === 'delegat') {
    return '/delegat/profil';
  }
  if (role === 'igrac') {
    return '/igrac';
  }
  if (role === 'sudija') {
    return '/sudija';
  }
  if (role === 'zapisnicar') {
    return '/zapisnicar';
  }
  if (role === 'admin') {
    return '/admin';
  }
  if (role === 'scout') {
    return '/scout';
  }
  if (role === 'spectator') {
    return '/spectator';
  }
  return null;
}
