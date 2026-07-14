# WAKILISHA Editorial Production System and Inquiry Mode Project Plan

## Status

This document is the current implementation plan for the next phase of WAKILISHA cultural production.

It supersedes the earlier two-workspace Institute pilot plan.

The previous plan treated the Institute as a destination containing its own workspaces. That architecture is now rejected.

## Decision

Do not continue building the Institute as a standalone product, sidebar destination, or collection of duplicate editors.

The Institute will become a capability distributed across the existing WAKILISHA production system.

An Inquiry is the active power-up.

When Inquiry Mode is off, an editor performs its normal production function.

When Inquiry Mode is on, the same editor gains additional institutional capabilities such as:

- starting or attaching an Inquiry
- attaching sources and material
- recording notes and findings
- linking Registry records
- preserving provenance
- submitting reviewable claims
- publishing uncertainty and corrections
- carrying the active Inquiry across WAKILISHA

Inquiry Mode is not the next implementation phase.

Before it can be built responsibly, the canonical production editors and their shared editorial infrastructure must be completed, hardened, tested, and placed into a production freeze.

## Primary objective

Build the WAKILISHA Editorial Production System once, make it reliable enough for the first major season of cultural work, and avoid reopening foundational editor infrastructure during that season.

The production system must enable the team to create, review, publish, update, correct, preserve, and connect real cultural outputs without entering a separate Institute application.

## Product doctrine

### The output is the centre

Work begins in the canonical tool for the output being created:

- Article Editor for articles
- Playlist Editor for playlists
- Audio Editor for podcasts and audio publications
- Video Editor for video publications
- Registry editors for cultural records
- Chart tools for chart data and interpretation
- Media Library for reusable files and preservation masters

The Institute never rebuilds these tools.

### The Institute is a capability

The Institute is the shared set of abilities that makes ordinary editorial production behave institutionally.

It should make WAKILISHA feel deeper, not like a different product.

### Inquiry Mode is progressive enhancement

Turning on Inquiry Mode must reveal additional functionality inside a familiar workflow.

It must not replace the page, open a second editor, or force every output into the same research template.

### One authority per object

Each output and record has one canonical authority.

- Articles live in the article system.
- Playlists live in the playlist system.
- Audio publications live in the audio system.
- Video publications live in the video system.
- Registry facts live in Registry.
- Media files live in Media Library.
- Inquiries own questions, interpretation history, findings, and relationships to work.

### Reusable systems are built once

The following must not be independently reimplemented inside every editor:

- sources
- citations
- revisions
- credits
- review
- provenance
- corrections
- Registry links
- media selection
- publication state

### Real work is the acceptance test

No editor or shared capability is complete because its schema exists or its form saves.

Each phase must produce and publish a real cultural output through the completed workflow.

## Current state

### Article Editor

The Article Editor is the strongest current production tool and will be the reference implementation for the shared editorial core.

It is not considered fully complete until it supports the universal capabilities defined in this plan.

### Playlist

Playlist schema and Institute bridge work exist, but Playlist is not yet a complete canonical WAKILISHA publishing product.

The current implementation is structurally tied to the old Institute through Institute-specific links, permissions, routes, and workspace assumptions.

Playlist must be separated from the Institute and completed as a standalone production vertical before Inquiry Mode is added.

### Media Library

The shared media service already recognises image, document, audio, video, archive, and other file kinds.

The current Media Library interface only accepts images and PDFs.

The media data model is therefore ahead of the production interface.

The Media Library must be completed rather than replaced by separate image, audio, and video libraries.

### Audio and video

There are currently no complete canonical Audio Editor or Video Editor workflows.

These must be built as publishing systems, not browser-based production studios.

WAKILISHA will ingest finished masters, organise them, process derivatives, review them, publish them, syndicate them where necessary, and preserve their provenance.

### Citations, corrections, and provenance

These are not optional Institute extras.

They are shared editorial infrastructure required by articles, playlists, audio, video, Registry, charts, and future Inquiry Mode.

## Canonical output set for the first cultural season

The first production freeze must include four canonical editorial outputs.

## 1. Article

The Article Editor remains the reference editor.

Required completion work:

