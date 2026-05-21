import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppDrawerOptional } from '@/contexts/app-drawer-context';
import { useAuthHeaderOptional } from '@/contexts/auth-header-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveChromeLeftMode } from '@/lib/chrome-left-mode';
import { supabase } from '@/lib/supabase';

const HEADER_H = 56;

async function performLogout() {
  await supabase.auth.signOut();
  router.replace('/login');
}

type AppChromeHeaderProps = {
  /** Kada je postavljeno (npr. na prvom/ drugom tabu), prikazuje se umesto display name-a. */
  centerTitle?: string;
};

export function AppChromeHeader({ centerTitle }: AppChromeHeaderProps = {}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const auth = useAuthHeaderOptional();
  const drawer = useAppDrawerOptional();
  const pathname = usePathname();
  const leftMode = resolveChromeLeftMode(pathname);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const userTitle = auth ? (auth.loading ? '…' : auth.displayName || 'Korisnik') : 'Korisnik';
  const title = centerTitle?.trim() ? centerTitle.trim() : userTitle;

  const titleFont = Platform.select({
    ios: { fontFamily: 'AvenirNext-Bold' },
    android: { fontFamily: 'sans-serif-medium', fontWeight: '700' as const },
    default: { fontWeight: '800' as const },
  });

  const onLeftPress = () => {
    if (leftMode === 'drawer') {
      drawer?.openDrawer();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  };

  const onConfirmLogout = () => {
    setLogoutVisible(false);
    void performLogout();
  };

  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      <Pressable
        onPress={onLeftPress}
        style={styles.sideBtn}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={leftMode === 'drawer' ? 'Otvori meni' : 'Nazad'}>
        <Ionicons
          name={leftMode === 'drawer' ? 'person-outline' : 'chevron-back'}
          size={24}
          color={c.tint}
        />
      </Pressable>
      <Text
        style={[styles.title, titleFont, { color: c.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}>
        {title}
      </Text>
      <Pressable
        onPress={() => setLogoutVisible(true)}
        style={styles.sideBtn}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Odjavi se">
        <Ionicons name="log-out-outline" size={24} color={c.tint} />
      </Pressable>

      <Modal
        visible={logoutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setLogoutVisible(false)} />
          <ThemedView
            style={[
              styles.modalCard,
              { backgroundColor: c.surface, borderColor: c.border, zIndex: 1 },
            ]}>
            <ThemedText type="subtitle" style={{ color: c.text }}>
              Odjava
            </ThemedText>
            <ThemedText style={[styles.modalBody, { color: c.textSecondary }]}>
              Da li ste sigurni da želite da se izlogujete?
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setLogoutVisible(false)}
                style={[styles.modalBtnSecondary, { borderColor: c.border }]}>
                <ThemedText style={{ color: c.text, fontWeight: '600' }}>Otkaži</ThemedText>
              </Pressable>
              <Pressable
                onPress={onConfirmLogout}
                style={[styles.modalBtnPrimary, { backgroundColor: c.danger }]}>
                <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Izloguj se</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sideBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    letterSpacing: 0.25,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
});
