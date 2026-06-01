-- get_league_matches: objection_marker za kalendar delegata
-- 'pending' | 'resolved' | 'none'

create or replace function public.get_league_matches(p_league_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by (x->>'scheduled_at')), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id',             m.id,
      'group_id',       m.group_id,
      'group_name',     g.name,
      'scheduled_at',   m.scheduled_at,
      'venue',          m.venue,
      'status',         m.status,
      'home_club_id',   m.home_club_id,
      'home_club_name', hc.name,
      'away_club_id',   m.away_club_id,
      'away_club_name', ac.name,
      'home_score',     m.home_score,
      'away_score',     m.away_score,
      'display_status', public.match_display_status(m.id),
      'objection_marker', (
        case
          when exists (
            select 1 from public.match_objections mo
            where mo.match_id = m.id and mo.resolution_status = 'pending'
          ) then 'pending'
          when exists (
            select 1 from public.match_objections mo
            where mo.match_id = m.id
          ) then 'resolved'
          else 'none'
        end
      ),
      'sudije', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'user_id',      mo.user_id,
            'display_name', sp.display_name,
            'username',     sp.username,
            'first_name',   sp.first_name,
            'last_name',    sp.last_name
          ) order by coalesce(sp.display_name, sp.last_name, sp.username)
        )
        from public.match_officials mo
        left join public.profiles sp on sp.id = mo.user_id
        where mo.match_id = m.id
          and mo.role::text = 'sudija'
      ), '[]'::jsonb)
    ) as x
    from public.matches m
    left join public.clubs hc       on hc.id = m.home_club_id
    left join public.clubs ac       on ac.id = m.away_club_id
    left join public.league_groups g on g.id = m.group_id
    where m.league_id = p_league_id
  ) t
$$;

grant execute on function public.get_league_matches(bigint) to authenticated;

notify pgrst, 'reload schema';
