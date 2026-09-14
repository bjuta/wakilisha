# MIZIZI Slice 2 Governance Foundation — Production Closure

Date: 14 September 2026

Status: **PRODUCTION ACCEPTED — FOUNDATION SUBSTEP CLOSED**

Programme authority:

- `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`
- Slice 2 — Governance Primitive Convergence

Implementation authority:

- PR #933 — `feat: establish inert MIZIZI Registry governance primitives`
- merged main: `cf886c6963ca32bbcc94c9331c18fea52e96d0a8`

This record closes only the inert governance-foundation substep of Slice 2.
It does **not** declare Slice 2 complete and does not authorize obsolete-writer retirement.

## What entered Production

Exactly two repository migrations were promoted from exact merged `main`:

1. `20260914180500_mizizi_registry_governance_primitive_foundation.sql`
   - SHA-256: `1519cdfa3e5a69e829aaa6e141776b107798b7118e4d0e798ccf008c93e7d6cd`
2. `20260914180600_mizizi_registry_execution_target_integrity.sql`
   - SHA-256: `2a102588b1cc07dcdbbda1f916f740547b6b5969f7bd63438cdde8bb897ad468`

Production migration authority advanced from:

- `117 / 20260914080000`

to:

- `119 / 20260914180600`

The post-promotion repository migration-history verifier reported:

- all 119 Production migration versions exist locally at the same timestamps;
- repository migration history is fully applied to Production;
- `supabase db push --dry-run` succeeds;
- no pending migrations remain;
- no history repair, `db pull`, timestamp aliasing, or Production ledger rewrite is required.

## Preview replay authority

Accepted disposable preview:

- project ref: `pwbpyfzkyzdigwajvmet`
- branch id: `9bb6288e-7631-4d2e-879b-f7c85528258e`
- accepted migration count/head: `119 / 20260914180600`
- base main: `d4e18e2fbdc6f4c1b2218a9b7aa071ecafea18a3`
- generated `public,editorial` types SHA-256: `0ba373e7ca43a3ec42642f7dea419f453eba4418ebd94acd063ff820808a5d7b`

Canonical replay receipts:

- `docs/engineering/replay-proofs/20260914180500_mizizi_registry_governance_primitive_foundation.sql.json`
- `docs/engineering/replay-proofs/20260914180600_mizizi_registry_execution_target_integrity.sql.json`

The repository replay contract passed for both active migration changes and the repository schema snapshot matched exactly 119 active migrations at the candidate head.

The paid preview branch was deleted after exact merged bytes were promoted and independently accepted in Production.

## Protected merge gate

Critical Control Plane run:

- run id: `34864998341`
- run number: `1236`
- result: **SUCCESS**

Relevant gates all passed, including:

- real-browser interaction acceptance;
- migration replay contract enforcement;
- replay-contract self-tests;
- primitive compounding contract;
- retained Phase 7A / Phase 7B authority contracts;
- Supabase control-plane access;
- critical security and lifecycle tests;
- public configuration and anonymous-authority boundaries;
- live schema and migration-history drift detection;
- application build.

## Independent Production acceptance

After Production promotion, direct read-only verification proved:

### Migration authority

- migration count: `119`
- migration head: `20260914180600`

### Foundation structure

All six expected private governance tables exist:

- `platform_private.system_actor_capability_grants`
- `platform_private.registry_operation_types`
- `platform_private.registry_execution_grants`
- `platform_private.registry_execution_grant_targets`
- `platform_private.registry_mutation_operations`
- `platform_private.registry_operation_write_events`

All five expected internal functions exist:

- `platform_private.registry_plan_fingerprint(jsonb)`
- `platform_private.registry_subject_exists(text,uuid)`
- `platform_private.registry_subject_state_fingerprint(text,uuid)`
- `platform_private.registry_execution_target_set_fingerprint(uuid)`
- `platform_private.begin_registry_mutation_operation(text,uuid)`

All five execution-integrity trigger guards are present exactly once.

### Inertness

Production contains:

- System Actor capability grants: `0`
- Registry operation types: `0`
- Registry execution grants: `0`
- Registry mutation operations: `0`
- Registry operation/write-event links: `0`

Therefore the foundation adds no active autonomous mutation capability by itself.

### Existing MIZIZI executor authority

The pre-existing executor binding remains exactly one active row:

- actor: `mizizi`
- executor kind: `database_role`
- executor key: `postgres`

This binding remains explicitly classified as convergence debt. The foundation did not broaden or replace it yet.

### Direct privilege boundary

`anon`, `authenticated`, and `service_role` have no direct `SELECT, INSERT, UPDATE, DELETE` authority over:

- `platform_private.registry_execution_grants`
- `platform_private.registry_mutation_operations`

Those roles also have no `EXECUTE` authority on:

- `platform_private.begin_registry_mutation_operation(text,uuid)`
- `platform_private.registry_subject_state_fingerprint(text,uuid)`

The broker boundary therefore remains private and inert.

## What this foundation intentionally does not do

It does not:

- grant MIZIZI any Registry capability;
- register any executable Registry operation type;
- switch any live writer to the new boundary;
- retire `scrape-artist-data` or any other writer;
- remove the existing MIZIZI `postgres` executor binding;
- create generic SQL execution authority;
- grant browser or `service_role` direct mutation access to the private execution layer;
- mutate canonical Artist, Track, Release, membership, credit, or Registry relationship state.

## Architectural conclusion

The Production system now has a versioned, typed, exact-grant execution foundation that can bind:

- actor;
- canonical capability;
- operation type/version;
- plan fingerprint;
- exact target set;
- optional target-state fingerprints;
- row budget;
- expiry;
- issuer;
- idempotency;
- operation journal;
- canonical write-event causality.

The foundation is deliberately unusable until a real operation type and standing capability grant are introduced through a separately accepted slice.

This preserves the programme premise:

> **Assume MIZIZI's reasoning can be completely compromised. Production must still remain bounded.**

## Next bounded Slice 2 step

The next work item is not broad endpoint hardening and not writer retirement.

It is to select one existing legitimate Registry mutation capability and prove the first complete brokered path:

1. exact operation semantics and subject/target contract;
2. fine-grained capability requirement using the existing canonical capability registry;
3. deterministic admission policy;
4. exact short-lived execution-grant issuance;
5. dedicated capability-broker executor with no generic SQL surface;
6. operation journal creation and grant consumption;
7. canonical mutation through the typed operation only;
8. write-event linkage and independent verification;
9. stale-target / plan-drift / replay / over-budget / unauthorized-principal rejection;
10. kill-switch and bounded-failure behavior;
11. Preview acceptance, Production promotion, and independent post-promotion verification;
12. only after proof, converge the selected legacy writer onto that path.

No Slice 3 retirement work begins before this path is proven.
