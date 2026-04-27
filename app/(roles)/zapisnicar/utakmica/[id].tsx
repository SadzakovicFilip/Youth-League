import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type MatchInfo = {
  id: number;
  scheduled_at: string;
  venue: string | null;
  status: 'scheduled' | 'live' | 'finished' | string;
  started_at: string | null;
  ended_at: string | null;
  home_club_id: number;
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

type RosterPlayer = {
  user_id: string;
  jersey_number: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  total_points: number;
};

type Payload = {
  match: MatchInfo;
  is_zapisnicar: boolean;
  can_score: boolean;
  home_roster: RosterPlayer[];
  away_roster: RosterPlayer[];
};

type EventType = 'free_throw' | 'field' | 'three' | 'foul';

function playerName(p: Pick<RosterPlayer, 'display_name' | 'first_name' | 'last_name' | 'username'>) {
  return (
    p.display_name ||
    [p.first_name, p.last_name].filter(Boolean).join(' ') ||
    p.username ||
    'Igrac'
  );
}

function totalTeamPoints(r: RosterPlayer[]) {
  return r.reduce((s, p) => s + (p.total_points ?? 0), 0);
}

export default function ZapisnicarMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = windowWidth;

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const pageIndexRef = useRef(0);
  const hScrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(matchId)) {
      setErrorMessage('Neispravan ID utakmice');
      setLoading(false);
      return;
    }
    const { data: rpcData, error } = await supabase.rpc('get_zapisnicar_match_detail', {
      p_match_id: matchId,
    });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    setErrorMessage('');
    setData(rpcData as Payload);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const status = data?.match.status;
    if (status === 'finished') return;
    const intervalMs = status === 'live' ? 30000 : 5000;
    const t = setInterval(() => {
      load();
    }, intervalMs);
    return () => clearInterval(t);
  }, [data?.match.status, load]);

  const onHorizontalScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.min(1, Math.max(0, Math.round(x / Math.max(1, pageWidth))));
    if (next !== pageIndexRef.current) {
      pageIndexRef.current = next;
      setPageIndex(next);
    }
  };

  const onEvent = async (userId: string, type: EventType) => {
    if (!data?.can_score) return;
    const key = `${userId}-${type}`;
    setBusyKey(key);
    setErrorMessage('');
    const { error } = await supabase.rpc('record_match_event', {
      p_match_id: matchId,
      p_user_id: userId,
      p_event_type: type,
    });
    setBusyKey(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  };

  const onUndo = async () => {
    if (!data?.can_score) return;
    setBusyKey('undo');
    setErrorMessage('');
    const { data: res, error } = await supabase.rpc('undo_last_match_event_any', {
      p_match_id: matchId,
    });
    setBusyKey(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    if (res && typeof res === 'object' && 'ok' in res && !(res as { ok: boolean }).ok) {
      const reason = (res as { reason?: string }).reason ?? 'Nema dogadjaja za undo';
      setErrorMessage(reason);
      return;
    }
    await load();
  };

  const teamLabel =
    data && pageIndex === 0
      ? (data.match.home_club_name ?? 'Tim A')
      : data && pageIndex === 1
        ? (data.match.away_club_name ?? 'Tim B')
        : '';

  return (
    <View style={styles.screen}>
      <View style={styles.topPad}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ThemedText style={styles.backText}>← Nazad</ThemedText>
        </Pressable>

        {loading ? <ActivityIndicator /> : null}
        {errorMessage ? (
          <ThemedView style={styles.errorCard}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </ThemedView>
        ) : null}

        {data ? (
          <>
            <ThemedView
              style={[
                styles.headerCard,
                data.match.status === 'live' && styles.headerCardLive,
                data.match.status === 'finished' && styles.headerCardFinished,
              ]}>
              <ThemedText type="defaultSemiBold" style={styles.matchTitle} numberOfLines={1}>
                {data.match.home_club_name ?? '-'} {totalTeamPoints(data.home_roster)} :{' '}
                {totalTeamPoints(data.away_roster)} {data.match.away_club_name ?? '-'}
              </ThemedText>
              <ThemedText style={styles.statusLine}>
                <ThemedText
                  style={[
                    data.match.status === 'live' && styles.statusLive,
                    data.match.status === 'finished' && styles.statusFinished,
                  ]}>
                  {String(data.match.status).toUpperCase()}
                </ThemedText>
              </ThemedText>
              {data.match.status === 'scheduled' ? (
                <ThemedText style={styles.mutedSmall} numberOfLines={2}>
                  Cekamo POCNI od delegata — dugmadi su zakljucana.
                </ThemedText>
              ) : null}
              {data.match.status === 'finished' ? (
                <ThemedText style={styles.mutedSmall}>Zavrseno — upis zakljucan.</ThemedText>
              ) : null}
            </ThemedView>

            <Pressable
              style={[styles.undoButton, (!data.can_score || busyKey === 'undo') && styles.undoButtonDisabled]}
              disabled={!data.can_score || busyKey === 'undo'}
              onPress={onUndo}>
              {busyKey === 'undo' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={styles.undoButtonText}>↶ UNDO (ponisti zadnji upis)</ThemedText>
              )}
            </Pressable>

            <ThemedView style={styles.teamBar}>
              <ThemedText style={styles.teamBarText} numberOfLines={1}>
                {teamLabel}
              </ThemedText>
              <ThemedText style={styles.swipeHint} numberOfLines={2}>
                Oba tima su ucitana odjednom — prevucite u levo za gosta, u desno za domacina (animacija prati prst).
              </ThemedText>
            </ThemedView>
          </>
        ) : null}
      </View>

      {data ? (
        <ScrollView
          ref={hScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.pager}
          onScroll={onHorizontalScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onHorizontalScroll}>
          <View style={[styles.page, { width: pageWidth }]}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.rosterContent}
              showsVerticalScrollIndicator>
              <RosterList
                roster={data.home_roster}
                payload={data}
                busyKey={busyKey}
                onEvent={onEvent}
              />
            </ScrollView>
          </View>
          <View style={[styles.page, { width: pageWidth }]}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.rosterContent}
              showsVerticalScrollIndicator>
              <RosterList
                roster={data.away_roster}
                payload={data}
                busyKey={busyKey}
                onEvent={onEvent}
              />
            </ScrollView>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function RosterList({
  roster,
  payload,
  busyKey,
  onEvent,
}: {
  roster: RosterPlayer[];
  payload: Payload;
  busyKey: string | null;
  onEvent: (userId: string, type: EventType) => void;
}) {
  if (roster.length === 0) {
    return (
      <ThemedView style={styles.emptyCard}>
        <ThemedText style={styles.mutedSmall}>Nema sastava.</ThemedText>
      </ThemedView>
    );
  }
  return (
    <>
      {roster.map((p) => {
        const fouledOut = p.fouls >= 5;
        const canScore = payload.can_score && !fouledOut;
        const canFoul = payload.can_score && !fouledOut;
        return (
          <ThemedView key={p.user_id} style={[styles.playerCard, fouledOut && styles.playerFouledOut]}>
            <View style={styles.rowMain}>
              <View style={styles.nameBlock}>
                <ThemedText style={styles.jerseyNum}>{p.jersey_number}</ThemedText>
                <ThemedText style={styles.playerName} numberOfLines={1}>
                  {playerName(p)}
                </ThemedText>
              </View>
              <View style={styles.btnRow}>
                <ScoreBtn
                  label="+1"
                  color="#2a9d4a"
                  disabled={!canScore || busyKey === `${p.user_id}-free_throw`}
                  busy={busyKey === `${p.user_id}-free_throw`}
                  onPress={() => onEvent(p.user_id, 'free_throw')}
                />
                <ScoreBtn
                  label="+2"
                  color="#0a7ea4"
                  disabled={!canScore || busyKey === `${p.user_id}-field`}
                  busy={busyKey === `${p.user_id}-field`}
                  onPress={() => onEvent(p.user_id, 'field')}
                />
                <ScoreBtn
                  label="+3"
                  color="#7b3fbd"
                  disabled={!canScore || busyKey === `${p.user_id}-three`}
                  busy={busyKey === `${p.user_id}-three`}
                  onPress={() => onEvent(p.user_id, 'three')}
                />
                <ScoreBtn
                  label="!"
                  color="#c53939"
                  narrow
                  disabled={!canFoul || busyKey === `${p.user_id}-foul`}
                  busy={busyKey === `${p.user_id}-foul`}
                  onPress={() => onEvent(p.user_id, 'foul')}
                />
              </View>
              <ThemedText style={styles.ptsBadge}>{p.total_points}</ThemedText>
            </View>

            <View style={styles.foulRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <View
                  key={n}
                  style={[
                    styles.foulBox,
                    p.fouls >= n && styles.foulBoxActive,
                    p.fouls >= 5 && n === 5 && styles.foulBoxOut,
                  ]}>
                  <ThemedText style={p.fouls >= n ? styles.foulBoxActiveText : styles.foulBoxText}>{n}</ThemedText>
                </View>
              ))}
              {fouledOut ? <ThemedText style={styles.outText}>OUT</ThemedText> : null}
            </View>
          </ThemedView>
        );
      })}
    </>
  );
}

