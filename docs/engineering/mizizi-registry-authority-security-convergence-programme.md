# MIZIZI Registry Authority, Security, and Primitive Convergence Programme

> **21 September 2026 current checkpoint:** the last runtime-bearing merged main and deployed frontend authority is `dcdbe948b6dc5edc2cd31133939e45e152db7b57`; Production is `ACTIVE_HEALTHY` / `FUNCTIONS_DEPLOYED` at 166 migrations with head `20260921153000_registry_track_intake_legacy_writer_retirement_v1`. Track Intake create/enrichment is Production accepted through PR #1001. Slice 3 remains the active boundary with 11 machine-classified convergence/retirement entries; Slice 4 #991 remains blocked. The exact next-five queue is maintained in `docs/engineering/mizizi-slice3-current-database-authority-convergence.md`.
>
> **20 September 2026 programme correction:** Slices 1 and 2 remain Production accepted. Slice 3 retirement and MIZIZI executor convergence are accepted, but Slice 3 is reopened after a complete live-writer audit found three service-role Edge canonical writers plus additional authenticated `SECURITY DEFINER` canonical writers not completely represented in the machine privileged-writer manifest. Slice 4 #991 is blocked.

Date: 14 September 2026

Status: **Architectural authority. Slices 1 and 2 are Production accepted. Slice 3 is reopened for final live-writer convergence. Slice 4 is blocked.**

Last runtime-bearing repository authority / deployed frontend: `main@dcdbe948b6dc5edc2cd31133939e45e152db7b57`\n\nLiving programme authority: this document on protected `main`.

## 1. Decision

WAKILISHA will not expand MIZIZI into a privileged autonomous Production operator until the current Registry mutation surface, duplicated governance machinery, and obsolete authority paths have been mapped and converged.

The programme has five serious slices:

1. **Registry Authority & Security Convergence**
2. **Governance Primitive Convergence**
3. **Obsolete Authority Retirement & Bypass Closure**
4. **MIZIZI Stewardship Runtime Foundation**
5. **Canonical Admission + Autonomous MIZIZI**

This is intentionally one programme rather than a sequence of opportunistic fixes.

The governing principle is:

> **Do not primitive the culture. Primitive the governance.**

Artist, Track, Release, relationship, provider, editorial, user, historical, and projection semantics remain explicit. Shared primitives are extracted only where recurrence and semantics prove that they are genuinely shared.

## 2. Why this programme exists

The current music Registry is more centralized than previously feared.

Canonical Artist, Track, and Release identity is substantially concentrated in:

- `public.registry_artists`
- `public.registry_tracks`
- `public.registry_releases`
- `public.registry_track_artists`
- `public.registry_release_artists`
- `public.registry_release_tracks`

Downstream systems generally reference those canonical UUIDs rather than maintaining a second large live music registry.

The principal architectural risk is therefore not competing Artist/Track/Release truth stores.

It is the number and diversity of **roads capable of changing canonical truth**, together with repeated evidence, review, decision, relationship, audit, and command concepts around that core.

MIZIZI must not be built on top of ambiguous or ambient authority.

## 3. Established findings

The following findings are the research baseline for this programme.

### 3.1 Canonical music identity has substantially converged

Current Production authority indicates:

- `registry_artists`: 852 rows
- `registry_tracks`: 2,260 rows
- `registry_releases`: 738 rows
- `registry_track_artists`: 3,143 rows
- `registry_release_artists`: 1,075 rows
- `registry_release_tracks`: 2,363 rows
- 2,160 distinct Tracks represented in `registry_release_tracks`
- 100 Tracks appearing in more than one Release

`registry_tracks.release_id` exists but is not the active membership authority. Current rows have no non-null `release_id`; Release membership is represented through `registry_release_tracks`.

Legacy physical music stores inspected during the audit are effectively empty and are not a competing live registry.

### 3.2 Downstream systems mostly use canonical Registry IDs

Examples established during the audit include:

- Artist claims referencing `registry_artists.id`
- Artist representation and profile presentation referencing `registry_artists.id`
- Community posts referencing `registry_tracks.id`
- Editorial playlist items referencing `registry_tracks.id`
- Track lyric documents referencing `registry_tracks.id`
- provider intake/staging targets referencing Registry identities

This is the foundation to preserve.

### 3.3 Relationship authority remains duplicated

Two relationship families remain:

- `public.entity_relationships`
- `public.registry_entity_relationships`

with corresponding evidence families:

- `relationship_evidence`
- `registry_relationship_evidence`

The older graph uses `cultural_entities`; the newer Registry relationship graph has typed canonical endpoints and is the substantially more active authority.

Four legacy `cultural_entities` rows were found for core music identity:

- Artist `bien`
- Artist `sauti-sol`
- Release `still`
- Track `still`

Those rows correspond to identities already represented by current Registry tables. A later Registry creation contract explicitly forbids new Artist, Track, and Release creation through `cultural_entities`.

The old graph is therefore a concrete convergence target, but it must not be dropped until its remaining callers, evidence, review functions, and historical semantics are migrated or explicitly preserved.

### 3.4 `registry_entity_index` is the correct shared lookup pattern

`registry_entity_index` already demonstrates the preferred architecture:

- typed domain authorities remain canonical;
- a shared view projects them into one lookup/reference surface;
- no universal mutable `entities` god-table is required.

Future primitive work should follow this pattern.

### 3.5 Historical identity needs durable lineage

The chart audit found 1,800 UUID-shaped `canonical_track_id` values in `wk_chart_entries_v2`.

1,788 resolve to current `registry_tracks`.

The remaining 12 all reference the same missing UUID.

That state must not be automatically rewritten until merge/retirement history is resolved. It demonstrates the need for a durable identity-lineage or supersession primitive so historical references remain interpretable after canonical merges or retirement.

### 3.6 Governance machinery is repeated around the canonical core

The audit found multiple evidence, review, decision, suggestion, resolution-event, audit, command, receipt, job, and outbox families.

This does not justify collapsing every table.

It does justify a deliberate search for common contracts in:

- subject/reference identity
- evidence provenance
- review case and decision
- operation journaling
- capabilities
- admission decisions
- trust/information-flow provenance
- projection lineage
- principal/delegation authority
- relationship authority

## 4. Security premise

The security model must assume that MIZIZI's reasoning can be wrong, manipulated, or fully compromised.

Production must remain bounded anyway.

Therefore:

> **The MIZIZI Mind must possess zero ambient Production authority.**

The Mind must not hold:

- `service_role`
- a Production `postgres` credential
- a broad database connection string
- unrestricted SQL execution
- a generic Production shell
- the ability to grant itself capabilities
- the ability to activate self-authored mutating skills

The eventual execution path is:

```text
MIZIZI Mind
    ↓
typed proposed plan
    ↓
deterministic Policy Gateway
    ↓
short-lived exact Execution Grant
    ↓
Capability Broker / typed Registry operation
    ↓
canonical mutation
    ↓
independent verification
```

The policy boundary, not the model, decides whether a proposed mutation is allowed.

## 5. Trust and information-flow model

Every observation entering MIZIZI's reasoning environment must preserve provenance and trust classification.

At minimum:

```text
TRUSTED_CONTROL
  system policy
  approved Super Admin command
  approved mission grant

INTERNAL_FACT
  verified canonical state
  deterministic receipts
  verified operation results

EXTERNAL_EVIDENCE
  provider metadata
  provider payloads

USER_CONTENT
  Artist Studio submissions
  community content
  user-supplied metadata

WEB_UNTRUSTED
  fetched pages
  scraped HTML
  search results
  external prose
```

Transforming, summarizing, quoting, or storing untrusted data does not promote it into trusted control.

Persistent memory must retain origin/trust provenance so a poisoned observation cannot be laundered through summaries, later runs, or tool echoes.