- reusable sources and citations
- immutable review and publication revisions
- universal review lifecycle
- contributor and editorial credits
- Registry entity links
- meaningful publication, update, review, and correction dates
- correction cases and public correction notes
- reliable preview
- safe scheduling and publishing
- public provenance presentation
- recovery from interrupted saves

Completion proof:

- publish one real article
- submit it through review
- materially update or correct it
- confirm the public page shows the correct provenance without treating technical metadata changes as editorial updates

## 2. Playlist

Playlist becomes a canonical WAKILISHA product independent of the Institute.

Required editor capabilities:

- create and edit playlist metadata
- title, slug, description, cover, curator, and credits
- search and select Registry tracks
- attach Registry releases and artists where relevant
- add external provider tracks where Registry records do not yet exist
- server-side provider normalisation
- match against Registry tracks and provider identities
- external-only pending items
- missing record suggestions
- drag-and-drop ordering
- duplicate detection
- per-track editorial notes
- per-track sources and citations
- curatorial argument
- preview
- review submission
- approval, scheduling, publishing, archiving, and restoration
- revision history
- public corrections and missing-track suggestions
- complete public playlist page
- mobile and desktop playback behaviour
- public SEO and sharing metadata

Required public behaviour:

- stable `/playlists` and `/playlists/:slug` routes
- no draft or rejected content exposure
- links to matched artists, tracks, and releases
- public curator and contributor credits
- meaningful published, updated, reviewed, and corrected dates
- compact provenance and source presentation

Completion proof:

- publish one real editorial playlist
- include at least one Registry-matched track
- include at least one track requiring provider normalisation or review
- process it through review and publication
- verify public playback, internal links, provenance, and mobile behaviour

## 3. Audio

Audio supports standalone audio publications and podcast production.

Required content model:

- audio shows
- seasons where applicable
- episodes
- trailers and bonus episodes
- standalone audio publications
- stable episode identifiers and slugs
- episode and season numbers
- artwork
- hosts, guests, producers, editors, and contributors
- explicit-content designation
- publication and review state

Required editor capabilities:

- upload or select a finished audio master
- resumable large-file upload
- processing status
- duration and technical metadata
- streaming derivative
- optional download derivative
- preservation master
- show notes
- chapters and timestamps
- transcript
- caption or transcript file upload
- source and citation attachment
- Registry links
- credits
- preview
- review, scheduling, publishing, archiving, and restoration
- corrections to metadata, audio, show notes, and transcript

Required public capabilities:

- accessible audio player
- chapter navigation
- transcript
- show notes and sources
- credits
- related Registry records and publications
- meaningful provenance dates
- correction history where appropriate
- podcast RSS feed
- stable GUID and enclosure URL behaviour

Completion proof:

- publish one complete podcast or audio episode
- validate playback and transcript
- validate RSS output in at least one external podcast feed validator or client
- apply one controlled metadata or transcript correction and verify public provenance

## 4. Video

Video supports standalone videos and series-based publishing.

Required content model:

- standalone video
- video series
- series episodes
- documentary
- interview
- performance
- explainer
- field footage
- editorial status and publication state

Required editor capabilities:

- upload or select a finished video master
- resumable large-file upload
- processing status
- adaptive streaming derivatives
- preservation master
- poster frame and thumbnails
- portrait, landscape, and square format handling
- duration, dimensions, and technical metadata
- chapters
- captions
- transcript
- credits
- source and citation attachment
- Registry links
- rights, sensitivity, and embargo controls
- preview
- review, scheduling, publishing, archiving, and restoration
- corrections to metadata, captions, transcript, and public context

Required public capabilities:

- accessible streaming player
- captions
- transcript
- chapters
- poster and responsive presentation
- credits
- sources where appropriate
- related Registry records and publications
- meaningful provenance dates
- correction history where appropriate

Completion proof:

- publish one complete video
- verify adaptive playback on desktop and mobile
- verify captions and transcript
- verify public provenance and correction handling

## Shared editorial core

The shared editorial core is built once and consumed by every canonical editor.

## Sources

A source is a reusable record representing material used in editorial work.

Supported source types must include:

- interview
- book
- article
- archive document
- photograph
- audio recording
- video recording
- Registry record
- community memory
- government or institutional document
- social post
- dataset
- website
- physical artefact
- other reviewed source

