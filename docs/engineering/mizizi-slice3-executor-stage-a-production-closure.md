# MIZIZI Slice 3 Stage A Production Closure

Date: 18 September 2026

Status: **PRODUCTION ACCEPTED**

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Parent Slice 3 issue: #962

Runtime PR: #981

Merged main: `5efa912f2a35e5c58817f8ee220a73c21e07b903`

## 1. Scope

Stage A establishes the inert narrow Production executor foundation required before
MIZIZI can leave its audited direct-`postgres` execution path.

It deliberately does not activate the new executor, enable the new operation
types, seed a standing capability grant, seed an exact execution grant, switch
the live runner, or mutate canonical Registry or Chart data.

The accepted migration is:

`20260918120331_mizizi_executor_foundation_v1.sql`

SHA-256:

`663755a0561abf7afb4b9e0f0c28794b8eb2a957d172863476d90d2c3f7b6ea5`

## 2. Repository acceptance

PR #981 merged the exact six-file Stage A candidate.

The protected PR head passed:

- Critical Control Plane #1345;
- MIZIZI Track Production Control Plane #58;
- MIZIZI Release Production Control Plane #36.

Local protected Critical acceptance before push also passed 30 test files and
349 tests.

The disposable Preview replay proof established:

- exact baseline replay through migration head `20260918064000`;
- exact Stage A apply at `20260918120331`;
- target migration ledger identity exactly once;
- independent Stage A verifier PASS;
- focused MIZIZI tests 55 / 55 PASS;
- migration replay contract PASS;
- zero active MIZIZI standing grants;
- zero active MIZIZI exact grants.

The paid Preview was deleted after evidence capture.

## 3. Production SQL acceptance

Production was proved at 150 migrations with head
`20260918064000` before apply.

The Production dry-run contained exactly one pending migration:

`20260918120331_mizizi_executor_foundation_v1.sql`

That exact merged migration was applied once.

Accepted Production ledger:

- migration count: 151;
- migration head: `20260918120331`;
- target ledger identity: exactly once;
- post-push pending migrations: 0.

No Edge deployment was required.

No frontend deployment was required.

No canonical data migration or canonical Registry / Chart data mutation occurred.

## 4. Independent Production authority verification

The merged read-only verifier returned:

`MIZIZI_EXECUTOR_STAGE_A_FOUNDATION_PASS`

with:

- migration count 151;
- migration head `20260918120331`;
- active MIZIZI standing grants 0;
- active MIZIZI exact grants 0.

Independent PostgreSQL catalog inspection established:

- `mizizi_executor` is LOGIN;
- SUPERUSER: no;
- CREATEDB: no;
- CREATEROLE: no;
- REPLICATION: no;
- BYPASSRLS: no;
- INHERIT: no;
- `mizizi -> mizizi_executor` database-role binding: disabled;
- existing `mizizi -> postgres` database-role binding: active;
- `registry.release_taxonomy.repair`: disabled;
- `registry.chart_track_slug.synchronize`: disabled;
- both operation types are one-target, one-row, verifier-required operations
  with a maximum exact-grant TTL of 300 seconds;
- direct INSERT / UPDATE / DELETE authority is absent on governed Registry,
  Chart, review-queue, and execution-grant tables;
- `mizizi_executor` has the exact `mizizi_private` broker EXECUTE surface;
- `anon`, `authenticated`, and `service_role` do not have EXECUTE on those
  private broker functions.

The authenticated Stage A admin control RPCs remain internally gated by a
signed-in caller and the existing `manage_registry` capability.

## 5. Closure decision

**Stage A is closed in Production as an inert executor foundation.**

The accepted state does not authorize autonomous MIZIZI mutation.

The live MIZIZI execution path remains on the previously audited
`database_role=postgres` binding until a separate convergence gate proves the
narrow transport and typed operation path end to end.

The next implementation boundary is therefore transport/runtime convergence:
remove remaining ambient direct-`postgres` mutation roads from the MIZIZI
runner and related broker execution paths only after the narrow executor path,
exact grants, typed operations, verification, replay, and failure modes are
proved under their own protected acceptance gate.

Status receipt:

`SLICE3_MIZIZI_EXECUTOR_STAGE_A=PRODUCTION_ACCEPTED`
