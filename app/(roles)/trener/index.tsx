import { ActionAccentHex } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { ScreenShell } from '@/components/screen-shell';
import { TrenerTaktikeContent } from '@/components/trener/trener-taktike-content';
import { TrenerTreninziContent } from '@/components/trener/trener-treninzi-content';
import { ThemedText } from '@/components/themed-text';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';

type HubChip = 'treninzi' | 'taktike';

export default function TrenerHubScreen() {
  const { colors } = useAppTheme();
  const [chip, setChip] = useState<HubChip>('treninzi');

  useScreenPullRefresh(useCallback(() => Promise.resolve(), []));

  return (
    <ScreenShell disableKeyboardAvoiding>
      <View style={styles.hubFill}>
        <RefreshableScrollView
          style={styles.hubScroll}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
        <View style={styles.chipRow}>
          <Pressable
            style={[
              styles.chipFilled,
              {
                backgroundColor: chip === 'treninzi' ? ActionAccentHex : colors.surfaceMuted,
                borderColor: chip === 'treninzi' ? ActionAccentHex : colors.borderStrong,
              },
            ]}
            onPress={() => setChip('treninzi')}>
            <ThemedText
              type="defaultSemiBold"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{
                color: chip === 'treninzi' ? '#fff' : colors.text,
                fontSize: 11,
                letterSpacing: 0.15,
                textAlign: 'center',
              }}>
              Treninzi
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.chipFilled,
              {
                backgroundColor: chip === 'taktike' ? ActionAccentHex : colors.surfaceMuted,
                borderColor: chip === 'taktike' ? ActionAccentHex : colors.borderStrong,
              },
            ]}
            onPress={() => setChip('taktike')}>
            <ThemedText
              type="defaultSemiBold"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{
                color: chip === 'taktike' ? '#fff' : colors.text,
                fontSize: 11,
                letterSpacing: 0.15,
                textAlign: 'center',
              }}>
              Taktike
            </ThemedText>
          </Pressable>
        </View>

        {chip === 'treninzi' ? <TrenerTreninziContent embedded /> : <TrenerTaktikeContent embedded />}
        </RefreshableScrollView>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hubFill: { flex: 1 },
  hubScroll: { flex: 1 },
  container: { gap: 15, padding: 16, paddingBottom: 24 },
  chipRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
  },
  chipFilled: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});