## 6. Current privileged-write concern

The audit identified several different Registry mutation surfaces with uneven authorization posture.

This document does not authorize changing any of them yet.

They are inputs to Slice 1.

### `scrape-artist-data`

Status for this programme: **RETIRE — but not yet.**

It is a deployed Registry writer that scrapes WAKILISHA's own public Artist presentation and can write canonical Artist, Release, Track, membership, and credit state.

That circular authority has no place in the target architecture.

However, it must remain untouched until the programme has proven:

- every caller;
- every route and admin surface;
- every script/package/deployment reference;
- every test contract;
- every documentation assertion;
- every legitimate capability still depending on it;
- the replacement authority for any capability that must survive.

Its removal belongs in **Slice 3**, after Slices 1 and 2 establish the complete authority and primitive maps.

### `artist-registry-intake`

The audit found a service-role-backed intake path with insufficient network-boundary authorization for the authority it can exercise.

Its final disposition is not pre-decided here.

Slice 1 must classify whether to keep, converge, replace, or retire each part of that workflow.

### `ingest-artist-discography`

JWT verification alone is not sufficient authorization for canonical Registry mutation.

This writer must be classified by capability and caller authority during Slice 1. It is not to be patched in isolation before the full authority map exists.

### Other Registry mutation functions and RPCs

The database contains many legitimate administrative and repair functions. Some are `SECURITY DEFINER`; some perform their own administrator/capability checks; some are maintenance surfaces.

Supabase advisor counts alone must not be interpreted as vulnerability counts.

Instead, every privileged callable must be machine-classified by exact behavior and intended principal.

## 7. Slice 1 — Registry Authority & Security Convergence

### Objective

Produce a complete, current, machine-checkable map of every path capable of changing canonical music identity or its authoritative relationships.

No destructive cleanup begins before this map is complete.

### Required Registry Authority Ledger

Every writer must record:

- entry-point name;
- implementation type: Edge Function, RPC, SQL function, admin route, script, job, importer, direct database path, or other;
- principal/caller class;
- authentication mode;
- authorization mode;
- credential or execution role used after authorization;
- exact capabilities exposed;
- exact canonical tables and columns touched;
- secondary/projection effects;
- idempotency behavior;
- concurrency behavior;
- current callers and UI surfaces;
- current Production activity where measurable;
- whether the surface is replay/deployment authority;
- risk class;
- intended long-term authority;
- disposition: `KEEP`, `CONVERGE`, `REPLACE`, or `RETIRE`;
- replacement dependency, if any;
- acceptance proof required before changing it.

### Privileged callable manifest

Every callable privileged database function must also be classified by:

- security mode;
- exposed roles;
- mutating versus read-only;
- required capability;
- intended principal type;
- target domain;
- canonical tables touched;
- receipt requirement;
- MIZIZI-callable yes/no;
- human-callable yes/no;
- public-callable yes/no.

A missing classification becomes a CI failure once the manifest becomes authoritative.

### Slice 1 exit gate

Slice 1 is complete only when WAKILISHA can answer mechanically:

> **By every currently accepted mechanism, how can canonical Artist, Track, Release, membership, credit, and Registry relationship state change?**

The answer must not depend on tribal knowledge.

## 8. Slice 2 — Governance Primitive Convergence

### Objective

Extract common governance primitives only where recurrence and semantics are proven, while preserving domain-specific meaning.

### Candidate shared primitives

The research establishes the following candidates for exact design:

#### Principal and Delegation Grant

A common way to represent who is acting, on whose authority, for what capability, under what scope, until when.

#### Subject Reference

A typed reference contract capable of pointing at Registry and other governed subjects without faking them as editorial resources.

#### Capability Registry

Versioned capabilities with explicit input/output contracts, risk classes, caller classes, and activation state.

#### Evidence Assertion

A provenance-preserving factual assertion with source/origin, authority class, observation time, subject, claim type, and evidence payload/reference.

