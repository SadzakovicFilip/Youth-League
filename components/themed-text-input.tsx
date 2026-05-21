import { forwardRef, useMemo } from 'react';
import { TextInput, type TextInputProps, type TextStyle } from 'react-native';

import { useAppTheme } from '@/contexts/app-theme-context';

export type ThemedTextInputProps = TextInputProps;

/** Jedinstvena polja kao kod SearchableSelect triggera (`inputBackground` / `inputBorder`). */
export const ThemedTextInput = forwardRef<TextInput, ThemedTextInputProps>(function ThemedTextInput(
  { style, placeholderTextColor, ...rest },
  ref,
) {
  const { colors } = useAppTheme();
  const base = useMemo<TextStyle>(
    () => ({
      color: colors.text,
      backgroundColor: colors.inputBackground,
      borderColor: colors.inputBorder,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      fontSize: 16,
    }),
    [colors.text, colors.inputBackground, colors.inputBorder],
  );

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={placeholderTextColor ?? colors.textMuted}
      style={[base, style]}
      {...rest}
    />
  );
});
