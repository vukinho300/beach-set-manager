-- Run with: npx supabase db query --linked --file supabase/verification/revision_invariant.sql
-- All temporary verification data is rolled back.
begin;

insert into public.location_state (location_id, state)
values (
  '00000000-0000-4000-8000-000000000001',
  '{"verification": 0}'::jsonb
);

do $$
declare
  accepted_revision bigint;
  stale_revision bigint;
  current_state jsonb;
begin
  update public.location_state
  set state = '{"verification": 1}'::jsonb
  where location_id = '00000000-0000-4000-8000-000000000001'
    and revision = 0
  returning revision into accepted_revision;

  if accepted_revision <> 1 then
    raise exception 'expected accepted revision 1, got %', accepted_revision;
  end if;

  update public.location_state
  set state = '{"verification": 2}'::jsonb
  where location_id = '00000000-0000-4000-8000-000000000001'
    and revision = 0
  returning revision into stale_revision;

  if stale_revision is not null then
    raise exception 'stale revision unexpectedly updated the row';
  end if;

  select state
  into current_state
  from public.location_state
  where location_id = '00000000-0000-4000-8000-000000000001';

  if current_state <> '{"verification": 1}'::jsonb then
    raise exception 'stale update changed state to %', current_state;
  end if;
end;
$$;

select 'revision invariant passed' as result;

rollback;
