# MIZIZI Registry Primitive Convergence Map

Date: 14 September 2026

Status: **Slice 1 primitive design authority. This document identifies shared infrastructure candidates. It does not authorize schema consolidation or deletion.**

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Authority ledger: `docs/engineering/mizizi-registry-authority-ledger.md`

Retirement manifest: `docs/engineering/mizizi-registry-retirement-manifest.md`

Repository baseline: `main@4d07bf5acce5eb0a414728d7c198b26f54de6cf6`

## 1. Governing rule

> **Do not primitive the culture. Primitive the governance.**

WAKILISHA should not replace Artist, Track, Release, provider, community, editorial, Institute, claims, historical observation, or projection semantics with one universal table merely because several domains share columns such as `status`, `actor_id`, `evidence`, or `metadata`.

A primitive is justified only when the same invariant recurs across domains and the shared contract makes the system safer or simpler without erasing meaning.

The intended shape is:

```text
explicit domain authorities
        ↓
small shared governance primitives
        ↓
typed operations / projections / receipts
```

not:

```text
every cultural concept
        ↓
one mutable god table
```

## 2. Existing primitives worth preserving

### 2.1 Typed core Registry authorities

Keep:

- `registry_artists`
- `registry_tracks`
- `registry_releases`
- `registry_track_artists`
- `registry_release_artists`
- `registry_release_tracks`

These tables encode domain meaning. They are not duplication merely because all represent music identity.

### 2.2 `registry_entity_index`

This view is a good shared-reference pattern: typed canonical authorities are projected into one lookup/reference surface rather than forced into one storage table.

The legacy `cultural_entities` duplicates inside the view are data-convergence debt, not evidence that the view pattern is wrong.

**Decision**: preserve and strengthen the typed-union projection pattern.

### 2.3 Command receipts

`platform_private.command_receipts` already provides strong reusable properties:

- principal identity;
- human actor identity;
- command type;
- idempotency key;
- request fingerprint;
- bounded request/result payloads;
- accepted/succeeded/failed/rejected lifecycle;
- completion timestamps;
- retargeting-resistant uniqueness.

Current Production has 251 receipts.

Its `resource_id` remains hard-bound to `editorial.resources`, so it is not itself a universal Registry operation target.

**Decision**: extend around it rather than break its proven contract.

### 2.4 Jobs/outbox

Current Production contains 16 jobs and 505 outbox events. These are real reusable orchestration infrastructure.

**Decision**: do not create a second MIZIZI-only job/outbox stack unless a missing invariant is proved.

### 2.5 System Actor identity and executor binding

Current Production has an active `platform_private.system_actors` row for `mizizi` and an active `platform_private.system_actor_executor_bindings` row binding it to `database_role = postgres`.

The System Actor row carries a bounded JSON `capability_profile` with `domain = registry`, `agent = mizizi`, and `ruleset_version = 1.1.0`.

**Important live-schema correction:** current Production does **not** contain normalized relations named `capabilities`, `system_actor_capability_grants`, or `stewardship_rulesets`. The accepted Phase 8B.4 System Actor migration established identity, capability-profile metadata, executor binding, Messages policy, and System command receipts. It did not establish the typed capability-grant/ruleset authority that autonomous Registry mutation now requires.

**Decision**: preserve System Actor identity and the separation between actor identity and executor identity. Replace ambient autonomous executor authority with normalized typed capabilities/delegations and short-lived exact execution grants before autonomous Production mutation. The current `postgres` executor binding is evidence of a boundary to supersede for autonomous mutation, not a permission model to extend.

## 3. Evidence that governance concepts are repeating

Current Production counts across overlapping governance families include:

| Concept family | Current rows |
|---|---:|
| `evidence_items` | 6 |
| `evidence_review_events` | 5 |
| `registry_relationship_evidence` | 3 |
| `relationship_evidence` | 2 |
| `artist_claim_evidence` | 0 |
| `inquiry_evidence` | 3 |
| `institute_evidence_items` | 0 |
| `review_decisions` | 15 |
| `registry_review_items` | 143 |
| `chart_artist_resolution_decisions` | 58 |
| `registry_artist_decouple_decisions` | 1 |
| `registry_canonicalization_decisions` | 1 |
| `registry_track_resolution_events` | 56 |
| `registry_artist_resolution_events` | 4 |
| `registry_enrichment_suggestions` | 643 |
| `registry_provider_track_suggestions` | 56 |
| `provider_intake_artist_staging` | 8,752 |
| `provider_intake_runs` | 13 |
| `registry_audit_log` | 157 |
| `registry_canonical_write_events` | 552 |

