# Licensing, White Label and Seasonality

Status: `prototype_decision`

## Licensing unit

License per location per season, not per deployment or cloned application.

Example:

Petalon — 2027 season
- starts_at
- expires_at
- status
- max_worker_accounts
- max_admin_accounts
- max_active_sessions
- feature entitlements

Keep a separate license-period row for each season instead of overwriting one permanent license record.

## Suggested license states

- scheduled
- active
- grace
- read_only
- suspended
- expired

Inactive/expired locations are not deleted. Historical data and configuration remain so the next season can be reactivated without rebuilding the application.

## Device/session model

Prefer concurrent active-session seats instead of permanent hardware fingerprinting.

Each installation gets a random persistent installation UUID. The backend tracks active app sessions and enforces the licensed concurrent-seat count transactionally.

## White label

Customer-facing UI must not expose developer ownership. Branding/configuration belongs to the location/organization configuration:

- display name
- logo if later needed
- accent/theme options if later needed

Platform-owner controls must remain in a separate private admin/control interface.

## Seasonal cost principle

Inactive locations in a shared database create almost no incremental runtime usage. If all customers are inactive for winter, archive/backup production data and evaluate downgrading/pausing infrastructure according to current provider rules before each off-season.

## Payment status

Until payment-terminal integration becomes part of the product, infrastructure should remain free or close to free during development. Commercial hosting/tier upgrades should be triggered by the first paid production deployment or by security/reliability requirements, not by speculative scale.