A source must support, where relevant:

- title
- source type
- creator or author
- publisher or custodian
- source URL
- Media Library asset
- archive identifier
- publication date
- capture date
- retrieval date
- language
- country and place
- rights status
- consent status
- sensitivity
- reliability note
- credit line
- linked Registry entities
- internal notes
- review status

## Citations

A citation identifies the exact portion of a source used by an output.

A citation may point to:

- page
- paragraph
- quotation
- timestamp
- chapter
- image frame
- spreadsheet row or cell
- archive identifier
- transcript range
- section heading
- whole source when a narrower locator is not possible

Citations must be attachable to:

- article text
- playlist and track notes
- audio show notes and chapters
- video chapters and transcript sections
- Registry changes
- chart methodology and interpretation
- future Inquiry findings

Public citation presentation adapts to the output type.

The data authority remains shared.

## Revisions

Every publishable resource must preserve immutable review and publication revisions.

Draft autosaves may continue updating the active draft.

A new immutable revision is required when:

- work is submitted for review
- a reviewer makes a decision
- work is approved
- work is published
- a material update is published
- a correction is applied
- work is archived or restored where public state changes

Published work must never silently inherit later Inquiry or source changes without editorial review.

## Review lifecycle

The default lifecycle is:

1. Draft
2. Ready for review
3. In review
4. Changes requested
5. Approved
6. Scheduled
7. Published
8. Archived

Review events must record:

- actor
- action
- reason or note
- resource type and ID
- resource revision
- prior state
- resulting state
- timestamp
- requested changes

Review transitions that affect multiple records must use server-side transactional operations.

## Credits

The shared credit system must support:

- author
- editor
- curator
- researcher
- interviewer
- producer
- host
- guest
- camera
- audio
- translator
- photographer
- contributor
- reviewer
- fact checker
- other explicit role

Credits must link to Registry authors, users, or named external contributors where appropriate.

## Provenance

Public provenance cannot rely on generic `updated_at` timestamps.

Required editorial dates and states include:

- first published
- last materially updated
- last reviewed
- corrected
- archived
- restored

A material update changes public meaning, facts, interpretation, structure, or substantive presentation.

A technical save, slug repair, metadata synchronisation, or typo fix must not automatically produce a public material-update claim.

Meaningful actions must generate append-only provenance events.

Provenance events may include:

- created
- submitted for review
- approved
- published
- materially updated
- reviewed without change
- corrected
- archived
- restored
- source added
- source withdrawn
- Registry record changed
- public contribution accepted
- later Inquiry attached
- Inquiry reopened

Not every internal event is public.

Every public editorial change must have an internal provenance event.

## Corrections

Corrections are a shared institutional system, not an article-only form.

A correction case may target:

- article
- playlist
- playlist item or note
- audio episode or transcript
- video or transcript
- Registry artist, track, release, label, genre, person, place, or relationship
- chart or methodology
- future Inquiry finding

Correction flow:

1. Public or internal correction is submitted.
2. A correction case is created.
3. Supporting material is attached.
4. An editor investigates.
5. A decision is recorded.
6. The correction is applied through a new revision or reviewed Registry change.
7. A public correction note is published where appropriate.
8. Related affected resources are flagged for review.
9. The contributor is notified where possible and safe.

Corrections must never directly overwrite public work without a record.

## Registry links

Every canonical editor must be able to link work to relevant Registry entities.

At minimum:

- artists
- tracks
- releases
- labels
- genres
- authors and contributors
- people
- places
- relationships

The Registry remains the authority for reusable cultural records.

Editors may propose corrections or enrichment, but normal editorial workflows must not bypass Registry review and mutate canonical truth invisibly.

## Media platform

The existing Media Library becomes the single media authority for all editors.

Do not build separate image, audio, video, document, or archive libraries.

## Supported media types

The completed Media Library must support:

- images
- PDFs and documents
- audio
- video
- archive files
- caption and transcript files
- other reviewed formats where preservation is justified

## Required media metadata

