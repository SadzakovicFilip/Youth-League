import type {
  MatchScorebookPayload,
  MatchScorebookRosterPlayer,
} from '@/components/match-scorebook-types';

export function totalTeamPointsFromRoster(r: MatchScorebookRosterPlayer[]) {
  return r.reduce((s, p) => s + (p.total_points ?? 0), 0);
}

/** Uživo: zbir poena iz događaja (roster) je izvor istine — usklađuje match.home/away_score. */
export function normalizeLiveScorebookPayload(
  payload: MatchScorebookPayload,
): MatchScorebookPayload {
  if (String(payload.match.status ?? '').toLowerCase() !== 'live') {
    return payload;
  }
  const home = totalTeamPointsFromRoster(payload.home_roster);
  const away = totalTeamPointsFromRoster(payload.away_roster);
  return {
    ...payload,
    match: {
      ...payload.match,
      home_score: home,
      away_score: away,
    },
  };
}
