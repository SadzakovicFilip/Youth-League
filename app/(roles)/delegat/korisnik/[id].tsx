import { useLocalSearchParams } from 'expo-router';

import { KlubMemberDetailView } from '@/components/klub/klub-member-detail-view';

function parseOverviewClubId(raw: string | string[] | undefined): number | undefined {
  if (raw == null) return undefined;
  const s = Array.isArray(raw) ? raw[0] : String(raw);
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : undefined;
}

export default function DelegatKorisnikDetailScreen() {
  const { id, clubId } = useLocalSearchParams<{ id: string; clubId?: string }>();
  const overviewClubId = parseOverviewClubId(clubId);

  return (
    <KlubMemberDetailView
      userId={String(id)}
      overviewClubId={overviewClubId}
      canViewMemberFees={false}
    />
  );
}
