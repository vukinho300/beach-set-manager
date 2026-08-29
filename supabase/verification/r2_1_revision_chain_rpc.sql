\set ON_ERROR_STOP on

begin;

create temporary table verification_results (
  check_name text primary key,
  passed boolean not null
) on commit drop;

grant select, insert on table verification_results to anon, authenticated;

create function pg_temp.make_valid_app_data()
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'sets', (
      select jsonb_object_agg(
        set_number::text,
        jsonb_build_object(
          'id', set_number,
          'beach', case when set_number <= 20 then 1 else 2 end,
          'status', 'free'
        )
      )
      from generate_series(1, 56) as set_number
    ),
    'extraBeds', (
      select jsonb_object_agg(
        bed_number::text,
        jsonb_build_object(
          'id', bed_number,
          'label', 'Bed ' || bed_number,
          'status', 'free'
        )
      )
      from generate_series(1, 4) as bed_number
    ),
    'beachReservations', '[]'::jsonb,
    'savedSurnames', '[]'::jsonb,
    'sunbedSales', '[]'::jsonb,
    'aquaparkEntries', '[]'::jsonb,
    'transactions', '[]'::jsonb,
    'reportArchive', '[]'::jsonb,
    'lastAutomaticResetDate', '2026-08-29'
  );
$$;

create function pg_temp.install_chain(
  p_location_id uuid,
  p_name text,
  p_states jsonb[],
  p_member_id uuid
)
returns void
language plpgsql
as $$
declare
  state_value jsonb;
  state_ordinality bigint;
  current_revision bigint := array_length(p_states, 1) - 1;
begin
  insert into public.locations (id, name) values (p_location_id, p_name);
  insert into public.location_state (location_id, state, revision)
  values (p_location_id, p_states[array_length(p_states, 1)], current_revision);

  for state_value, state_ordinality in
    select value, ordinality
    from unnest(p_states) with ordinality as revision(value, ordinality)
  loop
    insert into private.location_state_history (
      location_id,
      revision,
      state,
      updated_at
    ) values (
      p_location_id,
      state_ordinality - 1,
      state_value,
      '2026-08-29T12:30:00.000Z'::timestamptz + (state_ordinality * interval '1 second')
    );
  end loop;

  insert into public.location_memberships (location_id, user_id, role, active)
  values (p_location_id, p_member_id, 'WORKER', true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, created_at, updated_at)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

do $$
declare
  base_state jsonb := pg_temp.make_valid_app_data();
  intermediate_state jsonb;
  final_state jsonb;
  transaction_value jsonb := jsonb_build_object(
    'id', 'transaction-a',
    'type', 'beach_set',
    'amount', 12,
    'createdAt', '2026-08-29T12:30:00.000Z',
    'resourceId', '13',
    'resourceLabel', 'Set 13'
  );
  sunbed_value jsonb := jsonb_build_object(
    'id', 'sunbed-a',
    'quantity', 1,
    'totalAmount', 10,
    'createdAt', '2026-08-29T12:30:00.000Z'
  );
  aquapark_value jsonb := jsonb_build_object(
    'id', 'aquapark-a',
    'wristbands', jsonb_build_array(15, 48),
    'ticketType', '30min',
    'defaultUnitPrice', 12,
    'unitPrice', 12,
    'totalPrice', 24,
    'priceMode', 'default',
    'status', 'active',
    'startAt', '2026-08-29T12:30:00.000Z',
    'extraMinutes', 0,
    'createdAt', '2026-08-29T12:30:00.000Z',
    'returnedWristbands', '[]'::jsonb
  );
  member_id constant uuid := '10000000-0000-4000-8000-000000000001';
