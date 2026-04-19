-- Klub module SQL migration (robust, adaptive)
-- Run in Supabase SQL editor. Each FAZA is idempotent.

-- ============================================================
-- FAZA 1: role_creation_rules (adaptive schema)
-- ============================================================
do $$
declare
  v_has_creator_target boolean;
  v_has_from_to        boolean;
  v_has_role_cancreate boolean;
  v_has_parent_child   boolean;
begin
  select
    exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='role_creation_rules' and column_name='creator_role')
    and exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='role_creation_rules' and column_name='target_role')
  into v_has_creator_target;

  select
    exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='role_creation_rules' and column_name='from_role')
    and exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='role_creation_rules' and column_name='to_role')
  into v_has_from_to;

  select
    exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='role_creation_rules' and column_name='role')
    and exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='role_creation_rules' and column_name='can_create')
  into v_has_role_cancreate;

  select
    exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='role_creation_rules' and column_name='parent_role')
    and exists (select 1 from information_schema.columns
            where table_schema='public' and table_name='role_creation_rules' and column_name='child_role')
  into v_has_parent_child;

  if v_has_creator_target then
    execute $sql$
      insert into public.role_creation_rules (creator_role, target_role) values
        ('klub','trener'), ('klub','igrac'), ('klub','zapisnicar')
      on conflict do nothing
    $sql$;
  elsif v_has_from_to then
    execute $sql$
      insert into public.role_creation_rules (from_role, to_role) values
        ('klub','trener'), ('klub','igrac'), ('klub','zapisnicar')
      on conflict do nothing
    $sql$;
  elsif v_has_parent_child then
    execute $sql$
      insert into public.role_creation_rules (parent_role, child_role) values
        ('klub','trener'), ('klub','igrac'), ('klub','zapisnicar')
      on conflict do nothing
    $sql$;
  elsif v_has_role_cancreate then
    execute $sql$
      insert into public.role_creation_rules (role, can_create) values
        ('klub','trener'), ('klub','igrac'), ('klub','zapisnicar')
      on conflict do nothing
    $sql$;
  else
    raise notice 'role_creation_rules columns not recognized';
  end if;
end $$;

-- ============================================================
-- FAZA 2: Normalizacija user_licenses (valid_until, license_file_path)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_licenses' and column_name='valid_until'
  ) then
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='user_licenses' and column_name='valid_to') then
      alter table public.user_licenses rename column valid_to to valid_until;
    elsif exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='user_licenses' and column_name='expires_at') then
      alter table public.user_licenses rename column expires_at to valid_until;
    elsif exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='user_licenses' and column_name='expiration_date') then
      alter table public.user_licenses rename column expiration_date to valid_until;
    elsif exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='user_licenses' and column_name='end_date') then
      alter table public.user_licenses rename column end_date to valid_until;
    elsif exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='user_licenses' and column_name='vazi_do') then
      alter table public.user_licenses rename column vazi_do to valid_until;
    else
      alter table public.user_licenses add column valid_until date;
    end if;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_licenses' and column_name='license_file_path'
  ) then
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='user_licenses' and column_name='file_path') then
      alter table public.user_licenses rename column file_path to license_file_path;
    elsif exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='user_licenses' and column_name='license_path') then
      alter table public.user_licenses rename column license_path to license_file_path;
    elsif exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='user_licenses' and column_name='pdf_path') then
      alter table public.user_licenses rename column pdf_path to license_file_path;
    elsif exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='user_licenses' and column_name='storage_path') then
      alter table public.user_licenses rename column storage_path to license_file_path;
    elsif exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='user_licenses' and column_name='path') then
      alter table public.user_licenses rename column path to license_file_path;
    else
      alter table public.user_licenses add column license_file_path text;
    end if;
  end if;
end $$;

-- ============================================================
-- FAZA 3: Unique constraints
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_licenses'::regclass
      and conname  = 'user_licenses_user_id_key'
  ) then
    alter table public.user_licenses
      add constraint user_licenses_user_id_key unique (user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.match_officials'::regclass
      and conname  = 'match_officials_match_role_key'
  ) then
    alter table public.match_officials
      add constraint match_officials_match_role_key unique (match_id, role);
  end if;
end $$;