- original filename
- display filename
- MIME type
- file kind
- size
- dimensions or duration
- technical processing state
- checksum
- content date
- capture date
- upload date
- creator or source
- credit text
- rights status
- consent status
- sensitivity
- embargo
- country and place
- language
- tags
- linked Registry entities
- linked publications
- preservation status
- replacement history
- internal notes

## Upload architecture

Images and small documents may continue using the existing straightforward upload path where reliable.

Audio, video, and other large files require:

- resumable uploads
- chunked transfer
- upload sessions
- retry after network failure
- checksum validation
- direct large-file transfer to storage
- background processing
- visible processing state
- failed-processing recovery
- safe cancellation

Original masters must be preserved separately from public delivery derivatives.

## Audio processing

Required outputs:

- preservation master
- public streaming derivative
- optional downloadable derivative
- duration
- waveform data where useful
- loudness and technical metadata
- transcript and caption assets

## Video processing

Required outputs:

- preservation master
- adaptive streaming renditions
- poster frame
- thumbnails
- duration and dimensions
- captions
- transcript
- technical metadata

## Field Capture

Field Capture is a mobile-first newsroom intake capability for urgent cultural and political material.

The first implementation is live-to-newsroom, not automatic live-to-public broadcasting.

Required capabilities:

- record or select audio, video, image, or document on a phone
- upload immediately
- queue on weak connectivity
- resume after interruption
- enter a short description
- enter time and place where safe
- choose whether identity may be disclosed
- submit anonymously where policy permits
- capture rights and consent information
- mark sensitivity
- set embargo or private handling
- strip unsafe metadata where required
- preserve the immutable original
- confirm successful receipt
- send into editorial review before publication

Political and protest material must be private by default until reviewed.

The system must support protecting identities, delaying publication, blurring or editing before release, and withholding exact location where safety requires it.

## Deferred public livestreaming

Do not initially build custom public livestreaming infrastructure.

Do not build:

- native broadcast ingest
- custom live transcoding
- live chat
- multicamera control
- live audience concurrency infrastructure
- instant public clipping and moderation systems

When real usage proves a need for public livestreaming, use managed streaming infrastructure and connect it to WAKILISHA editorial controls.

## Inquiry Mode target architecture

Inquiry Mode begins only after the production freeze gates are complete.

### Institute Mode control

Every supported editor gains a common on or off control.

When active, it allows the worker to:

- start an Inquiry
- attach an existing Inquiry
- switch the active Inquiry
- open shared Inquiry context
- detach the current resource
- exit Inquiry Mode

### Persistent active Inquiry

The active Inquiry follows the authenticated worker across supported WAKILISHA admin routes.

The application shell remembers the active Inquiry.

Visiting a page must not automatically attach it.

The worker explicitly attaches an existing resource, while resources created through a related-work action may attach automatically.

### Shared Inquiry capabilities

The shared Inquiry panel contains:

- question
- scope
- current understanding
- open uncertainties
- material
- notes
- findings
- connected Registry entities
- connected outputs
- review and change history

Page-specific Inquiry actions remain inside the canonical editor.

### Inquiry relationship graph

An Inquiry may connect to many resources.

A resource may connect to many Inquiries.

The relationship must record a role such as:

- primary outcome
- supporting outcome
- source
- supporting material
- subject
- affected record
- correction
- follow-up
- related work

### Public Inquiry presentation

Public presentation scales with the Inquiry.

A singular Inquiry output receives compact context appropriate to its type.

A larger Inquiry automatically presents grouped outcomes, affected cultural records, sources, findings, history, contributors, and correction routes.

Every participating page displays the same Inquiry identity and only the most relevant connected work.

## Build programme

## Phase 0: Plan replacement and Institute freeze

Objectives:

- establish this document as the authoritative plan
- reject the old destination-based Institute architecture
- stop new feature development in the legacy Institute
- retain legacy routes only for migration, reference, and critical data access
- remove the current Institute from primary navigation in a later implementation PR

Exit gate:

- this plan is merged
- all subsequent editor and Inquiry work references this plan

## Phase 1: Shared editorial core through Article

Build:

- source records
- citations and locators
- credits
- immutable revisions
- review events and transactional transitions
- provenance events
- material update and reviewed dates
- correction cases
- public correction notes
- Registry links
- public provenance component

