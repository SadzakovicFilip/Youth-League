import { ActionAccentHex } from '@/constants/theme';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { LicenseValidUntilField } from '@/components/license-valid-until-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { sanitizeUsername } from '@/lib/auth';
import { pickLicensePdf, saveUserLicense, uploadLicensePdf } from '@/lib/license-upload';
import { supabase } from '@/lib/supabase';

type Props = {
  leagueId: number;
  leagueName?: string | null;
  onCreated: () => void | Promise<void>;
  onError: (message: string) => void;
};

export function DelegatCreateSudijaForm({ leagueId, leagueName, onCreated, onError }: Props) {
  const { colors } = useAppTheme();
  const [sUsername, setSUsername] = useState('');
  const [sPassword, setSPassword] = useState('');
  const [sFirstName, setSFirstName] = useState('');
  const [sLastName, setSLastName] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sLicenseNumber, setSLicenseNumber] = useState('');
  const [sLicenseValidUntil, setSLicenseValidUntil] = useState('');
  const [sPickedFile, setSPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onPickSudijaPdf = async () => {
    const picked = await pickLicensePdf();
    if (picked) setSPickedFile(picked);
  };

  const onCreateSudija = async () => {
    if (!sUsername.trim() || !sPassword.trim()) {
      onError('Username i password sudije su obavezni.');
      return;
    }
    const safeUsername = sanitizeUsername(sUsername);
    if (!safeUsername) {
      onError('Username mora sadržati slova/brojeve.');
      return;
    }

    const trimmedNumber = sLicenseNumber.trim() || null;
    const trimmedValidUntil = sLicenseValidUntil.trim() || null;
    if ((trimmedNumber || trimmedValidUntil) && !sPickedFile) {
      onError('Za snimanje licence izaberi PDF (broj i datum idu uz fajl).');
      return;
    }

    setSubmitting(true);
    onError('');

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
      onError(`Sudija: ${fnErr.message}${raw}`);
      setSubmitting(false);
      return;
    }

    const newUserId =
      (created as { user_id?: string; id?: string } | null)?.user_id ??
      (created as { user_id?: string; id?: string } | null)?.id ??
      null;

    if (!newUserId) {
      onError('Sudija kreiran ali nije vraćen user_id.');
      setSubmitting(false);
      return;
    }

    const { error: linkErr } = await supabase
      .from('league_sudije')
      .insert({ league_id: leagueId, user_id: newUserId });

    if (linkErr) {
      onError(`Sudija kreiran, ali nije vezan za ligu: ${linkErr.message}`);
      setSubmitting(false);
      return;
    }

    if (sPickedFile) {
      const { path, error: upErr } = await uploadLicensePdf(newUserId, sPickedFile);
      if (upErr) {
        onError(`Sudija kreiran, ali licenca nije snimljena: ${upErr}`);
        setSubmitting(false);
        await onCreated();
        return;
      }
      const { error: licErr } = await saveUserLicense({
        userId: newUserId,
        validUntil: trimmedValidUntil,
        licenseFilePath: path,
        licenseNumber: trimmedNumber,
      });
      if (licErr) {
        onError(`Sudija kreiran, ali licenca nije snimljena: ${licErr}`);
        setSubmitting(false);
        await onCreated();
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
    setSubmitting(false);
    await onCreated();
  };

  return (
    <ThemedView style={[styles.card, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
      <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
        Nalog sudije
      </ThemedText>
      {leagueName ? (
        <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
          Liga: {leagueName}
        </ThemedText>
      ) : null}
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

      <ThemedText type="defaultSemiBold" style={[styles.subSection, { color: colors.text }]}>
        Licenca (opciono)
      </ThemedText>
      <ThemedText style={{ color: colors.textSecondary, fontSize: 12 }}>
        PDF je obavezan samo ako unosiš broj licence ili datum važenja.
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
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  inputSpacing: { marginTop: 6 },
  subSection: { marginTop: 6 },
  button: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ActionAccentHex,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700' },
  smallButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  smallButtonText: { color: ActionAccentHex, fontWeight: '600' },
});
