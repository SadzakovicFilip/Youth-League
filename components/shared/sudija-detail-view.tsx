import type { BreadcrumbItem } from '@/components/savez/savez-breadcrumbs';
import { LicenseValidUntilField } from '@/components/license-valid-until-field';
import { ActionAccentHex } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useSyncTakmicenjeDrillChrome } from '@/contexts/takmicenje-drill-chrome-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import {
  pickLicensePdf,
  saveUserLicense,
  uploadLicensePdf,
} from '@/lib/license-upload';
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
  syncDrillChrome?: boolean;
};

function parseYyyyMmDd(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function SudijaDetailView({
  userId,
  syncDrillChrome = false,
}: Props) {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<Payload | null>(null);

  const [ligaExpanded, setLigaExpanded] = useState(false);
  const [licencaExpanded, setLicencaExpanded] = useState(false);
  const [licenseEditorOpen, setLicenseEditorOpen] = useState(false);

  const [licenseNumber, setLicenseNumber] = useState('');
  const [validUntilDate, setValidUntilDate] = useState<Date | null>(null);
  const [webValidUntilStr, setWebValidUntilStr] = useState('');

  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarSlotHeight, setAvatarSlotHeight] = useState(160);

  const isWeb = Platform.OS === 'web';

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
    const lic = payload?.license;
    setLicenseNumber(lic?.license_number ?? '');
    const parsed = parseYyyyMmDd(lic?.license_valid_until ?? null);
    setValidUntilDate(parsed);
    setWebValidUntilStr(lic?.license_valid_until?.trim().slice(0, 10) ?? '');
    setPickedFile(null);
    setLicenseEditorOpen(false);
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onPickPdf = async () => {
    const picked = await pickLicensePdf();
    if (picked) setPickedFile(picked);
  };

  const onSave = async () => {
    if (!userId) return;

    let trimmedDate: string | null = null;
    if (isWeb) {
      const ws = webValidUntilStr.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ws)) {
        setErrorMessage('Datum važenja licence (GGGG-MM-DD) je obavezan.');
        return;
      }
      trimmedDate = ws;
    } else {
      if (!validUntilDate) {
        setErrorMessage('Datum važenja licence je obavezan.');
        return;
      }
      trimmedDate = toYyyyMmDd(validUntilDate);
    }

    const trimmedNumber = licenseNumber.trim() || null;
    if (!trimmedNumber && !pickedFile && !data?.license?.license_file_path) {
      setErrorMessage('Unesi broj licence ili izaberi PDF.');
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
    setLicenseEditorOpen(false);
    await load();
  };

  const p = data?.profile;
  const lic = data?.license;
  const leagues = data?.leagues ?? [];
  const canManage = data?.can_manage ?? false;

  const displayTitle =
    p?.display_name ||
    [p?.first_name, p?.last_name].filter(Boolean).join(' ') ||
    p?.username ||
    'Sudija';

  const chromeItems = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: 'Regije', path: '/savez' }];
    const l = leagues[0];
    if (l?.region_id != null) {
      items.push({
        label: l.region_name ?? `Regija #${l.region_id}`,
        path: `/savez/regija/${l.region_id}`,
      });
    }
    if (l?.league_id != null) {
      items.push({
        label: l.league_name ?? `Liga #${l.league_id}`,
        path: `/savez/liga/${l.league_id}`,
      });
    }
    items.push({ label: displayTitle });
    return items;
  }, [displayTitle, leagues]);

  useSyncTakmicenjeDrillChrome(syncDrillChrome && Boolean(p) && !loading, displayTitle, chromeItems);

  const licenseFormBlock = canManage && licenseEditorOpen ? (
    <>
      <ThemedView style={styles.divider} />
      <ThemedText type="defaultSemiBold">Podaci licence</ThemedText>
      <ThemedTextInput
        value={licenseNumber}
        onChangeText={setLicenseNumber}
        placeholder="Broj licence"
        style={styles.inputSpacing}
      />

      <ThemedText style={[styles.fieldHint, { color: colors.textSecondary }]}>
        Datum važenja (obavezno{isWeb ? ', GGGG-MM-DD' : ''})
      </ThemedText>
      <LicenseValidUntilField
        value={isWeb ? webValidUntilStr : validUntilDate ? toYyyyMmDd(validUntilDate) : ''}
        onChange={(s) => {
          const slice = s.trim().slice(0, 10);
          setWebValidUntilStr(slice);
          setValidUntilDate(parseYyyyMmDd(slice));
        }}
        style={styles.inputSpacing}
      />

      <Pressable style={styles.filledButton} onPress={onPickPdf}>
        <ThemedText style={styles.filledButtonText}>
          {pickedFile ? `PDF: ${pickedFile.name}` : 'Izaberi PDF'}
        </ThemedText>
      </Pressable>
      <Pressable
        style={[styles.filledButton, styles.saveFilled, saving && styles.buttonDisabled]}
        onPress={onSave}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.filledButtonText}>Sačuvaj licencu</ThemedText>
        )}
      </Pressable>
    </>
  ) : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!syncDrillChrome ? (
        <>
          <ThemedText type="title">{displayTitle}</ThemedText>
          <ThemedText style={styles.muted}>Profil sudije</ThemedText>
        </>
      ) : null}

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && p ? (
        <>
          <ThemedView style={[styles.card, styles.profileCard]}>
            <View style={styles.profileRow}>
              <View
                style={styles.avatarCol}
                onLayout={(e) => setAvatarSlotHeight(e.nativeEvent.layout.height)}>
                <MaterialIcons
                  name="person"
                  size={Math.min(
                    Math.max(Math.round(avatarSlotHeight * 0.9), 56),
                    160,
                  )}
                  color={colors.tint}
                />
              </View>
              <View style={styles.profileData}>
                <ThemedText type="subtitle">Lični podaci</ThemedText>
                <ThemedText>Username: {p.username ?? '-'}</ThemedText>
                <ThemedText>Ime: {p.first_name ?? '-'}</ThemedText>
                <ThemedText>Prezime: {p.last_name ?? '-'}</ThemedText>
                <ThemedText>Datum rođenja: {p.birth_date ?? '-'}</ThemedText>
                <ThemedText>Adresa: {p.address ?? '-'}</ThemedText>
                <ThemedText>Telefon: {p.phone ?? '-'}</ThemedText>
              </View>
            </View>
          </ThemedView>

          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setLigaExpanded((v) => !v)}
              style={[
                styles.chipFilled,
                {
                  backgroundColor: ligaExpanded ? ActionAccentHex : colors.surfaceMuted,
                },
              ]}>
              <ThemedText
                type="defaultSemiBold"
                style={{ color: ligaExpanded ? '#fff' : colors.text }}>
                Liga
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() =>
                setLicencaExpanded((v) => {
                  if (v) setLicenseEditorOpen(false);
                  return !v;
                })
              }
              style={[
                styles.chipFilled,
                {
                  backgroundColor: licencaExpanded ? ActionAccentHex : colors.surfaceMuted,
                },
              ]}>
              <ThemedText
                type="defaultSemiBold"
                style={{ color: licencaExpanded ? '#fff' : colors.text }}>
                Licenca
              </ThemedText>
            </Pressable>
          </View>

          {ligaExpanded ? (
            <ThemedView style={styles.expandCard}>
              <ThemedText type="defaultSemiBold">Pripadnost ligama</ThemedText>
              {leagues.length === 0 ? (
                <ThemedText>Sudija nije dodeljen nijednoj ligi.</ThemedText>
              ) : (
                leagues.map((l) => (
                  <ThemedText key={l.league_id}>
                    {l.league_name ?? `Liga #${l.league_id}`}
                    {l.region_name ? `  •  ${l.region_name}` : ''}
                  </ThemedText>
                ))
              )}
            </ThemedView>
          ) : null}

          {licencaExpanded ? (
            <ThemedView style={styles.expandCard}>
              {lic?.license_number || lic?.license_valid_until || lic?.license_file_path ? (
                <>
                  <ThemedText type="defaultSemiBold">Pregled licence</ThemedText>
                  <ThemedText>Broj licence: {lic?.license_number ?? '-'}</ThemedText>
                  <ThemedText>Važi do: {lic?.license_valid_until ?? '-'}</ThemedText>
                  <ThemedText style={styles.fileHint}>Fajl: {lic?.license_file_path ?? '-'}</ThemedText>
                  {lic?.license_file_path ? (
                    <Pressable style={styles.filledButton} onPress={() => openLicensePdf(lic.license_file_path)}>
                      <ThemedText style={styles.filledButtonText}>Otvori PDF</ThemedText>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <ThemedText style={styles.muted}>Nema unete licence.</ThemedText>
              )}

              {canManage ? (
                <Pressable style={styles.filledButton} onPress={() => setLicenseEditorOpen((v) => !v)}>
                  <ThemedText style={styles.filledButtonText}>
                    {licenseEditorOpen
                      ? 'Zatvori formu'
                      : lic?.license_file_path || lic?.license_number
                        ? 'Izmeni licencu'
                        : 'Dodaj licencu'}
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText style={styles.muted}>
                  Samo delegat lige i savez mogu da menjaju licencu sudije.
                </ThemedText>
              )}

              {licenseFormBlock}
            </ThemedView>
          ) : null}

        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 32 },
  card: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  profileCard: { paddingVertical: 12 },
  profileRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'stretch',
  },
  avatarCol: {
    width: 112,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileData: { flex: 1, gap: 4 },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  chipFilled: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  fieldHint: { fontSize: 13, marginTop: 4 },
  fileHint: { fontSize: 12 },
  filledButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: ActionAccentHex,
  },
  saveFilled: { marginTop: 4 },
  filledButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  divider: { height: 1, backgroundColor: '#ccc', marginVertical: 6 },
  muted: { color: '#888', fontStyle: 'italic' },
  errorText: { color: '#c53939' },
  inputSpacing: { marginTop: 6 },
  buttonDisabled: { opacity: 0.6 },
});
