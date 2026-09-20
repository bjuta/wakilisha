# MIZIZI Slice 3 Stage B Production Closure

Date: 20 September 2026

Status: **PRODUCTION ACCEPTED**

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Parent Slice 3 issue: #962

Runtime PR: #983

Merged main: `a2f6a960b2257c063f270a19d5d424a418cf4657`

## 1. Scope

Stage B converges MIZIZI canonical stewardship mutation authority from caller-side
direct SQL onto narrow typed exact-grant broker operations while deliberately
preserving the current JIT `postgres` transport for the separate Stage C cutover.

The accepted migration is:

`20260918173446_mizizi_stage_b_broker_convergence_v1.sql`

SHA-256:

`bb97bb9e8a2d839e627de800c83eef4711392f84fbd8c75ee00012e7ea50c057`

Stage B provides typed issuer / executor / verifier authority for:

- Track slug canonicalization;
- Release taxonomy repair;
- Release slug canonicalization;
- Chart Track-slug synchronization;
- deterministic review escalation through the existing bounded private review
  broker.

The accepted runtime removes governed caller-side mutation DML from
`scripts/registry/agents/mizizi/run.ts`. Track/Release downstream projection
repairs, canonical write-event linkage, exact grant consumption, operation
journaling, and verification execute inside the typed broker boundary.

Stage B deliberately does not:

- switch the live executor binding;
- move JIT transport from `postgres` to `mizizi_executor`;
- cut Artist-origin transport over to the narrow executor;
- seed autonomous standing or exact grants;
- enable the four stewardship operation types at rest;
- perform a historical Track/Release re-apply;
- require an Edge deployment;
- require a frontend deployment.

## 2. Repository acceptance

PR #983 merged the exact 10-file Stage B candidate as:

`a2f6a960b2257c063f270a19d5d424a418cf4657`

The protected PR head passed:

- Critical Control Plane #1349;
- MIZIZI Track Production Control Plane #59;
- MIZIZI Release Production Control Plane #37.

Local protected Critical acceptance before push passed 30 test files and 352
tests.

The generated `src/types/database.types.ts` bytes were identical to the
accepted Stage A bytes and therefore correctly remained outside the committed
diff.

The migration replay contract passed against the Preview-sealed schema baseline
and replay proof.

## 3. Disposable Preview acceptance

Disposable Preview:

`rsjcfpdzrsbbwibnmitq`

Preview branch id:

`b0fdcf16-4dcd-474e-b2e2-4c3877d0899d`

Native baseline replay reached:

- migration count: 151;
- migration head: `20260918120331`.

The dry-run exposed exactly one pending migration:

`20260918173446_mizizi_stage_b_broker_convergence_v1.sql`

That exact migration applied once.

Accepted Preview ledger:

- migration count: 152;
- migration head: `20260918173446`;
- target ledger identity: exactly once;
- post-apply pending migrations: 0.

Focused MIZIZI acceptance passed 58 / 58 tests.

The independent Stage B authority verifier passed with:

- all four typed operation types installed disabled;
- active `mizizi -> postgres` binding preserved;
- future `mizizi -> mizizi_executor` binding disabled;
- zero active standing MIZIZI grants;
- zero active exact MIZIZI grants;
- no direct governed-table INSERT / UPDATE / DELETE authority for
  `mizizi_executor`;
- exact private broker EXECUTE authority granted to `mizizi_executor`;
- no private broker EXECUTE authority for `anon`, `authenticated`, or
  `service_role`.

### Preview broker E2E

All four successful typed operations were executed through the real grant and
journal chain:

1. Track slug canonicalization;
2. Release taxonomy repair;
3. Release slug canonicalization;
4. Chart Track-slug synchronization.

Each successful operation proved:

- an exact execution grant;
- grant consumption;
- one succeeded mutation operation;
- one independent verifier PASS;
- exactly one linked canonical write event.

The failure-mode matrix proved fail-closed behavior for:

