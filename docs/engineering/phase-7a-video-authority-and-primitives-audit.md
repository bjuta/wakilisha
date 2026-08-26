# Phase 7A Video Authority and Primitive Audit

Status: ARCHITECTURE LOCK FOR IMPLEMENTATION

Audit date: 26 August 2026

Repository baseline: `a2acd644ee9800ac373860c834b580982a401fc9`

Production runtime application baseline: `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`

Production migration head: `20260825102000`

Production migration count: `50`

## Purpose

This audit is the mandatory Phase 7A pre-implementation boundary.

It answers four questions before Video schema or UI work begins:

1. what WAKILISHA already built that Video must reuse
2. what existing candidates Video can promote into durable primitives
3. what genuinely new authority Video requires
4. which legacy Video/embed surfaces must converge without breaking published work

The governing rule is the Primitive Compounding Contract:

> Solve the domain problem completely, then preserve the reusable residue. Never flatten the domain merely to manufacture reuse, and never allow the next domain to quietly rebuild a concept WAKILISHA has already learned.

## Executive architecture decision

The ten-year Video model is deliberately small.

WAKILISHA should preserve four stable concepts:

- Resource identity
- typed Audio / Video publication authority
- canonical Media authority
- optional Show collection identity

Standalone Audio and standalone Video are first-class cultural objects. They do not require a Show.

A Show is an optional cross-media thematic collection. It does not become the content and it does not create a second Audio or Video authority.

All native Video, provider-hosted Video, future user-uploaded Video, and future field Video must converge on the same Video and Media infrastructure. Different ingress or delivery providers may change policy and playback, but must not create competing Video object models.

## Critical discovery: shared Show authority already exists

Phase 6B already created the abstraction needed for cross-media Shows.

`20260822131500_phase_6b_m2_shared_show_hierarchy_rss.sql` explicitly states:

- public Show identity is cross-media
- Audio is the first real consumer
- future media verticals must bind to the shared Show instead of creating a competing Show

Production already contains:

- `editorial.shows`
- `editorial.show_episodes`
- Resource kind `show`
- Resource kind `show_episode`
- `editorial.audio_show_shared_links`
- `editorial.audio_episode_shared_links`

The production instance currently has one shared Show:

- `The Sounds of Nairobi`
- slug `the-sounds-of-nairobi`
- one shared Show Episode: `Monday Morning in September`

Therefore Phase 7A must **not create an independent `video_series` authority**.

The shared Show / Show Episode authority is the existing primitive candidate. Video becomes the second real media-domain consumer and should promote that meaning to canonical cross-media authority.

### Show meaning

A Show answers:

> Which cultural pieces belong together under one editorial identity?

It does not answer:

> How is this piece stored or played?

The intended model is:

```text
Show
├── Audio publication / rendition
├── Video publication / rendition
├── Audio publication / rendition
└── Video publication / rendition
```

Where Audio and Video express the same editorial episode, both may bind to one shared `show_episode` identity.

Standalone Audio and Video simply have no Show binding.

No separate persisted `audio journey` or `video journey` object is justified today. Listen / Watch presentation can be derived from the typed members of a Show until a real requirement proves additional journey state is needed.

## Existing Media authority: reuse, do not rebuild

Phase 4 already built a Video-capable canonical Media platform.

Existing production authority includes:

- stable logical Media assets
- immutable exact file objects
- immutable asset revisions
- immutable derivative variants
- governed current-variant selection
- versioned Media governance
- rights, licence, consent, sensitivity, embargo, source-protection, preservation, retention, and public-safety state
- append-only Media events
- explicit usage links
- protected originals and signed private delivery foundations
- resumable upload
- durable processing jobs with retries and dead-letter behavior

Production currently contains three canonical `video` Media assets.

Those Video assets have produced three each of:

- `video_transcode`
- `poster_frame`
- `thumbnail`

Production currently contains six verified `video/*` file objects covering masters and generated transcodes.

Phase 4B already proved a real resumable Video upload, processing to ready state, and governed Video preview playback in production.

### Native Video implication

Phase 7A must use the existing canonical Media upload path for native masters.

Do not create:

- `video_uploads`
- a Video-specific resumable uploader
- a Video-specific file table
- a Video-specific processing queue
- a Video-specific rights store

