import { FinishedMatchPreferScorebook } from '@/components/shared/finished-match-prefer-scorebook';
import { ThemedText } from '@/components/themed-text';
import { ScreenShell } from '@/components/screen-shell';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

export default function MatchDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);

  return (
    <ScreenShell>
      <View style={styles.wrapper}>
        <View style={styles.body}>
          <FinishedMatchPreferScorebook
            matchId={matchId}
            publicTopSlot={
              <Pressable style={styles.back} onPress={() => router.back()}>
                <ThemedText style={styles.backText}>← Nazad</ThemedText>
              </Pressable>
            }
          />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  body: { flex: 1 },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backText: { fontWeight: '600' },
});
