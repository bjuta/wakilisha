# MIZIZI Slice 3 Tranche B — Track Duplicate Repair Deployment Record

Date: **22 September 2026**

Programme issue: **#962**

Status: **IMPLEMENTED ON WORKING BRANCH — REPLAY / BEHAVIOR ACCEPTANCE PENDING**

Working branch:

`fix/mizizi-slice3-tranche-b-track-duplicate-authority`

Entry protected main:

`8b3ac9fad3f804001c1612b2ff66cb6511c675c4`

Current Production project:

`pgzizndxdyhqmtyywjmt`

Current Production migration baseline at implementation time:

- migration count: **168**
- migration head: **20260921171000**
- accepted mature public repair function present: **yes**
- accepted preview function present: **yes**
- Registry exact-operation kernel present: **yes**
- shared Registry review authority present: **yes**
- new Track duplicate capability namespace free: **yes**
- new Track duplicate broker namespace free: **yes**
- new Track duplicate operation namespace free: **yes**
- private-engine target namespace free: **yes**

## Forward migration authority

The migration filename was created through the repository-required Supabase CLI command:

`supabase migration new registry_track_duplicate_repair_authority_v1`

Canonical file:

`supabase/migrations/20260922054353_registry_track_duplicate_repair_authority_v1.sql`

No timestamp was invented manually.

## Accepted source engine seal

Before implementation, current Production proved the mature engine body SHA-256:

`ff7ec6d997671e5f27ed2056149e56e4c913284f911e0eb943532f750e39c0e7`

The forward migration now checks this body hash **before** internalization.

After moving and renaming the function, both migration proof and permanent verifier require the private engine body to have the same SHA-256.

This mechanically proves the migration is moving the accepted mature algorithm rather than replacing it with a rewritten implementation.

## Implemented authority boundary

Public product signature preserved:

`public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)`

Mature mutation engine target:

`platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)`

Broker actor:

`registry_track_duplicate_admin`

Typed capability:

`repair_registry_track_duplicate`

Typed operation:

`registry.track.duplicate_repair/v1`

Frozen operation envelope:

- risk: **critical**
- allowed subjects: **Track**
- existing target required: **yes**
- maximum exact Track targets: **16**
- maximum row ceiling: **64**
- grant TTL ceiling: **300 seconds**
- human approval required: **yes**
- independent verifier required: **yes**
- required user capability: **manage_registry**

## Kernel delta

**0**

The implementation reuses:

- capability definitions;
- System Actor + executor binding;
- Registry evidence assertions;
- exact execution grants;
- exact execution targets;
- shared Registry review sealing;
- Registry mutation operation journal;
- canonical write events;
- operation/write-event linkage;
- subject-state fingerprints;
- target-set fingerprints;
- current-authority checks;
- deterministic independent verifier lifecycle.

No new generic evidence, review, approval, grant, operation, lineage, or journal relation was created.

## Concurrency / stale-state authority

The exact grant freezes:

1. shared per-Track Registry subject-state fingerprints;
2. one domain-specific composite repair-state fingerprint covering:
   - exact Track rows;
   - Track provider links;
   - Track↔Artist credit rows;
   - Release↔Track membership rows;
   - Chart rows addressed by the target Track IDs/slugs.

Execution locks these row families before recomputing the composite fingerprint.

If related state changed after grant issuance, execution fails with:

`WK_STALE_TRACK_DUPLICATE_REPAIR`

No mature repair mutation is allowed after a stale plan.

## Row-budget authority

The exact candidate budget is derived from the frozen preview:

- Chart rows to move;
- provider links to move;
- Release↔Track rows touched;
- Track↔Artist rows moved/archived;
- duplicate Tracks archived;
- one canonical Track update.

The exact grant carries that candidate-specific budget.

The typed operation has only the outer 64-row fail-closed ceiling.

The executor rejects a mature-engine result whose reported row count exceeds the exact grant.

## Shared review authority

This candidate does **not** create a Track-duplicate-specific review table.

Inserting exact grant targets reuses the accepted:

`registry_execution_grant_target_review_seal`

and deferred:

`registry_execution_grants_review_authority_guard`

Every exact Track target therefore receives causal approved shared-review authority bound to:

- operation;
- evidence assertion;
- reviewer principal;
- exact execution grant.

## Independent verifier

Permanent verifier:

`scripts/control-plane/verify-registry-track-duplicate-repair-authority.sql`

Terminal pass marker:

