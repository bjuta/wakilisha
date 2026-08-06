# WAKILISHA Editorial Production System and Inquiry Mode Project Plan

## Status and authority

This document is the authoritative implementation plan for the next major phase of WAKILISHA cultural production.

It supersedes:

- the two-workspace Institute pilot plan
- the destination-based Institute architecture
- the earlier editor-first implementation sequence
- any proposal that treats schemas, screens, assistants, or infrastructure as the cultural outcome

All future work on Articles, Playlists, Audio, Video, Media, Registry, Charts, corrections, evidence, review, provenance, Field Capture, and Inquiry Mode must reference this plan.

## Programme status

Current phase: **Phase 4: Media platform**.

Phase 3 Trust infrastructure is complete. PR 4A Media authority redesign is active.

The Phase 4A public application Media read lane is accepted and closed. Administrative and write authority, immutable file and derivative proof, mutable overwrite removal, and compatibility policy hardening remain open.

This plan has been reconciled against repository main at:

`cdbb4389 Retire dead track artwork Media lookup (#575)`

Closed phases:

- **Phase 0A: Security perimeter**, closed through PR #452.
- **Phase 0B: Engineering control plane**, closed through PR #453.
- **Phase 1A: Resource identity and domain boundaries**, closed through PR #457.
- **Phase 1B: Commands, jobs, and outbox**, closed through PR #458 and PR #459.
- **Phase 2A: Durable Article drafts and immutable versions**, closed through PR #460, PR #461, PR #463, and PR #464.
- **Phase 2B: Review and publication lifecycle**, closed through PR #467, PR #469, PR #470, and PR #481.
- **Phase 2C: Article Editor Workbench**, closed through PR #482 and PR #483.
- **Phase 3A: Sources, Citations, and Credits**, closed through PR #542.
- **Phase 3B: Corrections and provenance**, closed through PR #557.

Completed Phase 3 work:

- **Article Workspace North Star audit**, locked through PR #487.
- **Article composition and workspace hierarchy**, completed through PR #488.
- **Article review modes and suggestion decisions**, completed through PR #490 and PR #491.
- **Governed Publishing workspace foundation and core**, completed through PR #492 and PR #493.
- **Publishing teams, channels, operational history, Article linking, archive and restore, Board View, and Table View**, completed through PR #494 to PR #504.
- **QPR4 Publishing production deployment**, completed from main commit `6b2979b`.
- **Sources, Citations, Credits, source withdrawal, public trust reads, and Credit governance**, completed through PR #542.
- **Correction identity, evidence, decisions, Article application, public notes, contributor follow-up, and live-schema reconciliation**, completed through PR #543 to PR #557.

Completed Phase 4 work:

- **Media authority boundary and schema contract**, locked before implementation.
- **Logical Media identity, governance and compatibility bridge**, completed in production.
- **Immutable file, revision and variant command authority**, completed with no invented legacy file metadata.
- **Media usage authority and governed read models**, completed in production.
- **Legacy compatibility delivery resolver and governed batch adapter**, completed through PR #570 to PR #572.
- **Shared public Media reads, Article inline Media reads and dead track-artwork lookup retirement**, completed through PR #573 to PR #575.
- **Public application Media read lane acceptance**, recorded at main `cdbb4389`.

Supporting build-pipeline fix:

- **SEO metadata manifest abort fallback**, closed through PR #484.

Active phase:

- **Phase 4: Media platform**.

Phase 2 and Phase 3 are closed.

Phase 2 proved the Article authority from draft through restoration in production. The completed lifecycle proof covered Draft, Submit for Review, Request Changes, revised Draft, Submit again, Approve, Publish, later Draft edit, public unchanged verification, Archive, and Restore.

The North Star implementation work made the Article a stronger writing and review workspace without reopening the closed lifecycle authority. QPR4 established Publishing as a separate governed editorial operations workspace without duplicating canonical review, scheduling, or publication authority.

Phase 3 completed the shared Sources, Citations, Credits, Corrections, and provenance foundations without reopening Article lifecycle or duplicating Publishing authority.

Phase 4 is active through the Media authority redesign defined in this plan.

The public application Media read lane is complete. Phase 4A remains open until Media Library and editor writes use governed authority, in-place overwrite is removed, one logical asset proves an immutable original and several derivatives, and compatibility policy hardening has a verified replacement and rollback path.

See also:

- `docs/institute/phase-reconciliation-audit-20260718.md`
- `docs/engineering/phase-2b-review-publication-lifecycle-audit.md`
- `docs/engineering/phase-2-article-authority-closure-record.md`
- `docs/engineering/phase-3-trust-infrastructure-kickoff.md`


## Decision

Do not continue building the Institute as a standalone product, sidebar destination, or collection of duplicate editors.

The Institute becomes a capability distributed across the canonical WAKILISHA production system.

An Inquiry is the active power-up.

When Inquiry Mode is off, each editor performs its normal production function.

When Inquiry Mode is on, the same editor gains additional institutional capabilities such as:

- starting or attaching an Inquiry
- attaching sources and material
- recording notes and Findings
- linking Registry records
- preserving provenance
- reviewing claims and interpretation
- publishing uncertainty and corrections
- carrying the active Inquiry across WAKILISHA

Inquiry Mode is not the next implementation phase.

Before it can be built responsibly, WAKILISHA must secure the current estate, establish a durable platform kernel, complete the canonical production editors, prove the system under real operational and scale conditions, and place the foundations into a production freeze.

## Five-year objective

Build the WAKILISHA production and cultural-record platform so that foundational editorial and data architecture does not require wholesale replacement before 2031.

This does not mean the code will stop changing.

New providers, output formats, policies, interfaces, workflows, and public experiences will continue to arrive.

Five-year durability means those changes should be additive. WAKILISHA should not need to replace:

- global resource identity
- the publication lifecycle
- revision integrity
- the source and citation system
- the review system
- correction and provenance foundations
- media identity and preservation rules
- the command and job substrate
- the permissions boundary
- the public delivery contract
- the relationship model between cultural work and Inquiry

A future output type should require:

1. a typed canonical domain object
2. an appropriate editor and public presentation
3. registration with the global resource identity layer
4. reuse of Media, Sources, Citations, Credits, Review, Corrections, Provenance, Registry links, and Inquiry

It should not require another institutional rewrite.

## Why the plan changed

The earlier plan was credible for completing missing editors.

It was not sufficient for the platform WAKILISHA intends to become.

The current system already shows the shape of the next five years:

- operational events grow much faster than published cultural records
- analytics and request logs can become larger than the editorial core
- sources, citations, review decisions, corrections, and provenance relationships multiply around every public output
- media storage and processing will outgrow ordinary database rows
- public read traffic will become materially larger than editorial write traffic
- one poorly bounded privileged function can expose unrelated domains
- one client-orchestrated multi-request transition can leave permanent partial state
- duplicate authorities create more long-term risk than row count alone

PostgreSQL and Supabase remain appropriate foundations.

