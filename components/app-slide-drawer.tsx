import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppDrawer } from '@/contexts/app-drawer-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveProfileHrefFromPathname } from '@/lib/resolve-profile-href';

const DRAWER_W = Math.min(300, Dimensions.get('window').width * 0.82);

export function AppSlideDrawer() {
  const { open, closeDrawer } = useAppDrawer();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, slide]);

  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_W, 0],
  });

  const profileHref = resolveProfileHrefFromPathname(pathname);

  const goProfile = () => {
    if (profileHref) {
      closeDrawer();
      router.push(profileHref as never);
    }
  };

  return (
    <Modal visible={open} animationType="none" transparent onRequestClose={closeDrawer}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={closeDrawer} accessibilityLabel="Zatvori meni" />
        <Animated.View
          style={[
            styles.panel,
            {
              width: DRAWER_W,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 16,
              backgroundColor: c.surface,
              borderRightColor: c.border,
              transform: [{ translateX }],
            },
          ]}>
          <View style={styles.panelHeader}>
            <Ionicons name="basketball" size={28} color={c.tint} />
            <Text style={[styles.panelTitle, { color: c.text }]}>Meni</Text>
          </View>
          {profileHref ? (
            <Pressable
              onPress={goProfile}
              style={[styles.row, { borderColor: c.border }]}
              accessibilityRole="button"
              accessibilityLabel="Profil">
              <Ionicons name="person-circle-outline" size={22} color={c.tint} />
              <Text style={[styles.rowLabel, { color: c.text }]}>Profil</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={closeDrawer}
            style={[styles.rowMuted, { borderColor: c.border }]}
            accessibilityRole="button">
            <Ionicons name="close-circle-outline" size={22} color={c.textMuted} />
            <Text style={[styles.rowLabel, { color: c.textSecondary }]}>Zatvori</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    zIndex: 2,
    elevation: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  rowMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
});