-- ============================================================
-- FAZA 4: Helper funkcije
-- ============================================================
create or replace function public.my_club_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select cm.club_id
  from public.club_memberships cm
  where cm.user_id = auth.uid()
    and cm.active = true
    and cm.member_role::text = 'klub'
  order by cm.club_id
  limit 1
$$;

grant execute on function public.my_club_id() to authenticated;

create or replace function public.is_in_my_club(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_memberships mine
    join public.club_memberships target on target.club_id = mine.club_id
    where mine.user_id = auth.uid()
      and mine.active = true
      and mine.member_role::text = 'klub'
      and target.user_id = p_user_id
      and target.active = true
  )
$$;

grant execute on function public.is_in_my_club(uuid) to authenticated;

create or replace function public.get_my_club_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select coalesce(
      public.my_club_id(),
      (
        select cm.club_id
        from public.club_memberships cm
        where cm.user_id = auth.uid()
          and cm.active = true
        order by
          case cm.member_role::text
            when 'klub' then 1
            when 'trener' then 2
            when 'zapisnicar' then 3
            when 'igrac' then 4
            else 9
          end,
          cm.club_id
        limit 1
      )
    ) as club_id
  )
  select jsonb_build_object(
    'club_id', c.id,
    'club_name', c.name,
    'league_id', c.league_id,
    'league_name', l.name,
    'region_id', l.region_id,
    'region_name', r.name,
    'group_id', lg.id,
    'group_name', lg.name
  )
  from base b
  join public.clubs c on c.id = b.club_id
  left join public.leagues       l  on l.id  = c.league_id
  left join public.regions       r  on r.id  = l.region_id
  left join public.group_clubs   gc on gc.club_id = c.id
  left join public.league_groups lg on lg.id = gc.group_id
  limit 1;
$$;

grant execute on function public.get_my_club_context() to authenticated;

-- ============================================================
-- FAZA 5: RLS polise
-- ============================================================
alter table public.user_licenses enable row level security;

drop policy if exists user_licenses_select on public.user_licenses;
create policy user_licenses_select on public.user_licenses
for select to authenticated
using (
  public.has_role('admin')
  or public.has_role('savez')
  or user_id = auth.uid()
  or public.is_in_my_club(user_id)
);

drop policy if exists user_licenses_upsert on public.user_licenses;
drop policy if exists user_licenses_write  on public.user_licenses;
create policy user_licenses_write on public.user_licenses
for all to authenticated
using (
  public.has_role('admin')
  or public.has_role('savez')
  or public.is_in_my_club(user_id)
)
with check (
  public.has_role('admin')
  or public.has_role('savez')
  or public.is_in_my_club(user_id)
);

alter table public.match_officials enable row level security;

drop policy if exists match_officials_select on public.match_officials;
create policy match_officials_select on public.match_officials
for select to authenticated
using (true);

drop policy if exists match_officials_klub_home_scorer on public.match_officials;
create policy match_officials_klub_home_scorer on public.match_officials
for all to authenticated
using (
  public.has_role('admin')
  or public.has_role('savez')
  or (
    role::text = 'zapisnicar'
    and exists (
      select 1 from public.matches m
      where m.id = match_officials.match_id
        and m.home_club_id = public.my_club_id()
    )
  )
)
with check (
  public.has_role('admin')
  or public.has_role('savez')
  or (
    role::text = 'zapisnicar'
    and exists (
      select 1 from public.matches m
      where m.id = match_officials.match_id
        and m.home_club_id = public.my_club_id()
    )
  )
);

