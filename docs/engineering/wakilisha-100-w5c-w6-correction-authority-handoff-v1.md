# WAKILISHA 100: W5C correction authority and W6 replay handoff v1

**Scope:** WK100 #1338, existing draft PR #1356. **State:** engineering handoff for the remaining durable work, NOT acceptance or deployment authority.

## Current bounded implementation

- W5C displays all source receipt rows in ten-row pages. The new `wk100CorrectionReviewBoundary.mjs` ties each selected row/field to the **existing** Registry or MIZIZI review owner, source original digest, selected receipt, canonical Registry facts digest and saved eligibility-policy revision/digest.
- The correction-inspector panel is deliberately `not_saved`: opening a Registry editor does not store a chart correction case or grant permission to write any Registry fact.
- Existing typed Registry profile commands can review track title/ISRC/explicit/duration and release kind/date with their own capability, CAS and audit boundaries. Artist origin must use its separately governed admission/correction authority. Identity, credits, genre and language remain in human Registry/MIZIZI evidence review until their specific safe writers are proven.
- Source-native rank, stream/view totals, market, original bytes, native period and provider observation timestamp are **never** metadata correction fields.
- W6 still independently reads the same original receipt and saved policy, hashes current Registry facts per row, and compares the entire selected receipt (not only the visible ten rows). The revised comparison rejects a changed outcome/reason/identity **without** a changed Registry-facts SHA. It reports resolved/new filter reasons, entries newly eligible/excluded, new conflicts and identity changes. Its results explicitly report `savedCorrection=false` and `verifiedRegistryOperation=false`.

## W5C and W6 integrated candidate, not yet deployed

Do **not** store per-row cases inside `platform_private.wk100_admin_weekly_drafts_v1` or its draft-revision history. Those tables own the Edition configuration and should not become a bounded, mutable corrections queue.

The accepted Supabase CLI v2.107.0 generated `supabase/migrations/20261110190405_wk100_correction_decision_ledger_v1.sql`. The previous candidate passed synthetic PostgreSQL 17.11 DDL and role/CAS acceptance at `5441b1fb`. The current extension uses that **same unapplied file**, adding a case-bound typed canonical writer and an independent W6 readback. This extended version still requires exact-head database and browser acceptance.

The following boundaries govern this candidate and the remaining work:

1. Exact row lineage: EAT week, contract ID, source receipt/attempt ID, capture row ID, original SHA-256, native source rank/identity, and saved Edition policy revision/digest.
2. Distinct operations: factual assertion/correction evidence, deliberate row hold or exclusion, and a separate whole-week policy revision. Never turn an editorial hold into forged canonical metadata.
3. Exact field path, source lineage, stated current Registry-facts digest, human rationale, actor capability, and timestamp. The asserted Registry-facts digest is review context, not server attestation. Proposed canonical values and individual evidence records remain in existing Registry/MIZIZI writers. No private raw provider bytes in public API responses or GitHub.
4. Append-only status transitions and idempotent operation IDs, with optimistic expected-state revisions. Concurrent reviewers, lost acknowledgements, revoked roles, duplicate submissions, partial interruption and stale input must fail closed or resume the exact recorded operation.
5. **Critical audit limitation:** `registry_canonical_write_events` and `registry_audit_log` allow `manage_registry` inserts, so their rows alone cannot prove writer execution. The new `applied_registry` event is created privately in the **same transaction** as the real existing typed Registry writer call, after independent row readback; direct authenticated inserts into the private ledger remain forbidden. W6 then rechecks current canonical field value and CAS timestamp. Later Registry drift invalidates that proof.
6. Server-generated read models that cross-check the real receipt, row, saved week/policy and Registry versions. Client-supplied source hashes or canonical IDs never establish authority.
7. Narrow caller-JWT RPCs with explicit capabilities and private RLS; no service-role mutation shortcut, new MIZIZI execution grants, anonymous access or generic JSON patch into canonical tables.
8. Immutable decision history and deterministic re-evaluation receipts. A single row or batch must preserve original capture rows; W6 reruns only dependent eligibility/downstream private stages and invalidates stale sign-offs. A published Edition must require a separately audited revision/correction path.

The private substrate uses `platform_private.wk100_correction_cases_v1` and `platform_private.wk100_correction_events_v1`, bound to immutable capture receipts and rows and not directly writable by browser roles. Frozen/staged weeks remain guarded. The applied event records the typed-writer authority, Registry entity, field before/after, and expected/new CAS timestamps. It does **not** trust any separately insertable public audit row. The SQL is not deployed.

## W6 application-aware live replay (candidate)

The W5C editor now offers atomic application only for the existing typed Track title, ISRC, explicit and duration fields and Release type/date. The case must be `request_registry_review`, the provider identity uniquely resolved, the actual Entity `updated_at` fresh, and `manage_ingest`, `manage_charts`, `view_registry` and `manage_registry` present. The SQL wrapper rechecks immutable source receipt, saved policy, Edition freeze, and canonical CAS, invokes the existing typed writer once, and stores the private immutable event in that transaction. Unsupported MIZIZI/credit/origin fields cannot be directly patched.

After an applied writer result, W6 re-reads all positions through the existing signed-in eligibility Edge action and fetches `wk100_read_correction_application_v1` through caller JWT. The comparator requires unchanged original/source/policy, the exact case and canonical entity, fresh readback, changed target facts, and no changed rows outside that Track or Release. A Release correction may legitimately affect multiple Tracks. The result reports `verifiedRegistryOperation=true`, `savedCorrection=true`, `comparisonPersisted=false`, `canScore=false`, `canPublish=false`. This is an **ephemeral comparison**, not a frozen Edition signoff.

The existing consolidated WK100 test suite, existing Chromium browser suite, and existing SQL structural gate were extended in place. The extended SQL, real caller-JWT RLS, baseline migration replay, authenticated browser and real canonical before/after acceptance must be proven on the **new exact head** before release. Nothing has been applied to Production.

## W6 acceptance required before the combined slice is ready

- Demonstrate a **real** governed Registry correction (not a synthesized changeset), approved with the typed writer, verified in its existing audit ledger, with the W5C case linked to that operation.
- Capture before/after eligibility for the same immutable receipt and saved policy SHA. Show a resolved exclusion and at least one still-held/contradictory row. A batch must be reversible as an operator plan and resumable after interruption, but canonical facts never silently revert.
- Prove independent current-Registry readback, CAS/stale denial, role revocation, collision, exact-idempotent retry, no source refetch or alternate ingestion, no in-place published Edition reset, and retained exclusion history.
- Prove real signed-in Admin browser acceptance plus SQL and consolidated source-domain tests on the **exact** final PR head. No new permanent CI workflow or hosted Preview.

## Deployment and release

The CLI-minted migration candidate remains on the existing draft branch and **has not been applied**. No Edge deployment, frontend activation, source collection, private ranking, methodology freeze, or publication was authorized by this interim handoff. PR #1356 remains draft; production untouched. The earlier W7 v2 proposal is independent of this incomplete correction ledger and never supplies scoring or publication authority.