begin
  intermediate_state := jsonb_set(
    base_state,
    '{sets,53,updatedAt}',
    to_jsonb('2026-08-29T12:30:34.605Z'::text),
    true
  );
  final_state := jsonb_set(intermediate_state, '{sets,53,status}', '"left"'::jsonb, false);
  final_state := jsonb_set(
    final_state,
    '{sets,53,updatedAt}',
    to_jsonb('2026-08-29T12:30:40.404Z'::text),
    false
  );
  perform pg_temp.install_chain(
    '20000000-0000-4000-8000-000000000001',
    'Incident 3 monotonic fixture',
    array[base_state, intermediate_state, final_state],
    member_id
  );

  intermediate_state := jsonb_set(base_state, '{sets,53,status}', '"reserved"'::jsonb, false);
  final_state := jsonb_set(base_state, '{sets,53,status}', '"left"'::jsonb, false);
  perform pg_temp.install_chain(
    '20000000-0000-4000-8000-000000000002',
    'Hidden third value fixture',
    array[base_state, intermediate_state, final_state],
    member_id
  );

  intermediate_state := jsonb_set(base_state, '{sunbedSales}', jsonb_build_array(sunbed_value), false);
  final_state := jsonb_set(base_state, '{sets,53,status}', '"left"'::jsonb, false);
  perform pg_temp.install_chain(
    '20000000-0000-4000-8000-000000000003',
    'Resource add-remove fixture',
    array[base_state, intermediate_state, final_state],
    member_id
  );

  intermediate_state := jsonb_set(base_state, '{transactions}', jsonb_build_array(transaction_value), false);
  final_state := jsonb_set(base_state, '{sets,53,status}', '"left"'::jsonb, false);
  perform pg_temp.install_chain(
    '20000000-0000-4000-8000-000000000004',
    'Transaction add-remove fixture',
    array[base_state, intermediate_state, final_state],
    member_id
  );

  intermediate_state := jsonb_set(base_state, '{lastAutomaticResetDate}', '"2026-08-30"'::jsonb, false);
  final_state := jsonb_set(base_state, '{sets,53,status}', '"left"'::jsonb, false);
  perform pg_temp.install_chain(
    '20000000-0000-4000-8000-000000000005',
    'Reset-restore fixture',
    array[base_state, intermediate_state, final_state],
    member_id
  );

  intermediate_state := jsonb_set(base_state, '{sets,13,status}', '"left"'::jsonb, false);
  final_state := jsonb_set(intermediate_state, '{aquaparkEntries}', jsonb_build_array(aquapark_value), false);
  perform pg_temp.install_chain(
    '20000000-0000-4000-8000-000000000006',
    'Disjoint monotonic fixture',
    array[base_state, intermediate_state, final_state],
    member_id
  );

  insert into public.locations (id, name)
  values ('20000000-0000-4000-8000-000000000007', 'Missing revision fixture');
  insert into public.location_state (location_id, state, revision)
  values ('20000000-0000-4000-8000-000000000007', final_state, 2);
  insert into private.location_state_history (location_id, revision, state, updated_at)
  values
    ('20000000-0000-4000-8000-000000000007', 0, base_state, now()),
    ('20000000-0000-4000-8000-000000000007', 2, final_state, now());
  insert into public.location_memberships (location_id, user_id, role, active)
  values ('20000000-0000-4000-8000-000000000007', member_id, 'WORKER', true);

  insert into public.locations (id, name)
  values ('20000000-0000-4000-8000-000000000008', 'Gap limit fixture');
  insert into public.location_state (location_id, state, revision)
  values ('20000000-0000-4000-8000-000000000008', final_state, 11);
  insert into public.location_memberships (location_id, user_id, role, active)
  values ('20000000-0000-4000-8000-000000000008', member_id, 'WORKER', true);

  intermediate_state := jsonb_set(base_state, '{transactions}', jsonb_build_array(transaction_value), false);
  final_state := jsonb_set(
    intermediate_state,
    '{transactions,0,status}',
    '"active"'::jsonb,
    true
  );
  final_state := jsonb_set(final_state, '{sets,53,status}', '"left"'::jsonb, false);
  perform pg_temp.install_chain(
    '20000000-0000-4000-8000-000000000009',
    'Transaction normalization fixture',
    array[intermediate_state, final_state],
    member_id
  );
end;
$$;

