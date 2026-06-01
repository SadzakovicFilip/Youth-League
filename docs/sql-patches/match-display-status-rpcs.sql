-- display_status u listama i detaljima utakmica
-- (ZAKAZANA / ISČEKIVANJE / NEMA USLOVA / NEODIGRANA / UŽIVO / ZAVRŠENA)
-- Prvo pokreni: docs/sql-patches/match-display-status.sql

-- get_trener_matches
create or replace function public.get_trener_matches(p_club_id bigint default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with effective as (
    select coalesce(p_club_id, public.my_trener_or_klub_club_id()) as club_id
  ),
  ctx as (
    select
      c.id as club_id,
      c.name as club_name,
      c.league_id,
      l.name as league_name,
      lg.id as group_id,
      lg.name as group_name
    from effective e
    join public.clubs c on c.id = e.club_id
    left join public.leagues l on l.id = c.league_id
    left join public.group_clubs gc on gc.club_id = c.id
    left join public.league_groups lg on lg.id = gc.group_id
    limit 1
  ),
  all_matches as (
    select
      m.id,
      m.league_id,
      m.group_id,
      m.home_club_id,
      m.away_club_id,
      m.scheduled_at,
      m.venue,
      m.status,
      m.home_score,
      m.away_score,
      hc.name as home_club_name,
      ac.name as away_club_name,
      case when m.home_club_id = (select club_id from effective) then 'home' else 'away' end as side,
      case
        when m.home_score is not null and m.away_score is not null then 'played'
        when m.scheduled_at < now() then 'past'
        else 'upcoming'
      end as phase,
      (select count(*) from public.match_rosters mr
        where mr.match_id = m.id and mr.club_id = (select club_id from effective)) as roster_count,
      public.match_display_status(m.id) as display_status
    from public.matches m
    left join public.clubs hc on hc.id = m.home_club_id
    left join public.clubs ac on ac.id = m.away_club_id
    where m.home_club_id = (select club_id from effective)
       or m.away_club_id = (select club_id from effective)
  )
  select jsonb_build_object(
    'context', (select to_jsonb(ctx) from ctx),
    'upcoming', coalesce((
      select jsonb_agg(to_jsonb(am) order by am.scheduled_at asc)
      from all_matches am
      where am.phase = 'upcoming'
    ), '[]'::jsonb),
    'all', coalesce((
      select jsonb_agg(to_jsonb(am) order by am.scheduled_at desc)
      from all_matches am
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.get_trener_matches(bigint) to authenticated;

-- get_trener_match_detail
create or replace function public.get_trener_match_detail(p_match_id bigint, p_club_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_club_id bigint := coalesce(p_club_id, public.my_trener_or_klub_club_id());
  v_match   record;
  v_result  jsonb;
begin
  select m.id, m.league_id, m.group_id, m.home_club_id, m.away_club_id,
         m.scheduled_at, m.venue, m.status, m.home_score, m.away_score,
         hc.name as home_club_name, ac.name as away_club_name
    into v_match
  from public.matches m
  left join public.clubs hc on hc.id = m.home_club_id
  left join public.clubs ac on ac.id = m.away_club_id
  where m.id = p_match_id;

  if not found then raise exception 'Utakmica ne postoji'; end if;

  if not (v_match.home_club_id = v_club_id or v_match.away_club_id = v_club_id) then
    raise exception 'Klub nije ucesnik ove utakmice';
  end if;

  select jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'league_id', v_match.league_id,
      'group_id', v_match.group_id,
      'home_club_id', v_match.home_club_id,
      'away_club_id', v_match.away_club_id,
      'scheduled_at', v_match.scheduled_at,
      'venue', v_match.venue,
      'status', v_match.status,
      'display_status', public.match_display_status(p_match_id),
      'home_score', v_match.home_score,
      'away_score', v_match.away_score,
      'home_club_name', v_match.home_club_name,
      'away_club_name', v_match.away_club_name,
      'side', case when v_match.home_club_id = v_club_id then 'home' else 'away' end
    ),
    'club_id', v_club_id,
    'can_edit', public.can_manage_match_roster(p_match_id, v_club_id)
                and not (v_match.home_score is not null and v_match.away_score is not null),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', mr.user_id,
        'jersey_number', mr.jersey_number,
        'display_name', p.display_name,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'username', p.username
      ) order by mr.jersey_number)
      from public.match_rosters mr
      left join public.profiles p on p.id = mr.user_id
      where mr.match_id = p_match_id and mr.club_id = v_club_id
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', p.id,
        'display_name', p.display_name,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'username', p.username,
        'license_valid_until', ul.valid_until,
        'license_number', ul.license_number,
        'is_eligible', (ul.valid_until is not null and ul.valid_until >= (v_match.scheduled_at::date))
      ) order by coalesce(p.last_name, p.display_name, p.username))
      from public.club_memberships cm
      join public.profiles p on p.id = cm.user_id
      left join public.user_licenses ul on ul.user_id = p.id
      where cm.club_id = v_club_id
        and cm.member_role::text = 'igrac'
        and cm.active = true
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;
grant execute on function public.get_trener_match_detail(bigint, bigint) to authenticated;

