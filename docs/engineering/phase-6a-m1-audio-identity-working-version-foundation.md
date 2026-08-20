# Phase 6A M1: Audio Identity and Working-Version Foundation

Date: 20 August 2026

## Status

Local candidate contract.

This milestone is the first implementation slice after the Phase 6A Audio publication authority audit.

It does not attempt to finish Phase 6A in one migration.

## Objective

Give WAKILISHA a canonical Audio publication domain before building Audio Review, full-length delivery, the Audio Editor, or public Audio routes.

M1 establishes:

- Audio Show identity
- Audio Season identity
- Audio Episode identity
- Standalone Audio identity
- stable global Resource identity
- typed Resource bindings
- explicit Audio capabilities
- governed create/update commands
- stale-write rejection
- immutable working snapshots for playable Audio publications

## Domain placement

Canonical Audio tables live in a non-exposed `audio` schema.

This is intentional.

Audio is a new domain and does not need to inherit the legacy `public.wk_*` table shape that Playlist carried forward for compatibility.

Browser mutation enters through controlled `public` RPCs.

## Domain objects

### Show

A Show is a stable parent identity.

M1 stores:

- title
- slug
- description
- bounded metadata
- authority revision
- actor and timestamps

Owner and visibility remain global Resource concerns.

### Season

A Season belongs to one Show.

Its stable identity does not depend on title or season number.

M1 permits season number `0` because real podcast catalogues sometimes use it.

### Episode

An Episode is a playable Audio publication attached to one Show and optionally one Season.

Show identity is immutable for the Episode in M1.

Season placement and Episode number may change through governed metadata update.

### Standalone Audio

Standalone Audio is a playable publication with no Show, Season, or Episode numbering.

It shares the same immutable publication-version model as Episode without pretending to be an Episode.

## Resource identity

M1 adds four enabled Resource kinds:

- `audio_show`
- `audio_season`
- `audio_episode`
- `standalone_audio`

Domain UUID and Resource UUID are deliberately the same for each new Audio object.

Typed bindings are:

- `editorial.audio_show_resources`
- `editorial.audio_season_resources`
- `editorial.audio_publication_resources`

`editorial.assert_resource_binding_integrity()` is extended explicitly for all four kinds.

## Version-pointer law

Audio version UUIDs never enter:

- `editorial.resources.current_working_version_id`
- `editorial.resources.current_submitted_version_id`
- `editorial.resources.current_approved_version_id`
- `editorial.resources.current_published_version_id`

Those columns still have Article-version foreign keys.

Audio publication version pointers live only in `editorial.audio_publication_resources`.

This follows the corrected Playlist precedent and avoids cross-domain foreign-key corruption.

## Working versions

Episode and Standalone Audio are the playable publication objects in M1.

Creation immediately records immutable working version 1.

Later metadata mutation changes the working domain record and increments its authority revision.

`snapshot_audio_publication_working_version()` then:

- requires the expected current authority revision
- computes a deterministic content fingerprint
- reuses the current working snapshot when content is unchanged
- creates a new immutable working snapshot when content changed
- moves only the typed Audio working pointer

Show and Season are not given speculative review-version models in M1.

The programme specifically requires immutable Episode versions. Standalone Audio shares that publication model because it is independently publishable.

## Capabilities

M1 adds:

- `view_audio`
- `edit_own_audio`
- `edit_others_audio`
- `publish_audio`
- `delete_audio`

Role grants mirror the accepted Playlist editorial boundary.

Publication and destructive commands are not implemented in M1 even though the permanent capability vocabulary is registered now.

## Commands

M1 registers exactly seven synchronous governed command types:

- `audio.show.create`
- `audio.show.metadata.update`
- `audio.season.create`
- `audio.season.metadata.update`
- `audio.publication.create`
- `audio.publication.metadata.update`
- `audio.publication.version.snapshot_working`

They reuse:

- authenticated command actor authority
- command fingerprints
- idempotency keys
- command receipts
- outbox events
- command result replay
- expected revision checks

No second command ledger exists.

## Security

The `audio` schema is not an exposed browser data surface.

M1:

- revokes Audio schema access from browser roles
- enables RLS on all canonical Audio domain tables
- creates no direct authenticated table policies
- revokes direct Audio table grants from public, anon, and authenticated roles
- exposes only narrow security-definer public RPCs to authenticated and service roles

## Explicit non-goals

M1 does not:

- attach an Audio master
- add a full-length Audio derivative
- change the Media processor
- attach a transcript or caption
- create Chapters
- attach Sources or Citations
- attach Credits
- submit for Review
- approve
- schedule
- publish
- archive or restore
- generate RSS
- define public Audio routes
- alter the global player
- build the Audio Editor
- create public Audio SEO

Those remain later Phase 6 work.

## Preview behavior acceptance

A disposable preview must prove:

1. the accepted production baseline replays before M1
2. four Audio Resource kinds are enabled
3. Show creation is idempotent
4. Season creation is idempotent
5. Episode creation is idempotent
6. Standalone Audio creation is idempotent
7. every object has exactly one correct typed Resource binding
8. Episode and Standalone creation each create immutable working version 1
9. duplicate command replay creates no duplicate object, Resource, receipt, or version
10. a valid metadata update increments authority revision
11. stale metadata update is rejected and does not mutate Audio state
12. unchanged working snapshot reuses the existing version
13. changed working snapshot creates the next immutable version
14. Audio version rows reject update and delete
15. Audio Resource generic Article-version pointers remain null
16. Resource binding integrity still works for existing Resource kinds
17. the permanent read-only verifier passes
18. preview fixtures are removed before preview deletion

## Following work

The next coherent Phase 6A work after M1 should start from observed M1 behavior.

Known remaining needs include:

- full-length governed Audio delivery derivative
- exact Media master/revision attachment
- Review and publication lifecycle
- stable GUID and enclosure identity
- Audio Trust attachment adapters
- transcript and Chapter authority
- Audio Editor

The grouping may change as implementation reveals real dependencies.

