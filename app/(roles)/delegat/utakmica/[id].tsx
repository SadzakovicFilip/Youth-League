import { ActionAccentHex } from '@/constants/theme';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { MatchScorebookDetailView } from '@/components/match-scorebook-detail-view';
import { DelegatMatchObjectionBoxScorePanel } from '@/components/delegat/delegat-match-objection-box-score-panel';
import {
  MatchRichCard,
  type MatchRichTheme,
} from '@/components/shared/match-rich-card';
import { SearchableSelect, SelectOption } from '@/components/shared/searchable-select';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { triggerAppFeedback } from '@/lib/app-feedback';
import { formatMatchDisplayStatus, isMatchDisplayLive } from '@/lib/match-display-status';

type Conditions = {
  match_id: number;
  status: 'scheduled' | 'live' | 'finished' | string;
  started_at: string | null;
  ended_at: string | null;
  scheduled_at: string;
  home_roster_count: number;
  away_roster_count: number;
  sudije_count: number;
  zapisnicar_count: number;
  min_roster?: number;
  max_roster?: number;
  cond_rosters: boolean;
  cond_sudije: boolean;
  cond_zapisnicar: boolean;
  cond_time: boolean;
};

type OfficialRef = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

type SudijaRow = OfficialRef & { phone: string | null };

type MatchInfo = {
  id: number;
  league_id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  home_club_id: number;
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  display_status?: string | null;
};

type Payload = {
  match: MatchInfo;
  conditions: Conditions;
  sudije: OfficialRef[];
  zapisnicar: OfficialRef | null;
};

const GREEN = '#2a9d4a';
const RED = '#c53939';

function officialLabel(o: OfficialRef | null | undefined) {
  if (!o) return '—';
  return (
    o.display_name ||
    [o.first_name, o.last_name].filter(Boolean).join(' ') ||
    o.username ||
    'Korisnik'
  );
}

