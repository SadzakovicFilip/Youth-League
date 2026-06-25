/**
 * Ekran zapisnika tokom zakazane / LIVE utakmice (dugmad +1/+2/+3/faul, pager, UNDO).
 * Ne koristi se za status `finished`.
 */
import { ActionAccentHex, ActionAccentWash } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type {
  MatchScorebookPayload,
  MatchScorebookRosterPlayer,
} from '@/components/match-scorebook-types';
import { formatMatchDisplayStatus, isMatchDisplayLive } from '@/lib/match-display-status';
import { supabase } from '@/lib/supabase';

type EventType = 'free_throw' | 'field' | 'three' | 'foul';

function playerNameParts(
  p: Pick<MatchScorebookRosterPlayer, 'display_name' | 'first_name' | 'last_name' | 'username'>,
) {
  if (p.last_name || p.first_name) {
    return {
      lastName: p.last_name?.trim() || '',
      firstName: p.first_name?.trim() || '',
    };
  }
  const fallback = p.display_name?.trim() || p.username?.trim() || 'Igrac';
  return { lastName: fallback, firstName: '' };
}

function totalTeamPoints(r: MatchScorebookRosterPlayer[]) {
  return r.reduce((s, p) => s + (p.total_points ?? 0), 0);
}

type Props = {
  matchId: number;
  data: MatchScorebookPayload;
  /** Uspešan upis poena/faula — parent pokreće animaciju i odloženi reload. */
  onScoreRecorded: (userId: string, type: EventType) => void;
  /** Pre RPC poziva — sprečava dupli flash (realtime DELETE + lokalni callback). */
  onUndoStarted?: () => void;
  onUndoAborted?: () => void;
  /** Uspešan UNDO — parent pokreće animaciju i odloženi reload. */
  onUndoComplete: (result: {
    userId: string;
    eventType: EventType;
    deletedId?: number;
  }) => void | Promise<void>;
  onActionError?: (message: string) => void;
};

export function MatchScorebookLiveView({
  matchId,
  data,
  onScoreRecorded,
  onUndoStarted,
  onUndoAborted,
  onUndoComplete,
  onActionError,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = windowWidth;
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const onEvent = async (userId: string, type: EventType) => {
    if (!data.can_score) return;
    const key = `${userId}-${type}`;
    setBusyKey(key);
    onActionError?.('');
    const { error } = await supabase.rpc('record_match_event', {
      p_match_id: matchId,
      p_user_id: userId,
      p_event_type: type,
    });
    setBusyKey(null);
    if (error) {
      onActionError?.(error.message);
      return;
    }
    onScoreRecorded(userId, type);
  };

  const onUndo = async () => {
    if (!data.can_score) return;
    setBusyKey('undo');
    onActionError?.('');
    onUndoStarted?.();
    const { data: res, error } = await supabase.rpc('undo_last_match_event_any', {
      p_match_id: matchId,
    });
    setBusyKey(null);
    if (error) {
      onUndoAborted?.();
      onActionError?.(error.message);
      return;
    }
    if (res && typeof res === 'object' && 'ok' in res && !(res as { ok: boolean }).ok) {
      const reason = (res as { reason?: string }).reason ?? 'Nema dogadjaja za undo';
      onUndoAborted?.();
      onActionError?.(reason);
      return;
    }
    const body = res as {
      ok?: boolean;
      user_id?: string;
      event_type?: string;
      deleted_id?: number;
    };
    if (
      body.user_id &&
      (body.event_type === 'free_throw' ||
        body.event_type === 'field' ||
        body.event_type === 'three' ||
        body.event_type === 'foul')
    ) {
      await onUndoComplete({
        userId: body.user_id,
        eventType: body.event_type,
        deletedId: body.deleted_id,
      });
    }
  };

  const statusLabel = formatMatchDisplayStatus(data.match);
  const liveDisplay = isMatchDisplayLive(data.match);
  const homePts = totalTeamPoints(data.home_roster);
  const awayPts = totalTeamPoints(data.away_roster);

  return (
    <View style={styles.screen}>
      <View style={styles.topPad}>
        <ThemedView
          style={[
            styles.headerCard,
            liveDisplay && styles.headerCardLive,
          ]}>
          <View style={styles.heroClubRow}>
            <ThemedText style={[styles.heroClubName, styles.heroClubNameLeft]} numberOfLines={1}>
              {data.match.home_club_name ?? '-'}
            </ThemedText>
            <ThemedText style={[styles.heroClubName, styles.heroClubNameRight]} numberOfLines={1}>
              {data.match.away_club_name ?? '-'}
            </ThemedText>
          </View>
          <View style={styles.heroScoreRow}>
            <ThemedText style={styles.heroScoreNum}>{homePts}</ThemedText>
            <ThemedText style={styles.heroScoreSep}>:</ThemedText>
            <ThemedText style={styles.heroScoreNum}>{awayPts}</ThemedText>
          </View>
          <ThemedText style={styles.statusLine}>
            <ThemedText style={liveDisplay ? styles.statusLive : undefined}>
              {statusLabel}
            </ThemedText>
          </ThemedText>
          {!liveDisplay ? (
            <ThemedText style={styles.mutedSmall} numberOfLines={2}>
              Cekamo POCNI od delegata — dugmadi su zakljucana.
            </ThemedText>
          ) : null}
        </ThemedView>

        <Pressable
          style={[
            styles.undoButton,
            (!data.can_score || busyKey === 'undo') && styles.undoButtonDisabled,
          ]}
          disabled={!data.can_score || busyKey === 'undo'}
          onPress={onUndo}>
          {busyKey === 'undo' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ThemedText style={styles.undoButtonText}>↶ UNDO (ponisti zadnji upis)</ThemedText>
          )}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.pager}>
        <View style={[styles.page, { width: pageWidth }]}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.rosterContent}
            showsVerticalScrollIndicator>
            <RosterTeamHeader
              side="home"
              teamName={data.match.home_club_name ?? 'Domacin'}
            />
            <RosterList roster={data.home_roster} payload={data} busyKey={busyKey} onEvent={onEvent} />
          </ScrollView>
        </View>
        <View style={[styles.page, { width: pageWidth }]}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.rosterContent}
            showsVerticalScrollIndicator>
            <RosterTeamHeader
              side="away"
              teamName={data.match.away_club_name ?? 'Gost'}
            />
            <RosterList roster={data.away_roster} payload={data} busyKey={busyKey} onEvent={onEvent} />
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_ROW_GAP = 8;
/** Razmak između imena i levog ruba dugmeta +1. */
const NAME_TO_PLUS1_GAP = 5;

