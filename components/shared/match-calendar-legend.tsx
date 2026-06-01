import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import {
  CALENDAR_LIVE_BLUE,
  getMatchCalendarStatusColors,
} from '@/lib/match-calendar-markers';

type LegendItemDef = {
  key: string;
  label: string;
  icon: ReactNode;
};

function LegendItem({ label, icon, textColor }: { label: string; icon: ReactNode; textColor: string }) {
  return (
    <View style={styles.item}>
      <View style={styles.iconSlot}>{icon}</View>
      <ThemedText numberOfLines={2} style={[styles.label, { color: textColor }]}>
        {label}
      </ThemedText>
    </View>
  );
}

export function MatchCalendarLegend() {
  const { colors, colorScheme } = useAppTheme();
  const muted = colors.textSecondary;
  const statusColors = useMemo(
    () => getMatchCalendarStatusColors(colorScheme),
    [colorScheme],
  );

  const items: LegendItemDef[] = [
    {
      key: 'zakazana',
      label: 'Zakazana',
      icon: <View style={[styles.dot, { backgroundColor: statusColors.zakazana }]} />,
    },
    {
      key: 'iscekivanje',
      label: 'Iščekivanje',
      icon: (
        <MaterialIcons name="notifications" size={14} color={statusColors.iscekivanje} />
      ),
    },
    {
      key: 'nema_uslova',
      label: 'Nema uslova',
      icon: <MaterialIcons name="star" size={14} color={statusColors.nemaUslova} />,
    },
    {
      key: 'uzivo',
      label: 'Uživo',
      icon: (
        <View style={[styles.liveRing, { borderColor: CALENDAR_LIVE_BLUE }]}>
          <View style={[styles.liveDot, { backgroundColor: CALENDAR_LIVE_BLUE }]} />
        </View>
      ),
    },
    {
      key: 'neodigrana',
      label: 'Neodigrana',
      icon: <ThemedText style={[styles.xMark, { color: muted }]}>×</ThemedText>,
    },
    {
      key: 'zavrsena',
      label: 'Završena',
      icon: <MaterialIcons name="check" size={14} color="#2a9d4a" />,
    },
    {
      key: 'prigovor_resen',
      label: 'Prigovor rešen',
      icon: <MaterialIcons name="check" size={14} color="#c9a227" />,
    },
    {
      key: 'prigovor_aktivan',
      label: 'Aktivan prigovor',
      icon: <ThemedText style={[styles.bang, { color: '#c53939' }]}>!</ThemedText>,
    },
  ];

  const rows: LegendItemDef[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  return (
    <ThemedView style={styles.wrap}>
      {rows.map((pair, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {pair.map((item) => (
            <LegendItem key={item.key} label={item.label} icon={item.icon} textColor={muted} />
          ))}
        </View>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
  },
  iconSlot: {
    width: 18,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, opacity: 0.9, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  liveRing: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  xMark: { fontSize: 16, fontWeight: '800', lineHeight: 16, marginTop: -1 },
  bang: { fontWeight: '800', fontSize: 15, lineHeight: 16 },
});
