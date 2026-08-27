import { describe, expect, it } from 'vitest';
import initialSchema from '../../../supabase/migrations/20260824213917_initial_shared_petalon_schema.sql?raw';
import multiLocationMigration from '../../../supabase/migrations/20260827200212_add_multilocation_profiles_and_login_aliases.sql?raw';
import realRevenueMigration from '../../../supabase/migrations/20260827200214_add_owner_real_revenue.sql?raw';
import koversadaProvisioning from '../../../supabase/provisioning/step10_koversada.sql?raw';
import rlsMatrix from '../../../supabase/verification/step10_multilocation_rls_matrix.sql?raw';

describe('Step 10 database security contracts', () => {
  it('retains membership-enforced location and location_state RLS', () => {
    expect(initialSchema).toContain('locations_select_for_active_members');
    expect(initialSchema).toContain('location_state_select_for_active_members');
    expect(initialSchema).toContain('location_state_update_for_active_members');
    expect(initialSchema).toContain('membership.user_id = (select auth.uid())');
    expect(initialSchema).toContain('membership.active');
  });

  it('keeps login aliases private and username separate from authorization', () => {
    expect(multiLocationMigration).toContain('create table private.login_aliases');
    expect(multiLocationMigration).toContain(
      'revoke all on table private.login_aliases from public, anon, authenticated',
    );
    expect(multiLocationMigration).toContain("set search_path = ''");
    expect(multiLocationMigration).not.toContain('encrypted_password');
    expect(multiLocationMigration).not.toContain('user_metadata');
    expect(multiLocationMigration).not.toContain('service_role');
  });

  it('allows only active location managers to read or set Real Revenue', () => {
    expect(realRevenueMigration).toContain(
      'location_daily_real_revenue_select_for_active_managers',
    );
    expect(realRevenueMigration).toContain(
      "membership.role in ('PLATFORM_OWNER', 'LOCATION_ADMIN')",
    );
    expect(realRevenueMigration).toContain(
      'membership.user_id = caller_user_id',
    );
    expect(realRevenueMigration).toContain('membership.location_id = p_location_id');
    expect(realRevenueMigration).toContain('revoke all on table public.location_daily_real_revenue');
    expect(realRevenueMigration).toContain('grant select on table public.location_daily_real_revenue to authenticated');
    expect(realRevenueMigration).not.toContain('grant insert');
    expect(realRevenueMigration).not.toContain('grant update');
    expect(realRevenueMigration).not.toContain('grant delete');
  });

  it('preserves immutable Real Revenue correction evidence', () => {
    expect(realRevenueMigration).toContain(
      'create table private.location_daily_real_revenue_history',
    );
    expect(realRevenueMigration).toContain('previous_real_revenue');
    expect(realRevenueMigration).toContain('changed_by');
    expect(realRevenueMigration).toContain(
      'after insert or update on public.location_daily_real_revenue',
    );
    expect(realRevenueMigration).toContain(
      'revoke all on table private.location_daily_real_revenue_history',
    );
  });

  it('provisions exactly the intended Koversada matrix and explicitly rejects Vito', () => {
    expect(koversadaProvisioning).toContain(
      "(koversada_id, vuk_id, 'PLATFORM_OWNER', true)",
    );
    expect(koversadaProvisioning).toContain(
      "(koversada_id, mark_id, 'LOCATION_ADMIN', true)",
    );
    expect(koversadaProvisioning).toContain(
      "(koversada_id, koversada_worker_id, 'WORKER', true)",
    );
    expect(koversadaProvisioning).toContain('Vito unexpectedly has Koversada membership');
    expect(koversadaProvisioning).toContain("username = 'koversada-radnik'");
  });

  it('carries a repeatable direct-RLS verification matrix for every intended actor', () => {
    expect(rlsMatrix).toContain('1723bcb9-6013-4aa7-821a-745859b3af87');
    expect(rlsMatrix).toContain('df1ec88a-70c6-47cc-8b59-1683ffeb5dbb');
    expect(rlsMatrix).toContain('e839a9e4-f86b-47d5-adaa-83779c4cd50f');
    expect(rlsMatrix).toContain('b5771919-8ee9-49d5-b7f5-8e634ee1dcbf');
    expect(rlsMatrix).toContain("has_table_privilege('anon'");
    expect(rlsMatrix).toContain('Koversada Worker Real Revenue');
  });
});
