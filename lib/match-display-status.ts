/** Prikazni status utakmice (ne menja DB enum scheduled/live/finished). */

import { isMatchScheduledDayPassed } from '@/lib/match-calendar-utils';

export type MatchDisplayStatusKey =
  | 'zakazana'
  | 'iscekivanje'
  | 'nema_uslova'
  | 'neodigrana'
  | 'uzivo'
  | 'zavrsena';

export const MATCH_DISPLAY_STATUS_LABEL: Record<MatchDisplayStatusKey, string> = {
  zakazana: 'ZAKAZANA',
  iscekivanje: 'ISČEKIVANJE',
  nema_uslova: 'NEMA USLOVA',
  neodigrana: 'NEODIGRANA',
  uzivo: 'UŽIVO',
  zavrsena: 'ZAVRŠENA',
};

const API_LABEL_TO_KEY: Record<string, MatchDisplayStatusKey> = {
  ZAKAZANA: 'zakazana',
  ISCEKIVANJE: 'iscekivanje',
  ISCEKANJE: 'iscekivanje',
  'NEMA USLOVA': 'nema_uslova',
  NEODIGRANA: 'neodigrana',
  UZIVO: 'uzivo',
  ZAVRSENA: 'zavrsena',
};

export type MatchStartConditions = {
  cond_rosters?: boolean | null;
  cond_sudije?: boolean | null;
  cond_zapisnicar?: boolean | null;
  start_ready?: boolean | null;
};

export type MatchForDisplayStatus = MatchStartConditions & {
  status?: string | null;
  scheduled_at?: string | null;
  scheduledAt?: string | null;
  display_status?: string | null;
  conditions?: MatchStartConditions | null;
};

function normalizeApiLabel(label: string): MatchDisplayStatusKey | null {
  const upper = label
    .trim()
    .toUpperCase()
    .replace(/Č/g, 'C')
    .replace(/Š/g, 'S')
    .replace(/Ž/g, 'Z')
    .replace(/Đ/g, 'DJ');
  return API_LABEL_TO_KEY[upper] ?? null;
}

/** Da li je kalendarski dan termina prošao (lokalno vreme uređaja). */
export { isMatchScheduledDayPassed } from '@/lib/match-calendar-utils';

/** Da li su ispunjeni uslovi za POČNI UTAKMICU (bez cond_time). */
export function isMatchStartReady(input: MatchForDisplayStatus): boolean | null {
  if (input.start_ready != null) return Boolean(input.start_ready);
  const c = input.conditions ?? input;
  if (
    c.cond_rosters == null ||
    c.cond_sudije == null ||
    c.cond_zapisnicar == null
  ) {
    return null;
  }
  return Boolean(c.cond_rosters && c.cond_sudije && c.cond_zapisnicar);
}

export function resolveMatchDisplayStatusKey(
  input: MatchForDisplayStatus,
  now: Date = new Date(),
): MatchDisplayStatusKey {
  const fromApi = input.display_status?.trim();
  if (fromApi) {
    const mapped = normalizeApiLabel(fromApi);
    if (mapped) return mapped;
  }

  const st = String(input.status ?? 'scheduled').toLowerCase();
  if (st === 'finished') return 'zavrsena';
  if (st === 'live') return 'uzivo';

  const scheduledRaw = input.scheduled_at ?? input.scheduledAt;
  const scheduled = scheduledRaw ? new Date(scheduledRaw) : null;
  if (scheduled && !Number.isNaN(scheduled.getTime()) && scheduled.getTime() > now.getTime()) {
    return 'zakazana';
  }

  if (isMatchScheduledDayPassed(scheduledRaw, now)) {
    return 'neodigrana';
  }

  const ready = isMatchStartReady(input);
  if (ready === true) return 'iscekivanje';
  return 'nema_uslova';
}

export function formatMatchDisplayStatus(
  input: MatchForDisplayStatus,
  now?: Date,
): string {
  if (input.display_status?.trim()) {
    const mapped = normalizeApiLabel(input.display_status);
    if (mapped) return MATCH_DISPLAY_STATUS_LABEL[mapped];
    return input.display_status.trim();
  }
  return MATCH_DISPLAY_STATUS_LABEL[resolveMatchDisplayStatusKey(input, now)];
}

export function boxScoreBadgeLabel(input: MatchForDisplayStatus, now?: Date): string {
  return `${formatMatchDisplayStatus(input, now)} · BOX SCORE`;
}

export function isMatchDisplayFinished(input: MatchForDisplayStatus, now?: Date): boolean {
  return resolveMatchDisplayStatusKey(input, now) === 'zavrsena';
}

export function isMatchDisplayNeodigrana(input: MatchForDisplayStatus, now?: Date): boolean {
  return resolveMatchDisplayStatusKey(input, now) === 'neodigrana';
}

export function isMatchDisplayLive(input: MatchForDisplayStatus, now?: Date): boolean {
  return resolveMatchDisplayStatusKey(input, now) === 'uzivo';
}

export function isMatchDisplayClosed(input: MatchForDisplayStatus, now?: Date): boolean {
  const key = resolveMatchDisplayStatusKey(input, now);
  return key === 'zavrsena' || key === 'neodigrana';
}

export function isMatchDbFinished(status?: string | null): boolean {
  return String(status ?? '').toLowerCase() === 'finished';
}
