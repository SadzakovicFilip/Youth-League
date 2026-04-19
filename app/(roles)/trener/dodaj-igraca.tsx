import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { sanitizeUsername } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function DodajIgracaScreen() {
  const [clubId, setClubId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [trainerClubIds, setTrainerClubIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    const loadTrainerClubs = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from('club_memberships')
        .select('club_id')
        .eq('user_id', user.id)
        .eq('member_role', 'trener')
        .eq('active', true);

      if (error) {
        return;
      }

      const ids = [...new Set((data ?? []).map((row) => row.club_id))];
      setTrainerClubIds(ids);
      if (!clubId && ids.length > 0) {
        setClubId(String(ids[0]));
      }
    };

    loadTrainerClubs();
  }, [clubId]);

  const onCreatePlayer = async () => {
    if (!clubId.trim() || !username.trim() || !password.trim()) {
      setResult('Club ID, username i password su obavezni.');
      return;
    }

    const parsedClubId = Number(clubId);
    if (!Number.isInteger(parsedClubId) || parsedClubId <= 0) {
      setResult('Club ID mora biti pozitivan broj.');
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
        role: 'igrac',
        username: safeUsername,
        password,
        display_name: displayName || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        birth_date: birthDate || undefined,
        address: address || undefined,
        phone: phone || undefined,
        club_id: parsedClubId,
        member_role: 'igrac',
      },
    });

    if (error) {
      let rawDetails = '';
      try {
        const rawText = await error.context?.text?.();
        rawDetails = rawText ? ` | RAW: ${rawText}` : '';
      } catch {
        rawDetails = '';
      }
      setResult(`ERROR create-managed-user: ${error.message}${rawDetails}`);
      setLoading(false);
      return;
    }

    const newUserId = data?.user_id as string | undefined;
    if (!newUserId) {
      setResult('ERROR: user_id nije vracen iz edge funkcije.');
      setLoading(false);
      return;
    }

    const membershipOk = data?.membership_created === true;
    if (!membershipOk) {
      setResult(
        `Igrac je kreiran, ali membership nije potvrdjen iz edge funkcije. Proveri logove.`
      );
      setLoading(false);
      return;
    }

    setResult(`OK: Igrac kreiran i dodat u klub ${parsedClubId}.`);
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>

      <ThemedText type="title">Dodaj igraca</ThemedText>
      <ThemedText>
        Forma kreira igraca i upisuje `club_memberships` sa `member_role = igrac`.
      </ThemedText>

      <ThemedText>Moji klubovi (trener): {trainerClubIds.length ? trainerClubIds.join(', ') : '-'}</ThemedText>

      <Field label="Club ID *" value={clubId} onChangeText={setClubId} keyboardType="number-pad" />
      <Field label="Username *" value={username} onChangeText={setUsername} placeholder="npr. igrac42" />
      <Field label="Password *" value={password} onChangeText={setPassword} secureTextEntry />
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
      <Field label="First name" value={firstName} onChangeText={setFirstName} />
      <Field label="Last name" value={lastName} onChangeText={setLastName} />
      <Field label="Birth date (YYYY-MM-DD)" value={birthDate} onChangeText={setBirthDate} />
      <Field label="Address" value={address} onChangeText={setAddress} />
      <Field label="Phone" value={phone} onChangeText={setPhone} />

      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={onCreatePlayer} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Kreiraj igraca</ThemedText>}
      </Pressable>

      {result ? (
        <ThemedView style={styles.resultBox}>
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
  keyboardType?: 'default' | 'number-pad';
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
}: FieldProps) {
  return (
    <ThemedView style={styles.fieldGroup}>
      <ThemedText>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#888"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={styles.input}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 16,
    paddingBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: {
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 6,
  },
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
    marginTop: 8,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  resultBox: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
  },
});
