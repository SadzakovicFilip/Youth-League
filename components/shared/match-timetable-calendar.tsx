import { ActionAccentHex, ActionAccentWash } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  daysInMonth,
  mondayIndexFromSunday,
  monthTitleSr,
  parseIsoToLocalDay,
  startOfLocalDay,
  WEEKDAY_LABELS_MON_FIRST,
  ymdKey,
} from '@/lib/match-calendar-utils';

export type TimetableMatch = { id: number; scheduled_at: string };

type Props<T extends TimetableMatch> = {
  matches: T[];
  /** Prikaz jedne utakmice u listi ispod kalendara (bez sopstvenog Pressable ako koristite onMatchPress). */
  renderMatch: (m: T) => ReactNode;
  onMatchPress?: (m: T) => void;
  /** Opciono: zaglavlje iznad liste za izabrani dan */
  emptyDayMessage?: string;
  /** Kada je true za utakmicu na danu, na kalendaru se prikazuje zvezdica umesto tačke. */
  matchesNeedAttention?: (m: T) => boolean;
  /** Boja tačke za dane koji imaju barem jedan termin (podrazumevano narandžasta). */
  scheduleDotColor?: string;
  /** Naslov iznad liste za izabrani dan (podrazumevano „Utakmice za …”). */
  listHeading?: (day: Date) => string;
};

const now = () => new Date();

export function MatchTimetableCalendar<T extends TimetableMatch>({
  matches,
  renderMatch,
  onMatchPress,
  emptyDayMessage = 'Nema zakazanih utakmica za ovaj dan.',
  matchesNeedAttention,
  scheduleDotColor,
  listHeading,
}: Props<T>) {
  const { colors, colorScheme } = useAppTheme();
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
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    }
    return map;
  }, [matches]);

  const daysWithDot = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      const d = parseIsoToLocalDay(m.scheduled_at);
      if (!d) continue;
      if (d.getFullYear() === visibleYear && d.getMonth() === visibleMonthIndex) {
        set.add(ymdKey(d));
      }
    }
    return set;
  }, [matches, visibleYear, visibleMonthIndex]);

  const daysWithStar = useMemo(() => {
    if (!matchesNeedAttention) return new Set<string>();
    const set = new Set<string>();
    for (const m of matches) {
      if (!matchesNeedAttention(m)) continue;
      const d = parseIsoToLocalDay(m.scheduled_at);
      if (!d) continue;
      if (d.getFullYear() === visibleYear && d.getMonth() === visibleMonthIndex) {
        set.add(ymdKey(d));
      }
    }
    return set;
  }, [matches, matchesNeedAttention, visibleYear, visibleMonthIndex]);

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

  return (
    <ThemedView style={styles.wrap}>
      <ThemedView style={[styles.monthRow, { borderColor: borderMuted }]}>
        <Pressable onPress={goPrevMonth} style={styles.monthArrow} accessibilityLabel="Prethodni mesec">
          <MaterialIcons name="chevron-left" size={28} color={colors.tint} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.monthTitle}>
          {monthTitle}
        </ThemedText>
        <Pressable onPress={goNextMonth} style={styles.monthArrow} accessibilityLabel="Sledeci mesec">
          <MaterialIcons name="chevron-right" size={28} color={colors.tint} />
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
          const hasDot = daysWithDot.has(key);
          const hasStar = !!(matchesNeedAttention && daysWithStar.has(key));
          const sel = isSelectedCell(dayNum);
          const isToday = isTodayCell(dayNum);

          return (
            <Pressable
              key={key}
              onPress={() => onPickDay(dayNum)}
              style={[
                styles.dayCell,
                {
                  borderColor: borderMuted,
                  backgroundColor: sel ? ActionAccentHex : 'transparent',
                },
                isToday && !sel ? { borderColor: ActionAccentHex, backgroundColor: ActionAccentWash } : null,
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
              {hasStar ? (
                <MaterialIcons
                  name="star"
                  size={14}
                  color={sel ? '#fff' : ActionAccentHex}
                  style={styles.starMarker}
                />
              ) : hasDot ? (
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: sel ? '#fff' : dotFill },
                  ]}
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
              <Pressable key={m.id} onPress={() => onMatchPress(m)}>
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
  starMarker: { marginTop: 1 },
  dotPlaceholder: { height: 5, marginTop: 2 },
  listHeading: { marginTop: 4 },
  empty: { opacity: 0.85, fontStyle: 'italic' },
  list: { gap: 10 },
});
