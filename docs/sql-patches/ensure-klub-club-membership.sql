-- =========================================================================
-- Patch: savez_ensure_klub_club_membership
-- =========================================================================
-- Pokrenuti JEDNOM u Supabase SQL Editor (ili kao migraciju).
--
-- Razlog: posle kreiranja klub naloga preko Edge funkcije `create-managed-user`,
-- u nekim slučajevima izostane upis u `public.club_memberships` za rolu 'klub',
-- pa korisnik pri loginu vidi "Nije pronadjen klub za trenutno ulogovanog korisnika.".
--
-- Ova RPC:
--   * Zahteva da je pozivalac u roli 'savez' ili 'admin' (preko public.has_role).
--   * Pronalazi user_id (po p_user_id ili po p_username iz public.profiles).
--   * Idempotentno upisuje / aktivira red:
--       INSERT (club_id, user_id, member_role='klub', active=true)
--       ON CONFLICT -> UPDATE active=true, member_role='klub'.
--
-- Klijent je već ažuriran da je poziva odmah posle Edge funkcije, kao mreža
-- bezbednosti (videti app/(roles)/savez/(takmicenje)/liga/[id]/index.tsx).

create or replace function public.savez_ensure_klub_club_membership(
  p_club_id bigint,
  p_user_id uuid default null,
  p_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := p_user_id;
begin
  if not (public.has_role('savez') or public.has_role('admin')) then
    raise exception 'Nedozvoljeno: samo savez/admin.';
  end if;

  if v_uid is null and p_username is not null and length(trim(p_username)) > 0 then
    select p.id into v_uid
    from public.profiles p
    where lower(trim(p.username)) = lower(trim(p_username))
    limit 1;
  end if;

  if v_uid is null then
    raise exception 'Korisnik nije pronađen (p_user_id ili p_username).';
  end if;

  if not exists (select 1 from public.clubs c where c.id = p_club_id) then
    raise exception 'Klub ne postoji (id=%).', p_club_id;
  end if;

  if exists (
    select 1 from public.club_memberships cm
    where cm.club_id = p_club_id and cm.user_id = v_uid
  ) then
    update public.club_memberships cm
    set
      member_role = 'klub',
      active = true
    where cm.club_id = p_club_id and cm.user_id = v_uid;
  else
    insert into public.club_memberships (club_id, user_id, member_role, active)
    values (p_club_id, v_uid, 'klub', true);
  end if;

  return jsonb_build_object('ok', true, 'club_id', p_club_id, 'user_id', v_uid);
end;
$$;

grant execute on function public.savez_ensure_klub_club_membership(bigint, uuid, text) to authenticated;

comment on function public.savez_ensure_klub_club_membership is
  'Posle kreiranja klub naloga: idempotentan upis/aktivacija reda u club_memberships sa member_role=klub. Poziva savez/admin.';