These numbers do not justify merging the tables by themselves.

They do prove recurring invariants around subject targeting, provenance, review, decision, operation identity, actor authority, and audit causality.

Those invariants are the primitivization opportunity.

## 4. Primitive A — Principal and Delegation Grant

### Problem

Current writers establish authority in several ways:

- admin role checks;
- capability checks;
- gateway JWT only;
- user auth with no Registry capability;
- no caller auth;
- System Actor capability-profile metadata without a normalized mutation grant;
- direct database role bindings.

MIZIZI autonomy cannot safely inherit this inconsistency.

### Primitive

A common principal/delegation model should answer:

- who is acting;
- whether the principal is human, service, or System Actor;
- who delegated authority;
- which exact capability is granted;
- scope/targets;
- expiry;
- maximum blast radius;
- approval/mission grant binding;
- revocation state.

### Non-goal

Do not make all users System Actors or replace existing user roles. This primitive connects existing identity systems to privileged operations.

## 5. Primitive B — Capability / Privileged Writer Registry

### Problem

Security posture is currently discoverable only by reading function code, grants, UI callers, and deployment configuration.

That does not scale to autonomous operation.

### Primitive

Every privileged operation should have machine-readable metadata:

```text
operation/capability
principal types
required role/capability
mutation targets
allowed fields/actions
public/human/MIZIZI callable
risk class
max rows / blast radius
approval policy
receipt requirement
verifier
reversibility
owner
lifecycle
```

### Use

CI should reject a new privileged Registry writer that lacks classification.

The deterministic MIZIZI Policy Engine should read the same authority contract rather than rely on prompt text.

## 6. Primitive C — Subject Reference

### Problem

Evidence, review, audit, and operations repeatedly need to point at an Artist, Track, Release, relationship, claim, intake row, projection, or broader cultural object.

Repeated ad-hoc `(entity_type, entity_id)` columns are inevitable unless a stable contract exists.

### Primitive

A **Subject Reference** is a typed pointer, not a universal entity row.

It should carry at minimum:

- subject domain/type;
- canonical identifier where one exists;
- optional version/revision/fingerprint;
- authority class.

### Important constraint

Subject Reference must not become a writable replacement for the typed canonical table.

`registry_entity_index` is the closest existing read-side analogue and should inform, not necessarily implement, this primitive.

## 7. Primitive D — Evidence Assertion and Provenance

### Problem

Evidence is represented in multiple domain tables because the domain semantics differ. That is acceptable.

What repeats is the need to say:

> source X asserted fact Y about subject Z at time T with provenance/trust class Q.

### Primitive

Shared evidence/provenance fields should support:

- subject reference;
- source/provider/user/system identity;
- observation timestamp;
- acquisition method;
- immutable raw/reference payload identity;
- normalized assertion type/value;
- trust/provenance class;
- supersession/retraction;
- review status where relevant.

### Non-goal

Do not collapse Artist-claim evidence, Institute inquiry evidence, relationship evidence, and provider observations into one featureless evidence table before their retention/privacy/workflow differences are modelled.

The first step may be a shared contract plus typed domain tables.

## 8. Primitive E — Trust Provenance / Information-Flow Label

### Problem

MIZIZI will reason over system policy, canonical database facts, provider payloads, user content, web pages, and its own memories.

Without durable origin labels, untrusted information can be laundered through summaries or persistent memory and later appear authoritative.

### Primitive

Every observation entering the MIZIZI cognitive/runtime boundary should carry an origin class such as:

- `TRUSTED_CONTROL`
- `INTERNAL_FACT`
- `EXTERNAL_EVIDENCE`
- `USER_CONTENT`
- `WEB_UNTRUSTED`

Derived artifacts must retain source lineage.

### Invariant

An untrusted observation may change a hypothesis. It may not become a command, permission, capability escalation, or approval merely because the model paraphrased it.

## 9. Primitive F — Review Case and Decision

### Problem

WAKILISHA has multiple review/decision tables because chart resolution, claim decisions, canonicalization, decoupling, Institute review, and provider intake are different workflows.

What repeats is:

- a subject/problem;
- evidence state;
- candidate choices;
- reviewer/principal;
- decision;
- rationale;
- effective state;
- supersession/reopen behavior.

### Primitive

Create a shared review-case/decision contract that domain decision tables can implement or reference.

### Non-goal

Do not replace every domain decision table with one generic `decisions` JSON bucket.