Domain-specific evidence tables may continue to exist where their semantics require it; the primitive is a shared contract, not necessarily one physical table.

#### Review Case and Decision

A shared case/decision contract for governed review workflows where the semantics truly overlap.

#### Operation Journal

The durable record of consequential execution:

- principal;
- operation;
- plan;
- capability versions;
- target set;
- request fingerprint;
- before-state fingerprints/snapshots where required;
- result;
- verifier;
- approval;
- compensation;
- rollback parent;
- supersession;
- timestamps and failure state.

Existing `command_receipts` and `registry_canonical_write_events` should be reused or extended around where possible rather than replaced casually.

#### Canonical Admission Decision

A deterministic, machine-readable decision establishing whether a proposed canonical mutation is authorized against the current state.

#### Trust Provenance

Persistent information-flow classification carried across observation, transformation, memory, planning, and execution.

#### Identity Lineage

Canonical merge/supersession/retirement lineage so historical references remain interpretable without rewriting history.

#### Projection Lineage

Classification of canonical state, current projection, historical observation, and provider evidence so convergence work does not destroy historical facts.

#### Relationship Authority

Converge core relationship truth on the typed Registry relationship authority after all remaining old-graph dependencies are proved and migrated.

### Explicit anti-goal

Slice 2 must not create a universal cultural `entities` table merely because multiple domains have IDs, names, evidence, or review state.

The correct pattern is typed domain authority plus shared governance contracts and shared reference projections.

### Slice 2 exit gate

- shared primitives have explicit semantics and boundaries;
- duplicate relationship authority has a proven convergence path;
- no proposed primitive erases domain meaning;
- every primitive has identified current consumers and migration strategy;
- no obsolete writer has yet been removed before its replacement is ready.

## 9. Slice 3 — Obsolete Authority Retirement & Bypass Closure

### Objective

Remove obsolete mutation roads only after their dependencies and replacements are proven.

This is where `scrape-artist-data` is retired.

### Stage A narrow executor foundation closure

Stage A of the remaining Slice 3 MIZIZI execution-authority convergence is
Production accepted.

PR #981 merged at
`main@5efa912f2a35e5c58817f8ee220a73c21e07b903` and Production applied
`20260918120331_mizizi_executor_foundation_v1` exactly once.

The accepted Production state installs `mizizi_executor` as a narrow LOGIN role
with no SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, or INHERIT
authority. It has no direct governed-table mutation authority. Its future
`mizizi` executor binding is disabled, the existing `mizizi -> postgres`
binding remains active, the Release-taxonomy and Chart Track-slug operation
types remain disabled, and active standing/exact MIZIZI grants remain zero.

The private broker surface is executable by `mizizi_executor` only; browser and
service roles do not receive that authority. No canonical Registry or Chart data
mutation, Edge deployment, or frontend deployment occurred.

Full acceptance evidence is recorded in
`docs/engineering/mizizi-slice3-executor-stage-a-production-closure.md`.

**Status**:
`SLICE3_MIZIZI_EXECUTOR_STAGE_A=PRODUCTION_ACCEPTED`.

The next boundary is a separate protected runtime/transport convergence gate.
Stage A does not activate autonomous MIZIZI authority.

### Stage B typed broker convergence closure

Stage B of the remaining Slice 3 MIZIZI execution-authority convergence is
Production accepted.

PR #983 merged at
`main@a2f6a960b2257c063f270a19d5d424a418cf4657` and Production applied
`20260918173446_mizizi_stage_b_broker_convergence_v1` exactly once.

MIZIZI canonical stewardship mutation authority for Track slug, Release
taxonomy, Release slug, Chart Track-slug, and deterministic review escalation
now runs through narrow typed exact-grant brokers. The general MIZIZI runner no
longer owns direct mutation DML for governed targets, review rows, canonical
write events, execution grants, or mutation journals.

