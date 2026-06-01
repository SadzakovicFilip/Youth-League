import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { IgracHubChips } from '@/components/igrac/igrac-hub-chips';
import { IgracPrisustvoContent } from '@/components/igrac/igrac-prisustvo-content';
import { IgracTaktikeContent } from '@/components/igrac/igrac-taktike-content';
import { ScreenShell } from '@/components/screen-shell';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';

type HubChip = 'prisustvo' | 'taktike';

const HUB_CHIPS = [
  { value: 'prisustvo' as const, label: 'Prisustvo' },
  { value: 'taktike' as const, label: 'Taktike' },
];

export default function IgracTreninziHubScreen() {
  const [chip, setChip] = useState<HubChip>('prisustvo');
  const { reload } = useIgracDashboard();

  useScreenPullRefresh(reload);

  return (
    <ScreenShell disableKeyboardAvoiding>
      <View style={styles.hubFill}>
        <RefreshableScrollView
          style={styles.hubScroll}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <IgracHubChips value={chip} options={HUB_CHIPS} onChange={setChip} />

          {chip === 'prisustvo' ? (
            <IgracPrisustvoContent embedded />
          ) : (
            <IgracTaktikeContent embedded />
          )}
        </RefreshableScrollView>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hubFill: { flex: 1 },
  hubScroll: { flex: 1 },
  container: { gap: 15, padding: 16, paddingBottom: 24 },
});