insert into verification_results values
  (
    'functions_created',
    to_regprocedure('private.location_state_revision_resources(jsonb)') is not null
      and to_regprocedure('private.location_state_revision_snapshot_is_well_formed(jsonb)') is not null
      and to_regprocedure('public.verify_location_state_revision_chain(uuid,bigint,bigint)') is not null
  ),
  (
    'private_resource_helper_not_executable',
    not has_function_privilege('anon', 'private.location_state_revision_resources(jsonb)', 'execute')
      and not has_function_privilege(
        'authenticated',
        'private.location_state_revision_resources(jsonb)',
        'execute'
      )
  ),
  (
    'private_snapshot_helper_not_executable',
    not has_function_privilege(
      'anon',
      'private.location_state_revision_snapshot_is_well_formed(jsonb)',
      'execute'
    )
      and not has_function_privilege(
        'authenticated',
        'private.location_state_revision_snapshot_is_well_formed(jsonb)',
        'execute'
      )
  ),
  (
    'public_rpc_grants',
    has_function_privilege(
      'authenticated',
      'public.verify_location_state_revision_chain(uuid,bigint,bigint)',
      'execute'
    )
      and not has_function_privilege(
        'anon',
        'public.verify_location_state_revision_chain(uuid,bigint,bigint)',
        'execute'
      )
  ),
  (
    'public_rpc_returns_boolean_only',
    pg_get_function_result(
      'public.verify_location_state_revision_chain(uuid,bigint,bigint)'::regprocedure
    ) = 'boolean'
  ),
  (
    'private_history_select_privilege_blocked',
    not has_table_privilege('anon', 'private.location_state_history', 'select')
      and not has_table_privilege('authenticated', 'private.location_state_history', 'select')
  ),
  (
    'private_history_rls_enabled',
    (
      select relrowsecurity
      from pg_class
      where oid = 'private.location_state_history'::regclass
    )
  ),
  (
    'valid_app_data_contract',
    private.location_state_revision_snapshot_is_well_formed(pg_temp.make_valid_app_data())
  ),
  (
    'sets_and_beds_without_updated_at_valid',
    private.location_state_revision_snapshot_is_well_formed(pg_temp.make_valid_app_data())
  ),
  (
    'empty_set_and_bed_maps_rejected',
    not private.location_state_revision_snapshot_is_well_formed(
      jsonb_set(
        jsonb_set(pg_temp.make_valid_app_data(), '{sets}', '{}'::jsonb, false),
        '{extraBeds}',
        '{}'::jsonb,
        false
      )
    )
  ),
  (
    'unknown_top_level_rejected',
    not private.location_state_revision_snapshot_is_well_formed(
      pg_temp.make_valid_app_data() || jsonb_build_object('unknownField', true)
    )
  ),
  (
    'absent_sunbed_identity_rejected',
    not private.location_state_revision_snapshot_is_well_formed(
      jsonb_set(
        pg_temp.make_valid_app_data(),
        '{sunbedSales}',
        jsonb_build_array(jsonb_build_object(
          'quantity', 1,
          'totalAmount', 10,
          'createdAt', '2026-08-29T12:30:00.000Z'
        )),
        false
      )
    )
  ),
  (
    'duplicate_sunbed_identity_rejected',
    not private.location_state_revision_snapshot_is_well_formed(
      jsonb_set(
        pg_temp.make_valid_app_data(),
        '{sunbedSales}',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'duplicate-sunbed', 'quantity', 1, 'totalAmount', 10,
            'createdAt', '2026-08-29T12:30:00.000Z'
          ),
          jsonb_build_object(
            'id', 'duplicate-sunbed', 'quantity', 2, 'totalAmount', 20,
            'createdAt', '2026-08-29T12:31:00.000Z'
          )
        ),
        false
      )
    )
  ),
  (
    'duplicate_aquapark_identity_rejected',
    not private.location_state_revision_snapshot_is_well_formed(
      jsonb_set(
        pg_temp.make_valid_app_data(),
        '{aquaparkEntries}',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'duplicate-aquapark', 'wristbands', jsonb_build_array(15),
            'ticketType', '30min', 'defaultUnitPrice', 12, 'unitPrice', 12,
            'totalPrice', 12, 'priceMode', 'default', 'status', 'active',
            'startAt', '2026-08-29T12:30:00.000Z', 'extraMinutes', 0,
            'createdAt', '2026-08-29T12:30:00.000Z',
            'returnedWristbands', '[]'::jsonb
          ),
          jsonb_build_object(
            'id', 'duplicate-aquapark', 'wristbands', jsonb_build_array(16),
            'ticketType', '30min', 'defaultUnitPrice', 12, 'unitPrice', 12,
            'totalPrice', 12, 'priceMode', 'default', 'status', 'active',
            'startAt', '2026-08-29T12:31:00.000Z', 'extraMinutes', 0,
            'createdAt', '2026-08-29T12:31:00.000Z',
            'returnedWristbands', '[]'::jsonb
          )
        ),
        false
      )
    )
  ),
  (
    'duplicate_transaction_identity_rejected',
    not private.location_state_revision_snapshot_is_well_formed(
      jsonb_set(
        pg_temp.make_valid_app_data(),
        '{transactions}',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'duplicate', 'type', 'beach_set', 'amount', 12,
            'createdAt', '2026-08-29T12:30:00.000Z'
          ),
          jsonb_build_object(
            'id', 'duplicate', 'type', 'beach_set', 'amount', 12,
            'createdAt', '2026-08-29T12:30:00.000Z'
          )
        ),
        false
      )
    )
  ),
  (
    'active_transaction_deleted_at_rejected',
    not private.location_state_revision_snapshot_is_well_formed(
      jsonb_set(
        pg_temp.make_valid_app_data(),
        '{transactions}',
        jsonb_build_array(jsonb_build_object(
          'id', 'invalid-active', 'type', 'beach_set', 'amount', 12,
          'createdAt', '2026-08-29T12:30:00.000Z', 'status', 'active',
          'deletedAt', '2026-08-29T12:31:00.000Z'
        )),
        false
      )
    )
  ),
  (
    'deleted_transaction_requires_deleted_at',
    not private.location_state_revision_snapshot_is_well_formed(
      jsonb_set(
        pg_temp.make_valid_app_data(),
        '{transactions}',
        jsonb_build_array(jsonb_build_object(
          'id', 'invalid-deleted', 'type', 'beach_set', 'amount', 12,
          'createdAt', '2026-08-29T12:30:00.000Z', 'status', 'deleted'
        )),
        false
      )
    )
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

insert into verification_results values
  (
    'active_member_valid_chain',
    public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000001', 0, 2
    )
  ),
  (
    'incident_3_updated_at_chain',
    public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000001', 0, 2
    )
  ),
  (
    'hidden_intermediate_third_value',
    not public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000002', 0, 2
    )
  ),
  (
    'resource_add_then_remove',
    not public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000003', 0, 2
    )
  ),
  (
    'transaction_add_then_remove',
    not public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000004', 0, 2
    )
  ),
  (
    'reset_then_restore',
    not public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000005', 0, 2
    )
  ),
  (
    'disjoint_monotonic_resources',
    public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000006', 0, 2
    )
  ),
  (
    'missing_non_contiguous_history',
    not public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000007', 0, 2
    )
  ),
  (
    'gap_greater_than_ten',
    not public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000008', 0, 11
    )
  ),
  (
    'transaction_status_normalization',
    public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000009', 0, 1
    )
  ),
  (
    'current_revision_must_match_authoritative',
    not public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000001', 0, 1
    )
  );

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
insert into verification_results values (
  'non_member_cannot_obtain_positive_proof',
  not public.verify_location_state_revision_chain(
    '20000000-0000-4000-8000-000000000001', 0, 2
  )
);

