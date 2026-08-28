create table public.location_daily_real_revenue (
  location_id uuid not null references public.locations(id) on delete restrict,
  business_date date not null,
  real_revenue numeric(12, 2) not null
    constraint location_daily_real_revenue_non_negative check (real_revenue >= 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict,
  primary key (location_id, business_date)
);

create index location_daily_real_revenue_updated_by_idx
  on public.location_daily_real_revenue (updated_by);

create index location_daily_real_revenue_created_by_idx
  on public.location_daily_real_revenue (created_by);

create table private.location_daily_real_revenue_history (
  id bigint generated always as identity primary key,
  location_id uuid not null references public.locations(id) on delete restrict,
  business_date date not null,
  previous_real_revenue numeric(12, 2),
  real_revenue numeric(12, 2) not null,
  changed_at timestamptz not null default clock_timestamp(),
  changed_by uuid not null references auth.users(id) on delete restrict,
  action text not null constraint location_daily_real_revenue_history_action_valid
    check (action in ('INSERT', 'UPDATE'))
);

create index location_daily_real_revenue_history_lookup_idx
  on private.location_daily_real_revenue_history (
    location_id,
    business_date,
    changed_at desc
  );

create index location_daily_real_revenue_history_changed_by_idx
  on private.location_daily_real_revenue_history (changed_by);

alter table public.location_daily_real_revenue enable row level security;
alter table private.location_daily_real_revenue_history enable row level security;

revoke all on table public.location_daily_real_revenue
  from public, anon, authenticated;
revoke all on table private.location_daily_real_revenue_history
  from public, anon, authenticated;
revoke all on sequence private.location_daily_real_revenue_history_id_seq
  from public, anon, authenticated;

grant select on table public.location_daily_real_revenue to authenticated;

create policy location_daily_real_revenue_select_for_active_managers
on public.location_daily_real_revenue
for select
to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.location_memberships as membership
    where membership.location_id = location_daily_real_revenue.location_id
      and membership.user_id = (select auth.uid())
      and membership.active
      and membership.role in ('PLATFORM_OWNER', 'LOCATION_ADMIN')
  )
);

create policy location_daily_real_revenue_history_deny_browser_access
on private.location_daily_real_revenue_history
for all
to anon, authenticated
using (false)
with check (false);

create function private.capture_location_daily_real_revenue_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.location_daily_real_revenue_history (
    location_id,
    business_date,
    previous_real_revenue,
    real_revenue,
    changed_by,
    action
  ) values (
    new.location_id,
    new.business_date,
    case when tg_op = 'UPDATE' then old.real_revenue else null end,
    new.real_revenue,
    new.updated_by,
    tg_op
  );

  return new;
end;
$$;

revoke all on function private.capture_location_daily_real_revenue_history()
  from public, anon, authenticated;

create trigger capture_location_daily_real_revenue_history
after insert or update on public.location_daily_real_revenue
for each row execute function private.capture_location_daily_real_revenue_history();

create function public.set_location_daily_real_revenue(
  p_location_id uuid,
  p_business_date date,
  p_real_revenue numeric
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

  if p_business_date is null then
    raise exception 'Business date is required.' using errcode = '22023';
  end if;

  if p_real_revenue is null
    or p_real_revenue < 0
    or p_real_revenue >= 10000000000 then
    raise exception 'Real revenue is outside the allowed range.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.location_memberships as membership
    where membership.location_id = p_location_id
      and membership.user_id = caller_user_id
      and membership.active
      and membership.role in ('PLATFORM_OWNER', 'LOCATION_ADMIN')
  ) then
    raise exception 'Active location manager access required.' using errcode = '42501';
  end if;

  insert into public.location_daily_real_revenue (
    location_id,
    business_date,
    real_revenue,
    created_by,
    updated_by
  ) values (
    p_location_id,
    p_business_date,
    round(p_real_revenue, 2),
    caller_user_id,
    caller_user_id
  )
  on conflict (location_id, business_date)
  do update set
    real_revenue = excluded.real_revenue,
    updated_at = clock_timestamp(),
    updated_by = caller_user_id;
end;
$$;

revoke all on function public.set_location_daily_real_revenue(uuid, date, numeric)
  from public, anon, authenticated;

grant execute on function public.set_location_daily_real_revenue(uuid, date, numeric)
  to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'location_daily_real_revenue'
  ) then
    alter publication supabase_realtime
      add table public.location_daily_real_revenue;
  end if;
end;
$$;

comment on table public.location_daily_real_revenue is
  'Boss-entered real revenue per location and Europe/Zagreb business date. Operational AppData remains separate.';

comment on table private.location_daily_real_revenue_history is
  'Immutable audit evidence for every initial real-revenue value and correction.';

comment on function public.set_location_daily_real_revenue(uuid, date, numeric) is
  'Upserts one real-revenue value only after validating active manager membership for that location.';
