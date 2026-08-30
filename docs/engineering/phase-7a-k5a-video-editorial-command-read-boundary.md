# Phase 7A K5A — Video Editorial Command and Admin Read Boundary

Status: IMPLEMENTATION CONTRACT LOCKED

Opened: 30 August 2026

Opening protected main:

`bd5cb925985c56b8e9f006c7b5b8151073cfe3d2`

Opening production database:

- migrations: `65`
- head: `20260830082941_phase_7a_post_kernel_business_logic_and_historical_event_hardening`
- final Resource kernel verifier: PASS

## Why K5A exists

The Phase 7A Video schema and lifecycle kernel already exist in production.

Accepted authority includes:

- `video.publications`
- immutable `video.sources`
- working caption/subtitle tracks
- working chapters
- immutable Video publication versions
- immutable caption/chapter snapshots
- exact Media usage support for Video
- shared Show Episode binding
- Resource Version registration
- shared Resource lifecycle/review event authority
- governed snapshot / submit / review / publish commands

What is missing is the browser-safe editorial boundary needed to operate that authority.

There is currently:

- no Video admin collection
- no Video admin workspace reader
- no governed create command
- no governed metadata command
- no governed source creation/selection command
- no governed poster/transcript command
- no governed caption-track command
- no governed chapter command
- no Video application service

Building React before this boundary would either force direct table access or duplicate domain authority in browser code.

K5A closes that gap.

## Boundary

K5A is a database-command/read and application-service milestone.

It does **not** build the Video Editor UI.

It must make the future Video Editor a thin consumer of governed authority rather than a second authority.

K5A ships:

1. Video publication create command
2. Video metadata update command
3. immutable provider-neutral Video Source create command
4. selected-source command
5. exact poster Media command
6. exact transcript Media command
7. caption/subtitle replacement command
8. chapter replacement command
9. admin Video collection read
10. exact Video workspace read
11. TypeScript Video admin service over those RPCs
12. permanent verifier and focused tests

Existing K4B lifecycle commands remain the only Video snapshot/review/publish authority.

## Explicitly outside K5A

K5A does not ship:

- Video Editor React composition
- Video Review React composition
- public Video reads
- public Video routes
- adaptive Video processing redesign
- Show or Show Episode creation/editing
- a Video-owned Show/Series authority
- a second Trust system
- a second Discovery system
- a second Media picker
- a Video-specific review-event ledger
- Corrections UI
- provider health/takedown observation model
- speculative user-upload policy

These remain later Phase 7A slices unless an implementation invariant makes one unavoidable.

## Authority contract

### Resource lifecycle

Canonical:

- `editorial.resources`
- `editorial.resource_versions`
- `editorial.resource_lifecycle_events`
- `editorial.resource_review_events`

K5A must not add typed lifecycle pointers or typed Video lifecycle/review event tables.

### Video publication

Canonical working Video identity remains:

`video.publications`

Publication kinds:

- `standalone`
- `episode`

Resource kinds:

- `standalone_video`
- `video_episode`

Every Video publication must have exactly one `editorial.video_publication_resources` binding.

### Shared Show Episode

Video Episode membership uses:

`editorial.video_episode_shared_links`

The selected shared identity is:

`editorial.show_episodes.resource_id`

K5A may bind a Video Episode only to an already-existing shared Show Episode.

K5A does not expose independent Show mutation.

This makes Video the second real media consumer of shared Show / Show Episode authority without creating `video_series` or `video_show`.

### Video Source

`video.sources` remains immutable Video-owned source identity.

Supported source kinds:

- `native_media`
- `external_provider`

Native source:

- exact canonical Media asset
- exact Media revision
- asset kind `video`
- verified immutable file revision

Provider source:

- enabled provider key
- stable provider object id
- canonical HTTPS URL
- structured metadata
- no raw iframe authority

Source creation is idempotent by canonical source identity.

Source selection changes the mutable Video publication, not the immutable source row.

For native selected source, the command must maintain exactly one active working `video_master` Media usage whose exact asset/revision matches the selected source.

For provider-selected source, no active working `video_master` usage may remain.

### Poster and transcript

File identity remains Media authority.

Working relationships use exact-revision Media usages:

- `video_poster`
- `video_transcript`

Poster requires exact verified `image` Media.

Transcript requires exact verified `transcript` Media.

Replacement archives the prior active usage rather than retargeting immutable usage identity.

### Captions and subtitles

Typed Video semantics remain in:

`video.caption_tracks`

File identity remains exact `caption` Media revision.

The governed command accepts the complete desired track set and replaces the working set atomically.

Each track carries:

- language tag
- track kind
- label
- default state
- display order
- exact Media asset/revision

The command must also maintain exact `video_caption` Media usage links.

One publication may have at most one default track.

Transcript remains distinct.

### Chapters

Typed Video semantics remain in:

`video.publication_chapters`

The governed command replaces the complete chapter list atomically.

The list must remain:

- numbered contiguously from 1
- ordered by increasing start time
- non-negative
- title-valid

## Command substrate

All K5A mutations use the existing Resource command substrate:

- authenticated actor
- Resource id
- idempotency key
- correlation id
- expected `video.publications.authority_revision`
- stale-write rejection
- durable command receipt
- deterministic replay

New command types:

- `video.publication.create`
- `video.publication.metadata.update`
- `video.source.create`
- `video.source.select`
- `video.poster.set`
- `video.transcript.set`
- `video.captions.replace`
- `video.chapters.replace`

The public RPC surface must expose only narrow governed functions.

No Video table receives browser grants.

## Read contract

### Collection read

`public.list_admin_video_publications()`

Returns the editor-facing collection shape only for Resources the actor may view.

