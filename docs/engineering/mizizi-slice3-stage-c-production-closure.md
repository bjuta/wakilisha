# MIZIZI Slice 3 Stage C Production Closure

Date: 20 September 2026

Status: **PRODUCTION ACCEPTED**

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Parent Slice 3 issue: #962

Runtime PR: #985

Merged main: `c93369cfdf026f8841a2fd0d61fabbf5bda4b218`

## 1. Scope

Stage C closes the remaining MIZIZI transport debt after Stage B by moving the
live JIT database execution identity from ambient `postgres` to the dedicated
`mizizi_executor` role without widening canonical Registry mutation authority.

The accepted migration is:

`20260920095334_mizizi_stage_c_narrow_executor_transport_v1.sql`

SHA-256:

`51f1729637dc8b60542aa1191f510e44f73b1ba118aace505006412fbf7e2311`

Stage C:

- activates the `mizizi -> mizizi_executor` database-role binding;
- disables the legacy `mizizi -> postgres` binding;
- grants only the approved narrow Registry/Chart read surface;
- grants only the exact private wrapper EXECUTE surface required by MIZIZI;
- keeps `platform_private`, editorial identity data, and admin identity reads
  unavailable to `mizizi_executor`;
- keeps direct canonical Registry and Chart mutation authority unavailable to
  `mizizi_executor`;
- moves the general MIZIZI runner onto the dedicated JIT executor;
- moves Artist-origin broker transport onto that same narrow executor;
- keeps all governed MIZIZI mutation operation types disabled at rest;
- keeps active standing and exact MIZIZI grants at zero at rest.

Stage C does not:

- add autonomous standing authority;
- add long-lived exact grants;
- expose arbitrary SQL to MIZIZI;
- perform canonical Registry or Chart mutation as part of the migration;
- require an Edge Function deployment;
- require a frontend deployment;
- begin Slice 4 autonomy/runtime work.

## 2. Repository acceptance

PR #985 merged the exact 12-file Stage C candidate as:

`c93369cfdf026f8841a2fd0d61fabbf5bda4b218`

Candidate commit before squash merge:

`e32fd5ce99852e58e0792466aa1725116f32f3f1`

The protected PR head passed:

- Critical Control Plane #1353;
- MIZIZI Track Production Control Plane #60;
- MIZIZI Release Production Control Plane #38.

Local protected Critical acceptance before push passed:

- 30 test files;
- 356 tests.

Focused Stage C acceptance passed 63 / 63 tests before replay sealing.

`npm run schema:verify` passed.

`npm run build:app` passed.

`git diff --check` passed.

The generated `src/types/database.types.ts` bytes remained identical to accepted
main and correctly stayed outside the committed diff.

The migration replay contract passed against the Preview-sealed schema baseline
and exact Stage C replay proof.

## 3. Disposable Preview acceptance

Disposable Preview:

`pdeqwideogswrcxthnqr`

Preview branch id:

`7bcf2f3e-135d-4658-8bc3-51c54c9d3921`

Accepted Preview ledger:

- migration count: 153;
- migration head: `20260920095334`;
- target migration identity: exactly once;
- post-apply pending migrations: 0.

The independent permanent Stage C verifier passed with:

`MIZIZI_STAGE_C_NARROW_EXECUTOR_TRANSPORT_PASS`

The Preview proved:

- active `mizizi -> mizizi_executor` binding;
- disabled `mizizi -> postgres` binding;
- no ambient `platform_private` schema usage;
- no editorial schema usage;
- no direct admin identity reads;
- no direct UPDATE authority on canonical Tracks, Releases, Artists, or Chart
  entries;
- complete approved read surface;
- complete approved private wrapper EXECUTE surface;
- zero active MIZIZI standing grants at rest;
- zero active MIZIZI exact grants at rest.

### Real narrow-login acceptance

The real JIT/login acceptance established a true `mizizi_executor` database
session and proved:

- governed read surface succeeds;
- direct canonical Registry/Chart mutation fails closed;
- direct admin identity reads fail closed;
- ambient private-schema reads fail closed;
- MIZIZI audit runs through the narrow executor;
- one typed exact-grant mutation executes and verifies through the governed
  broker path;
- the old `postgres` MIZIZI binding is rejected after cutover.

The temporary Stage C chart, Track, capability, and execution-grant fixtures were
removed.

