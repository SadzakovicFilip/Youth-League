-- ============================================================
-- Supabase Realtime: ukljucivanje tabela u `supabase_realtime`
-- publication za `postgres_changes` (live box score + status).
-- Idempotentno: ne pada ako tabela vec postoji u publication-u.
-- ============================================================

-- 1) Garantuj da publication postoji (Supabase je kreira sam,
--    ali ovo je sigurno na novim projektima / lokalnim Postgres-ima).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end$$;

-- 2) Dodaj `match_events` u publication (ako jos nije)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_events'
  ) then
    alter publication supabase_realtime add table public.match_events;
  end if;
end$$;

-- 3) Dodaj `matches` u publication (ako jos nije)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end$$;

-- 4) REPLICA IDENTITY:
--    - `matches`: UPDATE mora slati OLD.home_score / away_score (UNDO animacija za spektatore).
--    - `match_events`: DELETE mora slati OLD.user_id / event_type / match_id.
alter table public.matches replica identity full;
alter table public.match_events replica identity full;

-- 5) Verifikacija
--    Pokreni odvojeno u SQL editor-u i proveri da li su obe tabele u listi:
-- select schemaname, tablename
-- from pg_publication_tables
-- where pubname = 'supabase_realtime'
--   and tablename in ('matches', 'match_events')
-- order by tablename;

notify pgrst, 'reload schema';
