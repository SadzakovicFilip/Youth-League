import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type GroupLite = { id: number; name: string };
type LeagueInfo = { id: number; name: string; region_id: number | null; region_name: string | null };

type StandingsRow = {
  club_id: number;
  club_name: string;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  points_scored: number;
  points_allowed: number;
  point_diff: number;
  table_points: number;
};

type ScorerRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  club_id: number | null;
  club_name: string | null;
  games: number;
  total_points: number;
  avg_points: number;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
};

type StandingsPayload = {
  group: { id: number; name: string; league_id: number; league_name: string };
  clubs: { club_id: number; club_name: string }[];
  standings: StandingsRow[];
};

type ScorersPayload = {
  league_id: number;
  league_name: string | null;
  group_id: number | null;
  top_scorers: ScorerRow[];
};

type OverviewPayload = {
  league: LeagueInfo;
  groups: GroupLite[];
};

export type LeagueCompetitionViewProps = {
  leagueId: number;
  onOpenPlayer?: (userId: string) => void;
  onOpenClub?: (clubId: number) => void;
  /** If set, only this group is shown (no group tabs, no league-wide scorers). */
  singleGroupId?: number;
  hideTitle?: boolean;
};

function playerName(p: Pick<ScorerRow, 'display_name' | 'first_name' | 'last_name' | 'username'>) {
  return (
    p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
  );
}

