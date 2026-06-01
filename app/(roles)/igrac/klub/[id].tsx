import { router, useLocalSearchParams } from 'expo-router';

import { ClubTeamView } from '@/components/shared/club-team-view';

export default function IgracKlubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);

  return (
    <ClubTeamView
      clubId={clubId}
      showMemberFees={false}
      showLicenseRow={false}
      onOpenUser={(userId, cid) =>
        router.push(`/igrac/korisnik/${userId}?clubId=${cid}` as never)
      }
    />
  );
}