-- ============================================================
-- FAZA 6: RPC za tim, utakmice i zapisnicare (p_club_id moze biti null = moj klub)
-- ============================================================
create or replace function public.get_klub_team_overview(p_club_id bigint default null)
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
  ),
  team as (
    select
      cm.user_id,
      cm.member_role::text as member_role,
      p.username,
      p.display_name,
      p.first_name,
      p.last_name,
      p.birth_date,
      p.address,
      p.phone
    from public.club_memberships cm
    left join public.profiles p on p.id = cm.user_id
    where cm.club_id = (select club_id from effective)
      and cm.active  = true
      and cm.member_role::text in ('igrac','trener')
  ),
  latest_fees as (
    select distinct on (pf.player_id)
      pf.player_id,
      pf.status::text as status,
      pf.amount_due,
      pf.amount_paid,
      pf.period_month,
      pf.due_date
    from public.player_fees pf
    where pf.player_id in (select user_id from team where member_role = 'igrac')
    order by pf.player_id, pf.period_month desc nulls last, pf.id desc
  ),
  lics as (
    select ul.user_id, ul.valid_until, ul.license_file_path
    from public.user_licenses ul
    where ul.user_id in (select user_id from team)
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
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', t.user_id,
          'username', t.username,
          'display_name', t.display_name,
          'first_name', t.first_name,
          'last_name', t.last_name,
          'birth_date', t.birth_date,
          'address', t.address,
          'phone', t.phone,
          'fee_status', lf.status,
          'fee_amount_due', lf.amount_due,
          'fee_amount_paid', lf.amount_paid,
          'fee_period_month', lf.period_month,
          'fee_due_date', lf.due_date,
          'license_valid_until', ul.valid_until,
          'license_file_path', ul.license_file_path
        )
        order by coalesce(t.display_name, t.username)
      )
      from team t
      left join latest_fees lf on lf.player_id = t.user_id
      left join lics ul        on ul.user_id   = t.user_id
      where t.member_role = 'igrac'
    ), '[]'::jsonb),
    'trainers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', t.user_id,
          'username', t.username,
          'display_name', t.display_name,
          'first_name', t.first_name,
          'last_name', t.last_name,
          'birth_date', t.birth_date,
          'address', t.address,
          'phone', t.phone,
          'license_valid_until', ul.valid_until,
          'license_file_path', ul.license_file_path
        )
        order by coalesce(t.display_name, t.username)
      )
      from team t
      left join lics ul on ul.user_id = t.user_id
      where t.member_role = 'trener'
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_klub_team_overview(bigint) to authenticated;

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

create or replace function public.get_klub_eligible_scorers(p_club_id bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with effective as (
    select coalesce(p_club_id, public.my_club_id()) as club_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', cm.user_id,
      'username', p.username,
      'display_name', p.display_name,
      'first_name', p.first_name,
      'last_name', p.last_name
    )
    order by coalesce(p.display_name, p.username)
  ), '[]'::jsonb)
  from effective e
  join public.club_memberships cm on cm.club_id = e.club_id
  left join public.profiles p on p.id = cm.user_id
  where cm.active = true
    and cm.member_role::text = 'zapisnicar';
$$;

grant execute on function public.get_klub_eligible_scorers(bigint) to authenticated;

