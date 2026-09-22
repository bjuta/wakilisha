# MIZIZI Slice 3 Tranche B — Track Duplicate Repair Exact Authority

Date: **22 September 2026**

Status: **IMPLEMENTATION CONTRACT FROZEN — MIGRATION NOT YET CREATED**

Programme issue: **#962 — MIZIZI Slice 3: Obsolete Authority Retirement & Bypass Closure**

Working branch:

`fix/mizizi-slice3-tranche-b-track-duplicate-authority`

Entry protected main:

`8b3ac9fad3f804001c1612b2ff66cb6511c675c4`

Production project:

`pgzizndxdyhqmtyywjmt`

Production migration authority at entry:

`168 / 20260921171000_registry_chart_artist_resolution_rebase_v1.sql`

## 1. Why this candidate exists

The accepted 21 September stale-contract audit classifies:

`public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)`

as:

**CURRENT HIGH-BLAST / INTERNALIZE**

The mature repair behavior remains legitimate. The authority shape does not.

The current public SECURITY DEFINER function directly mutates multiple canonical and projection relations. Slice 3 Tranche B must put exact reviewed authority around that mature implementation without rewriting it into a speculative generic framework.

## 2. Current deployed authority evidence

Current repository product caller:

`src/pages/admin/relationships/duplicates/page.tsx`

The product uses:

- `admin_get_registry_track_duplicate_audit`;
- `admin_preview_registry_track_duplicate_repair`;
- `admin_apply_registry_track_duplicate_repair`.

The product applies one candidate per RPC, including bulk mode, which iterates the same one-candidate apply command.

Current Production execution boundary for the mutator:

- owner: `postgres`;
- SECURITY DEFINER: yes;
- `anon` EXECUTE: no;
- `authenticated` EXECUTE: yes;
- `service_role` EXECUTE: yes.

No current database-function caller was found wrapping the apply function.

PostgreSQL function-call counters are unavailable because Production has `track_functions=none`. Therefore function statistics must not be represented as traffic proof.

## 3. Mature engine scope — preserve, do not redesign

The deployed algorithm currently reconciles or moves:

- Chart canonical Track projection;
- Track provider links;
- Track↔Artist credits;
- Release↔Track memberships;
- canonical Track presentation fields when absent;
- duplicate Track lifecycle;
- `registry_track_resolution_events`.

The algorithm already performs the domain-specific collision/archive/move decisions required by the product preview contract.

Tranche B must **not** decompose this mature algorithm into generic membership operations merely to make the implementation aesthetically uniform.

## 4. Historical and current blast evidence

Accepted historical duplicate-repair authority:

- successful repair events: **56**;
- historical duplicate source identities: **196**;
- matching current Track supersession lineage: **196 / 196**;
- largest historical repair: **10 duplicate Tracks**;
- largest recorded historical repair row budget from result counters: **24**.

Current Production audit surface:

- current duplicate candidates: **53**;
- largest current candidate: **3 Tracks**;
- largest current duplicate set: **2 Tracks**;
- current candidates above 16 Tracks: **0**.

Conservative current candidate fan-out maximum:

- Chart rows: **18**;
- provider-link rows: **1**;
- Release↔Track rows: **2**;
- Track↔Artist rows: **6**;
- Tracks in candidate: **3**;
- conservative aggregate: **29 rows**.

Typed operation hard ceiling:

- `max_targets = 16`;
- `max_rows_ceiling = 64`;
- `max_grant_ttl_seconds = 300`.

These are fail-closed operation-type ceilings, not ambient permission to mutate that many rows.

Each exact grant must use the candidate preview to freeze its own smaller exact target set and exact row budget. A repair whose frozen plan exceeds the hard ceiling must stop before execution.

## 5. Existing primitives to reuse unchanged

Kernel delta for this candidate is:

`0`

The implementation must compose the currently accepted shared authority:

- `public.capability_definitions`;
- `platform_private.system_actors`;
- `platform_private.system_actor_executor_bindings`;
- `platform_private.registry_operation_types`;
- `platform_private.registry_evidence_assertions`;
- `platform_private.registry_execution_grants`;
- `platform_private.registry_execution_grant_targets`;
- `platform_private.registry_review_cases`;
- `platform_private.registry_review_events`;
- `platform_private.registry_mutation_operations`;
- `platform_private.registry_operation_write_events`;
- `platform_private.registry_plan_fingerprint(jsonb)`;
- `platform_private.registry_subject_state_fingerprint(text,uuid)`;
- `platform_private.registry_execution_target_set_fingerprint(uuid)`;
- `platform_private.registry_execution_grant_has_current_authority(uuid)`;
- `platform_private.begin_registry_mutation_operation(text,uuid)`;
- shared exact-grant review sealing and deferred review-authority guards.

