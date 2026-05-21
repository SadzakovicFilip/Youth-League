import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionAccentHex } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';

type AccordionProps = {
  title: string;
  count: number;
  listExpanded: boolean;
  onToggleList: () => void;
  /** Kada je false, sakriveno je dugme „Dodaj“ i forma (samo expand liste). */
  showFormButton?: boolean;
  formOpen: boolean;
  onToggleForm: () => void;
  addLabel: string;
  closeFormLabel: string;
  form: ReactNode;
  children: ReactNode;
};

/** Zatvoren: naslov + broj + expand; dugme otvara formu ispod; expand prikazuje listu. */
export function SavezLeagueAccordionSection({
  title,
  count,
  listExpanded,
  onToggleList,
  showFormButton = true,
  formOpen,
  onToggleForm,
  addLabel,
  closeFormLabel,
  form,
  children,
}: AccordionProps) {
  const { colors } = useAppTheme();
  return (
    <ThemedView style={[styles.shell, { borderColor: colors.borderStrong }]}>
      <View style={[styles.headerRow, !showFormButton && styles.headerRowSingle]}>
        <Pressable
          style={styles.expandHit}
          onPress={onToggleList}
          accessibilityRole="button"
          accessibilityState={{ expanded: listExpanded }}>
          <ThemedText style={[styles.chevron, { color: colors.textMuted }]}>{listExpanded ? '▼' : '▶'}</ThemedText>
          <View style={styles.titleBlock}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </ThemedText>
            <ThemedText style={[styles.sectionCount, { color: colors.textMuted }]} numberOfLines={1}>
              ({count})
            </ThemedText>
          </View>
        </Pressable>
        {showFormButton ? (
          <Pressable style={styles.headerFilledButton} onPress={onToggleForm} hitSlop={6}>
            <ThemedText
              style={styles.headerFilledButtonText}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              maxFontSizeMultiplier={1.25}>
              {formOpen ? closeFormLabel : addLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {showFormButton && formOpen ? <View style={styles.formSlot}>{form}</View> : null}
      {listExpanded ? <View style={styles.listSlot}>{children}</View> : null}
    </ThemedView>
  );
}

type TakmicenjeEntryProps = {
  onPress: () => void;
};

/** Istaknuta kartica u boji akcenta — vodi na ekran takmičenja. */
export function SavezLeagueTakmicenjeEntry({ onPress }: TakmicenjeEntryProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Takmičenje"
      style={({ pressed }) => [styles.takmicenjeCard, { backgroundColor: ActionAccentHex }, pressed && styles.takmicenjePressed]}>
      <ThemedText lightColor="#FFFFFF" darkColor="#FFFFFF" style={styles.takmicenjeTitle}>
        Takmičenje
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerRowSingle: {
    gap: 0,
  },
  expandHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
    gap: 6,
    minWidth: 0,
  },
  chevron: {
    fontSize: 11,
    width: 18,
    textAlign: 'center',
    fontWeight: '800',
    opacity: 0.88,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 22,
    flexShrink: 1,
  },
  sectionCount: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  headerFilledButton: {
    flexShrink: 0,
    height: 36,
    minWidth: 76,
    maxWidth: 100,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: ActionAccentHex,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFilledButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 0.12,
    textAlign: 'center',
    width: '100%',
  },
  formSlot: { paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  listSlot: { paddingHorizontal: 0 },
  takmicenjeCard: {
    marginTop: 22,
    marginBottom: 6,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  takmicenjePressed: { opacity: 0.92, transform: [{ scale: 0.992 }] },
  takmicenjeTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
