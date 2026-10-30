# WAKILISHA 100 — governed Edition boundary v1 (#1329)

**Status, 30 October 2026:** private, nonpublishing proposal contract implemented on `feat/wk100-governed-weekly-edition-1329`. **NOT** a deployed weekly Edition writer or a Production approval mechanism. Parent programme: [#1264](https://github.com/bjuta/wakilisha/issues/1264).

## What exists, independently verified in Production (read-only)

- The established Kenya `top100` Chart V2 Programme already exists with `chart_size=100`. It does not need a duplicate Programme.
- `public.wk_chart_entries_v2.canonical_track_id` is nullable; Chart Entries preserve `track_title`, `artist_name`, `rank`, `source_payload` and `methodology_version`. Do not write a provisional observation reference into `canonical_track_id`.
- `public.wk_chart_weekly_freezes_v1` deliberately has `freeze_state='blocked'` and `can_publish=false` constraints, plus a unique receipt/constitution/method/digest identity. It is historical **nonpublishing** evidence, not a permission to publish a Top 100.
- `public.chart_get_edition_integrity_report(text)` currently assesses resolved Registry artist origins and marks `unresolved_artist_origins` / `country_ineligible_entries` as blockers; `public.wk_chart_editions_publish_integrity_guard()` calls the assertion on status transition to published. This is legacy programme integrity. It cannot be globally removed or treated as WAKILISHA 100's evidence sufficiency policy.
- As of this review, WK100 capture contracts = **0**, successful capture receipts = **0**, weekly freezes = **0**. There is **no** prospective evidence allowing an authentic public WK100 edition today. Do not seed synthetic rows into Production or claim an Edition exists.

## Committed source-only contract

`supabase/functions/_shared/wk100-governed-edition-proposal.mjs` exports `prepareWk100GovernedEditionProposal`.

It accepts the **restricted** source reader output from `readWk100PrivateRankingEvidence`, explicit constitutional SHA-256, week/Edition date, explicit UTC cutoff + deadline, and an editorial review selecting exactly one **actual observed title/artist source row** for each Top 100 rank. A review entry may choose the display observation but **cannot reassign a rank**, invent a listening count or convert an unresolved source row into a Registry Track.

The planner verifies the selected source manifests (market KE, approved candidate evidence, unique operators, native-period evidence), every selected capture attempt and per-source contiguous rank, selected rows, and the absence of source-attempt reuse. It reconstructs the exact private ranking input from the captured provenance, checks its cryptographic input digest and **independently reruns the existing scoring kernel**. It refuses a changed rank, score, source contribution, identity join, source digest, display observation, selection set, editorial digest, or cutoff. This logic does not claim to perform a fresh external provider read; that remains the private reader's raw-byte and parser contract.

The proposal records original title and artist from the explicit selected capture row, unchanged rank, frozen score, exact source/digest/attempt reference and all claimed corroboration sources. Each non-UUID `wk100:obs:v1:<raw_sha256>:<capture_row_uuid>` remains a provisional observation with `canonical_track_id:null`, not a canonical identity. Registry/MIZIZI resolution may follow later, under established authority, without rewriting that original published observation snapshot.

Two different keys are deliberate: `edition_slot_key=wk100:KE:<EAT-week>` identifies the **one allowed weekly Edition**, whereas `idempotency_key=wk100:<EAT-week>:<proposal-digest>` identifies the immutable exact review proposal. Changed review content cannot authorize a second Edition for the same week; the future DB writer MUST enforce that weekly uniqueness transactionally.

The result is deep-frozen, content-addressed and **always** `can_publish:false` / `can_write_registry:false`. An `editor_ref` is contextual evidence, **not an authenticated signature**. `constitution_sha256` is an external source-decision digest, **not permission**. The scoring quality flags are recorded and require one explicit reason per exception; the proposal is *never* an automatic quality override or publishing grant.

## Required governed writer (not yet implemented)

The current legacy `chart-ingest-api` commit path inserts edition and entry records as separate network operations; it is not the accepted atomic WK100 publication pathway. The next implementation must use a single PostgreSQL transaction behind an authenticated, restricted role/capability boundary:

1. Lock one `(program='top100', market='KE', week_start_eat)` Edition slot and compare approved constitution, cutoff, immutable source rows/digests, ranked result and editorial evidence. Refuse multiple different proposal digests for one week, source drift and post-cutoff recalc. Protect concurrent and retry operations.
2. Use an auditable immutable WK100 decision/freeze authority rather than reinterpreting `wk_chart_weekly_freezes_v1`'s permanently blocked contract. Reuse existing review and audit primitives where they provide **correct** exact approval and idempotency semantics. Any new schema or RPC must be minimal, migration-controlled and RLS-protected.
3. Insert the V2 Edition, **all 100** Chart Entries, frozen source metadata and publication ledger atomically. Explicitly validate rank continuity, unique candidates, preserved original display labels, source provenance and positive scores. Unresolved Registry identity is allowed; insufficient ranking evidence remains a separate hard blocker. Do not weaken unrelated `toprnb` or other legacy programme integrity rules.
4. Publish on the founder-approved EAT cadence; the missing explicit clock time must be set as an **authoritative publication policy** rather than guessed in code. Absence of required evidence creates a visible incident; missing ISRC, artwork, credits or Registry Track completion does not automatically postpone otherwise sufficiently evidenced publication.
5. Write pending identity investigations to accepted Registry/MIZIZI mechanisms **idempotently**. A later verified Track link must use controlled mutation/projection and append provenance/correction lineage; preserve exact original rank, display text, source period and methodology. No invented artist origin or ISRC.
6. Verify readers, links, chart tiles, search and mobile/desktop without assuming `track_slug` or `canonical_track_id` exists. Publish a true revision only through explicit authenticated correction authority, never by silent re-score.

## Release gates

- **Now:** pure ranked-evidence proposal and consolidated Node tests. Test source rows include missing ISRC, unresolved source identity, duplicate-source traps, incomplete metadata, tampered replay digest, reordered review and missed deadline. Production untouched.
- **Next:** CLI-minted **one scoped forward migration**, if required, after exact read-only schema/RPC audit; controlled isolated Supabase Preview with approved cost, synthetic transaction/rollback, denied-role checks, concurrent duplicate week and permanent read-only postflight verifier.
- **Then:** PR with native Node and SQL acceptance; no GitHub Actions dependency because minutes are exhausted; approved SQL promotion to Production only once verified. No collector cron, source enrollment, provider polling, automatic public publication or Edge activation as a side effect.

**Controlling principle:** evidence freeze / public Edition cutoff and Registry investigation are different clocks. The first is a quality and publication decision; the second is ongoing cultural-identity stewardship.


## Publisher preflight — observed database authority, 30 October 2026

This is a read-only analysis of live Production schema. **No migration has been deployed by this slice.**

1. Existing captured source contracts have `wk_chart_capture_contracts_v1_admission_state_check`: `admission_state = 'candidate'` only. A proposal's `admission:'approved'` is a separate *methodology/research decision*, not a database contract status. Do **not** rewrite the historical source contract check or claim an approved production feed because a private proposal can be constructed.
2. The `wk_chart_capture_attempts_v1` schema enforces a Kenya Monday EAT week, successful/failed transport distinction, SHA-256, exactly persisted observed row count, provider-period truth, and a unique `(contract_id,scheduled_at,attempt_number)` slot. A publisher must bind exact selected attempt IDs and immutable row evidence and cannot mint new observations from a ranked proposal.
3. The existing `wk_chart_weekly_freezes_v1` is permanently restricted to `freeze_state='blocked'` and `can_publish=false`; updates/deletions have an immutable trigger. It is valuable historical evidence and **must not** be repurposed into a publication grant or softened.
4. V2 `wk_chart_editions_v2` has a primary unique `id`, but no enforced uniqueness on the desired `(program_id, EAT-week)` slot. Its current program/date index is nonunique. The future publisher requires a transactional immutable weekly slot ledger/unique key; hashing proposal content alone does not prevent conflicting same-week publications.
5. The legacy `wk_chart_editions_publish_integrity_guard_bu` runs **before UPDATE OF status**, not INSERT. It calls the legacy resolved artist-origin eligibility assertion on becoming published. A WK100 pathway must never sneak around that guard by inserting `status='published'` directly, nor remove artist checks from all chart programmes. Proposed integration: create the V2 Edition in an explicitly nonpublished state, write/verify all entries in the same database transaction, then perform a guarded status transition with a narrowly scoped, independently verified WK100 publication authority and preserved legacy behavior for other programmes.
6. The existing Chart Entry insert/update/delete lineage triggers already capture canonical identity projection changes. They are append-only history, but a verified canonical link later must preserve **original observed** artist/title/rank and not infer missing artist origin, ISRC or cross-source equivalence.
7. The existing `public.current_user_has_capability(text)` is a candidate authenticated-user gate to inspect before designing the RPC. **Do not trust the client-supplied editor_ref**. Ensure the publisher function is schema-private, has explicit `EXECUTE` revocations, validates `auth.uid()` and an authenticated live capability, and is not callable by a generic service-role token or arbitrary signed-in user. A SECURITY DEFINER alone is not an authorization scheme.
8. At review, Production has **zero** WK100 capture contracts, receipts and freezes. No genuine Week-1 score or publishable source admission exists. This is an engineering implementation track, not authorization to generate a public chart.

### Immediate implementation decision

The transactional publisher needs a narrowly scoped *new governed approval/slot mechanism*, not an amendment to the protected frozen historical receipt table or a change to all chart programmes. Its database acceptance must specifically prove a direct published INSERT is denied for WK100, that only authenticated reviewed proposal promotion is allowed, that conflicting same-week proposals fail atomically, and that existing legacy `toprnb` publication validation is unchanged.

The accepted proposal module remains nonpublishing even after an SQL writer is authored. The bridge between private audited proposal and SQL must reject any client-made claims: recompute source/attempt evidence server-side under controlled privileges, compare content digest and approved review authority, and never accept a manufactured `can_publish:true` field.


## CLI migration identity and database candidate checkpoint (30 October 2026)

The product owner ran the established `supabase migration new wk100_governed_publisher_v1` command successfully. **Supabase CLI generated `20261030095808_wk100_governed_publisher_v1.sql`.** It was generated inside a disposable directory and deleted by that script's cleanup; there is no executable SQL file to recover from the temporary directory. The timestamp and base name are now authoritative for this slice. The final SQL must be installed at `supabase/migrations/20261030095808_wk100_governed_publisher_v1.sql` **only after a full isolated database acceptance**.

The current source branch `feat/wk100-governed-publisher-1329` contains an intentionally **nondeployable** draft in `scripts/acceptance/wk100-governed-editorial-approval-candidate-v1.sql` with an unconditional `WK100_CANDIDATE_EXECUTION_PROHIBITED` interlock before DDL. The draft now includes three separate identity/authority boundaries: server-only private ranking replay attestation, independently authorized human editorial approval, and separately authorized atomic 100-entry **draft-only** Edition staging. All three have private immutable receipts and deny direct table access. The staging writer serializes an approved week, checks the approved snapshot and original observation rows, rejects duplicate identities/ranks, inserts 100 Entries transactionally, and never marks an Edition published. A targeted partial unique index prevents two Top100 Editions for one edition_date even if a different V2 writer races the staging RPC.

Scoped WK100 Edition INSERT and status-transition triggers deliberately reject any ungoverned move to `published`; legacy guards for other programmes remain active. **A real WK100 publication promotion RPC and async MIZIZI linkage are NOT implemented.** The private attestation RPC is only a service-role trust boundary: the database cannot itself establish that raw Storage bytes were read and scored. A restricted server path must actually replay those bytes, the rank kernel and the content digest before attesting; otherwise a caller holding the service key could vouch for a false proposal.

Release remains blocked: this staged draft has not been run through a PostgreSQL parser or an actual isolated DB, has no denied-role/concurrent-retry or SQL rollback acceptance, and is not in `supabase/migrations`. No Production SQL, Edge activation, paid Preview or GitHub Actions run occurred. Before accepting a migration: complete independent attestation caller, verify the approved proposal idempotency and all 100 staged Entries through a clean Preview, implement the governed publication transition and the Registry follow-up ledger, and confirm public chart readers on provisional identities. A paid Preview requires explicit new-cost approval; #1326's historical Preview consent is not reused.


### Separate trusted source attestation is now modeled

The branch adds `supabase/functions/_shared/wk100-governed-edition-attestation-server.mjs`, a private server-side integration helper. It reads a **SHA-sealed manifest**, downloads and replays exact private raw observations through the existing reader, derives the constitution/method SHA-256 from that manifest, runs the immutable governed Top 100 proposal builder, and only then invokes the service-role-only `wk100_attest_private_ranking_replay_v1` RPC. The existing browser-safe preview response remains allowlisted and unchanged. The helper's output contains private evidence and must **never** be returned to a browser.

The draft SQL now requires the service attestation, a separately authenticated `manage_charts` editorial approval, and a separately authorized `publish_charts` draft staging action. The private approval, attestation and stage ledgers are immutable and RLS-protected. One partial unique index prevents competing `top100` Editions by date even outside the staging writer. The stage writes all 100 entries as **draft** in one transaction. WK100 published INSERT and status UPDATE are both blocked until a separately accepted governed promotion authority is implemented.

**Still not accepted:** This helper is not an activated or deployed Edge Function. Neither its server-side environment/role boundary nor the new SQL functions have been runtime-tested. The current one-case native regression is unexecuted. No public publication can be performed. Native Node test, the full isolated PostgreSQL Preview (including real publisher/denied-role/concurrency checks), and the public promotion/correction workflow remain mandatory.


### Publisher hardening checkpoint — source admission, deadline, frozen rank and MIZIZI handoff

The gated SQL candidate now requires a **separate institutional source-admission decision per EAT week and capture contract**. The existing capture contract's `admission_state='candidate'` is not sufficient authority to publish. Admission needs a logged source/method authority SHA, a live editor with both `manage_charts` and `manage_ingest` capabilities, and an immutable private receipt. The editorial approval RPC must find each selected contract in that separately admitted roster.

The editor's claimed review timestamp is not the clock of record: the approval RPC checks `clock_timestamp()` against the exact approved UTC cutoff and deadline. This deliberately fails closed for late approval; a missed deadline needs an explicit incident/recovery policy, not a hidden backdate.

After atomic draft staging, UPDATE/DELETE on staged Chart Entry original observations, late INSERTs, and material Edition edits are rejected. A future **separate audited identity-linkage RPC** must preserve observed artist/title/rank/source evidence rather than directly editing staged content. No public WK100 status transition is currently permitted.

For each unresolved provisional recording, staging creates an immutable, RLS-protected **MIZIZI investigation handoff** in the same transaction and verifies its row count equals the provisional entries. This is a review queue only: it does not create a Track, infer ISRC or artist origin, or silently merge two observed recordings. Later canonical linkage/reconciliation is still pending.

The existing WK100 consolidated test suite now contains a **static-only fail-closed SQL candidate contract check**. Changed JavaScript files parse, and that source-level check passed in isolated evaluation. No PostgreSQL schema, trigger, RPC, concurrency, RLS role or migration execution acceptance has been performed. No GitHub Actions minutes used; issue #1329 remains open and Production unchanged.
