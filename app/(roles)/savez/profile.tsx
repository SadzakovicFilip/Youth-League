import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemeProfileToggle } from '@/components/theme-profile-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';

type ProfileData = Record<string, string | number | boolean | null>;

export default function SavezProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');

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

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

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
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedText type="title">Profil saveza</ThemedText>

        <ThemeProfileToggle />

        <Pressable style={[styles.button, { borderColor: accent }]} onPress={loadProfile}>
          <ThemedText style={[styles.buttonText, { color: accent }]}>Refresh</ThemedText>
        </Pressable>
        <Pressable style={[styles.secondaryButton, { borderColor: border }]} onPress={onLogout}>
          <ThemedText style={styles.secondaryButtonText}>Logout</ThemedText>
        </Pressable>

        {loading ? (
          <ThemedView style={[styles.card, { borderColor: border }]}>
            <ActivityIndicator />
          </ThemedView>
        ) : null}

        {errorMessage ? (
          <ThemedView style={[styles.card, { borderColor: border }]}>
            <ThemedText style={[styles.errorText, { color: danger }]}>{errorMessage}</ThemedText>
          </ThemedView>
        ) : null}

        {!loading && !errorMessage ? (
          <ThemedView style={[styles.card, { borderColor: border }]}>
            <ThemedText type="subtitle">Licni podaci</ThemedText>
            <ThemedText>Username: {String(profile?.username ?? '-')}</ThemedText>
            <ThemedText>Display name: {String(profile?.display_name ?? '-')}</ThemedText>
            <ThemedText>First name: {String(profile?.first_name ?? '-')}</ThemedText>
            <ThemedText>Last name: {String(profile?.last_name ?? '-')}</ThemedText>
            <ThemedText>Phone: {String(profile?.phone ?? '-')}</ThemedText>
            <ThemedText>Address: {String(profile?.address ?? '-')}</ThemedText>
          </ThemedView>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  button: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  errorText: {},
});
