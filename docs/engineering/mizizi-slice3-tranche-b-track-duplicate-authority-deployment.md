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
