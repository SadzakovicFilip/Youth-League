/** Lokalni početak kalendarskog dana (bez UTC pomaka za „koji dan“). */export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function ymdKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function parseIsoToLocalDay(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return startOfLocalDay(t);
}

/** Da li je kalendarski dan termina prošao (lokalno vreme uređaja). */
export function isMatchScheduledDayPassed(
  scheduledAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const schedDay = parseIsoToLocalDay(scheduledAt);
  if (!schedDay) return false;
  return ymdKey(schedDay) < ymdKey(startOfLocalDay(now));
}

function isDbFinished(status?: string | null): boolean {
  return String(status ?? '').toLowerCase() === 'finished';
}

function displayStatusClosed(label?: string | null): boolean {
  const upper = String(label ?? '')
    .trim()
    .toUpperCase()
    .replace(/Č/g, 'C')
    .replace(/Š/g, 'S')
    .replace(/Ž/g, 'Z');
  return upper === 'ZAVRSENA' || upper === 'NEODIGRANA';
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return ymdKey(a) === ymdKey(b);
}

export function monthTitleSr(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat('sr-Latn', { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex, 1),
  );
}

/** Ponedeljak → nedelja (kratke oznake). */
export const WEEKDAY_LABELS_MON_FIRST = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'] as const;

/** Monday = 0 … Sunday = 6 */
export function mondayIndexFromSunday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export type TimetableMatchLike = {
  scheduled_at: string;
  status?: string | null;
  phase?: string | null;
  display_status?: string | null;
};

export function isTimetableMatchFinished(m: TimetableMatchLike): boolean {
  if (isDbFinished(m.status)) return true;
  if (displayStatusClosed(m.display_status)) return true;
  const ph = String(m.phase ?? '').toLowerCase();
  if (ph === 'played') return true;
  if (
    String(m.status ?? '').toLowerCase() === 'scheduled' &&
    isMatchScheduledDayPassed(m.scheduled_at)
  ) {
    return true;
  }
  return ph === 'past';
}

/**
 * Sort za listu ispod kalendara: nezavršene prvo, zatim po blizini trenutnom vremenu.
 */
export function sortTimetableDayMatches<T extends TimetableMatchLike>(matches: T[]): T[] {
  const nowMs = Date.now();
  return [...matches].sort((a, b) => {
    const aFin = isTimetableMatchFinished(a);
    const bFin = isTimetableMatchFinished(b);
    if (aFin !== bFin) return aFin ? 1 : -1;

    const aLive = String(a.status ?? '').toLowerCase() === 'live';
    const bLive = String(b.status ?? '').toLowerCase() === 'live';
    if (!aFin && !bFin && aLive !== bLive) return aLive ? -1 : 1;

    const diffA = Math.abs(new Date(a.scheduled_at).getTime() - nowMs);
    const diffB = Math.abs(new Date(b.scheduled_at).getTime() - nowMs);
    if (diffA !== diffB) return diffA - diffB;
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });
}
