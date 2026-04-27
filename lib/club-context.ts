import { supabase } from '@/lib/supabase';

export type ClubContext = {
  clubId: number;
  clubName: string;
  leagueId: number | null;
  leagueName: string | null;
  regionId: number | null;
  regionName: string | null;
  groupId: number | null;
  groupName: string | null;
};

type RpcContext = {
  club_id: number | string | null;
  club_name: string | null;
  league_id: number | string | null;
  league_name: string | null;
  region_id: number | string | null;
  region_name: string | null;
  group_id: number | string | null;
  group_name: string | null;
};

export function mapRpcClubContext(row: RpcContext | null | undefined): ClubContext | null {
  if (!row || row.club_id == null) return null;
  return {
    clubId: Number(row.club_id),
    clubName: row.club_name ?? `#${row.club_id}`,
    leagueId: row.league_id != null ? Number(row.league_id) : null,
    leagueName: row.league_name ?? null,
    regionId: row.region_id != null ? Number(row.region_id) : null,
    regionName: row.region_name ?? null,
    groupId: row.group_id != null ? Number(row.group_id) : null,
    groupName: row.group_name ?? null,
  };
}

export async function getMyClubContext(): Promise<{ data: ClubContext | null; error: string | null }> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_my_club_context');
  if (!rpcErr && rpcData) {
    const mapped = mapRpcClubContext(rpcData as RpcContext);
    if (mapped) return { data: mapped, error: null };
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { data: null, error: userErr?.message ?? 'Nema aktivne sesije.' };
  }

  const { data: memberships, error: mErr } = await supabase
    .from('club_memberships')
    .select('club_id, member_role')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('club_id');

  if (mErr) {
    return { data: null, error: mErr.message };
  }

  const preferred =
    (memberships ?? []).find((row) => row.member_role === 'klub') ??
    (memberships ?? []).find((row) => row.member_role === 'trener') ??
    null;

  if (!preferred?.club_id) {
    return { data: null, error: 'Nije pronadjen klub za trenutno ulogovanog korisnika.' };
  }

  const clubId = Number(preferred.club_id);
  const { data: clubRow, error: clubErr } = await supabase
    .from('clubs')
    .select('id, name, league_id')
    .eq('id', clubId)
    .maybeSingle();

  if (clubErr || !clubRow) {
    return { data: null, error: clubErr?.message ?? 'Klub nije pronadjen.' };
  }

  let leagueName: string | null = null;
  let regionId: number | null = null;
  let regionName: string | null = null;

  if (clubRow.league_id) {
    const { data: leagueRow } = await supabase
      .from('leagues')
      .select('id, name, region_id')
      .eq('id', clubRow.league_id)
      .maybeSingle();
    if (leagueRow) {
      leagueName = leagueRow.name ?? null;
      regionId = leagueRow.region_id ?? null;
      if (regionId) {
        const { data: regionRow } = await supabase
          .from('regions')
          .select('id, name')
          .eq('id', regionId)
          .maybeSingle();
        regionName = regionRow?.name ?? null;
      }
    }
  }

  let groupId: number | null = null;
  let groupName: string | null = null;
  const { data: gcRow } = await supabase
    .from('group_clubs')
    .select('group_id')
    .eq('club_id', clubId)
    .maybeSingle();
  if (gcRow?.group_id) {
    groupId = Number(gcRow.group_id);
    const { data: groupRow } = await supabase
      .from('league_groups')
      .select('id, name')
      .eq('id', groupId)
      .maybeSingle();
    groupName = groupRow?.name ?? null;
  }

  return {
    data: {
      clubId,
      clubName: clubRow.name ?? `#${clubId}`,
      leagueId: clubRow.league_id ?? null,
      leagueName,
      regionId,
      regionName,
      groupId,
      groupName,
    },
    error: null,
  };
}