The accepted Production state keeps all four Stage B operation types disabled,
keeps active standing/exact MIZIZI grants at zero, preserves the live
`mizizi -> postgres` transport binding, and leaves the future
`mizizi -> mizizi_executor` binding disabled. `mizizi_executor` has the exact
private broker EXECUTE surface required for the future transport cutover but no
direct governed-table mutation authority.

No canonical Registry or Chart data mutation, Edge deployment, frontend
deployment, or transport cutover occurred as part of the Production migration.

Full acceptance evidence is recorded in
`docs/engineering/mizizi-slice3-stage-b-production-closure.md`.

**Status**:
`SLICE3_MIZIZI_STAGE_B_TYPED_BROKER=PRODUCTION_ACCEPTED`.

### Stage C narrow-executor transport closure

Stage C of the remaining Slice 3 MIZIZI execution-authority convergence is
Production accepted.

PR #985 merged at
`main@c93369cfdf026f8841a2fd0d61fabbf5bda4b218` and Production applied
`20260920095334_mizizi_stage_c_narrow_executor_transport_v1` exactly once.

The accepted live transport now resolves MIZIZI JIT database execution to the
dedicated `mizizi_executor` role. The legacy `mizizi -> postgres` binding is
disabled. `mizizi_executor` retains only the approved Registry/Chart read
surface and exact private wrapper EXECUTE surface required by the governed
brokers. It has no ambient `platform_private` or editorial schema access, no
direct admin identity reads, and no direct canonical Registry or Chart UPDATE
authority.

Both Production Track and Release control planes established real JIT
`mizizi_executor` database sessions after cutover, completed read-only
post-apply preflight successfully, and restored temporary JIT mappings with
Production temporary access disabled at rest.

The accepted Production state is migration count 153 at head
`20260920095334`, with active standing MIZIZI grants 0 and active exact MIZIZI
grants 0.

Full acceptance evidence is recorded in
`docs/engineering/mizizi-slice3-stage-c-production-closure.md`.

**Status**:
`SLICE3_MIZIZI_STAGE_C_NARROW_EXECUTOR_TRANSPORT=PRODUCTION_ACCEPTED`.

Stage C closes the ambient MIZIZI transport debt only. Slice 3 remains open for
the broader obsolete Registry authority retirement and bypass-closure exit gate.
No Slice 4 autonomy or runtime expansion is authorized by Stage C closure.

### `scrape-artist-data` retirement contract

Retirement must cover the whole runtime contract, not only its source directory.

The retirement audit must prove and then remove, where they exist:

- live Edge Function deployment;
- Edge Function source;
- direct callers;
- admin pages and routes existing solely to operate it;
- navigation entries;
- admin search entries;
- package scripts;
- local/operator scripts;
- scheduled jobs;
- deployment references;
- test assumptions that require it to exist;
- docs that incorrectly describe it as current authority;
- stale shared-helper obligations that exist solely because of it.

Canonical content must not be deleted merely because the retired runtime created or enriched it.

Historical provenance may remain where it is semantically useful.

### Retirement precedent

The repository's WordPress retirement is the model:

- declare architectural retirement;
- remove runtime and administrative execution surfaces;
- preserve accepted content/history;
- apply Production retirement only after repository acceptance;
- add negative tests preventing the runtime from silently returning;
- keep historical provenance separately where deletion would destroy evidence.

### Other bypasses

Every `RETIRE` and `REPLACE` surface from Slice 1 is handled under the same discipline.

A legitimate workflow cannot be removed until its replacement is accepted.

### Slice 3 exit gate

- no live `scrape-artist-data` runtime;
- no UI, route, command, job, or script depends on it;
- no canonical data was erased merely because of provenance;
- every retired authority has a negative reintroduction contract where appropriate;
- every retained Registry writer is explicitly classified and governed;
- no unjustified unauthenticated or JWT-only-to-service-role canonical writer remains.

### Slice 3 retirement acceptance and reopening

The retirement work and MIZIZI Stage A/B/C executor convergence are Production accepted, but the whole Slice is reopened.

