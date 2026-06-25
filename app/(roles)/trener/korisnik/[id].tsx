import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { KlubMemberDetailView } from "@/components/klub/klub-member-detail-view";
import { supabase } from "@/lib/supabase";

function parseOverviewClubId(raw: string | string[] | undefined): number | undefined {
  if (raw == null) return undefined;
  const s = Array.isArray(raw) ? raw[0] : String(raw);
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : undefined;
}

async function fetchTrenerOverviewClubId(): Promise<number | null> {
  const { data, error } = await supabase.rpc("my_trener_or_klub_club_id");
  if (error) return null;
  const n =
    typeof data === "number" ? data : data == null ? null : Number(data);
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

export default function TrenerKorisnikDetailScreen() {
  const { id, clubId } = useLocalSearchParams<{ id: string; clubId?: string }>();
  const overviewClubId = parseOverviewClubId(clubId);
  const [myClubId, setMyClubId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cid = await fetchTrenerOverviewClubId();
      if (cancelled) return;
      setMyClubId(cid);
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
