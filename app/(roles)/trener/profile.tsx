import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type ProfileData = Record<string, string | number | boolean | null>;

export default function TrenerProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setErrorMessage('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage('Nema aktivne sesije.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setProfile((data as ProfileData) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Profil trenera</ThemedText>

      <Pressable style={styles.button} onPress={loadProfile}>
        <ThemedText style={styles.buttonText}>Refresh</ThemedText>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onLogout}>
        <ThemedText style={styles.secondaryButtonText}>Logout</ThemedText>
      </Pressable>

      {loading ? (
        <ThemedView style={styles.card}>
          <ActivityIndicator />
        </ThemedView>
      ) : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">Licni podaci</ThemedText>
          <ThemedText>Username: {String(profile?.username ?? '-')}</ThemedText>
          <ThemedText>Display name: {String(profile?.display_name ?? '-')}</ThemedText>
          <ThemedText>First name: {String(profile?.first_name ?? '-')}</ThemedText>
          <ThemedText>Last name: {String(profile?.last_name ?? '-')}</ThemedText>
          <ThemedText>Birth date: {String(profile?.birth_date ?? '-')}</ThemedText>
          <ThemedText>Address: {String(profile?.address ?? '-')}</ThemedText>
          <ThemedText>Phone: {String(profile?.phone ?? '-')}</ThemedText>
        </ThemedView>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 16,
    paddingBottom: 24,
  },
  button: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  errorText: {
    color: '#c53939',
  },
});
