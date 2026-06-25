import { Link } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';

export default function SpectatorHomeScreen() {
  useScreenPullRefresh(useCallback(() => Promise.resolve(), []));

  return (
    <ScreenShell>
      <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedText type="title">Spectator Dashboard</ThemedText>
        <ThemedText>Pregled rezultata, statistika i javnog sadrzaja.</ThemedText>
        <Link href="/home" style={styles.link}>
          Otvori shared home
        </Link>
      </RefreshableScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 10, padding: 16 },
  link: { textDecorationLine: 'underline', fontSize: 16 },
});
