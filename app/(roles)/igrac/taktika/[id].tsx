import { Redirect, useLocalSearchParams } from 'expo-router';

import { IgracTaktikaDetailView } from '@/components/igrac/igrac-taktika-detail-view';

export default function IgracTaktikaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tacticId = Number(id);
  if (!id || !Number.isFinite(tacticId)) {
    return <Redirect href="/igrac" />;
  }
  return <IgracTaktikaDetailView tacticId={tacticId} />;
}
