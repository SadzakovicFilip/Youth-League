import DateTimePicker from '@react-native-community/datetimepicker';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { ActionAccentHex } from '@/constants/theme';

function parseYyyyMmDd(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function formatDateSr(d: Date): string {
  return d.toLocaleDateString('sr-Latn', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export type LicenseValidUntilFieldProps = {
  value: string;
  onChange: (yyyyMmDd: string) => void;
  placeholder?: string;
  /** Npr. `marginTop` oko polja — primenjuje se na omotač (web i native). */
  style?: StyleProp<ViewStyle>;
};

/** Na webu običan unos GGGG-MM-DD; na iOS/Android pritisak otvara kalendar. */
export function LicenseValidUntilField({
  value,
  onChange,
  placeholder = 'Vazi do (YYYY-MM-DD)',
  style,
}: LicenseValidUntilFieldProps) {
  const { colors, colorScheme } = useAppTheme();
  const isWeb = Platform.OS === 'web';
  const isAndroid = Platform.OS === 'android';
  const useSheetPickers = !isWeb && !isAndroid;

  const [draft, setDraft] = useState(() => new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);

  const parsed = useMemo(() => parseYyyyMmDd(value), [value]);

  const openPicker = useCallback(() => {
    setDraft(parsed ? new Date(parsed) : new Date());
    if (isAndroid) setAndroidOpen(true);
    else setModalVisible(true);
  }, [isAndroid, parsed]);

  const fakeInputStyle = useMemo(
    () => [
      {
        minHeight: 44,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: colors.inputBackground,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        justifyContent: 'center' as const,
      },
      style,
    ],
    [colors.inputBackground, colors.inputBorder, style],
  );

  if (isWeb) {
    return (
      <View style={style}>
        <ThemedTextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={openPicker}
        style={fakeInputStyle}
        accessibilityRole="button"
        accessibilityLabel={placeholder}>
        <ThemedText style={{ color: parsed ? colors.text : colors.textMuted }} numberOfLines={1}>
          {parsed ? `${toYyyyMmDd(parsed)} · ${formatDateSr(parsed)}` : placeholder}
        </ThemedText>
      </Pressable>

      {useSheetPickers ? (
        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, styles.dimmedBackdrop]}
              onPress={() => setModalVisible(false)}
              accessibilityLabel="Zatvori"
              accessibilityRole="button"
            />
            <View style={styles.sheetWrap} pointerEvents="box-none">
              <ThemedView
                style={[
                  styles.modalSheet,
                  { backgroundColor: colors.surface, borderTopColor: colors.borderStrong },
                ]}>
                <ThemedText type="subtitle" style={{ color: colors.text }}>
                  Važi do (licenca)
                </ThemedText>
                <DateTimePicker
                  value={draft}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  {...(Platform.OS === 'ios'
                    ? {
                        themeVariant: colorScheme === 'dark' ? ('dark' as const) : ('light' as const),
                      }
                    : {})}
                  onChange={(_, d) => {
                    if (d) setDraft(d);
                  }}
                />
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setModalVisible(false)}
                    style={[styles.modalBtn, { backgroundColor: colors.surfaceMuted }]}>
                    <ThemedText style={{ color: colors.text, fontWeight: '600' }}>Odustani</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      onChange(toYyyyMmDd(draft));
                      setModalVisible(false);
                    }}
                    style={[styles.modalBtn, { backgroundColor: ActionAccentHex }]}>
                    <ThemedText style={styles.modalBtnText}>Potvrdi</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            </View>
          </View>
        </Modal>
      ) : null}

      {isAndroid && androidOpen ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setAndroidOpen(false);
            if (event.type === 'set' && date) {
              onChange(toYyyyMmDd(date));
            }
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  dimmedBackdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
    maxHeight: '88%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '700' },
});
