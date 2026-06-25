import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionAccentHex } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';

export type BreadcrumbItem = {
  label: string;
  /** Relativna putanja (npr. `/savez`, `/savez/regija/1`). Poslednji crumb bez `path` = trenutna stranica. */
  path?: string;
};

type Props = {
  items: BreadcrumbItem[];
  /** Uski red + zadnji krug narandžasto sa podvlakom (drill header). */
  variant?: 'default' | 'drill';
};

export function SavezBreadcrumbs({ items, variant = 'default' }: Props) {
  const { colors } = useAppTheme();
  if (items.length === 0) return null;
  const drill = variant === 'drill';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, drill && styles.scrollContentDrill]}
      accessibilityRole="summary">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const canNavigate = Boolean(item.path) && index < items.length - 1;
        return (
          <View key={`${index}-${item.label}`} style={styles.segment}>
            {index > 0 ? (
              <ThemedText style={[styles.sep, { color: colors.textMuted }]} accessibilityElementsHidden>
                {' '}
                ›{' '}
              </ThemedText>
            ) : null}
            {canNavigate ? (
              <Pressable onPress={() => router.push(item.path as never)} hitSlop={6}>
                <ThemedText style={[styles.link, { color: colors.link }]} numberOfLines={1}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ) : (
              <ThemedText
                style={[
                  isLast ? (drill ? styles.currentDrill : styles.current) : styles.linkMuted,
                  !isLast && { color: colors.textSecondary },
                  isLast && !drill && { color: colors.text },
                  isLast && drill && { color: ActionAccentHex },
                ]}
                numberOfLines={1}>
                {item.label}
              </ThemedText>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 0,
  },
  scrollContentDrill: {
    paddingVertical: 2,
  },
  segment: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  sep: { fontSize: 12, fontWeight: '600' },
  link: { fontSize: 13, fontWeight: '600' },
  linkMuted: { fontSize: 13, fontWeight: '600' },
  current: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  currentDrill: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: ActionAccentHex,
  },
});
