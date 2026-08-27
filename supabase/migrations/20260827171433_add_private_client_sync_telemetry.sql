create table private.client_sync_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  boot_session_id uuid not null,
  app_build text not null
    constraint client_sync_events_app_build_safe
    check (app_build ~ '^[A-Za-z0-9._:-]{1,100}$'),
  mutation_sequence bigint
    constraint client_sync_events_mutation_sequence_non_negative
    check (mutation_sequence is null or mutation_sequence >= 0),
  event_code text not null
    constraint client_sync_events_event_code_valid
    check (event_code in (
      'MUTATION_VISIBLE',
      'BRIDGE_FORWARDED',
      'CONTROLLER_ACCEPTED',
      'CONTROLLER_REJECTED',
      'DURABILITY_START',
      'DURABILITY_CONFIRMED',
      'DURABILITY_FAILED',
      'DURABILITY_TIMEOUT',
      'REPOSITORY_SAVE_START',
      'REPOSITORY_SAVE_RESULT',
      'RETRY_SCHEDULED',
      'CONTROLLER_BLOCKED',
      'APP_BOOT',
      'VISIBILITY_RESUME'
    )),
  expected_revision bigint
    constraint client_sync_events_expected_revision_non_negative
    check (expected_revision is null or expected_revision >= 0),
  duration_ms integer
    constraint client_sync_events_duration_bounded
    check (duration_ms is null or duration_ms between 0 and 600000),
  error_category text
    constraint client_sync_events_error_category_valid
    check (error_category is null or error_category in (
      'controller_unavailable',
      'identity_mismatch',
      'deactivated',
      'paused',
      'not_ready',
      'safety_securing',
      'safety_blocked',
      'pending_load',
      'pending_save',
      'save_attempt_metadata',
      'durability_timeout',
      'durability_failed',
      'exception',
      'accepted',
      'conflict',
      'unavailable'
    ))
);

create index client_sync_events_location_occurred_at_idx
  on private.client_sync_events (location_id, occurred_at desc);

create index client_sync_events_user_occurred_at_idx
  on private.client_sync_events (user_id, occurred_at desc);

alter table private.client_sync_events enable row level security;

revoke all on table private.client_sync_events from public, anon, authenticated;
revoke all on sequence private.client_sync_events_id_seq from public, anon, authenticated;

create function public.record_client_sync_event(
  p_location_id uuid,
  p_boot_session_id uuid,
  p_app_build text,
  p_event_code text,
  p_mutation_sequence bigint default null,
  p_expected_revision bigint default null,
  p_duration_ms integer default null,
  p_error_category text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.location_memberships as membership
    where membership.location_id = p_location_id
      and membership.user_id = caller_user_id
      and membership.active
  ) then
    raise exception 'Active location access required.' using errcode = '42501';
  end if;

  insert into private.client_sync_events (
    user_id,
    location_id,
    boot_session_id,
    app_build,
    mutation_sequence,
    event_code,
    expected_revision,
    duration_ms,
    error_category
  ) values (
    caller_user_id,
    p_location_id,
    p_boot_session_id,
    p_app_build,
    p_mutation_sequence,
    p_event_code,
    p_expected_revision,
    p_duration_ms,
    p_error_category
  );
end;
$$;

revoke all on function public.record_client_sync_event(
  uuid,
  uuid,
  text,
  text,
  bigint,
  bigint,
  integer,
  text
) from public, anon, authenticated;

grant execute on function public.record_client_sync_event(
  uuid,
  uuid,
  text,
  text,
  bigint,
  bigint,
  integer,
  text
) to authenticated;

comment on table private.client_sync_events is
  'Privacy-safe client write-pipeline stage telemetry. Never stores operational AppData or payment/customer identifiers.';

comment on function public.record_client_sync_event(
  uuid,
  uuid,
  text,
  text,
  bigint,
  bigint,
  integer,
  text
) is
  'Records constrained sync-stage diagnostics for the authenticated user after active location membership verification.';
