# MIZIZI Slice 3 Tranche B — Track Duplicate Repair Production Closure

## Current-state amendment — 22 September 2026

This record remains the accepted Production closure for the Track duplicate component of Tranche B. It does **not** define the remaining Tranche B work as separate per-function families. Current authority is `docs/engineering/mizizi-slice3-tranche-b-high-blast-convergence-design.md` and draft PR #1011: Artist decouple, safe Artist merge, old manual Artist merge retirement, final verifier consolidation, one clean Preview cycle, and one remaining Tranche B Production closure execute as one coherent rollback boundary.

Date: **22 September 2026**

Status: **PRODUCTION ACCEPTED — bounded Track duplicate family closure**

Programme issue: **#962 MIZIZI Slice 3: Obsolete Authority Retirement & Bypass Closure**

Implementation PR: **#1008**

Accepted merged implementation main:

```text
6c858b7e7151f9d6cf6998b8237d9844fbbff1e7
```

This record closes only the Track duplicate repair family inside Tranche B.
It does **not** close #962 or the remaining Artist high-blast authority work.

## Accepted authority

The existing public product signature remains:

`public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)`

The mature repair implementation is internalized as:

`platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)`

Accepted typed authority:

- broker actor: `registry_track_duplicate_admin`;
- capability: `repair_registry_track_duplicate`;
- operation: `registry.track.duplicate_repair/v1`;
- required human capability: `manage_registry`;
- risk class: **critical**;
- maximum exact targets: **16**;
- maximum row ceiling: **64**;
- grant TTL ceiling: **300 seconds**;
- human approval: **required**;
- independent verifier: **required**.

The shared evidence/review/exact-grant/journal/lineage kernel was reused with
no new generic governance substrate.

## Mature-engine preservation

The accepted mature engine body SHA-256 remains:

```text
ff7ec6d997671e5f27ed2056149e56e4c913284f911e0eb943532f750e39c0e7
```

Both migration and permanent verifier require that seal, proving that the
high-blast migration moved the accepted repair algorithm behind governed exact
authority rather than rewriting the algorithm.

## Preview and product-path acceptance

Fresh corrected Preview R2:

```text
branch=slice3-tranche-b-track-duplicate-authority-r2
project_ref=brtthfzdznfsgzrrlqdv
branch_id=0b7a1052-ae96-41af-8d88-f2ee77e90959
```

The exact Production baseline replayed cleanly before candidate application.
The repository-native migration path then produced:

```text
migration_count=169
migration_head=20260922054353_registry_track_duplicate_repair_authority_v1
pending_after_apply=0
```

Real Supabase Auth -> Data API acceptance passed through the public governed
RPC with evidence, approved review, exact grant, execution journal, verifier,
and lineage outcomes present.

The first real-client attempt had correctly exposed an immutable-grant adapter
defect. The smallest correction precomputed the final target-set fingerprint
before immutable grant insertion. The shared kernel was not weakened or
changed.

## Protected implementation CI

Accepted protected #1008 workflow state before merge:

```text
MIZIZI Track Production Control Plane = SUCCESS
MIZIZI Release Production Control Plane = SUCCESS
Critical Control Plane = SUCCESS
```

The Critical workflow's first post-bookkeeping run encountered one transient
second Supabase dry-run invocation after an identical dry-run had already
passed. Only the failed workflow jobs were rerun on the unchanged commit, and
the complete Critical control plane then passed.

## Production SQL promotion

The canonical repository migration promotion ran from exact merged main.

Applied migration:

```text
20260922054353_registry_track_duplicate_repair_authority_v1.sql
```

Accepted Production ledger:

```text
project_ref=pgzizndxdyhqmtyywjmt
migration_count=169
migration_head=20260922054353
pending_repository_migrations=0
```

The post-apply repository verification proved:

- all 169 Production migration versions exist locally at the same timestamps;
- repository migration history is fully applied;
- native Supabase dry-run reports no pending migrations;
- no repair, `db pull`, or Production history rewriting is required;
- committed `public,editorial` types match Production.

## Independent Production verification

Permanent Production verifiers:

```text
REGISTRY_TRACK_DUPLICATE_REPAIR_AUTHORITY_PASS
MIZIZI_SHARED_REVIEW_AUTHORITY_PASS
MIZIZI_IDENTITY_PROJECTION_LINEAGE_PASS
REGISTRY_CANONICAL_WRITER_INVENTORY_PASS
```

The Track duplicate verifier mechanically covers:

- exact typed actor/capability/operation envelope;
- public RPC grant boundary;
- no `anon`, `authenticated`, or `service_role` execution of private
  engine/helpers;
- no direct canonical Registry DML regained by the public wrapper;
- mature engine body seal;
- stale-state lock/recheck contract;
- exact and outer row budgets;
- accepted resolution-event semantics;
- duplicate lifecycle convergence;
- provider-link, credit, membership, and Chart projection postconditions;
- canonical primary-Artist identity unambiguity;
- Track supersession lineage parity;
- operation/write-event causality;
- zero active Track duplicate exact grants at rest;
- zero succeeded Track duplicate operations lacking verifier PASS.

## Production schema reconciliation

The generated type bytes remain unchanged:

```text
types_sha256=472186569827cdfe3d5a72b46a546db605839934abeaa8028d9e3233f911dc46
```

After Production promotion and type equality passed, the repository schema seal
is reconciled from Preview metadata to:

```text
schema_seal_mode=production
schema_source_project_ref=pgzizndxdyhqmtyywjmt
schema_migration_count=169
schema_migration_head=20260922054353
```

This reconciliation is metadata-only. It does not apply another migration or
change generated type bytes.

## Disposable Preview cleanup

After durable Production ledger and permanent verifier acceptance, R2 was
deleted:

```text
project_ref=brtthfzdznfsgzrrlqdv
branch_id=0b7a1052-ae96-41af-8d88-f2ee77e90959
delete=PASS
```

Supabase branch inventory now contains only the default Production branch.

## Remaining Slice 3 boundary

#962 remains **OPEN**.

The next Tranche B family is **Artist decouple exact reviewed authority**.

Current accepted planning authority requires that family to:

- preserve reviewed Artist-decouple decision semantics;
- bind execution to exact frozen replacements and current state;
- internalize the lower-level mature Artist decouple mutator;
- preserve the accepted Artist split event/identity-lineage contract;
- independently verify resulting Track and Release Artist credits;
- independently verify current Chart projection against canonical credits.

Later Tranche B work still includes safe Artist merge containment and bounded
retirement of the old manual Artist merge after dependency/traffic proof.

## Final deployment classification

- SQL migration needed: **No — Track duplicate Production SQL is accepted**
- Supabase Edge Function deploy needed: **No**
- Production Finish update needed: **No**
- frontend deploy needed: **No**
- Production data mutation: **No additional mutation**
- disposable Preview: **Deleted**
- PR needed: **Yes — this bounded closure/schema reconciliation PR**