## 10. Primitive G — Registry Mutation Operation / Operation Journal

### Problem

`registry_canonical_write_events` and `registry_audit_log` are useful but do not yet form the durable operation model required for autonomous mutation.

A consequential operation may include multiple canonical writes, projection rebuilds, approvals, retries, verification, and compensation.

### Primitive

A Registry Mutation Operation should bind:

- operation ID;
- principal/delegation;
- capability version;
- subject(s);
- exact typed plan/fingerprint;
- expected current revisions/fingerprints;
- approval, if required;
- command receipt;
- steps;
- before/after state references;
- affected-row/blast-radius budget;
- idempotency key;
- status;
- verifier result;
- compensation plan/result;
- parent/superseded operation.

### Relationship to current tables

- command receipt = accepted command/accountability primitive;
- Registry operation = domain execution/target primitive;
- canonical write events = per-write evidence/journal material;
- jobs/outbox = durable orchestration/delivery primitives.

Do not fake Registry identities as `editorial.resources` to satisfy the current receipt FK.

## 11. Primitive H — Exact Approval Grant

### Problem

A conversational “yes” cannot be an open-ended autonomous permission.

### Primitive

Approval must bind:

- operation/plan fingerprint;
- target set;
- capability versions;
- expected Registry revisions/fingerprints;
- blast radius;
- approver;
- expiry;
- mission/one-shot scope.

### Invariant

If the underlying state changes materially after approval, the approval is stale and execution must stop/re-plan.

## 12. Primitive I — Canonical Admission Decision

### Problem

The strongest guarantee cannot live only in an Edge Function because multiple legitimate mechanisms can write Registry state.

### Primitive

Canonical admission is the deterministic database/control-plane contract that decides whether a proposed canonical mutation is currently authorized.

It should validate:

- principal/delegation;
- capability;
- subject scope;
- expected state;
- field/action allowlist;
- evidence/decision prerequisites;
- approval requirement;
- blast radius;
- idempotency;
- operation journal binding.

### Invariant

No autonomous MIZIZI mutation bypasses admission simply because the executor holds elevated credentials.

## 13. Primitive J — Membership and Credit Mutation

### Evidence

Current direct membership/credit mutation is concentrated in a small number of writers:

- `ingest-artist-discography` performs destructive Release-membership and credit replacement;
- `chart-ingest-api` writes Track credits;
- `registry-enrichment-review` writes Release credits;
- `scrape-artist-data` writes all three families and is slated for retirement.

### Primitive

Typed operations should distinguish:

- add/ensure membership;
- replace membership set;
- add/ensure credit;
- replace credit set;
- primary/featured/role semantics;
- source/provenance;
- expected existing set/fingerprint.

### Why

A destructive `delete all then insert` operation must have stronger concurrency, evidence, and verification semantics than an idempotent `ensure relationship` operation.

## 14. Primitive K — Artist Enrichment Capability

### Evidence

Four separate Admin functions independently update canonical Artist state using provider lookup or heuristics.

### Primitive

Separate:

1. **evidence acquisition** — Spotify, Apple Music, MusicBrainz, deterministic local rules;
2. **proposal** — candidate image/origin/type/bio/metadata change with provenance;
3. **policy/review** — determine whether field is safe to auto-apply;
4. **typed canonical mutation** — exact allowed Artist fields;
5. **verification/journal**.

Images and provider IDs may be low-risk. Artist origin/type can encode cultural/identity semantics and should not automatically inherit the same policy.

## 15. Primitive L — Relationship Authority

### Problem

Two graph authorities remain live.

### Target

`registry_entity_relationships` becomes the canonical typed relationship authority for core Registry identities.

Relationship evidence must be preserved and attached to the surviving relationship authority.

### Constraint

Do not force all non-music cultural relationships into the Registry graph without proving the endpoint model fits those domains.

This is a convergence primitive for authority, not a mandate for one graph table across all WAKILISHA culture.

## 16. Primitive M — Identity Lineage / Supersession

### Evidence

Historical chart data contains canonical Track IDs, including a small set of references to a Track UUID no longer present in the current Registry. A merge/retirement may therefore make a historical canonical pointer appear dangling even when the historical observation was valid.

### Primitive

Identity lineage should record events such as:

- merge;
- supersede;
- split;
- alias/canonical replacement;
- retirement without replacement.

A resolver should be able to answer:

> This historical ID was canonical at the time; what is its present canonical successor, if any?

### Invariant

Historical observations are not rewritten merely to make current foreign keys aesthetically clean.

## 17. Primitive N — Projection Lineage

