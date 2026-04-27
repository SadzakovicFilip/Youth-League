import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function DelegatHomeScreen() {
  const accent = useThemeColor({}, 'accent');

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.headerRow}>
          <ThemedText type="title">Delegat Dashboard</ThemedText>
        </ThemedView>
        <ThemedText>Provera dokumentacije, licenci i validacija administrativnih unosa.</ThemedText>

        <Pressable style={[styles.primaryButton, { backgroundColor: accent }]} onPress={() => router.push('/delegat/lige')}>
          <ThemedText style={styles.primaryButtonText}>Moje lige</ThemedText>
        </Pressable>

        <Pressable style={[styles.secondaryOutline, { borderColor: accent }]} onPress={() => router.push('/delegat/profil')}>
          <ThemedText style={[styles.secondaryOutlineText, { color: accent }]}>Profil i tema</ThemedText>
        </Pressable>

        <Link href="/home" style={styles.link}>
          Otvori shared home
        </Link>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: { textDecorationLine: 'underline', fontSize: 16 },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryOutline: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryOutlineText: { fontWeight: '700' },
});
