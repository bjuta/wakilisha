# Phase 7A Video Publication Authority Kickoff

## Current Phase 7A state - CLOSED 31 August 2026

Phase 7A Video publication authority is production accepted.

The real exit-gate Video `Monday Morning in September` completed the canonical internal workflow through:

- working v5
- submitted v6
- approved v7
- published v8

The final published v8 carries exact native Video Media authority and one governed Sheng closed-caption track using `und-x-sheng`, while the earlier published v4 remains preserved in immutable history.

The real workflow exposed and closed bounded gaps in Media governance placement, native source integrity, deferred Resource binding authority, post-publication revision UI, review-action lineage, and private-use caption language tags.

Final production authority:

- accepted production/frontend main: `a8e10350dccd5a5b1cd5b49001a4cf8839a76bd9`
- migrations: `75`
- head: `20260831080826_video_caption_language_private_use_tags`
- frontend entry: `assets/index-S6v7xwyD.js`
- frontend entry SHA-256: `e878fec7815bfd014c50d3f3273259f5f74e5aeb63a3f918060bb1f0eb16ae74`

Canonical closure record:

`docs/engineering/phase-7a-closure-record.md`

Do not reopen Phase 7A to build public Video presentation. The next numbered phase is Phase 7B Public Video product.

Status: CLOSED - PRODUCTION ACCEPTED

Opened: 25 August 2026

Architecture audit locked: 26 August 2026

Programme documentation baseline: `8f6bd2be1f4159fb21a34b71290c8879931cdd49`

Production runtime application baseline: `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`

Current production migration head: `20260831080826`

Current production migration count: `75`

Predecessor closure:

`docs/engineering/phase-6b-closure-record.md`

Canonical Phase 7A audit:

`docs/engineering/phase-7a-video-authority-and-primitives-audit.md`

Canonical Phase 7A schema design:

`docs/engineering/phase-7a-video-authority-schema-design.md`

## Purpose

Phase 7A builds canonical Video publication authority and the internal Video production product.

It does not build a second Media platform and it does not prematurely build the public Video product. Phase 7B owns the public Video product.

The audit establishes that WAKILISHA is not starting Video from zero. Resource identity, cross-media Show identity, canonical Media, native Video upload/processing, provider playback residue, Trust, Corrections, provenance, and substantial editorial primitives already exist.

Phase 7A must compose and extend those foundations instead of rebuilding them.

## Locked ten-year model

Standalone Audio and standalone Video are first-class cultural objects. Neither requires a Show.

A Show is an optional cross-media thematic collection.

Phase 6B already created canonical shared authority in:

- `editorial.shows`
- `editorial.show_episodes`
- Resource kind `show`
- Resource kind `show_episode`

The original Phase 6B migration explicitly defines public Show identity as cross-media, with Audio as the first real consumer and future media verticals required to bind to the same Show authority.

Therefore Phase 7A must not create a competing `video_series`, `video_show`, or `show_journey` authority.

Video becomes the second real consumer of the shared Show / Show Episode model.

A Video may be:

- standalone, with no Show binding
- a Video expression of a shared Show Episode
- provider-backed or native without changing its cultural identity

Listen / Watch journeys are initially derived presentation over typed Show content. They are not separate stored objects until real product requirements prove otherwise.

## Phase 7A scope

Build canonical authority for:

- standalone Video publications
- Video Episode publications bound to shared Show Episode identity where applicable
- documentary classification
- interview classification
- performance classification
- explainer classification
- field-footage classification
- canonical Video Editor
- selected Video Source authority
- finished-master selection or governed native upload
- provider-backed Video source representation
- master and derivative/rendition management through canonical Media
- poster authority
- chapters
- closed captions
- subtitles
- forced subtitles
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
- existing shared Show / Show Episode identity
- command/idempotency/concurrency authority
- jobs and transactional outbox
- Media logical assets, immutable file objects and variants
- resumable upload and durable processing
- Media governance, rights, consent, embargo, sensitivity, preservation, and retention
- Media usage links
- caption and transcript Media file handling
- signed/protected delivery foundations where internal preview needs them
- shared Credits and Citations
- shared Review meaning and decision interaction grammar
- shared Corrections and provenance
- Registry linking
- version-bound Discovery metadata
- canonical editorial primitives already proved through Article, Playlist, Audio, and Lyrics
- production migration replay, verifier, CI, and deployment controls