The current Video processing profile is useful but incomplete for the final product. It produces a bounded MP4 transcode plus poster/thumbnail. Phase 7A may extend Media processing with adaptive Video renditions and orientation-aware output, but that extension belongs to Media processing authority rather than the Video editorial schema.

## Media usage links: strong foundation, extension required

`media.usage_links` is already version-aware and supports:

- logical Media asset identity
- exact Media revision identity
- target authority / kind / id
- target version kind / id
- semantic usage role
- placement metadata
- display order
- alt text, caption, and credit snapshots
- governed usage lifecycle and revision

This is the correct foundation for Video attachments such as:

- native master
- poster
- caption file
- transcript file
- other exact version-bound Video Media

However the generic Media target validator and usage-role vocabulary are historically hard-coded to older domains. Audio had to introduce an Audio-owned usage path without broadening the generic validator.

Video must not repeat that bypass.

Phase 7A should improve the generic Media usage target/version extension point so Video becomes a normal governed consumer.

## Caption, subtitle, and transcript authority

Captions are core Phase 7A publication authority, not Phase 7B polish.

The Video domain must distinguish at least:

- `captions`: accessibility timed text including dialogue plus relevant speaker / sound cues
- `subtitles`: timed spoken-language text, commonly translation or dialogue text
- `forced_subtitles`: partial text shown only where required by the viewing context

Each timed-text track must support:

- stable identity
- language tag
- human label
- track kind
- default / selection semantics
- exact Video version binding
- exact Media asset/revision binding where WAKILISHA owns the file
- timing-compatible cue structure
- review/correction history

Caption/subtitle files remain canonical Media. Their editorial meaning as a selectable track belongs to Video.

A Transcript is not the same object as a caption track.

A Video may simultaneously carry:

- English closed captions
- Kiswahili subtitles
- French subtitles
- English transcript

The compatibility Media Library already recognizes `caption` and `transcript` file kinds. Current production compatibility data contains one caption record and two transcript records.

Do not create a second caption or transcript file store.

## Existing external Video surfaces: preserve, then converge

External Video already exists materially in published WAKILISHA content.

A read-only production audit of the current 208 published Article versions found:

- 101 with YouTube references
- 1 with Vimeo references
- 90 with iframe markup

Existing runtime code already includes:

- YouTube/Vimeo URL detection
- provider thumbnail helpers
- `VideoCard`
- `VideoOverlay`
- Article video embed extraction/presentation
- Artist Videos presentation
- YouTube IFrame playback support in the global Player stack
- CSP support and test coverage for YouTube

These are compatibility and presentation assets, not canonical Video publication authority.

Phase 7A must preserve published Article behavior while progressively routing provider-backed Video through one structured source contract.

Current provider inconsistency must also be resolved deliberately: Vimeo is recognized by Video presentation helpers, but production CSP currently allowlists YouTube rather than Vimeo.

## New primitive candidate: Video Source

The most important genuinely new shared concept exposed by Phase 7A is Video Source identity/resolution.

A Video cultural object must not be defined by where it is hosted.

The source contract must be able to represent, at minimum:

```text
native_media
  -> canonical Media asset
  -> exact Media revision
  -> selected Video rendition(s)

youtube
  -> provider
  -> stable provider object id
  -> canonical provider URL
  -> provider playback capability

vimeo
  -> same provider contract
```

Future providers may extend the same contract without creating new Video publication types.

The source contract should expose capability facts rather than forcing domain UI to infer provider behavior. Examples include:

- seek support
- playback-rate support
- provider caption discovery
- native caption attachment support
- embeddability
- thumbnail/poster availability
- duration availability

This starts as a Phase 7A candidate primitive. It becomes canonical after real native and provider-backed Video consumers prove the contract.

## Native, provider-backed, editorial, and user Video share one model

The following must never become separate canonical domains:

- native WAKILISHA Video
- YouTube Video
- Vimeo Video
- editorial Video
- user-uploaded Video

They are sources or ingress contexts around one typed Video cultural object.

### Provider embed inside another Resource

A YouTube clip embedded in an Article does not automatically become a standalone WAKILISHA Video publication.

It may use the same structured Video Source and presentation infrastructure while remaining an Article Media/embed attachment.

### Standalone Video publication

When WAKILISHA or a user creates a proper standalone Video cultural object, the Video Resource owns editorial identity, lifecycle, Credits, Review, Discovery, Corrections, and provenance. Its selected source may be native or provider-backed.

## Future user-uploaded Audio and Video

