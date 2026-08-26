# Phase 7A K3: Resource Review and Lifecycle Event Convergence Design

Status: DESIGN LOCK CANDIDATE

Opened: 26 August 2026

Depends on:

- Phase 7A K0 Resource Version Foundation
- Phase 7A K1 Resource Lifecycle Position Convergence
- Phase 7A K2 Video Authority Foundation

Accepted K2 production migration head:

`20260826184252_phase_7a_k2_video_authority_foundation`

Production migration count at design lock:

`53`

## Purpose

K3 resolves the review/lifecycle storage question that K2 deliberately left open.

K2 created typed Video versions and made Video a native consumer of shared Resource lifecycle pointers, but it did not create `video.review_events`, Video submit/review/publish RPCs, or a fourth domain-specific lifecycle ledger.

That stop was intentional.

Playlist and Audio already duplicate substantially the same review-event meaning, while Article carries a separate lifecycle event history. A new Video event family would renew platform debt immediately after K0/K1 established shared Resource Version identity and shared lifecycle position.

K3 therefore defines the shared event authority that Video must consume from its first governed submit/review/publish implementation.

This is a design milestone. It does not mutate production and it does not expose Video commands yet.

## Production evidence

The production audit at K3 open found these existing event stores:

### Article

`editorial.article_lifecycle_events`

Observed actions:

- `submitted`
- `changes_requested`
- `approved`
- `published`
- `archived`
- `restored`

Observed production rows at K3 open:

`35`

### Playlist

`editorial.playlist_review_events`

Observed review actions:

- `submitted`
- `review_started`
- `approved`

Observed production rows at K3 open:

`5`

`editorial.playlist_lifecycle_events`

Observed lifecycle action:

- `published`

Observed production rows at K3 open:

`2`

### Audio

`audio.publication_review_events`

Observed review actions:

- `submitted`
- `review_started`
- `approved`

Observed production rows at K3 open:

`3`

`audio.publication_lifecycle_events`

Observed production rows at K3 open:

`0`

### Video

Video has no review-event or lifecycle-event table.

That absence is now a ratchet, not a missing implementation detail.

## Problem statement

The platform currently has shared authority for:

- stable Resource identity
- immutable Resource Version identity
- current working/submitted/approved/published Resource position

It does not yet have shared authority for:

- append-only lifecycle transition history
- append-only review decision history

The same editorial meaning is therefore split across typed tables.

If Video copied Audio or Playlist, the platform would gain a fourth review-event definition and another lifecycle history surface even though Resource identity and lifecycle position are already shared.

That would make later cross-domain history, provenance, review UI, correction analysis, and command auditing harder rather than easier.

## K3 decision

Create two shared append-only Resource event ledgers in the next SQL milestone:

1. `editorial.resource_lifecycle_events`
2. `editorial.resource_review_events`

The two ledgers have different responsibilities and must not be collapsed into one untyped generic event bucket.

### Why two ledgers

A lifecycle transition answers:

> What durable editorial state transition happened to this Resource?

Examples:

- submitted
- published
- unpublished
- archived
- restored

A review decision answers:

> What governed decision was made about an exact submitted Resource Version?

Examples:

- review started
- changes requested
- approved
- rejected

Review decisions require exact target-version semantics and may produce another immutable version. Lifecycle events may exist without a review target.

The distinction already exists implicitly in Audio and Playlist. K3 preserves it while moving the identity and history boundary to Resource.

## Canonical lifecycle ledger

### Table

`editorial.resource_lifecycle_events`

### Purpose

Canonical append-only history of governed Resource lifecycle transitions across Article, Playlist, Audio, Video, and later Resource-backed domains.

### Candidate columns

- `id uuid primary key default gen_random_uuid()`
- `resource_id uuid not null`
- `event_number bigint not null`
- `action text not null`
- `version_id uuid`
- `prior_status text`
- `resulting_status text`
- `note text`
- `metadata jsonb not null default '{}'::jsonb`
- `actor_id uuid`
- `command_receipt_id uuid`
- `correlation_id uuid`
- `legacy_source_authority text`
- `legacy_source_event_id uuid`
- `created_at timestamptz not null default now()`

### Identity rules

- `resource_id` references `editorial.resources(id)`.
- `version_id`, when present, references `editorial.resource_versions(id)`.
- the referenced Resource Version must belong to the same Resource.
- `event_number` is unique and contiguous per Resource for new governed writes.
- event rows are immutable after insert.

### Command trace rules

For new governed writes:

- `command_receipt_id` is required
- `correlation_id` is required
- the command receipt must belong to the same actor/request context when that identity is available through the existing command substrate

For historical backfill:

- `command_receipt_id` may be null only where the legacy source did not record one
- `correlation_id` may be null only where the legacy source did not record one
- `legacy_source_authority` and `legacy_source_event_id` identify the exact old ledger row

Historical absence of command metadata must not be fabricated.

## Canonical review ledger

### Table

`editorial.resource_review_events`

### Purpose

Canonical append-only history of governed decisions about exact Resource Versions.

### Candidate columns

- `id uuid primary key default gen_random_uuid()`
- `resource_id uuid not null`
- `event_number bigint not null`
- `target_version_id uuid not null`
- `result_version_id uuid`
- `action text not null`
- `prior_status text not null`
- `resulting_status text not null`
- `reason text`
- `actor_id uuid`
- `command_receipt_id uuid`
- `correlation_id uuid`
- `legacy_source_authority text`
- `legacy_source_event_id uuid`
- `created_at timestamptz not null default now()`

### Identity rules

- `resource_id` references `editorial.resources(id)`.
- `target_version_id` references `editorial.resource_versions(id)`.
- target version must belong to the same Resource.
- `result_version_id`, when present, references `editorial.resource_versions(id)` and must belong to the same Resource.
- event rows are immutable after insert.
- one historical source row can map to at most one canonical review event.

### Review meaning

The first shared review vocabulary must preserve existing semantics rather than rename history.

Initial actions should include at least:

- `submitted`
- `review_started`
- `changes_requested`
- `approved`
- `rejected`

Whether `submitted` belongs in both lifecycle and review history is a command-layer decision, not a reason to merge the ledgers.

A submit command may append:

- one lifecycle event recording the Resource state transition
- one review event recording the exact version entering review

That dual event is acceptable because the two ledgers answer different questions.

## Shared controlled vocabulary

Do not use unconstrained arbitrary strings for new writes.

The implementation milestone should add controlled internal vocabulary for:

- lifecycle action
- review action

The first vocabulary must preserve every action already present in production history.

Historical rows are not rewritten merely to fit a smaller normalized vocabulary.

New Video commands must use only enabled shared actions.

## Event numbering

Existing typed ledgers do not all have the same numbering model.

K3 therefore distinguishes:

### Historical imported sequence

Historical source order is preserved by:

- source `created_at`
- source event number where one exists
- deterministic tie-breaking by source event UUID

### Canonical Resource sequence

The shared ledgers assign canonical `event_number` per Resource during backfill and for all future writes.

The number is history position inside the shared ledger, not a copy of a typed event number.

Typed legacy event numbers remain intact on their original rows.

## Backfill strategy

The next SQL milestone should backfill existing durable history into the shared ledgers before Video commands begin.

### Lifecycle backfill sources

- `editorial.article_lifecycle_events`
- `editorial.playlist_lifecycle_events`
- `audio.publication_lifecycle_events`

### Review backfill sources

- `editorial.playlist_review_events`
- `audio.publication_review_events`

Article does not currently have a parallel `article_review_events` table. Its existing governed review outcomes are represented through Article lifecycle history and Article review-mode records.

K3 does not invent historical Article review events that never existed.

### Backfill requirements

- preserve source event UUID in `legacy_source_event_id`
- preserve source authority label
- preserve original action text
- preserve original timestamps
- preserve actor UUID exactly
- preserve version identity through the global Resource Version envelope
- preserve existing notes/reasons/metadata
- never synthesize command receipts for old rows
- fail the migration if an imported version does not belong to the imported Resource
- fail the migration if one legacy source row would map twice

The backfill must be deterministic and rerun-safe inside preview replay.

## Compatibility policy

The current typed event tables remain physically present during K3/K4 compatibility.

They are historical compatibility stores, not new canonical authority.

### Article

`editorial.article_lifecycle_events` remains readable for existing Article UI and command compatibility until the Article history reader is moved to the shared ledger.

### Playlist

`editorial.playlist_review_events` and `editorial.playlist_lifecycle_events` remain readable while Playlist commands are migrated.

### Audio

`audio.publication_review_events` and `audio.publication_lifecycle_events` remain readable while Audio commands are migrated.

### Video

Video receives no typed event tables.

This rule is non-renewable.

## New-write convergence rule

After the shared ledger migration lands:

- Video commands write only the shared Resource ledgers.
- Any materially rewritten Playlist or Audio review/lifecycle command must make the shared Resource ledger the canonical write.
- typed Playlist/Audio event writes may continue temporarily only as compatibility mirrors for readers that still depend on them.
- Article commands should migrate to the shared lifecycle ledger when next materially rewritten.
- no new domain may add another `*_review_events` or `*_lifecycle_events` authority.

