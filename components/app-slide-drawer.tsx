import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppDrawerProfilePanel } from '@/components/app-drawer-profile-panel';
import { useAppDrawer } from '@/contexts/app-drawer-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { appFeedbackTouchHandlers } from '@/lib/app-feedback-touch';

const DRAWER_W = Math.min(340, Dimensions.get('window').width * 0.88);

export function AppSlideDrawer() {
  const { open, closeDrawer } = useAppDrawer();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
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

  return (
    <Modal visible={open} animationType="none" transparent onRequestClose={closeDrawer}>
      <View style={styles.modalRoot} {...appFeedbackTouchHandlers}>
        <Pressable style={styles.backdrop} onPress={closeDrawer} accessibilityLabel="Zatvori meni" />
        <Animated.View
          style={[
            styles.panel,
            {
              width: DRAWER_W,
              paddingTop: 0,
              paddingBottom: 0,
              paddingHorizontal: 0,
              backgroundColor: c.surface,
              borderRightColor: c.border,
              transform: [{ translateX }],
            },
          ]}>
          <View
            style={[
              styles.panelFill,
              {
                paddingTop: insets.top,
                paddingBottom: insets.bottom + 8,
                paddingHorizontal: 20,
              },
            ]}>
            <AppDrawerProfilePanel open={open} />
          </View>
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
    paddingHorizontal: 0,
    zIndex: 2,
    elevation: 8,
    flexDirection: 'column',
  },
  panelFill: {
    flex: 1,
    minHeight: 0,
  },
});