Article integration:

- select or create sources in the Article Editor
- insert or attach citations
- add credits
- submit a specific revision for review
- approve and publish a specific revision
- create and resolve a correction
- display public provenance and corrections

Exit gate:

- one real article is created, reviewed, published, materially updated or corrected, and publicly displays accurate provenance

## Phase 2: Canonical Playlist Editor

Build:

- independent Playlist admin routes and navigation
- playlist list and detail editor
- complete item management
- Registry and provider matching
- per-item notes and citations
- shared credits, review, provenance, and corrections
- public playlist routes
- public playback and SEO
- migration path from useful Institute-linked playlist drafts

Exit gate:

- one real editorial playlist is reviewed and published through the canonical editor
- the old Institute Playlist workspace is no longer required for new work

## Phase 3: Complete Media Library and large-file pipeline

Build:

- audio and video acceptance in Media Library
- media-type previews
- full rights, consent, sensitivity, and provenance metadata
- resumable large-file uploads
- checksums
- processing jobs and status
- derivative creation
- preservation masters
- caption and transcript asset handling
- safe replacement and reference preservation

Exit gate:

- one real podcast master and one real video master upload successfully through interruption and processing tests
- both are previewable and reusable by canonical editors

## Phase 4: Audio Editor

Build:

- shows, seasons, episodes, and standalone audio publications
- editor and public routes
- media selection and processing integration
- transcripts, chapters, sources, citations, credits, review, provenance, and corrections
- accessible public player
- RSS feed and stable podcast identifiers

Exit gate:

- one complete real audio publication is reviewed and published
- feed and playback validation pass

## Phase 5: Video Editor

Build:

- video and video-series content models
- editor and public routes
- media selection and processing integration
- poster frames, captions, transcripts, chapters, credits, review, provenance, and corrections
- accessible public streaming player

Exit gate:

- one complete real video is reviewed and published
- desktop and mobile playback, captions, transcript, provenance, and correction paths pass

## Phase 6: Field Capture

Build:

- mobile-first field upload interface
- resumable weak-network transfer
- private newsroom intake
- contributor identity and anonymity controls
- rights, consent, sensitivity, and embargo controls
- unsafe metadata handling
- transformation of accepted material into canonical Media Library assets and editorial work

Exit gate:

- interrupted and weak-network upload tests pass
- a submitted field asset can be privately reviewed and promoted into an Audio or Video publication without losing provenance

## Phase 7: Adapt Registry and Chart tools

Add the shared editorial core without rewriting canonical tools.

Registry additions:

- sources and citations for reviewed changes
- field-level provenance where practical
- correction cases
- review events
- meaningful review dates

Chart additions:

- methodology sources
- citations
- reviewed interpretation
- provenance and correction support

Exit gate:

- one reviewed Registry change and one chart-related editorial update use the shared core

## Phase 8: Production freeze

Once Phases 1 through 7 meet their exit gates:

- freeze editor foundations for the first cultural season
- permit only security, data-loss, publication-blocker, accessibility, and severe reliability fixes
- record new product ideas without immediately building them
- begin Inquiry Mode as the next product layer

## Phase 9: Inquiry Mode vertical slice

Build the first complete power-up through one real Inquiry.

Required proof:

1. Open the normal Article Editor.
2. Confirm it works with Inquiry Mode off.
3. Turn Inquiry Mode on.
4. Start or attach a real Inquiry.
5. Attach sources and create findings using shared infrastructure.
6. Publish the article with compact public Inquiry context.
7. Create a related playlist in the canonical Playlist Editor.
8. Carry the same active Inquiry into that editor.
9. Attach and publish the playlist.
10. Attach at least one Registry record as an affected record.
11. Complete a reviewed Registry change.
12. Confirm article, playlist, Registry page, and public Inquiry page share one Inquiry identity.
13. Exit Inquiry Mode and confirm normal editor behaviour remains intact.

Exit gate:

- a real article, playlist, and Registry change are connected by one active Inquiry without using the legacy Institute as a destination

## Definition of editor completion

Every canonical editor must pass the same baseline.

### Creation and recovery

- create from scratch
- autosave safely
- recover after interruption
- validate required fields
- prevent duplicate accidental publication
- surface partial-save failure clearly

