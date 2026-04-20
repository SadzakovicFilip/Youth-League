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

-- =============================================================================
-- FAZA F16: Trener - sastav utakmice (match_rosters) + RPC za listanje/detalje
-- =============================================================================

-- 1) Tabela sastava po utakmici i klubu (po 12 igraca, brojevi dresa 4..15)
create table if not exists public.match_rosters (
  match_id      bigint not null references public.matches(id) on delete cascade,
  club_id       bigint not null references public.clubs(id)   on delete cascade,
  user_id       uuid   not null references public.profiles(id) on delete cascade,
  jersey_number int    not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (match_id, user_id),
  constraint match_rosters_jersey_range check (jersey_number between 4 and 15),
  constraint match_rosters_jersey_unique unique (match_id, club_id, jersey_number)
);

create index if not exists idx_match_rosters_match_club
  on public.match_rosters (match_id, club_id);
create index if not exists idx_match_rosters_user
  on public.match_rosters (user_id);

alter table public.match_rosters enable row level security;

-- 2) Helper: je li p_club_id ucesnik utakmice
create or replace function public.is_match_participant_club(p_match_id bigint, p_club_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (m.home_club_id = p_club_id or m.away_club_id = p_club_id)
  );
$$;
grant execute on function public.is_match_participant_club(bigint, bigint) to authenticated;

-- 3) Helper: moze li auth.uid() da menja roster kluba p_club_id za utakmicu p_match_id
create or replace function public.can_manage_match_roster(p_match_id bigint, p_club_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role('admin')
    or public.has_role('savez')
    or (
      public.is_match_participant_club(p_match_id, p_club_id)
      and (public.is_trener_of(p_club_id) or public.is_klub_direktor_of(p_club_id))
    );
$$;
grant execute on function public.can_manage_match_roster(bigint, bigint) to authenticated;

-- 4) RLS policies
drop policy if exists match_rosters_select on public.match_rosters;
create policy match_rosters_select on public.match_rosters
  for select to authenticated
  using (
    public.has_role('admin')
    or public.has_role('savez')
    or exists (
      select 1 from public.matches m
      where m.id = match_rosters.match_id
        and public.is_delegate_of_league(m.league_id)
    )
    or exists (
      select 1 from public.club_memberships cm
      where cm.club_id = match_rosters.club_id
        and cm.user_id = auth.uid()
        and cm.active  = true
    )
  );

drop policy if exists match_rosters_write on public.match_rosters;
create policy match_rosters_write on public.match_rosters
  for all to authenticated
  using (public.can_manage_match_roster(match_id, club_id))
  with check (public.can_manage_match_roster(match_id, club_id));

-- 5a) Helper: klub trenerovog/klub-direktora naloga
create or replace function public.my_trener_or_klub_club_id()
returns bigint language sql stable security definer set search_path = public as $$
  select cm.club_id
  from public.club_memberships cm
  where cm.user_id = auth.uid()
    and cm.active = true
    and cm.member_role::text in ('klub', 'trener')
  order by case when cm.member_role::text = 'klub' then 0 else 1 end, cm.club_id
  limit 1
$$;
grant execute on function public.my_trener_or_klub_club_id() to authenticated;

-- 5) RPC: lista utakmica trenerovog kluba (upcoming + all)
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
        where mr.match_id = m.id and mr.club_id = (select club_id from effective)) as roster_count
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

-- 6) RPC: detalj utakmice - info, trenutni sastav, raspolozivi igraci + licence
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

-- 7) RPC: upis (replace) sastava
-- p_entries: jsonb array of { user_id: uuid, jersey_number: int }
create or replace function public.save_match_roster(
  p_match_id bigint,
  p_club_id  bigint,
  p_entries  jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_count      int;
  v_match_date date;
  v_has_result boolean;
  v_entry      jsonb;
  v_uid        uuid;
  v_jersey     int;
  v_license    date;
begin
  if not public.can_manage_match_roster(p_match_id, p_club_id) then
    raise exception 'Nemate dozvolu za izmenu sastava ove utakmice';
  end if;

  select m.scheduled_at::date, (m.home_score is not null and m.away_score is not null)
    into v_match_date, v_has_result
  from public.matches m
  where m.id = p_match_id;

  if not found then raise exception 'Utakmica ne postoji'; end if;
  if v_has_result then raise exception 'Utakmica je odigrana i sastav se ne moze menjati'; end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'p_entries mora biti JSON array';
  end if;

  v_count := jsonb_array_length(p_entries);
  if v_count > 12 then raise exception 'Maksimalno 12 igraca u sastavu'; end if;

  if (
    select count(*) <> count(distinct (e->>'user_id')::uuid)
    from jsonb_array_elements(p_entries) as e
  ) then
    raise exception 'Duplirani igraci u sastavu';
  end if;

  if (
    select count(*) <> count(distinct (e->>'jersey_number')::int)
    from jsonb_array_elements(p_entries) as e
  ) then
    raise exception 'Duplirani brojevi dresa u sastavu';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    v_uid    := (v_entry->>'user_id')::uuid;
    v_jersey := (v_entry->>'jersey_number')::int;

    if v_jersey is null or v_jersey < 4 or v_jersey > 15 then
      raise exception 'Broj dresa mora biti izmedju 4 i 15 (dobijen: %)', v_jersey;
    end if;

    if not exists (
      select 1 from public.club_memberships cm
      where cm.user_id = v_uid
        and cm.club_id = p_club_id
        and cm.active  = true
        and cm.member_role::text = 'igrac'
    ) then
      raise exception 'Korisnik % nije aktivan igrac kluba', v_uid;
    end if;

    select ul.valid_until into v_license
      from public.user_licenses ul
      where ul.user_id = v_uid;

    if v_license is null then
      raise exception 'Igrac % nema unet datum vazenja licence', v_uid;
    end if;
    if v_license < v_match_date then
      raise exception 'Licenci igraca % je istekla pre dana utakmice (%)', v_uid, v_license;
    end if;
  end loop;

  delete from public.match_rosters
   where match_id = p_match_id and club_id = p_club_id;

  insert into public.match_rosters (match_id, club_id, user_id, jersey_number)
  select
    p_match_id,
    p_club_id,
    (e->>'user_id')::uuid,
    (e->>'jersey_number')::int
  from jsonb_array_elements(p_entries) as e;
end;
$$;
grant execute on function public.save_match_roster(bigint, bigint, jsonb) to authenticated;

-- =============================================================================
-- FAZA F17: Uslovi za utakmicu, start/end, live statistika
-- =============================================================================

-- 1) Polja za pracenje pocetka/kraja
alter table public.matches
  add column if not exists started_at timestamptz,
  add column if not exists ended_at   timestamptz;

-- 2) Enum tip dogadjaja
do $$ begin
  create type public.match_event_type as enum ('free_throw', 'field', 'three', 'foul');
exception when duplicate_object then null;
end $$;

