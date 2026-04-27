import { Link } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ScoutHomeScreen() {
  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedText type="title">Scout Dashboard</ThemedText>
        <ThemedText>Pregled igraca, performance podaci i skauting izvestaji.</ThemedText>
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
