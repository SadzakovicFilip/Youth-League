import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { sanitizeUsername } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type AppRole =
  | 'admin'
  | 'savez'
  | 'delegat'
  | 'klub'
  | 'trener'
  | 'igrac'
  | 'scout'
  | 'zapisnicar'
  | 'spectator';

const CANDIDATE_ROLES: AppRole[] = ['delegat', 'klub', 'zapisnicar', 'scout', 'trener'];

export default function DodajKorisnikaScreen() {
  const [allowedRoles, setAllowedRoles] = useState<AppRole[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    const loadAllowed = async () => {
      const checks = await Promise.all(
        CANDIDATE_ROLES.map(async (r) => {
          const { data, error } = await supabase.rpc('can_create_role', { p_target: r });
          return { role: r, allowed: !error && !!data };
        })
      );
      const allowed = checks.filter((c) => c.allowed).map((c) => c.role);
      setAllowedRoles(allowed);
      if (allowed.length > 0 && !role) {
        setRole(allowed[0]);
      }
    };
    loadAllowed();
  }, [role]);

  const onSubmit = async () => {
    if (!role || !username.trim() || !password.trim()) {
      setResult('Rola, username i password su obavezni.');
      return;
    }
    const safeUsername = sanitizeUsername(username);
    if (!safeUsername) {
      setResult('Username mora sadrzati slova/brojeve.');
      return;
    }
    setLoading(true);
    setResult('');

    const { data, error } = await supabase.functions.invoke('create-managed-user', {
      body: {
        role,
        username: safeUsername,
        password,
        display_name: displayName || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        birth_date: birthDate || undefined,
        address: address || undefined,
        phone: phone || undefined,
      },
    });

    if (error) {
      let raw = '';
      try {
        const text = await error.context?.text?.();
        raw = text ? ` | RAW: ${text}` : '';
      } catch {
        raw = '';
      }
      setResult(`ERROR: ${error.message}${raw}`);
      setLoading(false);
      return;
    }

    const newUserId = data?.user_id as string | undefined;
    setResult(`OK: Korisnik kreiran (${newUserId ?? '?'}).`);
    setUsername('');
    setPassword('');
    setDisplayName('');
    setFirstName('');
    setLastName('');
    setBirthDate('');
    setAddress('');
    setPhone('');
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">Dodaj korisnika</ThemedText>

      <ThemedText>Rola:</ThemedText>
      <ThemedView style={styles.chipRow}>
        {allowedRoles.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRole(r)}
            style={[styles.chip, role === r && styles.chipActive]}>
            <ThemedText style={role === r ? styles.chipActiveText : undefined}>{r}</ThemedText>
          </Pressable>
        ))}
        {allowedRoles.length === 0 ? (
          <ThemedText>Nemas prava za kreiranje korisnika.</ThemedText>
        ) : null}
      </ThemedView>

      <Field label="Username *" value={username} onChangeText={setUsername} placeholder="npr. delegat1" />
      <Field label="Password *" value={password} onChangeText={setPassword} secureTextEntry />
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
      <Field label="First name" value={firstName} onChangeText={setFirstName} />
      <Field label="Last name" value={lastName} onChangeText={setLastName} />
      <Field label="Birth date (YYYY-MM-DD)" value={birthDate} onChangeText={setBirthDate} />
      <Field label="Address" value={address} onChangeText={setAddress} />
      <Field label="Phone" value={phone} onChangeText={setPhone} />

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Kreiraj korisnika</ThemedText>
        )}
      </Pressable>

      {result ? (
        <ThemedView style={styles.card}>
          <ThemedText>{result}</ThemedText>
        </ThemedView>
      ) : null}
    </ScrollView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
};

function Field({ label, value, onChangeText, placeholder, secureTextEntry }: FieldProps) {
  return (
    <ThemedView style={styles.fieldGroup}>
      <ThemedText>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#888"
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        style={styles.input}
      />
    </ThemedView>
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
  fieldGroup: { gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#111',
    backgroundColor: '#fff',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  chipActiveText: { color: '#fff', fontWeight: '600' },
  button: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
});
