# PR 4B kickoff: Upload and processing pipeline

Date: 7 August 2026

## Status

Ready to start.

## Starting baseline

PR 4B starts after the Phase 4A Media authority redesign closure.

Accepted repository baseline:

- main `f6800cb5`
- Phase 4A closed through PR #580
- 199 authoritative migrations
- latest migration `20260806192259_media_url_cutover.sql`
- generated database types match production
- Critical Control Plane green on final main
- production frontend deployed from final main
- 13 retired WordPress and one-time backfill Edge Functions absent

Phase 4B must not reopen Phase 4A authority.

## Inherited Media authority

PR 4B inherits:

- `media.assets` as stable logical Media identity
- `media.file_objects` as immutable exact-byte identity
- `media.asset_revisions` as immutable replacement history
- `media.variants` as derivative authority
- `media.variant_selections` as active-variant authority
- `media.asset_governance_versions` as governance authority
- `media.usage_links` as resource attachment authority
- `media.legacy_asset_links` as the preserved compatibility bridge
- `media.events` as append-only Media history
- governed public delivery resolution
- governed administrative reads
- governed operational writes
- immutable replacement semantics

No PR 4B design may create a competing Media identity or storage authority.

## Objective

Build a durable upload and processing pipeline that can accept large real Media
masters, survive interruption, verify exact bytes, process derivatives
asynchronously, and recover safely from failure.

The pipeline must work for the future Audio and Video domains without making
those domains responsible for upload infrastructure.

## Build scope

The authoritative project plan defines PR 4B as:

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

## Acceptance proof

PR 4B is not complete until:

- real audio and video masters survive interrupted uploads
- original checksums are verified
- public derivatives play
- processing can be retried without another master upload

## Non-negotiable architecture boundaries

### Immutable masters

A completed master becomes an immutable file object.

Retry, processing, replacement, or delivery must never rewrite a verified
master in place.

### One Media authority

Upload sessions and processing jobs may create and advance Media records only
through the canonical Media command boundary.

Compatibility rows are not upload authority.

### Shared jobs and outbox

Processing must reuse the shared durable job and transactional outbox
contracts.

Do not create:

- a hidden feature-specific queue
- an uninspectable background task
- a second retry ledger
- a second dead-letter model

### Checksum completion

An upload is not complete merely because bytes arrived.

Completion must bind:

- expected upload identity
- exact received byte count
- exact checksum
- immutable storage key
- resulting file object
- command or completion receipt

### Retry and idempotency

Network retries, completion retries, and processing retries must be safe.

A retry must not:

- create duplicate masters
- create duplicate revisions
- duplicate a processing job
- silently change the active revision
- lose the original correlation identity

### Failure visibility

Workers must be able to distinguish at least:

- upload session created
- transfer active
- transfer interrupted
- transfer complete but unverified
- checksum verified
- processing queued
- processing active
- processing partially complete
- processing failed
- processing retryable
- processing terminal
- cancelled
- reconciled

Exact state names are an implementation decision, but the failure semantics
must be explicit before implementation begins.

### Delivery separation

Original preservation and public delivery remain separate concerns.

PR 4B must support:

- protected originals
- public derivatives
- signed private delivery where required
- public CDN delivery where allowed

A public URL must not become the identity of the underlying master.

### No WordPress regression

PR 4B must not introduce:

- WordPress upload fallback
- WordPress Media URLs
- WordPress migration functions
- WordPress connection services
- WordPress-derived runtime modes

Historical WordPress metadata may be read only where an accepted preservation
contract requires it.

## Existing narrow upload proof

Phase 4A already proved a narrow image upload and replacement path through
`media-upload-api` version 18 and the Lightsail Media origin.

That proof is a starting implementation surface, not the PR 4B architecture.

PR 4B must audit it for:

- file-size limits
- request-body limits
- memory behavior
- timeout behavior
- direct-transfer suitability
- multipart capability
- resume capability
- retry behavior
- checksum timing
- storage-key allocation
- authentication
- capability enforcement
- CORS
- derivative coupling
- cancellation
- orphan behavior
- observability

Do not assume the current single-request image path is suitable for large
audio or video masters.

## First engineering move

Begin with a read-only authority and failure-mode audit.

The audit must inventory:

1. current `media-upload-api` request and storage behavior
2. Lightsail and Nginx upload and delivery constraints
3. browser request-size and timeout constraints
4. available multipart or resumable transfer mechanisms
5. current immutable file-object creation command
6. current revision and variant command contracts
7. shared durable job and outbox contracts
8. worker execution and lease behavior
9. processing libraries or services already present
10. checksum creation and verification boundaries
11. current storage reconciliation capability
12. existing orphan cleanup behavior
13. authentication and capability boundaries
14. public and signed delivery surfaces
15. cancellation and partial-upload cleanup requirements
16. minimum end-to-end audio proof
17. minimum end-to-end video proof
18. rollback and recovery requirements

No implementation migration or new upload runtime should be written until this
audit locks the authority boundary and the first narrow proof.

## Immediate non-goals

Do not use PR 4B to:

- redesign Phase 4A Media identity
- reopen Article lifecycle authority
- build the Playlist domain
- build the Audio publication domain
- build the Video publication domain
- build Inquiry Mode
- clean historical WordPress provenance columns
- contract compatibility grants without dependency proof
- rewrite applied migrations
- create speculative processing services without a real proof path

## Handoff

Phase 4A is closed.

The next engineering slice is the PR 4B upload and processing authority audit.
