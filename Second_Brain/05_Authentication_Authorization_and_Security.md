# Authentication, Authorization and Security

Status: `prototype_decision`

## Direction

Use Supabase Auth plus Postgres Row Level Security.

Initial real users:

- Vuk
- Vito
- Mark

Initial login method: email/password.

## Initial access model

All three users initially need access to the same Petalon operational application. User-specific UI/permission differences are not required for the first shared milestone.

Keep a role column in membership data so differentiated behavior can be added later without redesigning identity. Expected future intent remains:

- PLATFORM_OWNER — Vuk's private platform/developer authority;
- LOCATION_ADMIN — location owner/manager experience, expected for Mark;
- WORKER — daily operational experience, expected for Vito.

Vuk also has normal active Petalon membership so ordinary application behavior is tested through the same RLS path as other users.

## Membership and revocation

A browser user can access Petalon application data only through an active `location_memberships` row matching `auth.uid()` and the Petalon location.

Disabling/deleting that membership must immediately make RLS deny Petalon data access on subsequent database/API requests, even if the user's frontend bundle was copied or an Auth access token has not yet expired.

Deleting an Auth user can additionally prevent future login/token refresh, but membership/RLS is the primary immediate application-data revocation boundary.

## RLS rules

RLS must be enabled on every exposed application table. Policies must check actual tenant/location membership and must never rely on `TO authenticated` alone as authorization.

Do not use user-editable `user_metadata` for authorization.

Do not rely on hidden buttons, frontend route guards, JavaScript obfuscation or unpublished URLs as security.

## Privileged keys

Only a Supabase publishable key may be used in the public browser client. Supabase secret/service-role credentials must never be shipped to the browser or committed to the public frontend environment.

Privileged platform-owner actions belong in trusted server-side/admin tooling when such actions are eventually needed.

## Code-copy reality

A browser application's JavaScript cannot be made impossible to copy. The security objective is therefore that copying the frontend does not provide useful access to Petalon's real backend or data.

A copied frontend using the real Supabase URL/publishable key still has to authenticate and pass RLS. Once membership is disabled, it must not be able to read or mutate Petalon data.

If future commercial protection requires making a copied UI less independently useful, move selected valuable business logic into trusted backend functions. That is later hardening, not a prerequisite for shared DB work.

## Security checks before Shared Petalon v1 is accepted

- RLS enabled on all exposed app tables;
- no anon read/write access to Petalon data;
- positive test: each of Vuk/Vito/Mark with active membership can load/update Petalon;
- negative test: authenticated user without membership cannot read Petalon;
- revocation test: disabling a membership removes data access;
- separate publishable and secret keys handled correctly;
- production build contains no privileged key;
- database/security advisors reviewed after schema changes.
