import { router, useLocalSearchParams } from 'expo-router';

import { ClubTeamView } from '@/components/shared/club-team-view';

export default function SavezKlubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);

  return (
    <ClubTeamView
      clubId={clubId}
      showMemberFees={false}
      onOpenUser={(userId, cid) =>
        router.push(`/savez/korisnik/${userId}?clubId=${cid}` as never)
      }
      syncDrillChrome
    />
  );
}