`REGISTRY_TRACK_DUPLICATE_REPAIR_AUTHORITY_PASS`

The verifier proves:

- typed actor/capability/operation envelope;
- public command grant boundary;
- no anon/authenticated/service-role access to private helpers/engine;
- public wrapper does not regain direct canonical DML;
- mature engine body hash is unchanged;
- exact executor still freezes/locks/rechecks state;
- exact row budget remains enforced;
- resolution event contract remains present;
- duplicate Track lifecycle converges;
- provider links leave duplicates;
- live Track↔Artist credits leave duplicates;
- live Release↔Track memberships leave duplicates;
- Chart projection no longer addresses duplicate Track identities;
- canonical Track does not have ambiguous current primary Artist identity;
- every successful duplicate source retains Track supersession lineage;
- operation/write-event causality is present;
- no active exact Track duplicate grant remains at rest;
- no succeeded Track duplicate operation remains without verifier PASS.

## Writer inventory

The surviving public product command is classified as:

`security_definer_reviewed_exact_grant_wrapper_over_private_mature_engine`

Disposition:

`keep`

Future boundary:

`reviewed_exact_track_duplicate_repair_v1`

The private engine is owner-internal and not a new product-callable road.

## Repository scope currently changed

Intended files only:

- `docs/engineering/mizizi-slice3-tranche-b-track-duplicate-authority-design.md`
- `docs/engineering/mizizi-slice3-tranche-b-track-duplicate-authority-deployment.md`
- `scripts/control-plane/registry-privileged-writer-manifest.json`
- `scripts/control-plane/verify-registry-track-duplicate-repair-authority.sql`
- `supabase/migrations/20260922054353_registry_track_duplicate_repair_authority_v1.sql`
- `test/registry/mizizi-cultural-data-steward.test.ts`

No frontend source or Edge Function is intentionally changed.

## Gates already passed

- exact branch base is current protected main at implementation start;
- main has not moved under the branch;
- generated migration filename came from Supabase CLI;
- current Production preflight dependencies exist;
- all new SQL namespaces are free;
- mature engine Production body seal captured;
- branch scope audit shows only intended Tranche B files;
- static branch audit proves the private engine is moved, not recreated;
- static branch audit proves the public wrapper contains no direct canonical Registry DML;
- focused machine contracts have been added.

## Gates not yet passed

The following must remain **pending** until independently proven:

1. focused repository test execution;
2. SQL parser / real database replay;
3. disposable Supabase Preview creation/replay;
4. permanent Track duplicate verifier on Preview;
5. permanent shared-review verifier on Preview;
6. permanent Identity + Projection Lineage verifier on Preview;
7. canonical Registry writer inventory verifier on Preview;
8. adversarial direct private-engine execution denial;
9. real authenticated Admin duplicate-repair behavior on a disposable/rollback fixture;
10. exact grants return to zero at rest;
11. schema generation / Production seal implications;
12. protected PR CI;
13. merge;
14. canonical Production SQL promotion from exact merged main;
15. independent Production verifiers;
16. Tranche B Track duplicate closure record;
17. advance to Artist decouple only after this family is accepted.

## Preview infrastructure status

At this checkpoint, Supabase branch inventory contains only Production/main.

No disposable Preview currently exists.

A new Supabase development branch is a billable-resource action and therefore has **not** been silently created.

## Deployment classification

- SQL migration needed: **Yes**
- Supabase Edge Function deploy needed: **No**
- Production Finish update needed: **No**
- frontend deploy needed: **No**
- PR needed now: **Not yet**
- Production mutation authorized now: **No**
- next gate: **focused repository tests, then disposable Preview replay after branch-cost confirmation**


## Preview replay acceptance — 22 September 2026

Disposable Preview:

- branch: `slice3-tranche-b-track-duplicate-authority`
- project ref: `thlmqyifbtwdyskbozxv`
- branch id: `554939b5-3edd-4ca7-ba69-0c598a8af54f`
- confirmed branch cost: **$0.01344/hour**

Initial branch creation surfaced a platform parity defect: the Preview first appeared with an older migration baseline. A Production rebase was initiated before candidate replay.

After rebase, baseline acceptance was proven independently of the Supabase lifecycle label:

- Preview migration set exactly equaled Production: **168 / 168**;
- Preview migration head exactly equaled Production: `20260921171000_registry_chart_artist_resolution_rebase_v1.sql`;
- Preview Edge Function inventory exactly equaled Production: **40 / 40**, including deploy hashes and JWT settings;
- mature duplicate-repair engine body SHA-256 exactly equaled Production:
  `ff7ec6d997671e5f27ed2056149e56e4c913284f911e0eb943532f750e39c0e7`;