## Shared Show boundary

A Show owns thematic/editorial identity and grouping.

A Show does not own Audio or Video delivery semantics.

Shared Show authority may contain Audio and Video expressions through typed bindings.

Where Audio and Video represent the same editorial episode, both may bind to the same `show_episode` identity.

Phase 7A should make shared Show authority usable by Video without duplicating the existing Audio Show implementation.

Audio-specific RSS/feed semantics remain Audio-owned.

Video-specific source/rendition/caption semantics remain Video-owned.

## Video Source boundary

A Video cultural object must not be defined by its hosting provider.

Phase 7A introduces a candidate Video Source contract capable of representing at minimum:

- canonical native Media asset/revision and selected rendition authority
- YouTube provider identity
- Vimeo provider identity
- future providers without creating new Video publication types

The source contract should expose playback/provider capabilities instead of making every UI surface infer provider behavior independently.

A YouTube clip embedded in an Article does not automatically become a standalone WAKILISHA Video publication. It may consume the same source/presentation infrastructure while remaining an Article attachment.

## Caption, subtitle, and transcript boundary

Captions are publication authority in 7A, not later UI polish.

Video must distinguish:

- closed captions: accessibility timed text including relevant speaker and sound cues
- subtitles: timed dialogue / translation text
- forced subtitles: partial required timed text

Each timed-text track requires stable identity, language, label, kind, selection/default semantics, exact Video-version binding, and correction/history continuity.

Caption/subtitle file bytes remain canonical Media.

The semantic track relationship belongs to Video.

Transcript authority remains distinct from caption-track authority.

Do not create a second caption or transcript file store.

## Domain-specific Video semantics that remain Video-owned

Reuse must not flatten Video into Audio or a generic CMS object.

Video owns:

- standalone / Video Episode distinction
- Video-specific publication classifications
- Video Source selection
- rendition requirements and readiness rules
- poster selection semantics
- caption/subtitle track semantics
- Video chapters
- Video preview/presentation needs
- Video-specific validation required before review/publication
- typed immutable Video content snapshots

## Primitive compounding decisions

### Reuse directly

- `AdminRecordHeader`
- `AdminRecordActions`
- `AdminStatusBadge`
- `AdminSaveState`
- `AdminWorkspaceSection`
- `AdminCollectionHeader`
- `EditorialWorkflowRail`
- `EditorialDecisionWorkspace`
- `EditorialTextDiff`
- `EditorialMetadataWorkspace`

### Existing candidates Video should become the second consumer of

- `AdminModeComposer`
- `EditorialCommentEditor`
- `MediaTransport`
- `MediaTimeline`
- `EditorialCreditPicker`

Each must be reviewed for promotion after real Video use proves the shared contract.

### Existing authority candidate Video should promote

- shared Show / Show Episode identity

### New candidate primitive

- provider-neutral Video Source resolution/playback capability contract

### Foundation extension

- generic Media usage target/version validation so Video becomes a normal governed Media consumer rather than another domain-specific bypass

### Convergence question that must be answered before duplication

Playlist and Audio already repeat substantially the same review-event meaning while `editorial.resources` owns shared lifecycle pointers.

Do not add `video_review_events` by reflex. Evaluate shared Resource review/lifecycle event convergence while keeping typed Video version snapshots domain-owned.

## Existing Video compatibility that must survive

Phase 7A implementation must preserve current published behavior for:

- Article YouTube/Vimeo/iframe Video
- Artist Videos
- global Player provider behavior
- YouTube CSP support
- existing native Media Video assets and URLs
- existing Audio Show / Show Episode routes and RSS