The problem is not that WAKILISHA may hold millions of rows.

The problem would be millions of rows inside an architecture with:

- unbounded scans
- overlapping authorities
- privileged public functions
- fake or incomplete revisions
- mutable media masters
- no retention policy
- no background-work contract
- no stable public read model
- no recovery proof

The new sequence therefore places security and the platform kernel before editor completion.

## Current scale signals

The live system already contains high-volume tables that materially exceed the canonical editorial record.

Approximate counts observed during the July 2026 audit include:

- about 255,000 minute-level rate-limit log rows
- more than 107,000 Search Console rows
- more than 31,000 analytics events
- about 10,000 chart raw-ingest rows
- about 9,500 chart candidates
- about 8,400 daily signal records
- more than 6,300 provenance links
- more than 2,300 Registry tracks
- more than 1,200 Registry artists
- more than 800 Registry releases
- more than 200 articles

These figures are operational snapshots, not permanent product targets.

They establish an important principle:

> High-volume event data must be separated from the durable cultural record.

The durable record should remain easy to understand, query, review, restore, and prove even when analytics, logs, jobs, and ingestion streams become very large.

## Product doctrine

### The cultural output is the centre

Work begins in the canonical tool for the output being created:

- Article Editor for articles
- Playlist Editor for playlists
- Audio Editor for podcasts and audio publications
- Video Editor for video publications
- Registry editors for reusable cultural records
- Chart tools for chart data and interpretation
- Media Library for reusable files and preservation masters
- Field Capture for safe live-to-newsroom intake

The Institute never rebuilds these tools.

### The Institute is a capability

The Institute is the shared set of abilities that makes ordinary cultural production behave institutionally.

It should make WAKILISHA feel deeper, more accountable, and more connected.

It should not feel like a separate product.

### Inquiry Mode is progressive enhancement

Turning on Inquiry Mode reveals additional capability inside a familiar workflow.

It must not replace the page, open a second editor, or force every output into the same research template.

### One authority per object

Each output and record has one canonical authority.

- Articles live in the Article domain.
- Playlists live in the Playlist domain.
- Audio publications live in the Audio domain.
- Video publications live in the Video domain.
- Registry facts live in Registry.
- Chart editions and methodology live in Charts.
- Media files and their preservation state live in Media.
- Inquiries own questions, interpretation history, Findings, and relationships to work.
- Shared trust systems own sources, citations, credits, review events, corrections, and provenance.

### Reusable systems are built once

The following must not be independently reimplemented inside every editor:

- resource identity
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
- command execution
- background processing
- public route aliases

### Real work is the acceptance test

No editor or shared capability is complete because its schema exists or its form saves.

Every phase must produce, review, publish, update, preserve, or correct real cultural work through the completed workflow.

### Public and admin ship together

A production workflow is not complete until the internal tool and the public result both work.

The public result includes:

- the correct published version
- meaningful dates
- credits
- sources where appropriate
- correction behaviour
- provenance
- accessibility
- stable routes
- reliable delivery

## Architecture target

WAKILISHA will remain a modular monolith unless real operational evidence justifies further separation.

The target is not a collection of speculative microservices.

The target is one platform with strict internal boundaries.

```text
Public application                 Admin application
        |                                  |
        +---------- Versioned API ---------+
                           |
             Query layer and command layer
                           |
    +---------------+---------------+---------------+
    | Editorial     | Registry      | Media         |
    | Content       | Inquiry       | Community     |
    | Charts        | Search        | Operations    |
    +---------------+---------------+---------------+
                           |
              PostgreSQL and object storage
                           |
            Jobs, outbox, workers, and indexing
```

The modules may live in the same repository and Supabase project.

The boundaries must exist in:

- database schemas
- table ownership
- commands
- TypeScript packages
- API routes
- permissions
- tests
- public read models

## Permanent platform kernel

### 1. Global resource identity

Every publishable, reviewable, correctable, or connectable object receives one stable WAKILISHA identity.

Conceptually:

```text
editorial.resources

id
resource_kind
canonical_table
canonical_id
owner_id
visibility
lifecycle_state
current_version_id
published_version_id
created_at
created_by
```

Resource kinds include, at minimum:

- article
- playlist
- playlist item
- audio show
- audio season
- audio episode
- standalone audio
- video
- video series
- video episode
- chart edition
- Registry record
- correction case
- Inquiry
- Finding

The resource table does not become a generic CMS blob.

Domain-specific content remains in typed canonical tables.

Resource identity gives shared systems a stable target for:

- citations
- credits
- review
- provenance
- corrections
- media usage
- Inquiry relationships
- search indexing
- notifications
- public aliases

### 2. Typed canonical domains

Each content type keeps an appropriate domain model.

- Articles retain article-specific structure.
- Playlists retain ordered item models.
- Audio retains show, season, episode, and feed semantics.
- Video retains series, episode, rendition, caption, and chapter semantics.
- Registry retains reusable cultural truth.
- Charts retain ingestion, edition, methodology, and scoring semantics.
- Inquiry retains questions, Findings, interpretation, and connected work.

Shared capabilities connect through resource identity.

Do not create a universal content table that replaces typed constraints with arbitrary JSON.

### 3. Current state plus immutable history

WAKILISHA does not require pure event sourcing.

It requires:

- a current editable record for fast production work
- immutable submitted versions
- immutable approved versions
- immutable published versions
- append-only review events
- append-only provenance events
- reconstructable public snapshots

Draft autosaves may update an active draft.

A reviewed or published version must never change silently.

A public page must always be reconstructable exactly as it appeared when published.

### 4. Transactional commands

Critical state changes become explicit server-side commands.

Examples include:

```text
save_article_draft
submit_resource_for_review
request_resource_changes
approve_resource_version
schedule_resource_version
publish_resource_version
apply_correction
reorder_playlist_items
promote_field_submission
attach_source
replace_media_master
```

Every command includes:

- actor
- capability context
- expected current version
- idempotency key
- command payload
- audit context
- correlation ID

Every command must:

- execute inside one transaction where possible
- reject stale writes
- tolerate safe retries
- return a command receipt
- enqueue asynchronous follow-up through an outbox
- leave no hidden partial state

### 5. Jobs and transactional outbox

Anything that does not need to finish inside the request becomes a job.

Examples:

- media processing
- transcription
- caption generation
- search indexing
- sitemap updates
- notification delivery
- RSS regeneration
- cache invalidation
- analytics rollups
- contribution notifications
- affected-resource review alerts
- storage reconciliation

The shared job contract includes:

- job type
- payload version
- status
- priority
- attempts
- maximum attempts
- run-after time
- lease holder
- lease expiry
- last error
- dead-letter state
- idempotency key
- correlation ID

A job must be inspectable, retryable, and safely dead-lettered.

No feature invents its own hidden queue.

### 6. Shared trust layer

The permanent trust layer contains:

- sources
- source versions
- source locators
- citations
- credits
- review events
- provenance events
- correction cases
- resource-to-Registry links
- contributor acknowledgements
- source withdrawal state

