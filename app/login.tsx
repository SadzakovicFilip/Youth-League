import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usernameToEmail } from '@/lib/auth';
import { getRoleHomeRoute } from '@/lib/role-home-route';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onLogin = async () => {
    if (!username.trim() || !password) {
      setErrorMessage('Unesi username i password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const tried = new Set<string>();
    let error: { message: string } | null = null;

    const attempt = async (email: string | null | undefined) => {
      if (!email) return false;
      const normalized = email.toLowerCase().trim();
      if (!normalized || tried.has(normalized)) return false;
      tried.add(normalized);
      const res = await supabase.auth.signInWithPassword({ email: normalized, password });
      error = res.error;
      return !res.error;
    };

    // 1) Pokusaj sa stvarnim auth email-om iz baze (resava razlike u formiranju email-a
    //    kada username nema tacku, i slicne edge case-ove)
    const { data: resolvedEmail } = await supabase.rpc('get_login_email', { p_username: username });
    const ok1 = await attempt(typeof resolvedEmail === 'string' ? resolvedEmail : null);

    // 2) Fallback: sinteticki email koji pravimo iz username-a
    const primaryEmail = usernameToEmail(username);
    const ok2 = ok1 || (await attempt(primaryEmail));

    // 3) Legacy: korisnik je uneo pun email
    if (!ok2 && username.includes('@')) {
      await attempt(username);
    }

    if (error) {
      setLoading(false);
      setErrorMessage(`${error.message}. Probaj i sa punim email-om ako je korisnik ručno kreiran.`);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setErrorMessage('Login je prosao, ali sesija nije dostupna. Pokusaj ponovo.');
      return;
    }

    const { data: roleRow } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    const route = getRoleHomeRoute(roleRow?.role ?? '');

    setLoading(false);
    router.replace(route ?? '/(tabs)');
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.card}>
        <ThemedText type="title">Login</ThemedText>
        <ThemedText style={styles.subtitle}>Prijava preko username + password</ThemedText>

        <TextInput
          placeholder="Username"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="username"
          textContentType="username"
          keyboardType="email-address"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={onLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Sign in</ThemedText>}
        </Pressable>

        {errorMessage ? <ThemedText style={styles.error}>{errorMessage}</ThemedText> : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 10,
  },
  subtitle: {
    opacity: 0.8,
    marginBottom: 4,
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
    marginTop: 6,
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
  error: {
    color: '#c53939',
  },
});
