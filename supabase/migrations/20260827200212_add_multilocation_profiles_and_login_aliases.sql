alter table public.locations
  add column slug text,
  add column interface_profile text;

update public.locations
set
  slug = 'petalon',
  interface_profile = 'PETALON_FULL'
where id = '00000000-0000-4000-8000-000000000001'::uuid;

alter table public.locations
  alter column slug set not null,
  alter column interface_profile set not null,
  add constraint locations_slug_format
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint locations_interface_profile_valid
    check (interface_profile in ('PETALON_FULL', 'KOVERSADA_AQUAPARK'));

create unique index locations_slug_key on public.locations (slug);

insert into public.locations (id, name, slug, interface_profile)
values (
  '00000000-0000-4000-8000-000000000002'::uuid,
  'Koversada',
  'koversada',
  'KOVERSADA_AQUAPARK'
);

insert into public.location_state (location_id, state, revision)
values (
  '00000000-0000-4000-8000-000000000002'::uuid,
  jsonb_build_object(
    'sets', '{}'::jsonb,
    'extraBeds', '{}'::jsonb,
    'beachReservations', '[]'::jsonb,
    'savedSurnames', '[]'::jsonb,
    'sunbedSales', '[]'::jsonb,
    'aquaparkEntries', '[]'::jsonb,
    'transactions', '[]'::jsonb,
    'reportArchive', '[]'::jsonb,
    'lastAutomaticResetDate',
      ((clock_timestamp() at time zone 'Europe/Zagreb')::date)::text
  ),
  0
);

create table private.login_aliases (
  username text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint login_aliases_username_normalized
    check (
      username = lower(username)
      and username ~ '^[a-z0-9][a-z0-9-]{2,31}$'
    )
);

alter table private.login_aliases enable row level security;

revoke all on table private.login_aliases from public, anon, authenticated;

create policy login_aliases_deny_browser_access
on private.login_aliases
for all
to anon, authenticated
using (false)
with check (false);

create function public.resolve_login_username(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_username text := lower(btrim(coalesce(p_username, '')));
  resolved_email text;
begin
  if normalized_username !~ '^[a-z0-9][a-z0-9-]{2,31}$' then
    return null;
  end if;

  select auth_user.email
  into resolved_email
  from private.login_aliases as login_alias
  join auth.users as auth_user on auth_user.id = login_alias.user_id
  where login_alias.username = normalized_username
    and login_alias.active
    and auth_user.email is not null;

  return resolved_email;
end;
$$;

revoke all on function public.resolve_login_username(text)
  from public, anon, authenticated;

grant execute on function public.resolve_login_username(text)
  to anon, authenticated;

comment on column public.locations.interface_profile is
  'Server-owned interface capability profile. It is never inferred from the signed-in person.';

comment on table private.login_aliases is
  'Non-public login aliases that resolve to Supabase Auth identities. Passwords and authorization do not live here.';

comment on function public.resolve_login_username(text) is
  'Resolves one normalized login alias to the non-personal Supabase Auth email needed for password sign-in.';

alter table private.client_sync_events
  drop constraint client_sync_events_error_category_valid;

alter table private.client_sync_events
  add constraint client_sync_events_error_category_valid
  check (error_category is null or error_category in (
    'controller_unavailable',
    'identity_mismatch',
    'location_mismatch',
    'deactivated',
    'paused',
    'not_ready',
    'safety_securing',
    'safety_blocked',
    'admission_timeout',
    'pending_load',
    'pending_save',
    'save_attempt_metadata',
    'durability_timeout',
    'durability_failed',
    'exception',
    'accepted',
    'conflict',
    'unavailable'
  ));
