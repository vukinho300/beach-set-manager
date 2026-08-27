-- Read-only RLS verification. Run only after the reviewed Step 10 migrations
-- and provisioning artifact have been applied to Beach Set Manager.
-- Each transaction impersonates one browser role; no operational rows are changed.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '1723bcb9-6013-4aa7-821a-745859b3af87', true);
select 'Vito' as actor,
  count(*) filter (where id = '00000000-0000-4000-8000-000000000001'::uuid) as petalon_locations,
  count(*) filter (where id = '00000000-0000-4000-8000-000000000002'::uuid) as koversada_locations
from public.locations;
select 'Vito' as actor,
  count(*) filter (where location_id = '00000000-0000-4000-8000-000000000001'::uuid) as petalon_state,
  count(*) filter (where location_id = '00000000-0000-4000-8000-000000000002'::uuid) as koversada_state
from public.location_state;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'df1ec88a-70c6-47cc-8b59-1683ffeb5dbb', true);
select 'Koversada Worker' as actor,
  count(*) filter (where id = '00000000-0000-4000-8000-000000000001'::uuid) as petalon_locations,
  count(*) filter (where id = '00000000-0000-4000-8000-000000000002'::uuid) as koversada_locations
from public.locations;
select 'Koversada Worker' as actor,
  count(*) filter (where location_id = '00000000-0000-4000-8000-000000000001'::uuid) as petalon_state,
  count(*) filter (where location_id = '00000000-0000-4000-8000-000000000002'::uuid) as koversada_state
from public.location_state;
select 'Koversada Worker Real Revenue' as check_name, count(*) as visible_rows
from public.location_daily_real_revenue;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e839a9e4-f86b-47d5-adaa-83779c4cd50f', true);
select 'Mark' as actor, count(*) as visible_locations from public.locations;
select 'Mark' as actor, count(*) as visible_states from public.location_state;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5771919-8ee9-49d5-b7f5-8e634ee1dcbf', true);
select 'Vuk' as actor, count(*) as visible_locations from public.locations;
select 'Vuk' as actor, count(*) as visible_states from public.location_state;
rollback;

select 'Anon' as actor,
  has_table_privilege('anon', 'public.locations', 'SELECT') as can_read_locations,
  has_table_privilege('anon', 'public.location_state', 'SELECT') as can_read_state;

-- Expected counts after provisioning:
-- Vito:              Petalon 1, Koversada 0 (locations and state)
-- Koversada Worker:  Petalon 0, Koversada 1 (locations and state), Real Revenue 0
-- Mark:              2 locations, 2 state rows
-- Vuk:               2 locations, 2 state rows
-- Anon:              SELECT privilege false for both tables