- disabled operation;
- absent standing grant;
- expired standing grant;
- expired exact grant;
- expired idempotency replay;
- target-state drift;
- missing target;
- plan/fingerprint drift;
- immutable issued-grant protection;
- row-budget overflow;
- successful idempotent replay without duplicate write-event linkage;
- idempotency-key rebinding abuse;
- verifier detection of post-execution corruption;
- deterministic review duplicate collapse;
- review fingerprint mismatch;
- review state drift;
- wrong-executor rejection.

The Preview was returned to inert state after E2E:

- enabled Stage B operations: 0;
- active MIZIZI standing grants: 0;
- active MIZIZI exact grants: 0.

The paid Preview was deleted after evidence capture.

## 4. Production SQL acceptance

Before apply, Production was proved at:

- migration count: 151;
- migration head: `20260918120331`;
- Stage B target ledger rows: 0;
- active MIZIZI standing grants: 0;
- active MIZIZI exact grants: 0.

The Production dry-run contained exactly one pending migration:

`20260918173446_mizizi_stage_b_broker_convergence_v1.sql`

The merged migration SHA-256 was re-proved as:

`bb97bb9e8a2d839e627de800c83eef4711392f84fbd8c75ee00012e7ea50c057`

That exact migration was applied once from an isolated archive of merged
`main@a2f6a960b2257c063f270a19d5d424a418cf4657`.

Accepted Production ledger:

- migration count: 152;
- migration head: `20260918173446`;
- target ledger identity: exactly once;
- post-apply pending migrations: 0.

No Edge deployment was required.

No frontend deployment was required.

No executor transport cutover occurred.

No canonical Registry or Chart data mutation occurred as part of the Production
migration.

## 5. Independent Production authority verification

Independent post-apply Production verification returned:

`MIZIZI_STAGE_B_PRODUCTION_PASS`

with:

- migration count 152;
- migration head `20260918173446`;
- active MIZIZI standing grants 0;
- active MIZIZI exact grants 0.

Independent PostgreSQL catalog and privilege verification established:

- all four Stage B operation types are disabled;
- each operation remains bounded to one target and one row;
- maximum exact-grant TTL remains 300 seconds;
- independent verification remains required;
- current `mizizi -> postgres` database-role binding remains active;
- future `mizizi -> mizizi_executor` database-role binding remains disabled;
- `mizizi_executor` has no direct governed mutation authority on canonical
  Registry, Chart, review, canonical-write-event, execution-grant, mutation
  journal, or operation/write-event linkage tables;
- `mizizi_executor` has the exact private broker EXECUTE surface required for
  the future transport cutover;
- `anon`, `authenticated`, and `service_role` cannot execute the private
  Stage B execution broker.

## 6. Closure decision

**Stage B is closed in Production as typed broker convergence.**

MIZIZI canonical stewardship mutation semantics are no longer implemented as
caller-side direct SQL in the general runner. The accepted mutation boundary is:

`standing capability -> deterministic plan -> short-lived exact grant -> typed operation -> canonical mutation -> canonical write-event linkage -> independent verifier`

The remaining legacy debt is transport, not mutation architecture.

The live JIT execution identity remains `postgres` and the active System Actor
binding remains `mizizi -> postgres` until Stage C.

Stage C is therefore a narrow transport cutover:

- grant only the exact approved broker/read surface to `mizizi_executor`;
- move the general MIZIZI runner onto the dedicated JIT executor role;
- move Artist-origin broker transport onto that role;
- switch the active System Actor executor binding from `postgres` to
  `mizizi_executor`;
- retire the ambient MIZIZI `postgres` binding;
- prove real narrow-login positive and negative execution paths;
- preserve operations disabled and standing/exact grants zero at rest unless
  explicitly activated through governed human authority.

Status receipt:

`SLICE3_MIZIZI_STAGE_B_TYPED_BROKER=PRODUCTION_ACCEPTED`