### Problem

Current systems contain canonical rows, current projections, provider evidence, and historical observations. Autonomous convergence must know which class it is touching.

### Primitive

Projection lineage should identify:

- canonical source subject/version;
- projection type;
- generation/version/fingerprint;
- last rebuild;
- stale/valid state;
- whether the projection is disposable/rebuildable or historical evidence.

### Use

Search documents, public identity projections, signal metrics, caches, sitemap/search projections, and similar outputs can be safely rebuilt without teaching MIZIZI to rewrite analytics history.

## 18. Primitive O — Pure Public Read Boundary

### Evidence

The current broad public read gateway performs canonical Release description writes during a Release read.

### Primitive/invariant

A route classified as canonical public **Read** must be mechanically incapable of changing canonical Registry truth.

Operational telemetry such as rate-limit logging may remain, but it must be separate from canonical mutation authority.

Derived presentation fallback belongs in:

- response-time presentation logic;
- a rebuildable projection;
- or an explicitly governed write operation.

### CI opportunity

Static/runtime acceptance should fail if a public-read function introduces INSERT/UPDATE/DELETE against canonical Registry tables.

## 19. Primitive P — Deterministic Verifier

### Problem

A model or writer must not declare its own consequential operation successful without independent proof.

### Primitive

Every mutating capability declares deterministic postconditions where possible.

Examples:

- canonical entity exists exactly once;
- expected status/revision matches;
- membership set equals approved fingerprint;
- credits preserve primary/featured invariants;
- no orphan references;
- public projection resolves to expected scope;
- operation affected no more rows than authorized.

Verifier failure blocks success and may trigger compensation/escalation. It does not silently mutate through the same path it is verifying.

## 20. Primitive Q — Resource/Blast-Radius Budget

### Primitive

A privileged operation or mission grant carries limits such as:

- maximum entities;
- maximum rows;
- maximum public-route changes;
- maximum retries;
- maximum tool calls;
- per-entity cooldown;
- capability-specific daily/hourly budget;
- concurrency key;
- expiry.

The policy engine, not the model, enforces the budget.

## 21. Concepts that should remain domain-specific

The following are explicitly **not** candidates for blind consolidation:

- Artist claims;
- Artist Studio profile/presentation data;
- community posts/threads/saves;
- editorial playlist/lyrics/publication semantics;
- Institute inquiry/evidence semantics;
- provider intake staging rows;
- chart observations and methodology;
- historical analytics/Search Console rows;
- canonical Artist/Track/Release tables;
- domain-specific decision payloads where their invariants differ.

They may reference shared principals, subjects, evidence, operations, and decisions without becoming one table.

## 22. Suggested Slice 2 implementation order

Primitive implementation should be deliberately small and compounding:

1. **Privileged Writer/Capability Manifest** — document and machine-classify what already exists.
2. **Principal + exact delegation/execution grant contract** — reuse user/System Actor identity.
3. **Registry Mutation Operation + Subject Reference** — give Registry commands a first-class target without weakening command receipts.
4. **Operation Journal integration** — connect command receipt, canonical write events, approval, verifier, and compensation.
5. **Canonical Admission contract** — deterministic boundary for autonomous/high-risk mutations.
6. **Membership/Credit typed actions** — converge the highest-blast-radius repeated core writes.
7. **Artist Enrichment capability** — collapse four under-authorized privileged adapters behind one governed contract.
8. **Pure Public Read invariant** — remove write-on-read and make the boundary enforceable.
9. **Relationship authority convergence contract** — migrate legacy core graph safely.
10. **Identity + Projection Lineage** — preserve historical truth while allowing present-state convergence.
11. **Evidence/Review shared contracts** — standardize recurrence without premature table collapse.

This order attacks authority risk first and schema aesthetics last.

## 23. What MIZIZI receives after convergence

MIZIZI should not receive tables and service-role credentials as tools.

It receives capabilities such as:

```text
investigate subject
read trusted canonical state
read provider evidence
propose canonical mutation
request exact execution grant
execute typed capability
verify operation
request approval
compensate eligible operation
```

Each capability crosses the primitives above.

That is the difference between an autonomous steward and an LLM holding a database password.

## 24. Slice 1 primitive conclusion

The audit does not support building a universal WAKILISHA entity/governance database.

It supports a smaller result:

> **One canonical music core, explicit domain schemas, and a compact shared control plane for who may act, what they may act on, why the action is justified, exactly what changed, how the change is verified, and how authority expires.**

That is the primitive foundation Slice 2 should implement.