-- 3) Tabela dogadjaja (svaki event je jedan +1/+2/+3/faul)
create table if not exists public.match_events (
  id          bigserial primary key,
  match_id    bigint not null references public.matches(id) on delete cascade,
  user_id     uuid   not null references public.profiles(id) on delete cascade,
  club_id     bigint not null references public.clubs(id) on delete cascade,
  event_type  public.match_event_type not null,
  points      int    not null default 0 check (points in (0,1,2,3)),
  created_by  uuid   not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_match_events_match on public.match_events (match_id);
create index if not exists idx_match_events_user  on public.match_events (user_id);
create index if not exists idx_match_events_match_user on public.match_events (match_id, user_id);

alter table public.match_events enable row level security;

drop policy if exists match_events_select on public.match_events;
create policy match_events_select on public.match_events
  for select to authenticated
  using (
    public.has_role('admin')
    or public.has_role('savez')
    or exists (
      select 1 from public.matches m
      where m.id = match_events.match_id
        and public.is_delegate_of_league(m.league_id)
    )
    or exists (
      select 1 from public.club_memberships cm
      join public.matches m on m.id = match_events.match_id
      where cm.user_id = auth.uid()
        and cm.active = true
        and (cm.club_id = m.home_club_id or cm.club_id = m.away_club_id)
    )
    or exists (
      select 1 from public.match_officials mo
      where mo.match_id = match_events.match_id
        and mo.user_id = auth.uid()
    )
  );

-- pisanje iskljucivo kroz SECURITY DEFINER funkcije; bez policy-ja za INSERT/UPDATE/DELETE

-- 4) RPC: uslovi za start utakmice
create or replace function public.get_match_conditions(p_match_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  with m as (
    select * from public.matches where id = p_match_id
  ),
  home_roster as (
    select count(*)::int as cnt from public.match_rosters mr, m
    where mr.match_id = m.id and mr.club_id = m.home_club_id
  ),
  away_roster as (
    select count(*)::int as cnt from public.match_rosters mr, m
    where mr.match_id = m.id and mr.club_id = m.away_club_id
  ),
  sudije as (
    select count(*)::int as cnt from public.match_officials mo, m
    where mo.match_id = m.id and mo.role = 'sudija'::official_role
  ),
  zapisnicar as (
    select count(*)::int as cnt from public.match_officials mo, m
    where mo.match_id = m.id and mo.role = 'zapisnicar'::official_role
  )
  select jsonb_build_object(
    'match_id',          (select id from m),
    'status',            coalesce((select status from m), 'scheduled'),
    'started_at',        (select started_at from m),
    'ended_at',          (select ended_at from m),
    'scheduled_at',      (select scheduled_at from m),
    'home_roster_count', (select cnt from home_roster),
    'away_roster_count', (select cnt from away_roster),
    'sudije_count',      (select cnt from sudije),
    'zapisnicar_count',  (select cnt from zapisnicar),
    'cond_rosters',      ((select cnt from home_roster) = 12 and (select cnt from away_roster) = 12),
    'cond_sudije',       ((select cnt from sudije) = 2),
    'cond_zapisnicar',   ((select cnt from zapisnicar) = 1),
    'cond_time',         ((select scheduled_at from m) <= now())
  );
$$;
grant execute on function public.get_match_conditions(bigint) to authenticated;

-- Zbir poena po klubu sa meca -> matches.home_score / away_score (koristi se i uzivo i na kraju)
create or replace function public.refresh_match_live_scores(p_match_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home_club bigint;
  v_away_club bigint;
  v_home_pts int;
  v_away_pts int;
begin
  select m.home_club_id, m.away_club_id
    into v_home_club, v_away_club
  from public.matches m
  where m.id = p_match_id;

  if not found then
    return;
  end if;

  select coalesce(sum(e.points), 0)::int into v_home_pts
  from public.match_events e
  where e.match_id = p_match_id and e.club_id = v_home_club;

  select coalesce(sum(e.points), 0)::int into v_away_pts
  from public.match_events e
  where e.match_id = p_match_id and e.club_id = v_away_club;

  update public.matches
  set home_score = v_home_pts,
      away_score = v_away_pts
  where id = p_match_id;
end;
$$;
grant execute on function public.refresh_match_live_scores(bigint) to authenticated;

-- 5) Start/End utakmice (delegat/savez/admin)
create or replace function public.start_match(p_match_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_m record;
  v_cond jsonb;
begin
  select m.league_id, m.home_club_id, m.away_club_id, coalesce(m.status,'scheduled') as status
    into v_m
  from public.matches m where m.id = p_match_id;

  if not found then raise exception 'Utakmica ne postoji'; end if;

  if not (public.has_role('admin') or public.has_role('savez') or public.is_delegate_of_league(v_m.league_id)) then
    raise exception 'Samo delegat lige moze da pocne utakmicu';
  end if;
  if v_m.status = 'live' then raise exception 'Utakmica je vec u toku'; end if;
  if v_m.status = 'finished' then raise exception 'Utakmica je vec zavrsena'; end if;

  v_cond := public.get_match_conditions(p_match_id);
  if not ((v_cond->>'cond_rosters')::bool
          and (v_cond->>'cond_sudije')::bool
          and (v_cond->>'cond_zapisnicar')::bool
          and (v_cond->>'cond_time')::bool) then
    raise exception 'Nisu ispunjeni svi uslovi za pocetak utakmice';
  end if;

  update public.matches
  set status = 'live',
      started_at = now(),
      home_score = 0,
      away_score = 0
  where id = p_match_id;

  return public.get_match_conditions(p_match_id);
end;
$$;
grant execute on function public.start_match(bigint) to authenticated;

create or replace function public.end_match(p_match_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_m record;
  v_home_total int;
  v_away_total int;
begin
  select m.league_id, m.home_club_id, m.away_club_id, coalesce(m.status,'scheduled') as status
    into v_m
  from public.matches m where m.id = p_match_id;

  if not found then raise exception 'Utakmica ne postoji'; end if;

  if not (public.has_role('admin') or public.has_role('savez') or public.is_delegate_of_league(v_m.league_id)) then
    raise exception 'Samo delegat lige moze da zavrsi utakmicu';
  end if;
  if v_m.status <> 'live' then
    raise exception 'Utakmica nije u toku';
  end if;

  select coalesce(sum(points),0) into v_home_total from public.match_events
   where match_id = p_match_id and club_id = v_m.home_club_id;
  select coalesce(sum(points),0) into v_away_total from public.match_events
   where match_id = p_match_id and club_id = v_m.away_club_id;

  update public.matches
  set status = 'finished',
      ended_at = now(),
      home_score = v_home_total,
      away_score = v_away_total
  where id = p_match_id;

  return public.get_match_conditions(p_match_id);
end;
$$;
grant execute on function public.end_match(bigint) to authenticated;

-- 6) Zapisnicar: upis dogadjaja (+1/+2/+3/foul)
create or replace function public.record_match_event(
  p_match_id   bigint,
  p_user_id    uuid,
  p_event_type text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_match record;
  v_club_id bigint;
  v_points  int;
  v_event   public.match_event_type;
  v_foul_count int;
begin
  begin
    v_event := p_event_type::public.match_event_type;
  exception when others then
    raise exception 'Nepoznat tip dogadjaja: %', p_event_type;
  end;

  select m.id, m.home_club_id, m.away_club_id, coalesce(m.status,'scheduled') as status
    into v_match
  from public.matches m where m.id = p_match_id;
  if not found then raise exception 'Utakmica ne postoji'; end if;
  if v_match.status <> 'live' then raise exception 'Utakmica nije u toku'; end if;

  if not exists (
    select 1 from public.match_officials mo
    where mo.match_id = p_match_id
      and mo.user_id  = auth.uid()
      and mo.role     = 'zapisnicar'::official_role
  ) then
    raise exception 'Nemate dozvolu za upis (niste zapisnicar ove utakmice)';
  end if;

  select mr.club_id into v_club_id
  from public.match_rosters mr
  where mr.match_id = p_match_id and mr.user_id = p_user_id;

  if not found or v_club_id is null then
    raise exception 'Igrac nije u sastavu utakmice';
  end if;

  v_points := case v_event
    when 'free_throw' then 1
    when 'field'      then 2
    when 'three'      then 3
    else 0
  end;

  if v_event = 'foul' then
    select count(*) into v_foul_count from public.match_events
    where match_id = p_match_id and user_id = p_user_id and event_type = 'foul';
    if v_foul_count >= 5 then
      raise exception 'Igrac vec ima 5 faulova (iskljucen)';
    end if;
  end if;

  insert into public.match_events (match_id, user_id, club_id, event_type, points, created_by)
  values (p_match_id, p_user_id, v_club_id, v_event, v_points, auth.uid());

  perform public.refresh_match_live_scores(p_match_id);

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.record_match_event(bigint, uuid, text) to authenticated;

-- 7) Undo poslednji event
create or replace function public.undo_last_match_event(
  p_match_id   bigint,
  p_user_id    uuid,
  p_event_type text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_event public.match_event_type;
  v_id bigint;
begin
  begin
    v_event := p_event_type::public.match_event_type;
  exception when others then
    raise exception 'Nepoznat tip dogadjaja: %', p_event_type;
  end;

  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id and coalesce(m.status,'scheduled') = 'live'
  ) then
    raise exception 'Utakmica nije u toku';
  end if;

  if not exists (
    select 1 from public.match_officials mo
    where mo.match_id = p_match_id
      and mo.user_id  = auth.uid()
      and mo.role     = 'zapisnicar'::official_role
  ) then
    raise exception 'Nemate dozvolu za izmenu (niste zapisnicar)';
  end if;

  select id into v_id
  from public.match_events
  where match_id = p_match_id and user_id = p_user_id and event_type = v_event
  order by created_at desc
  limit 1;

  if v_id is null then
    raise exception 'Nema prethodnog zapisa za taj tip';
  end if;

  delete from public.match_events where id = v_id;

  perform public.refresh_match_live_scores(p_match_id);

  return jsonb_build_object('ok', true, 'deleted_id', v_id);
end;
$$;
grant execute on function public.undo_last_match_event(bigint, uuid, text) to authenticated;

-- 8) Helper: roster + agregirana statistika
create or replace function public.fn_roster_with_stats(p_match_id bigint, p_club_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', mr.user_id,
      'jersey_number', mr.jersey_number,
      'display_name', p.display_name,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'username', p.username,
      'pts_ft', (select count(*) from public.match_events e
                 where e.match_id = p_match_id and e.user_id = mr.user_id and e.event_type = 'free_throw'),
      'pts_2',  (select count(*) from public.match_events e
                 where e.match_id = p_match_id and e.user_id = mr.user_id and e.event_type = 'field'),
      'pts_3',  (select count(*) from public.match_events e
                 where e.match_id = p_match_id and e.user_id = mr.user_id and e.event_type = 'three'),
      'fouls',  (select count(*) from public.match_events e
                 where e.match_id = p_match_id and e.user_id = mr.user_id and e.event_type = 'foul'),
      'total_points', (select coalesce(sum(points),0) from public.match_events e
                        where e.match_id = p_match_id and e.user_id = mr.user_id)
    ) order by mr.jersey_number
  ), '[]'::jsonb)
  from public.match_rosters mr
  left join public.profiles p on p.id = mr.user_id
  where mr.match_id = p_match_id and mr.club_id = p_club_id;
$$;
grant execute on function public.fn_roster_with_stats(bigint, bigint) to authenticated;

