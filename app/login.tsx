import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { BasketballBrandMark } from '@/components/basketball-brand-mark';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { usernameToEmail } from '@/lib/auth';
import { getRoleHomeRoute } from '@/lib/role-home-route';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const accent = useThemeColor({}, 'accent');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const danger = useThemeColor({}, 'danger');

  const sportsTitleFont = Platform.select({
    ios: { fontFamily: 'AvenirNext-Heavy' as const },
    android: { fontFamily: 'sans-serif-condensed', fontWeight: '800' as const },
    default: { fontWeight: '900' as const },
  });

  useScreenPullRefresh(
    useCallback(async () => {
      await supabase.auth.getSession();
    }, []),
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

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    const route = getRoleHomeRoute(roleRow?.role ?? '');

    setLoading(false);
    router.replace((route ?? '/(tabs)') as never);
  };

  return (
    <ScreenShell edges={['left', 'right', 'bottom']} disableKeyboardAvoiding>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <RefreshableScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <BasketballBrandMark size="lg" />
            <ThemedText style={[styles.sportsTitle, sportsTitleFont, { color: text }]}>
              Košarkaška Liga Srbije
            </ThemedText>
          </View>

          <ThemedView
            style={[styles.card, { backgroundColor: surface, borderColor: border, marginTop: 25 }]}>
            <ThemedText type="subtitle">Prijava</ThemedText>

            <ThemedTextInput
              placeholder="Username"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="username"
              textContentType="username"
              keyboardType="email-address"
              value={username}
              onChangeText={setUsername}
              style={styles.loginField}
            />

            <View style={styles.passwordWrap}>
              <ThemedTextInput
                placeholder="Password"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                style={[styles.loginField, styles.passwordInput]}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setPasswordVisible((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Sakrij lozinku' : 'Prikaži lozinku'}>
                <MaterialIcons
                  name={passwordVisible ? 'visibility' : 'visibility-off'}
                  size={22}
                  color={textMuted}
                />
              </Pressable>
            </View>

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
        </RefreshableScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 20,
  },
  hero: { alignItems: 'center', gap: 8 },
  sportsTitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: Platform.OS === 'ios' ? 0.8 : 1.2,
    textTransform: 'uppercase',
  },
  card: {
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderRadius: 16,
  },
  loginField: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordWrap: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
