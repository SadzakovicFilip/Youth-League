import { normPath } from '@/lib/chrome-left-mode';

function firstSegment(pathname: string): string | undefined {
  return normPath(pathname).split('/').filter(Boolean)[0];
}

const ROLES_WITH_MATCH_SCREEN = new Set([
  'klub',
  'delegat',
  'trener',
  'igrac',
  'sudija',
  'zapisnicar',
  'savez',
]);

/**
 * Href za ekran javnog detalja utakmice u skladu sa trenutnom ulogom (segment puta).
 */
export function matchDetailHrefFromPathname(pathname: string, matchId: number): string | null {
  if (!Number.isFinite(matchId) || matchId <= 0) return null;
  const role = firstSegment(pathname);
  if (!role || !ROLES_WITH_MATCH_SCREEN.has(role)) return null;
  return `/${role}/utakmica/${matchId}`;
}