-- get_my_sudija_matches
create or replace function public.get_my_sudija_matches()
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
      'scheduled_at',   m.scheduled_at,
      'venue',          m.venue,
      'status',         m.status,
      'display_status', public.match_display_status(m.id),
      'home_club_id',   m.home_club_id,
      'home_club_name', hc.name,
      'away_club_id',   m.away_club_id,
      'away_club_name', ac.name,
      'home_score',     m.home_score,
      'away_score',     m.away_score,
      'league_id',      m.league_id,
      'league_name',    l.name,
      'group_id',       m.group_id,
      'group_name',     g.name,
      'co_sudije', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'user_id',      mo2.user_id,
            'display_name', sp.display_name,
            'username',     sp.username,
            'first_name',   sp.first_name,
            'last_name',    sp.last_name
          ) order by coalesce(sp.display_name, sp.last_name, sp.username)
        )
        from public.match_officials mo2
        left join public.profiles sp on sp.id = mo2.user_id
        where mo2.match_id = m.id
          and mo2.role    = 'sudija'::public.official_role
          and mo2.user_id <> auth.uid()
      ), '[]'::jsonb)
    ) as x
    from public.match_officials mo
    join public.matches m          on m.id = mo.match_id
    left join public.clubs hc      on hc.id = m.home_club_id
    left join public.clubs ac      on ac.id = m.away_club_id
    left join public.leagues l     on l.id  = m.league_id
    left join public.league_groups g on g.id = m.group_id
    where mo.user_id = auth.uid()
      and mo.role   = 'sudija'::public.official_role
  ) t
$$;
grant execute on function public.get_my_sudija_matches() to authenticated;

-- get_my_zapisnicar_matches
create or replace function public.get_my_zapisnicar_matches()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'scheduled_at', m.scheduled_at,
      'venue', m.venue,
      'status', coalesce(m.status, 'scheduled'),
      'display_status', public.match_display_status(m.id),
      'home_club_id', m.home_club_id,
      'away_club_id', m.away_club_id,
      'home_club_name', hc.name,
      'away_club_name', ac.name,
      'home_score', m.home_score,
      'away_score', m.away_score
    ) order by m.scheduled_at
  ), '[]'::jsonb)
  from public.match_officials mo
  join public.matches m  on m.id  = mo.match_id
  left join public.clubs hc on hc.id = m.home_club_id
  left join public.clubs ac on ac.id = m.away_club_id
  where mo.user_id = auth.uid()
    and mo.role = 'zapisnicar'::official_role;
$$;
grant execute on function public.get_my_zapisnicar_matches() to authenticated;

