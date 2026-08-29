create function private.location_state_revision_resources(p_state jsonb)
returns table(resource_key text, resource_value jsonb)
language sql
immutable
set search_path = ''
as $$
  select
    'set:' || item.key,
    jsonb_build_object('value', item.value - 'updatedAt')
  from jsonb_each(p_state -> 'sets') as item

  union all

  select
    'bed:' || item.key,
    jsonb_build_object('value', item.value - 'updatedAt')
  from jsonb_each(p_state -> 'extraBeds') as item

  union all

  select
    'sunbed-sale:' || (item.value ->> 'id'),
    jsonb_build_object('value', item.value)
  from jsonb_array_elements(p_state -> 'sunbedSales') as item(value)

  union all

  select
    'aquapark-entry:' || (item.value ->> 'id'),
    jsonb_build_object('value', item.value)
  from jsonb_array_elements(p_state -> 'aquaparkEntries') as item(value)

  union all

  select
    'transaction:' || (item.value ->> 'id'),
    jsonb_build_object(
      'value',
      case
        when coalesce(item.value ->> 'status', 'active') = 'deleted'
          then item.value || jsonb_build_object('status', 'deleted')
        else (item.value - 'deletedAt') || jsonb_build_object('status', 'active')
      end
    )
  from jsonb_array_elements(p_state -> 'transactions') as item(value)

  union all

  select
    'unsupported:' || field_name,
    jsonb_build_object(
      'present', p_state ? field_name,
      'value', p_state -> field_name
    )
  from unnest(array[
    'beachReservations',
    'savedSurnames',
    'reportArchive',
    'lastAutomaticResetDate'
  ]) as unsupported(field_name)

  union all

  select
    'unknown-top-level:' || item.key,
    jsonb_build_object('value', item.value)
  from jsonb_each(p_state) as item
  where item.key <> all(array[
    'sets',
    'extraBeds',
    'beachReservations',
    'savedSurnames',
    'sunbedSales',
    'aquaparkEntries',
    'transactions',
    'reportArchive',
    'lastAutomaticResetDate'
  ]);
$$;

revoke all on function private.location_state_revision_resources(jsonb)
  from public, anon, authenticated;

comment on function private.location_state_revision_resources(jsonb) is
  'Internal semantic resource projection used to prove that a short revision chain contains no hidden intermediate business state.';

create function private.location_state_revision_snapshot_is_well_formed(p_state jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((
    jsonb_typeof(p_state) = 'object'
    and jsonb_typeof(p_state -> 'sets') = 'object'
    and jsonb_typeof(p_state -> 'extraBeds') = 'object'
    and jsonb_typeof(p_state -> 'sunbedSales') = 'array'
    and jsonb_typeof(p_state -> 'aquaparkEntries') = 'array'
    and jsonb_typeof(p_state -> 'transactions') = 'array'
    and not exists (
      select 1
      from (
        select item.value ->> 'id' as id
        from jsonb_array_elements(p_state -> 'sunbedSales') as item(value)
        union all
        select item.value ->> 'id'
        from jsonb_array_elements(p_state -> 'aquaparkEntries') as item(value)
        union all
        select item.value ->> 'id'
        from jsonb_array_elements(p_state -> 'transactions') as item(value)
      ) as identities
      where identities.id is null or btrim(identities.id) = ''
    )
    and (
      select count(*) = count(distinct item.value ->> 'id')
      from jsonb_array_elements(p_state -> 'sunbedSales') as item(value)
    )
    and (
      select count(*) = count(distinct item.value ->> 'id')
      from jsonb_array_elements(p_state -> 'aquaparkEntries') as item(value)
    )
    and (
      select count(*) = count(distinct item.value ->> 'id')
      from jsonb_array_elements(p_state -> 'transactions') as item(value)
    )
  ), false);
$$;

revoke all on function private.location_state_revision_snapshot_is_well_formed(jsonb)
  from public, anon, authenticated;

comment on function private.location_state_revision_snapshot_is_well_formed(jsonb) is
  'Rejects malformed or duplicate-identity history snapshots before revision-chain proof.';

create function public.verify_location_state_revision_chain(
  p_location_id uuid,
  p_base_revision bigint,
  p_current_revision bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  base_state jsonb;
  current_state jsonb;
  candidate_state jsonb;
  revision_count bigint;
begin
  if caller_id is null
    or p_base_revision < 0
    or p_current_revision <= p_base_revision
    or p_current_revision - p_base_revision > 10
  then
    return false;
  end if;

  if not exists (
    select 1
    from public.location_memberships as membership
    where membership.location_id = p_location_id
      and membership.user_id = caller_id
      and membership.active
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.location_state as state_row
    where state_row.location_id = p_location_id
      and state_row.revision = p_current_revision
  ) then
    return false;
  end if;

  select history.state
  into base_state
  from private.location_state_history as history
  where history.location_id = p_location_id
    and history.revision = p_base_revision;

  select history.state
  into current_state
  from private.location_state_history as history
  where history.location_id = p_location_id
    and history.revision = p_current_revision;

  select count(*)
  into revision_count
  from private.location_state_history as history
  where history.location_id = p_location_id
    and history.revision between p_base_revision and p_current_revision;

  if base_state is null
    or current_state is null
    or revision_count <> (p_current_revision - p_base_revision + 1)
    or not private.location_state_revision_snapshot_is_well_formed(base_state)
    or not private.location_state_revision_snapshot_is_well_formed(current_state)
  then
    return false;
  end if;

  for candidate_state in
    select history.state
    from private.location_state_history as history
    where history.location_id = p_location_id
      and history.revision between p_base_revision and p_current_revision
    order by history.revision
  loop
    if not private.location_state_revision_snapshot_is_well_formed(candidate_state) then
      return false;
    end if;

    if exists (
      with base_resources as (
        select * from private.location_state_revision_resources(base_state)
      ),
      current_resources as (
        select * from private.location_state_revision_resources(current_state)
      ),
      candidate_resources as (
        select * from private.location_state_revision_resources(candidate_state)
      ),
      resource_keys as (
        select resource_key from base_resources
        union
        select resource_key from current_resources
        union
        select resource_key from candidate_resources
      )
      select 1
      from resource_keys as resource
      left join base_resources as base
        on base.resource_key = resource.resource_key
      left join current_resources as current
        on current.resource_key = resource.resource_key
      left join candidate_resources as candidate
        on candidate.resource_key = resource.resource_key
      where not (
        candidate.resource_value is not distinct from base.resource_value
        or candidate.resource_value is not distinct from current.resource_value
      )
    ) then
      return false;
    end if;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.verify_location_state_revision_chain(uuid, bigint, bigint)
  from public, anon, authenticated;

grant execute on function public.verify_location_state_revision_chain(uuid, bigint, bigint)
  to authenticated;

comment on function public.verify_location_state_revision_chain(uuid, bigint, bigint) is
  'Returns only a boolean proof for a bounded, contiguous, active-member revision chain. It never exposes private historical AppData.';
