import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export type SelectOption = {
  value: string;
  label: string;
  sublabel?: string;
};

export type SearchableSelectProps = {
  label?: string;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string | null) => void;
  disabledValues?: string[];
  clearable?: boolean;
};

export function SearchableSelect({
  label,
  placeholder = 'Izaberi...',
  value,
  options,
  onChange,
  disabledValues,
  clearable = true,
}: SearchableSelectProps) {
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

  return (
    <View style={styles.container}>
      {label ? <ThemedText style={styles.label}>{label}</ThemedText> : null}

      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <ThemedText numberOfLines={1} style={selected ? styles.triggerText : styles.triggerPlaceholder}>
          {selected ? selected.label : placeholder}
        </ThemedText>
        {clearable && selected ? (
          <Pressable
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              onChange(null);
            }}>
            <ThemedText style={styles.clearX}>×</ThemedText>
          </Pressable>
        ) : (
          <ThemedText style={styles.chevron}>▾</ThemedText>
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <ThemedView style={styles.modalCard}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="subtitle">{label ?? 'Izbor'}</ThemedText>
              <Pressable onPress={() => setOpen(false)}>
                <ThemedText style={styles.close}>Zatvori</ThemedText>
              </Pressable>
            </ThemedView>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Pretraga..."
              placeholderTextColor="#888"
              autoCapitalize="none"
              style={styles.search}
            />

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <ThemedText style={styles.empty}>Nema rezultata.</ThemedText>
              }
              renderItem={({ item }) => {
                const isDisabled = disabledSet.has(item.value) && item.value !== value;
                const isSelected = item.value === value;
                return (
                  <Pressable
                    disabled={isDisabled}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    style={[
                      styles.item,
                      isSelected && styles.itemSelected,
                      isDisabled && styles.itemDisabled,
                    ]}>
                    <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
                    {item.sublabel ? <ThemedText style={styles.sublabel}>{item.sublabel}</ThemedText> : null}
                    {isDisabled ? <ThemedText style={styles.badge}>vec izabran</ThemedText> : null}
                  </Pressable>
                );
              }}
            />
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4, flex: 1 },
  label: { fontSize: 12, opacity: 0.8 },
  trigger: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  triggerText: { color: '#111', flex: 1, marginRight: 6 },
  triggerPlaceholder: { color: '#888', flex: 1, marginRight: 6 },
  chevron: { color: '#666' },
  clearX: { color: '#c53939', fontSize: 22, lineHeight: 22, paddingHorizontal: 4 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    padding: 14,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  close: { color: '#0a7ea4', fontWeight: '600' },
  search: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#111',
    backgroundColor: '#fff',
  },
  item: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    backgroundColor: '#fff',
    gap: 2,
  },
  itemSelected: { borderColor: '#0a7ea4', backgroundColor: '#e7f4fb' },
  itemDisabled: { opacity: 0.5 },
  sublabel: { color: '#555', fontSize: 12 },
  badge: { color: '#999', fontSize: 11, fontStyle: 'italic' },
  empty: { textAlign: 'center', padding: 20, color: '#888' },
});