-- get_klub_matches
create or replace function public.get_klub_matches(p_club_id bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with effective as (
    select coalesce(p_club_id, public.my_club_id()) as club_id
  ),
  club_ctx as (
    select
      c.id                 as club_id,
      c.name               as club_name,
      c.league_id          as league_id,
      l.name               as league_name,
      l.region_id          as region_id,
      r.name               as region_name,
      lg.id                as group_id,
      lg.name              as group_name
    from effective e
    join public.clubs c on c.id = e.club_id
    left join public.leagues       l  on l.id  = c.league_id
    left join public.regions       r  on r.id  = l.region_id
    left join public.group_clubs   gc on gc.club_id = c.id
    left join public.league_groups lg on lg.id = gc.group_id
    limit 1
  )
  select jsonb_build_object(
    'context', (
      select jsonb_build_object(
        'club_id', club_id, 'club_name', club_name,
        'league_id', league_id, 'league_name', league_name,
        'region_id', region_id, 'region_name', region_name,
        'group_id', group_id, 'group_name', group_name
      )
      from club_ctx
    ),
    'home', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'league_id', m.league_id,
          'group_id', m.group_id,
          'home_club_id', m.home_club_id,
          'away_club_id', m.away_club_id,
          'scheduled_at', m.scheduled_at,
          'venue', m.venue,
          'status', m.status,
          'display_status', public.match_display_status(m.id),
          'home_score', m.home_score,
          'away_score', m.away_score,
          'home_club_name', hc.name,
          'away_club_name', ac.name,
          'scorer_user_id', mo.user_id,
          'scorer_display_name', sp.display_name,
          'scorer_username', sp.username
        )
        order by m.scheduled_at
      )
      from public.matches m
      left join public.clubs hc           on hc.id = m.home_club_id
      left join public.clubs ac           on ac.id = m.away_club_id
      left join public.match_officials mo on mo.match_id = m.id and mo.role::text = 'zapisnicar'
      left join public.profiles sp        on sp.id = mo.user_id
      where m.home_club_id = (select club_id from effective)
    ), '[]'::jsonb),
    'away', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'league_id', m.league_id,
          'group_id', m.group_id,
          'home_club_id', m.home_club_id,
          'away_club_id', m.away_club_id,
          'scheduled_at', m.scheduled_at,
          'venue', m.venue,
          'status', m.status,
          'display_status', public.match_display_status(m.id),
          'home_score', m.home_score,
          'away_score', m.away_score,
          'home_club_name', hc.name,
          'away_club_name', ac.name
        )
        order by m.scheduled_at
      )
      from public.matches m
      left join public.clubs hc on hc.id = m.home_club_id
      left join public.clubs ac on ac.id = m.away_club_id
      where m.away_club_id = (select club_id from effective)
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.get_klub_matches(bigint) to authenticated;

