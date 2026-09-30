# Music Provenance Slice 3 — lineage and Admin convergence acceptance record

Date: 30 September 2026
Programme issue: #1121
Implementation branch: `feat/music-provenance-slice3-review-materialization`
Opening implementation head: `148904e9a948bf3f4b4e2ac35ed9a4b38f9103d7`

## Status

This record captures the accepted implementation and Preview evidence for the
current Music Provenance Slice 3 work.

It does **not** subdivide Slice 3 into new mini-slices. The A-F ordering in the
binding execution scope remains one Slice 3 implementation sequence under
issue #1121. This record covers the lineage/read-only provenance finding path
and its convergence into the shared Admin review authority. Issue #1121 remains
open for the remaining Slice 3 work.

Production promotion has **not** happened at the time of this record.

## Implemented authority

The Slice 3 implementation adds:

- MIZIZI provenance review materialization for the four accepted finding
  families:
  - `provenance_attestation_evidence_binding_drift`;
  - `provenance_attestation_multiple_canonical_rows`;
  - `provenance_admissible_attestation_pending_review`;
  - `provenance_attestation_noncurrent_canonical_history`;
- typed `mizizi_private.music_provenance_scan_v1(...)` read authority;
- exact `mizizi_executor` EXECUTE access to the typed scan/review brokers while
  preserving zero direct provenance-table reads;
- typed Admin provenance review context and decision RPCs;
- provenance presentation and human decisions in `/admin/review/mizizi`;
- no autonomous canonical contribution admission;
- no contribution-rights inference.

The exact migration remains:

`20260930175049_music_provenance_slice3_review_materialization_v1.sql`

## Clean replay and retained Preview

Authoritative retained Preview:

- branch name:
  `music-provenance-slice3-retained-acceptance-20260930`;
- project ref: `ioveindzhuihvtjfamma`;
- parent Production project: `pgzizndxdyhqmtyywjmt`.

The retained Preview completed a full zero-data baseline replay before the
Slice 3 target migration was applied.

Baseline proof:

- Production migration count: `193`;
- retained Preview migration count before target: `193`;
- exact shared head:
  `20260930091613_music_provenance_slice2_attestation_history_trigger_privilege_fix`;
- target `20260930175049` absent from the baseline;
- target migration was then proven to be the only pending migration;
- native `supabase db push --dry-run` named only the exact target migration;
- target migration applied and exact version recorded.

Two older replay-history defects discovered during earlier disposable Preview
work were repaired at Production migration-history metadata level before this
retained clean replay. Historical SQL was not rerun and Registry/business data
was not mutated by those repairs.

The retained Preview remains alive until merged-main Production promotion and
Production smoke are complete.

## Repository schema/replay seal

The schema-affecting Slice 3 change is sealed using the repository's canonical
Preview replay-proof workflow, not by hand-editing snapshot metadata.

The canonical artifacts are:

- `src/types/database.types.ts`, generated from the retained migrated Preview
  with Production runtime metadata normalization;
- `docs/engineering/live-schema-baseline.json`, preview-sealed at migration
  count `194` and head `20260930175049`;
- `docs/engineering/replay-proofs/20260930175049_music_provenance_slice3_review_materialization_v1.sql.json`,
  binding the exact migration bytes, merge base, retained Preview identity,
  verifier, generated type hash, migration count, and migration head.

The Preview schema seal remains temporary release authority until the migration
is promoted to Production after merge. Production promotion must regenerate the
canonical schema snapshot from Production and return the seal to Production
authority.

## Permanent verifier and advisor acceptance

The permanent verifier:

`scripts/control-plane/verify-music-provenance-slice3-review-materialization.sql`

passed on the retained Preview.

Accepted invariants include:

- exact target migration recorded;
- typed provenance scan broker exists;
- scan broker requires the MIZIZI executor assertion;
- `mizizi_executor` can execute the broker;
- `anon`, `authenticated`, and `service_role` cannot execute the MIZIZI scan
  broker;
- `mizizi_executor` has no direct `platform_private` schema usage;
- `mizizi_executor` has no direct SELECT on private provenance tables;
- `mizizi_executor` has no direct SELECT on canonical Track/Work contribution
  history;
