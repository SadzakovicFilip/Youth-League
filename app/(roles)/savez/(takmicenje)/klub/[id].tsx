import { router, useLocalSearchParams } from 'expo-router';

import { ClubTeamView } from '@/components/shared/club-team-view';

export default function SavezKlubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);

  return (
    <ClubTeamView
      clubId={clubId}
      onBack={() => router.back()}
      onOpenUser={(userId) => router.push(`/savez/korisnik/${userId}`)}
    />
  );
}