function sudijeToOptions(sudije: SudijaRow[]): SelectOption[] {
  return sudije.map((s) => ({
    value: s.user_id,
    label: officialLabel(s),
    sublabel: s.phone ? `@${s.username ?? '-'} · ${s.phone}` : `@${s.username ?? '-'}`,
  }));
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('sr-Latn', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

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

function clubLabel(name: string | null, id: number): string {
  return name?.trim() ? name.trim() : `#${id}`;
}

function matchHeadline(m: MatchInfo): string {
  return `${clubLabel(m.home_club_name, m.home_club_id)} — ${clubLabel(m.away_club_name, m.away_club_id)}`;
}

export default function DelegatMatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);
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
  const [busy, setBusy] = useState(false);
  const [savingSudije, setSavingSudije] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [leagueSudije, setLeagueSudije] = useState<SudijaRow[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(matchId)) {
      setErrorMessage('Neispravan ID utakmice');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const { data: rpcData, error } = await supabase.rpc('get_delegat_match_detail', {
      p_match_id: matchId,
    });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    const payload = rpcData as Payload;
    setData(payload);

    const { data: sudRows, error: sudErr } = await supabase.rpc('get_league_sudije', {
      p_league_id: payload.match.league_id,
    });
    if (sudErr) {
      setErrorMessage(sudErr.message);
    } else {
      setLeagueSudije((sudRows ?? []) as SudijaRow[]);
    }
    setLoading(false);
  }, [matchId]);

  useScreenPullRefresh(load);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const startMatch = async () => {
    setBusy(true);
    setErrorMessage('');
    const { error } = await supabase.rpc('start_match', { p_match_id: matchId });
    setBusy(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    triggerAppFeedback('whistleStart', { matchId });
    await load();
  };

  const endMatch = async () => {
    setBusy(true);
    setErrorMessage('');
    const { error } = await supabase.rpc('end_match', { p_match_id: matchId });
    setBusy(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    triggerAppFeedback('matchEnd', { matchId });
    await load();
  };

  const onChangeSudijaSlot = async (slotIndex: 0 | 1, newUserId: string | null) => {
    if (!data) return;
    setSavingSudije(true);
    setErrorMessage('');

    const current = data.sudije[slotIndex]?.user_id ?? null;
    const other = data.sudije[slotIndex === 0 ? 1 : 0]?.user_id ?? null;

    if (newUserId && newUserId === other) {
      setErrorMessage('Isti sudija ne može biti dodeljen dva puta na istu utakmicu.');
      setSavingSudije(false);
      return;
    }

    if (current === newUserId) {
      setSavingSudije(false);
      return;
    }

    if (current) {
      const { error: delErr } = await supabase
        .from('match_officials')
        .delete()
        .eq('match_id', matchId)
        .eq('user_id', current)
        .eq('role', 'sudija');
      if (delErr) {
        setErrorMessage(`Uklanjanje sudije: ${delErr.message}`);
        setSavingSudije(false);
        return;
      }
    }

    if (newUserId) {
      const { error: insErr } = await supabase.from('match_officials').insert({
        match_id: matchId,
        user_id: newUserId,
        role: 'sudija',
      });
      if (insErr) {
        setErrorMessage(`Dodela sudije: ${insErr.message}`);
        setSavingSudije(false);
        await load();
        return;
      }
    }

    await load();
    setSavingSudije(false);
  };

  const c = data?.conditions;
  const displayStatus = data
    ? formatMatchDisplayStatus({
        status: data.match.status,
        scheduled_at: data.match.scheduled_at,
        display_status: data.match.display_status,
        cond_rosters: c?.cond_rosters,
        cond_sudije: c?.cond_sudije,
        cond_zapisnicar: c?.cond_zapisnicar,
      })
    : '';
  const isLive = isMatchDisplayLive({
    status: data?.match.status,
    scheduled_at: data?.match.scheduled_at,
    display_status: displayStatus,
    cond_rosters: c?.cond_rosters,
    cond_sudije: c?.cond_sudije,
    cond_zapisnicar: c?.cond_zapisnicar,
  });
  const isFinished = c?.status === 'finished' || displayStatus === 'ZAVRŠENA';
  const isScheduled = !isLive && !isFinished;
  const allOk = !!c && c.cond_rosters && c.cond_sudije && c.cond_zapisnicar && c.cond_time;
  const sudijaOpts = useMemo(() => sudijeToOptions(leagueSudije), [leagueSudije]);
  const slot0 = data?.sudije[0]?.user_id ?? null;
  const slot1 = data?.sudije[1]?.user_id ?? null;
  const headline = data ? matchHeadline(data.match) : '';

  if (!loading && data && isFinished) {
    return (
      <ScreenShell>
        <View style={styles.fill}>
          <MatchScorebookDetailView
            matchId={matchId}
            boxScoreBelowHero={<DelegatMatchObjectionBoxScorePanel matchId={matchId} />}
          />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator color={colors.tint} /> : null}
        {errorMessage ? (
          <ThemedView style={[styles.errorCard, { borderColor: colors.borderStrong }]}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </ThemedView>
        ) : null}

        {data ? (
          <>
            {isLive ? (
              <MatchRichCard
                variant="club_upcoming"
                theme={matchRichTheme}
                oppName={headline}
                headline={headline}
                scheduledIso={data.match.scheduled_at}
                venue={data.match.venue}
                status={displayStatus}
                homeScore={data.match.home_score}
                awayScore={data.match.away_score}
                matchTime={formatMatchTimeSr(data.match.scheduled_at)}
              />
            ) : (
              <MatchRichCard
                variant="club_upcoming"
                theme={matchRichTheme}
                oppName={headline}
                headline={headline}
                scheduledIso={data.match.scheduled_at}
                venue={data.match.venue}
                status={displayStatus}
                homeScore={data.match.home_score}
                awayScore={data.match.away_score}
                matchTime={formatMatchTimeSr(data.match.scheduled_at)}
              />
            )}

            <ThemedText type="subtitle" style={{ color: colors.text }}>
              Uslovi za početak
            </ThemedText>

            <ThemedView
              style={[
                styles.conditionsCard,
                {
                  borderColor: isScheduled && allOk ? GREEN : colors.borderStrong,
                  backgroundColor: isScheduled && allOk ? `${GREEN}14` : colors.surface,
                },
              ]}>
              <ConditionRow
                ok={c!.cond_rosters}
                label={`Sastavi oba tima (${c!.min_roster ?? 5}–${c!.max_roster ?? 12} igrača) — ${c!.home_roster_count}/${c!.max_roster ?? 12} : ${c!.away_roster_count}/${c!.max_roster ?? 12}`}
              />
              <ConditionRow
                ok={c!.cond_sudije}
                label={`Dodeljene 2 sudije — ${c!.sudije_count}/2`}
              />
              <ConditionRow
                ok={c!.cond_zapisnicar}
                label={`Dodeljen zapisničar — ${c!.zapisnicar_count}/1`}
              />
              <ConditionRow
                ok={c!.cond_time}
                label={`Vreme početka (${formatDate(c!.scheduled_at)}) je prošlo`}
              />
            </ThemedView>

            <ThemedText type="subtitle" style={{ color: colors.text }}>
              Sudije
            </ThemedText>

            {isScheduled ? (
              <ThemedView style={[styles.panel, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
                <ThemedView style={styles.selectsRow}>
                  <View style={styles.selectCell}>
                    <SearchableSelect
                      label="Sudija 1"
                      placeholder="Izaberi sudiju"
                      options={sudijaOpts}
                      value={slot0}
                      disabledValues={slot1 ? [slot1] : []}
                      onChange={(v) => onChangeSudijaSlot(0, v)}
                    />
                  </View>
                  <View style={styles.selectCell}>
                    <SearchableSelect
                      label="Sudija 2"
                      placeholder="Izaberi sudiju"
                      options={sudijaOpts}
                      value={slot1}
                      disabledValues={slot0 ? [slot0] : []}
                      onChange={(v) => onChangeSudijaSlot(1, v)}
                    />
                  </View>
                </ThemedView>
                {savingSudije ? <ActivityIndicator color={colors.tint} /> : null}
              </ThemedView>
            ) : (
              <ThemedView style={[styles.panel, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
                {data.sudije.length > 0 ? (
                  data.sudije.map((s) => (
                    <ThemedText key={s.user_id} style={{ color: colors.text }}>
                      • {officialLabel(s)}
                    </ThemedText>
                  ))
                ) : (
                  <ThemedText style={{ color: colors.textSecondary }}>Nisu dodeljene.</ThemedText>
                )}
              </ThemedView>
            )}

            {data.zapisnicar ? (
              <>
                <ThemedText type="subtitle" style={{ color: colors.text }}>
                  Zapisničar
                </ThemedText>
                <ThemedView style={[styles.panel, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
                  <ThemedText style={{ color: colors.text }}>• {officialLabel(data.zapisnicar)}</ThemedText>
                </ThemedView>
              </>
            ) : null}

            {isLive ? (
              <View style={styles.liveScoreWrap}>
                <MatchScorebookDetailView matchId={matchId} />
              </View>
            ) : null}

            {isScheduled ? (
              <Pressable
                style={[styles.primaryBtn, (!allOk || busy) && styles.primaryBtnDisabled]}
                onPress={startMatch}
                disabled={!allOk || busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryBtnText}>POČNI UTAKMICU</ThemedText>
                )}
              </Pressable>
            ) : null}

            {isLive ? (
              <Pressable
                style={[styles.dangerBtn, busy && styles.primaryBtnDisabled]}
                onPress={endMatch}
                disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryBtnText}>KRAJ UTAKMICE</ThemedText>
                )}
              </Pressable>
            ) : null}
          </>
        ) : null}
      </RefreshableScrollView>
    </ScreenShell>
  );
}

function ConditionRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.condRow}>
      <ThemedText style={[styles.condMark, { color: ok ? GREEN : RED }]}>{ok ? '✓' : '✗'}</ThemedText>
      <ThemedText style={styles.condLabel}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { gap: 10, padding: 16, paddingBottom: 32 },
  panel: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  selectsRow: { flexDirection: 'row', gap: 10 },
  selectCell: { flex: 1, minWidth: 0 },
  liveScoreWrap: { height: 480 },
  errorCard: { borderWidth: 1, borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  conditionsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  condRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  condMark: { fontWeight: '800', fontSize: 16, width: 18 },
  condLabel: { flex: 1, fontSize: 14 },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: ActionAccentHex,
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dangerBtn: {
    marginTop: 10,
    backgroundColor: '#c53939',
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
