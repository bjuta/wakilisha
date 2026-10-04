# MIZIZI Slice 4 opening runtime authority freeze — 2026-10-04

Status: **OPENING AUDIT / DESIGN FREEZE**

Parent issue: **#991 — MIZIZI Slice 4: Stewardship Runtime Foundation**

## Exact baseline

This freeze is based on exact protected main and live Production authority, not the historical September opening baseline.

- protected `main`: `064201412855797f4f19006dd67f1e66e78274d9`
- Production migrations: **204**
- migration head: `20261004153723_discography_selective_provider_discovery_v1`
- active MIZIZI capability grants: **0**
- unexpired MIZIZI execution grants: **0**
- all active/unconsumed Registry execution grants: **0**
- autonomous MIZIZI cron jobs: **0**

The owner-overridden real-creator cohort gate #1118 is not treated as accepted evidence.

## Current runtime architecture

The accepted execution substrate already exists and must be preserved.

### MIZIZI reasoning / runner

Current repository entrypoints:

- `scripts/registry/agents/mizizi/run.ts`
- `scripts/registry/agents/mizizi/artist-origin-broker.ts`

The main runner supports explicit `audit`, `review`, and `apply` modes. Apply requires the explicit `MIZIZI_APPLY` confirmation contract.

The runner does not directly write canonical Registry tables or the exact-grant/journal tables. Consequential writes pass through typed broker RPCs that:

1. issue an exact execution grant;
2. execute one typed operation;
3. record the durable operation;
4. require verifier success.

### JIT executor

The current database executor binding is:

- actor: `mizizi`
- executor kind: `database_role`
- executor: `mizizi_executor`
- binding status: `active`

Current `mizizi_executor` role properties:

- LOGIN: yes
- SUPERUSER: no
- INHERIT: no
- CREATEDB: no
- CREATEROLE: no
- REPLICATION: no
- BYPASSRLS: no
- role memberships: none

The Stage-C transport helper verifies the exact binding, rejects fallback to the old `postgres` road, opens JIT access only for the bounded session, and restores temporary access to disabled at rest.

JIT readiness retries are bounded. Connection, query, and statement timeouts are explicit.

## Existing deterministic mutation controls

Production already has:

- `platform_private.system_actor_capability_grants`
- `platform_private.registry_operation_types`
- `platform_private.registry_execution_grants`
- `platform_private.registry_execution_grant_targets`
- `platform_private.registry_mutation_operations`
- canonical/write-event linkage
- operation-specific deterministic verifiers
- Stage-C JIT `mizizi_executor` transport

Enabled Registry operation types already carry bounded per-operation controls including:

- operation key/version;
- verifier requirement;
- human-approval requirement where applicable;
- maximum rows ceiling;
- maximum execution-grant TTL.

The fact that an operation type is enabled is not standing MIZIZI authority. MIZIZI currently has zero active capability grants.

## Current zero-authority-at-rest proof

Fresh Production audit:

- active MIZIZI capability grants: **0**
- unexpired MIZIZI execution grants: **0**
- active/unconsumed Registry execution grants: **0**
- autonomous MIZIZI cron jobs: **0**

No always-on `mizizi-*` Edge Function exists.

## Existing runtime controls that are already sufficient

Do not rebuild:

- exact target binding;
- expected state / plan fingerprint binding;
- execution-grant expiry;
- per-operation row ceilings;
- idempotency;
- typed broker boundary;
- operation journal;
- independent verifier;
- Stage-C JIT database executor;
- JIT access disabled at rest;
- bounded JIT/read-only retry budgets;
- explicit apply confirmation;
- reviewed operation authority.

## Material Slice 4 gap

The opening audit found no existing durable runtime-policy authority for cross-operation autonomous controls.

The following are not currently first-class machine-readable runtime policy:

- operator-owned global autonomous-execution kill switch;
- per-capability autonomous daily mutation budget;
- per-capability/run rate ceiling;
- per-target/entity cooldown where required;
- autonomous error-rate halt;
- bounded autonomous retry accounting across operations/runs;
- deterministic policy revision/fingerprint bound into autonomous execution;
- durable operator-visible runtime halt reason / last transition receipt.

