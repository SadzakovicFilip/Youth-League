/** Lokalni početak kalendarskog dana (bez UTC pomaka za „koji dan“). */
export function startOfLocalDay(d: Date): Date {
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
