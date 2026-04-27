import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { LeagueCompetitionView } from '@/components/shared/league-competition-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { sanitizeUsername } from '@/lib/auth';
import { pickLicensePdf, saveUserLicense, uploadLicensePdf } from '@/lib/license-upload';
import { supabase } from '@/lib/supabase';

type League = { id: number; name: string; season: string | null; region_id: number };
type Club = { id: number; name: string; league_id: number | null };
type Group = { id: number; league_id: number; name: string };
type Delegate = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};
type Sudija = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};
type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export default function LigaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leagueId = Number(id);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [league, setLeague] = useState<League | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [sudije, setSudije] = useState<Sudija[]>([]);

  // --- add club form ---
  const [clubName, setClubName] = useState('');
  const [kdUsername, setKdUsername] = useState('');
  const [kdPassword, setKdPassword] = useState('');
  const [kdFirstName, setKdFirstName] = useState('');
  const [kdLastName, setKdLastName] = useState('');
  const [kdPhone, setKdPhone] = useState('');
  const [showClubForm, setShowClubForm] = useState(false);
  const [clubSubmitting, setClubSubmitting] = useState(false);

  // --- add group form ---
  const [newGroupName, setNewGroupName] = useState('');
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  // --- add delegate form ---
  const [showDelegateForm, setShowDelegateForm] = useState(false);
  const [delUsername, setDelUsername] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [delFirstName, setDelFirstName] = useState('');
  const [delLastName, setDelLastName] = useState('');
  const [delPhone, setDelPhone] = useState('');
  const [delegateSubmitting, setDelegateSubmitting] = useState(false);

  // --- add sudija form ---
  const [showSudijaForm, setShowSudijaForm] = useState(false);
  const [sUsername, setSUsername] = useState('');
  const [sPassword, setSPassword] = useState('');
  const [sFirstName, setSFirstName] = useState('');
  const [sLastName, setSLastName] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sLicenseNumber, setSLicenseNumber] = useState('');
  const [sLicenseValidUntil, setSLicenseValidUntil] = useState('');
  const [sPickedFile, setSPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [sudijaSubmitting, setSudijaSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    if (!Number.isFinite(leagueId)) {
      setErrorMessage('Nevazeca liga.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const [{ data, error }, sRes] = await Promise.all([
      supabase.rpc('get_league_detail', { p_league_id: leagueId }),
      supabase.rpc('get_league_sudije', { p_league_id: leagueId }),
    ]);
    if (sRes.error) {
      setSudije([]);
    } else {
      setSudije(((sRes.data ?? []) as Sudija[]) || []);
    }
    if (error) {
      setErrorMessage(error.message);
      setLeague(null);
      setClubs([]);
      setGroups([]);
      setDelegates([]);
    } else {
      const payload = (data ?? {}) as {
        league: League | null;
        clubs: Club[];
        groups: Group[];
        delegates: Delegate[];
      };
      setLeague(payload.league ?? null);
      setClubs(payload.clubs ?? []);
      setGroups(payload.groups ?? []);
      let resolvedDelegates = Array.isArray(payload.delegates) ? payload.delegates : [];

      // Compatibility fallback: if SQL function is older or returns empty delegates,
      // load delegates directly from league_delegates + profiles.
      if (resolvedDelegates.length === 0) {
        const { data: leagueDelegateRows } = await supabase
          .from('league_delegates')
          .select('user_id')
          .eq('league_id', leagueId);

        const userIds = (leagueDelegateRows ?? []).map((r: { user_id: string }) => r.user_id);
        if (userIds.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, username, display_name, first_name, last_name, phone')
            .in('id', userIds);

          const profileById = new Map((profileRows ?? []).map((p) => [p.id, p as ProfileLite]));
          resolvedDelegates = userIds.map((uid) => {
            const p = profileById.get(uid);
            return {
              user_id: uid,
              username: p?.username ?? null,
              display_name: p?.display_name ?? null,
              first_name: p?.first_name ?? null,
              last_name: p?.last_name ?? null,
              phone: p?.phone ?? null,
            };
          });
        }
      }

      setDelegates(resolvedDelegates);
    }
    setLoading(false);
  }, [leagueId]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const onCreateClub = async () => {
    if (!clubName.trim() || !kdUsername.trim() || !kdPassword.trim()) {
      setErrorMessage('Naziv kluba, username i password kluba su obavezni.');
      return;
    }
    const safeUsername = sanitizeUsername(kdUsername);
    if (!safeUsername) {
      setErrorMessage('Username mora sadrzati slova/brojeve.');
      return;
    }
    setClubSubmitting(true);
    setErrorMessage('');

    // 1) create club row
    const { data: clubRow, error: clubErr } = await supabase
      .from('clubs')
      .insert({ name: clubName.trim(), league_id: leagueId })
      .select('id')
      .maybeSingle();
    if (clubErr || !clubRow) {
      setErrorMessage(`Klub: ${clubErr?.message ?? 'insert failed'}`);
      setClubSubmitting(false);
      return;
    }
    const newClubId = clubRow.id as number;

    // 2) create klub user + membership via Edge function
    const { error: fnErr } = await supabase.functions.invoke('create-managed-user', {
      body: {
        role: 'klub',
        username: safeUsername,
        password: kdPassword,
        display_name: [kdFirstName, kdLastName].filter(Boolean).join(' ') || safeUsername,
        first_name: kdFirstName || undefined,
        last_name: kdLastName || undefined,
        phone: kdPhone || undefined,
        club_id: newClubId,
        member_role: 'klub',
      },
    });

    if (fnErr) {
      // rollback club
      await supabase.from('clubs').delete().eq('id', newClubId);
      let raw = '';
      try {
        const text = await fnErr.context?.text?.();
        raw = text ? ` | RAW: ${text}` : '';
      } catch {
        raw = '';
      }
      setErrorMessage(`Klub: ${fnErr.message}${raw}`);
      setClubSubmitting(false);
      return;
    }

    setClubName('');
    setKdUsername('');
    setKdPassword('');
    setKdFirstName('');
    setKdLastName('');
    setKdPhone('');
    setShowClubForm(false);
    setClubSubmitting(false);
    await loadAll();
  };

  const onCreateDelegate = async () => {
    if (!delUsername.trim() || !delPassword.trim()) {
      setErrorMessage('Username i password delegata su obavezni.');
      return;
    }
    const safeUsername = sanitizeUsername(delUsername);
    if (!safeUsername) {
      setErrorMessage('Username mora sadrzati slova/brojeve.');
      return;
    }
    setDelegateSubmitting(true);
    setErrorMessage('');

    // kreiraj delegata i odmah ga veži za ovu ligu (league_id)
    const { error: fnErr } = await supabase.functions.invoke('create-managed-user', {
      body: {
        role: 'delegat',
        username: safeUsername,
        password: delPassword,
        display_name: [delFirstName, delLastName].filter(Boolean).join(' ') || safeUsername,
        first_name: delFirstName || undefined,
        last_name: delLastName || undefined,
        phone: delPhone || undefined,
        league_id: leagueId,
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
      setErrorMessage(`Delegat: ${fnErr.message}${raw}`);
      setDelegateSubmitting(false);
      return;
    }

    setDelUsername('');
    setDelPassword('');
    setDelFirstName('');
    setDelLastName('');
    setDelPhone('');
    setShowDelegateForm(false);
    setDelegateSubmitting(false);
    await loadAll();
  };

  const onRemoveDelegate = async (userId: string) => {
    const { error } = await supabase
      .from('league_delegates')
      .delete()
      .eq('league_id', leagueId)
      .eq('user_id', userId);
    if (error) {
      setErrorMessage(`Uklanjanje delegata: ${error.message}`);
      return;
    }
    await loadAll();
  };

  const onPickSudijaPdf = async () => {
    const picked = await pickLicensePdf();
    if (picked) setSPickedFile(picked);
  };

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
    setSudijaSubmitting(true);
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
      setSudijaSubmitting(false);
      return;
    }

    const newUserId =
      (created as { user_id?: string; id?: string } | null)?.user_id ??
      (created as { user_id?: string; id?: string } | null)?.id ??
      null;

    if (!newUserId) {
      setErrorMessage('Sudija kreiran ali nije vracen user_id.');
      setSudijaSubmitting(false);
      return;
    }

    const { error: linkErr } = await supabase
      .from('league_sudije')
      .insert({ league_id: leagueId, user_id: newUserId });
    if (linkErr) {
      setErrorMessage(`Sudija kreiran, ali nije vezan za ligu: ${linkErr.message}`);
      setSudijaSubmitting(false);
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
          setSudijaSubmitting(false);
          await loadAll();
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
        setSudijaSubmitting(false);
        await loadAll();
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
    setShowSudijaForm(false);
    setSudijaSubmitting(false);
    await loadAll();
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
    await loadAll();
  };

  const onCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setErrorMessage('Naziv grupe je obavezan.');
      return;
    }
    setGroupSubmitting(true);
    setErrorMessage('');
    const { error } = await supabase.from('league_groups').insert({
      league_id: leagueId,
      name: newGroupName.trim(),
    });
    setGroupSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setNewGroupName('');
    await loadAll();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">{league?.name ?? 'Liga'}</ThemedText>
      <ThemedText>Sezona: {league?.season ?? '-'}</ThemedText>

      {/* KLUBOVI */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Klubovi ({clubs.length})</ThemedText>
        <Pressable
          style={styles.smallButton}
          onPress={() => setShowClubForm((v) => !v)}>
          <ThemedText style={styles.smallButtonText}>
            {showClubForm ? 'Zatvori' : '+ Dodaj klub'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      {showClubForm ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Klub</ThemedText>
          <TextInput
            value={clubName}
            onChangeText={setClubName}
            placeholder="Naziv kluba (npr. KK Partizan)"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <ThemedText type="defaultSemiBold">Nalog kluba</ThemedText>
          <TextInput
            value={kdUsername}
            onChangeText={setKdUsername}
            placeholder="Username (npr. direktor.partizan)"
            placeholderTextColor="#888"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={styles.input}
          />
          <TextInput
            value={kdPassword}
            onChangeText={setKdPassword}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            style={styles.input}
          />
          <TextInput
            value={kdFirstName}
            onChangeText={setKdFirstName}
            placeholder="Ime"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={kdLastName}
            onChangeText={setKdLastName}
            placeholder="Prezime"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={kdPhone}
            onChangeText={setKdPhone}
            placeholder="Telefon"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <Pressable
            style={[styles.button, clubSubmitting && styles.buttonDisabled]}
            onPress={onCreateClub}
            disabled={clubSubmitting}>
            {clubSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Kreiraj klub + direktora</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}

      {clubs.map((c) => (
        <ThemedView key={c.id} style={styles.sectionCard}>
          <ThemedText type="defaultSemiBold">{c.name}</ThemedText>
          <ThemedText>ID: {c.id}</ThemedText>
        </ThemedView>
      ))}

      {/* DELEGATI */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Delegati ({delegates.length})</ThemedText>
        <Pressable
          style={styles.smallButton}
          onPress={() => setShowDelegateForm((v) => !v)}>
          <ThemedText style={styles.smallButtonText}>
            {showDelegateForm ? 'Zatvori' : '+ Dodaj delegata'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      {showDelegateForm ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Nalog delegata</ThemedText>
          <TextInput
            value={delUsername}
            onChangeText={setDelUsername}
            placeholder="Username (npr. delegat.prva)"
            placeholderTextColor="#888"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={styles.input}
          />
          <TextInput
            value={delPassword}
            onChangeText={setDelPassword}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            style={styles.input}
          />
          <TextInput
            value={delFirstName}
            onChangeText={setDelFirstName}
            placeholder="Ime"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={delLastName}
            onChangeText={setDelLastName}
            placeholder="Prezime"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={delPhone}
            onChangeText={setDelPhone}
            placeholder="Telefon"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <Pressable
            style={[styles.button, delegateSubmitting && styles.buttonDisabled]}
            onPress={onCreateDelegate}
            disabled={delegateSubmitting}>
            {delegateSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Kreiraj delegata</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}

      {delegates.map((d) => (
        <ThemedView key={d.user_id} style={styles.sectionCard}>
          <ThemedView style={styles.rowBetween}>
            <ThemedView style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">
                {d.display_name || [d.first_name, d.last_name].filter(Boolean).join(' ') || d.username || '-'}
              </ThemedText>
              <ThemedText>@{d.username ?? '-'}</ThemedText>
              {d.phone ? <ThemedText>Tel: {d.phone}</ThemedText> : null}
            </ThemedView>
            <Pressable
              style={styles.removeButton}
              onPress={() => onRemoveDelegate(d.user_id)}>
              <ThemedText style={styles.removeButtonText}>Ukloni</ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>
      ))}

      {/* SUDIJE */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Sudije ({sudije.length})</ThemedText>
        <Pressable
          style={styles.smallButton}
          onPress={() => setShowSudijaForm((v) => !v)}>
          <ThemedText style={styles.smallButtonText}>
            {showSudijaForm ? 'Zatvori' : '+ Dodaj sudiju'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      {showSudijaForm ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Nalog sudije</ThemedText>
          <TextInput
            value={sUsername}
            onChangeText={setSUsername}
            placeholder="Username (npr. sudija.petrovic)"
            placeholderTextColor="#888"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
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
            style={[styles.button, sudijaSubmitting && styles.buttonDisabled]}
            onPress={onCreateSudija}
            disabled={sudijaSubmitting}>
            {sudijaSubmitting ? (
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
          style={styles.sectionCard}
          onPress={() => router.push(`/savez/sudija/${s.user_id}`)}>
          <ThemedView style={styles.rowBetween}>
            <ThemedView style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">
                {s.display_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || s.username || '-'}
              </ThemedText>
              <ThemedText>@{s.username ?? '-'}</ThemedText>
              {s.phone ? <ThemedText>Tel: {s.phone}</ThemedText> : null}
              <ThemedText style={styles.hint}>Otvori profil i licencu ▸</ThemedText>
            </ThemedView>
            <Pressable
              style={styles.removeButton}
              onPress={() => onRemoveSudija(s.user_id)}>
              <ThemedText style={styles.removeButtonText}>Ukloni</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      ))}

      {/* GRUPE */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Grupe ({groups.length})</ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold">Dodaj grupu</ThemedText>
        <TextInput
          value={newGroupName}
          onChangeText={setNewGroupName}
          placeholder="Naziv grupe (A, B, Play-off)"
          placeholderTextColor="#888"
          style={styles.input}
        />
        <Pressable
          style={[styles.button, groupSubmitting && styles.buttonDisabled]}
          onPress={onCreateGroup}
          disabled={groupSubmitting}>
          {groupSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Kreiraj grupu</ThemedText>
          )}
        </Pressable>
      </ThemedView>

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {loading ? <ActivityIndicator /> : null}

      {groups.map((g) => (
        <Pressable
          key={g.id}
          style={styles.sectionCard}
          onPress={() => router.push(`/savez/grupa/${g.id}`)}>
          <ThemedView style={styles.rowBetween}>
            <ThemedText type="defaultSemiBold">{g.name}</ThemedText>
            <ThemedText style={styles.chevron}>▸</ThemedText>
          </ThemedView>
        </Pressable>
      ))}

      <ThemedView style={styles.divider} />
      <LeagueCompetitionView
        leagueId={leagueId}
        onOpenPlayer={(uid) => router.push(`/savez/korisnik/${uid}`)}
        onOpenClub={(cid) => router.push(`/savez/klub/${cid}`)}
      />
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionCard: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  chevron: { fontSize: 16, opacity: 0.8 },
  divider: { height: 1, backgroundColor: '#ddd', marginTop: 12, marginBottom: 4 },
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
  smallButton: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: { color: '#0a7ea4', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  errorText: { color: '#c53939' },
  removeButton: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: { color: '#c53939', fontWeight: '600' },
  subSection: { marginTop: 6 },
  hint: { color: '#0a7ea4', fontWeight: '600', marginTop: 4 },
});
