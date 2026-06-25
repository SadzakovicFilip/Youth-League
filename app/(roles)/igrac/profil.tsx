import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { IgracClanarineContent } from '@/components/igrac/igrac-clanarine-content';
import { IgracHubChips } from '@/components/igrac/igrac-hub-chips';
import { IgracStatistikaContent } from '@/components/igrac/igrac-statistika-content';
import { ScreenShell } from '@/components/screen-shell';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';

type ProfilChip = 'clanarine' | 'statistika';

const PROFIL_CHIPS = [
  { value: 'clanarine' as const, label: 'Članarine' },
  { value: 'statistika' as const, label: 'Statistika' },
];

export default function IgracProfilScreen() {
  const [chip, setChip] = useState<ProfilChip>('clanarine');
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
          <IgracHubChips value={chip} options={PROFIL_CHIPS} onChange={setChip} />

          {chip === 'statistika' ? (
            <IgracStatistikaContent embedded />
          ) : (
            <IgracClanarineContent embedded />
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
