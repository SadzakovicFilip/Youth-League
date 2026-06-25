import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';

type ListBlockProps = {
  /** Kratak tekst unutar tabele iznad redova (npr. „Klik na red …"). */
  hint?: string;
  /** Kada nema redova i nije učitavanje. */
  emptyLabel?: string;
  loading?: boolean;
  /** Kada je true, prikazuje se `emptyLabel` umesto `children`. */
  isEmpty: boolean;
  children: ReactNode;
  /** Bez spoljašnjeg okvira — ugnježđeno u accordion ili drugi okvir. */
  embedded?: boolean;
};

/**
 * Jedna ivica oko cele liste; redovi numerisani, bez posebnog box-a po stavci.
 */
export function SavezNumberedListBlock({
  hint,
  emptyLabel,
  loading,
  isEmpty,
  children,
  embedded,
}: ListBlockProps) {
  const { colors } = useAppTheme();
  const showEmpty = !loading && isEmpty && emptyLabel;

  return (
    <ThemedView
      style={[
        styles.block,
        { borderColor: colors.borderStrong },
        embedded && {
          borderWidth: 0,
          borderRadius: 0,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
      ]}>
      {hint ? (
        <ThemedText style={[styles.hint, { color: colors.textMuted }]} accessibilityHint={hint}>
          {hint}
        </ThemedText>
      ) : null}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator />
        </View>
      ) : null}
      {showEmpty ? (
        <ThemedText style={[styles.empty, { color: colors.textMuted }]}>{emptyLabel}</ThemedText>
      ) : !loading ? (
        <View style={styles.rows}>{children}</View>
      ) : null}
    </ThemedView>
  );
}

type RowProps = {
  index: number;
  onPress?: () => void;
  children: ReactNode;
};

export function SavezNumberedListRow({ index, onPress, children }: RowProps) {
  const { colors } = useAppTheme();
  const rowInner = (
    <>
      <ThemedText style={[styles.num, { color: colors.textMuted }]}>{index + 1}.</ThemedText>
      <View style={styles.rowMain}>{children}</View>
      {onPress ? (
        <ThemedText style={[styles.chevron, { color: colors.textMuted }]} accessibilityElementsHidden>
          ▸
        </ThemedText>
      ) : (
        <View style={styles.chevronSpacer} />
      )}
    </>
  );

  const borderTop =
    index > 0
      ? {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        }
      : undefined;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, borderTop, pressed && styles.rowPressed]}>
        {rowInner}
      </Pressable>
    );
  }

  return <View style={[styles.row, borderTop]}>{rowInner}</View>;
}

type ActionRowProps = {
  index: number;
  /** Glavni sadržaj (npr. `Pressable` sa imenom). */
  main: ReactNode;
  /** Desno: npr. ikonica X za uklanjanje (modal potvrde). */
  trailing: ReactNode;
};

/** Red sa brojem i custom glavnim delom + trailing akcijom (delegat / sudija). */
export function SavezNumberedListActionRow({ index, main, trailing }: ActionRowProps) {
  const { colors } = useAppTheme();
  const borderTop =
    index > 0
      ? {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        }
      : undefined;

  return (
    <View style={[styles.row, borderTop]}>
      <ThemedText style={[styles.num, { color: colors.textMuted }]}>{index + 1}.</ThemedText>
      <View style={styles.rowMain}>{main}</View>
      <View style={styles.trailingWrap}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  hint: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  loaderWrap: { paddingVertical: 12, alignItems: 'center' },
  empty: { fontSize: 14, paddingHorizontal: 10, paddingVertical: 12 },
  rows: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowPressed: { opacity: 0.88 },
  num: { width: 28, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  chevron: { fontSize: 16, width: 22, textAlign: 'center' },
  chevronSpacer: { width: 22 },
  trailingWrap: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
});