The permanent verifier must enforce the Video no-typed-ledger rule.

## Compatibility mirrors

If a legacy reader requires typed rows during command migration, compatibility must be one-way from canonical shared authority to typed storage.

Do not create co-equal bidirectional event authority.

Preferred transition:

```text
governed command
  -> canonical Resource event ledger
  -> compatibility adapter, if still required
  -> legacy typed event row
```

The canonical event must be created first in the same transaction.

A typed compatibility row must carry enough identity to prove which canonical event produced it.

If a safe one-way adapter cannot be added without changing an existing table shape, keep the old command untouched until that domain's command-retirement slice rather than introducing hidden dual truth.

## Review threads and comments

K3 does not make review discussion generic by force.

Existing Article and Audio review threads/comments remain domain interaction records because their anchoring semantics differ:

- Article comments/suggestions anchor into text/editor state
- Audio comments may anchor to time ranges
- future Video review comments will need timecode and possibly track/source context

Shared review event authority does not require one universal comment table.

The canonical reusable interaction primitive remains `EditorialDecisionWorkspace`.

A later anchored-review primitive may generalize comment storage only after Video proves the shared contract.

## Status authority

K3 does not introduce a second canonical status column.

Current lifecycle position remains on `editorial.resources` through:

- `current_working_version_id`
- `current_submitted_version_id`
- `current_approved_version_id`
- `current_published_version_id`

Event rows explain how the Resource reached its current position.

They do not replace the Resource pointers.

Domain working-status columns may remain temporary compatibility state where existing commands still depend on them.

Video must not add a generic mutable lifecycle status merely because shared events now exist.

## Resource Version authority

Every version referenced by a shared lifecycle or review event is global Resource Version identity.

Typed content remains in typed version tables.

For Video:

`editorial.resource_versions.id = video.publication_versions.id`

The shared event ledger therefore never needs domain-specific version foreign keys.

## Video submit/review/publish contract after K3

The first governed Video lifecycle command slice can ship only after the shared event ledgers exist.

### Submit Video for review

Must:

1. authenticate actor
2. enforce Video edit/review participation capability
3. lock the Video Resource/publication
4. verify expected authority revision
5. snapshot immutable working Video state
6. register exact global Resource Version
7. move `editorial.resources.current_submitted_version_id`
8. append shared lifecycle event
9. append shared review event for the exact submitted version
10. commit through existing command/idempotency substrate

### Review Video

Must:

1. target the current submitted Video Resource Version exactly
2. enforce reviewer authority
3. reject stale submitted-version identity
4. record one shared review decision
5. for approval, create or identify the immutable approved Video version as required by the accepted snapshot contract
6. move Resource submitted/approved pointers transactionally
7. append corresponding lifecycle history
8. return command receipt

### Publish Video

Must:

1. require exact current approved Video Resource Version
2. enforce `publish_video`
3. assert publishable Media/source/caption requirements
4. create or identify immutable published Video version
5. move Resource published pointer transactionally
6. append shared lifecycle history
7. preserve prior published version identity in history
8. return command receipt

No Video command may write a typed review/lifecycle ledger because none exists.

## Rejection and changes-requested semantics

K3 preserves the distinction between:

- review decision
- Resource lifecycle position

A `changes_requested` or `rejected` decision does not delete the submitted version.

The exact submitted Resource Version remains historical evidence.

The command may clear or move current lifecycle pointers according to the accepted domain transition contract, but history remains append-only.

## Publication replacement

Publishing a newer approved version must not mutate or relabel the prior published version.

The shared lifecycle event should preserve enough identity to reconstruct:

- previously published version
- newly published version
- actor
- command receipt
- correlation
- timestamp

The Resource pointer moves; immutable versions and event history remain.

## Corrections and provenance

K3 does not replace the shared Corrections system.

Resource review/lifecycle events become another provenance input.

Corrections continue to own:

- correction cases
- correction decisions
- correction applications
- public correction notes
- related-resource review

A later provenance read model may compose:

- Resource versions
- Resource lifecycle events
- Resource review events
- Credits/Citations
- Corrections

No duplicate Video correction store is introduced.

## Security boundary

Both shared event ledgers are internal editorial authority.

Requirements:

- RLS enabled
- no direct table privileges for `PUBLIC`, `anon`, or `authenticated`
- direct service-role access only if an existing trusted operational path genuinely requires it
- governed public-schema RPCs remain the browser mutation boundary
- integrity helpers use fixed `search_path`
- privileged helpers are not directly executable by application roles
- append-only protection blocks update/delete

