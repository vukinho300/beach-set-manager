-- One-time Step 6 administrative replacement for Beach Set Manager only:
-- project ref uonovdnxfjqfjkhopxwg, Petalon location below.
-- This deliberately refuses to run unless the exact Step 3 verification row
-- is still present at revision 4. It is not a migration and contains no Auth
-- identity or credential data.

do $$
declare
  updated_rows integer;
begin
  update public.location_state
  set state = jsonb_build_object(
    'sets', (
      select jsonb_object_agg(
        set_id::text,
        jsonb_build_object(
          'id', set_id,
          'beach', case when set_id <= 20 then 1 else 2 end,
          'status', 'free'
        )
      )
      from generate_series(1, 56) as generated_sets(set_id)
    ),
    'extraBeds', (
      select jsonb_object_agg(
        bed_id::text,
        jsonb_build_object(
          'id', bed_id,
          'label', format('Bed %s', bed_id),
          'status', 'free'
        )
      )
      from generate_series(1, 4) as generated_beds(bed_id)
    ),
    'beachReservations', '[]'::jsonb,
    'savedSurnames', '[]'::jsonb,
    'sunbedSales', '[]'::jsonb,
    'aquaparkEntries', '[]'::jsonb,
    'transactions', '[]'::jsonb,
    'reportArchive', '[]'::jsonb,
    'lastAutomaticResetDate',
      to_char(timezone('Europe/Zagreb', now()), 'YYYY-MM-DD')
  )
  where location_id = '00000000-0000-4000-8000-000000000001'::uuid
    and revision = 4
    and state = jsonb_build_object(
      'verification', jsonb_build_object(
        'step', 'revision-write-a',
        'actor', 'Vuk',
        'baseRevision', 3
      )
    );

  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    raise exception
      'Refusing Step 6 seed: expected exactly one untouched Petalon verification row at revision 4, updated % rows',
      updated_rows;
  end if;
end;
$$;
