import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';

type ScreenShellProps = {
  children: ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  /**
   * Gornju ivicu ostavlja root `RootSafeAreaFrame` u `_layout.tsx` (edge-to-edge + svi stack ekrani).
   * Podrazumevano bez donje da tab bar ne duplira inset; za pun ekran (npr. login) prosledi `bottom`.
   */
  edges?: Edge[];
  keyboardVerticalOffset?: number;
};

export function ScreenShell({
  children,
  style,
  contentContainerStyle,
  edges = ['left', 'right'],
  keyboardVerticalOffset = 0,
}: ScreenShellProps) {
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }, style]} edges={edges}>
      <KeyboardAvoidingView
        style={[styles.kav, contentContainerStyle]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav: { flex: 1 },
});