create or replace function public.set_home_match_scorer(p_match_id bigint, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_club   bigint;
  v_home_club bigint;
  v_ok        boolean;
begin
  v_my_club := public.my_club_id();
  if v_my_club is null then
    raise exception 'No club context for current user';
  end if;

  select m.home_club_id into v_home_club
  from public.matches m
  where m.id = p_match_id;

  if v_home_club is null then
    raise exception 'Match not found';
  end if;

  if v_home_club <> v_my_club then
    raise exception 'You can assign scorer only for home matches of your club';
  end if;

  select exists (
    select 1 from public.club_memberships cm
    where cm.club_id = v_my_club
      and cm.user_id = p_user_id
      and cm.active  = true
      and cm.member_role::text = 'zapisnicar'
  ) into v_ok;

  if not v_ok then
    raise exception 'Selected user is not zapisnicar in this club';
  end if;

  insert into public.match_officials (match_id, user_id, role)
  values (p_match_id, p_user_id, 'zapisnicar')
  on conflict (match_id, role)
    do update set user_id = excluded.user_id;
end;
$$;

grant execute on function public.set_home_match_scorer(bigint, uuid) to authenticated;

create or replace function public.upsert_user_license(
  p_user_id            uuid,
  p_valid_until        date,
  p_license_file_path  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_in_my_club(p_user_id)
     and not public.has_role('admin')
     and not public.has_role('savez')
  then
    raise exception 'Not allowed to manage this user license';
  end if;

  insert into public.user_licenses (user_id, valid_until, license_file_path)
  values (p_user_id, p_valid_until, p_license_file_path)
  on conflict (user_id) do update
    set valid_until       = excluded.valid_until,
        license_file_path = excluded.license_file_path;
end;
$$;

grant execute on function public.upsert_user_license(uuid, date, text) to authenticated;

-- ============================================================
-- FAZA 7: Indexi i reload sheme
-- ============================================================
create index if not exists idx_club_memberships_club_role_active
  on public.club_memberships (club_id, member_role, active);

create index if not exists idx_club_memberships_user_active
  on public.club_memberships (user_id, active);

create index if not exists idx_match_officials_match_role
  on public.match_officials (match_id, role);

create index if not exists idx_matches_home_club
  on public.matches (home_club_id, scheduled_at);

create index if not exists idx_matches_away_club
  on public.matches (away_club_id, scheduled_at);

create index if not exists idx_player_fees_player_period
  on public.player_fees (player_id, period_month desc);

create index if not exists idx_user_licenses_user
  on public.user_licenses (user_id);

analyze;

notify pgrst, 'reload schema';

-- ============================================================
-- FAZA F14: Delegat upravlja sudijama i rasporedom za utakmice
-- ============================================================

-- 1) league_sudije tabela (kroz koju delegat vezuje sudije za svoju ligu)
create table if not exists public.league_sudije (
  league_id bigint not null references public.leagues(id) on delete cascade,
  user_id   uuid   not null references auth.users(id)    on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists idx_ls_league on public.league_sudije(league_id);
create index if not exists idx_ls_user   on public.league_sudije(user_id);

alter table public.league_sudije enable row level security;

drop policy if exists league_sudije_select on public.league_sudije;
create policy league_sudije_select on public.league_sudije
for select to authenticated
using (true);

drop policy if exists league_sudije_write on public.league_sudije;
create policy league_sudije_write on public.league_sudije
for all to authenticated
using (
  public.has_role('admin')
  or public.has_role('savez')
  or exists (
    select 1 from public.league_delegates ld
    where ld.league_id = league_sudije.league_id
      and ld.user_id   = auth.uid()
  )
)
with check (
  public.has_role('admin')
  or public.has_role('savez')
  or exists (
    select 1 from public.league_delegates ld
    where ld.league_id = league_sudije.league_id
      and ld.user_id   = auth.uid()
  )
);

-- 2) role_creation_rules: delegat moze da kreira sudiju (adaptive)
do $$
declare
  v_ct  boolean;
  v_ft  boolean;
  v_rc  boolean;
  v_pc  boolean;
begin
  select exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='role_creation_rules' and column_name='creator_role')
     and exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='role_creation_rules' and column_name='target_role')
  into v_ct;
  select exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='role_creation_rules' and column_name='from_role')
     and exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='role_creation_rules' and column_name='to_role')
  into v_ft;
  select exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='role_creation_rules' and column_name='role')
     and exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='role_creation_rules' and column_name='can_create')
  into v_rc;
  select exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='role_creation_rules' and column_name='parent_role')
     and exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='role_creation_rules' and column_name='child_role')
  into v_pc;

  if v_ct then
    execute $e$insert into public.role_creation_rules (creator_role, target_role)
               values ('delegat','sudija') on conflict do nothing$e$;
  elsif v_ft then
    execute $e$insert into public.role_creation_rules (from_role, to_role)
               values ('delegat','sudija') on conflict do nothing$e$;
  elsif v_pc then
    execute $e$insert into public.role_creation_rules (parent_role, child_role)
               values ('delegat','sudija') on conflict do nothing$e$;
  elsif v_rc then
    execute $e$insert into public.role_creation_rules (role, can_create)
               values ('delegat','sudija') on conflict do nothing$e$;
  end if;
end $$;

-- 3) match_officials: dozvoli 2 sudije po utakmici
--    stari constraint (match_id, role) zabranjuje 2 sudije -> zamena za (match_id, user_id)
alter table public.match_officials drop constraint if exists match_officials_match_role_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.match_officials'::regclass
      and conname  = 'match_officials_match_user_key'
  ) then
    alter table public.match_officials
      add constraint match_officials_match_user_key unique (match_id, user_id);
  end if;
end $$;

-- i dalje zelimo samo jednog zapisnicara po utakmici -> partial unique index
drop index if exists uq_match_zapisnicar;
create unique index uq_match_zapisnicar
  on public.match_officials (match_id)
  where role::text = 'zapisnicar';

-- i najvise 2 sudije po utakmici — enforce preko trigger-a
create or replace function public.enforce_max_two_sudije()
returns trigger
language plpgsql
as $$
begin
  if new.role::text = 'sudija' then
    if (
      select count(*) from public.match_officials
      where match_id = new.match_id and role::text = 'sudija'
    ) >= 2 then
      raise exception 'Maksimalno 2 sudije po utakmici.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_max_two_sudije on public.match_officials;