function RosterTeamHeader({ side, teamName }: { side: 'home' | 'away'; teamName: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.rosterHeaderRow}>
      <View style={styles.rosterHeaderInfoSlot}>
        {side === 'home' ? (
          <ThemedText
            style={[styles.rosterTeamName, styles.rosterTeamNameLeft, { color: colors.text }]}
            numberOfLines={2}>
            {teamName}
          </ThemedText>
        ) : null}
      </View>
      {side === 'away' ? (
        <View style={styles.rosterHeaderActionsMirror}>
          <View style={styles.rosterHeaderBtnSpacer} />
          <View style={styles.rosterHeaderPtsSlot}>
            <ThemedText
              style={[styles.rosterTeamName, styles.rosterTeamNameRight, { color: colors.text }]}
              numberOfLines={2}>
              {teamName}
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.rosterHeaderActionsMirror} />
      )}
    </View>
  );
}

function FitPlayerNameLine({
  text,
  baseStyle,
  color,
}: {
  text: string;
  baseStyle: object;
  color: string;
}) {
  return (
    <ThemedText
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.55}
      style={[baseStyle, { color, maxWidth: '100%' }]}>
      {text}
    </ThemedText>
  );
}

function PlayerRosterCard({
  player: p,
  payload,
  busyKey,
  colors,
  onEvent,
}: {
  player: MatchScorebookRosterPlayer;
  payload: MatchScorebookPayload;
  busyKey: string | null;
  colors: ReturnType<typeof useAppTheme>['colors'];
  onEvent: (userId: string, type: EventType) => void;
}) {
  const fouledOut = p.fouls >= 5;
  const canScore = payload.can_score && !fouledOut;
  const canFoul = payload.can_score && !fouledOut;
  const { lastName, firstName } = playerNameParts(p);
  const [infoMaxWidth, setInfoMaxWidth] = useState<number | undefined>();
  const cardRowWidthRef = useRef(0);
  const actionsWidthRef = useRef(0);

  const recomputeInfoWidth = useCallback(() => {
    const rowW = cardRowWidthRef.current;
    const actionsW = actionsWidthRef.current;
    if (rowW > 0 && actionsW > 0) {
      setInfoMaxWidth(Math.max(0, rowW - actionsW - CARD_ROW_GAP - NAME_TO_PLUS1_GAP));
    }
  }, []);

  return (
    <ThemedView style={[styles.playerCard, fouledOut && styles.playerFouledOut]}>
      <View
        style={styles.cardRow}
        onLayout={(e) => {
          cardRowWidthRef.current = e.nativeEvent.layout.width;
          recomputeInfoWidth();
        }}>
        <View style={[styles.playerInfoCol, infoMaxWidth != null ? { maxWidth: infoMaxWidth } : null]}>
          <View style={styles.playerView1}>
            <View style={styles.playerView1a}>
              <ThemedText style={[styles.jerseyNum, { color: colors.text }]}>
                {p.jersey_number}
              </ThemedText>
            </View>
            <View style={styles.playerView1b}>
              <View style={styles.playerView1bLast}>
                <FitPlayerNameLine
                  text={lastName}
                  baseStyle={styles.playerLastName}
                  color={colors.text}
                />
              </View>
              {firstName ? (
                <View style={styles.playerView1bFirst}>
                  <FitPlayerNameLine
                    text={firstName}
                    baseStyle={styles.playerFirstName}
                    color={colors.textSecondary}
                  />
                </View>
              ) : null}
            </View>
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
                <ThemedText style={p.fouls >= n ? styles.foulBoxActiveText : styles.foulBoxText}>
                  {n}
                </ThemedText>
              </View>
            ))}
            {fouledOut ? <ThemedText style={styles.outText}>OUT</ThemedText> : null}
          </View>
        </View>

        <View
          style={styles.playerActionsCol}
          onLayout={(e) => {
            actionsWidthRef.current = e.nativeEvent.layout.width;
            recomputeInfoWidth();
          }}>
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
              color={ActionAccentHex}
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
          <ThemedText style={[styles.ptsBadge, { color: colors.tint }]}>
            {p.total_points}
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}
function RosterList({
  roster,
  payload,
  busyKey,
  onEvent,
}: {
  roster: MatchScorebookRosterPlayer[];
  payload: MatchScorebookPayload;
  busyKey: string | null;
  onEvent: (userId: string, type: EventType) => void;
}) {
  const { colors } = useAppTheme();

  if (roster.length === 0) {
    return (
      <ThemedView style={styles.emptyCard}>
        <ThemedText style={styles.mutedSmall}>Nema sastava.</ThemedText>
      </ThemedView>
    );
  }
  return (
    <>
      {roster.map((p) => (
        <PlayerRosterCard
          key={p.user_id}
          player={p}
          payload={payload}
          busyKey={busyKey}
          colors={colors}
          onEvent={onEvent}
        />
      ))}
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
  topPad: { paddingHorizontal: 8, paddingTop: 0 },
  pager: { flex: 1 },
  page: { flex: 1 },
  mutedSmall: { color: '#888', fontSize: 11 },
  headerCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
    minHeight: 72,
  },
  headerCardLive: { borderColor: ActionAccentHex, backgroundColor: ActionAccentWash },
  heroClubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroClubName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.85,
  },
  heroClubNameLeft: { textAlign: 'left' },
  heroClubNameRight: { textAlign: 'right' },
  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  heroScoreNum: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
    minWidth: 36,
    textAlign: 'center',
  },
  heroScoreSep: {
    fontSize: 24,
    fontWeight: '800',
    opacity: 0.65,
  },
  undoButton: {
    marginTop: 6,
    marginBottom: 2,
    minHeight: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d97706',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  undoButtonDisabled: {
    opacity: 0.4,
  },
  undoButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  statusLine: { textAlign: 'center', fontSize: 12 },
  statusLive: { color: ActionAccentHex, fontWeight: '700' },
  rosterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: CARD_ROW_GAP,
    marginBottom: 6,
    paddingHorizontal: 4,
    minHeight: 36,
  },
  rosterHeaderInfoSlot: {
    flexShrink: 1,
    minWidth: 0,
    flex: 1,
    justifyContent: 'flex-end',
  },
  rosterHeaderActionsMirror: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  /** Širina reda dugmadi (+1…!) — poravnava header gosta iznad kolone poena. */
  rosterHeaderBtnSpacer: { width: 202 },
  rosterHeaderPtsSlot: {
    minWidth: 28,
    maxWidth: 96,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  rosterTeamName: {
    fontWeight: '800',
    fontSize: 17,
    lineHeight: 21,
  },
  rosterTeamNameLeft: {
    textAlign: 'left',
  },
  rosterTeamNameRight: {
    textAlign: 'right',
  },
  rosterContent: { paddingHorizontal: 4, paddingBottom: 20, gap: 4, paddingTop: 4 },
  emptyCard: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 },
  playerCard: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  playerFouledOut: { opacity: 0.45 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 64,
  },
  playerInfoCol: {
    flexShrink: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  playerView1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  playerView1a: {
    justifyContent: 'center',
    flexShrink: 0,
  },
  playerView1b: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 1,
    minWidth: 0,
  },
  playerView1bLast: {
    minWidth: 0,
  },
  playerView1bFirst: {
    minWidth: 0,
  },
  jerseyNum: {
    fontSize: 26,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'center',
    lineHeight: 30,
  },
  playerLastName: {
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 17,
  },
  playerFirstName: {
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 15,
  },
  playerActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  ptsBadge: {
    fontWeight: '800',
    fontSize: 26,
    minWidth: 28,
    textAlign: 'center',
    alignSelf: 'center',
    lineHeight: 30,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBtn: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBtnNarrow: { width: 44, height: 44 },
  scoreBtnDisabled: { opacity: 0.35 },
  scoreBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  foulRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  foulBox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foulBoxActive: { backgroundColor: '#c53939', borderColor: '#c53939' },
  foulBoxOut: { backgroundColor: '#7a1d1d' },
  foulBoxText: {
    color: '#666',
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  foulBoxActiveText: {
    color: '#fff',
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
  outText: { color: '#c53939', fontWeight: '800', fontSize: 10, marginLeft: 4 },
});
