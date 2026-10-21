# WAKILISHA 100: restricted Admin ranking preview v1

**Engineering slice:** authenticated, synthetic-only, nonpublishing Admin preview. [Issue #1264](https://github.com/bjuta/wakilisha/issues/1264). This is **not** source admission, a finished private-production scoring constitution, or permission to publish Edition 1.

## Architecture

- Admin Charts route: `/admin/charts/wk100-preview`, lazy-loaded under existing Charts Admin. The navigation item is shown only for `super_admin` and `administrator`; the page independently prevents rendering data to other frontend roles.
- Edge: `wk100-private-admin-preview`, configured `verify_jwt = true`. The gateway must validate a JWT. The handler additionally asks GoTrue to validate the user's token and uses a **service-role server-side** database lookup of active, unexpired `user_role_assignments` for `super_admin` or `administrator`. Other chart roles are **not sufficient**. Session identity is never accepted from a request body.
- No input observations, provider names, secret weights, or source URLs are accepted in browser POST. The only request is `{ "action": "read" }`. The server reads a **privately sealed, project-bound** synthetic preview input from environment secrets, after authenticating the user and checking roles. A current SHA-256 digest must match those exact private bytes.
- The shared source-independent calculation kernel is now under `supabase/functions/_shared/wk100-private-preview-core.mjs`, reused unchanged by the offline Node wrapper. It is a **generic, non-authoritative proxy**. Real source-specific parameters are *not* committed to the public repository.
- The server response is explicitly allowlisted: synthetic week, proposed coverage state, aggregate counts and up to 100 provisional recording UUIDs and operator corroboration counts. It cannot return source keys, source manifests, raw hashes, source contributions, numeric coefficients, legal references or private native-period details. The browser never receives the full private audit.
- Every result is `can_publish:false`. There are no write endpoints, provider requests, scheduled jobs, Registry writes, source-contract mutations, or public chart changes.

## Required runtime configuration (names only)

A future separately approved environment setup would need these **server-only** values:

- `WK100_PRIVATE_PREVIEW_ENABLED=true`: **not set** by this PR. Absence returns `preview_not_configured` after authorization.
- `WK100_PRIVATE_PREVIEW_PROJECT_REF`: the exact project reference matching platform `SUPABASE_URL`.
- `WK100_PRIVATE_PREVIEW_INPUT`: confidential full **synthetic** `wk100-private-preview-v1` input under 256 KiB, including private weights, private source keys, and test-only UUIDs.
- `WK100_PRIVATE_PREVIEW_INPUT_SHA256`: independent SHA-256 digest of the **exact** input bytes.
- Platform-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which must not be copied into GitHub or the browser.

This PR does not set, print or otherwise guess those values. Production and hosted Preview custom-secret parity must be independently audited before enabling the function on either project. Role verification is separate from the public frontend route guard.

## Gates and honest limitations

The deployed endpoint, when no special preview configuration exists, fails closed for signed-in administrators. The new page shows a restrained "No approved preview configured" state; it is still an integrated, secured Admin route, **not a claim that a hosted synthetic Top 100 has already rendered**.

Even with valid synthetic config, passing a preview does not imply a source was legally admitted. The endpoint rejects `authorized_candidate` and all real observations. Source permission verification, provider origin checks, real MIZIZI identity binding, authorized native-period audit, production-secret execution of the **final** proprietary scoring formula, and data-backed confidence/reliability tests remain separate release gates.

The new unit/contract tests check role restriction, confidentiality of response projection, shared ranking behavior, and the secure expected source code and `verify_jwt` contract. They are **not** a substitute for a real signed-in hosted Preview browser acceptance. To deploy a new Edge Function, first establish the exact deployed dependency and secret inventory, deploy only this function to Preview with JWT enabled, and test real GoTrue-authenticated administrator / nonadministrator sessions without leaving test users behind. Do not deploy to Production or enable the collector on the basis of CI alone.

## Acceptance commands

```bash
node --test test/charts/wk100-private-preview.test.mjs
node --test test/charts/wk100-private-admin-preview.test.mjs
node --test test/charts/wk100-offline-intake-authority.test.mjs
```

These three tests run in protected `critical-core`, alongside full build and browser acceptance. Keep issue #1264 OPEN for hosted Preview access acceptance, real-lawful-data intake and the prospective evidence week.
