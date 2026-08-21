# Primitive Compounding Contract

Status: active control-plane doctrine

Effective: 21 August 2026

## Purpose

WAKILISHA should compound what it learns while building real product surfaces.

The useful lesson from the Palantir operating-model study is not "make everything reusable". It is that purpose-built applications can remain different while sharing durable objects, actions, permissions, lineage, state, and interaction primitives. Repeated deployments should improve the platform instead of leaving behind one-off implementation debris.

WAKILISHA therefore follows this rule:

> Solve the domain problem completely, then preserve the reusable residue. Never flatten the domain merely to manufacture reuse, and never allow the next domain to quietly rebuild a concept WAKILISHA has already learned.

## What a primitive is

A primitive is a durable implementation of one WAKILISHA concept that can survive outside the feature where it was first discovered.

A primitive normally represents some stable combination of:

- object
- state
- permitted action
- interaction grammar
- result

Three primitive kinds are recognized:

1. `authority`
   - canonical objects, relationships, permissions, state, or governed actions
2. `interaction`
   - reusable ways of operating on a canonical concept
3. `presentation`
   - reusable grammar for presenting the same semantic fact

A domain workspace is not automatically a primitive. `AudioReviewWorkspace` is a domain composition. `MediaTimeline` is an interaction primitive.

## Core rules

### Same meaning, one primitive

If two surfaces express the same WAKILISHA concept, they should converge on one primitive.

Reuse is semantic, not cosmetic. Similar-looking controls that mean different things do not have to share a primitive. Different-looking surfaces that expose the same governed concept should not invent conflicting meanings.

### Extract -> converge -> migrate

1. solve the first real domain need
2. extract only the stable reusable residue
3. prove it in another real domain before declaring it canonical
4. migrate competing implementations rather than preserving parallel meanings

Do not build speculative platform components for hypothetical future consumers.

### Primitive maturity

`candidate`

- exactly one proven domain consumer
- designed so the domain does not own generic semantics unnecessarily
- may still change as a second domain exposes the real boundary

`canonical`

- at least two distinct domain consumers
- shared semantic contract is proven by use, not prediction
- competing local implementations of the same concept should be removed

`foundation`

- low-level primitive used broadly enough that its contract is part of the platform foundation

A candidate that gains a second domain consumer must be reviewed for promotion. It may not silently remain a one-domain experiment while being reused elsewhere.

### Primitives do not own domain authority

Presentation and interaction primitives are consumer-owned. They receive state and callbacks from their domain composition.

They may not import:

- domain services
- page implementations
- Supabase clients
- domain RPC clients

For example, `MediaTimeline` may know `time_point`, `time_range`, markers, duration, and selection. It must not know `audio.publication_versions`, `review_audio`, or the Audio route hierarchy.

### Domain workspaces remain purpose-built

Article, Playlist, Audio, Video, Charts, Registry, and future cultural workspaces are allowed to remain structurally different.

The goal is not a universal content editor. The goal is one meaning for shared concepts.

A primitive must not flatten domain-specific workflow simply to increase reuse.

### Every milestone declares primitive impact

A product or engineering milestone should record:

- reused primitives
- new candidate primitives
- candidates promoted to canonical
- existing primitives extended by new field learning
- intentionally domain-specific implementation retained outside the primitive layer

The question is: what did WAKILISHA learn from this deployment, and where does that learning now live?

## Current learned primitive set

The machine-readable source is `scripts/control-plane/primitive-registry.json`.

Current canonical Admin Studio proof includes Article, Playlist, and Audio consumers for:

- `AdminRecordHeader`
- `AdminStatusBadge`
- `AdminSaveState`
- `AdminCollectionHeader`

Current Audio-proven candidates include:

- `AdminWorkspaceSection`
- `AdminModeComposer`
- `EditorialWorkflowRail`
- `EditorialCommentEditor`
- `MediaTransport`
- `MediaTimeline`

The Audio candidates are deliberately not declared canonical merely because they were written generically. Phase 6B and later Video work should either reuse them, extend them from real requirements, or document why the new concept is genuinely different.

## CI enforcement

The Critical Control Plane runs `scripts/control-plane/verify-primitive-compounding.mjs` and `test/control-plane/primitive-compounding.test.ts`.

The gate enforces:

- registered primitive paths exist
- primitive IDs and paths are unique
- maturity and kind are valid
- declared consumers match real imports in governed surfaces
- candidates have exactly one proven domain consumer
- canonical primitives have at least two distinct domain consumers
- consumer-owned primitives do not import domain services, pages, or the Supabase client
- known competing local implementations of reserved concepts are rejected
- new files added under governed Admin or Editorial design-system directories must be registered

The verifier intentionally does not claim it can infer semantic equivalence perfectly. That remains an engineering review responsibility. CI verifies that declared primitive intent is structurally true and blocks known forms of silent duplication.

## Phase 6B rule

The first Phase 6B Public Audio implementation must start by reusing the Phase 6A authority and the proven primitive set.

Phase 6B must not create:

- another Audio publication authority
- another Media delivery authority
- another transcript store
- another review/comment model
- another player stack merely because public presentation differs from Admin Studio

When the public Audio surface creates a genuinely reusable capability, it should enter the registry as a candidate in the same milestone.

When it becomes the second real consumer of an existing candidate, that primitive should be promoted or explicitly rejected as semantically different.
