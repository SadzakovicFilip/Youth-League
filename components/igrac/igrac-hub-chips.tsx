import { ActionAccentHex } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import { triggerPressInFeedback, type AppFeedbackKind } from '@/lib/app-feedback';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type ChipOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: ChipOption<T>[];
  onChange: (value: T) => void;
  pressFeedback?: AppFeedbackKind;
};

export function IgracHubChips<T extends string>({
  value,
  options,
  onChange,
  pressFeedback,
}: Props<T>) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[
              styles.chipFilled,
              {
                backgroundColor: active ? ActionAccentHex : colors.surfaceMuted,
                borderColor: active ? ActionAccentHex : colors.borderStrong,
              },
            ]}
            onPressIn={() => {
              if (pressFeedback) triggerPressInFeedback(pressFeedback);
            }}
            onPress={() => onChange(opt.value)}>
            <ThemedText
              type="defaultSemiBold"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{
                color: active ? '#fff' : colors.text,
                fontSize: 11,
                letterSpacing: 0.15,
                textAlign: 'center',
              }}>
              {opt.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
  },
  chipFilled: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});