Minimum fields:

- publication id
- Resource id/kind
- publication kind
- resolved title/slug/summary
- classification
- authority revision
- lifecycle state
- selected source summary
- Show / Show Episode summary where applicable
- current working/submitted/approved/published version ids
- updated timestamp

### Workspace read

`public.get_admin_video_publication_workspace(uuid)`

Returns one structured JSON object containing:

- publication
- Resource identity/lifecycle pointers
- resolved standalone or shared-episode editorial identity
- shared Show and Show Episode summaries
- selected Video Source
- provider capability facts
- active working poster usage
- active working transcript usage
- caption tracks
- chapters
- current working/submitted/approved/published Video versions
- available Video classifications
- available source providers
- available caption-track kinds
- actor capabilities

The workspace read must not expose private table write authority.

## Application service

K5A adds:

`src/services/video/videoAdminService.ts`

The service:

- owns RPC serialization/parsing only
- resolves exact current Media revision through the existing admin Media read service
- does not query private Video tables directly
- does not own lifecycle meaning
- uses existing K4B lifecycle RPCs for snapshot/submit/review/publish
- exposes the future Video Editor one typed domain facade

## Discovery / Trust reuse

K2 already extended shared version identity resolution for:

`video_publication_version`

K5A may extend TypeScript Discovery typing/parsing so Video versions can consume the existing shared Discovery service.

K5A does not create Video taxonomy tables or Video SEO authority.

Credits/Citations remain shared editorial authority. If K5A needs an adapter to call an existing generic attachment RPC, it may add only a thin Video service adapter. It must not add Video Credit/Citation tables.

## Primitive impact

### Reused canonical authority

- Resource identity
- Resource Version identity
- Resource lifecycle position
- shared Resource lifecycle/review events
- command/idempotency/concurrency substrate
- Media asset/revision/usage authority
- shared Show / Show Episode identity
- shared Discovery version identity
- shared Credits/Citations authority

### Reused canonical application primitives

K5A is pre-UI, so no React primitive gains a new consumer yet.

The later Video Editor must directly reuse where semantics match:

- AdminRecordHeader
- AdminRecordActions
- AdminStatusBadge
- AdminSaveState
- AdminWorkspaceSection
- AdminCollectionHeader
- EditorialWorkflowRail
- EditorialDecisionWorkspace
- EditorialMetadataWorkspace

### Candidates awaiting actual Video UI evidence

K5A does **not** falsely promote these merely because the future Video service exists:

- AdminModeComposer
- EditorialCommentEditor
- MediaTransport
- MediaTimeline
- EditorialCreditPicker

Promotion requires Video to become a real UI consumer.

### Authority candidate promoted by this milestone

Shared Show / Show Episode becomes a proven cross-media authority in K5A only when a governed Video Episode fixture successfully binds an existing shared Show Episode without disturbing its Audio binding.

The database authority is already shared; K5A provides the second-domain behavioral proof.

### New candidate

Provider-neutral Video Source remains a candidate authority concept.

K5A proves native and provider-backed source identities against one publication model; later repeated use outside canonical Video publication can justify broader promotion.

### Intentionally Video-specific

Remain Video-owned:

- working Video publication metadata
- immutable Video Source identity
- caption/subtitle track semantics
- Video chapters
- immutable Video publication snapshots
- future Video Editor composition

## Security contract

- `video` schema remains private
- no direct `anon` / `authenticated` / `service_role` table mutation grants
- new browser RPCs are `SECURITY DEFINER` only where required
- every privileged RPC performs explicit WAKILISHA capability checks
- default function EXECUTE is revoked from PUBLIC
- only `authenticated` receives execute on intended browser commands/reads
- source URLs are structured HTTPS data, never executable embed HTML
- exact Media revision validation is mandatory
- stale authority revision rejects mutation
- workspace reads require Video view authority
- no public Video read surface is opened

## Acceptance

A disposable preview must prove:

1. exact 65-migration baseline replay
2. current final-kernel verifier PASS before K5A
3. K5A migration apply
4. standalone Video creation
5. provider source creation + selection
6. native exact Video Media source creation + selection
7. native selected source produces matching exact `video_master` usage
8. switching source preserves immutable historical source identity
9. poster set/replacement/clear
10. transcript set/replacement/clear
11. valid caption set including English closed captions
12. invalid non-caption Media rejection
13. one-default-caption invariant
14. valid chapter replacement
15. invalid chapter ordering rejection
16. working snapshot through existing K4B command
17. workspace read reconstructs the same working authority
18. Video Episode creation against one existing shared Show Episode fixture
19. same shared Show Episode can retain its Audio binding
20. no competing Video Show/Series object appears
21. direct private-table access remains unavailable to application roles
22. advisor review
23. generated schema type seal
24. migration replay proof
25. focused tests
26. primitive-compounding gate
27. critical control plane
28. application build

## Exit

K5A closes when:

> an authenticated editor can operate and read the complete working Video publication authority through governed commands, without React code or direct private-table writes, and Video Episode behavior proves shared Show Episode authority as a real second media consumer.

The next Phase 7A slice may then compose the canonical Video Editor over this boundary and perform actual UI primitive promotion from real Video use.


## Implementation vocabulary reconciliation

K2 already reserved the exact command vocabulary that K5A now activates.

The implementation uses these existing names verbatim:

- `video.publication.create`
- `video.publication.metadata.update`
- `video.source.register`
- `video.publication.source.set`
- `video.publication.show_episode.bind`
- `video.publication.poster.set`
- `video.publication.transcript.set`
- `video.publication.captions.replace`
- `video.publication.chapters.replace`

Any earlier shorthand such as “source create” describes the product action only and does not establish a second command type.
