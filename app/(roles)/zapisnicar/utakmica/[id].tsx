import { MatchScorebookDetailView } from '@/components/match-scorebook-detail-view';
import { useLocalSearchParams } from 'expo-router';

export default function ZapisnicarMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MatchScorebookDetailView matchId={Number(id)} />;
}
