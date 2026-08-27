create table private.location_state_history (
  location_id uuid not null references public.locations(id) on delete cascade,
  revision bigint not null
    constraint location_state_history_revision_non_negative check (revision >= 0),
  state jsonb not null,
  updated_at timestamptz not null,
  updated_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (location_id, revision)
);

alter table private.location_state_history enable row level security;

revoke all on table private.location_state_history from public, anon, authenticated;

comment on table private.location_state_history is
  'Private immutable support archive of accepted location_state revisions. Not exposed to browser roles.';

insert into private.location_state_history (
  location_id,
  revision,
  state,
  updated_at,
  updated_by
)
select
  location_id,
  revision,
  state,
  updated_at,
  updated_by
from public.location_state
on conflict (location_id, revision) do nothing;

create function private.archive_location_state_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.location_state_history (
    location_id,
    revision,
    state,
    updated_at,
    updated_by
  )
  values (
    new.location_id,
    new.revision,
    new.state,
    new.updated_at,
    new.updated_by
  );

  return new;
end;
$$;

revoke all on function private.archive_location_state_revision()
  from public, anon, authenticated;

create trigger archive_location_state_revision
after update on public.location_state
for each row execute function private.archive_location_state_revision();
