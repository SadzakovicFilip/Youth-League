import { ActionAccentHex } from '@/constants/theme';
import * as DocumentPicker from 'expo-document-picker';
import { Link, router, useFocusEffect } from 'expo-router';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { LicenseValidUntilField } from '@/components/license-valid-until-field';
import { SavezLeagueAccordionSection } from '@/components/savez/savez-league-accordion-section';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { sanitizeUsername } from '@/lib/auth';
import { pickLicensePdf, saveUserLicense, uploadLicensePdf } from '@/lib/license-upload';
import { supabase } from '@/lib/supabase';

type LeagueRow = {
  league_id: number;
  league_name: string;
  region_id: number | null;
  region_name: string | null;
  group_count: number;
  club_count: number;
};

type Group = { id: number; league_id: number; name: string };
type Sudija = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

type LeagueDetailCache = {
  groups: Group[];
  sudije: Sudija[];
  loading: boolean;
  error?: string;
};

type PendingObjection = {
  id: number;
  reason: string;
  created_at: string;
  match_id: number;
  league_id: number;
  scheduled_at: string | null;
};

export default function DelegatHomeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [pendingObjections, setPendingObjections] = useState<PendingObjection[]>([]);

  const [expandedLeagueId, setExpandedLeagueId] = useState<number | null>(null);
  const [leagueDetail, setLeagueDetail] = useState<Record<number, LeagueDetailCache>>({});

  const [groupsOpen, setGroupsOpen] = useState<Record<number, boolean>>({});
  const [sudijeOpen, setSudijeOpen] = useState<Record<number, boolean>>({});

  const [groupFormLeagueId, setGroupFormLeagueId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  const [sudijaFormLeagueId, setSudijaFormLeagueId] = useState<number | null>(null);
  const [sUsername, setSUsername] = useState('');
  const [sPassword, setSPassword] = useState('');
  const [sFirstName, setSFirstName] = useState('');
  const [sLastName, setSLastName] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sLicenseNumber, setSLicenseNumber] = useState('');
  const [sLicenseValidUntil, setSLicenseValidUntil] = useState('');
  const [sPickedFile, setSPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [sudijaSubmitting, setSudijaSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase.rpc('get_delegate_leagues');
    if (error) {
      setErrorMessage(error.message);
      setRows([]);
      setPendingObjections([]);
      setLoading(false);
      return;
    }

    const leagueList = ((data ?? []) as LeagueRow[]) || [];
    setRows(leagueList);

    const leagueIds = new Set(leagueList.map((r) => r.league_id));

    const { data: obRows, error: obErr } = await supabase
      .from('match_objections')
      .select('id, reason, created_at, match_id, matches!inner(id, league_id, scheduled_at)')
      .eq('resolution_status', 'pending');

    if (!obErr && Array.isArray(obRows)) {
      const parsed: PendingObjection[] = [];
      for (const row of obRows as unknown[]) {
        const r = row as {
          id: number;
          reason: string;
          created_at: string;
          match_id: number;
          matches: unknown;
        };
        const mRaw = r.matches;
        const m = (Array.isArray(mRaw) ? mRaw[0] : mRaw) as {
          league_id: number;
          scheduled_at: string | null;
        } | null;
        if (!m || !leagueIds.has(m.league_id)) continue;
        parsed.push({
          id: r.id,
          reason: r.reason,
          created_at: r.created_at,
          match_id: r.match_id,
          league_id: m.league_id,
          scheduled_at: m.scheduled_at,
        });
      }
      parsed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPendingObjections(parsed);
    } else {
      setPendingObjections([]);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const fetchLeagueDetail = useCallback(async (leagueId: number) => {
    setLeagueDetail((prev) => ({
      ...prev,
      [leagueId]: { groups: prev[leagueId]?.groups ?? [], sudije: prev[leagueId]?.sudije ?? [], loading: true },
    }));

    const [gRes, sRes] = await Promise.all([
      supabase.from('league_groups').select('id, league_id, name').eq('league_id', leagueId).order('name'),
      supabase.rpc('get_league_sudije', { p_league_id: leagueId }),
    ]);

    const err = gRes.error?.message || sRes.error?.message;
    if (err) {
      setLeagueDetail((prev) => ({
        ...prev,
        [leagueId]: { groups: [], sudije: [], loading: false, error: err },
      }));
      return;
    }

    setLeagueDetail((prev) => ({
      ...prev,
      [leagueId]: {
        groups: (gRes.data ?? []) as Group[],
        sudije: ((sRes.data ?? []) as Sudija[]) || [],
        loading: false,
      },
    }));
  }, []);

  const resetInlineForms = useCallback(() => {
    setGroupFormLeagueId(null);
    setSudijaFormLeagueId(null);
    setNewGroupName('');
    setSUsername('');
    setSPassword('');
    setSFirstName('');
    setSLastName('');
    setSPhone('');
    setSLicenseNumber('');
    setSLicenseValidUntil('');
    setSPickedFile(null);
  }, []);

  const toggleLeague = (leagueId: number) => {
    setExpandedLeagueId((cur) => {
      const next = cur === leagueId ? null : leagueId;
      if (next !== cur) {
        resetInlineForms();
      }
      if (next != null && leagueDetail[next] == null) {
        void fetchLeagueDetail(next);
      }
      return next;
    });
  };

  const onCreateGroup = useCallback(
    async (leagueId: number) => {
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
      setGroupFormLeagueId(null);
      await fetchLeagueDetail(leagueId);
      await load();
    },
    [newGroupName, fetchLeagueDetail, load],
  );

  const onPickSudijaPdf = useCallback(async () => {
    const picked = await pickLicensePdf();
    if (picked) setSPickedFile(picked);
  }, []);

  const onCreateSudija = useCallback(
    async (leagueId: number) => {
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

      const { error: linkErr } = await supabase.from('league_sudije').insert({ league_id: leagueId, user_id: newUserId });

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
            await fetchLeagueDetail(leagueId);
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
          setSudijaSubmitting(false);
          await fetchLeagueDetail(leagueId);
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
      setSudijaFormLeagueId(null);
      setSudijaSubmitting(false);
      await fetchLeagueDetail(leagueId);
      await load();
    },
    [
      sUsername,
      sPassword,
      sFirstName,
      sLastName,
      sPhone,
      sLicenseNumber,
      sLicenseValidUntil,
      sPickedFile,
      fetchLeagueDetail,
      load,
    ],
  );

  const leagueNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) m.set(r.league_id, r.league_name);
    return m;
  }, [rows]);

  useScreenPullRefresh(load);

  return (
    <ScreenShell>
      <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.headerRow}>
          <ThemedText type="title">Moje lige</ThemedText>
        </ThemedView>
        <ThemedText style={styles.drawerHint}>
          Grupe i sudije su u accordionima ispod. Tema i profil: bočni meni. Za raspored mečeva i tabele koristi
          donje tabove.
        </ThemedText>

        <Link href="/home" style={styles.link}>
          Otvori shared home
        </Link>

        <Pressable style={styles.refreshButton} onPress={load}>
          <ThemedText style={styles.refreshText}>Osveži</ThemedText>
        </Pressable>

        {loading ? <ActivityIndicator /> : null}
        {errorMessage ? (
          <ThemedView style={styles.card}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </ThemedView>
        ) : null}

        {!loading && pendingObjections.length > 0 ? (
          <ThemedView style={styles.objectionsShell}>
            <ThemedText type="subtitle">Prigovori trenera (na čekanju)</ThemedText>
            <ThemedText style={styles.muted}>
              Otvori utakmicu da prihvatiš ili odbiješ prigovor na zapisnik.
            </ThemedText>
            {pendingObjections.map((o) => (
              <Pressable
                key={o.id}
                style={styles.objectionRow}
                onPress={() => router.push(`/delegat/utakmica/${o.match_id}`)}>
                <ThemedText type="defaultSemiBold">
                  {leagueNameById.get(o.league_id) ?? `Liga #${o.league_id}`} · Utakmica #{o.match_id}
                </ThemedText>
                <ThemedText style={styles.muted}>
                  {o.scheduled_at
                    ? new Date(o.scheduled_at).toLocaleString('sr-Latn')
                    : 'Bez termina'}
                </ThemedText>
                <ThemedText numberOfLines={3}>{o.reason}</ThemedText>
                <ThemedText style={styles.hint}>Otvori utakmicu ▸</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        ) : null}

        {!loading && !errorMessage && rows.length === 0 ? (
          <ThemedView style={styles.card}>
            <ThemedText>Nisi delegat ni u jednoj ligi.</ThemedText>
          </ThemedView>
        ) : null}

        {rows.map((r) => {
          const isExpanded = expandedLeagueId === r.league_id;
          const cache = leagueDetail[r.league_id];
          const gOpen = groupsOpen[r.league_id] ?? false;
          const sOpen = sudijeOpen[r.league_id] ?? false;

          return (
            <ThemedView key={r.league_id} style={styles.leagueOuter}>
              <Pressable
                style={[styles.leagueTop, isExpanded && styles.leagueTopOpen]}
                onPress={() => toggleLeague(r.league_id)}>
                <ThemedText style={styles.chev}>{isExpanded ? '▼' : '▶'}</ThemedText>
                <ThemedView style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold">{r.league_name}</ThemedText>
                  <ThemedText style={styles.meta}>
                    {r.region_name ?? '-'} · Grupe: {r.group_count} · Klubovi: {r.club_count}
                  </ThemedText>
                </ThemedView>
              </Pressable>

              {isExpanded ? (
                <ThemedView style={styles.leagueInner}>
                  {cache?.loading ? <ActivityIndicator /> : null}
                  {cache?.error ? (
                    <ThemedText style={styles.errorText}>{cache.error}</ThemedText>
                  ) : null}

                  {!cache?.loading && cache ? (
                    <>
                      <SavezLeagueAccordionSection
                        title="Grupe"
                        count={cache.groups.length}
                        listExpanded={gOpen}
                        onToggleList={() =>
                          setGroupsOpen((prev) => ({ ...prev, [r.league_id]: !gOpen }))
                        }
                        formOpen={groupFormLeagueId === r.league_id}
                        onToggleForm={() => {
                          if (groupFormLeagueId === r.league_id) {
                            setGroupFormLeagueId(null);
                            setNewGroupName('');
                            setErrorMessage('');
                          } else {
                            setErrorMessage('');
                            setSudijaFormLeagueId(null);
                            setGroupFormLeagueId(r.league_id);
                            setNewGroupName('');
                          }
                        }}
                        addLabel="Dodaj"
                        closeFormLabel="Zatvori"
                        form={
                          <ThemedView style={styles.card}>
                            <ThemedText type="defaultSemiBold">Nova grupa</ThemedText>
                            <ThemedTextInput
                              value={newGroupName}
                              onChangeText={setNewGroupName}
                              placeholder="Naziv grupe (A, B, Play-off)"
                              style={styles.inputSpacing}
                            />
                            <Pressable
                              style={[styles.formButton, groupSubmitting && styles.formButtonDisabled]}
                              onPress={() => void onCreateGroup(r.league_id)}
                              disabled={groupSubmitting}>
                              {groupSubmitting ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <ThemedText style={styles.formButtonText}>Kreiraj grupu</ThemedText>
                              )}
                            </Pressable>
                          </ThemedView>
                        }>
                        {cache.groups.length === 0 ? (
                          <ThemedView style={styles.padded}>
                            <ThemedText>Nema grupa u ligi.</ThemedText>
                          </ThemedView>
                        ) : (
                          cache.groups.map((g) => (
                            <Pressable
                              key={g.id}
                              style={styles.groupCard}
                              onPress={() => router.push(`/delegat/grupa/${g.id}`)}>
                              <ThemedText type="defaultSemiBold">{g.name}</ThemedText>
                              <ThemedText style={styles.hint}>Otvori grupu ▸</ThemedText>
                            </Pressable>
                          ))
                        )}
                      </SavezLeagueAccordionSection>

                      <SavezLeagueAccordionSection
                        title="Sudije"
                        count={cache.sudije.length}
                        listExpanded={sOpen}
                        onToggleList={() =>
                          setSudijeOpen((prev) => ({ ...prev, [r.league_id]: !sOpen }))
                        }
                        formOpen={sudijaFormLeagueId === r.league_id}
                        onToggleForm={() => {
                          if (sudijaFormLeagueId === r.league_id) {
                            setSudijaFormLeagueId(null);
                            setErrorMessage('');
                            setSUsername('');
                            setSPassword('');
                            setSFirstName('');
                            setSLastName('');
                            setSPhone('');
                            setSLicenseNumber('');
                            setSLicenseValidUntil('');
                            setSPickedFile(null);
                          } else {
                            setErrorMessage('');
                            setGroupFormLeagueId(null);
                            setNewGroupName('');
                            setSudijaFormLeagueId(r.league_id);
                          }
                        }}
                        addLabel="Dodaj"
                        closeFormLabel="Zatvori"
                        form={
                          <ThemedView style={styles.card}>
                            <ThemedText type="defaultSemiBold">Nalog sudije</ThemedText>
                            <ThemedTextInput
                              value={sUsername}
                              onChangeText={setSUsername}
                              placeholder="Username (npr. sudija.petrovic)"
                              autoCapitalize="none"
                              autoCorrect={false}
                              spellCheck={false}
                              style={styles.inputSpacing}
                            />
                            <ThemedTextInput
                              value={sPassword}
                              onChangeText={setSPassword}
                              placeholder="Password"
                              secureTextEntry
                              style={styles.inputSpacing}
                            />
                            <ThemedTextInput
                              value={sFirstName}
                              onChangeText={setSFirstName}
                              placeholder="Ime"
                              style={styles.inputSpacing}
                            />
                            <ThemedTextInput
                              value={sLastName}
                              onChangeText={setSLastName}
                              placeholder="Prezime"
                              style={styles.inputSpacing}
                            />
                            <ThemedTextInput
                              value={sPhone}
                              onChangeText={setSPhone}
                              placeholder="Telefon"
                              style={styles.inputSpacing}
                            />
                            <ThemedText type="defaultSemiBold" style={styles.licenseHeading}>
                              Licenca (opciono)
                            </ThemedText>
                            <ThemedTextInput
                              value={sLicenseNumber}
                              onChangeText={setSLicenseNumber}
                              placeholder="Broj licence"
                              style={styles.inputSpacing}
                            />
                            <LicenseValidUntilField
                              value={sLicenseValidUntil}
                              onChange={setSLicenseValidUntil}
                              style={styles.inputSpacing}
                            />
                            <Pressable style={styles.outlineButton} onPress={() => void onPickSudijaPdf()}>
                              <ThemedText style={styles.outlineButtonText}>
                                {sPickedFile ? `PDF: ${sPickedFile.name}` : 'Izaberi PDF licencu'}
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              style={[styles.formButton, sudijaSubmitting && styles.formButtonDisabled]}
                              onPress={() => void onCreateSudija(r.league_id)}
                              disabled={sudijaSubmitting}>
                              {sudijaSubmitting ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <ThemedText style={styles.formButtonText}>Kreiraj sudiju</ThemedText>
                              )}
                            </Pressable>
                          </ThemedView>
                        }>
                        {cache.sudije.length === 0 ? (
                          <ThemedView style={styles.padded}>
                            <ThemedText>Nema sudija u ligi.</ThemedText>
                          </ThemedView>
                        ) : (
                          cache.sudije.map((s) => (
                            <Pressable
                              key={s.user_id}
                              style={styles.sudijaCard}
                              onPress={() => router.push(`/delegat/sudija/${s.user_id}`)}>
                              <ThemedText type="defaultSemiBold">
                                {s.display_name ||
                                  [s.first_name, s.last_name].filter(Boolean).join(' ') ||
                                  s.username ||
                                  '-'}
                              </ThemedText>
                              <ThemedText>@{s.username ?? '-'}</ThemedText>
                              {s.phone ? <ThemedText>Tel: {s.phone}</ThemedText> : null}
                              <ThemedText style={styles.hint}>Profil i licenca ▸</ThemedText>
                            </Pressable>
                          ))
                        )}
                      </SavezLeagueAccordionSection>
                    </>
                  ) : null}
                </ThemedView>
              ) : null}
            </ThemedView>
          );
        })}
      </RefreshableScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drawerHint: { opacity: 0.85, fontSize: 14 },
  link: { textDecorationLine: 'underline', fontSize: 16 },
  refreshButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: { color: ActionAccentHex, fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  errorText: { color: '#c53939' },
  objectionsShell: { gap: 8, borderWidth: 1, borderColor: ActionAccentHex, borderRadius: 10, padding: 12 },
  objectionRow: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    marginTop: 4,
  },
  muted: { opacity: 0.85, fontSize: 13 },
  hint: { color: ActionAccentHex, fontWeight: '600', marginTop: 4 },
  leagueOuter: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 10,
    overflow: 'hidden',
  },
  leagueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  leagueTopOpen: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#999' },
  chev: { fontSize: 12, fontWeight: '800', width: 18, textAlign: 'center' },
  meta: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  leagueInner: { padding: 10, gap: 12 },
  padded: { paddingHorizontal: 8, paddingVertical: 4 },
  groupCard: {
    marginHorizontal: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  sudijaCard: {
    marginHorizontal: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  inputSpacing: { marginTop: 6 },
  licenseHeading: { marginTop: 6 },
  formButton: {
    marginTop: 8,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ActionAccentHex,
  },
  formButtonDisabled: { opacity: 0.6 },
  formButtonText: { color: '#fff', fontWeight: '600' },
  outlineButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  outlineButtonText: { color: ActionAccentHex, fontWeight: '600' },
});
