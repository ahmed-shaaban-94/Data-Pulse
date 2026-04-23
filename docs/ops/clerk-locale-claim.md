# Clerk locale claim (archived migration note) (#604)

Auth0 is the only supported runtime provider after issue #654. This note stays
in the repo as prior art for a historical Clerk migration, not as an active
deployment contract.

## Why

DataPulse's `get_current_user` reads an optional `locale` top-level claim
from every verified JWT. The frontend uses it as the default when a user
hasn't picked a locale via the in-app switcher yet. Clerk does not include
`locale` by default — add a JWT template to surface it.

## One-time setup

1. Clerk Dashboard → your application → **JWT Templates** → *New template*.
2. Name it `datapulse` (the template name must match the audience your API
   expects; mirror whatever the existing templates use).
3. In the "Claims" JSON editor, ensure the custom claims include:
   ```json
   {
     "tenant_id": "{{user.public_metadata.tenant_id}}",
     "locale":    "{{user.public_metadata.locale}}",
     "roles":     "{{user.public_metadata.roles}}"
   }
   ```
4. On each user's profile, set `publicMetadata.locale` to the BCP-47 code
   (e.g. `"ar-EG"` or `"en-US"`). This can be automated via Clerk's
   pre-signup webhook or admin API.
5. Save + deploy.

## Fallback behavior

If `publicMetadata.locale` is unset, Clerk sends `null` for the claim and
`get_current_user` falls through to `"en-US"` by default. No crash.

## Historical context

When a temporary Clerk adapter existed, this JWT template supplied the same
top-level `tenant_id`, `roles`, and `locale` claims that Auth0 already emits.
That runtime path is retired now; if Clerk is revisited later, treat this file
as migration reference only.

See also: `docs/ops/auth0-locale-action.md` for the Auth0 equivalent.
