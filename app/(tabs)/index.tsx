import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getRoleHomeRoute } from '@/lib/role-home-route';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [result, setResult] = useState('');
  const [myRole, setMyRole] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);

  useEffect(() => {
    const loadPermissions = async () => {
      setLoadingRoles(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAllowedRoles([]);
        setMyRole('');
        setLoadingRoles(false);
        return;
      }

      const { data: roleRow, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError || !roleRow?.role) {
        setAllowedRoles([]);
        setMyRole('');
        setLoadingRoles(false);
        return;
      }

      setMyRole(roleRow.role);

      const { data: rules, error: rulesError } = await supabase
        .from('role_creation_rules')
        .select('child_role')
        .eq('parent_role', roleRow.role);

      if (rulesError || !rules) {
        setAllowedRoles([]);
        setRole('');
        setLoadingRoles(false);
        return;
      }

      const uniqueChildRoles = [...new Set(rules.map((rule) => rule.child_role).filter(Boolean))];
      setAllowedRoles(uniqueChildRoles);
      setRole(uniqueChildRoles[0] ?? '');
      setLoadingRoles(false);
    };

    loadPermissions();
  }, []);

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const onOpenRoleDashboard = () => {
    const route = myRole ? getRoleHomeRoute(myRole) : null;
    if (!route) {
      setResult('Trenutna rola nema mapiran dashboard route.');
      return;
    }
    router.push(route);
  };

  const onCreateManagedUser = async () => {
    if (!role || !username || !password) {
      setResult('Role, username i password su obavezni.');
      return;
    }
    if (!allowedRoles.includes(role)) {
      setResult('Nemate dozvolu da kreirate ovu rolu.');
      return;
    }

    setLoading(true);
    setResult('');

    const { data, error } = await supabase.functions.invoke('create-managed-user', {
      body: {
        role,
        username,
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
      let rawDetails = '';
      try {
        const rawText = await error.context?.text?.();
        rawDetails = rawText ? ` | RAW: ${rawText}` : '';
      } catch {
        rawDetails = '';
      }

      setResult(`ERROR: ${error.message}${rawDetails}`);
      setLoading(false);
      return;
    }

    setResult(`OK: ${JSON.stringify(data)}`);
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Create Managed User (Test)</ThemedText>
      <ThemedText style={styles.helpText}>
        Ovaj ekran je privremeni test za Edge funkciju `create-managed-user`.
      </ThemedText>
      {myRole ? <ThemedText>Ulogovana rola: {myRole}</ThemedText> : null}
      <Pressable style={styles.secondaryButton} onPress={() => router.push('/home')}>
        <ThemedText style={styles.secondaryButtonText}>Open shared home</ThemedText>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onOpenRoleDashboard}>
        <ThemedText style={styles.secondaryButtonText}>Open my role dashboard</ThemedText>
      </Pressable>

      {loadingRoles ? (
        <View style={styles.centerRow}>
          <ActivityIndicator />
        </View>
      ) : allowedRoles.length === 0 ? (
        <ThemedView style={styles.resultBox}>
          <ThemedText>Ova rola nema dozvolu za kreiranje novih korisnika.</ThemedText>
        </ThemedView>
      ) : (
        <>
          <ThemedView style={styles.fieldGroup}>
            <ThemedText>Role *</ThemedText>
            <View style={styles.roleList}>
              {allowedRoles.map((roleOption) => (
                <Pressable
                  key={roleOption}
                  onPress={() => setRole(roleOption)}
                  style={[styles.roleChip, role === roleOption && styles.roleChipActive]}>
                  <ThemedText style={role === roleOption ? styles.roleChipTextActive : undefined}>{roleOption}</ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          <Field label="Username *" value={username} onChangeText={setUsername} placeholder="npr. delegat.test1" />
          <Field
            label="Password *"
            value={password}
            onChangeText={setPassword}
            placeholder="Strong password"
            secureTextEntry
          />
          <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
          <Field label="First name" value={firstName} onChangeText={setFirstName} />
          <Field label="Last name" value={lastName} onChangeText={setLastName} />
          <Field label="Birth date (YYYY-MM-DD)" value={birthDate} onChangeText={setBirthDate} />
          <Field label="Address" value={address} onChangeText={setAddress} />
          <Field label="Phone" value={phone} onChangeText={setPhone} />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onCreateManagedUser}
            disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Create user</ThemedText>}
          </Pressable>
        </>
      )}
      <Pressable style={styles.secondaryButton} onPress={onLogout}>
        <ThemedText style={styles.secondaryButtonText}>Logout</ThemedText>
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
  onChangeText: (text: string) => void;
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
        autoCorrect={false}
        spellCheck={false}
        style={styles.input}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 16,
    paddingBottom: 32,
  },
  helpText: {
    opacity: 0.8,
    marginBottom: 4,
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
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  centerRow: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: '#777',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleChipActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#0a7ea4',
  },
  roleChipTextActive: {
    color: '#fff',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  resultBox: {
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
  },
});