Closing repository retirement PR #987 merged as:

`177e4aaee15d5bbb2a77ae8ee43f7e119791aee3`

Final Production acceptance proved:

- migration count 153 at head `20260920095334`;
- active MIZIZI standing grants 0;
- active MIZIZI exact grants 0;
- `mizizi -> mizizi_executor` active;
- `mizizi -> postgres` disabled;
- all six retired Registry Edge runtimes absent;
- all nine retained governed Registry/Admin runtimes ACTIVE;
- obsolete public Registry maintenance RPC count 0;
- all three legacy core relationship fail-closed triggers enabled;
- ordinary browser canonical Artist/Track/Release DML grants 0;
- retired `registry-enrichment-review` external route HTTP 404;
- live `public-content-read` network positive control HTTP 401.

Critical Control Plane #1369 returned:

`SLICE3_FINAL_EDGE_EXIT_AUDIT=PASS`

Whole-Slice closure authority:

`docs/engineering/mizizi-slice3-production-closure.md`

Accepted retirement receipt:

`MIZIZI_SLICE3_OBSOLETE_RUNTIME_RETIREMENT=PRODUCTION_ACCEPTED`

Fresh exact-main + Production audit established a broader final writer surface than the prior manifest captured. The authoritative classification is `docs/engineering/mizizi-slice3-final-live-writer-authority-audit.md`.

Confirmed service-role Edge convergence debt includes `admin-router` Registry, `provider-intake-api`, and `run-chart-playback-enrichment`. The database-function audit separately classifies accepted narrow commands, typed relationship authority, live convergence debt, internalization candidates, and one retirement candidate.

#962 is reopened. Slice 4 #991 is blocked until the original Slice 3 exit gate is satisfied.

## 10. Slice 4 — MIZIZI Stewardship Runtime Foundation

### Objective

Build the execution boundary before increasing autonomous intelligence.

### Required architecture

#### MIZIZI Mind

May:

- investigate;
- query broadly through approved read surfaces;
- compare evidence;
- use the web;
- reason;
- retain bounded operational memory;
- draft plans;
- ask questions;
- re-plan.

It has no ambient Production mutation credential.

#### Deterministic Policy Gateway

Calculates actual authority from machine-readable state.

The LLM may recommend a risk assessment; it does not grant itself authority.

#### Exact Execution Grant

Every grant binds at least:

- principal/system actor;
- capability and version;
- target IDs;
- allowed action/fields;
- expected current state or revision/fingerprint;
- maximum affected rows / blast radius;
- expiry;
- operation ID;
- approval ID where required;
- idempotency key.

#### Capability Broker

Converts an accepted grant into one exact typed operation.

No arbitrary SQL bridge is exposed to the Mind.

#### Operation Journal

Every consequential action is durable, attributable, replay-safe where appropriate, and inspectable.

#### Independent Verifier

Mutation success is not declared by the same reasoning step that requested the mutation.

Prefer deterministic assertions wherever possible.

The verifier may block, contain, or escalate failure. It must not silently repair the same target through the same unchecked path it is verifying.

#### Compensation

Rollback is a compensating operation against current state, not blind database time travel.

If later legitimate state conflicts with compensation, escalation is required.

#### Kill switch

An external kill switch must be capable of disabling autonomous execution without depending on MIZIZI cooperation.

### Mandatory circuit breakers

At minimum:

- maximum rows/entities per operation/run;
- per-capability rate/budget limits;
- daily autonomous mutation budget;
- per-entity cooldown where appropriate;
- ambiguity/confidence halt rules;
- error-rate halt;
- bounded retries;
- concurrency/advisory locking;
- no recursive self-authority;
- network egress allowlist for privileged runtimes;
- sandboxed filesystem/process execution if code execution is later introduced;
- credentials held outside the reasoning runtime.

### Slice 4 exit gate

A fully compromised MIZIZI reasoning process must still be unable to exceed deterministic capability, target, state, expiry, and blast-radius boundaries.

