# WAKILISHA 100: W5C correction authority and W6 replay handoff v1

**Scope:** WK100 #1338, existing draft PR #1356. **State:** engineering handoff for the remaining durable work, NOT acceptance or deployment authority.

## Current bounded implementation

- W5C displays all source receipt rows in ten-row pages. The new `wk100CorrectionReviewBoundary.mjs` ties each selected row/field to the **existing** Registry or MIZIZI review owner, source original digest, selected receipt, canonical Registry facts digest and saved eligibility-policy revision/digest.
- The correction-inspector panel is deliberately `not_saved`: opening a Registry editor does not store a chart correction case or grant permission to write any Registry fact.
- Existing typed Registry profile commands can review track title/ISRC/explicit/duration and release kind/date with their own capability, CAS and audit boundaries. Artist origin must use its separately governed admission/correction authority. Identity, credits, genre and language remain in human Registry/MIZIZI evidence review until their specific safe writers are proven.
- Source-native rank, stream/view totals, market, original bytes, native period and provider observation timestamp are **never** metadata correction fields.
- W6 still independently reads the same original receipt and saved policy, hashes current Registry facts per row, and compares the entire selected receipt (not only the visible ten rows). The revised comparison rejects a changed outcome/reason/identity **without** a changed Registry-facts SHA. It reports resolved/new filter reasons, entries newly eligible/excluded, new conflicts and identity changes. Its results explicitly report `savedCorrection=false` and `verifiedRegistryOperation=false`.

## W5C durable ledger candidate, not yet accepted or deployed

Do **not** store per-row cases inside `platform_private.wk100_admin_weekly_drafts_v1` or its draft-revision history. Those tables own the Edition configuration and should not become a bounded, mutable corrections queue.

The accepted Supabase CLI v2.107.0 generated `supabase/migrations/20261110190405_wk100_correction_decision_ledger_v1.sql` in an isolated worktree. The SQL candidate now introduces private case heads and immutable decision events. The signed-in Admin correction inspector calls narrow caller-JWT RPCs to read and record `hold`, `request_registry_review`, and `closed_no_change` with exact revision and operation IDs. This is not an applied or parser-accepted migration.

The following boundaries govern this candidate and the remaining work:

1. Exact row lineage: EAT week, contract ID, source receipt/attempt ID, capture row ID, original SHA-256, native source rank/identity, and saved Edition policy revision/digest.
2. Distinct operations: factual assertion/correction evidence, deliberate row hold or exclusion, and a separate whole-week policy revision. Never turn an editorial hold into forged canonical metadata.
3. Exact field path, source lineage, stated current Registry-facts digest, human rationale, actor capability, and timestamp. The asserted Registry-facts digest is review context, not server attestation. Proposed canonical values and individual evidence records remain in existing Registry/MIZIZI writers. No private raw provider bytes in public API responses or GitHub.
4. Append-only status transitions and idempotent operation IDs, with optimistic expected-state revisions. Concurrent reviewers, lost acknowledgements, revoked roles, duplicate submissions, partial interruption and stale input must fail closed or resume the exact recorded operation.
5. **Critical audit limitation:** existing `registry_canonical_write_events` and `registry_audit_log` allow inserts under `manage_registry` RLS. Their rows alone are therefore insufficient to prove the typed canonical writer executed. The v1 ledger deliberately has **no** `verified_applied` transition. Actual application needs a trusted typed-writer return value bound atomically to the case, independent Registry readback, and the new Registry-facts SHA.
6. Server-generated read models that cross-check the real receipt, row, saved week/policy and Registry versions. Client-supplied source hashes or canonical IDs never establish authority.
7. Narrow caller-JWT RPCs with explicit capabilities and private RLS; no service-role mutation shortcut, new MIZIZI execution grants, anonymous access or generic JSON patch into canonical tables.
8. Immutable decision history and deterministic re-evaluation receipts. A single row or batch must preserve original capture rows; W6 reruns only dependent eligibility/downstream private stages and invalidates stale sign-offs. A published Edition must require a separately audited revision/correction path.

The private substrate now uses `platform_private.wk100_correction_cases_v1` and `platform_private.wk100_correction_events_v1`, foreign-keyed to immutable capture receipts and rows. It has no direct authenticated/anonymous table grants, and published/staged weeks are guarded. This candidate does not link a case to a canonical-write event, because the current event table cannot independently attest execution. A separate trusted writer integration and independent W6 acceptance remain open. No SQL has been applied.

## W6 acceptance required before the combined slice is ready

- Demonstrate a **real** governed Registry correction (not a synthesized changeset), approved with the typed writer, verified in its existing audit ledger, with the W5C case linked to that operation.
- Capture before/after eligibility for the same immutable receipt and saved policy SHA. Show a resolved exclusion and at least one still-held/contradictory row. A batch must be reversible as an operator plan and resumable after interruption, but canonical facts never silently revert.
- Prove independent current-Registry readback, CAS/stale denial, role revocation, collision, exact-idempotent retry, no source refetch or alternate ingestion, no in-place published Edition reset, and retained exclusion history.
- Prove real signed-in Admin browser acceptance plus SQL and consolidated source-domain tests on the **exact** final PR head. No new permanent CI workflow or hosted Preview.

## Deployment and release

A SQL migration candidate was committed to the existing draft branch but has **not been applied**. No Edge deployment, frontend activation, source collection, private ranking, methodology freeze, or publication was authorized by this interim handoff. PR #1356 remains draft; production untouched. The earlier W7 v2 proposal is independent of this incomplete correction ledger and never supplies scoring or publication authority.
