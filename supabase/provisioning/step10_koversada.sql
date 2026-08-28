-- Trusted, repeatable Step 10 provisioning artifact.
-- Run only after the two Step 10 schema migrations have been reviewed/applied
-- to Beach Set Manager (uonovdnxfjqfjkhopxwg). Never run against KNO.
-- Contains no passwords, access tokens, API keys, or email addresses.

do $$
declare
  petalon_id constant uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  koversada_id constant uuid := '00000000-0000-4000-8000-000000000002'::uuid;
  vuk_id constant uuid := 'b5771919-8ee9-49d5-b7f5-8e634ee1dcbf'::uuid;
  mark_id constant uuid := 'e839a9e4-f86b-47d5-adaa-83779c4cd50f'::uuid;
  vito_id constant uuid := '1723bcb9-6013-4aa7-821a-745859b3af87'::uuid;
  koversada_worker_id constant uuid := 'df1ec88a-70c6-47cc-8b59-1683ffeb5dbb'::uuid;
begin
  if not exists (
    select 1 from public.locations
    where id = petalon_id
      and slug = 'petalon'
      and interface_profile = 'PETALON_FULL'
  ) then
    raise exception 'Petalon identity/profile does not match the Step 10 prerequisite.';
  end if;

  if not exists (
    select 1 from public.locations
    where id = koversada_id
      and name = 'Koversada'
      and slug = 'koversada'
      and interface_profile = 'KOVERSADA_AQUAPARK'
  ) then
    raise exception 'Koversada identity/profile has not been created by the reviewed migration.';
  end if;

  if not exists (
    select 1 from public.location_state
    where location_id = koversada_id
      and revision = 0
      and state -> 'sets' = '{}'::jsonb
      and state -> 'extraBeds' = '{}'::jsonb
      and state -> 'beachReservations' = '[]'::jsonb
      and state -> 'savedSurnames' = '[]'::jsonb
      and state -> 'sunbedSales' = '[]'::jsonb
      and state -> 'aquaparkEntries' = '[]'::jsonb
      and state -> 'transactions' = '[]'::jsonb
      and state -> 'reportArchive' = '[]'::jsonb
  ) then
    raise exception 'Koversada is not in the expected clean revision-0 state.';
  end if;

  if exists (
    select 1
    from public.location_memberships
    where user_id = koversada_worker_id
      and location_id <> koversada_id
  ) then
    raise exception 'Koversada worker unexpectedly has another location membership.';
  end if;

  if exists (
    select 1
    from public.location_memberships
    where user_id = vito_id
      and location_id = koversada_id
  ) then
    raise exception 'Vito unexpectedly has Koversada membership.';
  end if;

  if (
    select count(*)
    from auth.users
    where id in (vuk_id, mark_id, vito_id, koversada_worker_id)
  ) <> 4 then
    raise exception 'One or more verified Auth identities are missing.';
  end if;

  insert into public.location_memberships (location_id, user_id, role, active)
  values
    (koversada_id, vuk_id, 'PLATFORM_OWNER', true),
    (koversada_id, mark_id, 'LOCATION_ADMIN', true),
    (koversada_id, koversada_worker_id, 'WORKER', true)
  on conflict (location_id, user_id)
  do update set
    role = excluded.role,
    active = excluded.active,
    updated_at = clock_timestamp();

  if exists (
    select 1
    from private.login_aliases
    where username = 'koversada-radnik'
      and user_id <> koversada_worker_id
  ) then
    raise exception 'The koversada-radnik alias belongs to an unexpected Auth user.';
  end if;

  insert into private.login_aliases (username, user_id, active)
  values ('koversada-radnik', koversada_worker_id, true)
  on conflict (username)
  do update set active = true;

  if (
    select count(*)
    from public.location_memberships
    where location_id = koversada_id
  ) <> 3 then
    raise exception 'Koversada has unexpected membership rows.';
  end if;
end;
$$;
