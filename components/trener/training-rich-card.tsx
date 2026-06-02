import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatMatchDateDdMmYyyy,
  type MatchRichTheme,
} from '@/components/shared/match-rich-card';
import { ThemedText } from '@/components/themed-text';

export type TrainingRichCardProps = {
  theme: MatchRichTheme;
  /** Leva traka (podrazumevano theme.tint). Za trening: plava teget. */
  stripeColor?: string;
  topic: string;
  scheduledIso: string;
  venue: string | null;
  note: string | null;
  playersPresent: number;
  playersTotal: number;
  onPress?: () => void;
  onDelete?: () => void;
};

function formatTimeSr(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('sr-Latn', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function TrainingRichCard({
  theme,
  stripeColor,
  topic,
  scheduledIso,
  venue,
  note,
  playersPresent,
  playersTotal,
  onPress,
  onDelete,
}: TrainingRichCardProps) {
  const stripe = stripeColor ?? theme.tint;
  const dateStr = formatMatchDateDdMmYyyy(scheduledIso);
  const timeStr = formatTimeSr(scheduledIso);
  const [shellH, setShellH] = useState(96);
  /** Jedno slovo „T“ kao watermark. */
  const watermarkSize = useMemo(
    () => Math.round(Math.max(56, Math.min(140, shellH * 0.85))),
    [shellH],
  );

  const shellBordered = !onDelete;

  const shell = (
    <View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - shellH) > 1) setShellH(h);
      }}
      style={[
        styles.shell,
        shellBordered && styles.shellBordered,
        !shellBordered && styles.shellInUnified,
        shellBordered && { borderColor: theme.borderStrong, backgroundColor: theme.surfaceMuted },
        !shellBordered && { backgroundColor: theme.surfaceMuted },
      ]}>
      <View pointerEvents="none" style={styles.watermarkWrap}>
        <Text
          allowFontScaling={false}
          style={[
            styles.watermarkLetter,
            { fontSize: watermarkSize, color: stripe, opacity: 0.18 },
          ]}>
          ⚡
        </Text>
      </View>

      <View style={styles.rowOuter}>
        <View style={[styles.stripe, { backgroundColor: stripe }]} />
        <View style={styles.body}>
          <View style={styles.rowBetween}>
            <View style={styles.titleWrap}>
              <MaterialIcons name="bolt" size={18} color={theme.tint} />
              <ThemedText
                type="defaultSemiBold"
                numberOfLines={2}
                style={[styles.topicTitle, { color: theme.text }]}>
                {topic.trim() || 'Trening'}
              </ThemedText>
            </View>
            <ThemedText style={[styles.dateTxt, { color: theme.textSecondary }]}>
              {dateStr}
            </ThemedText>
          </View>

          <View style={[styles.rowBetween, styles.rowTight]}>
            <View style={styles.dresRow}>
              <MaterialIcons name="schedule" size={16} color={theme.textMuted} />
              <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>Vreme</ThemedText>
              <ThemedText style={[styles.valSm, { color: theme.text }]}>{timeStr}</ThemedText>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <View style={styles.dresRow}>
              <MaterialIcons name="groups" size={16} color={theme.tint} />
              <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>Prisustvo</ThemedText>
              <ThemedText style={[styles.valSm, { color: theme.tint }]}>
                {playersPresent}/{playersTotal}
              </ThemedText>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <View style={styles.dresRow}>
              <MaterialIcons name="place" size={16} color={theme.textMuted} />
              <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>Mesto</ThemedText>
              <ThemedText numberOfLines={2} style={[styles.valSm, { color: theme.text, flex: 1 }]}>
                {venue?.trim() ? venue.trim() : '—'}
              </ThemedText>
            </View>
          </View>

          {note?.trim() ? (
            <ThemedText
              numberOfLines={3}
              style={[styles.noteLine, { color: theme.textSecondary }]}>
              {note.trim()}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );

  const main = onPress ? (
    <Pressable
      onPress={onPress}
      style={styles.pressFlex}
      accessibilityRole="button"
      android_ripple={{ color: 'rgba(0,0,0,0.08)' }}>
      {shell}
    </Pressable>
  ) : (
    <View style={styles.pressFlex}>{shell}</View>
  );

  if (!onDelete) return <View style={styles.pressWrap}>{main}</View>;

  return (
    <View
      style={[
        styles.pressWrap,
        styles.unifiedCard,
        { borderColor: theme.borderStrong, backgroundColor: theme.surfaceMuted },
      ]}>
      {main}
      <Pressable
        onPress={onDelete}
        style={[styles.deleteStrip, { borderLeftColor: theme.danger }]}
        accessibilityLabel="Obriši trening"
        accessibilityRole="button">
        <MaterialIcons name="delete-outline" size={24} color={theme.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressWrap: { marginBottom: 2 },
  unifiedCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressFlex: { flex: 1, minWidth: 0 },
  shell: {
    overflow: 'hidden',
    position: 'relative',
    minHeight: 96,
  },
  shellBordered: {
    borderRadius: 12,
    borderWidth: 1,
  },
  /** U sklopu unifiedCard — bez sopstvenog obruba (spoljašnji okvir i zaobljenje). */
  shellInUnified: {
    borderRadius: 0,
    borderWidth: 0,
  },
  watermarkWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  watermarkLetter: {
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
  rowOuter: {
    flexDirection: 'row',
    position: 'relative',
    zIndex: 1,
  },
  stripe: { width: 5, alignSelf: 'stretch' },
  body: { flex: 1, padding: 12, gap: 8, zIndex: 1 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowTight: { marginTop: -2 },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  topicTitle: { flex: 1, fontSize: 15, lineHeight: 20 },
  dateTxt: { fontSize: 13, fontWeight: '700' },
  dresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  lbl: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  valSm: { fontSize: 14, fontWeight: '600' },
  noteLine: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  deleteStrip: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    minWidth: 52,
    alignSelf: 'stretch',
  },
});
