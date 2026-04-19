import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { sanitizeUsername } from '@/lib/auth';
import { pickLicensePdf, saveUserLicense, uploadLicensePdf } from '@/lib/license-upload';
import { supabase } from '@/lib/supabase';

type League = { id: number; name: string; region_id: number | null };
type Group = { id: number; league_id: number; name: string };
type Sudija = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export default function DelegatLigaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leagueId = Number(id);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [league, setLeague] = useState<League | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sudije, setSudije] = useState<Sudija[]>([]);

  // add sudija form
  const [showForm, setShowForm] = useState(false);
  const [sUsername, setSUsername] = useState('');
  const [sPassword, setSPassword] = useState('');
  const [sFirstName, setSFirstName] = useState('');
  const [sLastName, setSLastName] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sLicenseNumber, setSLicenseNumber] = useState('');
  const [sLicenseValidUntil, setSLicenseValidUntil] = useState('');
  const [sPickedFile, setSPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(leagueId)) {
      setErrorMessage('Nevazeca liga.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');

    const [lRes, gRes, sRes] = await Promise.all([
      supabase.from('leagues').select('id, name, region_id').eq('id', leagueId).maybeSingle(),
      supabase.from('league_groups').select('id, league_id, name').eq('league_id', leagueId).order('name'),
      supabase.rpc('get_league_sudije', { p_league_id: leagueId }),
    ]);

    if (lRes.error || gRes.error || sRes.error) {
      setErrorMessage(lRes.error?.message || gRes.error?.message || sRes.error?.message || 'Greska pri ucitavanju.');
      setLoading(false);
      return;
    }

    setLeague((lRes.data ?? null) as League | null);
    setGroups((gRes.data ?? []) as Group[]);
    setSudije(((sRes.data ?? []) as Sudija[]) || []);
    setLoading(false);
  }, [leagueId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onCreateSudija = async () => {
    if (!sUsername.trim() || !sPassword.trim()) {
      setErrorMessage('Username i password sudije su obavezni.');
      return;
    }
    const safeUsername = sanitizeUsername(sUsername);
    if (!safeUsername) {
      setErrorMessage('Username mora sadrzati slova/brojeve.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    const { data: created, error: fnErr } = await supabase.functions.invoke('create-managed-user', {
      body: {
        role: 'sudija',
        username: safeUsername,
        password: sPassword,
        display_name: [sFirstName, sLastName].filter(Boolean).join(' ') || safeUsername,
        first_name: sFirstName || undefined,
        last_name: sLastName || undefined,
        phone: sPhone || undefined,
      },
    });

    if (fnErr) {
      let raw = '';
      try {
        const text = await fnErr.context?.text?.();
        raw = text ? ` | RAW: ${text}` : '';
      } catch {
        raw = '';
      }
      setErrorMessage(`Sudija: ${fnErr.message}${raw}`);
      setSubmitting(false);
      return;
    }

    const newUserId =
      (created as { user_id?: string; id?: string } | null)?.user_id ??
      (created as { user_id?: string; id?: string } | null)?.id ??
      null;

    if (!newUserId) {
      setErrorMessage('Sudija kreiran ali nije vracen user_id.');
      setSubmitting(false);
      return;
    }

    const { error: linkErr } = await supabase
      .from('league_sudije')
      .insert({ league_id: leagueId, user_id: newUserId });

    if (linkErr) {
      setErrorMessage(`Sudija kreiran, ali nije vezan za ligu: ${linkErr.message}`);
      setSubmitting(false);
      return;
    }

    const trimmedNumber = sLicenseNumber.trim() || null;
    const trimmedValidUntil = sLicenseValidUntil.trim() || null;
    if (sPickedFile || trimmedNumber || trimmedValidUntil) {
      let licensePath: string | null = null;
      if (sPickedFile) {
        const { path, error: upErr } = await uploadLicensePdf(newUserId, sPickedFile);
        if (upErr) {
          setErrorMessage(`Sudija kreiran, ali licenca nije snimljena: ${upErr}`);
          setSubmitting(false);
          await load();
          return;
        }
        licensePath = path;
      }
      const { error: licErr } = await saveUserLicense({
        userId: newUserId,
        validUntil: trimmedValidUntil,
        licenseFilePath: licensePath,
        licenseNumber: trimmedNumber,
      });
      if (licErr) {
        setErrorMessage(`Sudija kreiran, ali licenca nije snimljena: ${licErr}`);
        setSubmitting(false);
        await load();
        return;
      }
    }

    setSUsername('');
    setSPassword('');
    setSFirstName('');
    setSLastName('');
    setSPhone('');
    setSLicenseNumber('');
    setSLicenseValidUntil('');
    setSPickedFile(null);
    setShowForm(false);
    setSubmitting(false);
    await load();
  };

  const onPickSudijaPdf = async () => {
    const picked = await pickLicensePdf();
    if (picked) setSPickedFile(picked);
  };

  const onRemoveSudija = async (userId: string) => {
    const { error } = await supabase
      .from('league_sudije')
      .delete()
      .eq('league_id', leagueId)
      .eq('user_id', userId);
    if (error) {
      setErrorMessage(`Uklanjanje sudije: ${error.message}`);
      return;
    }
    await load();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">{league?.name ?? 'Liga'}</ThemedText>
      <ThemedText>Provera dokumentacije, sudije i raspored utakmica.</ThemedText>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {/* GRUPE */}
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Grupe u ligi ({groups.length})
      </ThemedText>
      {groups.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema grupa u ligi.</ThemedText>
        </ThemedView>
      ) : null}
      {groups.map((g) => (
        <Pressable key={g.id} style={styles.groupCard} onPress={() => router.push(`/delegat/grupa/${g.id}`)}>
          <ThemedText type="defaultSemiBold">{g.name}</ThemedText>
          <ThemedText style={styles.hint}>Otvori ▸</ThemedText>
        </Pressable>
      ))}

      {/* SUDIJE */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Sudije ({sudije.length})</ThemedText>
        <Pressable style={styles.smallButton} onPress={() => setShowForm((v) => !v)}>
          <ThemedText style={styles.smallButtonText}>
            {showForm ? 'Zatvori' : '+ Dodaj sudiju'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      {showForm ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Nalog sudije</ThemedText>
          <TextInput
            value={sUsername}
            onChangeText={setSUsername}
            placeholder="Username (npr. sudija.petrovic)"
            placeholderTextColor="#888"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            value={sPassword}
            onChangeText={setSPassword}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            style={styles.input}
          />
          <TextInput
            value={sFirstName}
            onChangeText={setSFirstName}
            placeholder="Ime"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={sLastName}
            onChangeText={setSLastName}
            placeholder="Prezime"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={sPhone}
            onChangeText={setSPhone}
            placeholder="Telefon"
            placeholderTextColor="#888"
            style={styles.input}
          />

          <ThemedText type="defaultSemiBold" style={styles.subSection}>Licenca (opciono)</ThemedText>
          <TextInput
            value={sLicenseNumber}
            onChangeText={setSLicenseNumber}
            placeholder="Broj licence"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={sLicenseValidUntil}
            onChangeText={setSLicenseValidUntil}
            placeholder="Vazi do (YYYY-MM-DD)"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <Pressable style={styles.smallButton} onPress={onPickSudijaPdf}>
            <ThemedText style={styles.smallButtonText}>
              {sPickedFile ? `PDF: ${sPickedFile.name}` : 'Izaberi PDF licencu'}
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={onCreateSudija}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Kreiraj sudiju</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}

      {sudije.map((s) => (
        <Pressable
          key={s.user_id}
          style={styles.card}
          onPress={() => router.push(`/delegat/sudija/${s.user_id}`)}>
          <ThemedView style={styles.rowBetween}>
            <ThemedView style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">
                {s.display_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || s.username || '-'}
              </ThemedText>
              <ThemedText>@{s.username ?? '-'}</ThemedText>
              {s.phone ? <ThemedText>Tel: {s.phone}</ThemedText> : null}
              <ThemedText style={styles.hint}>Otvori profil i licencu ▸</ThemedText>
            </ThemedView>
            <Pressable style={styles.removeButton} onPress={() => onRemoveSudija(s.user_id)}>
              <ThemedText style={styles.removeButtonText}>Ukloni</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      ))}

      {/* UTAKMICE -> raspored */}
      <Pressable style={styles.primaryButton} onPress={() => router.push(`/delegat/utakmice/${leagueId}`)}>
        <ThemedText style={styles.primaryButtonText}>Raspored sudija za utakmice ▸</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: { fontWeight: '600' },
  sectionTitle: { marginTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  groupCard: { borderWidth: 1, borderColor: '#0a7ea4', borderRadius: 8, padding: 10, gap: 4 },
  errorText: { color: '#c53939' },
  hint: { color: '#0a7ea4', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#111',
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 6,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  smallButton: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: { color: '#0a7ea4', fontWeight: '600' },
  subSection: { marginTop: 6 },
  removeButton: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: { color: '#c53939', fontWeight: '600' },
  primaryButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