Ordinary user Video ingress is not currently built.

The current non-admin Media upload boundary restricts users to their own profile media and requires those profile uploads to be images.

Community Posts are also currently image-oriented rather than canonical rich-Media attachments.

Phase 7A must not weaken Media-management capabilities merely to enable future user Video.

The ten-year ingress model is:

```text
admin upload
user upload
field capture
provider import
      ↓
governed ingress policy
      ↓
canonical Media asset/revision or provider source
      ↓
typed consuming Resource
```

The ingress policy may differ by actor, moderation state, limits, rights requirements, and intended Resource type. The Media identity and processing model do not change.

A shared governed end-user Media ingress policy is a valid future primitive candidate, but should not be built until a real user-upload flow is in scope.

## Existing shared trust and editorial foundations

Video must reuse:

- global Resource identity
- command receipts, idempotency, correlation, and stale-write control
- jobs and transactional outbox
- Credits
- Citations
- Corrections
- provenance
- Registry links
- version-bound Discovery metadata
- canonical taxonomy identity
- Review decision interaction grammar
- History / immutable published snapshot doctrine

Do not create Video-specific substitutes for those concepts.

## Review/lifecycle convergence finding

Production currently contains repeated domain implementations of the same review-event meaning.

For example, Playlist and Audio review-event rows both carry the same core semantic shape:

- resource id
- event sequence
- target version
- result version
- action
- prior state
- resulting state
- reason
- actor
- command receipt
- correlation id
- timestamp

Meanwhile `editorial.resources` already owns shared submitted / approved / published pointers.

Therefore Phase 7A must not create `video_review_events` by reflex.

Before Video review SQL is introduced, the implementation candidate must evaluate whether common Resource review/lifecycle event authority should be extracted/converged while keeping typed Video version snapshots domain-owned.

The rule is:

> Shared lifecycle meaning may converge. Typed Video content snapshots do not become generic blobs.

## Existing interaction primitives Video should reuse

The machine primitive registry already contains mature shared Admin/Editorial grammar.

### Canonical today

Reuse directly:

- `AdminRecordHeader`
- `AdminRecordActions`
- `AdminStatusBadge`
- `AdminSaveState`
- `AdminWorkspaceSection`
- `AdminCollectionHeader`
- `EditorialWorkflowRail`
- `EditorialDecisionWorkspace`
- `EditorialTextDiff`
- `EditorialMetadataWorkspace` / Discovery Workspace

### Candidate today, Video should become second consumer

Phase 7A should reuse and then review for promotion:

- `AdminModeComposer`
- `EditorialCommentEditor`
- `MediaTransport`
- `MediaTimeline`
- `EditorialCreditPicker`

Video must not build `VideoTimeline`, a second rich-comment editor, a second Credit picker, or another mode-composer when the semantic need is the same.

### De-facto shared interaction to formalize

The unified Media Library / Media Picker is already shared product infrastructure and already understands processed Video preview.

Phase 7A should consume it for master, poster, caption, transcript, and related Media selection. Its semantic selection-purpose contract should be extended instead of creating Video-only pickers.

## Shared Show primitive maturity

`editorial.shows` and `editorial.show_episodes` were deliberately built cross-media with Audio as the first consumer.

Video is now the second real domain proof.

Phase 7A should therefore:

1. reuse the existing shared Show / Show Episode authority
2. avoid `video_series` as a competing canonical identity
3. add Video consumer bindings into shared Show Episode identity where a Video belongs to a Show
4. leave standalone Video unbound
5. review shared Show authority for promotion to canonical primitive once Video behavior is proven

No new `show_journey` table is justified.

No new `video_show` table is justified.

No new `video_series` table is justified by current requirements.

## Seasons

Audio currently owns Season semantics because podcast production proved that requirement.

Phase 7A should not automatically create a Video Season table.

If Video Shows need season-owned metadata, artwork, Credits, routes, or lifecycle, that requirement may justify a shared or Video-specific Season model later.

Until real Video work proves that need, Show Episode ordering remains sufficient.

## Video-specific authority that genuinely must exist

Phase 7A still needs typed Video authority for:

- standalone Video publications
- Video episode publications/renditions bound to shared Show Episode identity where applicable
- Video classification such as documentary, interview, performance, explainer, and field footage
- working Video draft state
- immutable submitted / approved / published Video versions
- selected Video Source
- Video source/version fingerprinting
- exact poster semantics
- caption/subtitle track semantics
- Video chapters
- Video-specific validation before review/publication
- Video-specific technical readiness checks
- Video Editor composition