This is the smallest material Slice 4 gap.

It is distinct from:

- operation-type enablement;
- standing capability grants;
- exact execution grants;
- message policies;
- JIT executor activation.

None of those should be overloaded into a generic runtime policy store.

## Candidate architecture

The first implementation candidate should add one narrow private runtime-policy boundary for the `mizizi` actor, with deterministic gateway evaluation before any autonomous exact grant may be issued.

The policy must be operator-owned and non-self-modifiable by MIZIZI.

At minimum freeze:

- actor key;
- policy revision;
- autonomous execution enabled/disabled;
- global kill-switch state;
- per-capability daily row/entity budget;
- per-capability rate/run ceiling;
- cooldown policy where applicable;
- maximum autonomous retries;
- error-rate halt threshold/window;
- policy effective/expiry times where applicable;
- operator principal and reason;
- immutable transition/audit receipt.

The deterministic policy gateway must combine:

1. system actor state;
2. runtime policy state;
3. capability grant;
4. operation type;
5. exact candidate/plan;
6. current daily/rate/error counters;
7. execution-grant constraints.

Model output may recommend an action. It may not create, widen, enable, or override policy.

## Kill-switch rule

The kill switch must be external to MIZIZI cooperation.

When disabled:

- autonomous exact-grant issuance fails closed;
- already-expired/revoked grants remain unusable;
- no new JIT mutation session may be opened for autonomous execution;
- human-reviewed product/admin operations that do not rely on MIZIZI autonomous authority must remain unaffected unless separately configured.

The kill switch must not depend on deleting credentials or editing source code.

## No new runtime / no new agent

Slice 4 must not create:

- a second MIZIZI agent;
- an always-on mutation Edge Function;
- generic SQL execution;
- a universal policy engine;
- a second operation journal;
- a second exact-grant system;
- standing Production mutation authority.

The existing MIZIZI runner + Stage-C executor + typed broker substrate remains canonical.

## Credentials, egress, process, and memory boundary

Current runner evidence shows:

- Production DB access is obtained through the controlled JIT helper;
- the JIT helper itself calls the Supabase management API and may spawn bounded child processes required for control-plane execution;
- the main MIZIZI steward runner has no independent web/provider-fetch loop in its canonical mutation path;
- provider/web/user content may enter through evidence/finding payloads and must remain data, never authority;
- no autonomous cron currently starts the runner;
- no durable reasoning-memory authority was found in the live runtime audit.

Slice 4 must keep credentials outside model-controlled payloads and must not introduce unrestricted network/process/filesystem authority.

## First implementation tranche

Proceed with one coherent runtime-foundation tranche only:

1. private runtime policy + transition/audit authority;
2. deterministic pre-grant policy evaluator;
3. counter/budget accounting derived from durable operation history where possible rather than a parallel mutable counter ledger;
4. explicit kill-switch enforcement;
5. bounded retry/error-rate halt semantics;
6. operator read/control surface only if existing Admin surfaces cannot express the policy safely;
7. permanent deterministic verifier and adversarial tests.

Do not expand autonomous claim families in this tranche.

## Acceptance requirements

Before any autonomy expansion, prove adversarially that a compromised reasoning process cannot exceed:

- disabled kill switch;
- ungranted capability;
- daily budget;
- rate ceiling;
- cooldown;
- retry budget;
- error-rate halt;
- target set;
- expected state;
- row ceiling;
- expiry;
- verifier requirement.

Also prove:

- no standing MIZIZI authority at rest after acceptance;
- JIT transport returns to disabled-at-rest;
- no generic SQL surface exists;
- human-reviewed non-autonomous operations keep their existing semantics;
- policy transitions are durable and attributable;
- stale policy revision/replay fails closed.

## Deployment classification

This document authorizes **design freeze only**.

- Production mutation now: **No**
- autonomous execution now: **No**
- SQL migration now: **No, until this freeze is reviewed/merged**
- Edge Function deploy now: **No**
- frontend deploy now: **No**
- next step after merge: **smallest runtime-policy schema/control-plane candidate**
