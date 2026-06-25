import { getMyClubContext } from '@/lib/club-context';
import { personDisplayName } from '@/lib/person-display-name';
import { supabase } from '@/lib/supabase';

export type KlubMemberLine = {
  user_id: string;
  username: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

/**
 * Članovi kluba po ulozi (isto članstvo kao na tabu Tim + zapisničari).
 * Jedan upit na članstva + profili.
 */
export async function fetchKlubClubMembersByRole(): Promise<{
  players: KlubMemberLine[];
  trainers: KlubMemberLine[];
  zapisnicari: KlubMemberLine[];
  error: string | null;
}> {
  const { data: ctx, error: ctxErr } = await getMyClubContext();
  if (ctxErr || !ctx) {
    return { players: [], trainers: [], zapisnicari: [], error: ctxErr ?? 'Nije pronađen klub.' };
  }

  const { data: memberships, error: mErr } = await supabase
    .from('club_memberships')
    .select('user_id, member_role')
    .eq('club_id', ctx.clubId)
    .eq('active', true)
    .in('member_role', ['igrac', 'trener', 'zapisnicar']);

  if (mErr) {
    return { players: [], trainers: [], zapisnicari: [], error: mErr.message };
  }

  const rows = memberships ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (userIds.length === 0) {
    return { players: [], trainers: [], zapisnicari: [], error: null };
  }

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, first_name, last_name')
    .in('id', userIds);

  if (pErr) {
    return { players: [], trainers: [], zapisnicari: [], error: pErr.message };
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        username: p.username ?? '',
        display_name: p.display_name ?? null,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
      },
    ]),
  );

  const line = (userId: string): KlubMemberLine => {
    const pr = profileById.get(userId);
    return {
      user_id: userId,
      username: pr?.username?.trim() || userId,
      display_name: pr?.display_name ?? null,
      first_name: pr?.first_name ?? null,
      last_name: pr?.last_name ?? null,
    };
  };

  const players: KlubMemberLine[] = [];
  const trainers: KlubMemberLine[] = [];
  const zapisnicari: KlubMemberLine[] = [];

  for (const r of rows) {
    const role = r.member_role as string;
    if (role === 'igrac') players.push(line(r.user_id));
    else if (role === 'trener') trainers.push(line(r.user_id));
    else if (role === 'zapisnicar') zapisnicari.push(line(r.user_id));
  }

  players.sort((a, b) =>
    personDisplayName(a).localeCompare(personDisplayName(b), 'sr'),
  );
  trainers.sort((a, b) =>
    personDisplayName(a).localeCompare(personDisplayName(b), 'sr'),
  );
  zapisnicari.sort((a, b) =>
    personDisplayName(a).localeCompare(personDisplayName(b), 'sr'),
  );

  return { players, trainers, zapisnicari, error: null };
}
