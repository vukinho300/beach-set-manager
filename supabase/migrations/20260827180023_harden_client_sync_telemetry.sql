alter table private.client_sync_events
  drop constraint client_sync_events_error_category_valid;

alter table private.client_sync_events
  add constraint client_sync_events_error_category_valid
  check (error_category is null or error_category in (
    'controller_unavailable',
    'identity_mismatch',
    'deactivated',
    'paused',
    'not_ready',
    'safety_securing',
    'safety_blocked',
    'admission_timeout',
    'pending_load',
    'pending_save',
    'save_attempt_metadata',
    'durability_timeout',
    'durability_failed',
    'exception',
    'accepted',
    'conflict',
    'unavailable'
  ));

create policy client_sync_events_deny_browser_access
on private.client_sync_events
for all
to anon, authenticated
using (false)
with check (false);
