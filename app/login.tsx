import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { BasketballBrandMark } from '@/components/basketball-brand-mark';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usernameToEmail } from '@/lib/auth';
import { getRoleHomeRoute } from '@/lib/role-home-route';
import { supabase } from '@/lib/supabase';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const accent = useThemeColor({}, 'accent');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const inputBg = useThemeColor({}, 'inputBackground');
  const inputBorder = useThemeColor({}, 'inputBorder');
  const textMain = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const danger = useThemeColor({}, 'danger');

  const inputStyles = useMemo(
    () => [
      styles.input,
      {
        color: textMain,
        backgroundColor: inputBg,
        borderColor: inputBorder,
      },
    ],
    [textMain, inputBg, inputBorder]
  );

  const onLogin = async () => {
    if (!username.trim() || !password) {
      setErrorMessage('Unesi username i password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const tried = new Set<string>();
    let lastErrorMessage: string | null = null;

    const attempt = async (email: string | null | undefined) => {
      if (!email) return false;
      const normalized = email.toLowerCase().trim();
      if (!normalized || tried.has(normalized)) return false;
      tried.add(normalized);
      const res = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (res.error) lastErrorMessage = res.error.message;
      else lastErrorMessage = null;
      return !res.error;
    };

    const { data: resolvedEmail } = await supabase.rpc('get_login_email', {
      p_username: username,
    });
    const ok1 = await attempt(typeof resolvedEmail === 'string' ? resolvedEmail : null);

    const primaryEmail = usernameToEmail(username);
    const ok2 = ok1 || (await attempt(primaryEmail));

    if (!ok2 && username.includes('@')) {
      await attempt(username);
    }

    if (lastErrorMessage) {
      setLoading(false);
      setErrorMessage(
        `${lastErrorMessage}. Probaj i sa punim email-om ako je korisnik ručno kreiran.`,
      );
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
    router.replace((route ?? '/(tabs)') as never);
  };

  return (
    <ScreenShell edges={['left', 'right', 'bottom']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <BasketballBrandMark size="lg" />
          <ThemedText type="title" style={styles.title}>
            Youth League
          </ThemedText>
          <ThemedText style={[styles.tagline, { color: textMuted }]}>
            Prijava u kosarkašku ligu
          </ThemedText>
        </View>

        <ThemedView style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <ThemedText type="subtitle">Prijava</ThemedText>
          <ThemedText style={[styles.subtitle, { color: textMuted }]}>
            Username i lozinka (sintetički email se rešava automatski)
          </ThemedText>

          <TextInput
            placeholder="Username"
            placeholderTextColor={textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="username"
            textContentType="username"
            keyboardType="email-address"
            value={username}
            onChangeText={setUsername}
            style={inputStyles}
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor={textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={inputStyles}
          />

          <Pressable
            style={[styles.button, { backgroundColor: accent }, loading && styles.buttonDisabled]}
            onPress={onLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Prijavi se</ThemedText>
            )}
          </Pressable>

          {errorMessage ? (
            <ThemedText style={[styles.error, { color: danger }]}>{errorMessage}</ThemedText>
          ) : null}
        </ThemedView>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 20,
  },
  hero: { alignItems: 'center', gap: 8 },
  title: { marginTop: 8, textAlign: 'center' },
  tagline: { fontSize: 15, textAlign: 'center' },
  card: {
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderRadius: 16,
  },
  subtitle: { marginBottom: 4, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    marginTop: 6,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { marginTop: 4, fontSize: 14 },
});
