import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { KlubMemberDetailView } from '@/components/klub/klub-member-detail-view';
import { getMyClubContext } from '@/lib/club-context';

function parseOverviewClubId(raw: string | string[] | undefined): number | undefined {
  if (raw == null) return undefined;
  const s = Array.isArray(raw) ? raw[0] : String(raw);
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : undefined;
}

export default function KlubKorisnikDetailScreen() {
  const { id, clubId } = useLocalSearchParams<{ id: string; clubId?: string }>();
  const overviewClubId = parseOverviewClubId(clubId);
  const [myClubId, setMyClubId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await getMyClubContext();
      if (cancelled) return;
      setMyClubId(data?.clubId ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const excludeFeeAndLicenseChips =
    overviewClubId != null && (myClubId === null || overviewClubId !== myClubId);

  return (
    <KlubMemberDetailView
      userId={String(id)}
      overviewClubId={overviewClubId}
      canViewMemberFees={!excludeFeeAndLicenseChips}
      excludeFeeAndLicenseChips={excludeFeeAndLicenseChips}
    />
  );
}