## 11. Slice 5 — Canonical Admission + Autonomous MIZIZI

### Objective

Make the Registry boundary itself enforce authority, then permit bounded autonomous stewardship.

### Canonical admission

Authority must not depend on which adapter initiated a change.

The target is:

> **Any legitimate mechanism capable of changing canonical identity must cross the same admission contract.**

This includes canonical Track/Release/membership writes and any other identity-sensitive paths established by Slice 1.

Membership and other relevant authority changes must invalidate stale MIZIZI decisions automatically.

### Identity Intelligence 2.0

MIZIZI then receives the domain reasoning required for:

- Track versus Release public authority;
- structured credit reasoning;
- feature-credit identity;
- membership authority;
- provider disagreement;
- duplicate/canonical merge reasoning;
- projection drift;
- durable identity decisions.

### Conversational Super Admin control

Canonical Messages carries human intent and decisions, not hidden execution state.

A conversational approval such as "yes" must bind to the exact current:

- operation;
- plan fingerprint;
- target set;
- capability versions;
- expected Registry state/fingerprints;
- blast radius;
- expiry;
- approver.

If underlying state changes, the approval is stale and cannot execute.

### Autonomous health and convergence

Once the boundary is proven, MIZIZI may:

- wake on durable triggers/schedules;
- scan for Registry inconsistencies;
- investigate;
- auto-repair permitted low-risk classes within standing budgets;
- escalate ambiguity;
- rebuild governed projections;
- detect writer bypasses;
- measure convergence health.

### Slice 5 exit gate

Autonomy is not accepted until the adversarial programme proves the boundary against expected failure classes.

## 12. Adversarial acceptance programme

Before broad Production autonomy, deliberately test at least:

- malicious provider titles;
- prompt injection in metadata;
- prompt injection in fetched web content;
- poisoned persistent memory;
- contradictory providers;
- stale approval;
- duplicated commands;
- retry after commit but before response;
- database timeout after mutation;
- partial projection rebuild;
- concurrent operations against the same entity;
- admin mutation while MIZIZI is planning;
- capability becoming unavailable midway;
- mass candidate explosion;
- wrong model conclusion;
- stale skill version;
- rollback after later legitimate change;
- worker/runtime crash mid-operation.

The acceptance must prove:

- no unauthorized mutation;
- no privilege escalation from untrusted content;
- no duplicate mutation;
- no silent partial success;
- no stale approval execution;
- no unsafe rollback;
- no destruction of historical observations;
- no model-controlled capability escalation;
- no autonomous operation beyond its declared budget.

## 13. Execution discipline for every slice

Every slice follows the same engineering sequence:

```text
read-only authority audit
→ exact design
→ implementation/replay proof
→ CI consolidation review
→ preview/runtime proof where required
→ Production promotion
→ independent acceptance
→ documentation/closure
→ merge
→ next slice
```

### No operational guessing

Current deployed state outranks stale documentation.

If authority sources disagree, resolve the conflict before mutation.

### Runtime dependencies before fixtures

Any Edge Function, browser, webhook, receiver, CDN, or external-runtime acceptance first receives a complete dependency inventory.

### One unexplained runtime failure changes the mode

After the first unexplained failure:

```text
failure
→ identify layer
→ collect exact evidence
→ smallest correction
→ surgical resume
```

Do not mutate multiple layers by trial and error.

### Mutating acceptance uses a durable state ledger

Every disposable fixture records IDs immediately and resumes from the last proven state after interruption.

### CI consolidation is mandatory

A new milestone does not automatically justify a new permanent test file.

Default preference:

```text
extend
→ consolidate
→ replace
```

not accumulate.

Retirement invariants are good candidates for consolidated negative architecture tests.

## 14. Required programme artifacts

Before destructive implementation begins, the programme must produce three authoritative artifacts.

### A. Registry Authority Ledger

The complete writer/caller/authorization/disposition map defined in Slice 1.

