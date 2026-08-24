# Licensing, White Label and Seasonality

Status: `deferred`

## Current decision

Licensing, device/session enforcement and white-label controls are not part of Shared Petalon v1.

The immediate control mechanism is much simpler: authenticated users plus active Petalon membership enforced by RLS.

## Device/session limits

The previous plan to enforce concurrent active-session seats is deferred and should not be implemented now. There is no device-count limit, installation UUID enforcement or permanent hardware fingerprinting in the first shared release.

If account sharing becomes a real commercial problem later, choose the minimum control justified by evidence at that time.

## Seasonal licensing

The older location-per-season licensing model remains a possible future commercial design, but it is not required to build or validate the three-user Petalon application.

Do not create license tables or license-state logic during the current shared-database milestone unless Vuk explicitly re-promotes that work.

## White label / ownership concealment

Removing obvious links between the customer-facing product and Vuk's GitHub/Vercel/infrastructure identity remains important before broader external/commercial rollout, but it is deferred until the shared product works.

Later hardening can include a neutral product domain, neutral customer-facing branding, separate production project/account organization where appropriate, and removal of repository/provider references from customer-visible surfaces.

This is not a substitute for security. Backend access still depends on Auth + RLS + membership.

## Future multi-location rollout

Do not build speculative customer provisioning now. When a second real location is ready, design a repeatable pipeline for creating/configuring its location data, accounts, deployment/environment and branding from the proven Petalon process.
