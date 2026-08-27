-- Read-only trusted verification after reviewed migrations and provisioning.

select id, name, slug, interface_profile
from public.locations
where id in (
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000002'::uuid
)
order by id;

select location_id, user_id, role, active
from public.location_memberships
where location_id in (
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000002'::uuid
)
order by location_id, role, user_id;

select
  location_id,
  revision,
  jsonb_array_length(state -> 'aquaparkEntries') as aquapark_entries,
  jsonb_array_length(state -> 'transactions') as transactions,
  jsonb_array_length(state -> 'reportArchive') as archived_reports,
  state -> 'sets' = '{}'::jsonb as sets_empty,
  state -> 'extraBeds' = '{}'::jsonb as beds_empty
from public.location_state
where location_id = '00000000-0000-4000-8000-000000000002'::uuid;

select username, user_id, active
from private.login_aliases
where username = 'koversada-radnik';
