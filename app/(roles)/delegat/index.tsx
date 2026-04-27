import { Link, router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

export default function DelegatHomeScreen() {
  const onLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Logout greska', error.message);
      return;
    }
    router.replace('/login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Delegat Dashboard</ThemedText>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </Pressable>
      </ThemedView>
      <ThemedText>Provera dokumentacije, licenci i validacija administrativnih unosa.</ThemedText>

      <Pressable style={styles.primaryButton} onPress={() => router.push('/delegat/lige')}>
        <ThemedText style={styles.primaryButtonText}>Moje lige</ThemedText>
      </Pressable>

      <Link href="/home" style={styles.link}>
        Otvori shared home
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: { color: '#c53939', fontWeight: '600' },
  link: { textDecorationLine: 'underline', fontSize: 16 },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