create trigger trg_max_two_sudije
before insert on public.match_officials
for each row execute function public.enforce_max_two_sudije();

-- 4) RLS: delegat lige sme da upravlja sudijama za utakmice u svojoj ligi
drop policy if exists match_officials_delegat_sudija on public.match_officials;
create policy match_officials_delegat_sudija on public.match_officials
for all to authenticated
using (
  role::text = 'sudija'
  and exists (
    select 1
    from public.matches m
    join public.league_delegates ld
      on ld.league_id = m.league_id
     and ld.user_id   = auth.uid()
    where m.id = match_officials.match_id
  )
)
with check (
  role::text = 'sudija'
  and exists (
    select 1
    from public.matches m
    join public.league_delegates ld
      on ld.league_id = m.league_id
     and ld.user_id   = auth.uid()
    where m.id = match_officials.match_id
  )
);

-- 5) RPC: lista sudija u ligi (za select + prikaz)
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
      'phone',        p.phone
    ) order by coalesce(p.display_name, p.last_name, p.username)
  ), '[]'::jsonb)
  from public.league_sudije ls
  left join public.profiles p on p.id = ls.user_id
  where ls.league_id = p_league_id
$$;

grant execute on function public.get_league_sudije(bigint) to authenticated;

-- 6) RPC: utakmice u ligi sa pridruzenim sudijama (za rasporedjivanje)
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

-- 7) Indeksi koji pomazu RLS + RPC
create index if not exists idx_match_officials_match_role_user
  on public.match_officials (match_id, role, user_id);

create index if not exists idx_matches_league_scheduled
  on public.matches (league_id, scheduled_at);

-- 8) RPC: utakmice na kojima je ulogovani korisnik dodeljen kao sudija
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

analyze;
notify pgrst, 'reload schema';

-- ============================================================
-- FAZA F15: Delegat upravlja sudija licencom + sudija dashboard optimizacija
-- ============================================================

-- 1) Helper: je li auth.uid() delegat lige u kojoj je p_user_id sudija?
create or replace function public.is_delegat_of_sudija(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_sudije ls
    join public.league_delegates ld
      on ld.league_id = ls.league_id
     and ld.user_id   = auth.uid()
    where ls.user_id = p_user_id
  );
$$;

grant execute on function public.is_delegat_of_sudija(uuid) to authenticated;

-- 2) Update can_view_user_license_pdf: dodaj granu za sudije iz lige u kojoj sam delegat
create or replace function public.can_view_user_license_pdf(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_user_id is null or v_uid is null then
    return false;
  end if;

  if v_uid = p_user_id then
    return true;
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = v_uid
      and role::text in ('admin','savez')
  ) then
    return true;
  end if;

  -- isti klub: trener/klub/igrac vide licence drugih clanova svog kluba
  if exists (
    select 1
    from public.club_memberships me
    join public.club_memberships them on them.club_id = me.club_id
    where me.user_id = v_uid and me.active = true
      and them.user_id = p_user_id and them.active = true
  ) then
    return true;
  end if;

  -- delegat lige u kojoj je p_user_id član kluba
  if exists (
    select 1
    from public.club_memberships cm
    join public.clubs c on c.id = cm.club_id
    join public.league_delegates ld
      on ld.league_id = c.league_id
     and ld.user_id   = v_uid
    where cm.user_id = p_user_id
      and cm.active  = true
  ) then
    return true;
  end if;

  -- delegat lige u kojoj je p_user_id sudija (nije clan kluba)
  if exists (
    select 1
    from public.league_sudije ls
    join public.league_delegates ld
      on ld.league_id = ls.league_id
     and ld.user_id   = v_uid
    where ls.user_id = p_user_id
  ) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.can_view_user_license_pdf(uuid) to authenticated;

-- 3) upsert_user_license: dozvoli i delegatu da snima licencu sudije iz svoje lige
create or replace function public.upsert_user_license(
  p_user_id            uuid,
  p_valid_until        date,
  p_license_file_path  text,
  p_license_number     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.has_role('admin')
    or public.has_role('savez')
    or public.is_in_my_club(p_user_id)
    or public.is_delegat_of_sudija(p_user_id)
  ) then
    raise exception 'Not allowed to manage this user license';
  end if;

  insert into public.user_licenses (user_id, valid_until, license_file_path, license_number)
  values (p_user_id, p_valid_until, p_license_file_path, p_license_number)
  on conflict (user_id) do update
    set valid_until       = excluded.valid_until,
        license_file_path = excluded.license_file_path,
        license_number    = coalesce(excluded.license_number, public.user_licenses.license_number);
