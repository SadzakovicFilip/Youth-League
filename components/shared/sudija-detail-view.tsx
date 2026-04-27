import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { pickLicensePdf, saveUserLicense, uploadLicensePdf } from '@/lib/license-upload';
import { openLicensePdf } from '@/lib/license-viewer';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
};

type License = {
  license_number: string | null;
  license_valid_until: string | null;
  license_file_path: string | null;
};

type LeagueRow = {
  league_id: number;
  league_name: string | null;
  region_id: number | null;
  region_name: string | null;
};

type Payload = {
  profile: Profile | null;
  license: License | null;
  leagues: LeagueRow[];
  can_manage: boolean;
};

type Props = {
  userId: string;
  onBack?: () => void;
};

export function SudijaDetailView({ userId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<Payload | null>(null);

  const [licenseNumber, setLicenseNumber] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setErrorMessage('Nevazeci sudija.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');

    const { data: rpcData, error } = await supabase.rpc('get_sudija_detail', {
      p_user_id: userId,
    });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    const payload = (rpcData ?? null) as Payload | null;
    setData(payload);
    setLicenseNumber(payload?.license?.license_number ?? '');
    setValidUntil(payload?.license?.license_valid_until ?? '');
    setPickedFile(null);
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onPickPdf = async () => {
    const picked = await pickLicensePdf();
    if (picked) setPickedFile(picked);
  };

  const onSave = async () => {
    if (!userId) return;
    const trimmedNumber = licenseNumber.trim() || null;
    const trimmedDate = validUntil.trim() || null;

    if (!trimmedNumber && !trimmedDate && !pickedFile) {
      setErrorMessage('Unesi broj, datum ili izaberi PDF.');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    let finalPath = data?.license?.license_file_path ?? null;
    if (pickedFile) {
      const { path, error } = await uploadLicensePdf(userId, pickedFile);
      if (error) {
        setErrorMessage(error);
        setSaving(false);
        return;
      }
      finalPath = path;
    }

    const { error: saveErr } = await saveUserLicense({
      userId,
      validUntil: trimmedDate,
      licenseFilePath: finalPath,
      licenseNumber: trimmedNumber ?? data?.license?.license_number ?? null,
    });
    if (saveErr) {
      setErrorMessage(saveErr);
      setSaving(false);
      return;
    }

    setSaving(false);
    setPickedFile(null);
    await load();
  };

  const p = data?.profile;
  const lic = data?.license;
  const leagues = data?.leagues ?? [];
  const canManage = data?.can_manage ?? false;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {onBack ? (
        <Pressable style={styles.backButton} onPress={onBack}>
          <ThemedText style={styles.backText}>← Nazad</ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="title">
        {p?.display_name ||
          [p?.first_name, p?.last_name].filter(Boolean).join(' ') ||
          p?.username ||
          'Sudija'}
      </ThemedText>
      <ThemedText style={styles.muted}>Profil sudije i licenca</ThemedText>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && p ? (
        <>
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Licni podaci</ThemedText>
            <ThemedText>Username: {p.username ?? '-'}</ThemedText>
            <ThemedText>Ime: {p.first_name ?? '-'}</ThemedText>
            <ThemedText>Prezime: {p.last_name ?? '-'}</ThemedText>
            <ThemedText>Datum rodjenja: {p.birth_date ?? '-'}</ThemedText>
            <ThemedText>Adresa: {p.address ?? '-'}</ThemedText>
            <ThemedText>Telefon: {p.phone ?? '-'}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Lige ({leagues.length})</ThemedText>
            {leagues.length === 0 ? (
              <ThemedText>Sudija nije dodeljen nijednoj ligi.</ThemedText>
            ) : null}
            {leagues.map((l) => (
              <ThemedText key={l.league_id}>
                {l.league_name ?? `Liga #${l.league_id}`}
                {l.region_name ? `  •  ${l.region_name}` : ''}
              </ThemedText>
            ))}
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Licenca</ThemedText>
            <ThemedText>Broj licence: {lic?.license_number ?? '-'}</ThemedText>
            <ThemedText>Vazi do: {lic?.license_valid_until ?? '-'}</ThemedText>
            <ThemedText>Fajl: {lic?.license_file_path ?? '-'}</ThemedText>
            {lic?.license_file_path ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => openLicensePdf(lic.license_file_path)}>
                <ThemedText style={styles.secondaryButtonText}>Otvori PDF</ThemedText>
              </Pressable>
            ) : null}

            {canManage ? (
              <>
                <ThemedView style={styles.divider} />
                <ThemedText type="defaultSemiBold">
                  {lic?.license_file_path ? 'Azuriraj licencu' : 'Dodaj licencu'}
                </ThemedText>
                <TextInput
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                  placeholder="Broj licence"
                  placeholderTextColor="#888"
                  style={styles.input}
                />
                <TextInput
                  value={validUntil}
                  onChangeText={setValidUntil}
                  placeholder="Vazi do (YYYY-MM-DD)"
                  placeholderTextColor="#888"
                  style={styles.input}
                />
                <Pressable style={styles.secondaryButton} onPress={onPickPdf}>
                  <ThemedText style={styles.secondaryButtonText}>
                    {pickedFile ? `PDF: ${pickedFile.name}` : 'Izaberi PDF'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, saving && styles.buttonDisabled]}
                  onPress={onSave}
                  disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Sacuvaj licencu</ThemedText>
                  )}
                </Pressable>
              </>
            ) : (
              <ThemedText style={styles.muted}>
                Samo delegat lige i savez mogu da menjaju licencu sudije.
              </ThemedText>
            )}
          </ThemedView>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 32 },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: { fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  divider: { height: 1, backgroundColor: '#ccc', marginVertical: 6 },
  muted: { color: '#888', fontStyle: 'italic' },
  errorText: { color: '#c53939' },
  input: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#111',
    backgroundColor: '#fff',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryButtonText: { color: '#0a7ea4', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
});