-- 9) Zapisnicar: detalj utakmice sa oba roster-a + running stats
create or replace function public.get_zapisnicar_match_detail(p_match_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_m record;
  v_is_zapisnicar boolean;
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

  if not (v_is_zapisnicar or public.has_role('admin') or public.has_role('savez')
          or public.is_delegate_of_league(v_m.league_id)) then
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
    'away_roster', public.fn_roster_with_stats(p_match_id, v_m.away_club_id)
  ) into v_result;
  return v_result;
end;
$$;
grant execute on function public.get_zapisnicar_match_detail(bigint) to authenticated;

-- 10) Zapisnicar: lista utakmica za koje je dodeljen
create or replace function public.get_my_zapisnicar_matches()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'scheduled_at', m.scheduled_at,
      'venue', m.venue,
      'status', coalesce(m.status, 'scheduled'),
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

-- 11) Delegat: detalj utakmice sa uslovima i dodeljenima
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
    )
  ) into v_result;
  return v_result;
end;
$$;
grant execute on function public.get_delegat_match_detail(bigint) to authenticated;

-- =============================================================================
-- FAZA F18: Igrac hub — predstojece / odigrane utakmice + sezona / karijera (stat iz match_events)
-- =============================================================================

-- Igrac: predstojece / odigrane + agregati (sezona = trenutna liga kluba; karijera = sve zavrsene gde je bio u sastavu)
create or replace function public.get_igrac_match_hub()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_club_id    bigint;
  v_league_id  bigint;
  v_league_name text;
  v_upcoming   jsonb;
  v_played     jsonb;
  v_season_pts int;
  v_season_games int;
  v_s_ft int; v_s_2 int; v_s_3 int; v_s_f int;
  v_c_pts int; v_c_games int;
  v_c_ft int; v_c_2 int; v_c_3 int; v_c_f int;
  v_pct1 numeric; v_pct2 numeric; v_pct3 numeric;
  v_cpct1 numeric; v_cpct2 numeric; v_cpct3 numeric;
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
      'club_id', null,
      'league_id', null,
      'league_name', null,
      'upcoming', '[]'::jsonb,
      'played', '[]'::jsonb,
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
      m.id,
      m.scheduled_at,
      m.venue,
      coalesce(m.status, 'scheduled') as status,
      m.home_club_id,
      m.away_club_id,
      hc.name as home_club_name,
      ac.name as away_club_name,
      m.home_score,
      m.away_score,
      case when m.home_club_id = v_club_id then 'home' else 'away' end as side
    from public.matches m
    left join public.clubs hc on hc.id = m.home_club_id
    left join public.clubs ac on ac.id = m.away_club_id
    where (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
      and coalesce(m.status, 'scheduled') in ('scheduled', 'live')
    order by m.scheduled_at asc
    limit 80
  ) t;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.scheduled_at desc), '[]'::jsonb)
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
      (select count(*)::int from public.match_events e
        where e.match_id = m.id and e.user_id = v_uid and e.event_type = 'free_throw') as pts_ft,
      (select count(*)::int from public.match_events e
        where e.match_id = m.id and e.user_id = v_uid and e.event_type = 'field') as pts_2,
      (select count(*)::int from public.match_events e
        where e.match_id = m.id and e.user_id = v_uid and e.event_type = 'three') as pts_3,
      (select count(*)::int from public.match_events e
        where e.match_id = m.id and e.user_id = v_uid and e.event_type = 'foul') as fouls,
      (select coalesce(sum(e.points), 0)::int from public.match_events e
        where e.match_id = m.id and e.user_id = v_uid) as total_points,
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
    where (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
      and m.status = 'finished'
      and exists (
        select 1 from public.match_rosters mr
        where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = v_uid
      )
    order by m.scheduled_at desc
    limit 80
  ) p;

  -- Sezona (liga kluba): broj odigranih meceva (sastav), zatim agregat dogadjaja
  select count(distinct m.id)::int into v_season_games
  from public.matches m
  where m.league_id is not distinct from v_league_id
    and m.status = 'finished'
    and exists (
      select 1 from public.match_rosters mr
      where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = v_uid
    );

  select
    coalesce(sum(case when e.event_type = 'free_throw' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'field' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'three' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'foul' then 1 else 0 end), 0)::int,
    coalesce(sum(e.points), 0)::int
  into v_s_ft, v_s_2, v_s_3, v_s_f, v_season_pts
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.user_id = v_uid
    and m.league_id is not distinct from v_league_id
    and m.status = 'finished'
    and exists (
      select 1 from public.match_rosters mr
      where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = v_uid
    );

  -- Karijera: sve lige / svi zavrseni mecevi gde je bio u sastavu tog kluba (sve aktivne igracke clanstva — uprosceno: isti club_id)
  select count(distinct m.id)::int into v_c_games
  from public.matches m
  where m.status = 'finished'
    and (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
    and exists (
      select 1 from public.match_rosters mr
      where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = v_uid
    );

  select
    coalesce(sum(case when e.event_type = 'free_throw' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'field' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'three' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'foul' then 1 else 0 end), 0)::int,
    coalesce(sum(e.points), 0)::int
  into v_c_ft, v_c_2, v_c_3, v_c_f, v_c_pts
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.user_id = v_uid
    and m.status = 'finished'
    and (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
    and exists (
      select 1 from public.match_rosters mr
      where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = v_uid
    );

  v_pct1 := case when coalesce(v_season_pts, 0) > 0 then round(100.0 * v_s_ft::numeric / v_season_pts, 1) else 0 end;
  v_pct2 := case when coalesce(v_season_pts, 0) > 0 then round(100.0 * (v_s_2 * 2)::numeric / v_season_pts, 1) else 0 end;
  v_pct3 := case when coalesce(v_season_pts, 0) > 0 then round(100.0 * (v_s_3 * 3)::numeric / v_season_pts, 1) else 0 end;

  v_cpct1 := case when coalesce(v_c_pts, 0) > 0 then round(100.0 * v_c_ft::numeric / v_c_pts, 1) else 0 end;
  v_cpct2 := case when coalesce(v_c_pts, 0) > 0 then round(100.0 * (v_c_2 * 2)::numeric / v_c_pts, 1) else 0 end;
  v_cpct3 := case when coalesce(v_c_pts, 0) > 0 then round(100.0 * (v_c_3 * 3)::numeric / v_c_pts, 1) else 0 end;

  return jsonb_build_object(
    'club_id', v_club_id,
    'league_id', v_league_id,
    'league_name', v_league_name,
    'upcoming', coalesce(v_upcoming, '[]'::jsonb),
    'played', coalesce(v_played, '[]'::jsonb),
    'season', jsonb_build_object(
      'games_played', v_season_games,
      'total_points', v_season_pts,
      'avg_points', case when v_season_games > 0 then round(v_season_pts::numeric / v_season_games, 1) else 0 end,
      'pts_ft', v_s_ft,
      'pts_2', v_s_2,
      'pts_3', v_s_3,
      'fouls', v_s_f,
      'pct_points_ft', v_pct1,
      'pct_points_2', v_pct2,
      'pct_points_3', v_pct3
    ),
    'career', jsonb_build_object(
      'games_played', v_c_games,
      'total_points', v_c_pts,
      'avg_points', case when v_c_games > 0 then round(v_c_pts::numeric / v_c_games, 1) else 0 end,
      'pts_ft', v_c_ft,
      'pts_2', v_c_2,
      'pts_3', v_c_3,
      'fouls', v_c_f,
      'pct_points_ft', v_cpct1,
      'pct_points_2', v_cpct2,
      'pct_points_3', v_cpct3
    )
  );
end;
$$;
grant execute on function public.get_igrac_match_hub() to authenticated;

-- =============================================================================
-- FAZA F19: Statistika igraca (public view sa autorizacijom) + moja liga (klubovi)
-- =============================================================================

-- Autorizacija za gledanje statistike/profila nekog korisnika:
--   self, admin, savez: uvek
--   delegat: korisnici ciji klub je u ligi u kojoj sam delegat
--   klub/trener/igrac: korisnici ciji klub je u mojoj ligi (istoj kao liga mog kluba)
create or replace function public.can_view_user_stats(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_user_id is null then
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

  -- delegat lige u kojoj je p_user_id clan kluba
  if exists (
    select 1
    from public.club_memberships cm
    join public.clubs c on c.id = cm.club_id
    join public.league_delegates ld
      on ld.league_id = c.league_id
     and ld.user_id = v_uid
    where cm.user_id = p_user_id
      and cm.active = true
  ) then
    return true;
  end if;

  -- klub/trener/igrac: ako target ima aktivno clanstvo u klubu iste lige kao moj klub
  if exists (
    select 1
    from public.club_memberships me
    join public.clubs mc on mc.id = me.club_id
    join public.clubs tc on tc.league_id is not distinct from mc.league_id
    join public.club_memberships them
      on them.club_id = tc.id
     and them.user_id = p_user_id
     and them.active = true
    where me.user_id = v_uid
      and me.active = true
  ) then
    return true;
  end if;

  return false;
end;
$$;
grant execute on function public.can_view_user_stats(uuid) to authenticated;

-- Statistika mecheva / sezona / karijera za p_user_id (ako je pozivaoc ovlascen)
create or replace function public.get_user_match_stats(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club_id     bigint;
  v_league_id   bigint;
  v_league_name text;
  v_upcoming    jsonb;
  v_played      jsonb;
  v_s_ft int; v_s_2 int; v_s_3 int; v_s_f int; v_season_pts int; v_season_games int;
  v_c_ft int; v_c_2 int; v_c_3 int; v_c_f int; v_c_pts int; v_c_games int;
  v_pct1 numeric; v_pct2 numeric; v_pct3 numeric;
  v_cpct1 numeric; v_cpct2 numeric; v_cpct3 numeric;
begin
  if not public.can_view_user_stats(p_user_id) then
    return jsonb_build_object('authorized', false);
  end if;

  select cm.club_id into v_club_id
  from public.club_memberships cm
  where cm.user_id = p_user_id
    and cm.active = true
    and cm.member_role::text = 'igrac'
  order by cm.club_id
  limit 1;

  if v_club_id is null then
    return jsonb_build_object(
      'authorized', true,
      'club_id', null,
      'league_id', null,
      'league_name', null,
      'upcoming', '[]'::jsonb,
      'played', '[]'::jsonb,
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
      m.id,
      m.scheduled_at,
      m.venue,
      coalesce(m.status, 'scheduled') as status,
      m.home_club_id,
      m.away_club_id,
      hc.name as home_club_name,
      ac.name as away_club_name,
      m.home_score,
      m.away_score,
      case when m.home_club_id = v_club_id then 'home' else 'away' end as side
    from public.matches m
    left join public.clubs hc on hc.id = m.home_club_id
    left join public.clubs ac on ac.id = m.away_club_id
    where (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
      and coalesce(m.status, 'scheduled') in ('scheduled', 'live')
    order by m.scheduled_at asc
    limit 80
  ) t;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.scheduled_at desc), '[]'::jsonb)
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
      (select count(*)::int from public.match_events e
        where e.match_id = m.id and e.user_id = p_user_id and e.event_type = 'free_throw') as pts_ft,
      (select count(*)::int from public.match_events e
        where e.match_id = m.id and e.user_id = p_user_id and e.event_type = 'field') as pts_2,
      (select count(*)::int from public.match_events e
        where e.match_id = m.id and e.user_id = p_user_id and e.event_type = 'three') as pts_3,
      (select count(*)::int from public.match_events e
        where e.match_id = m.id and e.user_id = p_user_id and e.event_type = 'foul') as fouls,
      (select coalesce(sum(e.points), 0)::int from public.match_events e
        where e.match_id = m.id and e.user_id = p_user_id) as total_points,
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
    where (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
      and m.status = 'finished'
      and exists (
        select 1 from public.match_rosters mr
        where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = p_user_id
      )
    order by m.scheduled_at desc
    limit 80
  ) p;

  select count(distinct m.id)::int into v_season_games
  from public.matches m
  where m.league_id is not distinct from v_league_id
    and m.status = 'finished'
    and exists (
      select 1 from public.match_rosters mr
      where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = p_user_id
    );

  select
    coalesce(sum(case when e.event_type = 'free_throw' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'field' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'three' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'foul' then 1 else 0 end), 0)::int,
    coalesce(sum(e.points), 0)::int
  into v_s_ft, v_s_2, v_s_3, v_s_f, v_season_pts
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.user_id = p_user_id
    and m.league_id is not distinct from v_league_id
    and m.status = 'finished'
    and exists (
      select 1 from public.match_rosters mr
      where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = p_user_id
    );

  select count(distinct m.id)::int into v_c_games
  from public.matches m
  where m.status = 'finished'
    and (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
    and exists (
      select 1 from public.match_rosters mr
      where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = p_user_id
    );

  select
    coalesce(sum(case when e.event_type = 'free_throw' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'field' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'three' then 1 else 0 end), 0)::int,
    coalesce(sum(case when e.event_type = 'foul' then 1 else 0 end), 0)::int,
    coalesce(sum(e.points), 0)::int
  into v_c_ft, v_c_2, v_c_3, v_c_f, v_c_pts
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.user_id = p_user_id
    and m.status = 'finished'
    and (m.home_club_id = v_club_id or m.away_club_id = v_club_id)
    and exists (
      select 1 from public.match_rosters mr
      where mr.match_id = m.id and mr.club_id = v_club_id and mr.user_id = p_user_id
    );

  v_pct1 := case when coalesce(v_season_pts, 0) > 0 then round(100.0 * v_s_ft::numeric / v_season_pts, 1) else 0 end;
  v_pct2 := case when coalesce(v_season_pts, 0) > 0 then round(100.0 * (v_s_2 * 2)::numeric / v_season_pts, 1) else 0 end;
  v_pct3 := case when coalesce(v_season_pts, 0) > 0 then round(100.0 * (v_s_3 * 3)::numeric / v_season_pts, 1) else 0 end;

  v_cpct1 := case when coalesce(v_c_pts, 0) > 0 then round(100.0 * v_c_ft::numeric / v_c_pts, 1) else 0 end;
  v_cpct2 := case when coalesce(v_c_pts, 0) > 0 then round(100.0 * (v_c_2 * 2)::numeric / v_c_pts, 1) else 0 end;
  v_cpct3 := case when coalesce(v_c_pts, 0) > 0 then round(100.0 * (v_c_3 * 3)::numeric / v_c_pts, 1) else 0 end;

  return jsonb_build_object(
    'authorized', true,
    'club_id', v_club_id,
    'league_id', v_league_id,
    'league_name', v_league_name,
    'upcoming', coalesce(v_upcoming, '[]'::jsonb),
    'played', coalesce(v_played, '[]'::jsonb),
    'season', jsonb_build_object(
      'games_played', v_season_games,
      'total_points', v_season_pts,
      'avg_points', case when v_season_games > 0 then round(v_season_pts::numeric / v_season_games, 1) else 0 end,
      'pts_ft', v_s_ft,
      'pts_2', v_s_2,
      'pts_3', v_s_3,
      'fouls', v_s_f,
      'pct_points_ft', v_pct1,
      'pct_points_2', v_pct2,
      'pct_points_3', v_pct3
    ),
    'career', jsonb_build_object(
      'games_played', v_c_games,
      'total_points', v_c_pts,
      'avg_points', case when v_c_games > 0 then round(v_c_pts::numeric / v_c_games, 1) else 0 end,
      'pts_ft', v_c_ft,
      'pts_2', v_c_2,
      'pts_3', v_c_3,
      'fouls', v_c_f,
      'pct_points_ft', v_cpct1,
      'pct_points_2', v_cpct2,
      'pct_points_3', v_cpct3
    )
  );
end;
$$;
grant execute on function public.get_user_match_stats(uuid) to authenticated;

-- Klubovi u mojoj ligi (za klub/trener/igrac drill-down)
create or replace function public.get_my_league_clubs()
returns table (
  league_id bigint,
  league_name text,
  region_id bigint,
  region_name text,
  club_id bigint,
  club_name text,
  is_my_club boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with my_leagues as (
    select distinct c.league_id, mine.club_id as my_club_id
    from public.club_memberships mine
    join public.clubs c on c.id = mine.club_id
    where mine.user_id = auth.uid()
      and mine.active = true
      and c.league_id is not null
  )
  select
    l.id         as league_id,
    l.name       as league_name,
    r.id         as region_id,
    r.name       as region_name,
    c.id         as club_id,
    c.name       as club_name,
    exists (select 1 from my_leagues ml where ml.my_club_id = c.id) as is_my_club
  from my_leagues ml
  join public.leagues l on l.id = ml.league_id
  left join public.regions r on r.id = l.region_id
  join public.clubs c on c.league_id = l.id
  order by l.name, c.name;
$$;
grant execute on function public.get_my_league_clubs() to authenticated;

-- =============================================================================
-- FAZA F20: Fix-evi
--   1) matches.updated_at kolona (trigger moddatetime/set_updated_at trazi NEW.updated_at)
--   2) RPC za razresavanje login email-a po username-u (username bez tacke)
-- =============================================================================

-- 1) Dodaj updated_at na matches ako fali (neki trigger postavlja NEW.updated_at)
alter table public.matches
  add column if not exists updated_at timestamptz not null default now();

-- 2) Resolver: za dati username vrati tacan auth email (iz auth.users),
--    kako bi login na klijentu mogao da ga upotrebi umesto "rekonstrukcije".
create or replace function public.get_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p_username is not null
    and length(trim(p_username)) > 0
    and lower(p.username) = lower(trim(p_username))
  limit 1;
$$;
revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

-- =============================================================================
-- FAZA F21:
--   1) Undo bilo kog zadnjeg event-a (globalni "undo" za zapisnicara)
--   2) Prosirena autorizacija za get_club_team_detail i get_user_detail
--      (klub/trener/igrac mogu da vide timove/profile iz iste lige — bez licnih i licenci)
-- =============================================================================

