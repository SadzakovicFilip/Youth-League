import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type ProfileRow = {
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
};

export default function KlubProfileScreen() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage('Nema aktivne sesije.');
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, first_name, last_name, birth_date, address, phone')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setProfile(data);
    };
    loadProfile();
  }, []);

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
      <ThemedText type="title">Klub profil</ThemedText>

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {profile ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">{profile.display_name ?? 'Bez imena'}</ThemedText>
          <ThemedText>Username: {profile.username ?? '-'}</ThemedText>
          <ThemedText>Ime: {profile.first_name ?? '-'}</ThemedText>
          <ThemedText>Prezime: {profile.last_name ?? '-'}</ThemedText>
          <ThemedText>Datum rodjenja: {profile.birth_date ?? '-'}</ThemedText>
          <ThemedText>Adresa: {profile.address ?? '-'}</ThemedText>
          <ThemedText>Telefon: {profile.phone ?? '-'}</ThemedText>
        </ThemedView>
      ) : null}

      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <ThemedText style={styles.logoutText}>Logout</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 12, gap: 6 },
  errorText: { color: '#c53939' },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logoutText: { color: '#c53939', fontWeight: '600' },
});
