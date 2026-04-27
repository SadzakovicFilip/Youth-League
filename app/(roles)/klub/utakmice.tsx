import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ClubContext, getMyClubContext, mapRpcClubContext } from '@/lib/club-context';
import { supabase } from '@/lib/supabase';

type MatchRow = {
  id: number;
  league_id: number;
  group_id: number | null;
  home_club_id: number;
  away_club_id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_club_name?: string | null;
  away_club_name?: string | null;
  scorer_user_id?: string | null;
  scorer_display_name?: string | null;
  scorer_username?: string | null;
};

type ScorerRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type MatchPayload = {
  context: {
    club_id: number;
    club_name: string;
    league_id: number | null;
    league_name: string | null;
    region_id: number | null;
    region_name: string | null;
    group_id: number | null;
    group_name: string | null;
  } | null;
  home: MatchRow[];
  away: MatchRow[];
};

export default function KlubUtakmiceScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [context, setContext] = useState<ClubContext | null>(null);
  const [homeMatches, setHomeMatches] = useState<MatchRow[]>([]);
  const [awayMatches, setAwayMatches] = useState<MatchRow[]>([]);
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'away'>('home');
  const [assigningMatchId, setAssigningMatchId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const [matchRpc, scorerRpc] = await Promise.all([
      supabase.rpc('get_klub_matches', { p_club_id: null }),
      supabase.rpc('get_klub_eligible_scorers', { p_club_id: null }),
    ]);

    let resolvedClubId: number | null = null;

    if (!matchRpc.error && matchRpc.data) {
      const payload = matchRpc.data as MatchPayload;
      const mappedCtx = mapRpcClubContext(payload.context);
      if (mappedCtx) {
        setContext(mappedCtx);
        resolvedClubId = mappedCtx.clubId;
      }
      setHomeMatches(payload.home ?? []);
      setAwayMatches(payload.away ?? []);
    }

    if (!scorerRpc.error && scorerRpc.data) {
      setScorers((scorerRpc.data ?? []) as ScorerRow[]);
    }

    if (matchRpc.error || scorerRpc.error) {
      const { data: clubCtx, error: ctxErr } = await getMyClubContext();
      if (ctxErr || !clubCtx) {
        setErrorMessage(ctxErr ?? 'Nije pronadjen klub kontekst.');
        setLoading(false);
        return;
      }
      setContext(clubCtx);
      resolvedClubId = clubCtx.clubId;

      if (matchRpc.error) {
        const [hRes, aRes] = await Promise.all([
          supabase
            .from('matches')
            .select('id, league_id, group_id, home_club_id, away_club_id, scheduled_at, venue, status, home_score, away_score')
            .eq('home_club_id', clubCtx.clubId)
            .order('scheduled_at', { ascending: true }),
          supabase
            .from('matches')
            .select('id, league_id, group_id, home_club_id, away_club_id, scheduled_at, venue, status, home_score, away_score')
            .eq('away_club_id', clubCtx.clubId)
            .order('scheduled_at', { ascending: true }),
        ]);

        if (hRes.error || aRes.error) {
          setErrorMessage(hRes.error?.message || aRes.error?.message || 'Greska pri ucitavanju utakmica.');
        } else {
          const homeRows = (hRes.data ?? []) as MatchRow[];
          const awayRows = (aRes.data ?? []) as MatchRow[];

          const matchIds = homeRows.map((m) => m.id);
          if (matchIds.length > 0) {
            const { data: officialRows } = await supabase
              .from('match_officials')
              .select('match_id, user_id')
              .eq('role', 'zapisnicar')
              .in('match_id', matchIds);
            const scorerMap = new Map((officialRows ?? []).map((row) => [row.match_id, row.user_id]));
            for (const m of homeRows) m.scorer_user_id = scorerMap.get(m.id) ?? null;
          }
          setHomeMatches(homeRows);
          setAwayMatches(awayRows);
        }
      }

      if (scorerRpc.error) {
        const { data: members } = await supabase
          .from('club_memberships')
          .select('user_id')
          .eq('club_id', clubCtx.clubId)
          .eq('active', true)
          .eq('member_role', 'zapisnicar');
        const ids = (members ?? []).map((m) => m.user_id);
        if (ids.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, display_name, first_name, last_name')
            .in('id', ids);
          setScorers(
            (profiles ?? []).map((p) => ({
              user_id: p.id,
              username: p.username,
              display_name: p.display_name,
              first_name: p.first_name,
              last_name: p.last_name,
            }))
          );
        } else {
          setScorers([]);
        }
      }
    }

    if (resolvedClubId == null) {
      const { data: clubCtx } = await getMyClubContext();
      if (clubCtx) setContext(clubCtx);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const scorerMap = useMemo(() => new Map(scorers.map((s) => [s.user_id, s])), [scorers]);

  const assignScorer = async (matchId: number, userId: string) => {
    setAssigningMatchId(matchId);
    setErrorMessage('');

    const { error: rpcErr } = await supabase.rpc('set_home_match_scorer', {
      p_match_id: matchId,
      p_user_id: userId,
    });

    if (rpcErr) {
      // fallback path if RPC is not deployed yet
      const { error: delErr } = await supabase
        .from('match_officials')
        .delete()
        .eq('match_id', matchId)
        .eq('role', 'zapisnicar');
      if (delErr) {
        setErrorMessage(delErr.message);
        setAssigningMatchId(null);
        return;
      }

      const { error: insErr } = await supabase
        .from('match_officials')
        .insert({ match_id: matchId, user_id: userId, role: 'zapisnicar' });
      if (insErr) {
        setErrorMessage(insErr.message);
        setAssigningMatchId(null);
        return;
      }
    }

    setHomeMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              scorer_user_id: userId,
              scorer_display_name:
                scorerMap.get(userId)?.display_name ||
                [scorerMap.get(userId)?.first_name, scorerMap.get(userId)?.last_name].filter(Boolean).join(' ') ||
                null,
              scorer_username: scorerMap.get(userId)?.username ?? null,
            }
          : m
      )
    );
    setAssigningMatchId(null);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Utakmice kluba</ThemedText>
      <ThemedText>
        Prikaz utakmica ovog kluba kroz dva taba: domacin i gost. Dodela zapisnicara je obavezna za domace utakmice.
      </ThemedText>
      <Pressable style={styles.secondaryButton} onPress={loadData}>
        <ThemedText style={styles.secondaryButtonText}>Refresh</ThemedText>
      </Pressable>

      {context ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">{context.clubName}</ThemedText>
          <ThemedText>Liga: {context.leagueName ?? '-'}</ThemedText>
          <ThemedText>Grupa: {context.groupName ?? '-'}</ThemedText>
        </ThemedView>
      ) : null}

      <ThemedView style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'home' && styles.tabButtonActive]}
          onPress={() => setActiveTab('home')}>
          <ThemedText style={activeTab === 'home' ? styles.tabButtonActiveText : undefined}>
            Domacin ({homeMatches.length})
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'away' && styles.tabButtonActive]}
          onPress={() => setActiveTab('away')}>
          <ThemedText style={activeTab === 'away' ? styles.tabButtonActiveText : undefined}>
            Gost ({awayMatches.length})
          </ThemedText>
        </Pressable>
      </ThemedView>

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && activeTab === 'home' && homeMatches.length === 0 ? (
        <ThemedText>Nema domacih utakmica.</ThemedText>
      ) : null}
      {!loading && activeTab === 'away' && awayMatches.length === 0 ? (
        <ThemedText>Nema gostujucih utakmica.</ThemedText>
      ) : null}

      {!loading && activeTab === 'home'
        ? homeMatches.map((m) => (
            <ThemedView key={m.id} style={styles.card}>
              <ThemedText type="defaultSemiBold">vs {m.away_club_name ?? `#${m.away_club_id}`}</ThemedText>
              <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
              <ThemedText>Mesto: {m.venue ?? '-'}</ThemedText>
              <ThemedText>
                Rezultat:{' '}
                {m.home_score != null && m.away_score != null
                  ? `${m.home_score}:${m.away_score}`
                  : 'nije upisano'}
              </ThemedText>
              <ThemedText>
                Zapisnicar:{' '}
                {m.scorer_display_name || (m.scorer_username ? `@${m.scorer_username}` : 'nije dodeljen')}
              </ThemedText>

              <ThemedText type="defaultSemiBold">Dodeli zapisnicara:</ThemedText>
              <ThemedView style={styles.chipRow}>
                {scorers.map((s) => {
                  const label =
                    s.display_name ||
                    [s.first_name, s.last_name].filter(Boolean).join(' ') ||
                    s.username ||
                    'Korisnik';
                  const isActive = m.scorer_user_id === s.user_id;
                  return (
                    <Pressable
                      key={`${m.id}-${s.user_id}`}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => assignScorer(m.id, s.user_id)}
                      disabled={assigningMatchId === m.id}>
                      <ThemedText style={isActive ? styles.chipActiveText : undefined}>{label}</ThemedText>
                    </Pressable>
                  );
                })}
              </ThemedView>
              {assigningMatchId === m.id ? <ActivityIndicator /> : null}
            </ThemedView>
          ))
        : null}

      {!loading && activeTab === 'away'
        ? awayMatches.map((m) => (
            <ThemedView key={m.id} style={styles.card}>
              <ThemedText type="defaultSemiBold">@ {m.home_club_name ?? `#${m.home_club_id}`}</ThemedText>
              <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
              <ThemedText>Mesto: {m.venue ?? '-'}</ThemedText>
              <ThemedText>
                Rezultat:{' '}
                {m.home_score != null && m.away_score != null
                  ? `${m.home_score}:${m.away_score}`
                  : 'nije upisano'}
              </ThemedText>
            </ThemedView>
          ))
        : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  tabRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tabButton: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabButtonActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  tabButtonActiveText: { color: '#fff', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  chipActiveText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryButtonText: { color: '#0a7ea4', fontWeight: '600' },
  errorText: { color: '#c53939' },
});