-- 1) Global undo: obrisi poslednji upisani event u utakmici (bilo koji tip/igrac)
create or replace function public.undo_last_match_event_any(p_match_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_type public.match_event_type;
  v_user uuid;
begin
  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id and coalesce(m.status,'scheduled') = 'live'
  ) then
    raise exception 'Utakmica nije u toku';
  end if;

  if not exists (
    select 1 from public.match_officials mo
    where mo.match_id = p_match_id
      and mo.user_id  = auth.uid()
      and mo.role     = 'zapisnicar'::official_role
  ) then
    raise exception 'Nemate dozvolu za izmenu (niste zapisnicar)';
  end if;

  select id, event_type, user_id
    into v_id, v_type, v_user
  from public.match_events
  where match_id = p_match_id
  order by created_at desc, id desc
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'Nema dogadjaja za undo');
  end if;

  delete from public.match_events where id = v_id;

  perform public.refresh_match_live_scores(p_match_id);

  return jsonb_build_object(
    'ok', true,
    'deleted_id', v_id,
    'event_type', v_type::text,
    'user_id', v_user
  );
end;
$$;
grant execute on function public.undo_last_match_event_any(bigint) to authenticated;

-- 2) Autorizacija za gledanje tima kluba (bez licnih podataka za "strance" iz iste lige)
--    - self/klub/trener/igrac/zapisnicar tog kluba: can_view_sensitive = true
--    - admin/savez: can_view_sensitive = true
--    - delegat lige u kojoj je klub: can_view_sensitive = true
--    - klub/trener/igrac iz drugog kluba iste lige: dozvoljeno da vidi tim (imena, igraci),
--        ali can_view_sensitive = false (bez licence, adrese, telefona, datum rodjenja)
create or replace function public.can_view_club_team(p_club_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league bigint;
begin
  if v_uid is null or p_club_id is null then
    return false;
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = v_uid and role::text in ('admin','savez')
  ) then
    return true;
  end if;

  -- clan samog kluba
  if exists (
    select 1 from public.club_memberships
    where club_id = p_club_id and user_id = v_uid and active = true
  ) then
    return true;
  end if;

  select league_id into v_league from public.clubs where id = p_club_id;

  -- delegat lige u kojoj je klub
  if v_league is not null and exists (
    select 1 from public.league_delegates
    where league_id = v_league and user_id = v_uid
  ) then
    return true;
  end if;

  -- clan nekog drugog kluba u istoj ligi
  if v_league is not null and exists (
    select 1
    from public.club_memberships me
    join public.clubs mc on mc.id = me.club_id
    where me.user_id = v_uid
      and me.active = true
      and mc.league_id = v_league
  ) then
    return true;
  end if;

  return false;
