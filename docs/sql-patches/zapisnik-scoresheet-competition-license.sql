-- FIBA scoresheet: region/league name u match objektu + license_number po igraču u rosteru.
-- Primeni posle: match-display-status-rpcs.sql, zapisnik-match-detail-widen-finished-readers.sql

create or replace function public.fn_roster_with_stats(p_match_id bigint, p_club_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select
      e.user_id,
      count(*) filter (where e.event_type = 'free_throw')::int as pts_ft,
      count(*) filter (where e.event_type = 'field')::int       as pts_2,
      count(*) filter (where e.event_type = 'three')::int       as pts_3,
      count(*) filter (where e.event_type = 'foul')::int        as fouls,
      coalesce(sum(e.points), 0)::int                           as total_points
    from public.match_events e
    where e.match_id = p_match_id
    group by e.user_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id',       mr.user_id,
      'jersey_number', mr.jersey_number,
      'display_name',  p.display_name,
      'first_name',    p.first_name,
      'last_name',     p.last_name,
      'username',      p.username,
      'license_number', ul.license_number,
      'pts_ft',        coalesce(ev.pts_ft, 0),
      'pts_2',         coalesce(ev.pts_2, 0),
      'pts_3',         coalesce(ev.pts_3, 0),
      'fouls',         coalesce(ev.fouls, 0),
      'total_points',  coalesce(ev.total_points, 0)
    ) order by mr.jersey_number
  ), '[]'::jsonb)
  from public.match_rosters mr
  left join public.profiles p on p.id = mr.user_id
  left join public.user_licenses ul on ul.user_id = mr.user_id
  left join ev on ev.user_id = mr.user_id
  where mr.match_id = p_match_id
    and mr.club_id  = p_club_id;
$$;
grant execute on function public.fn_roster_with_stats(bigint, bigint) to authenticated;

create or replace function public.get_zapisnicar_match_detail(p_match_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_m record;
  v_is_zapisnicar boolean;
  v_can_view boolean;
  v_result jsonb;
begin
  select m.* into v_m from public.matches m where m.id = p_match_id;
  if not found then raise exception 'Utakmica ne postoji'; end if;

  v_is_zapisnicar := exists (
    select 1 from public.match_officials mo
    where mo.match_id = p_match_id
      and mo.user_id  = auth.uid()
      and mo.role     = 'zapisnicar'::official_role
  );

  v_can_view :=
    v_is_zapisnicar
    or public.has_role('admin')
    or public.has_role('savez')
    or public.is_delegate_of_league(v_m.league_id);

  if not v_can_view and coalesce(v_m.status, 'scheduled')::text = 'finished' then
    v_can_view :=
      exists (
        select 1 from public.match_officials mo
        where mo.match_id = p_match_id and mo.user_id = auth.uid()
      )
      or exists (
        select 1 from public.club_memberships cm
        where cm.user_id = auth.uid()
          and cm.active = true
          and cm.club_id in (v_m.home_club_id, v_m.away_club_id)
      )
      or exists (
        select 1 from public.match_rosters mr
        where mr.match_id = p_match_id and mr.user_id = auth.uid()
      );
  end if;

  if not v_can_view then
    raise exception 'Nemate dozvolu da vidite ovu utakmicu';
  end if;

  select jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_m.id,
      'scheduled_at', v_m.scheduled_at,
      'venue', v_m.venue,
      'status', coalesce(v_m.status, 'scheduled'),
      'display_status', public.match_display_status(p_match_id),
      'started_at', v_m.started_at,
      'ended_at', v_m.ended_at,
      'home_club_id', v_m.home_club_id,
      'away_club_id', v_m.away_club_id,
      'home_club_name', (select name from public.clubs where id = v_m.home_club_id),
      'away_club_name', (select name from public.clubs where id = v_m.away_club_id),
      'home_score', v_m.home_score,
      'away_score', v_m.away_score,
      'league_name', (
        select l.name from public.leagues l where l.id = v_m.league_id
      ),
      'region_name', (
        select r.name
        from public.leagues l
        join public.regions r on r.id = l.region_id
        where l.id = v_m.league_id
      )
    ),
    'is_zapisnicar', v_is_zapisnicar,
    'can_score', (v_is_zapisnicar and coalesce(v_m.status,'scheduled') = 'live'),
    'home_roster', public.fn_roster_with_stats(p_match_id, v_m.home_club_id),
    'away_roster', public.fn_roster_with_stats(p_match_id, v_m.away_club_id),
    'sudije', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', mo.user_id,
        'display_name', p.display_name,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'username', p.username
      ) order by mo.user_id)
      from public.match_officials mo
      left join public.profiles p on p.id = mo.user_id
      where mo.match_id = p_match_id and mo.role = 'sudija'::official_role
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
grant execute on function public.get_zapisnicar_match_detail(bigint) to authenticated;

notify pgrst, 'reload schema';
