import { StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { IgracLigaContent } from '@/components/igrac/igrac-liga-content';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';

export default function IgracLigaScreen() {
  const { reload } = useIgracDashboard();
  useScreenPullRefresh(reload);
  return (
    <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <IgracLigaContent />
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 15, padding: 16, paddingBottom: 24 },
});
