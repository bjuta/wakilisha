# WAKILISHA 100: Candidate Source Transport and Private Byte Verification v1

**Status:** source-only unconnected implementation candidate for issue #1264. It is NOT a deployed collector, source admission, source scheduler, publication pipeline, or physical WORM archive.

## Baseline authority

Production migration 233 is accepted: immutable service-only capture receipt tables, private `wk-chart-raw-evidence-v1` Storage bucket (4 MiB), no current source contract rows, no scheduled collection jobs, and no WAKILISHA 100 publication. Merged origin main for this slice is `328d8a4ee218a9e371b9be9d5420494f10cdba2c` from PR #1265.

The 14 September seven-day cloud source-accessibility soak qualified Mdundo, Audiomack, Boomplay, Shazam, and YouTube in **distinct** source-behavior categories, with Apple supplementary/amber and Spotify UGC optional. This is engineering evidence of observed access durability, **not** an unrestricted provider-use licence or chart publication admission. The existing `wk_chart_capture_contracts_v1.admission_state` is constrained to `candidate` by SQL and must not be reinterpreted as admission to scoring.

## Code boundary

`supabase/functions/_shared/chart-candidate-capture.mjs` supplies two functions. It contains no source endpoints, embedded credentials, scheduler, database client, Edge HTTP handler, Registry code, scoring formula, or public chart publication code.

1. `fetchCandidateBytes`: receives one explicit source key, exact canonical HTTPS endpoint, per-source access decision and a **required external verifier**. The verifier must independently confirm legal/contractual source access, official origin, credential handling, market, permissible polling cadence, and current authority. A caller-supplied `authorization_ref` is never sufficient on its own. It refuses userinfo, IP literals, custom ports, redirects, cross-origin responses, unapproved MIME types, empty responses, timeout beyond 30 seconds, and bytes beyond 4,194,304 even where `Content-Length` is missing. `GET`, `credentials:omit`, and `redirect:manual` are enforced. The trusted runtime must additionally enforce egress/DNS policy; application-level hostname checks do not solve DNS rebinding.
2. `archiveCandidateBytes`: requires a trusted server-only adapter that uses **Supabase Storage `upsert:false`** for `wk-chart-raw-evidence-v1`, a unique object path, and an independent private Storage readback. It hashes the original and reread bytes using SHA-256 and compares exact bytes. It requires a **durable ledger reservation before the upload** and records `uploaded_unverified` and `verified` states. It never automatically deletes a partial object, marks a chart edition ready, or writes Registry/receipt tables. The stored object can require reconciliation if upload, readback, or ledger advancement fails.

The archive key format is `v1/<Monday EAT>/<source_key>/<UTC slot>-<attempt_number>/<digest>.<ext>`. Paths satisfy the existing immutable SQL receipt key shape. Attempts range from 1 through 8; slots must be inside the Monday 00:00 EAT weekly boundary. A verified payload is **candidate evidence only**.

## What must be true before a real environment can call this module

- A reviewed source-access register identifies each **exact** provider endpoint, lawful retrieval method, credential mode, secret presence and Preview-vs-Production parity, native observation interval and bounds. No live provider is called without independent approval.
- A real service-role Storage adapter is tested with the authorized Preview and actual Storage API. The existing synthetic Storage protocol test proved create-only/readback/collision/anon denial; it did not test this new module wired to that adapter.
- A **durable ledger implementation**, atomic per `(source_key, scheduled_at, attempt_number)`, survives crashes, rejects duplicate reservations, and supports orphan-object reconciliation. The injected ledger contract here is not a substitute for that persistence proof. Every mutation requires an accepted identifier ledger.
- Database attempt **and** rank-row persistence must be atomic under an authorized server-side transaction, preserving immutable receipt constraints. There is no such transaction in this source-only slice. Do not add REST writes that could leave successful attempts with missing rows.
- Fail-closed native source-period checks, parser-schema-version binding, clock-specific EAT schedule and missed-slot controls, negative tests, and at least one prospective independently replayable observation week must pass before any chart evidence freeze. Even a freeze has `can_publish=false` in schema v1.
- Authenticated signed-in-user Storage HTTP denial and real raw-object retention/administrator-mutation resistance remain open gates; do not misreport physical WORM.

## Acceptance scope

The new invariants are consolidated into the existing `test/charts/chart-weekly-evidence.test.mjs` contract, rather than adding a new permanent test file. In-memory fixtures exercise authorization, bounded HTTP transport, content integrity, strict create-only semantics, write-ahead ordering, and failure preservation. Those fixtures do not prove remote provider availability, Preview runtime secrets, or persistence atomicity.

**Release classification:** source-only; no SQL migration, Supabase preview apply, Edge Function deploy, frontend build or Production Finish Update. A protected repository PR is appropriate only after the accepted Mac worktree passes the consolidated chart contract, critical CI, and build. The source must not be imported into an active Edge entrypoint before completing the runtime dependencies above.