Legacy/provider Video convergence must be progressive and reversible.

Do not rewrite published Article HTML merely to claim normalization.

## Out of scope for 7A

Do not build in this phase:

- public Video routes
- complete public responsive streaming product
- public Video discovery/search
- public Video SEO/prerender product
- a second upload system
- a second Media processor
- a second caption/transcript store
- a second Trust/Review/Corrections system
- ordinary end-user Video upload
- Field Capture intake
- speculative provider distribution

Those belong to existing shared platforms, Phase 7B, Phase 8, or later evidence-driven work.

Ordinary user Video ingress must eventually enter through governed Media ingress policy, not weakened Media-management authority or a separate user-video storage stack.

## First implementation boundary

The read-only Video authority/surface audit is complete.

The accepted schema design must cover:

1. Video Resource kinds and typed working publication identity
2. standalone Video and Video Episode distinction
3. Video binding to existing shared Show / Show Episode authority
4. selected Video Source contract
5. native Media source binding
6. provider-backed source representation without provider-specific publication types
7. version-bound Media usage roles and target validation required by Video
8. immutable Video version snapshot foundation
9. caption/subtitle track identity foundation
10. permanent read-only verifier contract
11. primitive impact declaration

Do not infer the Video schema from Audio table names. Reuse stable concepts, not accidental implementation shape.

If SQL is required, the established deployment workflow applies without exception:

- exact clean candidate from accepted main
- focused static tests
- exact changed-file scope
- one disposable Supabase preview
- full migration-history baseline replay before candidate SQL
- candidate SQL only after healthy baseline
- permanent read-only verifier
- fixture/behavior proof and cleanup
- preview-proven SQL byte-identical through promotion
- PR and protected CI
- production SQL separately
- independent production verifier
- frontend/Edge only after database authority
- production smoke
- cleanup while retaining intentional rollback evidence

## Adaptive Video delivery gap

Current Media processing already proves native Video upload, technical inspection, MP4 transcode, poster frame, and thumbnail generation.

There is no current HLS/m3u8 authority.

Adaptive streaming renditions and orientation-aware output are genuine Phase 7 capability gaps.

Their processing/variant authority belongs in Media.

Phase 7A must define enough rendition readiness for exact-version internal review and publication authority. Phase 7B owns the complete public adaptive-streaming experience.

## Phase 7A exit proof

Phase 7A closes only when one real Video publication can, through the canonical internal workflow:

- exist as the correct Video Resource kind
- remain standalone or bind correctly to shared Show / Show Episode identity
- bind an exact governed native or provider Video Source
- expose required processed rendition authority for its source type
- attach a governed poster where applicable
- carry at least one governed caption/subtitle track
- carry transcript authority where applicable
- carry chapters where applicable
- attach shared Credits and Citations
- submit an immutable version for review
- receive a governed review decision
- reach an immutable published Video version
- preserve version History and correction/provenance continuity
- remain reconstructable without relying on mutable draft state

Public viewing across desktop/mobile is intentionally not the 7A exit gate. That is Phase 7B.

## Deployment classification

This schema-design step is documentation only.

- SQL migration needed: No, not for the design lock itself
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- Frontend deploy needed: No
- production runtime change needed: No

## Next action

Do not reopen K5A, K5B, K5C, or K5D.

Credits/Citations and Corrections/provenance continuity are closed for Video.

Use the existing real Video as the Phase 7A exit-gate instrument:

1. save a working snapshot
2. submit the immutable review version
3. perform governed review using existing authority
4. approve
5. publish through governed lifecycle authority
6. record any real Registry, Media, readiness, or lifecycle gap exposed by that path
7. close only those proved gaps
8. complete the real Video publication

Do not create a synthetic Registry milestone or new Video-owned authority merely to extend the programme. `EditorialCommentEditor` remains candidate unless real Video review proves matching rich comment authority is needed.

Phase 7B remains the public Video product.

Canonical K5D closure record:

`docs/engineering/phase-7a-k5d-video-correction-provenance-convergence-closure-record.md`