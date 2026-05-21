/**
 * Prvi segment uloge iz URL-a (npr. `savez`, `delegat`), bez grupnih foldera `(roles)`.
 * Za javne rute (`login`, `home`, …) vraća `null`.
 */
export function getAppRoleFromPathname(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  const segments = p.split('/').filter((s) => s.length > 0);
  const cleaned = segments.filter((s) => !s.startsWith('('));
  const first = cleaned[0];
  if (!first) return null;
  const publicRoots = new Set(['login', 'modal', 'home', 'explore']);
  if (publicRoots.has(first)) return null;
  return first;
}

/**
 * @deprecated Koristi drawer (`AppDrawerProfilePanel`) umesto navigacije na profil.
 * Ostaje za slučaj dubokih linkova ako zatreba.
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
