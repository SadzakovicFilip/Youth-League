-- get_league_sudije: matches_officiated (broj utakmica u ligi koje je sudija sudio)

create or replace function public.get_league_sudije(p_league_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id',      ls.user_id,
      'username',     p.username,
      'display_name', p.display_name,
      'first_name',   p.first_name,
      'last_name',    p.last_name,
      'phone',        p.phone,
      'matches_officiated', (
        select count(distinct mo.match_id)::int
        from public.match_officials mo
        inner join public.matches m on m.id = mo.match_id and m.league_id = p_league_id
        where mo.user_id = ls.user_id
          and mo.role::text = 'sudija'
      )
    ) order by coalesce(p.display_name, p.last_name, p.username)
  ), '[]'::jsonb)
  from public.league_sudije ls
  left join public.profiles p on p.id = ls.user_id
  where ls.league_id = p_league_id
$$;

grant execute on function public.get_league_sudije(bigint) to authenticated;

notify pgrst, 'reload schema';