export function LeagueCompetitionView({
  leagueId,
  onOpenPlayer,
  onOpenClub,
  singleGroupId,
  hideTitle,
}: LeagueCompetitionViewProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(singleGroupId ?? null);
  const [standings, setStandings] = useState<StandingsPayload | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [leagueScorers, setLeagueScorers] = useState<ScorersPayload | null>(null);
  const [groupScorers, setGroupScorers] = useState<ScorersPayload | null>(null);
  const [scorersLoading, setScorersLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!Number.isFinite(leagueId)) {
      setErrorMessage('Neispravan ID lige');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const ovRes = await supabase.rpc('get_league_overview', { p_league_id: leagueId });
    if (ovRes.error) {
      setErrorMessage(ovRes.error.message);
      setLoading(false);
      return;
    }
    const ov = (ovRes.data ?? null) as OverviewPayload | null;
    setOverview(ov);
    if (!singleGroupId) {
      const lsRes = await supabase.rpc('get_league_top_scorers', {
        p_league_id: leagueId,
        p_group_id: null,
        p_limit: 100,
      });
      if (lsRes.error) {
        setLeagueScorers(null);
      } else {
        setLeagueScorers((lsRes.data ?? null) as ScorersPayload | null);
      }
    }
    const firstGroup = singleGroupId ?? ov?.groups?.[0]?.id ?? null;
    setSelectedGroupId((prev) => prev ?? firstGroup);
    setLoading(false);
  }, [leagueId, singleGroupId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadGroup = useCallback(
    async (groupId: number) => {
      setStandingsLoading(true);
      setScorersLoading(true);
      const [stRes, scRes] = await Promise.all([
        supabase.rpc('get_group_standings', { p_group_id: groupId }),
        supabase.rpc('get_league_top_scorers', {
          p_league_id: leagueId,
          p_group_id: groupId,
          p_limit: 100,
        }),
      ]);
      if (stRes.error) {
        setErrorMessage(stRes.error.message);
        setStandings(null);
      } else {
        setStandings((stRes.data ?? null) as StandingsPayload | null);
      }
      if (scRes.error) {
        setGroupScorers(null);
      } else {
        setGroupScorers((scRes.data ?? null) as ScorersPayload | null);
      }
      setStandingsLoading(false);
      setScorersLoading(false);
    },
    [leagueId]
  );

  useEffect(() => {
    if (selectedGroupId != null) {
      loadGroup(selectedGroupId);
    }
  }, [selectedGroupId, loadGroup]);

  const groups = overview?.groups ?? [];
  const leagueName = overview?.league?.name ?? '';

  const groupStandings = standings?.standings ?? [];
  const groupScorerList = groupScorers?.top_scorers ?? [];
  const leagueScorerList = leagueScorers?.top_scorers ?? [];

  return (
    <View style={styles.container}>
      {!hideTitle ? (
        <ThemedText type="title">
          {singleGroupId ? 'Takmicenje' : `Takmicenje — ${leagueName || `Liga #${leagueId}`}`}
        </ThemedText>
      ) : null}

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !singleGroupId && groups.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema grupa u ligi.</ThemedText>
        </ThemedView>
      ) : null}

      {!singleGroupId && groups.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {groups.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => setSelectedGroupId(g.id)}
              style={[styles.tab, selectedGroupId === g.id && styles.tabActive]}>
              <ThemedText style={selectedGroupId === g.id ? styles.tabActiveText : undefined}>
                {g.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {selectedGroupId != null ? (
        <>
          <ThemedText type="subtitle">Tabela</ThemedText>
          {standingsLoading ? <ActivityIndicator /> : null}
          {!standingsLoading && groupStandings.length === 0 ? (
            <ThemedView style={styles.card}>
              <ThemedText>Nema odigranih utakmica u grupi.</ThemedText>
            </ThemedView>
          ) : null}
          {groupStandings.length > 0 ? (
            <ThemedView style={styles.tableCard}>
              <View style={[styles.tRow, styles.tHead]}>
                <ThemedText style={[styles.tCell, styles.tRank]}>#</ThemedText>
                <ThemedText style={[styles.tCell, styles.tClub]}>Klub</ThemedText>
                <ThemedText style={[styles.tCell, styles.tNum]}>OU</ThemedText>
                <ThemedText style={[styles.tCell, styles.tNum]}>P</ThemedText>
                <ThemedText style={[styles.tCell, styles.tNum]}>Iz</ThemedText>
                <ThemedText style={[styles.tCell, styles.tNum]}>Pos</ThemedText>
                <ThemedText style={[styles.tCell, styles.tNum]}>Pri</ThemedText>
                <ThemedText style={[styles.tCell, styles.tNum]}>+/-</ThemedText>
                <ThemedText style={[styles.tCell, styles.tPts]}>Pts</ThemedText>
              </View>
              {groupStandings.map((row, idx) => (
                <Pressable
                  key={row.club_id}
                  style={styles.tRow}
                  disabled={!onOpenClub}
                  onPress={() => onOpenClub?.(row.club_id)}>
                  <ThemedText style={[styles.tCell, styles.tRank]}>{idx + 1}</ThemedText>
                  <ThemedText style={[styles.tCell, styles.tClub]} numberOfLines={1}>
                    {row.club_name}
                  </ThemedText>
                  <ThemedText style={[styles.tCell, styles.tNum]}>{row.games_played}</ThemedText>
                  <ThemedText style={[styles.tCell, styles.tNum]}>{row.wins}</ThemedText>
                  <ThemedText style={[styles.tCell, styles.tNum]}>{row.losses}</ThemedText>
                  <ThemedText style={[styles.tCell, styles.tNum]}>{row.points_scored}</ThemedText>
                  <ThemedText style={[styles.tCell, styles.tNum]}>{row.points_allowed}</ThemedText>
                  <ThemedText style={[styles.tCell, styles.tNum]}>
                    {row.point_diff > 0 ? `+${row.point_diff}` : row.point_diff}
                  </ThemedText>
                  <ThemedText style={[styles.tCell, styles.tPts]}>{row.table_points}</ThemedText>
                </Pressable>
              ))}
              <ThemedText style={styles.tableFoot}>
                P=Pobede · Iz=Porazi · Pos=Postignuto · Pri=Primljeno · +/-=Kos razlika · Pts=Bodovi (W=2, L=1)
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedText type="subtitle">Strelci grupe</ThemedText>
          {scorersLoading ? <ActivityIndicator /> : null}
          {!scorersLoading && groupScorerList.length === 0 ? (
            <ThemedView style={styles.card}>
              <ThemedText>Jos uvek nema zabelezenih poena u grupi.</ThemedText>
            </ThemedView>
          ) : null}
          <ScorerList rows={groupScorerList} onOpenPlayer={onOpenPlayer} />
        </>
      ) : null}

      {!singleGroupId ? (
        <>
          <ThemedText type="subtitle">Strelci lige (sve grupe)</ThemedText>
          {leagueScorerList.length === 0 ? (
            <ThemedView style={styles.card}>
              <ThemedText>Jos uvek nema zabelezenih poena u ligi.</ThemedText>
            </ThemedView>
          ) : (
            <ScorerList rows={leagueScorerList} onOpenPlayer={onOpenPlayer} />
          )}
        </>
      ) : null}
    </View>
  );
}

function ScorerList({
  rows,
  onOpenPlayer,
}: {
  rows: ScorerRow[];
  onOpenPlayer?: (userId: string) => void;
}) {
  const top = useMemo(() => rows.slice(0, 100), [rows]);
  if (top.length === 0) return null;
  return (
    <ThemedView style={styles.tableCard}>
      <View style={[styles.tRow, styles.tHead]}>
        <ThemedText style={[styles.tCell, styles.tRank]}>#</ThemedText>
        <ThemedText style={[styles.tCell, styles.tPlayer]}>Igrac</ThemedText>
        <ThemedText style={[styles.tCell, styles.tNum]}>M</ThemedText>
        <ThemedText style={[styles.tCell, styles.tNum]}>Pts</ThemedText>
        <ThemedText style={[styles.tCell, styles.tNum]}>Pro</ThemedText>
      </View>
      {top.map((r, idx) => (
        <Pressable
          key={r.user_id}
          style={styles.tRow}
          disabled={!onOpenPlayer}
          onPress={() => onOpenPlayer?.(r.user_id)}>
          <ThemedText style={[styles.tCell, styles.tRank]}>{idx + 1}</ThemedText>
          <View style={styles.tPlayerCol}>
            <ThemedText numberOfLines={1}>{playerName(r)}</ThemedText>
            {r.club_name ? (
              <ThemedText style={styles.scorerClub} numberOfLines={1}>
                {r.club_name}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText style={[styles.tCell, styles.tNum]}>{r.games}</ThemedText>
          <ThemedText style={[styles.tCell, styles.tNum]}>{r.total_points}</ThemedText>
          <ThemedText style={[styles.tCell, styles.tNum]}>{r.avg_points}</ThemedText>
        </Pressable>
      ))}
      <ThemedText style={styles.tableFoot}>M=Odigrano · Pts=Poeni · Pro=Prosek</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 4 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  tabs: { gap: 6, paddingVertical: 2 },
  tab: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tabActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  tabActiveText: { color: '#fff', fontWeight: '600' },
  tableCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    gap: 4,
  },
  tHead: {
    backgroundColor: '#f3f3f3',
    borderTopWidth: 0,
  },
  tCell: { fontSize: 12 },
  tRank: { width: 24, textAlign: 'center', fontWeight: '700' },
  tClub: { flex: 1, minWidth: 0, fontWeight: '600' },
  tPlayer: { flex: 1, minWidth: 0 },
  tPlayerCol: { flex: 1, minWidth: 0 },
  tNum: { width: 34, textAlign: 'center' },
  tPts: { width: 36, textAlign: 'center', fontWeight: '800' },
  tableFoot: { fontSize: 10, color: '#888', padding: 6 },
  scorerClub: { fontSize: 10, color: '#666' },
});