### B. Retirement Manifest

Every runtime, route, command, job, script, function, test, and doc contract intended for retirement, with dependency proof and replacement state.

`scrape-artist-data` is already a declared candidate in this manifest, but the manifest is not complete until Slice 1 proves all dependencies.

### C. Primitive Convergence Map

Every candidate shared primitive with:

- current overlapping implementations;
- semantic commonality;
- semantic differences that must be preserved;
- target primitive contract;
- migration order;
- non-goals;
- acceptance proof.

These artifacts become the design authority for implementation.

## 15. Programme-wide non-negotiables

The following are forbidden in the target architecture:

- arbitrary SQL for the MIZIZI Mind;
- generic Production shell access for the MIZIZI Mind;
- model-controlled permission escalation;
- automatic activation of self-generated mutating skills;
- irreversible execution without deterministic policy;
- confidence score alone granting mutation authority;
- hidden chains of consequential mutations without receipts/journal entries;
- untrusted provider/web/user content entering trusted instruction authority;
- rewriting historical observations solely for canonical aesthetic consistency;
- blind rollback to an old row snapshot;
- success before independent verification;
- indefinite autonomous retries;
- autonomous mutation without a blast-radius budget;
- direct public-identity writes that bypass canonical admission authority;
- new Artist/Track/Release truth stores competing with canonical Registry identity;
- a universal cultural god-table introduced merely to make schemas look uniform.

## 16. Programme completion condition

The programme is complete when WAKILISHA can prove all of the following:

- one canonical Artist/Track/Release identity authority;
- one accepted core Registry relationship authority;
- canonical identity lineage is durable across merge/retirement;
- historical observations remain distinguishable from current canonical projections;
- no live `scrape-artist-data` runtime;
- no UI, command, script, or job depends on it;
- no unauthenticated canonical Registry writer;
- no JWT-only-to-service-role shortcut without explicit Registry capability authorization;
- every privileged Registry operation is machine-classified;
- every legitimate writer crosses accepted Registry admission authority;
- MIZIZI holds no ambient Production credential;
- every consequential MIZIZI mutation has principal, capability, operation, current-state binding, budget, receipt/journal, and verifier;
- stale approvals cannot execute;
- untrusted content cannot escalate execution authority;
- compensations cannot blindly overwrite later legitimate state;
- the kill switch can stop autonomous mutation independently of the Mind;
- the adversarial suite proves the accepted threat model;
- CI contains consolidated permanent invariants rather than milestone test sprawl.

## 17. Immediate next action

The active implementation boundary remains **Slice 3 final live-writer convergence**.

First make the canonical-writer inventory mechanically complete, then converge the existing-primitive callers and high-blast repair/merge roads described in `docs/engineering/mizizi-slice3-final-live-writer-authority-audit.md` without retiring legitimate product capability.

Before any new runtime mutation authority is implemented, freeze the exact
current state of:

- MIZIZI process entrypoints, schedules, leases, retries, and operational
  memory;
- current read surfaces and all credentials reachable by the reasoning/runtime
  process;
- deterministic policy and exact-grant primitives already accepted in
  Production;
- capability-broker execution boundaries;
- operation journal and independent verifier semantics;
- compensation/rollback authority;
- kill-switch ownership and fail-closed behavior;
- network egress, filesystem/process execution, and secret boundaries;
- concurrency, rate, row, daily-budget, and cooldown controls.

The Slice 4 design must prove that a fully compromised reasoning process still
cannot exceed deterministic capability, target, state, expiry, and blast-radius
authority.

Until that opening audit and design are accepted:

- do not grant MIZIZI standing Production mutation authority;
- do not expose arbitrary SQL;
- do not place long-lived Production credentials in the reasoning runtime;
- do not let model output create or widen its own capability;
- do not add autonomous retries or compensation outside deterministic policy;
- do not bypass the accepted exact-grant, broker, journal, and verifier
  boundaries.

