create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint locations_name_not_blank check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

create table public.location_memberships (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null constraint location_memberships_role_valid
    check (role in ('PLATFORM_OWNER', 'LOCATION_ADMIN', 'WORKER')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (location_id, user_id)
);

create index location_memberships_user_id_idx
  on public.location_memberships (user_id);

create table public.location_state (
  location_id uuid primary key references public.locations(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 0
    constraint location_state_revision_non_negative check (revision >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index location_state_updated_by_idx
  on public.location_state (updated_by);

create function private.set_location_membership_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_location_membership_updated_at()
  from public, anon, authenticated;

create trigger set_location_membership_updated_at
before update on public.location_memberships
for each row execute function private.set_location_membership_updated_at();

create function private.enforce_location_state_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.location_id is distinct from old.location_id then
    raise exception 'location_id cannot be changed';
  end if;

  new.revision := old.revision + 1;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke all on function private.enforce_location_state_update()
  from public, anon, authenticated;

create trigger enforce_location_state_update
before update on public.location_state
for each row execute function private.enforce_location_state_update();

alter table public.locations enable row level security;
alter table public.location_memberships enable row level security;
alter table public.location_state enable row level security;

revoke all on table public.locations from anon, authenticated;
revoke all on table public.location_memberships from anon, authenticated;
revoke all on table public.location_state from anon, authenticated;

grant select on table public.locations to authenticated;
grant select on table public.location_memberships to authenticated;
grant select on table public.location_state to authenticated;
grant update (state) on table public.location_state to authenticated;

create policy locations_select_for_active_members
on public.locations
for select
to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.location_memberships as membership
    where membership.location_id = locations.id
      and membership.user_id = (select auth.uid())
      and membership.active
  )
);

create policy location_memberships_select_own
on public.location_memberships
for select
to authenticated
using (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
);

create policy location_state_select_for_active_members
on public.location_state
for select
to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.location_memberships as membership
    where membership.location_id = location_state.location_id
      and membership.user_id = (select auth.uid())
      and membership.active
  )
);

create policy location_state_update_for_active_members
on public.location_state
for update
to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.location_memberships as membership
    where membership.location_id = location_state.location_id
      and membership.user_id = (select auth.uid())
      and membership.active
  )
)
with check (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.location_memberships as membership
    where membership.location_id = location_state.location_id
      and membership.user_id = (select auth.uid())
      and membership.active
  )
);

comment on column public.location_state.revision is
  'Clients update state with a matching revision filter; accepted updates increment this exactly once.';

insert into public.locations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Petalon');
