import { Link } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';

export default function SpectatorHomeScreen() {
  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedText type="title">Spectator Dashboard</ThemedText>
        <ThemedText>Pregled rezultata, statistika i javnog sadrzaja.</ThemedText>
        <Link href="/home" style={styles.link}>
          Otvori shared home
        </Link>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 10, padding: 16 },
  link: { textDecorationLine: 'underline', fontSize: 16 },
});
