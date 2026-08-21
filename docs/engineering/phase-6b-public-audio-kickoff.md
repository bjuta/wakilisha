# Phase 6B Public Audio Kickoff

Status: OPEN

Opened: 21 August 2026

Phase 6A production authority baseline: `fd0580e3a1a19e3d1f06a9c8466a37c84cd26a8b`

Phase 6B governance gate: PR #684, `Enforce primitive compounding and open Phase 6B`

Starting production migration head: `20260821095406`

## Purpose

Phase 6B turns the accepted Phase 6A Audio authority into the public Audio product.

It does not rebuild Audio. It exposes the already governed Audio model safely and composes public experiences over the authority, Media, Trust, Review, Corrections, and identity foundations already in production.

## Phase 6B programme scope

Build:

- public Show routes
- public Episode routes
- public Standalone Audio routes where the product requires them
- accessible Audio playback
- chapter navigation
- transcript navigation
- RSS XML generation and delivery
- stable GUID and enclosure presentation
- public Credits, Citations, provenance, and review-derived state where appropriate
- public Corrections presentation and correction continuity
- scheduling behavior
- public Audio search
- SEO and prerender/public metadata
- cached or stable public read models
- global-player integration without breaking Track playback semantics

## Starting constraints inherited from Phase 6A

Phase 6B must reuse:

- canonical `audio` domain identity and versions
- typed Audio Resource bindings
- existing Review and publication lifecycle
- canonical Media assets, revisions, variants, waveform data, and public delivery
- Transcript Media authority
- shared Credits and Citations
- existing Corrections authority rather than a new Audio correction system
- stable GUID and enclosure identity
- existing global player infrastructure where a safe Audio adapter is possible

Phase 6B must not create a second:

- Audio uploader
- Audio storage system
- Audio processor
- Audio transcript store
- Audio Trust store
- Audio review model
- command ledger
- outbox
- Resource identity system

## Primitive compounding boundary

Phase 6B is the first numbered phase governed from kickoff by `docs/engineering/primitive-compounding-contract.md`.

Every Phase 6B milestone must state its primitive impact.

The public product should reuse Phase 6A candidate primitives when they represent the same concept. A second real domain or surface consumer is the moment to promote a candidate to canonical, not an excuse to fork it.

In particular, evaluate before creating alternatives to:

- `MediaTransport`
- `MediaTimeline`
- `EditorialCommentEditor` where public read-only discussion presentation is needed
- lifecycle/status presentation primitives where Admin semantics cross safely into public presentation

Public Audio is allowed to be visually and structurally different from Admin Studio. Reuse is required only where the concept is genuinely the same.

## Recommended first implementation boundary

Begin Phase 6B with the public read contract before building the whole public experience.

### M1: published Audio public-read and route foundation

Prove the smallest stable public contract for a published Audio publication:

- only the exact current published version is public
- unpublished/draft/review state cannot leak through the public read path
- Show / Season / Episode / Standalone identity resolves canonically
- public slugs and route identity are deterministic
- canonical full-length Audio delivery is returned through the existing Media authority
- chapter data is version-bound
- transcript identity is version-bound and public-safety checked
- public Credits/Citations are read from shared Trust authority
- stable GUID and enclosure identity survive the read boundary
- anonymous/public execution is narrowly granted only to the intended read contract
- permanent verifier proves the public boundary

Do not generalize the global player, build RSS, or redesign every public Audio screen in M1 unless the read-contract proof genuinely requires it.

## M1 acceptance target

Before the first Phase 6B implementation PR is opened:

1. audit the exact current public route and read-model seams from protected `main` after PR #684
2. define the smallest public read contract
3. identify primitive reuse and primitive impact explicitly
4. keep the migration additive and narrow if SQL is required
5. replay the complete production migration baseline in a disposable preview before applying new SQL
6. prove the new read contract in preview
7. run a permanent read-only verifier
8. prove anonymous access is no broader than intended
9. keep the exact preview-proven SQL bytes through promotion
10. run focused, critical, build, schema, and production smoke gates through the normal deployment workflow

## Phase 6 exit gate

Phase 6 remains open until one real podcast episode:

- moves through the governed Audio workflow
- publishes publicly
- has valid RSS
- preserves stable GUID and enclosure identity
- works on desktop and mobile
- exposes required Credits and Trust presentation
- proves that a transcript correction preserves prior history

Phase 6A is closed. Phase 6B now owns this remaining exit gate.