## Idempotency and concurrency

Shared event writes are part of the existing command transaction.

The event ledger must not become a separate eventually-consistent audit sink.

Required properties:

- same idempotency key cannot create duplicate canonical events
- stale expected revisions fail before pointer/event commit
- Resource row locking establishes transition order
- command receipt identity binds the event to one governed mutation
- correlation identity survives across lifecycle + review events created by one command

## Read model

K3 does not expose a new public history API.

The first internal shared history reader may later return a Resource timeline composed from both ledgers.

Until that reader exists, existing domain readers may keep using typed compatibility tables.

Video History UI should consume the shared Resource timeline when the Video Editor frontend slice arrives.

Do not create a Video-specific history endpoint.

## Migration sequencing after this design lock

### K4A: Shared Resource event authority

Additive SQL only:

1. controlled lifecycle/review action vocabulary
2. `editorial.resource_lifecycle_events`
3. `editorial.resource_review_events`
4. immutable/identity integrity
5. deterministic historical backfill
6. read-only verifier
7. focused contract tests
8. no command rewrites yet except any minimal adapter required to prove write authority safely

### K4B: Video governed lifecycle commands

Implement the minimum Video command set required for:

- snapshot working
- submit
- review
- publish

using shared Resource ledgers from first write.

### K4C: Legacy command convergence

Retire duplicated event write authority domain by domain when materially rewriting:

- Playlist
- Audio
- Article

Do not combine all legacy command rewrites into K4A merely to claim immediate cleanup.

## K4A permanent verifier contract

The shared-event migration verifier must prove at minimum:

- both canonical Resource event ledgers exist
- both are append-only
- both reference shared Resource identity
- every version reference resolves through `editorial.resource_versions`
- referenced versions belong to the same Resource
- canonical event numbering cannot duplicate per Resource
- historical backfill row counts/source identities are complete
- legacy source event UUID maps at most once
- no Video review/lifecycle event table exists
- production Article/Playlist/Audio event tables remain intact
- existing domain event row counts and source hashes are unchanged by backfill
- application roles have no direct table write access
- any privileged integrity helpers use fixed search paths and closed ACLs

## K4B permanent verifier extension

The Video command verifier must additionally prove:

- Video submit writes exact Resource submitted pointer
- Video submit records canonical shared lifecycle/review events
- Video review targets exact submitted Resource Version
- Video approval moves canonical approved pointer
- Video publish targets exact approved Resource Version
- Video publish moves canonical published pointer
- idempotent replay does not duplicate versions or events
- stale expected revision cannot append events
- no typed Video lifecycle/review ledger exists

## Preview acceptance

K4A preview proof must begin from a healthy replay of the complete 53-migration K2 baseline.

Temporary fixtures should prove:

1. shared event ledgers accept valid Resource/Resource Version identity
2. cross-Resource version references fail
3. duplicate legacy-source import identity fails
4. event update/delete fails
5. canonical event-number collision fails
6. application-role direct write fails
7. historical backfill is complete and deterministic
8. rollback leaves zero fixture residue

K4B preview proof must additionally exercise a real temporary Video lifecycle:

1. create standalone Video
2. snapshot working
3. submit exact version
4. begin/review
5. approve
6. publish
7. verify Resource pointers
8. verify shared lifecycle history
9. verify shared review history
10. replay same idempotency keys and prove no duplication
11. roll back fixtures

## Explicit non-goals

K3/K4A does not build:

- Video Editor frontend
- public Video routes
- public Video history API
- generic review comment storage
- a universal timed-comment table
- public Video playback
- HLS
- user Video upload
- Field Capture
- a second Corrections system
- a second provenance store
- immediate deletion of Article/Playlist/Audio legacy event tables

## Primitive impact

### Promoted foundation

- Resource identity
- Resource Version identity
- Resource lifecycle position
- Resource lifecycle event history
- Resource review decision history

### Compatibility retained temporarily

- Article lifecycle event table
- Playlist review/lifecycle event tables
- Audio review/lifecycle event tables

### Video rule

Video consumes the shared Resource event primitives directly and never gains typed lifecycle/review event tables.

## Deployment classification

This K3 design lock is documentation only.

- SQL migration needed: No
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: No
- production runtime change needed: No

## Exit condition

K3 closes when this design is merged through protected CI.

The next implementation milestone is K4A Shared Resource Event Authority from the accepted production K2 baseline.
