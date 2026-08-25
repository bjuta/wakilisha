# Phase 7A Video Publication Authority Kickoff

Status: OPEN

Opened: 25 August 2026

Production runtime application baseline: `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`

Current production migration head: `20260825102000`

Current production migration count: `50`

Predecessor closure:

`docs/engineering/phase-6b-closure-record.md`

## Purpose

Phase 7A builds canonical Video publication authority and the internal Video production product.

It does not build a second Media platform and it does not prematurely build the public Video product. Phase 7B owns public Video delivery.

The long-form programme already defines Video as a typed domain with series, episode, rendition, caption, and chapter semantics. Phase 7A implements that contract on top of the platform WAKILISHA has already proved.

## Phase 7A scope

Build canonical authority for:

- standalone videos
- Video series
- Video episodes
- documentary classification
- interview classification
- performance classification
- explainer classification
- field-footage classification
- canonical Video Editor
- finished-master selection or governed upload
- master and derivative/rendition management
- poster authority
- chapters
- captions
- transcript
- Credits
- Citations
- immutable submitted/approved/published Video versions
- governed Review and publication lifecycle
- Corrections and provenance continuity
- lifecycle/version History

## Explicit reuse boundary

Phase 7A must reuse rather than rebuild:

- global Resource identity
- command/idempotency/concurrency authority
- jobs and transactional outbox
- Media logical assets, immutable file objects and variants
- resumable upload and durable processing
- caption and transcript Media kinds
- signed/protected delivery foundations where internal preview needs them
- shared Credits and Citations
- shared Review semantics
- shared Corrections and provenance
- Registry linking
- canonical editorial primitives already promoted through Article, Playlist and Audio
- production migration replay, verifier, CI and deployment controls

## Domain-specific Video semantics that remain Video-owned

Reuse must not flatten Video into Audio or a generic CMS object.

Video owns:

- standalone / series / episode hierarchy
- Video-specific publication classifications
- rendition requirements
- poster selection semantics
- caption-track semantics
- Video chapters
- Video preview/presentation needs
- Video-specific validation required before review/publication

## Out of scope for 7A

Do not build in this phase:

- public Video routes
- public responsive streaming product
- public Video discovery/search
- public Video SEO/prerender product
- a second upload system
- a second Media processor
- a second caption/transcript store
- a second Trust/Review/Corrections system
- Field Capture intake
- speculative provider distribution

Those belong to existing shared platforms, Phase 7B, Phase 8, or later evidence-driven work.

## First implementation boundary

Before writing Video SQL:

1. audit protected `main` at the Phase 7A opening baseline
2. inventory existing Video-like tables, routes, components, Media kinds, upload/processing seams, and legacy authority
3. classify each seam as reuse, migrate, retire, or preserve
4. define the smallest canonical Video Resource + working-version contract
5. state primitive impact explicitly
6. decide whether the first implementation requires SQL
7. if SQL is required, replay the full production migration baseline in one disposable preview before applying candidate SQL
8. preserve preview-proven SQL byte identity through promotion

Do not infer the Video schema from Audio table names. Reuse concepts, not accidental implementation shape.

## Phase 7A exit proof

Phase 7A closes only when one real Video publication can, through the canonical internal workflow:

- exist as the correct Video Resource kind
- bind an exact governed master/revision
- expose required processed rendition authority
- attach a governed poster
- carry captions
- carry transcript authority where applicable
- carry chapters where applicable
- attach shared Credits and Citations
- submit an immutable version for review
- receive a governed review decision
- reach an immutable published Video version
- preserve version History and correction/provenance continuity
- remain reconstructable without relying on mutable draft state

Public viewing across desktop/mobile is intentionally not the 7A exit gate. That is Phase 7B.

## Primitive compounding requirement

Every implementation slice must record whether it:

- reuses an existing primitive
- creates a candidate primitive from a real Video need
- promotes a candidate after second-domain proof
- extends an existing primitive from new field learning
- deliberately retains Video-specific implementation

Do not build a universal screen. Do not rebuild a concept WAKILISHA already learned.

## Deployment classification

This kickoff is documentation only.

- SQL migration needed: No, not for the kickoff itself
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- Frontend deploy needed: No
- production runtime change needed: No

## Next action

Run the **Phase 7A existing Video authority and surface audit** from exact protected main before designing the first implementation candidate.