-- get_club_public_matches
create or replace function public.get_club_public_matches(p_club_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_league bigint;
  v_played jsonb;
  v_upcoming jsonb;
begin
  if p_club_id is null then
    raise exception 'Club id is required';
  end if;

  select league_id into v_league from public.clubs where id = p_club_id;

  if not (
    public.can_view_club_team(p_club_id)
    or (v_league is not null and public.can_view_league(v_league))
  ) then
    raise exception 'Not allowed to view this club matches';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_at desc), '[]'::jsonb)
  into v_played
  from (
    select
      m.id,
      m.scheduled_at,
      m.venue,
      m.status,
      public.match_display_status(m.id) as display_status,
      m.home_club_id,
      m.away_club_id,
      hc.name as home_club_name,
      ac.name as away_club_name,
      m.home_score,
      m.away_score,
      case when m.home_club_id = p_club_id then 'home' else 'away' end as side,
      case
        when m.home_club_id = p_club_id then
          case
            when coalesce(m.home_score,0) > coalesce(m.away_score,0) then 'W'
            when coalesce(m.home_score,0) < coalesce(m.away_score,0) then 'L'
            else 'N'
          end
        else
          case
            when coalesce(m.away_score,0) > coalesce(m.home_score,0) then 'W'
            when coalesce(m.away_score,0) < coalesce(m.away_score,0) then 'L'
            else 'N'
          end
      end as result
    from public.matches m
    left join public.clubs hc on hc.id = m.home_club_id
    left join public.clubs ac on ac.id = m.away_club_id
    where (m.home_club_id = p_club_id or m.away_club_id = p_club_id)
      and m.status = 'finished'
    order by m.scheduled_at desc
    limit 100
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_at asc), '[]'::jsonb)
  into v_upcoming
  from (
    select
      m.id,
      m.scheduled_at,
      m.venue,
      m.status,
      public.match_display_status(m.id) as display_status,
      m.home_club_id,
      m.away_club_id,
      hc.name as home_club_name,
      ac.name as away_club_name,
      m.home_score,
      m.away_score,
      case when m.home_club_id = p_club_id then 'home' else 'away' end as side
    from public.matches m
    left join public.clubs hc on hc.id = m.home_club_id
    left join public.clubs ac on ac.id = m.away_club_id
    where (m.home_club_id = p_club_id or m.away_club_id = p_club_id)
      and coalesce(m.status,'scheduled') in ('scheduled','live')
    order by m.scheduled_at asc
    limit 100
  ) x;

  return jsonb_build_object(
    'club_id', p_club_id,
    'played',  coalesce(v_played, '[]'::jsonb),
    'upcoming', coalesce(v_upcoming, '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_club_public_matches(bigint) to authenticated;

-- get_igrac_match_hub
create or replace function public.get_igrac_match_hub()
returns jsonb
language plpgsql
stable
security definer
parallel safe
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_club_id     bigint;
  v_league_id   bigint;
  v_league_name text;
  v_upcoming    jsonb;
  v_played      jsonb;
  v_season      jsonb;
  v_career      jsonb;
begin
  select cm.club_id into v_club_id
  from public.club_memberships cm
  where cm.user_id = v_uid
    and cm.active = true
    and cm.member_role::text = 'igrac'
  order by cm.club_id
  limit 1;

  if v_club_id is null then
    return jsonb_build_object(
      'club_id', null, 'league_id', null, 'league_name', null,
      'upcoming', '[]'::jsonb, 'played', '[]'::jsonb,
      'season', jsonb_build_object(
        'games_played', 0, 'total_points', 0, 'avg_points', 0,
        'pts_ft', 0, 'pts_2', 0, 'pts_3', 0, 'fouls', 0,
        'pct_points_ft', 0, 'pct_points_2', 0, 'pct_points_3', 0
      ),
      'career', jsonb_build_object(
        'games_played', 0, 'total_points', 0, 'avg_points', 0,
        'pts_ft', 0, 'pts_2', 0, 'pts_3', 0, 'fouls', 0,
        'pct_points_ft', 0, 'pct_points_2', 0, 'pct_points_3', 0
      )
    );
  end if;

  select c.league_id, l.name into v_league_id, v_league_name
  from public.clubs c
  left join public.leagues l on l.id = c.league_id
  where c.id = v_club_id;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.scheduled_at asc), '[]'::jsonb)
  into v_upcoming
  from (
    select
      m.id, m.scheduled_at, m.venue,
      coalesce(m.status, 'scheduled') as status,
      public.match_display_status(m.id) as display_status,
      m.home_club_id, m.away_club_id,
      hc.name as home_club_name,
      ac.name as away_club_name,
      m.home_score, m.away_score,
      case when m.home_club_id = v_club_id then 'home' else 'away' end as side
    from public.matches m
    left join public.clubs hc on hc.id = m.home_club_id
    left join public.clubs ac on ac.id = m.away_club_id
    where (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
      and coalesce(m.status, 'scheduled') in ('scheduled', 'live')
    order by m.scheduled_at asc
    limit 80
  ) t;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_at desc), '[]'::jsonb)
  into v_played
  from (
    select
      m.id as match_id,
      m.scheduled_at,
      m.home_club_id,
      m.away_club_id,
      hc.name as home_club_name,
      ac.name as away_club_name,
      m.home_score,
      m.away_score,
      case when m.home_club_id = v_club_id then 'home' else 'away' end as side,
      jr.jersey_number,
      coalesce(st.pts_ft, 0)       as pts_ft,
      coalesce(st.pts_2, 0)        as pts_2,
      coalesce(st.pts_3, 0)        as pts_3,
      coalesce(st.fouls, 0)        as fouls,
      coalesce(st.total_points, 0) as total_points,
      case
        when m.home_club_id = v_club_id then
          case
            when coalesce(m.home_score, 0) > coalesce(m.away_score, 0) then 'W'
            when coalesce(m.home_score, 0) < coalesce(m.away_score, 0) then 'L'
            else 'N'
          end
        else
          case
            when coalesce(m.away_score, 0) > coalesce(m.home_score, 0) then 'W'
            when coalesce(m.away_score, 0) < coalesce(m.home_score, 0) then 'L'
            else 'N'
          end
      end as result
    from public.matches m
    left join public.clubs hc on hc.id = m.home_club_id
    left join public.clubs ac on ac.id = m.away_club_id
    left join lateral (
      select mr.jersey_number
      from public.match_rosters mr
      where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = v_uid
      limit 1
    ) jr on true
    left join lateral (
      select
        sum(case when e.event_type = 'free_throw' then 1 else 0 end)::int as pts_ft,
        sum(case when e.event_type = 'field'      then 1 else 0 end)::int as pts_2,
        sum(case when e.event_type = 'three'      then 1 else 0 end)::int as pts_3,
        sum(case when e.event_type = 'foul'       then 1 else 0 end)::int as fouls,
        coalesce(sum(e.points), 0)::int                                   as total_points
      from public.match_events e
      where e.match_id = m.id and e.user_id = v_uid
    ) st on true
    where m.status = 'finished'
      and (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
      and exists (
        select 1 from public.match_rosters mr
        where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = v_uid
      )
    order by m.scheduled_at desc
    limit 80
  ) x;

  with my_matches as (
    select m.id, m.league_id
    from public.matches m
    where m.status = 'finished'
      and (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
      and exists (
        select 1 from public.match_rosters mr
        where mr.match_id = m.id
          and mr.club_id = v_club_id
          and mr.user_id = v_uid
      )
  ),
  per_match as (
    select
      mm.id        as match_id,
      mm.league_id as league_id,
      coalesce(sum(case when e.event_type = 'free_throw' then 1 else 0 end), 0)::int as pts_ft,
      coalesce(sum(case when e.event_type = 'field'      then 1 else 0 end), 0)::int as pts_2,
      coalesce(sum(case when e.event_type = 'three'      then 1 else 0 end), 0)::int as pts_3,
      coalesce(sum(case when e.event_type = 'foul'       then 1 else 0 end), 0)::int as fouls,
      coalesce(sum(e.points), 0)::int                                                as total_points
    from my_matches mm
    left join public.match_events e
      on e.match_id = mm.id and e.user_id = v_uid
    group by mm.id, mm.league_id
  ),
  agg as (
    select
      count(*)::int                                                                              as c_games,
      coalesce(sum(total_points), 0)::int                                                        as c_pts,
      coalesce(sum(pts_ft), 0)::int                                                              as c_ft,
      coalesce(sum(pts_2), 0)::int                                                               as c_2,
      coalesce(sum(pts_3), 0)::int                                                               as c_3,
      coalesce(sum(fouls), 0)::int                                                               as c_f,
      count(*) filter (where league_id is not distinct from v_league_id)::int                    as s_games,
      coalesce(sum(total_points) filter (where league_id is not distinct from v_league_id), 0)::int as s_pts,
      coalesce(sum(pts_ft)       filter (where league_id is not distinct from v_league_id), 0)::int as s_ft,
      coalesce(sum(pts_2)        filter (where league_id is not distinct from v_league_id), 0)::int as s_2,
      coalesce(sum(pts_3)        filter (where league_id is not distinct from v_league_id), 0)::int as s_3,
      coalesce(sum(fouls)        filter (where league_id is not distinct from v_league_id), 0)::int as s_f
    from per_match
  )
  select
    jsonb_build_object(
      'games_played', s_games,
      'total_points', s_pts,
      'avg_points',   case when s_games > 0 then round(s_pts::numeric / s_games, 1) else 0 end,
      'pts_ft', s_ft, 'pts_2', s_2, 'pts_3', s_3, 'fouls', s_f,
      'pct_points_ft', case when s_pts > 0 then round(100.0 * s_ft::numeric / s_pts, 1) else 0 end,
      'pct_points_2',  case when s_pts > 0 then round(100.0 * (s_2 * 2)::numeric / s_pts, 1) else 0 end,
      'pct_points_3',  case when s_pts > 0 then round(100.0 * (s_3 * 3)::numeric / s_pts, 1) else 0 end
    ),
    jsonb_build_object(
      'games_played', c_games,
      'total_points', c_pts,
      'avg_points',   case when c_games > 0 then round(c_pts::numeric / c_games, 1) else 0 end,
      'pts_ft', c_ft, 'pts_2', c_2, 'pts_3', c_3, 'fouls', c_f,
      'pct_points_ft', case when c_pts > 0 then round(100.0 * c_ft::numeric / c_pts, 1) else 0 end,
      'pct_points_2',  case when c_pts > 0 then round(100.0 * (c_2 * 2)::numeric / c_pts, 1) else 0 end,
      'pct_points_3',  case when c_pts > 0 then round(100.0 * (c_3 * 3)::numeric / c_pts, 1) else 0 end
    )
  into v_season, v_career
  from agg;

  return jsonb_build_object(
    'club_id', v_club_id,
    'league_id', v_league_id,
    'league_name', v_league_name,
    'upcoming', coalesce(v_upcoming, '[]'::jsonb),
    'played',   coalesce(v_played,   '[]'::jsonb),
    'season',   coalesce(v_season,   jsonb_build_object()),
    'career',   coalesce(v_career,   jsonb_build_object())
  );
end;
$$;
grant execute on function public.get_igrac_match_hub() to authenticated;

-- get_delegat_match_detail (sa prigovorima)
create or replace function public.get_delegat_match_detail(p_match_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_m record;
  v_result jsonb;
begin
  select m.* into v_m from public.matches m where m.id = p_match_id;
  if not found then raise exception 'Utakmica ne postoji'; end if;

  if not (public.has_role('admin') or public.has_role('savez') or public.is_delegate_of_league(v_m.league_id)) then
    raise exception 'Nemate dozvolu da vidite ovu utakmicu';
  end if;

  select jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_m.id,
      'league_id', v_m.league_id,
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
      'away_score', v_m.away_score
    ),
    'conditions', public.get_match_conditions(p_match_id),
    'sudije', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', mo.user_id,
        'display_name', p.display_name,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'username', p.username
      ))
      from public.match_officials mo
      left join public.profiles p on p.id = mo.user_id
      where mo.match_id = p_match_id and mo.role = 'sudija'::official_role
    ), '[]'::jsonb),
    'zapisnicar', (
      select jsonb_build_object(
        'user_id', mo.user_id,
        'display_name', p.display_name,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'username', p.username
      )
      from public.match_officials mo
      left join public.profiles p on p.id = mo.user_id
      where mo.match_id = p_match_id and mo.role = 'zapisnicar'::official_role
      limit 1
    ),
    'objections', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', mo.id,
          'club_id', mo.club_id,
          'club_name', cb.name,
          'reason', mo.reason,
          'created_at', mo.created_at,
          'created_by', mo.created_by,
          'submitter_display',
            coalesce(
              pr.display_name,
              nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
              pr.username,
              'Korisnik'
            ),
          'status', mo.resolution_status,
          'resolved_at', mo.resolved_at,
          'resolved_by', mo.resolved_by,
          'resolver_display',
            case when mo.resolved_by is null then null
            else coalesce(
              rp.display_name,
              nullif(trim(coalesce(rp.first_name, '') || ' ' || coalesce(rp.last_name, '')), ''),
              rp.username,
              'Korisnik'
            ) end
        )
        order by mo.created_at asc
      )
      from public.match_objections mo
      join public.clubs cb on cb.id = mo.club_id
      left join public.profiles pr on pr.id = mo.created_by
      left join public.profiles rp on rp.id = mo.resolved_by
      where mo.match_id = p_match_id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
grant execute on function public.get_delegat_match_detail(bigint) to authenticated;

-- get_zapisnicar_match_detail (široke dozvole čitanja + display_status)
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

  if not v_can_view then
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
      'away_score', v_m.away_score
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
