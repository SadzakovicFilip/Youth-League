import { useLocalSearchParams } from 'expo-router';

import { KlubMemberDetailView } from '@/components/klub/klub-member-detail-view';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';

function parseOverviewClubId(raw: string | string[] | undefined): number | undefined {
  if (raw == null) return undefined;
  const s = Array.isArray(raw) ? raw[0] : String(raw);
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : undefined;
}

export default function IgracKorisnikDetailScreen() {
  const { id, clubId } = useLocalSearchParams<{ id: string; clubId?: string }>();
  const overviewClubId = parseOverviewClubId(clubId);
  const { data } = useIgracDashboard();
  const myClubId = data?.club_context?.club_id ?? null;

  const excludeFeeAndLicenseChips =
    overviewClubId != null && (myClubId == null || overviewClubId !== myClubId);

  return (
    <KlubMemberDetailView
      userId={String(id)}
      overviewClubId={overviewClubId}
      canViewMemberFees={false}
      excludeFeeAndLicenseChips={excludeFeeAndLicenseChips}
    />
  );
}
