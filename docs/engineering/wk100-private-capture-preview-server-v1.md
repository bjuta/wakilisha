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