The same authority is consumed by Articles, Playlists, Audio, Video, Registry, Charts, and Inquiry.

### 7. Proper media object model

Media distinguishes three concepts.

#### Logical asset

The editorial object workers select and reuse.

#### File object

An immutable stored binary with:

- checksum
- size
- MIME type
- storage key
- creation time
- technical metadata
- preservation status

#### Variant

A derivative or alternate representation, including:

- thumbnail
- poster frame
- waveform
- streaming audio
- downloadable audio
- HLS video rendition
- caption file
- transcript file
- redacted copy
- compressed field preview

A separate usage link records which resource uses an asset and for what purpose.

Rights records include:

- ownership
- licence
- consent
- restrictions
- embargo
- sensitivity
- public-safe state
- expiry where relevant

Never overwrite the preservation master.

Replacing a master creates a new immutable file object and changes the logical asset's active pointer through a reviewed command.

### 8. Versioned public read models

The public application must not recreate complex editorial joins in the browser.

Each public domain receives a stable read model, including:

- article detail
- playlist detail
- audio show detail
- audio episode detail
- video detail
- Registry profile detail
- chart edition detail
- Inquiry detail

Read models may use:

- indexed read tables
- materialized views
- carefully scoped SQL functions
- cached API responses

The public API supports:

- versioned contracts
- cursor pagination
- stable error shapes
- cache control
- ETags or equivalent validators
- explicit cache invalidation
- predictable route resolution

### 9. Search as a maintained product

Search begins with PostgreSQL and a stable search contract.

Build:

- generated search documents
- full-text indexes
- trigram indexes
- weighted fields
- canonical aliases
- incremental reindex jobs
- resource-aware result types

Editors and public pages must not depend on broad `%term%` scans over operational tables.

The search contract must allow a future backend replacement without changing every editor.

### 10. Data classes and retention

Not all data deserves permanent storage.

#### Permanent

- canonical cultural records
- reviewed and published versions
- provenance
- review decisions
- corrections
- sources and citations
- rights and consent records
- preservation-master metadata
- Registry identity and relationship history

#### Long-lived but managed

- community contributions
- field submissions
- moderation events
- security audit events
- provider histories
- command receipts

#### Retained and rolled up

- analytics events
- rate-limit events
- request logs
- media-processing logs
- search analytics
- delivery logs
- ingestion diagnostics

Append-heavy tables receive:

- a declared retention policy
- time partitioning when volume justifies it
- automatic expiry or archival
- daily or monthly rollups
- separation from the core editorial query path

Small canonical tables are not partitioned prematurely.

### 11. Security boundary

Only a deliberate API surface is exposed.

Recommended schema pattern:

```text
api          versioned public and authenticated API
editorial    shared resource and lifecycle records
content      canonical editorial outputs
registry     canonical cultural records
media        media metadata and usage
inquiry      Inquiry and Finding state
community    contributions and intake
operations   jobs, outbox, command receipts, and audit support
analytics    raw events and rollups
private      privileged helpers and secrets
```

Privileged functions belong in a non-exposed schema.

Execution is revoked from `PUBLIC` by default.

Every privileged command requires:

- authenticated actor resolution
- explicit capability verification
- a fixed `search_path`
- validated input
- audit context
- idempotency

The service-role key is not a general substitute for ordinary editorial write policies.

### 12. Observability and recovery

Commercial grade means the team can answer:

- What failed?
- Which resource was affected?
- Which user initiated it?
- Did it partially apply?
- Can it be retried safely?
- How long has it been failing?
- Can it be restored?
- Can WAKILISHA prove that no acknowledged work was lost?

Required capabilities include:

- structured request logs
- correlation IDs
- command receipts
- job dashboards
- error tracking
- processing metrics
- slow-query monitoring
- audit trails
- backup verification
- restoration drills
- media checksum inventory
- database growth dashboards

A backup that has never been restored is not considered proven.

## Security and architecture findings that must be corrected

The current system contains useful work, but several patterns must not become permanent foundations.

### Giant Admin Router

Administrative authentication, users, articles, charts, providers, scoring, and unrelated operational logic are concentrated in one large Edge Function.

Replace this with bounded command services and shared command infrastructure.

Do not create dozens of speculative microservices.

### Giant public-content read function

Public Registry, article, route, and related read behaviour is concentrated in one service-role function with per-request database rate logging and weak cache behaviour.

Replace it with:

- versioned public read APIs
- cached domain read models
- CDN and edge rate limiting
- cursor pagination
- explicit invalidation

### Privileged public-schema RPC sprawl

Sensitive `SECURITY DEFINER` functions and compatibility helpers must not remain broadly reachable through exposed schemas or inherited grants.

The security perimeter phase must inventory and reclassify every callable function.

### Client-orchestrated important writes

Lifecycle transitions, review submission, object linking, reordering, and promotion must not depend on several independent browser requests.

Move them into transactional commands.

### Incomplete revision integrity

Revision controls must be real, recoverable, and enforced.

A revision UI without durable revision behaviour does not pass acceptance.

### Mutable media assumptions

A media row pointing to one mutable file is insufficient for preservation masters, derivatives, captions, transcripts, replacements, redactions, and rights history.

Adopt logical assets, immutable files, and variants.

### Offset pagination and broad exact counts

Large collections use cursor pagination, indexed search, and maintained summaries.

Avoid exact count work on every request where it is not operationally necessary.

### JSON used in place of durable relationships

Reusable taxonomies and relationships must use canonical records and join tables where queryability, validation, history, or reuse matters.

JSON remains appropriate for bounded metadata, snapshots, and provider payloads.

### Monolithic sitemap generation

Move to an incremental sitemap index with sharded sitemaps.

Publishing one new resource must not require rebuilding the entire public URL corpus.

## Canonical output set

The first production freeze covers the following canonical work.

## Article

The Article Editor remains the reference implementation for the shared editorial lifecycle.

Required capabilities:

- truthful autosave and recovery
- optimistic concurrency
- reusable sources and citations
- immutable review and publication versions
- universal review lifecycle
- contributor and editorial credits
- Registry entity links
- meaningful publication, update, review, and correction dates
- correction cases and public correction notes
- exact public preview
- safe scheduling and publishing
- public provenance
- atomic slug and redirect handling
- normalized categories and tags

Completion proof:

- create one real article
- submit a specific version for review
- approve and publish that version
- materially update or correct it
- confirm that the public page displays accurate provenance
- confirm that technical metadata changes do not create false editorial-update claims

## Playlist

Playlist becomes a canonical WAKILISHA product independent of the legacy Institute.

Required capabilities:

- create and edit metadata
- title, slug, description, cover, curator, and credits
- Registry track selection
- Registry release and artist links
- provider track normalization
- Registry identity matching
- external-only pending items
- missing-record suggestions
- atomic drag-and-drop ordering
- duplicate detection
- per-track notes
- per-track sources and citations
- curatorial argument
- exact preview
- immutable review and publication versions
- scheduling, publishing, archiving, and restoration
- public corrections and missing-track suggestions
- mobile and desktop playback
- public SEO and sharing metadata

