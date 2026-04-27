import { router, useLocalSearchParams } from 'expo-router';

import { ClubTeamView } from '@/components/shared/club-team-view';

export default function IgracKlubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);

  return (
    <ClubTeamView
      clubId={clubId}
      onBack={() => router.back()}
      onOpenUser={(userId) => router.push(`/igrac/korisnik/${userId}`)}
    />
  );
}
