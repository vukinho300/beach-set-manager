create index location_state_history_updated_by_idx
  on private.location_state_history (updated_by);

create policy location_state_history_deny_browser_access
on private.location_state_history
for all
to anon, authenticated
using (false)
with check (false);
