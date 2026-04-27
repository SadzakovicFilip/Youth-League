import { router, useLocalSearchParams } from 'expo-router';

import { SudijaDetailView } from '@/components/shared/sudija-detail-view';

export default function SavezSudijaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SudijaDetailView userId={String(id)} onBack={() => router.back()} />;
}
