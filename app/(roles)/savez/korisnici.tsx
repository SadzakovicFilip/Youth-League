import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { openLicensePdf } from '@/lib/license-viewer';
import { supabase } from '@/lib/supabase';

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
};

type RoleRow = { user_id: string; role: string };

type LicenseRow = {
  user_id: string;
  valid_until?: string | null;
  license_valid_until?: string | null;
  license_file_path: string | null;
  license_number: string | null;
};

type UserLicense = {
  validUntil: string | null;
  filePath: string | null;
  number: string | null;
};

export default function SavezKorisniciScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<Map<string, string>>(new Map());
  const [licenses, setLicenses] = useState<Map<string, UserLicense>>(new Map());

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage('Nema aktivne sesije.');
      setLoading(false);
      return;
    }

    const { data: profileRows, error: profErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, first_name, last_name, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (profErr) {
      setErrorMessage(profErr.message);
      setLoading(false);
      return;
    }

    const ids = (profileRows ?? []).map((p) => p.id);
    let roleMap = new Map<string, string>();
    const licenseMap = new Map<string, UserLicense>();
    if (ids.length > 0) {
      const [{ data: roleRows, error: roleErr }, { data: licRows, error: licErr }] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').in('user_id', ids),
        supabase
          .from('user_licenses')
          .select('user_id, valid_until, license_valid_until, license_file_path, license_number')
          .in('user_id', ids),
      ]);
      if (roleErr) {
        setErrorMessage(roleErr.message);
        setLoading(false);
        return;
      }
      (roleRows as RoleRow[]).forEach((r) => roleMap.set(r.user_id, r.role));
      if (!licErr && licRows) {
        (licRows as LicenseRow[]).forEach((l) => {
          licenseMap.set(l.user_id, {
            validUntil: l.license_valid_until ?? l.valid_until ?? null,
            filePath: l.license_file_path ?? null,
            number: l.license_number ?? null,
          });
        });
      }
    }

    setProfiles((profileRows ?? []) as ProfileRow[]);
    setRoles(roleMap);
    setLicenses(licenseMap);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Korisnici</ThemedText>
      <ThemedText>Korisnici koje je kreirao trenutno ulogovani savez.</ThemedText>

      <Pressable style={styles.primaryButton} onPress={() => router.push('/savez/dodaj-korisnika')}>
        <ThemedText style={styles.primaryButtonText}>+ Dodaj novog korisnika</ThemedText>
      </Pressable>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && profiles.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Jos niko nije kreiran.</ThemedText>
        </ThemedView>
      ) : null}

      {profiles.map((p) => {
        const lic = licenses.get(p.id);
        return (
          <ThemedView key={p.id} style={styles.card}>
            <ThemedText type="defaultSemiBold">
              {p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username}
            </ThemedText>
            <ThemedText>Username: {p.username}</ThemedText>
            <ThemedText>Rola: {roles.get(p.id) ?? '-'}</ThemedText>
            <ThemedText>Broj licence: {lic?.number ?? '-'}</ThemedText>
            <ThemedText>Licenca vazi do: {lic?.validUntil ?? '-'}</ThemedText>
            {lic?.filePath ? (
              <Pressable style={styles.secondaryButton} onPress={() => openLicensePdf(lic.filePath)}>
                <ThemedText style={styles.secondaryButtonText}>Otvori PDF</ThemedText>
              </Pressable>
            ) : (
              <ThemedText style={styles.muted}>PDF licenca nije uploadovana.</ThemedText>
            )}
          </ThemedView>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  errorText: { color: '#c53939' },
  muted: { color: '#888', fontStyle: 'italic' },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  secondaryButtonText: { color: '#0a7ea4', fontWeight: '600' },
});