end;
$$;
grant execute on function public.can_view_club_team(bigint) to authenticated;

create or replace function public.can_view_club_team_sensitive(p_club_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league bigint;
begin
  if v_uid is null or p_club_id is null then
    return false;
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = v_uid and role::text in ('admin','savez')
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.club_memberships
    where club_id = p_club_id and user_id = v_uid and active = true
  ) then
    return true;
  end if;

  select league_id into v_league from public.clubs where id = p_club_id;

  if v_league is not null and exists (
    select 1 from public.league_delegates
    where league_id = v_league and user_id = v_uid
  ) then
    return true;
  end if;

  return false;
end;
$$;
grant execute on function public.can_view_club_team_sensitive(bigint) to authenticated;

-- Prepravljen get_club_team_detail: ako korisnik moze da vidi tim, vrati podatke;
-- licni podaci i licence se pune samo ako je sensitive dozvoljen
create or replace function public.get_club_team_detail(p_club_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_can_view boolean;
  v_sensitive boolean;
  v_ctx jsonb;
  v_players jsonb;
  v_trainers jsonb;
begin
  if p_club_id is null then
    raise exception 'Club id is required';
  end if;

  v_can_view := public.can_view_club_team(p_club_id);
  if not v_can_view then
    raise exception 'Not allowed to view this club team';
  end if;

  v_sensitive := public.can_view_club_team_sensitive(p_club_id);

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
  into v_ctx
  from public.clubs c
  left join public.leagues       l  on l.id  = c.league_id
  left join public.regions       r  on r.id  = l.region_id
  left join public.group_clubs   gc on gc.club_id = c.id
  left join public.league_groups lg on lg.id = gc.group_id
  where c.id = p_club_id
  limit 1;

  with team as (
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
    where cm.club_id = p_club_id
      and cm.active  = true
      and cm.member_role::text in ('igrac','trener')
  ),
  lics as (
    select
      ul.user_id,
      ul.license_number,
      ul.valid_until,
      ul.license_file_path
    from public.user_licenses ul
    where ul.user_id in (select user_id from team)
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id', t.user_id,
        'username', t.username,
        'display_name', t.display_name,
        'first_name', t.first_name,
        'last_name', t.last_name,
        'birth_date', case when v_sensitive then t.birth_date else null end,
        'address', case when v_sensitive then t.address else null end,
        'phone', case when v_sensitive then t.phone else null end,
        'license_number', case when v_sensitive then ul.license_number else null end,
        'license_valid_until', case when v_sensitive then ul.valid_until else null end,
        'license_file_path', case when v_sensitive then ul.license_file_path else null end
      )
      order by coalesce(t.display_name, t.username)
    ), '[]'::jsonb)
  into v_players
  from team t
  left join lics ul on ul.user_id = t.user_id
  where t.member_role = 'igrac';

  with team as (
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
    where cm.club_id = p_club_id
      and cm.active  = true
      and cm.member_role::text in ('igrac','trener')
  ),
  lics as (
    select
      ul.user_id,
      ul.license_number,
      ul.valid_until,
      ul.license_file_path
    from public.user_licenses ul
    where ul.user_id in (select user_id from team)
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id', t.user_id,
        'username', t.username,
        'display_name', t.display_name,
        'first_name', t.first_name,
        'last_name', t.last_name,
        'birth_date', case when v_sensitive then t.birth_date else null end,
        'address', case when v_sensitive then t.address else null end,
        'phone', case when v_sensitive then t.phone else null end,
        'license_number', case when v_sensitive then ul.license_number else null end,
        'license_valid_until', case when v_sensitive then ul.valid_until else null end,
        'license_file_path', case when v_sensitive then ul.license_file_path else null end
      )
      order by coalesce(t.display_name, t.username)
    ), '[]'::jsonb)
  into v_trainers
  from team t
  left join lics ul on ul.user_id = t.user_id
  where t.member_role = 'trener';

  return jsonb_build_object(
    'context', v_ctx,
    'players', coalesce(v_players, '[]'::jsonb),
    'trainers', coalesce(v_trainers, '[]'::jsonb),
    'can_view_sensitive', v_sensitive
  );
end;
$$;
grant execute on function public.get_club_team_detail(bigint) to authenticated;

-- 3) Profil korisnika: dozvola paralelna sa can_view_user_stats; sensitive je uze
create or replace function public.get_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_authorized boolean;
  v_sensitive  boolean;
  v_profile jsonb;
  v_role text;
  v_memberships jsonb;
  v_license jsonb;
begin
  if v_uid is null or p_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_authorized := public.can_view_user_stats(p_user_id);
  if not v_authorized then
    raise exception 'Not allowed to view this user';
  end if;

  v_sensitive := public.can_view_user_license_pdf(p_user_id);

  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'birth_date', case when v_sensitive then p.birth_date else null end,
    'address',    case when v_sensitive then p.address else null end,
    'phone',      case when v_sensitive then p.phone else null end,
    'created_at', p.created_at
  )
  into v_profile
  from public.profiles p
  where p.id = p_user_id
  limit 1;

  select role::text into v_role
  from public.user_roles
  where user_id = p_user_id
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'club_id', cm.club_id,
      'club_name', c.name,
      'member_role', cm.member_role::text,
      'league_id', c.league_id,
      'league_name', l.name,
      'region_id', l.region_id,
      'region_name', r.name
    )
    order by c.name
  ), '[]'::jsonb)
  into v_memberships
  from public.club_memberships cm
  join public.clubs c on c.id = cm.club_id
  left join public.leagues l on l.id = c.league_id
  left join public.regions r on r.id = l.region_id
  where cm.user_id = p_user_id and cm.active = true;

  if v_sensitive then
    select jsonb_build_object(
      'license_number', ul.license_number,
      'license_valid_until', ul.valid_until,
      'license_file_path', ul.license_file_path
    )
    into v_license
    from public.user_licenses ul
    where ul.user_id = p_user_id
    limit 1;
  else
    v_license := null;
  end if;

  return jsonb_build_object(
    'profile', v_profile,
    'role', v_role,
    'memberships', v_memberships,
    'license', v_license,
    'can_view_sensitive', v_sensitive
  );
end;
$$;
grant execute on function public.get_user_detail(uuid) to authenticated;

-- =============================================================================
-- FAZA F22: Tabela (standings) + lista strelaca + utakmice kluba (public view)
-- =============================================================================

-- Autorizacija: ko sme da vidi takmicarske tabele / strelce / utakmice odredjene lige
create or replace function public.can_view_league(p_league_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_league_id is null then
    return false;
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = v_uid and role::text in ('admin','savez')
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.league_delegates
    where league_id = p_league_id and user_id = v_uid
  ) then
    return true;
  end if;

  -- clan bilo kog kluba iz te lige
  if exists (
    select 1
    from public.club_memberships cm
    join public.clubs c on c.id = cm.club_id
    where cm.user_id = v_uid
      and cm.active = true
      and c.league_id = p_league_id
  ) then
    return true;
  end if;

  return false;
end;
$$;
grant execute on function public.can_view_league(bigint) to authenticated;