- `mizizi_executor` has no direct SELECT on `registry_review_items`;
- review materialization contains no canonical contribution write path;
- Admin decisions use accepted human admission RPCs rather than direct
  canonical table writes;
- standing MIZIZI authority at rest is zero;
- active exact Registry execution grants at rest are zero.

Supabase advisor comparison between Production and the retained Preview:

- new security advisor deltas: `0`;
- new performance advisor deltas: `0`.

## Real Stage C runtime acceptance

A deterministic Preview-only fixture was used:

- Track:
  `13f03a01-9e07-4ac4-8fa5-000000000001`;
- evidence assertion:
  `13f03a01-9e07-4ac4-8fa5-000000000002`;
- contribution attestation:
  `13f03a01-9e07-4ac4-8fa5-000000000003`.

Fixture state:

- subject: Track;
- claim key: `registry.contribution.attestation`;
- trust class: `INTERNAL_FACT`;
- role: `producer`;
- elicitation method: `imported_source`;
- current attestation state: `corroborated`;
- canonical contribution count: `0`.

Real base-managed JIT acceptance used
`session_user=current_user=mizizi_executor`.

The typed broker returned the fixture exactly once. Two consecutive
`registry:mizizi:review -- --entity=provenance --limit=0` runs each produced:

- one
  `provenance_admissible_attestation_pending_review` finding;
- one queued-for-review result;
- zero canonical Registry writes.

The executor did not read `registry_review_items` directly.

Admin-side inspection after repeated runs proved exactly one open review row,
with an idempotent `mizizi:<fingerprint>` review key.

JIT cleanup restored Production temporary access and zero-at-rest authority.

## Real browser/Admin acceptance

The dirty local frontend was launched against the retained Preview, not
Production.

A disposable Preview-only Supabase Auth identity was created and assigned the
existing `super_admin` role. No Production credential or identity was copied.

Browser acceptance on `/admin/review/mizizi` proved:

- provenance review visible: PASS;
- provenance detail/context rendering: PASS;
- subject, role, credited-as value, corroborated state, evidence trust, and
  canonical-history count render correctly;
- provenance-specific human decision controls render: PASS;
- `Need more evidence` decision submission: PASS.

The recorded acceptance decision is:

- decision type: `music_provenance_needs_more_evidence`;
- note: `Slice 3 retained Preview browser acceptance`;
- programme key: `music_provenance_contribution_review_v1`;
- programme issue: `1121`;
- decision stage: `human_review_recorded`;
- `canonicalEntitiesChanged=false`;
- `reviewResolved=false`;
- `rightsClaimInferred=false`;
- review remains `open`;
- Track canonical contribution count remains `0`;
- Work canonical contribution count remains `0`.

This is the intended behavior: a request for stronger provenance records human
review but does not resolve the review or create a canonical contribution.

## CI consolidation

The implementation extends the existing MIZIZI suites rather than creating a
new parallel test family.

Consolidation decisions:

- provenance broker and authority assertions remain in
  `test/registry/mizizi-cultural-data-steward.test.ts`;
- Admin workspace/convergence assertions remain in
  `test/registry/mizizi-admin-workspace.test.ts`;
- no new test file is introduced;
- the obsolete assertion requiring direct private-table provenance
  introspection was removed because the accepted typed-broker boundary
  deliberately forbids that access.

Accepted local gates before this final audit were:

- focused MIZIZI/Admin suite: `115 / 115`;
- protected critical suite: `489 / 489`;
- `npm run build:app`: PASS.

The final pre-commit audit reruns these gates plus `npm run schema:verify`.

## Deployment state

At this checkpoint:

- SQL migration required for Production: **yes**, after merge;
- Supabase Edge Function deployment: **no**;
- frontend activation required after merge: **yes**;
- retained Preview cleanup: **not yet**;
- issue #1121 closure: **not yet**.

The retained Preview must remain available through protected merge, separate
Production SQL promotion, Production verifier/history checks, merged-main
frontend activation, and Production smoke. It is removed only after those
steps are complete.
