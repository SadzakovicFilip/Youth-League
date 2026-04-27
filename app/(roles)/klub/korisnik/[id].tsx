import { router, useLocalSearchParams } from 'expo-router';

import { UserDetailView } from '@/components/shared/user-detail-view';

export default function KlubKorisnikDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <UserDetailView userId={String(id)} onBack={() => router.back()} />;
}