end;
$$;

grant execute on function public.upsert_user_license(uuid, date, text, text) to authenticated;
grant execute on function public.upsert_user_license(uuid, date, text)        to authenticated;

-- 4) Storage WRITE polisa: dozvoli delegatu da uploaduje za sudije svoje lige
--    (ako u tvojoj bazi postoji druga polisa za INSERT/UPDATE/DELETE — javi pa cemo je takodje zameniti)
drop policy if exists licenses_write   on storage.objects;
drop policy if exists licenses_insert  on storage.objects;
drop policy if exists licenses_update  on storage.objects;
drop policy if exists licenses_delete  on storage.objects;

create policy licenses_write
on storage.objects
for all
to authenticated
using (
  bucket_id = 'licenses'
  and (
    public.has_role('admin')
    or public.has_role('savez')
    or auth.uid()::text = split_part(storage.objects.name, '/', 1)
    or public.is_in_my_club(nullif(split_part(storage.objects.name, '/', 1), '')::uuid)
    or public.is_delegat_of_sudija(nullif(split_part(storage.objects.name, '/', 1), '')::uuid)
  )
)
with check (
  bucket_id = 'licenses'
  and (
    public.has_role('admin')
    or public.has_role('savez')
    or auth.uid()::text = split_part(storage.objects.name, '/', 1)
    or public.is_in_my_club(nullif(split_part(storage.objects.name, '/', 1), '')::uuid)
    or public.is_delegat_of_sudija(nullif(split_part(storage.objects.name, '/', 1), '')::uuid)
  )
);

-- 5) RPC: profil sudije + licenca + lige (za delegat ekran). Pristup samo
--    delegatu te lige, savezu, adminu i samom sudiji.
create or replace function public.get_sudija_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_can_manage boolean;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_can_manage :=
       public.has_role('admin')
    or public.has_role('savez')
    or public.is_delegat_of_sudija(p_user_id);

  if not v_can_manage and v_uid <> p_user_id then
    raise exception 'Not allowed to view this sudija';
  end if;

  select jsonb_build_object(
    'profile', (
      select to_jsonb(x) from (
        select p.id, p.username, p.display_name,
               p.first_name, p.last_name, p.birth_date,
               p.address, p.phone
        from public.profiles p
        where p.id = p_user_id
      ) x
    ),
    'license', (
      select to_jsonb(x) from (
        select ul.license_number,
               ul.valid_until        as license_valid_until,
               ul.license_file_path
        from public.user_licenses ul
        where ul.user_id = p_user_id
      ) x
    ),
    'leagues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'league_id',   l.id,
        'league_name', l.name,
        'region_id',   r.id,
        'region_name', r.name
      ) order by l.name)
      from public.league_sudije ls
      join public.leagues l on l.id = ls.league_id
      left join public.regions r on r.id = l.region_id
      where ls.user_id = p_user_id
    ), '[]'::jsonb),
    'can_manage', v_can_manage
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_sudija_detail(uuid) to authenticated;

-- 6) RPC: jedinstveni payload za sudija dashboard (profil + licenca + lige + utakmice)
create or replace function public.get_sudija_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_build_object(
    'profile', (
      select to_jsonb(x) from (
        select p.id, p.username, p.display_name,
               p.first_name, p.last_name, p.birth_date,
               p.address, p.phone
        from public.profiles p
        where p.id = v_uid
      ) x
    ),
    'license', (
      select to_jsonb(x) from (
        select ul.license_number,
               ul.valid_until        as license_valid_until,
               ul.license_file_path
        from public.user_licenses ul
        where ul.user_id = v_uid
      ) x
    ),
    'leagues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'league_id',   l.id,
        'league_name', l.name,
        'region_id',   r.id,
        'region_name', r.name
      ) order by l.name)
      from public.league_sudije ls
      join public.leagues l on l.id = ls.league_id
      left join public.regions r on r.id = l.region_id
      where ls.user_id = v_uid
    ), '[]'::jsonb),
    'matches', coalesce(public.get_my_sudija_matches(), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_sudija_dashboard() to authenticated;

notify pgrst, 'reload schema';