Required public behaviour:

- stable `/playlists` and `/playlists/:slug` routes
- no draft or rejected exposure
- links to matched Registry records
- public curator and contributor credits
- meaningful dates
- compact provenance and source presentation

Completion proof:

- publish one real editorial playlist
- include at least one Registry-matched track
- include at least one track requiring provider normalization or review
- verify review, publication, playback, internal links, provenance, and mobile behaviour

## Audio

Audio supports shows, seasons, episodes, trailers, bonus episodes, and standalone audio publications.

Required capabilities:

- stable show and episode identity
- finished-master selection or upload
- resumable upload
- processing status
- preservation master
- streaming derivative
- optional download derivative
- technical metadata
- show notes
- chapters and timestamps
- transcript
- caption or transcript assets
- sources and citations
- Registry links
- credits
- exact preview
- immutable review and publication versions
- scheduling, archiving, restoration, and corrections
- stable RSS GUID and enclosure behaviour

Required public behaviour:

- accessible audio player
- chapter navigation
- transcript
- show notes and sources
- credits
- related Registry records and publications
- meaningful provenance dates
- correction history where appropriate
- valid podcast RSS feed

Completion proof:

- publish one real audio episode
- validate playback, chapters, and transcript
- validate RSS in an external feed validator or client
- apply one controlled metadata or transcript correction

## Video

Video supports standalone videos, series, episodes, documentaries, interviews, performances, explainers, and field footage.

Required capabilities:

- finished-master selection or upload
- resumable upload
- processing status
- preservation master
- adaptive streaming renditions
- poster frames and thumbnails
- portrait, landscape, and square handling
- duration, dimensions, and technical metadata
- chapters
- captions
- transcript
- credits
- sources and citations
- Registry links
- rights, sensitivity, and embargo controls
- exact preview
- immutable review and publication versions
- scheduling, archiving, restoration, and corrections

Required public behaviour:

- accessible responsive streaming player
- captions
- transcript
- chapters
- posters and responsive presentation
- credits
- sources where appropriate
- related Registry records and publications
- meaningful provenance dates
- correction history where appropriate

Completion proof:

- publish one real captioned video
- verify adaptive playback on desktop and mobile
- verify captions, transcript, provenance, and correction handling

## Registry and Charts

Registry and Charts remain authoritative for their own domain records.

They adopt the shared trust infrastructure without being rebuilt as Institute tools.

Registry additions include:

- sources and citations for reviewed changes
- field-level provenance where practical
- correction cases
- review events
- meaningful review dates
- affected-resource review alerts

Chart additions include:

- methodology sources
- citations
- reviewed interpretation
- provenance
- correction support
- stable editions and publication snapshots

Completion proof:

- one reviewed Registry change uses the shared trust layer
- one chart-related update uses the shared trust layer
- neither workflow depends on Institute-specific evidence authority

## Shared editorial core

### Sources

A source is a reusable record representing material used in cultural work.

Supported source types include:

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

A source supports, where relevant:

- title
- source type
- creator or author
- publisher or custodian
- source URL
- Media asset
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
- withdrawal state
- version history

### Citations

A citation identifies the exact portion of a source used by an output or Finding.

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

Citations attach to:

- article text
- playlist and track notes
- audio show notes and chapters
- video chapters and transcript sections
- Registry changes
- chart methodology and interpretation
- Inquiry Findings

The public presentation adapts to the output type.

The authority remains shared.

### Review lifecycle

The default lifecycle is:

1. Draft
2. Ready for review
3. In review
4. Changes requested
5. Approved
6. Scheduled
7. Published
8. Archived

Review events record:

- actor
- action
- reason or note
- resource identity
- resource version
- prior state
- resulting state
- timestamp
- requested changes
- correlation ID

Review transitions that affect multiple records use transactional commands.

### Credits

The shared credit system supports:

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

Credits may link to Registry authors, authenticated users, or named external contributors.

### Provenance

Public provenance does not rely on generic `updated_at` timestamps.

Required editorial dates include:

- first published
- last materially updated
- last reviewed
- corrected
- archived
- restored

A material update changes public meaning, facts, interpretation, structure, or substantive presentation.

A technical save, slug repair, metadata synchronization, or typo fix does not automatically become a public material-update claim.

Meaningful actions generate append-only provenance events.

Not every internal event is public.

Every public editorial change has an internal provenance event.

### Corrections

Corrections are a shared institutional system.

A correction case may target:

- article
- playlist
- playlist item or note
- audio episode or transcript
- video or transcript
- Registry record or relationship
- chart or methodology
- Inquiry Finding

Correction flow:

1. A public or internal correction is submitted.
2. A correction case is created.
3. Supporting material is attached.
4. An editor investigates.
5. A decision is recorded.
6. The correction is applied through a new immutable version or reviewed Registry change.
7. A public correction note is published where appropriate.
8. Related affected resources are flagged for review.
9. The contributor is notified where possible and safe.

Corrections never directly overwrite public work without a record.

## Media platform

The existing Media Library becomes the single media authority.

Do not build separate image, audio, video, document, or archive libraries.

Supported kinds include:

- images
- PDFs and documents
- audio
- video
- archive files
- captions
- transcripts
- other reviewed formats where preservation is justified

Required metadata includes:

- original filename
- display filename
- MIME type
- file kind
- size
- dimensions or duration
- processing state
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
- Registry links
- publication links
- preservation status
- replacement history
- internal notes

Large-file handling requires:

- resumable uploads
- chunked or multipart transfer
- upload sessions
- retry after network failure
- checksum validation
- direct transfer to storage
- background processing
- visible processing state
- failed-processing recovery
- safe cancellation

Original masters are preserved separately from public derivatives.

## Field Capture

Field Capture is a mobile-first newsroom intake capability for urgent cultural and political material.

The first implementation is live-to-newsroom, not automatic live-to-public broadcasting.

Required capabilities:

- record or select audio, video, image, or document on a phone
- upload immediately
- queue on weak connectivity
- resume after interruption
- add a short description
- record time and place where safe
- choose whether identity may be disclosed
- submit anonymously where policy permits
- capture rights and consent
- mark sensitivity
- set embargo or private handling
- strip unsafe metadata where required
- protect exact location where safety requires it
- preserve the immutable original
- confirm successful receipt
- route into editorial review before publication

Political and protest material is private by default until reviewed.

The system must support protecting identities, delaying publication, redaction, blurring, safe derivatives, and withholding exact location.

Custom public livestreaming infrastructure is deferred until real usage proves the need.

## Inquiry Mode target architecture

Inquiry Mode begins only after the production freeze gates are complete.

### Inquiry Mode control

Every supported editor gains a common control.

When active, it allows a worker to:

