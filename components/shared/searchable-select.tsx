import { useMemo, useState } from 'react';
import { ActionAccentHex, ActionAccentWash } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import { FlatList, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';

export type SelectOption = {
  value: string;
  label: string;
  sublabel?: string;
  /** Nije birajući (npr. istekla licenca) — prikaz crvenim, onPress onemogućen. */
  ineligible?: boolean;
};

export type SearchableSelectProps = {
  label?: string;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string | null) => void;
  disabledValues?: string[];
  clearable?: boolean;
  /** Naslov u modalu (ako nije prosleđen, koristi se `label`, pa „Izbor“). */
  sheetTitle?: string;
  /** Spoljašnji stil omotača (npr. flex: 1 u redu sa dresom). */
  containerStyle?: StyleProp<ViewStyle>;
};

export function SearchableSelect({
  label,
  placeholder = 'Izaberi...',
  value,
  options,
  onChange,
  disabledValues,
  clearable = true,
  containerStyle,
  sheetTitle,
}: SearchableSelectProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      return (
        o.label.toLowerCase().includes(q) ||
        (o.sublabel ? o.sublabel.toLowerCase().includes(q) : false)
      );
    });
  }, [options, query]);

  const disabledSet = useMemo(() => new Set(disabledValues ?? []), [disabledValues]);

  const closeModal = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <ThemedText style={[styles.label, { color: colors.textSecondary }]}>{label}</ThemedText>
      ) : null}

      <Pressable
        style={[
          styles.trigger,
          { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
        ]}
        onPress={() => setOpen(true)}>
        <ThemedText
          numberOfLines={1}
          style={[
            styles.triggerLine,
            { color: selected ? colors.text : colors.textMuted },
          ]}>
          {selected ? selected.label : placeholder}
        </ThemedText>
        {clearable && selected ? (
          <Pressable
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              onChange(null);
            }}>
            <ThemedText style={[styles.clearX, { color: colors.danger }]}>×</ThemedText>
          </Pressable>
        ) : (
          <ThemedText style={[styles.chevron, { color: colors.textSecondary }]}>▾</ThemedText>
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, styles.dimmedBackdrop]}
            onPress={closeModal}
            accessibilityLabel="Zatvori listu"
            accessibilityRole="button"
          />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <ThemedView style={[styles.modalCard, { backgroundColor: colors.surface, borderTopColor: colors.borderStrong }]}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ color: colors.text }}>
                {sheetTitle ?? label ?? 'Izbor'}
              </ThemedText>
              <Pressable onPress={closeModal}>
                <ThemedText style={[styles.close, { color: ActionAccentHex }]}>Zatvori</ThemedText>
              </Pressable>
            </ThemedView>

            <ThemedTextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Pretraga..."
              autoCapitalize="none"
              style={[
                styles.search,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
            />

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Nema rezultata.</ThemedText>
              }
              renderItem={({ item }) => {
                const takenElsewhere = disabledSet.has(item.value) && item.value !== value;
                const isDisabled = takenElsewhere || !!item.ineligible;
                const isSelected = item.value === value;
                return (
                  <Pressable
                    disabled={isDisabled}
                    onPress={() => {
                      onChange(item.value);
                      closeModal();
                    }}
                    style={[
                      styles.item,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                      },
                      isSelected && {
                        borderColor: ActionAccentHex,
                        backgroundColor: ActionAccentWash,
                      },
                      takenElsewhere && !item.ineligible && styles.itemDisabled,
                      item.ineligible && {
                        borderColor: colors.danger,
                        backgroundColor: colors.surface,
                      },
                    ]}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={{
                        color: item.ineligible ? colors.danger : colors.text,
                      }}>
                      {item.label}
                    </ThemedText>
                    {item.sublabel ? (
                      <ThemedText
                        style={[
                          styles.sublabel,
                          {
                            color: item.ineligible ? colors.danger : colors.textSecondary,
                          },
                        ]}>
                        {item.sublabel}
                      </ThemedText>
                    ) : null}
                    {takenElsewhere && !item.ineligible ? (
                      <ThemedText style={[styles.badge, { color: colors.textMuted }]}>
                        već izabran za drugi broj
                      </ThemedText>
                    ) : null}
                    {item.ineligible ? (
                      <ThemedText style={[styles.badge, { color: colors.danger, fontWeight: '700' }]}>
                        Nije birajući — licenca
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              }}
            />
            </ThemedView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4, flex: 1 },
  label: { fontSize: 12, fontWeight: '600' },
  trigger: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerLine: { flex: 1, marginRight: 6, fontSize: 15 },
  chevron: { fontSize: 14 },
  clearX: { fontSize: 22, lineHeight: 22, paddingHorizontal: 4 },
  modalRoot: { flex: 1 },
  dimmedBackdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '85%',
    padding: 14,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  close: { fontWeight: '600' },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  item: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    gap: 4,
  },
  itemDisabled: { opacity: 0.45 },
  sublabel: { fontSize: 13 },
  badge: { fontSize: 11, fontStyle: 'italic' },
  empty: { textAlign: 'center', padding: 20, fontSize: 15 },
});