do $$
begin
  begin
    perform private.location_state_revision_resources(pg_temp.make_valid_app_data());
    insert into verification_results values ('authenticated_private_helper_actual_access', false);
  exception when insufficient_privilege then
    insert into verification_results values ('authenticated_private_helper_actual_access', true);
  end;

  begin
    perform private.location_state_revision_snapshot_is_well_formed(pg_temp.make_valid_app_data());
    insert into verification_results values ('authenticated_private_validator_actual_access', false);
  exception when insufficient_privilege then
    insert into verification_results values ('authenticated_private_validator_actual_access', true);
  end;

  begin
    perform 1 from private.location_state_history limit 1;
    insert into verification_results values ('authenticated_private_history_actual_access', false);
  exception when insufficient_privilege then
    insert into verification_results values ('authenticated_private_history_actual_access', true);
  end;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  begin
    perform public.verify_location_state_revision_chain(
      '20000000-0000-4000-8000-000000000001', 0, 2
    );
    insert into verification_results values ('anonymous_rpc_actual_access', false);
  exception when insufficient_privilege then
    insert into verification_results values ('anonymous_rpc_actual_access', true);
  end;
end;
$$;

reset role;

do $$
declare
  failed_checks text;
begin
  select string_agg(check_name, ', ' order by check_name)
  into failed_checks
  from verification_results
  where not passed;

  if failed_checks is not null then
    raise exception 'R2.1 revision-chain verification failed: %', failed_checks;
  end if;
end;
$$;

select check_name, passed
from verification_results
order by check_name;

rollback;
