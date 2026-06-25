import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';

export type ConfirmRemoveIconButtonProps = {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  /** Podrazumevano „Ukloni”. */
  confirmLabel?: string;
  iconSize?: number;
  accessibilityLabel?: string;
};

/**
 * Ikona X — klik otvara modal sa potvrdom pre izvršavanja uklanjanja.
 */
export function ConfirmRemoveIconButton({
  title,
  message,
  onConfirm,
  confirmLabel = 'Ukloni',
  iconSize = 24,
  accessibilityLabel = 'Ukloni',
}: ConfirmRemoveIconButtonProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await Promise.resolve(onConfirm());
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }, [onConfirm]);

  return (
    <>
      <Pressable
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.iconHit}
        onPress={() => setOpen(true)}
        disabled={busy}>
        <Ionicons name="close" size={iconSize} color={colors.danger} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => !busy && setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => !busy && setOpen(false)} />
          <ThemedView
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            <ThemedText type="subtitle" style={{ color: colors.text }}>
              {title}
            </ThemedText>
            <ThemedText style={[styles.modalBody, { color: colors.textSecondary }]}>
              {message}
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setOpen(false)}
                disabled={busy}
                style={[styles.modalBtnSecondary, { borderColor: colors.border }]}>
                <ThemedText style={{ color: colors.text, fontWeight: '600' }}>Otkaži</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirm()}
                disabled={busy}
                style={[styles.modalBtnPrimary, { backgroundColor: colors.danger }]}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={{ color: '#fff', fontWeight: '600' }}>{confirmLabel}</ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconHit: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
    zIndex: 1,
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
