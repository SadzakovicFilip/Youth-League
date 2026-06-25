import { ActionAccentHex } from '@/constants/theme';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { RefreshableScrollView } from '@/components/refreshable-scroll-view';
import { triggerPressInFeedback } from '@/lib/app-feedback';
import { MatchCalendarLegend } from '@/components/shared/match-calendar-legend';
import {
  MatchRichCard,
  formatScore,
  playedOutcomeLetter,
  type MatchRichTheme,
} from '@/components/shared/match-rich-card';
import { SearchableSelect, type SelectOption } from '@/components/shared/searchable-select';
import { MatchTimetableCalendar } from '@/components/shared/match-timetable-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { getMyClubContext } from '@/lib/club-context';
import {
  formatMatchDisplayStatus,
  isMatchDisplayFinished,
  isMatchDisplayLive,
} from '@/lib/match-display-status';
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
  display_status?: string | null;
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

function formatMatchTimeSr(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('sr-Latn', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function scorerLabel(s: ScorerRow): string {
  return (
    s.display_name?.trim() ||
    [s.first_name, s.last_name].filter(Boolean).join(' ').trim() ||
    (s.username ? `@${s.username}` : '') ||
    'Korisnik'
  );
}

export default function KlubUtakmiceScreen() {
  const { colors } = useAppTheme();
  const matchRichTheme = useMemo<MatchRichTheme>(
    () => ({
      surfaceMuted: colors.surfaceMuted,
      borderStrong: colors.borderStrong,
      tint: colors.tint,
      text: colors.text,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      danger: colors.danger,
    }),
    [colors],
  );

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
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

    if (!matchRpc.error && matchRpc.data) {
      const payload = matchRpc.data as MatchPayload;
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

      if (matchRpc.error) {
        const [hRes, aRes] = await Promise.all([
          supabase
            .from('matches')
            .select(
              'id, league_id, group_id, home_club_id, away_club_id, scheduled_at, venue, status, home_score, away_score',
            )
            .eq('home_club_id', clubCtx.clubId)
            .order('scheduled_at', { ascending: true }),
          supabase
            .from('matches')
            .select(
              'id, league_id, group_id, home_club_id, away_club_id, scheduled_at, venue, status, home_score, away_score',
            )
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
            })),
          );
        } else {
          setScorers([]);
        }
      }
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const scorerMap = useMemo(() => new Map(scorers.map((s) => [s.user_id, s])), [scorers]);

  const scorerOptions = useMemo<SelectOption[]>(
    () =>
      scorers.map((s) => ({
        value: s.user_id,
        label: scorerLabel(s),
      })),
    [scorers],
  );

  const tabMatches = activeTab === 'home' ? homeMatches : awayMatches;

  const assignScorer = async (matchId: number, userId: string) => {
    setAssigningMatchId(matchId);
    setErrorMessage('');

    const { error: rpcErr } = await supabase.rpc('set_home_match_scorer', {
      p_match_id: matchId,
      p_user_id: userId,
    });

    if (rpcErr) {
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
                [scorerMap.get(userId)?.first_name, scorerMap.get(userId)?.last_name]
                  .filter(Boolean)
                  .join(' ') ||
                null,
              scorer_username: scorerMap.get(userId)?.username ?? null,
            }
          : m,
      ),
    );
    setAssigningMatchId(null);
  };

  useScreenPullRefresh(loadData);

  const renderMatch = (m: MatchRow) => {
    const isHome = activeTab === 'home';
    const side = isHome ? ('home' as const) : ('away' as const);
    const opponentRaw = isHome ? m.away_club_name : m.home_club_name;
    const oppLabel = opponentRaw?.trim() ? opponentRaw.trim() : '—';
    const statusLabel = formatMatchDisplayStatus(m);
    const timeStr = formatMatchTimeSr(m.scheduled_at);
    const finishedLike = isMatchDisplayFinished(m);
    const matchHref = `/klub/utakmica/${m.id}` as never;

    if (!isHome) {
      return finishedLike ? (
        <MatchRichCard
          variant="club_played"
          theme={matchRichTheme}
          oppName={oppLabel}
          scheduledIso={m.scheduled_at}
          scoreLine={formatScore(m.home_score, m.away_score)}
          outcome={playedOutcomeLetter(side, m.home_score, m.away_score, null)}
          onPress={() => router.push(matchHref)}
          pressFeedback="swish"
        />
      ) : (
        <MatchRichCard
          variant="club_upcoming"
          theme={matchRichTheme}
          oppName={oppLabel}
          scheduledIso={m.scheduled_at}
          venue={m.venue}
          status={statusLabel}
          homeScore={m.home_score}
          awayScore={m.away_score}
          matchTime={timeStr}
          onPress={() => router.push(matchHref)}
          pressFeedback="swish"
        />
      );
    }

    const scorerName =
      m.scorer_display_name ||
      (m.scorer_username ? `@${m.scorer_username}` : null) ||
      (m.scorer_user_id ? scorerLabel(scorerMap.get(m.scorer_user_id)!) : null);

    const scorerFooter =
      finishedLike || isMatchDisplayLive(m) ? (
        <>
          <ThemedText style={[styles.footerLbl, { color: colors.textSecondary }]}>Zapisničar</ThemedText>
          <ThemedText style={{ color: colors.text }}>{scorerName ?? 'Nije dodeljen'}</ThemedText>
          {isMatchDisplayLive(m) ? (
            <ThemedText style={[styles.scorerHint, { color: colors.textSecondary }]}>
              Utakmica je uživo — zapisničar se ne menja.
            </ThemedText>
          ) : null}
        </>
      ) : (
        <>
          <SearchableSelect
            label="Zapisničar"
            placeholder={scorers.length === 0 ? 'Nema zapisničara u klubu' : 'Izaberi zapisničara'}
            sheetTitle="Zapisničar utakmice"
            value={m.scorer_user_id ?? null}
            options={scorerOptions}
            onChange={(uid) => {
              if (uid) void assignScorer(m.id, uid);
            }}
            clearable={false}
            containerStyle={styles.scorerSelect}
          />
          {assigningMatchId === m.id ? (
            <ActivityIndicator color={colors.tint} style={styles.scorerBusy} />
          ) : null}
        </>
      );

    return finishedLike ? (
      <MatchRichCard
        variant="club_played"
        theme={matchRichTheme}
        oppName={oppLabel}
        scheduledIso={m.scheduled_at}
        scoreLine={formatScore(m.home_score, m.away_score)}
        outcome={playedOutcomeLetter(side, m.home_score, m.away_score, null)}
        onPress={() => router.push(matchHref)}
        pressFeedback="swish"
        footer={scorerFooter}
      />
    ) : (
      <MatchRichCard
        variant="club_upcoming"
        theme={matchRichTheme}
        oppName={oppLabel}
        scheduledIso={m.scheduled_at}
        venue={m.venue}
        status={statusLabel}
        homeScore={m.home_score}
        awayScore={m.away_score}
        matchTime={timeStr}
        onPress={() => router.push(matchHref)}
        pressFeedback="swish"
        footer={scorerFooter}
      />
    );
  };

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.tabRow}>
        <Pressable
          onPressIn={() => triggerPressInFeedback('swish')}
          style={[
            styles.tabButton,
            { borderColor: colors.borderStrong },
            activeTab === 'home' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('home')}>
          <ThemedText style={activeTab === 'home' ? styles.tabButtonActiveText : undefined}>
            Domaćin ({homeMatches.length})
          </ThemedText>
        </Pressable>
        <Pressable
          onPressIn={() => triggerPressInFeedback('swish')}
          style={[
            styles.tabButton,
            { borderColor: colors.borderStrong },
            activeTab === 'away' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('away')}>
          <ThemedText style={activeTab === 'away' ? styles.tabButtonActiveText : undefined}>
            Gost ({awayMatches.length})
          </ThemedText>
        </Pressable>
      </ThemedView>

      {loading ? <ActivityIndicator color={colors.tint} /> : null}
      {errorMessage ? (
        <ThemedView style={[styles.errorCard, { borderColor: colors.borderStrong }]}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && activeTab === 'home' && homeMatches.length === 0 ? (
        <ThemedText style={{ color: colors.textSecondary }}>Nema domaćih utakmica.</ThemedText>
      ) : null}
      {!loading && activeTab === 'away' && awayMatches.length === 0 ? (
        <ThemedText style={{ color: colors.textSecondary }}>Nema gostujućih utakmica.</ThemedText>
      ) : null}

      {!loading && tabMatches.length > 0 ? (
        <>
          <ThemedText type="subtitle">Raspored utakmica</ThemedText>
          <MatchCalendarLegend />
          <MatchTimetableCalendar matches={tabMatches} renderMatch={renderMatch} daySelectSoundId="ballBounce2" />
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  tabRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tabButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabButtonActive: { backgroundColor: ActionAccentHex, borderColor: ActionAccentHex },
  tabButtonActiveText: { color: '#fff', fontWeight: '600' },
  footerLbl: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' },
  scorerSelect: { width: '100%' },
  scorerBusy: { alignSelf: 'flex-start' },
  scorerHint: { fontSize: 12, fontStyle: 'italic' },
  errorCard: { borderWidth: 1, borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
});
