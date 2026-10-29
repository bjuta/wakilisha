# WK100 private capture preview: restricted receipt read v1

**Issue:** #1264. **Scope:** server-only read path; not an ingestion trigger, canonical Registry writer, Chart Edition writer, or public ranking API.

## Existing contracts reused

- `wk_chart_capture_contracts_v1`, `wk_chart_capture_attempts_v1`, and `wk_chart_capture_rows_v1` remain unchanged and immutable.
- `wk-chart-raw-evidence-v1` remains the existing private Storage bucket. Each selected raw key follows the capture writer's `v1/<week>/<source>/<slot>-<attempt>/<sha256>.<ext>` convention. Readback is capped at 4 MiB and verified against the immutable receipt SHA-256 by the existing reader.
- `registry_track_provider_links`, confirmed `provider_entity_links` and active `registry_tracks` are read-only identity evidence. Missing, conflicting or inactive identity is `review_required`; no title/artist similarity is auto-promoted.
- `wk100-capture-ranking-reader.mjs`, `wk100-capture-ranking-bridge.mjs` and `wk100-private-preview-core.mjs` remain the only ranking reader/projection/calculation contracts.

## Private endpoint

The new Edge route is `wk100-capture-private-preview` with `[functions.wk100-capture-private-preview] verify_jwt = true`. **The code is not deployed or enabled by this PR.** It accepts POST `{ "action": "read" }` only; clients cannot submit week, attempt IDs, source selections, project references, provider URLs or methods. Request body is capped to 96 bytes during stream consumption. CORS is restricted to the accepted WAKILISHA origins.

After hosted gateway JWT verification, the handler independently calls `auth.getUser` and reads live, unexpired `super_admin` or `administrator` assignments. It uses a server-side service-role client only after verifying the project URL against the separately configured expected project ref. Public clients never receive service credentials. Without `WK100_CAPTURE_PREVIEW_ENABLED=true`, it returns `preview_not_configured`.

The full private candidate manifest is a sealed server environment string, validated against a second expected SHA-256 of those exact bytes. It must contain **only** `schema_version`, `week_start_eat`, `dataset_mode='authorized_candidate'`, `selected_attempt_ids` (2–8 distinct UUIDs), `constitution` (matching unique source/operator keys), and the existing seven-field private ranking `method`. This is an exact selection and a private input, not a way for a browser to choose evidence or a claim of finished nationally representative rankings. Backend reader and private Storage always read only the selected evidence.

## Environment names (server-only; no values in repository)

- Supabase managed `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `WK100_CAPTURE_PREVIEW_PROJECT_REF`
- `WK100_CAPTURE_PREVIEW_ENABLED` (unset/false by default)
- `WK100_CAPTURE_PREVIEW_MANIFEST`
- `WK100_CAPTURE_PREVIEW_MANIFEST_SHA256`

The endpoint responds only with `status`, `week_start_eat`, aggregate verified receipt / review / behavior / recording counts and coverage state, and `can_publish:false`. It never returns source identities, row IDs, provider-native IDs, raw keys, raw hashes, authority refs, exact scoring weights, contributions or private audit internals. Failed or unresolved evidence returns no ranked result.

## Acceptance and release boundary

All implementation checks are consolidated into `test/charts/wk100-private-preview.test.mjs`; there is no new CI workflow, schema migration, provider request or scheduling change. The new function is not configured in Production. Before any later deployment, separately verify required Edge secrets, signed-in administrator/nonadministrator behavior, project binding, private Storage ACL and a real receipt readback in the intended environment. Existing historical editions and public Charts are unaffected. This PR cannot publish or promote an Edition.

## Hosted Preview authorization and fixture-lifecycle record (29 October 2026)

The disposable Supabase branch `lwkvifkwtfavcjyzknmt` was created without Production data and deployed only `wk100-capture-private-preview` v1 with gateway JWT verification. The branch was **deleted after testing**; the subsequent Supabase branch inventory contained only Production `pgzizndxdyhqmtyywjmt`. This is a historical acceptance record, not an active Preview configuration or a Production rollout.

The actual hosted HTTP results were:

- Missing Authorization header: **401**, `UNAUTHORIZED_NO_AUTH_HEADER` from the Supabase gateway.
- Authenticated nonadministrator: **403** from the endpoint.
- Authenticated administrator with an active, time-bounded assignment: **503**, `preview_not_configured`. The endpoint stayed disabled and exposed no private evidence.
- Exact Preview project binding and signed-in sessions: **PASS** in the owner's SHA-verified operator acceptance.
- No genuine capture or private Storage readback was possible: contracts, attempts, rows and raw objects remained empty. No candidate Chart Edition was admitted.

**The overall Auth fixture runner was not a clean PASS.** Its two test users could not be individually deleted through Supabase Auth Admin: `DELETE /auth/v1/admin/users/{id}` returned HTTP 500, PostgreSQL `23503`. This was caused by the intentional `editorial.person_identity_links.user_id -> public.user_profiles.user_id ON DELETE RESTRICT` historical-identity boundary, not by WK100 authorization. An isolated test's successful access assertions do not override a failed cleanup gate.

### Account lifecycle authority (do not bypass)

WAKILISHA already has a separate, deployed, governed account-retirement operation, `public.retire_account_identity(uuid,uuid,bigint,uuid,text,text,uuid)`. It requires an authenticated operator with **both** `manage_people_identity` and `manage_users`, refuses self-retirement and privileged targets, checks durable foreign-key blockers, preserves Person identity events and tombstones, and deletes Auth state only after governed unlink. The public Data API facade delegates to the privileged `account_identity_private` executor, which flushes deferred Person constraints inside its trusted transaction. Refer to `docs/engineering/account-identity-retirement-implementation-audit.md`, `docs/engineering/account-identity-retirement-data-api-boundary.md`, and the permanent read-only verifiers `scripts/control-plane/verify-account-identity-retirement.sql` and `scripts/control-plane/verify-account-retirement-data-api-boundary.sql`. This is the account-deletion authority, not generic Auth Admin `deleteUser` for an identity-linked account.

For **disposable, data-less hosted Preview Auth fixtures**, use a recorded branch ID and project ref as the lifecycle/cleanup boundary. Before deleting, independently verify that the target branch is **nondefault**, its parent is the exact Production project, its ref and name match the acceptance ledger, and it contains no durable business evidence. Remove the *entire verified branch* when acceptance finishes; never drop the Person foreign key, modify historical identity rows, or change Production to make temporary fixtures deletable. If a Preview contains genuine evidence or other retained work, do not delete it under this protocol. Escalate for a separate, reviewed cleanup authority.

For **non-disposable accounts**, use the governed retirement RPC and its existing approval, authorization, evidence and rollback controls. Do not substitute a direct Auth Admin delete or treat branch destruction as account-retirement authority.

This acceptance closes the JWT, role-denial and disabled-feature gates only. It does **not** certify authorized source collection, private ranking replay, real receipts, source licensing, or any public Chart Edition. See programme #1264 and account lifecycle reconciliation #1317.
