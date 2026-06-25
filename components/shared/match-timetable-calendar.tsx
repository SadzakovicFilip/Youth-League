import { ActionAccentHex, ActionAccentWash } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CALENDAR_LIVE_BLUE,
  getMatchCalendarStatusColors,
  resolveDayMarkerFromMatches,
  type MatchCalendarMarkerInput,
  type MatchCalendarStatusColors,
} from '@/lib/match-calendar-markers';
import {
  daysInMonth,
  mondayIndexFromSunday,
  monthTitleSr,
  parseIsoToLocalDay,
  startOfLocalDay,
  WEEKDAY_LABELS_MON_FIRST,
  sortTimetableDayMatches,
  ymdKey,
} from '@/lib/match-calendar-utils';
import { DEFAULT_UI_SOUND_ID, type AppFeedbackSoundAssetId } from '@/lib/app-feedback-sounds';
import { scheduleTapFeedback } from '@/lib/app-feedback-touch';

export type TimetableMatch = MatchCalendarMarkerInput & {
  id: number;
  scheduled_at: string;
  phase?: string | null;
};

/** Marker ispod broja dana u kalendaru. */
export type MatchDayCalendarMarker =
  | 'dot'
  | 'star'
  | 'iscekivanje'
  | 'nema_uslova'
  | 'uzivo'
  | 'neodigrana'
  | 'objection_pending'
  | 'played_ok'
  | 'played_resolved';

type Props<T extends TimetableMatch> = {
  matches: T[];
  renderMatch: (m: T) => ReactNode;
  onMatchPress?: (m: T) => void;
  emptyDayMessage?: string;
  /** Zvuk pri izboru dana u mreži (npr. utakmice tab → ballBounce2). */
  daySelectSoundId?: AppFeedbackSoundAssetId;
  /**
   * @deprecated Koristi prikazni status (display_status). Ostaje samo za treninge.
   */
  matchesNeedAttention?: (m: T) => boolean;
  resolveDayMarker?: (dayMatches: T[]) => MatchDayCalendarMarker | null;
  scheduleDotColor?: string;
  /** Boja selektovanog dana (podrazumevano narandžasta utakmica). */
  accentColor?: string;
  /** Pozadina današnjeg dana kad nije selektovan. */
  accentWash?: string;
  /** Ikona na danima sa terminom (munja za trening). */
  scheduleDayMarker?: 'dot' | 'bolt';
  listHeading?: (day: Date) => string;
};

const now = () => new Date();

function LiveCalendarMarker({ color }: { color: string }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.38, { duration: 750, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 750, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.55 + ((pulse.value - 1) / 0.38) * 0.45,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + ((pulse.value - 1) / 0.38) * 0.18 }],
  }));

  return (
    <Animated.View style={[styles.liveRing, { borderColor: color }, ringStyle]}>
      <Animated.View style={[styles.liveDot, { backgroundColor: color }, dotStyle]} />
    </Animated.View>
  );
}

function CalendarDayMarker({
  marker,
  selected,
  dotFill,
  mutedColor,
  statusColors,
  scheduleDayMarker,
}: {
  marker: MatchDayCalendarMarker;
  selected: boolean;
  dotFill: string;
  mutedColor: string;
  statusColors: MatchCalendarStatusColors;
  scheduleDayMarker: 'dot' | 'bolt';
}) {
  const tint = (c: string) => (selected ? '#fff' : c);

  switch (marker) {
    case 'objection_pending':
      return (
        <ThemedText style={[styles.bangMarker, { color: tint('#c53939') }]}>!</ThemedText>
      );
    case 'played_ok':
      return (
        <MaterialIcons name="check" size={14} color={tint('#2a9d4a')} style={styles.iconMarker} />
      );
    case 'played_resolved':
      return (
        <MaterialIcons name="check" size={14} color={tint('#c9a227')} style={styles.iconMarker} />
      );
    case 'iscekivanje':
      return (
        <MaterialIcons
          name="notifications"
          size={14}
          color={tint(statusColors.iscekivanje)}
          style={styles.iconMarker}
        />
      );
    case 'nema_uslova':
    case 'star':
      return (
        <MaterialIcons
          name="star"
          size={14}
          color={tint(statusColors.nemaUslova)}
          style={styles.starMarker}
        />
      );
    case 'uzivo': {
      const blue = tint(CALENDAR_LIVE_BLUE);
      return <LiveCalendarMarker color={blue} />;
    }
    case 'neodigrana':
      return (
        <ThemedText style={[styles.xMarker, { color: tint(mutedColor) }]}>×</ThemedText>
      );
    case 'dot':
    default: {
      const fill = selected
        ? '#fff'
        : scheduleDotColorUsesAccent(dotFill)
          ? statusColors.zakazana
          : dotFill;
      if (scheduleDayMarker === 'bolt' && !selected) {
        return (
          <MaterialIcons name="bolt" size={15} color={tint(fill)} style={styles.iconMarker} />
        );
      }
      return <View style={[styles.dot, { backgroundColor: fill }]} />;
    }
  }
}

