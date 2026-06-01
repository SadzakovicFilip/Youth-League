-- Prikazni status utakmice:
-- ZAKAZANA | ISČEKIVANJE | NEMA USLOVA | NEODIGRANA | UŽIVO | ZAVRŠENA
--
-- Redosled pokretanja: docs/sql-patches/README-match-display-status.md

create or replace function public.match_start_ready(p_match_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((c->>'cond_rosters')::boolean, false)
    and coalesce((c->>'cond_sudije')::boolean, false)
    and coalesce((c->>'cond_zapisnicar')::boolean, false)
  from (select public.get_match_conditions(p_match_id) as c) x;
$$;

create or replace function public.resolve_match_display_status(
  p_status text,
  p_scheduled_at timestamptz,
  p_start_ready boolean
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_status, 'scheduled') = 'finished' then 'ZAVRŠENA'
    when coalesce(p_status, 'scheduled') = 'live' then 'UŽIVO'
    when p_scheduled_at > now() then 'ZAKAZANA'
    when (p_scheduled_at at time zone 'Europe/Belgrade')::date
       < (now() at time zone 'Europe/Belgrade')::date then 'NEODIGRANA'
    when p_start_ready then 'ISČEKIVANJE'
    else 'NEMA USLOVA'
  end;
$$;

create or replace function public.match_display_status(p_match_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.resolve_match_display_status(
    coalesce(m.status::text, 'scheduled'),
    m.scheduled_at,
    public.match_start_ready(m.id)
  )
  from public.matches m
  where m.id = p_match_id;
$$;

grant execute on function public.match_start_ready(bigint) to authenticated;
grant execute on function public.resolve_match_display_status(text, timestamptz, boolean) to authenticated;
grant execute on function public.match_display_status(bigint) to authenticated;

notify pgrst, 'reload schema';
