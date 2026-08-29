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
language plpgsql
stable
set search_path = ''
as $$
declare
  item jsonb;
begin
  if jsonb_typeof(p_state) <> 'object'
    or not p_state ?& array[
      'sets',
      'extraBeds',
      'beachReservations',
      'savedSurnames',
      'sunbedSales',
      'aquaparkEntries',
      'transactions',
      'reportArchive'
    ]
    or exists (
      select 1
      from jsonb_object_keys(p_state) as field(name)
      where field.name <> all(array[
        'sets',
        'extraBeds',
        'beachReservations',
        'savedSurnames',
        'sunbedSales',
        'aquaparkEntries',
        'transactions',
        'reportArchive',
        'lastAutomaticResetDate'
      ])
    )
    or jsonb_typeof(p_state -> 'sets') <> 'object'
    or (select count(*) from jsonb_object_keys(p_state -> 'sets')) <> 56
    or jsonb_typeof(p_state -> 'extraBeds') <> 'object'
    or (select count(*) from jsonb_object_keys(p_state -> 'extraBeds')) <> 4
    or jsonb_typeof(p_state -> 'beachReservations') <> 'array'
    or jsonb_typeof(p_state -> 'savedSurnames') <> 'array'
    or jsonb_typeof(p_state -> 'sunbedSales') <> 'array'
    or jsonb_typeof(p_state -> 'aquaparkEntries') <> 'array'
    or jsonb_typeof(p_state -> 'transactions') <> 'array'
    or jsonb_typeof(p_state -> 'reportArchive') <> 'array'
    or (
      p_state ? 'lastAutomaticResetDate'
      and jsonb_typeof(p_state -> 'lastAutomaticResetDate') <> 'string'
    )
  then
    return false;
  end if;

  for expected_id in 1..56 loop
    item := p_state -> 'sets' -> expected_id::text;
    if item is null
      or jsonb_typeof(item) <> 'object'
      or not item ?& array['id', 'beach', 'status']
      or exists (
        select 1
        from jsonb_object_keys(item) as field(name)
        where field.name <> all(array[
          'id', 'beach', 'status', 'beachReservationId', 'surname',
          'reservedDays', 'price', 'priceMode', 'dailySaleId', 'updatedAt'
        ])
      )
      or jsonb_typeof(item -> 'id') <> 'number'
      or (item ->> 'id')::numeric <> expected_id
      or jsonb_typeof(item -> 'beach') <> 'number'
      or (item ->> 'beach')::numeric <> (case when expected_id <= 20 then 1 else 2 end)
      or jsonb_typeof(item -> 'status') <> 'string'
      or item ->> 'status' <> all(array['free', 'paid', 'reserved', 'left'])
      or (item ? 'beachReservationId' and jsonb_typeof(item -> 'beachReservationId') <> 'string')
      or (item ? 'surname' and jsonb_typeof(item -> 'surname') <> 'string')
      or (item ? 'reservedDays' and (
        jsonb_typeof(item -> 'reservedDays') <> 'number' or (item ->> 'reservedDays')::numeric <= 0
      ))
      or (item ? 'price' and (
        jsonb_typeof(item -> 'price') <> 'number' or (item ->> 'price')::numeric <= 0
      ))
      or (item ? 'priceMode' and (
        jsonb_typeof(item -> 'priceMode') <> 'string'
        or item ->> 'priceMode' <> all(array['fixed', 'special'])
      ))
      or (item ? 'dailySaleId' and jsonb_typeof(item -> 'dailySaleId') <> 'string')
      or (item ? 'updatedAt' and jsonb_typeof(item -> 'updatedAt') <> 'string')
    then
      return false;
    end if;
  end loop;

  for expected_id in 1..4 loop
    item := p_state -> 'extraBeds' -> expected_id::text;
    if item is null
      or jsonb_typeof(item) <> 'object'
      or not item ?& array['id', 'label', 'status']
      or exists (
        select 1
        from jsonb_object_keys(item) as field(name)
        where field.name <> all(array[
          'id', 'label', 'status', 'beachReservationId', 'surname',
          'reservedDays', 'price', 'priceMode', 'dailySaleId', 'updatedAt'
        ])
      )
      or jsonb_typeof(item -> 'id') <> 'number'
      or (item ->> 'id')::numeric <> expected_id
      or jsonb_typeof(item -> 'label') <> 'string'
      or item ->> 'label' <> 'Bed ' || expected_id
      or jsonb_typeof(item -> 'status') <> 'string'
      or item ->> 'status' <> all(array['free', 'paid', 'reserved'])
      or (item ? 'beachReservationId' and jsonb_typeof(item -> 'beachReservationId') <> 'string')
      or (item ? 'surname' and jsonb_typeof(item -> 'surname') <> 'string')
      or (item ? 'reservedDays' and (
        jsonb_typeof(item -> 'reservedDays') <> 'number' or (item ->> 'reservedDays')::numeric <= 0
      ))
      or (item ? 'price' and (
        jsonb_typeof(item -> 'price') <> 'number' or (item ->> 'price')::numeric <= 0
      ))
      or (item ? 'priceMode' and (
        jsonb_typeof(item -> 'priceMode') <> 'string'
        or item ->> 'priceMode' <> all(array['fixed', 'special'])
      ))
      or (item ? 'dailySaleId' and jsonb_typeof(item -> 'dailySaleId') <> 'string')
      or (item ? 'updatedAt' and jsonb_typeof(item -> 'updatedAt') <> 'string')
    then
      return false;
    end if;
  end loop;

  if (
    select count(*) <> count(distinct value ->> 'id')
    from jsonb_array_elements(p_state -> 'beachReservations')
  ) then
    return false;
  end if;
  for item in select value from jsonb_array_elements(p_state -> 'beachReservations') loop
    if jsonb_typeof(item) <> 'object'
      or not item ?& array['id', 'surname', 'startDate', 'endDate', 'createdAt']
      or exists (
        select 1
        from jsonb_object_keys(item) as field(name)
        where field.name <> all(array[
          'id', 'surname', 'startDate', 'endDate', 'totalAmountPaid',
          'paymentRecordedAt', 'reservedDays', 'notes', 'createdAt', 'updatedAt'
        ])
      )
      or jsonb_typeof(item -> 'id') <> 'string' or btrim(item ->> 'id') = ''
      or jsonb_typeof(item -> 'surname') <> 'string' or btrim(item ->> 'surname') = ''
      or jsonb_typeof(item -> 'startDate') <> 'string' or btrim(item ->> 'startDate') = ''
      or jsonb_typeof(item -> 'endDate') <> 'string' or btrim(item ->> 'endDate') = ''
      or jsonb_typeof(item -> 'createdAt') <> 'string' or btrim(item ->> 'createdAt') = ''
      or (item ? 'totalAmountPaid' and (
        jsonb_typeof(item -> 'totalAmountPaid') <> 'number'
        or (item ->> 'totalAmountPaid')::numeric <= 0
      ))
      or (item ? 'paymentRecordedAt' and jsonb_typeof(item -> 'paymentRecordedAt') <> 'string')
      or (item ? 'reservedDays' and (
        jsonb_typeof(item -> 'reservedDays') <> 'number' or (item ->> 'reservedDays')::numeric <= 0
      ))
      or (item ? 'notes' and jsonb_typeof(item -> 'notes') <> 'string')
      or (item ? 'updatedAt' and jsonb_typeof(item -> 'updatedAt') <> 'string')
    then
      return false;
    end if;
  end loop;

  if (
    select count(*) <> count(distinct value #>> '{}')
    from jsonb_array_elements(p_state -> 'savedSurnames')
  ) then
    return false;
  end if;
  for item in select value from jsonb_array_elements(p_state -> 'savedSurnames') loop
    if jsonb_typeof(item) <> 'string' or btrim(item #>> '{}') = '' then
      return false;
    end if;
  end loop;

  if (
    select count(*) <> count(distinct value ->> 'id')
    from jsonb_array_elements(p_state -> 'sunbedSales')
  ) then
    return false;
  end if;
  for item in select value from jsonb_array_elements(p_state -> 'sunbedSales') loop
    if jsonb_typeof(item) <> 'object'
      or not item ?& array['id', 'quantity', 'totalAmount', 'createdAt']
      or exists (
        select 1
        from jsonb_object_keys(item) as field(name)
        where field.name <> all(array['id', 'quantity', 'totalAmount', 'description', 'createdAt'])
      )
      or jsonb_typeof(item -> 'id') <> 'string' or btrim(item ->> 'id') = ''
      or jsonb_typeof(item -> 'quantity') <> 'number'
      or (item ->> 'quantity')::numeric <= 0
      or mod((item ->> 'quantity')::numeric, 1) <> 0
      or (item ->> 'quantity')::numeric > 9007199254740991
      or jsonb_typeof(item -> 'totalAmount') <> 'number'
      or (item ->> 'totalAmount')::numeric <= 0
      or jsonb_typeof(item -> 'createdAt') <> 'string' or btrim(item ->> 'createdAt') = ''
      or (item ? 'description' and jsonb_typeof(item -> 'description') <> 'string')
    then
      return false;
    end if;
  end loop;

  if (
    select count(*) <> count(distinct value ->> 'id')
    from jsonb_array_elements(p_state -> 'aquaparkEntries')
  ) then
    return false;
  end if;
  for item in select value from jsonb_array_elements(p_state -> 'aquaparkEntries') loop
    if jsonb_typeof(item) <> 'object'
      or not item ?& array[
        'id', 'wristbands', 'ticketType', 'defaultUnitPrice', 'unitPrice',
        'totalPrice', 'priceMode', 'status', 'startAt', 'extraMinutes',
        'createdAt', 'returnedWristbands'
      ]
      or exists (
        select 1
        from jsonb_object_keys(item) as field(name)
        where field.name <> all(array[
          'id', 'wristbands', 'ticketType', 'defaultUnitPrice', 'unitPrice',
          'totalPrice', 'priceMode', 'status', 'isLegacyPrice', 'startAt',
          'endAt', 'extraMinutes', 'validUntil', 'customDays', 'dailyUnitPrice',
          'description', 'createdAt', 'closedAt', 'returnedWristbands'
        ])
      )
      or jsonb_typeof(item -> 'id') <> 'string' or btrim(item ->> 'id') = ''
      or jsonb_typeof(item -> 'wristbands') <> 'array'
      or jsonb_array_length(item -> 'wristbands') = 0
      or jsonb_typeof(item -> 'returnedWristbands') <> 'array'
      or jsonb_typeof(item -> 'ticketType') <> 'string'
      or item ->> 'ticketType' <> all(array['30min', '1hour', 'half_day', 'one_day', 'one_week', 'custom_days'])
      or jsonb_typeof(item -> 'defaultUnitPrice') <> 'number'
      or (item ->> 'defaultUnitPrice')::numeric <= 0
      or jsonb_typeof(item -> 'unitPrice') <> 'number' or (item ->> 'unitPrice')::numeric <= 0
      or jsonb_typeof(item -> 'totalPrice') <> 'number' or (item ->> 'totalPrice')::numeric <= 0
      or jsonb_typeof(item -> 'priceMode') <> 'string'
      or item ->> 'priceMode' <> all(array['default', 'special'])
      or jsonb_typeof(item -> 'status') <> 'string'
      or item ->> 'status' <> all(array['active', 'closed'])
      or (item ? 'isLegacyPrice' and jsonb_typeof(item -> 'isLegacyPrice') <> 'boolean')
      or jsonb_typeof(item -> 'startAt') <> 'string' or btrim(item ->> 'startAt') = ''
      or jsonb_typeof(item -> 'createdAt') <> 'string' or btrim(item ->> 'createdAt') = ''
      or jsonb_typeof(item -> 'extraMinutes') <> 'number'
      or (item ->> 'extraMinutes')::numeric < 0
      or mod((item ->> 'extraMinutes')::numeric, 1) <> 0
      or (item ->> 'extraMinutes')::numeric > 9007199254740991
      or (item ? 'customDays' and (
        jsonb_typeof(item -> 'customDays') <> 'number'
        or (item ->> 'customDays')::numeric <= 0
        or mod((item ->> 'customDays')::numeric, 1) <> 0
        or (item ->> 'customDays')::numeric > 9007199254740991
      ))
      or (item ? 'dailyUnitPrice' and (
        jsonb_typeof(item -> 'dailyUnitPrice') <> 'number'
        or (item ->> 'dailyUnitPrice')::numeric <= 0
      ))
      or (item ? 'endAt' and jsonb_typeof(item -> 'endAt') <> 'string')
      or (item ? 'validUntil' and jsonb_typeof(item -> 'validUntil') <> 'string')
      or (item ? 'description' and jsonb_typeof(item -> 'description') <> 'string')
      or (item ? 'closedAt' and jsonb_typeof(item -> 'closedAt') <> 'string')
      or exists (
        select 1
        from jsonb_array_elements(item -> 'wristbands') as wristband(value)
        where jsonb_typeof(wristband.value) <> 'number'
          or (wristband.value #>> '{}')::numeric <= 0
          or mod((wristband.value #>> '{}')::numeric, 1) <> 0
          or (wristband.value #>> '{}')::numeric > 9007199254740991
      )
      or (
        select count(*) <> count(distinct value)
        from jsonb_array_elements(item -> 'wristbands')
      )
      or exists (
        select 1
        from jsonb_array_elements(item -> 'returnedWristbands') as wristband(value)
        where jsonb_typeof(wristband.value) <> 'number'
          or (wristband.value #>> '{}')::numeric <= 0
          or mod((wristband.value #>> '{}')::numeric, 1) <> 0
          or (wristband.value #>> '{}')::numeric > 9007199254740991
          or not (item -> 'wristbands') @> jsonb_build_array(wristband.value)
      )
      or (
        select count(*) <> count(distinct value)
        from jsonb_array_elements(item -> 'returnedWristbands')
      )
    then
      return false;
    end if;
  end loop;

  if (
    select count(*) <> count(distinct value ->> 'id')
    from jsonb_array_elements(p_state -> 'transactions')
  ) then
    return false;
  end if;

  if (
    select count(*) <> count(distinct value ->> 'date')
    from jsonb_array_elements(p_state -> 'reportArchive')
  ) then
    return false;
  end if;
  for item in select value from jsonb_array_elements(p_state -> 'reportArchive') loop
    if jsonb_typeof(item) <> 'object'
      or not item ?& array['date', 'archivedAt', 'transactions']
      or exists (
        select 1
        from jsonb_object_keys(item) as field(name)
        where field.name <> all(array['date', 'archivedAt', 'transactions'])
      )
      or jsonb_typeof(item -> 'date') <> 'string' or btrim(item ->> 'date') = ''
      or jsonb_typeof(item -> 'archivedAt') <> 'string' or btrim(item ->> 'archivedAt') = ''
      or jsonb_typeof(item -> 'transactions') <> 'array'
      or (
        select count(*) <> count(distinct value ->> 'id')
        from jsonb_array_elements(item -> 'transactions')
      )
    then
      return false;
    end if;
  end loop;

  for item in
    select value from jsonb_array_elements(p_state -> 'transactions')
    union all
    select transaction.value
    from jsonb_array_elements(p_state -> 'reportArchive') as report(value)
    cross join lateral jsonb_array_elements(report.value -> 'transactions') as transaction(value)
  loop
    if jsonb_typeof(item) <> 'object'
      or not item ?& array['id', 'type', 'amount', 'createdAt']
      or exists (
        select 1
        from jsonb_object_keys(item) as field(name)
        where field.name <> all(array[
          'id', 'type', 'amount', 'createdAt', 'status', 'deletedAt',
          'resourceId', 'resourceLabel', 'description', 'metadata'
        ])
      )
      or jsonb_typeof(item -> 'id') <> 'string' or btrim(item ->> 'id') = ''
      or jsonb_typeof(item -> 'type') <> 'string'
      or item ->> 'type' <> all(array['beach_set', 'bed', 'sunbed', 'beach_reservation', 'aquapark'])
      or jsonb_typeof(item -> 'amount') <> 'number' or (item ->> 'amount')::numeric <= 0
      or jsonb_typeof(item -> 'createdAt') <> 'string' or btrim(item ->> 'createdAt') = ''
      or (item ? 'status' and (
        jsonb_typeof(item -> 'status') <> 'string'
        or item ->> 'status' <> all(array['active', 'deleted'])
      ))
      or (
        coalesce(item ->> 'status', 'active') = 'deleted'
        and (
          not item ? 'deletedAt'
          or jsonb_typeof(item -> 'deletedAt') <> 'string'
          or btrim(item ->> 'deletedAt') = ''
        )
      )
      or (
        coalesce(item ->> 'status', 'active') <> 'deleted'
        and item ? 'deletedAt'
      )
      or (item ? 'resourceId' and jsonb_typeof(item -> 'resourceId') <> 'string')
      or (item ? 'resourceLabel' and jsonb_typeof(item -> 'resourceLabel') <> 'string')
      or (item ? 'description' and jsonb_typeof(item -> 'description') <> 'string')
      or (item ? 'metadata' and jsonb_typeof(item -> 'metadata') <> 'object')
    then
      return false;
    end if;
  end loop;

  return true;
exception
  when others then
    return false;
end;
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
