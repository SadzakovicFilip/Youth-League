import type { MatchScorebookRosterPlayer } from '@/components/match-scorebook-types';

export type MatchScoreFlashEventType = 'free_throw' | 'field' | 'three' | 'foul';

export type MatchScoreFlashPayload = {
  userId: string;
  eventType: MatchScoreFlashEventType;
  label: string;
  /** Jedinstven ključ za remount animacije (isti igrač + isti tip). */
  key: string;
};

export function eventTypePointsLabel(eventType: string): string {
  switch (eventType) {
    case 'free_throw':
      return '+1';
    case 'field':
      return '+2';
    case 'three':
      return '+3';
    case 'foul':
      return 'FOUL';
    default:
      return '';
  }
}

function shortPlayerName(
  p: Pick<
    MatchScorebookRosterPlayer,
    'display_name' | 'first_name' | 'last_name' | 'username'
  > | undefined,
): string {
  if (!p) return '?';
  const raw =
    p.display_name?.trim() ||
    p.first_name?.trim() ||
    p.last_name?.trim() ||
    p.username?.trim() ||
    '?';
  const token = raw.split(/\s+/)[0] ?? raw;
  return token.toUpperCase().slice(0, 12);
}

export function findRosterPlayer(
  home: MatchScorebookRosterPlayer[],
  away: MatchScorebookRosterPlayer[],
  userId: string,
): MatchScorebookRosterPlayer | undefined {
  return home.find((p) => p.user_id === userId) ?? away.find((p) => p.user_id === userId);
}

export function buildScoreFlashLabel(
  player: MatchScorebookRosterPlayer | undefined,
  eventType: string,
): string {
  const jersey = player?.jersey_number ?? '?';
  const name = shortPlayerName(player);
  const pts = eventTypePointsLabel(eventType);
  return `#${jersey} ${name} : ${pts}`;
}

export function buildScoreFlashPayload(
  home: MatchScorebookRosterPlayer[],
  away: MatchScorebookRosterPlayer[],
  userId: string,
  eventType: MatchScoreFlashEventType,
  key?: string,
): MatchScoreFlashPayload {
  const player = findRosterPlayer(home, away, userId);
  return {
    userId,
    eventType,
    label: buildScoreFlashLabel(player, eventType),
    key: key ?? `local-${Date.now()}-${userId}-${eventType}`,
  };
}