No new generic review, evidence, grant, journal, lineage, or approval relation is permitted in this candidate.

## 6. Dedicated typed authority

The domain adapter will use:

- broker actor: `registry_track_duplicate_admin`;
- typed capability: `repair_registry_track_duplicate`;
- operation: `registry.track.duplicate_repair/v1`;
- risk: `critical`;
- allowed subject type: `track`;
- required human capability: `manage_registry`;
- authority mode: human exact grant;
- policy ruleset: `registry-track-duplicate-repair-v1`;
- executor binding: `authenticator`.

The new capability names the exact operation. It does not replace `manage_registry` authorization.

## 7. Product API contract

The existing public signature remains:

`public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)`

No frontend caller rewrite is required merely to converge authority.

The public function becomes a thin governed command that:

1. verifies the authenticated `manage_registry` caller;
2. normalizes canonical/duplicate Track identity;
3. calls the existing preview;
4. rejects blocker/unsupported confidence state exactly as today;
5. freezes immutable evidence and the reviewed repair plan;
6. issues one short-lived exact human grant;
7. relies on the accepted shared review trigger to seal approved review authority for every exact Track target;
8. executes the private mature engine through the operation journal;
9. runs the independent verifier;
10. returns the existing repair result plus durable operation identity.

Bulk UI behavior remains candidate-by-candidate and therefore grant-by-grant.

## 8. Internalization strategy

The current mature mutation function must not be manually copied/reimplemented.

The forward migration will move the existing function into `platform_private` and rename it as the dedicated V1 engine, preserving the mature implementation while removing product execution authority.

Conceptually:

```text
public.admin_apply_registry_track_duplicate_repair(...)
        |
        | forward ALTER SET SCHEMA + RENAME
        v
platform_private.apply_registry_track_duplicate_repair_engine_v1(...)
```

A new public function with the original signature then becomes the governed wrapper.

The private engine must have all direct execution revoked from:

- `PUBLIC`;
- `anon`;
- `authenticated`;
- `service_role`.

The public governed command must be executable only by the intended authenticated product client, with its internal capability check retained.

## 9. Immutable plan and concurrency authority

Generic target fingerprints remain owned by the shared kernel.

Each exact Track target must be inserted into `registry_execution_grant_targets` with the current generic `registry_subject_state_fingerprint('track', id)`.

Duplicate repair depends on related state beyond the Track row, so this candidate also earns one **domain-specific composite state fingerprint**, not a generic kernel change.

The composite duplicate-repair state must deterministically include the exact target Track plus the related current state that can alter repair behavior:

- relevant Track row identity/lifecycle/current fields;
- provider-link set;
- non-archived Track↔Artist credit set;
- non-archived Release↔Track membership set;
- Chart rows referencing the Track ID or current slug.

The immutable plan stores the composite fingerprint for every exact Track target.

Immediately before executing the private engine, the governed executor must recompute every composite fingerprint and fail closed if any target or related state changed after grant issuance.

## 10. Evidence and shared review authority

One caller-bound INTERNAL_FACT evidence assertion freezes the repair candidate.

The evidence/plan must include at minimum:

- canonical Track ID;
- sorted duplicate Track IDs;
- frozen preview;
- confidence bucket;
- note;
- whether medium confidence was explicitly allowed;
- exact target state/composite fingerprints;
- exact expected row budget;
- policy ruleset version.

The exact grant plan must include:

- evidence assertion ID;
- evidence assertion fingerprint;
- trust class;
- operation key/version;
- canonical Track ID;
- duplicate Track IDs;
- frozen preview or its exact fingerprint;
- per-target composite state authority;
- exact row budget.

Because the operation requires human approval, inserting the exact grant targets must reuse `registry_execution_grant_target_review_seal`.

That accepted shared trigger creates/ensures the shared review case and records the approved decision causally bound to the exact grant.

No Track-duplicate-specific review table is needed or allowed.

## 11. Row budget

The wrapper derives the exact candidate budget from the frozen preview.

Expected mutation accounting includes:

- Chart rows moved;
- provider links moved;
- Release↔Track rows moved;
- Release↔Track rows archived;
- Track↔Artist credits moved;
- Track↔Artist credits archived;
- duplicate Tracks archived;
- one canonical Track row update.

The exact grant `max_rows` is the frozen candidate budget.