-- Tabela grupe: pobeda = 2 boda, poraz = 1 bod (remi se defanzivno tretira kao 1, mada u kosarci ne postoji)
-- + odigrani/pobede/porazi/postignuto/primljeno/kos-razlika
create or replace function public.get_group_standings(p_group_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_group  record;
  v_clubs  jsonb;
  v_rows   jsonb;
begin
  if p_group_id is null then
    raise exception 'Group id is required';
  end if;

  select lg.id, lg.league_id, lg.name, l.name as league_name, r.id as region_id, r.name as region_name
    into v_group
  from public.league_groups lg
  join public.leagues l on l.id = lg.league_id
  left join public.regions r on r.id = l.region_id
  where lg.id = p_group_id;

  if not found then
    raise exception 'Grupa ne postoji';
  end if;

  if not public.can_view_league(v_group.league_id) then
    raise exception 'Not allowed to view this league';
  end if;

  -- 1) Tabela (standings)
  with gc as (
    select gc.club_id, c.name as club_name
    from public.group_clubs gc
    join public.clubs c on c.id = gc.club_id
    where gc.group_id = p_group_id
  ),
  m as (
    select
      mm.id,
      mm.home_club_id,
      mm.away_club_id,
      coalesce(mm.home_score, 0) as hs,
      coalesce(mm.away_score, 0) as as_
    from public.matches mm
    where mm.group_id = p_group_id
      and coalesce(mm.status::text, 'scheduled') = 'finished'
  ),
  sides as (
    select m.home_club_id as club_id, m.hs as pf, m.as_ as pa,
           case when m.hs > m.as_ then 'W' when m.hs < m.as_ then 'L' else 'N' end as res
    from m
    union all
    select m.away_club_id as club_id, m.as_ as pf, m.hs as pa,
           case when m.as_ > m.hs then 'W' when m.as_ < m.hs then 'L' else 'N' end as res
    from m
  ),
  agg as (
    select
      gc.club_id,
      gc.club_name,
      coalesce(count(s.club_id) filter (where s.club_id is not null), 0)::int as games_played,
      coalesce(sum(case when s.res = 'W' then 1 else 0 end), 0)::int           as wins,
      coalesce(sum(case when s.res = 'L' then 1 else 0 end), 0)::int           as losses,
      coalesce(sum(case when s.res = 'N' then 1 else 0 end), 0)::int           as draws,
      coalesce(sum(s.pf), 0)::int                                              as points_scored,
      coalesce(sum(s.pa), 0)::int                                              as points_allowed,
      coalesce(
        sum(case when s.res = 'W' then 2 else 0 end)
        + sum(case when s.res = 'L' then 1 else 0 end)
        + sum(case when s.res = 'N' then 1 else 0 end),
        0
      )::int                                                                   as table_points
    from gc
    left join sides s on s.club_id = gc.club_id
    group by gc.club_id, gc.club_name
  )
  select coalesce(jsonb_agg(
      jsonb_build_object(
        'club_id',        a.club_id,
        'club_name',      a.club_name,
        'games_played',   a.games_played,
        'wins',           a.wins,
        'losses',         a.losses,
        'draws',          a.draws,
        'points_scored',  a.points_scored,
        'points_allowed', a.points_allowed,
        'point_diff',     (a.points_scored - a.points_allowed),
        'table_points',   a.table_points
      )
      order by
        a.table_points desc,
        (a.points_scored - a.points_allowed) desc,
        a.points_scored desc,
        a.club_name asc
    ), '[]'::jsonb)
  into v_rows
  from agg a;

  -- 2) Lista klubova u grupi (za prikaz u UI)
  select coalesce(
      jsonb_agg(
        jsonb_build_object('club_id', gc.club_id, 'club_name', c.name)
        order by c.name
      ),
      '[]'::jsonb
    )
  into v_clubs
  from public.group_clubs gc
  join public.clubs c on c.id = gc.club_id
  where gc.group_id = p_group_id;

  return jsonb_build_object(
    'group', jsonb_build_object(
      'id',          v_group.id,
      'name',        v_group.name,
      'league_id',   v_group.league_id,
      'league_name', v_group.league_name,
      'region_id',   v_group.region_id,
      'region_name', v_group.region_name
    ),
    'clubs',     coalesce(v_clubs, '[]'::jsonb),
    'standings', coalesce(v_rows,  '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_group_standings(bigint) to authenticated;

-- Strelci lige (ili samo grupe ako se zada p_group_id) iz match_events zavrsenih mec-eva.
create or replace function public.get_league_top_scorers(
  p_league_id bigint,
  p_group_id  bigint default null,
  p_limit     int    default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_league_name text;
  v_rows        jsonb;
begin
  if p_league_id is null then
    raise exception 'League id is required';
  end if;

  if not public.can_view_league(p_league_id) then
    raise exception 'Not allowed to view this league';
  end if;

  select l.name into v_league_name from public.leagues l where l.id = p_league_id;

  with m as (
    select mm.id, mm.home_club_id, mm.away_club_id
    from public.matches mm
    where mm.league_id = p_league_id
      and mm.status = 'finished'
      and (p_group_id is null or mm.group_id = p_group_id)
  ),
  evt as (
    select e.user_id, e.event_type, e.points, e.match_id
    from public.match_events e
    join m on m.id = e.match_id
  ),
  -- player's club in this context: we take their roster club on that match (or fallback to active igrac membership)
  player_club as (
    select distinct on (evt.user_id)
      evt.user_id,
      coalesce(mr.club_id, cm.club_id) as club_id
    from evt
    left join public.match_rosters mr on mr.user_id = evt.user_id and mr.match_id = evt.match_id
    left join public.club_memberships cm
      on cm.user_id = evt.user_id
     and cm.active = true
     and cm.member_role::text = 'igrac'
    order by evt.user_id, mr.club_id nulls last
  ),
  agg as (
    select
      e.user_id,
      count(distinct e.match_id)::int                                           as games,
      coalesce(sum(e.points), 0)::int                                           as total_points,
      sum(case when e.event_type = 'free_throw' then 1 else 0 end)::int         as pts_ft,
      sum(case when e.event_type = 'field'      then 1 else 0 end)::int         as pts_2,
      sum(case when e.event_type = 'three'      then 1 else 0 end)::int         as pts_3,
      sum(case when e.event_type = 'foul'       then 1 else 0 end)::int         as fouls
    from evt e
    group by e.user_id
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.total_points desc, coalesce(x.display_name, x.username) asc), '[]'::jsonb)
  into v_rows
  from (
    select
      a.user_id,
      p.username,
      p.display_name,
      p.first_name,
      p.last_name,
      pc.club_id,
      c.name as club_name,
      a.games,
      a.total_points,
      case when a.games > 0 then round(a.total_points::numeric / a.games, 1) else 0 end as avg_points,
      a.pts_ft,
      a.pts_2,
      a.pts_3,
      a.fouls
    from agg a
    left join public.profiles p on p.id = a.user_id
    left join player_club pc on pc.user_id = a.user_id
    left join public.clubs c on c.id = pc.club_id
    where a.total_points > 0
    order by a.total_points desc
    limit greatest(coalesce(p_limit, 100), 1)
  ) x;

  return jsonb_build_object(
    'league_id', p_league_id,
    'league_name', v_league_name,
    'group_id', p_group_id,
    'top_scorers', v_rows
  );
end;
$$;
grant execute on function public.get_league_top_scorers(bigint, bigint, int) to authenticated;

-- Utakmice kluba (public): odigrane + predstojece sa rezultatom; dostupno unutar iste lige
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

  -- dopusti: admin/savez, delegat lige, bilo ko iz iste lige (ili sam klub)
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
            when coalesce(m.away_score,0) < coalesce(m.home_score,0) then 'L'
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

-- Pomocni RPC: vrati pregled lige — sve grupe + osnovne podatke, sa autorizacijom
create or replace function public.get_league_overview(p_league_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_league record;
  v_groups jsonb;
begin
  if p_league_id is null then
    raise exception 'League id is required';
  end if;

  if not public.can_view_league(p_league_id) then
    raise exception 'Not allowed to view this league';
  end if;

  select l.id, l.name, l.region_id, r.name as region_name
    into v_league
  from public.leagues l
  left join public.regions r on r.id = l.region_id
  where l.id = p_league_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', lg.id,
    'name', lg.name
  ) order by lg.name), '[]'::jsonb)
  into v_groups
  from public.league_groups lg
  where lg.league_id = p_league_id;

  return jsonb_build_object(
    'league', jsonb_build_object(
      'id', v_league.id,
      'name', v_league.name,
      'region_id', v_league.region_id,
      'region_name', v_league.region_name
    ),
    'groups', v_groups
  );
end;
$$;
grant execute on function public.get_league_overview(bigint) to authenticated;

-- =============================================================================
-- FAZA F23: Treninzi + prisustvo + Taktike + akcije (za trenera / igraca)
-- =============================================================================

-- 0) Enum za tip taktike
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tactic_kind') then
    create type public.tactic_kind as enum ('attack', 'defense');
  end if;
end$$;

