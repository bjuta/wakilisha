# Phase 6B Public Audio Kickoff

Status: CLOSED

Status date: 25 August 2026

Production runtime application baseline: `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`

Current production migration head: `20260825102000`

Current production migration count: `50`

Opened: 21 August 2026

Phase 6A production authority baseline: `fd0580e3a1a19e3d1f06a9c8466a37c84cd26a8b`

Phase 6B governance gate: PR #684, `Enforce primitive compounding and open Phase 6B`

Documentation closure gate: PR #699, `Reconcile Phase 6B milestone closure records`

## Current Phase 6B position

**Phase 6B is closed as of 25 August 2026.**

M1 and M2 remain closed and are not reopened by this decision. The accepted post-M2 convergence interval now extends through the structured Track Lyrics stanza/provenance closure merged in PR #706.

The programme owner has retired the earlier real-podcast exercise as a **Phase 6B blocking gate**. This is a governance change, not a false claim that the exercise occurred. At closure, production still contained the real episode `Monday Morning in September` as a draft. Publishing that episode, validating its RSS externally, and exercising transcript-correction history remain useful Audio operational acceptance work, but they no longer block programme numbering.

Canonical closure record:

- `docs/engineering/phase-6b-closure-record.md`

The numbered programme now continues at **Phase 7A: Video publication authority**.

See:

- `docs/engineering/phase-7a-video-publication-authority-kickoff.md`
- `docs/roadmap/wakilisha-master-programme-map.md`
- `docs/institute/PROGRAMME_STATUS.md`

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

## Historical first implementation boundary (M1, closed)

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

## M1 acceptance target (satisfied)

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

## Phase 6B closure disposition

Phase 6B is closed.

Accepted production authority includes:

- governed public Audio read contracts
- canonical Show / Show Episode identity and routes
- RSS and branded enclosure delivery
- stable GUID and enclosure identity
- desktop and mobile persistent-player Audio behavior
- public Audio discovery
- shared Credits, Citations, Trust, Review, Corrections, and provenance foundations
- version-bound Transcript and Chapter authority
- the post-M2 editorial/player/discovery convergence baseline
- governed Track Lyrics authority, contribution/review provenance, and structured stanza preservation

The prior real-podcast exit exercise is retained as non-blocking operational acceptance rather than a prerequisite for Phase 7A.

Production closure baseline:

- repository main: `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`
- production migrations: `50`
- migration head: `20260825102000`
- production frontend entry: `assets/index-COVa-f0y.js`

## Next programme move

Open **Phase 7A: Video publication authority** from the existing long-form programme contract. Do not build the public Video product in 7A; that remains Phase 7B.

Phase 7A must reuse the platform WAKILISHA has already learned: Resource identity, commands, immutable versions, Media, upload/processing, Trust, Review, Corrections, provenance, editorial primitives, and the production-control workflow.