### Production

- attach or select media
- attach sources and citations
- link Registry entities
- add contributors and credits
- preview the exact public result

### Governance

- submit a specific revision for review
- request changes
- approve a specific revision
- schedule or publish
- record who acted, what changed, and why

### Life after publication

- materially update
- correct
- review without changing
- reopen where applicable
- archive
- restore
- preserve earlier published revisions

### Public trust

- show publication date
- show meaningful update and review dates
- show credits
- show sources where appropriate
- show correction notes
- accept correction submissions
- remain accessible on mobile and desktop

### Reliability

- handle failed uploads
- handle lost connectivity
- preserve drafts
- prevent silent partial writes
- use transactional state changes for critical transitions
- maintain tests around critical lifecycle behaviour
- support backup and export of content and media references

## Development rules

### No infrastructure victory by itself

Every meaningful implementation PR must identify:

- the cultural output it enables
- the worker using it
- the exact blockage removed
- the public or institutional result
- the real record used for verification

A PR is not complete merely because:

- a schema exists
- a route loads
- a table is ready but empty
- an assistant returns structured data
- a polished screen exists
- an abstraction supports hypothetical future work

### Infrastructure is justified only when it

- unblocks named cultural work
- protects data, security, rights, consent, provenance, or review integrity
- removes machinery from the worker's path

### No duplicate editors

The canonical editor is always used.

The Institute may add contextual capability later, but it may not create an Institute-specific version of Article, Playlist, Audio, Video, Registry, Chart, Media, Citation, or Correction tools.

### No premature universal builder

Do not build a generic block editor or universal cultural-output editor.

Different outputs retain their own appropriate production and public experiences while sharing infrastructure underneath.

### No mock-only acceptance

Mock data may support tests.

The primary acceptance proof for each phase must use real cultural work.

### Public and admin must ship together

A production workflow is not complete until its public output, provenance, review, and correction behaviour are delivered.

## Explicit non-goals for this programme

Do not build during the editor-completion programme:

- a new standalone Institute application
- new Institute workspaces
- an Inquiry dashboard before Inquiry Mode
- a public Inquiry directory before the first vertical slice
- a browser-based audio workstation
- a browser-based video editor
- custom public livestreaming infrastructure
- real-time Google Docs-style collaboration
- separate review systems for each output
- separate correction systems for each output
- separate media libraries
- a universal block builder
- advanced semantic research or retrieval infrastructure
- a graph explorer
- new assistant personas
- speculative output types without a real first-season need

Photo essays may use the Article Editor initially.

Interview transcripts may use Article, Audio, or Video publication structures.

Documents remain Media Library assets.

Specialist timelines, datasets, and interactive experiences are introduced only when real work proves the need.

## Legacy Institute treatment

The legacy Institute is frozen after this plan is accepted.

Until migration is complete:

- preserve data
- preserve direct routes required for reference
- fix only security, permission, data-loss, and migration-blocking defects
- do not polish the legacy interface
- do not add new workspaces
- do not add new assistant jobs
- do not route new canonical work into Institute-specific editors

After canonical editors and Inquiry Mode are proven:

- migrate useful questions and question history
- migrate valid sources into the shared source authority
- migrate valid claims into findings where appropriate
- migrate useful work-product relationships
- preserve review and assistant audit history
- make legacy routes read-only
- remove obsolete UI and schema through a separate guarded retirement programme

## Immediate next implementation

The next implementation after this plan is merged is Phase 1, Shared Editorial Core through Article.

The first PR should define the shared data contracts and lifecycle for:

- sources
- citations and locators
- credits
- revisions
- review events
- provenance events
- correction cases

The first vertical implementation must then integrate those contracts into the existing Article Editor and public article page.

The acceptance milestone is not a merged infrastructure PR.

The acceptance milestone is a real article researched, cited, reviewed, published, and later updated or corrected through the completed system.

## Deployment and verification for this documentation change

- SQL migration needed: No
- Supabase Edge Function deployment needed: No
- frontend deployment needed: No
- Readdy Finish update needed: No
- documentation review needed: Yes
- next implementation plan: Phase 1 shared editorial core through Article