-- 1) Tabela: trainings
create table if not exists public.trainings (
  id            bigserial primary key,
  club_id       bigint not null references public.clubs(id) on delete cascade,
  created_by    uuid not null references public.profiles(id) on delete restrict,
  scheduled_at  timestamptz not null,
  topic         text not null,
  venue         text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_trainings_club_sched on public.trainings (club_id, scheduled_at desc);

-- 2) Tabela: training_attendance (1 red po (trening, igrac))
create table if not exists public.training_attendance (
  training_id bigint not null references public.trainings(id) on delete cascade,
  player_id   uuid   not null references public.profiles(id) on delete cascade,
  present     boolean not null default false,
  marked_at   timestamptz not null default now(),
  marked_by   uuid references public.profiles(id),
  primary key (training_id, player_id)
);
create index if not exists idx_training_attendance_player on public.training_attendance (player_id);

-- 3) Tabela: club_tactic_plans + tactic_actions
create table if not exists public.club_tactic_plans (
  id          bigserial primary key,
  club_id     bigint not null references public.clubs(id) on delete cascade,
  created_by  uuid not null references public.profiles(id) on delete restrict,
  name        text not null,
  kind        public.tactic_kind not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tactic_plans_club_kind on public.club_tactic_plans (club_id, kind, is_active);

create table if not exists public.tactic_actions (
  id          bigserial primary key,
  tactic_id   bigint not null references public.club_tactic_plans(id) on delete cascade,
  name        text not null,
  description text,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tactic_actions_tactic on public.tactic_actions (tactic_id, position);

-- 4) Helperi za autorizaciju
create or replace function public.can_manage_trainings(p_club_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role('admin')
    or public.has_role('savez')
    or exists (
      select 1
      from public.club_memberships cm
      where cm.club_id = p_club_id
        and cm.user_id = auth.uid()
        and cm.active = true
        and cm.member_role::text in ('klub','trener')
    );
$$;
grant execute on function public.can_manage_trainings(bigint) to authenticated;

create or replace function public.can_view_club_trainings(p_club_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league bigint;
begin
  if v_uid is null or p_club_id is null then
    return false;
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = v_uid and role::text in ('admin','savez')
  ) then
    return true;
  end if;

  -- clan tog kluba (klub, trener, igrac)
  if exists (
    select 1 from public.club_memberships cm
    where cm.club_id = p_club_id
      and cm.user_id = v_uid
      and cm.active = true
  ) then
    return true;
  end if;

  -- delegat lige u kojoj je klub
  select league_id into v_league from public.clubs where id = p_club_id;
  if v_league is not null and exists (
    select 1 from public.league_delegates
    where league_id = v_league and user_id = v_uid
  ) then
    return true;
  end if;

  return false;
end;
$$;
grant execute on function public.can_view_club_trainings(bigint) to authenticated;

-- 5) RLS
alter table public.trainings             enable row level security;
alter table public.training_attendance   enable row level security;
alter table public.club_tactic_plans     enable row level security;
alter table public.tactic_actions        enable row level security;

drop policy if exists trainings_select on public.trainings;
create policy trainings_select on public.trainings
  for select to authenticated
  using (public.can_view_club_trainings(club_id));

drop policy if exists trainings_write on public.trainings;
create policy trainings_write on public.trainings
  for all to authenticated
  using (public.can_manage_trainings(club_id))
  with check (public.can_manage_trainings(club_id));

drop policy if exists training_attendance_select on public.training_attendance;
create policy training_attendance_select on public.training_attendance
  for select to authenticated
  using (
    exists (
      select 1 from public.trainings t
      where t.id = training_attendance.training_id
        and public.can_view_club_trainings(t.club_id)
    )
  );

drop policy if exists training_attendance_write on public.training_attendance;
create policy training_attendance_write on public.training_attendance
  for all to authenticated
  using (
    exists (
      select 1 from public.trainings t
      where t.id = training_attendance.training_id
        and public.can_manage_trainings(t.club_id)
    )
  )
  with check (
    exists (
      select 1 from public.trainings t
      where t.id = training_attendance.training_id
        and public.can_manage_trainings(t.club_id)
    )
  );

drop policy if exists tactic_plans_select on public.club_tactic_plans;
create policy tactic_plans_select on public.club_tactic_plans
  for select to authenticated
  using (public.can_view_club_trainings(club_id));

drop policy if exists tactic_plans_write on public.club_tactic_plans;
create policy tactic_plans_write on public.club_tactic_plans
  for all to authenticated
  using (public.can_manage_trainings(club_id))
  with check (public.can_manage_trainings(club_id));

drop policy if exists tactic_actions_select on public.tactic_actions;
create policy tactic_actions_select on public.tactic_actions
  for select to authenticated
  using (
    exists (
      select 1 from public.club_tactic_plans p
      where p.id = tactic_actions.tactic_id
        and public.can_view_club_trainings(p.club_id)
    )
  );

drop policy if exists tactic_actions_write on public.tactic_actions;
create policy tactic_actions_write on public.tactic_actions
  for all to authenticated
  using (
    exists (
      select 1 from public.club_tactic_plans p
      where p.id = tactic_actions.tactic_id
        and public.can_manage_trainings(p.club_id)
    )
  )
  with check (
    exists (
      select 1 from public.club_tactic_plans p
      where p.id = tactic_actions.tactic_id
        and public.can_manage_trainings(p.club_id)
    )
  );

-- 6) RPC: lista treninga kluba (koristi ga trener + klub + igrac + savez/delegat)
create or replace function public.get_club_trainings(p_club_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club record;
  v_rows jsonb;
begin
  if p_club_id is null then
    raise exception 'Club id is required';
  end if;
  if not public.can_view_club_trainings(p_club_id) then
    raise exception 'Not allowed to view trainings';
  end if;

  select c.id, c.name into v_club from public.clubs c where c.id = p_club_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',            t.id,
      'scheduled_at',  t.scheduled_at,
      'topic',         t.topic,
      'venue',         t.venue,
      'note',          t.note,
      'players_total', coalesce(a.total, 0),
      'players_present', coalesce(a.present_count, 0)
    )
    order by t.scheduled_at desc
  ), '[]'::jsonb)
  into v_rows
  from public.trainings t
  left join lateral (
    select count(*)::int as total,
           sum(case when ta.present then 1 else 0 end)::int as present_count
    from public.training_attendance ta
    where ta.training_id = t.id
  ) a on true
  where t.club_id = p_club_id;

  return jsonb_build_object(
    'club', jsonb_build_object('id', v_club.id, 'name', v_club.name),
    'can_manage', public.can_manage_trainings(p_club_id),
    'trainings', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_club_trainings(bigint) to authenticated;

-- 7) RPC: detalji jednog treninga + roster (igraci) sa statusom prisustva
create or replace function public.get_training_detail(p_training_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_training record;
  v_players jsonb;
begin
  if p_training_id is null then
    raise exception 'Training id is required';
  end if;

  select t.id, t.club_id, t.scheduled_at, t.topic, t.venue, t.note, t.created_by
    into v_training
  from public.trainings t
  where t.id = p_training_id;

  if not found then
    raise exception 'Trening ne postoji';
  end if;

  if not public.can_view_club_trainings(v_training.club_id) then
    raise exception 'Not allowed to view this training';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'player_id',    cm.user_id,
      'username',     p.username,
      'display_name', p.display_name,
      'first_name',   p.first_name,
      'last_name',    p.last_name,
      'present',      coalesce(ta.present, false)
    )
    order by coalesce(p.display_name, p.last_name, p.username)
  ), '[]'::jsonb)
  into v_players
  from public.club_memberships cm
  join public.profiles p on p.id = cm.user_id
  left join public.training_attendance ta
    on ta.training_id = p_training_id and ta.player_id = cm.user_id
  where cm.club_id = v_training.club_id
    and cm.active = true
    and cm.member_role::text = 'igrac';

  return jsonb_build_object(
    'training', jsonb_build_object(
      'id',           v_training.id,
      'club_id',      v_training.club_id,
      'scheduled_at', v_training.scheduled_at,
      'topic',        v_training.topic,
      'venue',        v_training.venue,
      'note',         v_training.note
    ),
    'can_manage', public.can_manage_trainings(v_training.club_id),
    'players',    coalesce(v_players, '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_training_detail(bigint) to authenticated;

-- 8) RPC: create / update / delete
create or replace function public.create_training(
  p_club_id      bigint,
  p_scheduled_at timestamptz,
  p_topic        text,
  p_venue        text,
  p_note         text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if not public.can_manage_trainings(p_club_id) then
    raise exception 'Nemate dozvolu za ovaj klub';
  end if;
  if p_scheduled_at is null then
    raise exception 'Datum i vreme su obavezni';
  end if;
  if coalesce(trim(p_topic),'') = '' then
    raise exception 'Tema treninga je obavezna';
  end if;

  insert into public.trainings (club_id, created_by, scheduled_at, topic, venue, note)
  values (p_club_id, auth.uid(), p_scheduled_at, trim(p_topic), nullif(trim(p_venue), ''), nullif(trim(p_note), ''))
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.create_training(bigint, timestamptz, text, text, text) to authenticated;

create or replace function public.update_training(
  p_training_id  bigint,
  p_scheduled_at timestamptz,
  p_topic        text,
  p_venue        text,
  p_note         text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club bigint;
begin
  select club_id into v_club from public.trainings where id = p_training_id;
  if v_club is null then
    raise exception 'Trening ne postoji';
  end if;
  if not public.can_manage_trainings(v_club) then
    raise exception 'Nemate dozvolu za izmenu';
  end if;

  update public.trainings
    set scheduled_at = coalesce(p_scheduled_at, scheduled_at),
        topic        = coalesce(nullif(trim(p_topic), ''), topic),
        venue        = nullif(trim(p_venue), ''),
        note         = nullif(trim(p_note), ''),
        updated_at   = now()
  where id = p_training_id;
end;
$$;
grant execute on function public.update_training(bigint, timestamptz, text, text, text) to authenticated;

create or replace function public.delete_training(p_training_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club bigint;
begin
  select club_id into v_club from public.trainings where id = p_training_id;
  if v_club is null then
    return;
  end if;
  if not public.can_manage_trainings(v_club) then
    raise exception 'Nemate dozvolu za brisanje';
  end if;

  delete from public.trainings where id = p_training_id;
end;
$$;
grant execute on function public.delete_training(bigint) to authenticated;

-- 9) RPC: batch update prisustva za trening
create or replace function public.set_training_attendance(
  p_training_id bigint,
  p_entries     jsonb   -- [{ "player_id": "<uuid>", "present": true }, ...]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_uid  uuid := auth.uid();
begin
  select club_id into v_club from public.trainings where id = p_training_id;
  if v_club is null then
    raise exception 'Trening ne postoji';
  end if;
  if not public.can_manage_trainings(v_club) then
    raise exception 'Nemate dozvolu za belezenje prisustva';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Neispravan format unosa';
  end if;

  -- Upsert svakog reda
  insert into public.training_attendance (training_id, player_id, present, marked_at, marked_by)
  select
    p_training_id,
    (elem->>'player_id')::uuid,
    coalesce((elem->>'present')::boolean, false),
    now(),
    v_uid
  from jsonb_array_elements(p_entries) as elem
  where (elem->>'player_id') is not null
  on conflict (training_id, player_id) do update
     set present   = excluded.present,
         marked_at = now(),
         marked_by = v_uid;
end;
$$;
grant execute on function public.set_training_attendance(bigint, jsonb) to authenticated;

-- 10) RPC za igraca: lista treninga mog kluba + status prisustva
create or replace function public.get_my_trainings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_rows jsonb;
begin
  -- pronadji klub u kome je korisnik aktivan kao igrac
  select cm.club_id into v_club
  from public.club_memberships cm
  where cm.user_id = auth.uid()
    and cm.active = true
    and cm.member_role::text = 'igrac'
  order by cm.club_id
  limit 1;

  if v_club is null then
    return jsonb_build_object('club_id', null, 'trainings', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',           t.id,
      'scheduled_at', t.scheduled_at,
      'topic',        t.topic,
      'venue',        t.venue,
      'note',         t.note,
      'present',      coalesce(ta.present, false),
      'marked',       ta.player_id is not null
    )
    order by t.scheduled_at desc
  ), '[]'::jsonb)
  into v_rows
  from public.trainings t
  left join public.training_attendance ta
    on ta.training_id = t.id and ta.player_id = auth.uid()
  where t.club_id = v_club;

  return jsonb_build_object('club_id', v_club, 'trainings', coalesce(v_rows, '[]'::jsonb));
end;
$$;
grant execute on function public.get_my_trainings() to authenticated;

-- 11) Taktike RPC-ovi
create or replace function public.get_club_tactics(p_club_id bigint, p_kind text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.can_view_club_trainings(p_club_id) then
    raise exception 'Not allowed to view tactics';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',           p.id,
      'name',         p.name,
      'kind',         p.kind,
      'description',  p.description,
      'is_active',    p.is_active,
      'actions_count', coalesce(ac.cnt, 0),
      'updated_at',   p.updated_at
    )
    order by p.updated_at desc
  ), '[]'::jsonb)
  into v_rows
  from public.club_tactic_plans p
  left join lateral (
    select count(*)::int as cnt
    from public.tactic_actions a
    where a.tactic_id = p.id
  ) ac on true
  where p.club_id = p_club_id
    and (p_kind is null or p.kind::text = p_kind);

  return jsonb_build_object(
    'club_id',   p_club_id,
    'can_manage', public.can_manage_trainings(p_club_id),
    'tactics',   coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_club_tactics(bigint, text) to authenticated;

create or replace function public.get_tactic_detail(p_tactic_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_actions jsonb;
begin
  select p.id, p.club_id, p.name, p.kind, p.description, p.is_active, p.created_by, p.updated_at
    into v_plan
  from public.club_tactic_plans p
  where p.id = p_tactic_id;

  if not found then
    raise exception 'Taktika ne postoji';
  end if;

  if not public.can_view_club_trainings(v_plan.club_id) then
    raise exception 'Not allowed to view this tactic';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',          a.id,
      'name',        a.name,
      'description', a.description,
      'position',    a.position
    )
    order by a.position asc, a.id asc
  ), '[]'::jsonb)
  into v_actions
  from public.tactic_actions a
  where a.tactic_id = p_tactic_id;

  return jsonb_build_object(
    'tactic', jsonb_build_object(
      'id',          v_plan.id,
      'club_id',     v_plan.club_id,
      'name',        v_plan.name,
      'kind',        v_plan.kind,
      'description', v_plan.description,
      'is_active',   v_plan.is_active,
      'updated_at',  v_plan.updated_at
    ),
    'can_manage', public.can_manage_trainings(v_plan.club_id),
    'actions',    coalesce(v_actions, '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_tactic_detail(bigint) to authenticated;

create or replace function public.upsert_tactic(
  p_tactic_id   bigint,        -- null za create
  p_club_id     bigint,
  p_name        text,
  p_kind        text,          -- 'attack' | 'defense'
  p_description text,
  p_actions     jsonb          -- [{ "name":"...", "description":"...", "position":1 }, ...]
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := p_tactic_id;
  v_club bigint;
  v_kind public.tactic_kind;
begin
  if coalesce(trim(p_name),'') = '' then
    raise exception 'Ime taktike je obavezno';
  end if;
  if p_kind not in ('attack','defense') then
    raise exception 'Tip taktike mora biti attack ili defense';
  end if;
  v_kind := p_kind::public.tactic_kind;

  if v_id is null then
    if not public.can_manage_trainings(p_club_id) then
      raise exception 'Nemate dozvolu za ovaj klub';
    end if;
    insert into public.club_tactic_plans (club_id, created_by, name, kind, description)
    values (p_club_id, auth.uid(), trim(p_name), v_kind, nullif(trim(p_description), ''))
    returning id into v_id;
  else
    select club_id into v_club from public.club_tactic_plans where id = v_id;
    if v_club is null then
      raise exception 'Taktika ne postoji';
    end if;
    if not public.can_manage_trainings(v_club) then
      raise exception 'Nemate dozvolu za izmenu';
    end if;
    update public.club_tactic_plans
      set name        = trim(p_name),
          kind        = v_kind,
          description = nullif(trim(p_description), ''),
          updated_at  = now()
    where id = v_id;
  end if;

  -- Zamena akcija: obrisi i ponovo ubaci (atomicno unutar jedne funkcije)
  delete from public.tactic_actions where tactic_id = v_id;
  if p_actions is not null and jsonb_typeof(p_actions) = 'array' then
    insert into public.tactic_actions (tactic_id, name, description, position)
    select
      v_id,
      trim(elem->>'name'),
      nullif(trim(coalesce(elem->>'description','')), ''),
      coalesce((elem->>'position')::int, ord::int)
    from jsonb_array_elements(p_actions) with ordinality as e(elem, ord)
    where coalesce(trim(elem->>'name'),'') <> '';
  end if;

  return v_id;
end;
$$;
grant execute on function public.upsert_tactic(bigint, bigint, text, text, text, jsonb) to authenticated;

create or replace function public.delete_tactic(p_tactic_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club bigint;
begin
  select club_id into v_club from public.club_tactic_plans where id = p_tactic_id;
  if v_club is null then
    return;
  end if;
  if not public.can_manage_trainings(v_club) then
    raise exception 'Nemate dozvolu za brisanje';
  end if;
  delete from public.club_tactic_plans where id = p_tactic_id;
end;
$$;
grant execute on function public.delete_tactic(bigint) to authenticated;

-- 12) RPC za igraca: taktike mog kluba (sve aktivne), grupisano po tipu
create or replace function public.get_my_tactics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_rows jsonb;
begin
  select cm.club_id into v_club
  from public.club_memberships cm
  where cm.user_id = auth.uid()
    and cm.active = true
    and cm.member_role::text = 'igrac'
  order by cm.club_id
  limit 1;

  if v_club is null then
    return jsonb_build_object('club_id', null, 'tactics', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',          p.id,
      'name',        p.name,
      'kind',        p.kind,
      'description', p.description,
      'actions', (
        select coalesce(jsonb_agg(
          jsonb_build_object('id', a.id, 'name', a.name, 'description', a.description, 'position', a.position)
          order by a.position asc, a.id asc
        ), '[]'::jsonb)
        from public.tactic_actions a
        where a.tactic_id = p.id
      )
    )
    order by p.kind asc, p.updated_at desc
  ), '[]'::jsonb)
  into v_rows
  from public.club_tactic_plans p
  where p.club_id = v_club
    and p.is_active = true;

  return jsonb_build_object('club_id', v_club, 'tactics', coalesce(v_rows, '[]'::jsonb));
end;
$$;
grant execute on function public.get_my_tactics() to authenticated;

notify pgrst, 'reload schema';
