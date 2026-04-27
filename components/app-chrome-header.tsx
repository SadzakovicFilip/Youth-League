import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppDrawerOptional } from '@/contexts/app-drawer-context';
import { useAuthHeaderOptional } from '@/contexts/auth-header-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

const HEADER_H = 52;

async function performLogout() {
  await supabase.auth.signOut();
  router.replace('/login');
}

export function AppChromeHeader() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const auth = useAuthHeaderOptional();
  const drawer = useAppDrawerOptional();
  const [logoutVisible, setLogoutVisible] = useState(false);

  const title = auth ? (auth.loading ? '…' : auth.displayName || 'Korisnik') : 'Korisnik';

  const onOpenMenu = () => drawer?.openDrawer();

  const onConfirmLogout = () => {
    setLogoutVisible(false);
    void performLogout();
  };

  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      <Pressable
        onPress={onOpenMenu}
        style={styles.sideBtn}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Otvori meni">
        <Ionicons name="basketball" size={26} color={c.tint} />
      </Pressable>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
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
    fontSize: 16,
    fontWeight: '600',
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
