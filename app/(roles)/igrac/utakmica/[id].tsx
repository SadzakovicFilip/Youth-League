import { MatchScorebookDetailView } from '@/components/match-scorebook-detail-view';
import { ScreenShell } from '@/components/screen-shell';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function IgracUtakmicaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);

  return (
    <ScreenShell>
      <View style={styles.fill}>
        <MatchScorebookDetailView matchId={matchId} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
