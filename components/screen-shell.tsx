import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
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
  /**
   * Kada je true, deca se renderuju bez `KeyboardAvoidingView` (npr. hub sa `ScrollView` +
   * `automaticallyAdjustKeyboardInsets` da se ne duplira pomeranje tastature).
   */
  disableKeyboardAvoiding?: boolean;
};

export function ScreenShell({
  children,
  style,
  contentContainerStyle,
  edges = ['left', 'right'],
  keyboardVerticalOffset = 0,
  disableKeyboardAvoiding = false,
}: ScreenShellProps) {
  const backgroundColor = useThemeColor({}, 'background');

  if (disableKeyboardAvoiding) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor }, style]} edges={edges}>
        <View style={[styles.kav, contentContainerStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }, style]} edges={edges}>
      <KeyboardAvoidingView
        style={[styles.kav, contentContainerStyle]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