The disposable target account was retired through the already accepted governed
`public.retire_account_identity(...)` Data API path. That preserved append-only
Person identity history, retired the identity link with the original user UUID
snapshot, archived the Person at identity revision 3, and created the retirement
tombstone.

A Preview-only cleanup administrator remained intentionally confined to the
disposable Preview until final cleanup.

The disposable Preview was deleted only after Production SQL, permanent
verification, live Production transport smoke, and final at-rest authority
verification were complete.

## 4. Production SQL acceptance

Before apply, Production was independently proved at:

- migration count: 152;
- migration head: `20260918173446`;
- active MIZIZI standing grants: 0;
- active MIZIZI exact grants: 0;
- `mizizi -> postgres`: active;
- `mizizi -> mizizi_executor`: disabled.

Merged main was re-proved as:

`c93369cfdf026f8841a2fd0d61fabbf5bda4b218`

The merged migration SHA-256 was re-proved as:

`51f1729637dc8b60542aa1191f510e44f73b1ba118aace505006412fbf7e2311`

The Production dry-run contained exactly one pending migration:

`20260920095334_mizizi_stage_c_narrow_executor_transport_v1.sql`

That exact migration was applied once from an isolated archive of merged
`main@c93369cfdf026f8841a2fd0d61fabbf5bda4b218`.

Accepted Production ledger:

- migration count: 153;
- migration head: `20260920095334`;
- target ledger identity: exactly once;
- post-apply pending migrations: 0.

No Edge deployment was required.

No frontend deployment was required.

No canonical Registry or Chart mutation occurred as part of the Production SQL
promotion.

## 5. Independent Production authority verification

The permanent Stage C verifier returned:

`MIZIZI_STAGE_C_NARROW_EXECUTOR_TRANSPORT_PASS`

Independent Production verification established:

- migration count: 153;
- migration head: `20260920095334`;
- active MIZIZI standing grants: 0;
- active MIZIZI exact grants: 0;
- active `mizizi -> mizizi_executor` binding: exact;
- disabled `mizizi -> postgres` binding: exact;
- no `platform_private` schema usage by `mizizi_executor`;
- no editorial schema usage by `mizizi_executor`;
- no direct admin identity read authority;
- no direct canonical UPDATE authority on Registry Tracks, Releases, Artists, or
  Chart entries.

## 6. Real Production transport smoke

After SQL promotion, both accepted Production control planes were rerun in
read-only preflight mode against the live Stage C ledger.

### Track control plane

The Track control plane proved:

`PASS: Stage C ledger active; JIT transport = mizizi_executor`

`PASS: JIT mizizi_executor database session ready on attempt 1/12`

`MIZIZI PRODUCTION CONTROL-PLANE POST-APPLY PREFLIGHT PASS`

`Registry mutation: NO`

`PASS: JIT mapping restored and production temporary access disabled at rest`

### Release control plane

The Release control plane independently proved:

`PASS: Stage C ledger active; JIT transport = mizizi_executor`

`PASS: JIT mizizi_executor database session ready on attempt 1/12`

`MIZIZI RELEASE PRODUCTION CONTROL-PLANE POST-APPLY PREFLIGHT PASS`

`Registry mutation: NO`

`PASS: JIT mapping restored and production temporary access disabled at rest`

These are real Production JIT sessions, not static privilege inspection.

After both smokes, Production was independently re-sealed at:

- migration count: 153;
- migration head: `20260920095334`;
- active MIZIZI standing grants: 0;
- active MIZIZI exact grants: 0;
- active narrow executor binding: 1;
- disabled old `postgres` binding: 1.

## 7. Closure decision

**Stage C is closed in Production as narrow-executor transport convergence.**

The accepted live MIZIZI execution boundary is now:

`MIZIZI runtime -> temporary JIT access -> mizizi_executor -> exact approved read/wrapper surface -> typed governed broker -> independent verifier`

The ambient MIZIZI `postgres` transport road is retired.

This does not close Slice 3 as a whole. Parent issue #962 remains open because
its exit gate also requires retirement or fail-closure of the broader obsolete
Registry authority roads identified by the accepted retirement programme.

No Stage 4 autonomy or broader runtime expansion is authorized by this closure.

Status receipt:

`SLICE3_MIZIZI_STAGE_C_NARROW_EXECUTOR_TRANSPORT=PRODUCTION_ACCEPTED`
