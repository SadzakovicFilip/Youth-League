import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActionAccentHex } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import { monthTitleSr } from '@/lib/match-calendar-utils';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';
import type { IgracAttendanceRow } from '@/lib/igrac-dashboard-types';

import { IgracScreenState } from './igrac-screen-state';

type Props = {
  embedded?: boolean;
};

type MonthKey = {
  year: number;
  month: number;
};

function monthFromIso(iso: string): MonthKey | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() };
}

function sameMonth(a: MonthKey, b: MonthKey) {
  return a.year === b.year && a.month === b.month;
}

function formatTrainingDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('sr-Latn', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function attendanceStatusLabel(row: IgracAttendanceRow): string {
  if (row.present) return 'Prisustvovao';
  if (row.marked) return 'Odsutan';
  return 'Nije zavedeno';
}

function AttendanceCard({ row }: { row: IgracAttendanceRow }) {
  const { colors } = useAppTheme();
  const statusLabel = attendanceStatusLabel(row);
  const statusColor = row.present
    ? ActionAccentHex
    : row.marked
      ? colors.textMuted
      : colors.textSecondary;

  return (
    <ThemedView style={[styles.card, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <ThemedText type="defaultSemiBold" style={[styles.rowLeft, { color: colors.text }]} numberOfLines={1}>
          {row.topic}
        </ThemedText>
        <ThemedText style={[styles.rowRight, { color: colors.textSecondary }]} numberOfLines={1}>
          {formatTrainingDate(row.scheduled_at)}
        </ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText style={[styles.rowLeft, { color: colors.textSecondary }]} numberOfLines={1}>
          {row.venue?.trim() ? row.venue : '—'}
        </ThemedText>
        <ThemedText
          style={[
            styles.rowRight,
            styles.statusText,
            row.present && styles.statusPresent,
            { color: statusColor },
          ]}
          numberOfLines={1}>
          {statusLabel}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

export function IgracPrisustvoContent({ embedded = false }: Props) {
  const { colors } = useAppTheme();
  const { loading, errorMessage, data } = useIgracDashboard();
  const rows = data?.trainings ?? [];
  const [selectedMonth, setSelectedMonth] = useState<MonthKey | null>(null);

  const availableMonths = useMemo(() => {
    const map = new Map<string, MonthKey>();
    for (const r of rows) {
      const mk = monthFromIso(r.scheduled_at);
      if (!mk) continue;
      map.set(`${mk.year}-${mk.month}`, mk);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [rows]);

  useEffect(() => {
    if (availableMonths.length === 0) {
      setSelectedMonth(null);
      return;
    }
    setSelectedMonth((prev) => {
      if (prev && availableMonths.some((m) => sameMonth(m, prev))) return prev;
      const now = new Date();
      const current: MonthKey = { year: now.getFullYear(), month: now.getMonth() };
      return availableMonths.find((m) => sameMonth(m, current)) ?? availableMonths[0];
    });
  }, [availableMonths]);

  const filteredRows = useMemo(() => {
    if (!selectedMonth) return rows;
    return rows.filter((r) => {
      const mk = monthFromIso(r.scheduled_at);
      return mk && sameMonth(mk, selectedMonth);
    });
  }, [rows, selectedMonth]);

  const summary = useMemo(() => {
    const total = filteredRows.length;
    const present = filteredRows.filter((r) => r.present).length;
    return { present, total };
  }, [filteredRows]);

  const selectedIndex = selectedMonth
    ? availableMonths.findIndex((m) => sameMonth(m, selectedMonth))
    : -1;
  const canGoNewer = selectedIndex > 0;
  const canGoOlder = selectedIndex >= 0 && selectedIndex < availableMonths.length - 1;

  const monthLabel =
    selectedMonth != null ? monthTitleSr(selectedMonth.year, selectedMonth.month) : '';

  return (
    <>
      {!embedded ? (
        <ThemedText type="subtitle" style={{ color: colors.text }}>
          Prisustvo treninzima
        </ThemedText>
      ) : null}

      {!loading && !errorMessage && availableMonths.length > 0 && selectedMonth ? (
        <ThemedView style={[styles.monthRow, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
          <Pressable
            onPress={() => {
              if (!canGoOlder) return;
              setSelectedMonth(availableMonths[selectedIndex + 1]);
            }}
            disabled={!canGoOlder}
            style={[styles.monthArrow, !canGoOlder && styles.monthArrowDisabled]}
            accessibilityLabel="Prethodni mesec">
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={canGoOlder ? colors.tint : colors.textMuted}
            />
          </Pressable>
          <ThemedText type="defaultSemiBold" style={[styles.monthTitle, { color: colors.text }]}>
            {monthLabel}
          </ThemedText>
          <Pressable
            onPress={() => {
              if (!canGoNewer) return;
              setSelectedMonth(availableMonths[selectedIndex - 1]);
            }}
            disabled={!canGoNewer}
            style={[styles.monthArrow, !canGoNewer && styles.monthArrowDisabled]}
            accessibilityLabel="Sledeći mesec">
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={canGoNewer ? colors.tint : colors.textMuted}
            />
          </Pressable>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage && filteredRows.length > 0 ? (
        <ThemedView style={[styles.summaryCard, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted }]}>
          <ThemedText type="defaultSemiBold" style={{ color: colors.text, fontSize: 22, textAlign: 'center' }}>
            {summary.present}/{summary.total}
          </ThemedText>
          <ThemedText style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 12 }}>
            prisustva u {monthLabel || 'izabranom mesecu'}
          </ThemedText>
        </ThemedView>
      ) : null}

      <IgracScreenState loading={loading} errorMessage={errorMessage} />

      {!loading && !errorMessage ? (
        rows.length === 0 ? (
          <ThemedView style={[styles.empty, { borderColor: colors.borderStrong }]}>
            <ThemedText style={{ color: colors.textSecondary }}>Nema zakazanih treninga.</ThemedText>
          </ThemedView>
        ) : filteredRows.length === 0 ? (
          <ThemedView style={[styles.empty, { borderColor: colors.borderStrong }]}>
            <ThemedText style={{ color: colors.textSecondary }}>
              Nema treninga u {monthLabel}.
            </ThemedText>
          </ThemedView>
        ) : (
          filteredRows.map((row) => <AttendanceCard key={row.id} row={row} />)
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  monthArrow: { padding: 4 },
  monthArrowDisabled: { opacity: 0.35 },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
    textTransform: 'capitalize',
    fontSize: 15,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
  },
  rowRight: {
    flexShrink: 0,
    maxWidth: '48%',
    fontSize: 12,
    textAlign: 'right',
  },
  statusText: {
    fontWeight: '700',
    fontSize: 12,
  },
  statusPresent: {
    color: ActionAccentHex,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
});
