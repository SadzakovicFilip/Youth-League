import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemeProfileToggle } from '@/components/theme-profile-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function DelegatProfilScreen() {
  const border = useThemeColor({}, 'border');
  const accent = useThemeColor({}, 'accent');

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable style={[styles.back, { borderColor: border }]} onPress={() => router.back()}>
          <ThemedText type="defaultSemiBold">← Nazad</ThemedText>
        </Pressable>
        <ThemedText type="title">Profil i podesavanja</ThemedText>
        <ThemedText style={styles.muted}>Delegat — tema vazi za celu aplikaciju na ovom uredjaju.</ThemedText>

        <ThemeProfileToggle />

        <ThemedView style={[styles.hint, { borderColor: border }]}>
          <ThemedText type="defaultSemiBold" style={{ color: accent }}>
            Saveti
          </ThemedText>
          <ThemedText style={styles.muted}>
            Prigovore na zapisnik obradjujes na ekranu pojedinacne utakmice nakon sto se zavrsi mec.
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, padding: 16, paddingBottom: 32 },
  back: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  muted: { opacity: 0.8, fontSize: 14 },
  hint: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6, marginTop: 8 },
});