function ScoreBtn({
  label,
  color,
  onPress,
  disabled,
  busy,
  narrow,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled: boolean;
  busy: boolean;
  narrow?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.scoreBtn,
        narrow && styles.scoreBtnNarrow,
        { backgroundColor: color },
        disabled && styles.scoreBtnDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}>
      {busy ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <ThemedText style={styles.scoreBtnText}>{label}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topPad: { paddingHorizontal: 8, paddingTop: 8 },
  pager: { flex: 1 },
  page: { flex: 1 },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  backText: { fontWeight: '600', fontSize: 13 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 6, padding: 8, marginBottom: 4 },
  errorText: { color: '#c53939', fontSize: 13 },
  mutedSmall: { color: '#888', fontSize: 11 },
  headerCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  headerCardLive: { borderColor: '#0a7ea4', backgroundColor: '#eef7fb' },
  headerCardFinished: { borderColor: '#888', backgroundColor: '#f1f1f1' },
  undoButton: {
    marginTop: 6,
    marginBottom: 2,
    minHeight: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d97706',
    paddingHorizontal: 10,
  },
  undoButtonDisabled: {
    opacity: 0.4,
  },
  undoButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  matchTitle: { fontSize: 14, textAlign: 'center' },
  statusLine: { textAlign: 'center', fontSize: 12 },
  statusLive: { color: '#0a7ea4', fontWeight: '700' },
  statusFinished: { color: '#666' },
  teamBar: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 2,
    marginBottom: 4,
  },
  teamBarText: { fontWeight: '700', fontSize: 13 },
  swipeHint: { fontSize: 10, color: '#888' },
  rosterContent: { paddingHorizontal: 4, paddingBottom: 20, gap: 2 },
  emptyCard: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 },
  playerCard: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 1,
  },
  playerFouledOut: { opacity: 0.45 },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 30,
  },
  nameBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  jerseyNum: {
    fontSize: 10,
    fontWeight: '800',
    color: '#444',
    minWidth: 18,
    textAlign: 'center',
  },
  playerName: { flex: 1, fontWeight: '600', fontSize: 11, minWidth: 0 },
  ptsBadge: { fontWeight: '800', fontSize: 12, minWidth: 20, textAlign: 'right' },
  btnRow: { flexDirection: 'row', gap: 2, flexShrink: 0 },
  scoreBtn: {
    width: 30,
    height: 26,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBtnNarrow: { width: 24 },
  scoreBtnDisabled: { opacity: 0.35 },
  scoreBtnText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  foulRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  foulBox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foulBoxActive: { backgroundColor: '#c53939', borderColor: '#c53939' },
  foulBoxOut: { backgroundColor: '#7a1d1d' },
  foulBoxText: { color: '#666', fontSize: 7, fontWeight: '700' },
  foulBoxActiveText: { color: '#fff', fontSize: 7, fontWeight: '800' },
  outText: { color: '#c53939', fontWeight: '800', fontSize: 9, marginLeft: 3 },
});