function scheduleDotColorUsesAccent(dotFill: string): boolean {
  return dotFill === ActionAccentHex;
}

export function MatchTimetableCalendar<T extends TimetableMatch>({
  matches,
  renderMatch,
  onMatchPress,
  emptyDayMessage = 'Nema zakazanih utakmica za ovaj dan.',
  matchesNeedAttention,
  resolveDayMarker,
  scheduleDotColor,
  accentColor,
  accentWash,
  scheduleDayMarker = 'dot',
  listHeading,
  daySelectSoundId,
}: Props<T>) {
  const { colors, colorScheme } = useAppTheme();
  const fireDefaultPressFeedback = () => {
    scheduleTapFeedback('ui', { soundId: DEFAULT_UI_SOUND_ID });
  };
  const fireDaySelectFeedback = () => {
    scheduleTapFeedback('ui', { soundId: daySelectSoundId ?? DEFAULT_UI_SOUND_ID });
  };
  const statusColors = useMemo(
    () => getMatchCalendarStatusColors(colorScheme),
    [colorScheme],
  );
  const cellAccent = accentColor ?? ActionAccentHex;
  const cellAccentWash = accentWash ?? ActionAccentWash;
  const today = useMemo(() => startOfLocalDay(now()), []);
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonthIndex, setVisibleMonthIndex] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(now()));

  const monthTitle = monthTitleSr(visibleYear, visibleMonthIndex);

  const firstOfMonth = useMemo(
    () => new Date(visibleYear, visibleMonthIndex, 1),
    [visibleYear, visibleMonthIndex],
  );
  const startBlank = mondayIndexFromSunday(firstOfMonth);
  const dim = daysInMonth(visibleYear, visibleMonthIndex);
  const totalCells = startBlank + dim;
  const endBlank = (7 - (totalCells % 7)) % 7;

  const matchesByYmd = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const m of matches) {
      const d = parseIsoToLocalDay(m.scheduled_at);
      if (!d) continue;
      const k = ymdKey(d);
      const arr = map.get(k) ?? [];
      arr.push(m);
      map.set(k, arr);
    }
    for (const [k, arr] of map.entries()) {
      map.set(k, sortTimetableDayMatches(arr));
    }
    return map;
  }, [matches]);

  const selectedKey = ymdKey(selectedDay);
  const dayMatches = matchesByYmd.get(selectedKey) ?? [];

  const dotFill = scheduleDotColor ?? ActionAccentHex;
  const listHeadingText =
    listHeading?.(selectedDay) ??
    `Utakmice za ${selectedDay.toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'long' })}`;

  const goPrevMonth = () => {
    setVisibleMonthIndex((mi) => {
      if (mi > 0) return mi - 1;
      setVisibleYear((y) => y - 1);
      return 11;
    });
  };

  const goNextMonth = () => {
    setVisibleMonthIndex((mi) => {
      if (mi < 11) return mi + 1;
      setVisibleYear((y) => y + 1);
      return 0;
    });
  };

  const isTodayCell = (dayNum: number) =>
    today.getFullYear() === visibleYear &&
    today.getMonth() === visibleMonthIndex &&
    today.getDate() === dayNum;

  const isSelectedCell = (dayNum: number) =>
    selectedDay.getFullYear() === visibleYear &&
    selectedDay.getMonth() === visibleMonthIndex &&
    selectedDay.getDate() === dayNum;

  const onPickDay = (dayNum: number) => {
    setSelectedDay(new Date(visibleYear, visibleMonthIndex, dayNum, 12, 0, 0, 0));
  };

  const borderMuted = colorScheme === 'dark' ? '#555' : '#ccc';
  const cellBgOther = colorScheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  const resolveMarker = (dayMatchesOnCell: T[]): MatchDayCalendarMarker | null => {
    if (resolveDayMarker) {
      return resolveDayMarker(dayMatchesOnCell);
    }
    const fromStatus = resolveDayMarkerFromMatches(dayMatchesOnCell);
    if (fromStatus) return fromStatus;
    if (matchesNeedAttention?.(dayMatchesOnCell[0]!)) return 'star';
    return dayMatchesOnCell.length > 0 ? 'dot' : null;
  };

  return (
    <ThemedView style={styles.wrap}>
      <ThemedView style={[styles.monthRow, { borderColor: borderMuted }]}>
        <Pressable
          onPressIn={fireDefaultPressFeedback}
          onPress={goPrevMonth}
          style={styles.monthArrow}
          accessibilityLabel="Prethodni mesec">
          <MaterialIcons name="chevron-left" size={28} color={cellAccent} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.monthTitle}>
          {monthTitle}
        </ThemedText>
        <Pressable
          onPressIn={fireDefaultPressFeedback}
          onPress={goNextMonth}
          style={styles.monthArrow}
          accessibilityLabel="Sledeci mesec">
          <MaterialIcons name="chevron-right" size={28} color={cellAccent} />
        </Pressable>
      </ThemedView>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS_MON_FIRST.map((label, idx) => (
          <ThemedText key={idx} style={[styles.weekCell, { color: colors.textSecondary }]}>
            {label}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: startBlank }, (_, i) => (
          <View key={`b-${i}`} style={[styles.dayCell, { backgroundColor: cellBgOther }]} />
        ))}
        {Array.from({ length: dim }, (_, i) => {
          const dayNum = i + 1;
          const key = ymdKey(new Date(visibleYear, visibleMonthIndex, dayNum));
          const dayMatchesOnCell = matchesByYmd.get(key) ?? [];
          const marker = resolveMarker(dayMatchesOnCell);
          const sel = isSelectedCell(dayNum);
          const isToday = isTodayCell(dayNum);

          return (
            <Pressable
              key={key}
              onPressIn={fireDaySelectFeedback}
              onPress={() => onPickDay(dayNum)}
              style={[
                styles.dayCell,
                {
                  borderColor: borderMuted,
                  backgroundColor: sel ? cellAccent : 'transparent',
                },
                isToday && !sel ? { borderColor: cellAccent, backgroundColor: cellAccentWash } : null,
              ]}
              accessibilityLabel={`Dan ${dayNum}`}
              accessibilityState={{ selected: sel }}>
              <ThemedText
                style={[
                  styles.dayNum,
                  { color: sel ? '#fff' : colors.text },
                  isToday && !sel ? { fontWeight: '800' } : null,
                ]}>
                {dayNum}
              </ThemedText>
              {marker ? (
                <CalendarDayMarker
                  marker={marker}
                  selected={sel}
                  dotFill={dotFill}
                  mutedColor={colors.textSecondary}
                  statusColors={statusColors}
                  scheduleDayMarker={scheduleDayMarker}
                />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </Pressable>
          );
        })}
        {Array.from({ length: endBlank }, (_, i) => (
          <View key={`e-${i}`} style={[styles.dayCell, { backgroundColor: cellBgOther }]} />
        ))}
      </View>

      <ThemedText type="subtitle" style={styles.listHeading}>
        {listHeadingText}
      </ThemedText>

      {dayMatches.length === 0 ? (
        <ThemedText style={styles.empty}>{emptyDayMessage}</ThemedText>
      ) : (
        <ThemedView style={styles.list}>
          {dayMatches.map((m) =>
            onMatchPress ? (
              <Pressable
                key={m.id}
                onPressIn={fireDefaultPressFeedback}
                onPress={() => onMatchPress(m)}>
                {renderMatch(m)}
              </Pressable>
            ) : (
              <ThemedView key={m.id}>{renderMatch(m)}</ThemedView>
            ),
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  monthArrow: { padding: 4 },
  monthTitle: { flex: 1, textAlign: 'center', textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    maxHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayNum: { fontSize: 15 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  liveRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2 },
  starMarker: { marginTop: 1 },
  iconMarker: { marginTop: 1 },
  bangMarker: { marginTop: -1, fontSize: 15, fontWeight: '800', lineHeight: 16 },
  xMarker: { marginTop: -2, fontSize: 15, fontWeight: '800', lineHeight: 16 },
  dotPlaceholder: { height: 5, marginTop: 2 },
  listHeading: { marginTop: 4 },
  empty: { opacity: 0.85, fontStyle: 'italic' },
  list: { gap: 10 },
});
