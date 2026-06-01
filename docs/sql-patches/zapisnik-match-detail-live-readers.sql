-- Superseded by docs/sql-patches/match-display-status-rpcs.sql (includes display_status).
-- Čitanje get_zapisnicar_match_detail za scheduled/live/finished —
-- isto „široke“ podele kao kod finished (zvanične osobe, članovi učesnika, roster igrači),
-- uz zapisnika / admin / savez / delegata.
-- Rezultat: ostali dobijaju samo pregled (can_score i dalje samo za zapisnika na LIVE).

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

  -- Gledaci / učesnici koji nisu eksplicitni zapisnica-delegad-savez nivoji (svi statuse isti skup)
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