- start an Inquiry
- attach an existing Inquiry
- switch the active Inquiry
- open shared Inquiry context
- attach or detach the current resource
- exit Inquiry Mode

### Persistent active Inquiry

The active Inquiry follows the authenticated worker across supported admin routes.

The application shell remembers the active Inquiry.

Visiting a page does not attach it automatically.

The worker explicitly attaches an existing resource.

Resources created through a related-work action may attach automatically.

### Shared Inquiry capabilities

The shared Inquiry sidecar contains:

- question
- scope
- current understanding
- open uncertainties
- material
- notes
- Findings
- connected Registry entities
- connected outputs
- review history
- change history

Page-specific Inquiry actions remain inside the canonical editor.

### Inquiry relationship graph

An Inquiry may connect to many resources.

A resource may connect to many Inquiries.

The relationship records a role such as:

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

A larger Inquiry presents grouped outcomes, affected cultural records, sources, Findings, history, contributors, uncertainty, and correction routes.

Every participating page displays the same Inquiry identity and the connected work most relevant to that page.

# Build programme

## Delivery shape

The programme contains thirteen phases, numbered 0 through 12.

Each phase has a maximum of two implementation PRs.

The programme ceiling is 26 PRs.

The expected range is approximately 20 to 23 PRs because some later phases may fit safely into one PR once the platform kernel exists.

Do not force the programme into fewer PRs by creating unreviewable changes.

Every PR must be:

- independently reviewable
- deployable
- reversible
- covered by relevant tests
- tied to a named cultural or operational outcome

## Phase 0: Secure and control the existing estate (complete)

### PR 0A: Security perimeter (complete)

Scope:

- inventory every callable database function
- classify public, authenticated, administrative, and internal commands
- revoke inherited execution from privileged functions
- move sensitive helpers into a private or command schema
- remove administrative grant helpers from the exposed API
- replace unsafe `SECURITY DEFINER` usage
- fix mutable function `search_path`
- review service-role bypasses
- repair overly permissive RLS policies
- review public storage bucket listing
- enable leaked-password protection
- verify anonymous and authenticated attack paths
- retain temporary compatibility wrappers only where migration requires them

Exit gate:

- no privileged anonymous RPC remains
- every privileged command has an explicit capability check
- security advisor errors are resolved
- remaining warnings are documented and accepted intentionally


Completion record, 14 July 2026:

- closed through [PR #452](https://github.com/bjuta/wakilisha/pull/452)
- merged as commit `5e580951a5e78d60d89285b9a84a23c75578d112`
- all Phase 0A production migrations were applied
- the production closure verifier returned zero unresolved rows
- no anonymous storage upload policy remained
- Supabase Security Advisor reported zero error findings
- remaining accepted warnings were documented
- leaked-password protection follow-up remained tracked separately in issue #451

### PR 0B: Engineering control plane (complete)

Scope:

- freeze legacy Institute development
- remove Institute from normal navigation
- declare one migration directory authoritative
- establish a live-schema baseline
- archive obsolete migration trees outside the executable path
- generate committed database types
- add schema drift detection
- add `test:critical`
- make security and migration tests mandatory
- introduce structured request IDs and error reporting
- document deployment, rollback, and incident procedures

Exit gate:

- a migration cannot silently diverge from production
- a critical RLS or lifecycle regression blocks merge
- legacy Institute can no longer attract new work


Completion record, 14 July 2026:

- closed through [PR #453](https://github.com/bjuta/wakilisha/pull/453)
- merged as commit `b0fd55fee73f82bdf20ff1d742ed7aaa041326ff`
- `supabase/migrations` became the sole executable migration authority
- obsolete migration trees moved outside executable paths
- production-generated public-schema types and a schema hash baseline were committed
- live schema drift became a merge-blocking check
- `test:critical` passed 102 tests across security, lifecycle, routes, and control-plane contracts
- the `critical` status check became mandatory on `main`
- structured Supabase request IDs and failure reporting shipped
- the legacy Institute disappeared from normal navigation while direct reference routes remained available
- the post-merge Critical Control Plane workflow passed
- the frontend deployed to `35.176.52.252`
- local, server, homepage, and admin index hashes matched
- the homepage and admin route both returned HTTP 200

Phase 0 is complete.

## Phase 1: Platform kernel (complete)

### PR 1A: Resource identity and domain boundaries (complete)

Build:

- domain schemas
- `editorial.resources`
- resource-kind registry
- canonical pointers
- ownership
- visibility
- lifecycle state
- resource aliases
- genuinely universal resource relationships
- strict API exposure boundaries

Migrate Article, Playlist, and selected Registry objects into the identity layer without moving their domain content.

Exit gate:

- one article, one playlist, and one Registry record have stable resource identities
- shared systems can reference them without polymorphic text guesses

Completion record, 15 July 2026:

- closed through PR #457
- production migration `20260715054810_phase_1a_resource_identity_foundation.sql` was applied
- `editorial.resources` and Article resource bindings were established
- proof resources and aliases validated stable resource identity
- production changed: schema only

### PR 1B: Commands, idempotency, jobs, and outbox (complete)

Build:

- command receipts
- idempotency keys
- expected-version concurrency
- transactional command helpers
- append-only audit context
- transactional outbox
- shared jobs table
- leases
- retries
- dead-letter handling
- worker execution contract

Exit gate:

- a retried command cannot duplicate work
- a failed asynchronous task can be inspected, retried, and dead-lettered
- one existing multi-request lifecycle transition has been moved into a single server-side command

Completion record, 15 July 2026:

- closed through PR #458 and PR #459
- production migration `20260715143000_phase_1b_command_job_outbox_foundation.sql` was applied
- command receipts, jobs, and outbox foundations were established
- production proof command created a command receipt, job, and outbox event
- production changed: schema only

## Phase 2: Article authority (complete)

### PR 2A: Durable drafts and immutable versions (complete)

Build:

- truthful autosave
- draft recovery
- revision pruning policy
- immutable review versions
- optimistic concurrency
- transactional save and revision creation
- normalized categories and tags
- ownership and edit scopes
- atomic slug and redirect handling
- migration of useful existing revisions

Exit gate:

- drafts survive interruption
- stale clients cannot overwrite newer content
- every submitted version can be reconstructed

Completion record, 16 July 2026:

- closed through PR #460, PR #461, PR #463, and PR #464
- production migrations `20260715173634_phase_2a_durable_article_versions.sql`, `20260716172500_phase_2a_article_editor_runtime_fix.sql`, and `20260716183000_phase_2a_save_article_versioned_runtime_fix.sql` were applied
- every Article has a resource binding, baseline immutable version, and working version pointer
- Article editor uses `draft_version` locking for versioned save and autosave
- Article revision history reads Phase 2A Article versions instead of legacy revision rows
- production smoke confirmed autosave, Save Draft, reload persistence, and visible revision history on a real Article
- production changed: schema and frontend

### PR 2B: Review and publication lifecycle (complete)

Build:

- review submission
- requested changes
- approval
- scheduling
- publication
- archive and restore
- publication snapshots
- meaningful published, reviewed, materially updated, and corrected dates
- cached Article read model
- exact public preview

Completion record, 21 July 2026:

- closed through PR #467, PR #469, PR #470, and PR #481
- lifecycle RPCs, publication snapshots, scheduled publication infrastructure, archive and restore infrastructure, version-bound previews, Edge read updates, and preview rendering shipped
- publish now requires an approved immutable Article version
- public Article delivery reads stable publication snapshot state
- Article lifecycle history is visible in the editor
- production proof completed Draft, Submit for Review, Request Changes, revised Draft, Submit again, Approve, Publish, later Draft edit, public unchanged verification, Archive, and Restore
- production changed: schema, Edge Functions, and frontend across the Phase 2B implementation
- final SQL hotfix for approved version publication was recorded on main through PR #481

Exit gate:

- one real Article completed the full lifecycle
- the public page was served from a stable published version
- later draft changes did not alter the published version silently
- the editor visibly explains review and lifecycle history
- Phase 2B closure is recorded in this plan

### PR 2C: Article Editor Workbench (complete)

Build:

- Article editor workbench modes
- primary mode navigation
- reduced sidebar dependency
- visible Review, Publishing, History, and Recovery surfaces
- full-width lifecycle and revision history
- clearer archive, restore, compare, and recovery guidance
- preserved Phase 2B governed review behaviour
- production deployment of the Phase 2C runtime

Completion record, 21 July 2026:

- closed through PR #482 and PR #483
- deployed frontend runtime from main commit `f951ff9`
- production editor verified Write, Review, Publishing, History, and Recovery modes
- History shows Lifecycle Timeline, Lifecycle Audit, Revision Ledger, and version restore context
- Recovery shows Recovery Decisions and Restore Points
- no SQL migration was required for Phase 2C
- no Supabase Edge Function deploy was required for Phase 2C
- SEO and prerender production artifacts were intentionally left unchanged during the runtime deploy

Exit gate:

- the Article editor no longer depends on the right sidebar for primary editorial work
- publish, review, archive, restore, revision history, and lifecycle history are visible as core workbench capabilities
- existing Phase 2B governance behaviour still works
- user-facing strings touched in Phase 2C were checked for prohibited dash characters
- production smoke passed

## Phase 3: Trust infrastructure (complete)

Phase 3 builds the shared trust layer that Articles, Playlists, Audio, Video, Registry, Charts, and Inquiry will reuse.

Immediate Phase 3 boundary:

- start with Sources, citations, and credits
- preserve the closed Article lifecycle
- do not rebuild the Article editor
- do not start Playlist, Audio, Video, Media, Field Capture, or Inquiry Mode work in PR 3A
- prove reuse through Article first, then at least one non-Article target
- keep public presentation scoped to what the trust records can prove

### Article Workspace North Star quality gate (complete)

The implementation work required by the North Star audit is complete.

Completed work includes:

- PR #487 locked the North Star audit and quality boundary
- PR #488 rebuilt composition and workspace hierarchy
- PR #490 added Write, Suggest, and View review modes with durable review decisions
- PR #491 completed review-mode presentation and interaction polish
- PR #492 and PR #493 established the governed Publishing workspace foundation and core
- PR #494 to PR #504 completed Publishing assignments, channels, operational history, canonical Article linking, archive and restore clarity, operation lenses, Board View, Table View, and commercial-grade drawer behaviour

Production proof confirms:

- the Article Workspace supports focused composition, exact Preview, long-document navigation, and responsive drawer behaviour
- review supports immutable submitted-version reading, durable suggestions, decisions, withdrawal, and rejection
- Publishing identifies and preserves canonical Article authority without becoming the reviewer, scheduler, or publisher
- Publishing drawers render through the shared document-body Portal without page jumps or clipping
- Board View and Table View are live in production

The quality gate does not reopen Phase 2 architecture.

Do not alter proven lifecycle, review, approval, publication snapshot, archive, restore, recovery, preview-security, or canonical Publishing authority contracts unless a verified defect requires it.

The quality gate is closed.

The completed workspace remains the Article reference implementation for shared trust adoption. Phase 4 must not reopen Article lifecycle, review, publication snapshot, archive, restore, recovery, preview security, or canonical Publishing authority unless a verified defect requires it.

### PR 3A: Sources, citations, and credits

Build once:

- reusable sources
- typed source locators
- citations
- source versions
- source withdrawals
- credits
- external contributors
- Registry entity links
- inline Article citations
- public notes and source presentation

Exit gate:

- one source can be reused by an Article, Registry change, and later Playlist note
- citations remain stable when display formatting changes

Completion record, 3 August 2026:

- closed through PR #542
- reusable Sources, source versions, typed locators, Citations, Credits, external contributors, and Article-version attachments are live
- public Source and Credit reads preserve working-versus-published version boundaries
- Source withdrawal and restoration were verified
- Credit withdrawal, restoration, public-safe governance, and published-version presentation were verified
- Phase 3A completed without placing licensing, payouts, or commercial allocation inside Citation or Credit authority

### PR 3B: Corrections and provenance

Build:

- correction cases
- correction targets
- evidence attachment
- investigation ownership
- decision history
- correction application command
- public correction notes
- affected-resource flags
- contributor notification jobs
- append-only provenance events

Exit gate:

- a submitted correction becomes a case
- a reviewed correction creates a new resource version
- the public history explains what changed and why

Completion record, 4 August 2026:

- closed through PR #557
- production migrations `20260803183000_phase_3b_correction_identity_foundation.sql`, `20260804090000_phase_3b_correction_evidence_decision_authority.sql`, `20260804123000_phase_3b_article_correction_application.sql`, and `20260804163000_phase_3b_public_notes_contributor_follow_up.sql` were applied
- correction cases, targets, evidence, decisions, related-resource review, Article correction application, public correction notes, contributor follow-up, closure, and reopening authority are live
- the correction command registry contains 17 governed correction commands
- production correction workflow rows remain empty
- live database types and the 187-migration schema baseline match production
- PR #556 and PR #557 completed implementation and live-schema reconciliation
- no Supabase Edge Function or frontend deployment was required for Migration 4

### Immediate next implementation

**Continue PR 4A: Media authority redesign.**

The public application Media read lane is accepted and closed.

Continue with the administrative and write-authority perimeter, Media Library command cutover, editor usage authority, immutable original and derivative proof, in-place overwrite removal, and then compatibility policy and grant hardening.

Do not start the Phase 4B upload and processing pipeline until the PR 4A exit gate is satisfied.

## Phase 4: Media platform

### PR 4A: Media authority redesign

Build:

- logical assets
- immutable file objects
- variants
- usage links
- checksums
- technical metadata
- preservation state
- rights
- consent
- sensitivity
- embargo
- source protection
- replacement history
- retention status
- migration bridge for existing media records

Exit gate:

- existing assets remain usable
- one logical asset can safely hold an original and several derivatives
- no editor depends directly on a mutable storage URL

### PR 4B: Upload and processing pipeline

Build:

- resumable upload sessions
- direct multipart transfer
- upload retry
- completion verification
- processing jobs
- audio derivatives
- video renditions
- poster frames
- thumbnails
- waveform data
- transcripts
- captions
- signed private delivery
- public CDN delivery
- storage reconciliation
- orphan cleanup
- failed-processing recovery

Exit gate:

- real audio and video masters survive interrupted uploads
- original checksums are verified
- public derivatives play
- processing can be retried without another master upload

## Phase 5: Playlist

### PR 5A: Canonical Playlist authority

Build:

- independent Playlist domain
- list and editor routes
- metadata
- cover assets
- atomic ordering
- item identity
- Registry and provider matching
- external pending tracks
- duplicate detection
- notes
- versions
- credits
- capabilities

Exit gate:

- a Playlist can be created and reviewed without Institute involvement
- concurrent ordering cannot corrupt positions

### PR 5B: Public Playlist product

Build:

- public collection and detail routes
- responsive playback
- citations
- provenance
- corrections
- scheduling
- SEO
- cached read model
- migration of useful existing drafts

Exit gate:

- one real Playlist is reviewed and published end to end

## Phase 6: Audio

### PR 6A: Audio publication authority

Build:

- shows
- seasons
- episodes
- standalone audio
- immutable episode versions
- Audio Editor
- master selection
- chapters
- transcripts
- credits
- citations
- RSS contract
- stable GUID and enclosure identity

### PR 6B: Public Audio product

Build:

- public player
- show and episode pages
- transcript navigation
- chapters
- RSS generation
- review
- provenance
- corrections
- scheduling
- search and SEO read models

Exit gate:

- one real podcast episode is published
- its RSS feed validates
- a transcript correction preserves public history

## Phase 7: Video

### PR 7A: Video publication authority

Build:

- standalone videos
- series
- episodes
- documentary, interview, performance, explainer, and field-footage classifications
- Video Editor
- master and derivative management
- posters
- chapters
- captions
- transcript
- credits
- citations

### PR 7B: Public Video product

Build:

- responsive streaming player
- public routes
- accessibility
- review
- scheduling
- provenance
- corrections
- search
- SEO
- cached read models

Exit gate:

- one real captioned video publishes successfully across desktop and mobile

## Phase 8: Field Capture

### PR 8A: Safe mobile intake

Build:

- mobile capture
- file selection
- weak-network queue
- resumable transfer
- private originals
- optional identity disclosure
- anonymous-intake policy
- consent and rights
- sensitivity
- embargo
- metadata stripping
- location protection
- submission receipt

### PR 8B: Newsroom triage and promotion

Build:

- urgent queue
- verification
- source protection
- redaction requirements
- holds
- rejection
- embargo
- editorial notes
- contributor communication
- promotion to Media, Article, Audio, or Video
- immutable intake history

Exit gate:

- a simulated protest recording survives connection loss
- it enters private review
- a safe derivative becomes a draft publication without losing original provenance

## Phase 9: Public delivery, search, and SEO at scale

### PR 9A: Versioned public API and search

Build:

- domain-based public query handlers
- API versioning
- cursor pagination
- cached read models
- validators such as ETags
- outbox-driven cache invalidation
- search documents
- full-text and trigram indexes
- incremental reindexing
- removal of direct complex browser joins

Exit gate:

- public pages no longer require the giant read function
- list performance remains stable at representative large volumes

### PR 9B: Incremental SEO and route infrastructure

Build:

- sitemap index
- sharded sitemaps
- incremental URL updates
- route aliases
- redirect history
- canonical URLs
- publication-driven sitemap jobs
- SEO metadata read models
- load testing

Exit gate:

- adding one publication updates only the relevant sitemap shard
- no build process fetches the entire public corpus

## Phase 10: Registry, Charts, and evidence consolidation

### PR 10A: Shared trust adapters

Integrate:

- Registry evidence
- relationship evidence
- Chart methodology sources
- citations
- corrections
- review events
- provenance
- meaningful review dates

Decouple evidence permissions from Institute-specific capabilities.

Keep Registry and Charts authoritative for their own records.

### PR 10B: Consolidation and scale hygiene

Complete:

- migrate parallel evidence and Inquiry records into chosen authorities
- remove duplicate ownership paths
- archive compatibility tables and functions
- add missing foreign-key indexes
- simplify overlapping RLS policies
- introduce retention and partitioning for high-volume tables
- create analytics and operational rollups
- retire the database-backed request-rate log

Exit gate:

- one reviewed Registry change and one Chart update use the shared trust layer
- no active workflow depends on competing evidence authorities

## Phase 11: Operational proof and production freeze

### PR 11A: Scale and resilience proof

Test in isolated environments with representative volumes of at least:

- 100,000 editorial resources
- hundreds of thousands of sources
- millions of citations and resource links
- millions of provenance and review events
- millions of analytics and operational rows
- large media catalogues
- high concurrent public reads
- competing editorial writes

Verify:

- index usage
- queue throughput
- cursor pagination
- command idempotency
- stale-write handling
- migration duration
- public latency
- cache behaviour
- restoration from failed jobs
- security boundaries

### PR 11B: Disaster recovery and freeze

Establish:

- point-in-time recovery target
- metadata exports
- media inventory
- checksum reconciliation
- restore rehearsal
- queue and worker dashboards
- database-growth dashboards
- slow-query alerts
- incident runbooks
- ownership of each system
- production freeze policy

Target outcomes include:

- no acknowledged editorial command is lost
- core metadata recovery point is measured in minutes, not days
- restoration is rehearsed rather than assumed
- cached public reads remain available during editorial-processing failures
- media originals remain recoverable even when derivatives fail

Exit gate:

- the production team can use every canonical editor without developer assistance
- the restoration drill succeeds
- editor and platform foundations enter freeze

## Phase 12: Inquiry Mode

### PR 12A: Internal power-up

Build:

- active Inquiry state
- start, attach, switch, and exit controls
- persistent context across admin routes
- explicit resource attachment
- many-to-many resource roles
- question versions
- Findings
- Finding-to-source relationships
- publication snapshots
- shared Inquiry sidecar
- contextual actions inside canonical editors

### PR 12B: Public Inquiry product and legacy retirement

Build:

- singular-output Inquiry treatments
- plural Inquiry pages
- connected-work navigation
- Findings and uncertainty
- affected Registry records
- contributors
- sources
- provenance
- corrections
- legacy Inquiry migration
- old Institute retirement

Exit gate:

- one real Inquiry connects an Article, Playlist, and Registry change
- all pages preserve the same Inquiry identity and history
- Inquiry Mode can be turned off without weakening ordinary editors

## Definition of editor completion

Every canonical editor must pass the same baseline.

### Creation and recovery

- create from scratch
- autosave safely
- recover after interruption
- validate required fields
- prevent duplicate accidental publication
- surface partial-save failure clearly
- reject stale overwrites

### Production

- attach or select Media assets
- attach Sources and Citations
- link Registry entities
- add contributors and Credits
- preview the exact public result

### Governance

- submit a specific version for review
- request changes
- approve a specific version
- schedule or publish
- record who acted, what changed, and why
- execute critical transitions transactionally

### Life after publication

- materially update
- correct
- review without changing
- reopen where applicable
- archive
- restore
- preserve earlier published versions

### Public trust

- show publication date
- show meaningful update and review dates
- show Credits
- show Sources where appropriate
- show correction notes
- accept correction submissions
- remain accessible on mobile and desktop

### Reliability

- handle failed uploads
- handle lost connectivity
- preserve drafts
- prevent silent partial writes
- use idempotent transactional commands
- maintain tests around critical lifecycle behaviour
- support backup and export of content and Media references
- expose failed jobs and recovery controls

## Engineering rules

These rules are non-negotiable.

1. No critical write is coordinated through several frontend requests.
2. Every command is idempotent and concurrency-aware.
3. Every reviewed or published state points to an immutable version.
4. Every public editorial change has provenance.
5. Every source, citation, credit, correction, and Inquiry link targets stable resource identity.
6. No privileged function is accidentally callable through inherited grants.
7. No large public collection depends on offset pagination or an exact count per request.
8. No append-heavy table grows forever without a retention or partition plan.
9. No Media preservation master is overwritten.
10. No public route requires loading an entire domain into memory.
11. No new format receives its own citation, review, correction, or Media system.
12. No migration ships without production introspection, rehearsal, and rollback.
13. No architecture is accepted only because the interface looks complete.
14. No phase closes without real cultural work and operational proof.

## Delivery rules

### No infrastructure victory by itself

Every meaningful implementation PR identifies:

- the cultural output or operational safeguard it enables
- the worker using it
- the exact blockage or risk removed
- the public or institutional result
- the real record or test scenario used for verification

A PR is not complete merely because:

- a schema exists
- a route loads
- a table is empty but ready
- an assistant returns structured data
- a polished screen exists
- an abstraction supports hypothetical future work

### Infrastructure is justified only when it

- unblocks named cultural work
- protects data, security, rights, consent, provenance, recovery, or review integrity
- removes machinery from the worker's path
- prevents a known scale or operational failure

### No duplicate editors

The canonical editor is always used.

Inquiry Mode may add contextual capability later, but it may not create an Inquiry-specific version of Article, Playlist, Audio, Video, Registry, Charts, Media, Citations, Review, or Corrections.

### No premature universal builder

Do not build a generic block editor or universal cultural-output editor.

Different outputs retain appropriate production and public experiences while sharing infrastructure underneath.

### No mock-only acceptance

Mock data may support tests.

The primary acceptance proof for each product phase uses real cultural work.

### Production changes stay reversible

Every implementation phase includes:

- migration rollback or forward-repair strategy
- compatibility treatment
- data validation
- observability
- deployment verification

## Explicit non-goals

Do not build during this programme:

- a new standalone Institute application
- new Institute workspaces
- an Inquiry dashboard before Inquiry Mode
- a public Inquiry directory before the first vertical slice
- a browser-based audio workstation
- a browser-based video editor
- custom public livestreaming infrastructure
- speculative microservices
- Kubernetes or Kafka without demonstrated need
- real-time Google Docs-style collaboration
- separate review systems for each output
- separate correction systems for each output
- separate Media libraries
- a universal content blob
- a universal block builder
- an external search engine before PostgreSQL search is proven insufficient
- advanced semantic-research infrastructure before real work requires it
- a graph explorer
- new assistant personas
- speculative output types without a real first-season need

Photo essays may use the Article Editor initially.

Interview transcripts may use Article, Audio, or Video structures.

Documents remain Media assets.

Specialist timelines, datasets, interactives, and livestreams are introduced only when real work proves the need.

## Legacy Institute treatment

The legacy Institute is frozen when this plan is accepted.

Until migration is complete:

- preserve data
- preserve direct routes required for reference
- fix only security, permission, data-loss, migration, and critical compatibility defects
- do not polish the legacy interface
- do not add new workspaces
- do not add new assistant jobs
- do not route new canonical work into Institute-specific editors
- do not create new Institute-specific authorities

After canonical editors and Inquiry Mode are proven:

- migrate useful questions and question history
- migrate valid Sources into the shared Source authority
- migrate valid claims into Findings where appropriate
- migrate useful work-product relationships
- preserve review and assistant audit history
- make legacy routes read-only
- remove obsolete interface and schema through a guarded retirement programme

## Current implementation boundary

Phase 0 through Phase 3 are closed.

The current phase is Phase 4: Media platform.

The next implementation is:

**PR 4A: Media authority redesign**.

This PR must:

- audit the existing Media estate and storage relationships
- define logical assets, immutable file objects, and variants
- define usage links between Media and canonical resources
- define checksums, technical metadata, and preservation state
- define rights, consent, sensitivity, embargo, and source protection
- define replacement history and retention state
- preserve existing Media usability through an explicit migration bridge
- lock the authority boundary and migration sequence before schema implementation

This PR must not:

- begin the upload and processing pipeline
- delete or overwrite existing Media records or files
- make editors depend directly on mutable storage URLs
- reopen Article lifecycle, Publishing, Sources, Citations, Credits, or Corrections
- begin Playlist, Audio, Video, Field Capture, or Inquiry Mode implementation
- create a second Media authority

The PR 4A exit gate remains:

- existing Media assets remain usable
- one logical asset can safely hold an original and several derivatives
- no editor depends directly on a mutable storage URL
- the migration bridge and rollback boundary are explicit
- the authority design is accepted before implementation begins


## Production freeze principle

The production freeze begins only after Phase 11 passes.

During the freeze, foundational changes are limited to:

- security fixes
- data-loss prevention
- publication blockers
- accessibility defects
- severe reliability defects
- legally required changes

New product ideas are recorded without automatically reopening frozen foundations.

## Deployment and verification for this documentation change

- SQL migration needed: No
- Supabase Edge Function deployment needed: No
- frontend deployment needed: No
- Readdy Finish update needed: No
- documentation review needed: Yes
- next implementation plan: PR 4A Media authority redesign


## Research publishing and knowledge licensing

WAKILISHA may later support first-class research works, datasets, and structured knowledge products created by human researchers and knowledge workers.

These works may be published for human use and licensed for authorised machine use.

Trust, publication, rights and access, commercial offers, usage metering, revenue allocation, and payouts must remain separate authorities.

A Citation records provenance and use. It does not grant permission.

A Credit records contribution. It does not determine payout.

Public-safe presentation does not mean unrestricted reuse or machine-training permission.

Article-specific trust attachments are the first adoption path and must not become the permanent universal Citation API.

See `docs/engineering/research-publishing-and-knowledge-licensing-future-contract.md`.

This direction does not add marketplace, payment, licensing, metering, or payout implementation to Phase 3A.