- Artist Studio Registry Entry Convergence verifier: **PASS**;
- Registry Chart Materialization Runtime verifier: **PASS**;
- MIZIZI Shared Review Authority verifier: **PASS**;
- MIZIZI Identity Projection Lineage verifier: **PASS**;
- Registry Canonical Writer Inventory verifier: **PASS**.

Supabase continued to report the branch lifecycle status as `MIGRATIONS_FAILED` despite exact migration/runtime parity and passing permanent verifiers. This is retained as a platform-status anomaly and is not treated as migration acceptance evidence by itself.

### Native repository migration replay

The exact repository migration was replayed with pinned Supabase CLI **2.107.0** through the repository-native linked path.

Pre-apply dry run:

- exactly one pending migration:
  `20260922054353_registry_track_duplicate_repair_authority_v1.sql`.

Native apply:

- `supabase db push --linked`: **PASS**.

Post-apply:

- native dry run: **zero pending**;
- Preview migration count: **169**;
- Preview migration head:
  `20260922054353_registry_track_duplicate_repair_authority_v1.sql`.

No connector `apply_migration`, raw migration helper, history repair, `db pull`, or timestamp alias was used.

### Post-apply permanent verifier stack

On the exact 169-migration Preview:

- Registry Track Duplicate Repair Authority:
  `REGISTRY_TRACK_DUPLICATE_REPAIR_AUTHORITY_PASS`;
- MIZIZI Shared Review Authority:
  `MIZIZI_SHARED_REVIEW_AUTHORITY_PASS`;
- MIZIZI Identity Projection Lineage:
  `MIZIZI_IDENTITY_PROJECTION_LINEAGE_PASS`;
- Registry Canonical Writer Inventory:
  `REGISTRY_CANONICAL_WRITER_INVENTORY_PASS`.

### Adversarial authority proof

Post-apply Preview proves:

- private moved engine body SHA-256 remains exactly
  `ff7ec6d997671e5f27ed2056149e56e4c913284f911e0eb943532f750e39c0e7`;
- `anon` cannot execute the private engine;
- `authenticated` cannot execute the private engine;
- `service_role` cannot execute the private engine;
- `anon` cannot execute the public governed command;
- `service_role` cannot execute the public governed command;
- `authenticated` can execute the public governed command;
- active Track duplicate exact grants at rest: **0**;
- succeeded Track duplicate operations lacking verifier PASS: **0**.

### Remaining acceptance gate

A rollback-only SQL simulation was intentionally not accepted as the final transport proof because the MCP SQL session is `session_user=postgres`, while the governed product boundary correctly requires the accepted `authenticator` transport binding.

The remaining gate is therefore one **real Supabase Auth + Data API client** execution against the disposable Preview:

1. create an anonymous authenticated Preview user through Supabase Auth;
2. grant that disposable user `registry_editor`;
3. seed one disposable high-confidence Apple Music catalog duplicate fixture;
4. call the public governed RPC through the real authenticated Data API;
5. prove evidence/review/exact-grant/journal/verifier/lineage outcomes;
6. rerun permanent verifiers and zero-active-grant checks;
7. delete the disposable Preview after acceptance.

This remaining gate is a transport/behavior proof only. Schema replay and database authority are already accepted.


## Real authenticated behavior defect discovery — 22 September 2026

The first real Auth -> Data API behavior attempt reached the governed public Track duplicate repair command and exposed a real implementation defect before PR.

Observed client error:

`Issued Registry execution authority is immutable; revoke it and issue a new exact grant instead.`

The failed RPC transaction rolled back grant/operation creation. Post-failure Preview state proved:

- Track duplicate exact grants: **0**;
- Track duplicate mutation operations: **0**.

The disposable Auth user and two-Track Apple catalog fixture created before the RPC remain Preview-only test residue and are not Production data.

### Root cause

The first candidate implementation issued the exact grant with a placeholder `target_set_fingerprint`, inserted exact targets, then attempted to update the already-issued grant with `registry_execution_target_set_fingerprint(grant_id)`.

That violates the accepted kernel's immutable-authority contract:

`platform_private.guard_registry_execution_grant_immutability()`

correctly rejects mutation of issued authority fields including `target_set_fingerprint`.