Those should remain typed and should not be forced into Audio tables or a universal content blob.

## Adaptive Video delivery gap

There is currently no HLS / m3u8 authority in the repository.

Current canonical processing proves Video upload and a bounded MP4 transcode. The long-form programme requires adaptive streaming renditions and portrait / landscape / square handling.

That is a genuine Phase 7 capability gap.

The solution belongs in shared Media processing and variant authority, not in Video publication rows.

Phase 7A should define the internal rendition contract needed for exact-version review and preview. Phase 7B owns the full public responsive streaming product.

## Ten-year architecture lock

The durable relationship is:

```text
                         editorial.resources
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
   standalone_audio       standalone_video              show
          │                       │                       │
    Audio authority         Video authority      shared Show identity
                                                      │
                                                show_episode
                                                      │
                                 ┌────────────────────┴────────────────────┐
                                 │                                         │
                           Audio binding                              Video binding
```

And Media remains independent:

```text
                         media.assets
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
    native exact files                     provider source
    + immutable revisions                  YouTube / Vimeo / future
          │                                       │
    variants / renditions                         │
          └───────────────────┬───────────────────┘
                              │
                       Video Source resolver
```

The exact provider-source storage shape may be refined during the schema design, but the separation of cultural Video identity from delivery/source identity is locked.

## Compatibility rules

Phase 7A implementation must preserve:

- current published Article iframe/YouTube behavior
- current Artist Videos behavior
- current global Player provider behavior
- current Audio Show and Show Episode public identity
- `/shows/:showSlug`
- `/shows/:showSlug/:episodeSlug`
- Audio RSS and enclosure behavior
- existing Media URLs and protected originals
- existing Resource ids
- current production migration replay

No implementation may rewrite existing published Article HTML merely to claim provider normalization.

Migration of legacy/provider Video must be progressive and reversible.

## First implementation candidate boundary

The first implementation should be the smallest slice that proves Video identity without building the public Video product.

It should cover:

1. Video Resource kinds and typed working publication authority
2. standalone Video and Video Episode distinction
3. Video binding into existing shared Show / Show Episode identity instead of creating a Video Series authority
4. selected Video Source contract with native Media as the first fully governed source and provider-backed shape represented without duplicating publication identity
5. version-bound Media usage roles/target validation required by Video
6. immutable Video version snapshot foundation
7. caption/subtitle track identity foundation
8. exact primitive impact declaration

It should not yet build:

- public Video routes
- public adaptive player
- public Video discovery
- end-user Video upload
- Field Capture
- provider distribution automation

## Required primitive impact for the first implementation

The candidate must explicitly report:

### Reused foundations

- Resource identity
- command substrate
- jobs/outbox
- Media identity/revision/governance
- Media usage
- Credits/Citations
- Discovery
- Corrections/provenance

### Existing candidates expected to gain Video proof

- AdminModeComposer
- EditorialCommentEditor
- MediaTransport
- MediaTimeline
- EditorialCreditPicker

### Existing authority candidate expected to gain second-domain proof

- shared Show / Show Episode identity

### New candidate primitive

- Video Source resolution/playback capability contract

### Foundation extension

- generic Media usage target/version validation for typed Video consumers

### Potential convergence decision before duplication

- Resource Review/lifecycle events

### Intentionally Video-specific

- Video publication snapshot
- Video classification
- Video caption/subtitle track authority
- Video chapter validation
- Video rendition readiness rules
- Video Editor composition

## Audit conclusion

Phase 7A is not starting from an empty Video system.

WAKILISHA already has most of the expensive infrastructure: Resource identity, shared Show identity, Media preservation, native Video upload/processing, provider playback residue, Trust, Review interaction, Corrections, provenance, and editorial primitives.

The Phase 7A job is to compose those foundations into one durable Video authority, fill the genuine gaps, and use Video as the second domain that forces shared concepts to mature.

Do not rebuild what WAKILISHA already knows.

## Deployment classification

This audit is documentation/governance only.

- SQL migration needed: No
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- Frontend deploy needed: No
- production runtime change needed: No

## Next action

Reconcile the Phase 7A kickoff against this audit, then design the smallest typed Video authority migration and permanent verifier before creating a disposable preview.