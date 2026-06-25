import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ClubTeamView } from '@/components/shared/club-team-view';
import { getMyClubContext } from '@/lib/club-context';

export default function KlubKlubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = Number(id);
  const [ownClubId, setOwnClubId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await getMyClubContext();
      if (cancelled) return;
      setOwnClubId(data?.clubId ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isOwnClub = ownClubId != null && ownClubId === clubId;

  return (
    <ClubTeamView
      clubId={clubId}
      showMemberFees={isOwnClub}
      showLicenseRow={isOwnClub}
      onOpenUser={(userId, cid) =>
        router.push(`/klub/korisnik/${userId}?clubId=${cid}` as never)
      }
    />
  );
}
