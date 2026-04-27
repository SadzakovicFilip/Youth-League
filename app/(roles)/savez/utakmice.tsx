import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function UtakmiceScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Utakmice</ThemedText>
      <ThemedText>
        Ovde zakazujes nove utakmice. Za pregled zakazanih utakmica otvori
        {' '}
        <ThemedText type="defaultSemiBold">Takmicenje → Regija → Liga → Grupa</ThemedText>.
      </ThemedText>

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/savez/dodaj-utakmicu')}>
        <ThemedText style={styles.primaryButtonText}>+ Zakazi novu utakmicu</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 24 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