The executor must compare the mature engine's result counters against the grant budget and fail if actual affected rows exceed the exact grant or the typed-operation ceiling.

## 12. Operation journal and event preservation

The governed executor must call:

`platform_private.begin_registry_mutation_operation('registry_track_duplicate_admin', grant_id)`

The mature engine must continue emitting the accepted:

`public.registry_track_resolution_events.action = 'track_duplicate_repair'`

event contract unchanged.

The governed executor additionally records one summary canonical write event and links it through `platform_private.registry_operation_write_events`, making the high-blast repair causally visible in the accepted operation journal.

The summary journal event does not replace or rewrite the domain resolution event.

## 13. Independent verifier

Success cannot be declared by the mutation engine itself.

The independent verifier must prove, from persisted state and the frozen plan:

- operation actor/key/version/capability are exact;
- operation succeeded;
- affected rows do not exceed the exact grant;
- the journal has the expected linked write evidence;
- one successful `track_duplicate_repair` resolution event matches the exact canonical Track and duplicate set;
- canonical Track remains present and non-archived;
- every duplicate Track is archived and identifies the canonical successor;
- no provider link remains on any duplicate Track;
- no non-archived Track↔Artist credit remains on a duplicate Track;
- no non-archived Release↔Track membership remains on a duplicate Track;
- no Chart row remains addressed by a duplicate Track ID or duplicate Track slug;
- current Track supersession lineage exists for every exact duplicate source identity and points to the canonical Track.

## 14. Chart identity postcondition

Tranche A explicitly superseded the stale assumption that `wk_chart_entries_v2.canonical_artist_id` is current Artist identity authority.

Current Artist identity is derived from:

```text
canonical Track
→ exactly one non-archived primary Track↔Artist credit
```

Therefore this candidate must **not** reopen `canonical_artist_id` as mutation authority.

After duplicate repair:

- all affected Chart rows must resolve to the canonical Track ID/slug;
- where the canonical Track has a current primary Artist identity, it must be exactly one non-archived primary credit;
- the verifier must use the canonical credit model, not a null/non-null Chart projection field, to determine current Artist identity.

Chart projection remains rebuildable. This candidate does not silently add an unrelated Artist-resolution write path to the mature Track duplicate engine.

## 15. Permanent negative contract

The permanent verifier must mechanically reject:

- direct `anon`, `authenticated`, or `service_role` execution of the private engine;
- `anon` or `service_role` execution of the public governed command;
- loss of authenticated product execution of the public command;
- a public wrapper that directly performs the mature multi-table DML instead of delegating through exact grant/execution/verifier authority;
- a private engine that becomes product executable;
- operation type drift outside the frozen critical/16-target/64-row/300-second envelope;
- a grant lacking `manage_registry` human authority;
- a grant missing exact target fingerprints, immutable evidence, or shared review causality;
- repair success without independent verifier PASS;
- repair success that loses the existing Track resolution-event/identity-lineage contract.

The existing final Registry canonical writer inventory must also be updated so the public wrapper is classified as converged and the private engine is not treated as a client-callable alternate road.

## 16. Replay and deployment path

This candidate changes database authority and requires a new forward migration.

The migration filename must be created through:

`supabase migration new registry_track_duplicate_repair_authority_v1`

No migration timestamp is to be invented manually.

After implementation:

1. static/focused repository contracts;
2. clean disposable Preview from exact current Production/main baseline;
3. canonical repository migration replay in the generated migration order;
4. permanent Track duplicate authority verifier;
5. permanent Identity + Projection Lineage verifier;
6. permanent shared-review verifier;
7. canonical writer inventory verifier;
8. real authenticated Admin client behavior on a rollback/disposable fixture;
9. adversarial direct-engine execution denial;
10. exact grants return to zero at rest;
11. schema generation/seal only from accepted replay authority;
12. protected CI;
13. PR;
14. merge;
15. Production SQL promotion from exact merged main using the repository-native promotion workflow;
16. independent Production verifiers;
17. frontend deployment only if runtime frontend bytes changed;
18. disposable Preview cleanup;
19. dated Tranche B Track duplicate closure record before advancing to Artist decouple.

## 17. Current deployment classification

This design checkpoint itself mutates no runtime.

- SQL migration needed: **Yes — candidate not yet created**
- Supabase Edge Function deploy needed: **No**
- frontend deploy needed: **No expected product-caller change**
- Production Finish needed: **No**
- Production mutation authorized now: **No**
- PR needed now: **No**
- next gate: **generate the forward migration filename, implement the frozen candidate, then clean Preview replay and behavior acceptance**