The defect was in the Tranche B adapter, not the shared kernel.

### Smallest correction

The corrected issuer now follows the accepted existing Registry exact-grant pattern:

1. compute every exact Track target's current `registry_subject_state_fingerprint('track', id)`;
2. construct the deterministically ordered exact-target JSON array;
3. compute the final target-set SHA-256 **before grant insertion**;
4. insert the immutable grant once with that final fingerprint;
5. insert exact targets;
6. rely on the existing deferred target-set integrity guard to verify equality at commit.

No shared kernel, review trigger, operation journal, mature duplicate-repair engine, public RPC signature, or product caller changed.

Permanent regression contract now forbids:

- `repeat('0',64)` placeholder target authority;
- post-issuance `UPDATE platform_private.registry_execution_grants SET target_set_fingerprint...`.

The corrected unmerged migration must now be replayed from a **fresh Production-parity Preview**. The existing Preview is intentionally not patched in place because clean replay is the acceptance authority for an unmerged repository migration.


## Real authenticated R2 acceptance — 22 September 2026

The corrected immutable-grant issuer was replayed from a fresh Production-parity Preview and accepted through the real Supabase Auth -> Data API product path.

Preview:

- branch: `slice3-tranche-b-track-duplicate-authority-r2`
- project ref: `brtthfzdznfsgzrrlqdv`
- branch id: `0b7a1052-ae96-41af-8d88-f2ee77e90959`

Corrected native replay:

- pre-apply dry run: exactly one pending migration:
  `20260922054353_registry_track_duplicate_repair_authority_v1.sql`;
- native `supabase db push --linked`: **PASS**;
- post-apply dry run: remote database up to date;
- remote migration ledger: **169** migrations;
- remote head: `20260922054353_registry_track_duplicate_repair_authority_v1.sql`.

The corrected live issuer proves:

- no zero-hash placeholder target authority;
- no post-issuance `target_set_fingerprint` update;
- target-set fingerprint precomputed before immutable grant insertion.

### Real Auth -> Data API behavior

A disposable authenticated Preview user with `registry_editor` authority invoked the existing public product RPC over the real Supabase Data API.

Accepted IDs:

- user: `29d87921-ec69-4777-b7ae-93eb2c75a3e3`
- operation: `3aff8dd7-6494-4c54-be34-dbf303af70c0`
- exact grant: `7a9ffb94-439e-4e9d-9b0b-ed4ec68d5540`
- evidence assertion: `9728a160-ea7b-4475-be28-c01a289b9956`
- resolution event: `37e21a9d-0a69-4cba-9c5c-795a493050a0`

Behavior acceptance:

- real Auth login: **PASS**;
- duplicate preview: high confidence, zero blockers, one duplicate: **PASS**;
- governed apply: **PASS**;
- operation status: `succeeded`;
- verifier status: `passed`;
- affected rows: **2**, within exact grant max rows **2**;
- exact grant status: `consumed`;
- required user capability: `manage_registry`;
- two exact Track targets each carry immutable expected-state fingerprints;
- two shared review approvals are bound to the exact grant;
- evidence trust class: `INTERNAL_FACT`;
- evidence principal: exact authenticated user;
- canonical Track remains `active`;
- duplicate Track is `archived` with exact canonical successor metadata;
- accepted Track resolution event: **present**;
- Track supersession lineage: **present and causally bound to the resolution event**;
- exactly one canonical write event is causally bound to the Registry operation;
- active Track duplicate execution grants at rest: **0**;
- succeeded-but-unverified Track duplicate operations: **0**.

### Post-behavior permanent verification

After the real authenticated mutation:

- `REGISTRY_TRACK_DUPLICATE_REPAIR_AUTHORITY_PASS`;
- `MIZIZI_SHARED_REVIEW_AUTHORITY_PASS`;
- `MIZIZI_IDENTITY_PROJECTION_LINEAGE_PASS`;
- `REGISTRY_CANONICAL_WRITER_INVENTORY_PASS`;
- Artist Studio Registry Entry Convergence verifier: **PASS**;
- Registry Chart Materialization Runtime verifier: **PASS**.

Supabase advisor comparison against Production:

- new security findings introduced by this candidate: **0**;
- Preview-only performance differences are `unused_index` INFO findings attributable to Preview usage statistics, not candidate-created schema objects.

This closes the disposable Preview behavior gate for the Track duplicate repair family. Protected repository CI on the corrected current head remains the next merge gate.
