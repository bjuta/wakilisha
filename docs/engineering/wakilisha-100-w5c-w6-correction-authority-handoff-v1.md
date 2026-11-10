# WAKILISHA 100: W5C correction authority and W6 replay handoff v1

**Scope:** WK100 #1338, existing draft PR #1356. **State:** engineering handoff for the remaining durable work, NOT acceptance or deployment authority.

## Current bounded implementation

- W5C displays all source receipt rows in ten-row pages. The new `wk100CorrectionReviewBoundary.mjs` ties each selected row/field to the **existing** Registry or MIZIZI review owner, source original digest, selected receipt, canonical Registry facts digest and saved eligibility-policy revision/digest.
- The correction-inspector panel is deliberately `not_saved`: opening a Registry editor does not store a chart correction case or grant permission to write any Registry fact.
- Existing typed Registry profile commands can review track title/ISRC/explicit/duration and release kind/date with their own capability, CAS and audit boundaries. Artist origin must use its separately governed admission/correction authority. Identity, credits, genre and language remain in human Registry/MIZIZI evidence review until their specific safe writers are proven.
- Source-native rank, stream/view totals, market, original bytes, native period and provider observation timestamp are **never** metadata correction fields.
- W6 still independently reads the same original receipt and saved policy, hashes current Registry facts per row, and compares the entire selected receipt (not only the visible ten rows). The revised comparison rejects a changed outcome/reason/identity **without** a changed Registry-facts SHA. It reports resolved/new filter reasons, entries newly eligible/excluded, new conflicts and identity changes. Its results explicitly report `savedCorrection=false` and `verifiedRegistryOperation=false`.

## Required dedicated W5C durable ledger (not yet implemented)

Do **not** store per-row cases inside `platform_private.wk100_admin_weekly_drafts_v1` or its draft-revision history. Those tables own the Edition configuration and should not become a bounded, mutable corrections queue.

The next forward migration **must first receive its exact filename from the repository-accepted Supabase CLI**, not a hand-composed timestamp. Design a private, append-oriented correction-case/event authority with:

1. Exact row lineage: EAT week, contract ID, source receipt/attempt ID, capture row ID, original SHA-256, native source rank/identity, and saved Edition policy revision/digest.
2. Distinct operations: factual assertion/correction evidence, deliberate row hold or exclusion, and a separate whole-week policy revision. Never turn an editorial hold into forged canonical metadata.
3. Explicit field path, prior and proposed values, source-evidence references, responsible Registry/MIZIZI authority, human rationale, actor capability and timestamp. No raw private provider bytes in public API responses or GitHub.
4. Append-only status transitions and idempotent operation IDs, with optimistic expected-state revisions. Concurrent reviewers, lost acknowledgements, revoked roles, duplicate submissions, partial interruption and stale input must fail closed or resume the exact recorded operation.
5. Existing canonical Registry writer/audit event identity, when actually applied, and subsequent readback that verifies the new Registry-facts SHA. A case's claimed `applied` flag cannot substitute for the writer's audited receipt.
6. Server-generated read models that cross-check the real receipt, row, saved week/policy and Registry versions. Client-supplied source hashes or canonical IDs never establish authority.
7. Narrow caller-JWT RPCs with explicit capabilities and private RLS; no service-role mutation shortcut, new MIZIZI execution grants, anonymous access or generic JSON patch into canonical tables.
8. Immutable decision history and deterministic re-evaluation receipts. A single row or batch must preserve original capture rows; W6 reruns only dependent eligibility/downstream private stages and invalidates stale sign-offs. A published Edition must require a separately audited revision/correction path.

Potential durable authority substrate is a **new private correction-decision event ledger**, connected by foreign keys to existing capture receipts/rows and by validated evidence to existing Registry canonical-write events. Exact relation/function names and migration paths remain unapproved until CLI creation and isolated SQL acceptance.

## W6 acceptance required before the combined slice is ready

- Demonstrate a **real** governed Registry correction (not a synthesized changeset), approved with the typed writer, verified in its existing audit ledger, with the W5C case linked to that operation.
- Capture before/after eligibility for the same immutable receipt and saved policy SHA. Show a resolved exclusion and at least one still-held/contradictory row. A batch must be reversible as an operator plan and resumable after interruption, but canonical facts never silently revert.
- Prove independent current-Registry readback, CAS/stale denial, role revocation, collision, exact-idempotent retry, no source refetch or alternate ingestion, no in-place published Edition reset, and retained exclusion history.
- Prove real signed-in Admin browser acceptance plus SQL and consolidated source-domain tests on the **exact** final PR head. No new permanent CI workflow or hosted Preview.

## Deployment and release

No SQL migration, Edge deployment, frontend activation, source collection, private ranking, methodology freeze or publication was authorized by this interim handoff. PR #1356 remains draft; production untouched. The earlier W7 v2 proposal is independent of this incomplete correction ledger and never supplies scoring or publication authority.
