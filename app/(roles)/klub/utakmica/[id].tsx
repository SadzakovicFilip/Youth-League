import { ScreenShell } from '@/components/screen-shell';
import { FinishedMatchPreferScorebook } from '@/components/shared/finished-match-prefer-scorebook';
import { useLocalSearchParams } from 'expo-router';

export default function KlubUtakmicaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);

  return (
    <ScreenShell>
      <FinishedMatchPreferScorebook matchId={matchId} />
    </ScreenShell>
  );
}
