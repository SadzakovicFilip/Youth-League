import { router, useLocalSearchParams } from 'expo-router';

import { ClubTeamView } from '@/components/shared/club-team-view';

export default function DelegatKlubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);

  return (
    <ClubTeamView
      clubId={clubId}
      onBack={() => router.back()}
      onOpenUser={(userId) => router.push(`/delegat/korisnik/${userId}`)}
    />
  );
}
