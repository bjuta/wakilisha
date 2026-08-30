# Phase 7A K4C: Audio Command Convergence Design

## Current-state reconciliation — 30 August 2026

**The kernel movement described in this document is closed.**

Current authority is recorded in
`docs/engineering/phase-7a-kernel-closure-record.md`.

The accepted kernel baseline is production **64/AR3**:
`20260830070752_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement`.

Playlist and Audio typed lifecycle pointer compatibility is physically retired.
Playlist/Audio typed event writers are retired.
Article typed lifecycle readers/writers are retired.
Video uses the shared Resource kernel directly and has no typed lifecycle/review ledger.

A bounded post-kernel hardening candidate at commit
`79b26e4c8db83fe178459c4c497c8fbc8714bb2b`
repairs two separately tracked business-logic defects and freezes retained typed
event tables as inaccessible historical evidence. It does **not** reopen this
kernel milestone.

Any older `Status`, `Current boundary`, `Next test`, production migration
count, or preview instruction below is historical evidence for that checkpoint,
not the current programme state.


Status: DESIGN LOCK CANDIDATE

Opened: 28 August 2026

Accepted production migration head:

`20260827205119_phase_7a_k4c_p3_playlist_pointer_compatibility_retirement`

Accepted production migration count:

`58`

Accepted main at design open:

`6499843240ea0be4771e9280ea768093adba00e2`

Depends on:

- Phase 7A K0 Resource Version Foundation
- Phase 7A K1 Resource Lifecycle Position Convergence
- Phase 7A K2 Video Authority Foundation
- Phase 7A K3 Resource Review and Lifecycle Event Convergence Design
- Phase 7A K4A Shared Resource Event Authority
- Phase 7A K4B Video Governed Lifecycle Commands
- Phase 7A K4C Playlist Command Convergence P1/P2/P3
- accepted Phase 6A Audio Review / publication identity
- accepted Audio Editorial Workbench

## Purpose

K4C continues legacy command convergence with Audio after Playlist proved the
domain-by-domain retirement pattern.

Audio is not a second Playlist.

It has:

- exact immutable Audio publication versions
- Media-governed master and delivery identity
- public-safety checks at submit and publish
- time-point and time-range review threads
- version-bound waveform / delivery review
- typed review and lifecycle event stores
- four K1 typed lifecycle pointer mirrors
- a larger read/write helper surface than Playlist

The goal is therefore to converge Audio onto shared Resource event and lifecycle
position authority without weakening the Audio-specific review and Media
contracts that are already accepted in production.

This design locks the Audio sequence before SQL.

## Production evidence at Audio design open

### Accepted platform state

Production is at:

- migration count: `58`
- migration head: `20260827205119`
- main: `6499843240ea0be4771e9280ea768093adba00e2`
- Playlist typed lifecycle pointer columns: removed
- Audio typed lifecycle pointer compatibility: still intentionally retained

### Audio typed review history

`audio.publication_review_events` contains exactly `3` rows.

Observed actions:

- `submitted`: 1
- `review_started`: 1
- `approved`: 1

Observed event window:

- first: `2026-08-20T17:52:49.15535+00:00`
- last: `2026-08-20T17:53:22.292821+00:00`

Current typed review fingerprint:

`eb181a1390cbb1b732a2ce3bfa05faf3`

All three typed review rows are already represented in
`editorial.resource_review_events` through:

`legacy_source_authority='audio_publication_review'`

Observed unmapped typed Audio review rows:

`0`

### Audio typed lifecycle history

`audio.publication_lifecycle_events` contains:

`0`

Current empty-table fingerprint:

`d41d8cd98f00b204e9800998ecf8427e`

Observed unmapped typed Audio lifecycle rows:

`0`

No historical Audio lifecycle row currently requires catch-up, but preview
acceptance must still prove the compatibility-window catch-up path with a
fixture row.

### Current typed Audio event writers

Direct review writers:

- `public.submit_audio_publication_for_review`
- `public.review_audio_publication`

Typed lifecycle helper:

- `audio.append_publication_lifecycle_event`

Current known consumers of the lifecycle helper include:

- `public.archive_audio_publication`
- `public.restore_audio_publication_from_archive`

The helper currently inserts into:

`audio.publication_lifecycle_events`

and allocates typed event numbers there.

### Current typed Audio event reader

The concentrated typed history reader is:

`public.get_admin_audio_publication_workspace`

It currently reads:

- `audio.publication_review_events`
- `audio.publication_lifecycle_events`

The browser does not read either typed event table directly.

No `src/` code directly references:

- `audio.publication_review_events`
- `audio.publication_lifecycle_events`
- `editorial.audio_publication_resources`

The frontend consumes RPC contracts instead.

## Audio anchored-review boundary

Audio review discussion is not legacy event authority.

The accepted Audio Workbench owns time-anchored discussion through:

- `audio.publication_review_threads`
- `audio.publication_review_comments`

Thread creation is governed by:

`public.create_audio_time_review_thread`

The current contract requires:

1. authenticated review participation
2. publication status in the review window
3. exact current submitted Audio version
4. `time_point` or `time_range` anchor
5. non-negative start
6. valid end for a range
7. immutable target version
8. anchor validation against the frozen submitted delivery duration

These thread/comment rows must remain Audio-specific interaction records.

K4C Audio must not move them into the shared Resource review-event ledger.

The shared review ledger records governed decisions.

Audio review threads record editorial discussion anchored to time.

Those are different primitives and must remain separate.

## Current Audio pointer compatibility

`editorial.audio_publication_resources` contains exactly two production
bindings and still carries four K1 compatibility columns:

- `current_working_version_id`
- `current_submitted_version_id`
- `current_approved_version_id`
- `current_published_version_id`

Accepted Audio binding fingerprint before Audio convergence:

`c17ca0cd697903d0a61a7ed2e4a9fb51`

Current Audio pointer parity drift against `editorial.resources`:

`0`

K1 synchronization currently remains in both directions.

Typed Audio -> Resource:

- trigger:
  `audio_publication_resources_sync_shared_lifecycle`
- helper:
  `editorial.sync_resource_lifecycle_from_typed_binding()`
- accepted helper MD5:
  `1a9a366b7a26d023aa589767a2024651`

Resource -> typed Audio:

- trigger:
  `resources_sync_typed_lifecycle_compatibility`
- helper:
  `editorial.sync_typed_lifecycle_from_resource()`
- accepted Audio-only helper MD5 after Playlist P3:
  `619a2bd22f9066594f84dada7a119902`

Audio is now the only remaining consumer of these K1 typed pointer
compatibility directions.

## Current Audio pointer dependency surface

A broad live-function scan found 18 functions that mention
`editorial.audio_publication_resources` and lifecycle pointer fields:

1. `public.archive_audio_publication`
2. `audio.assert_publication_review_thread_integrity()`
3. `audio.insert_current_publication_snapshot`
4. `audio.publication_content_fingerprint`
5. `public.create_audio_publication`
6. `public.create_audio_time_review_thread`
7. `editorial.sync_typed_lifecycle_from_resource()`
8. `public.get_admin_audio_publication_workspace`
9. `public.get_audio_editorial_workbench`
10. `public.get_public_audio_publication_m1`
11. `public.publish_audio_publication_version`
12. `public.replace_audio_publication_version_citations`
13. `public.replace_audio_publication_version_credits`
14. `public.restore_audio_publication_from_archive`
15. `public.review_audio_publication`
16. `public.save_resource_version_editorial_metadata`
17. `public.snapshot_audio_publication_working_version`
18. `public.submit_audio_publication_for_review`

This is a broad dependency surface, not a claim that all 18 mutate typed
pointers.

Observed direct typed binding writers include at least:

- `public.create_audio_publication`
- `public.snapshot_audio_publication_working_version`
- `public.submit_audio_publication_for_review`
- `public.review_audio_publication`
- `public.publish_audio_publication_version`
- `public.archive_audio_publication`
- the Audio branch of
  `public.save_resource_version_editorial_metadata`
- `editorial.sync_typed_lifecycle_from_resource()`

Some commands already also mutate canonical Resource state. That existing dual
write is compatibility debt, not authority precedent.

## Browser contract

The current Audio review frontend consumes RPC return shapes.

In particular `src/services/audio/audioReviewService.ts` expects the
`get_audio_editorial_workbench` JSON contract to expose:

- `publication_id`
- `resource_id`
- `current_submitted_version_id`
- `can_participate_review`
- exact target version
- time-anchored threads/comments

K4C may change the SQL source of
`current_submitted_version_id` from typed Audio compatibility to canonical
Resource position, but must preserve the browser-visible JSON field and meaning.

No frontend migration is required merely to change SQL authority.

## Sequencing decision

Audio convergence is split into three explicit slices.

The labels below are scoped to Audio so they do not collide with Playlist
P1/P2/P3.

### K4C-A1: Audio shared-event convergence

Purpose:

Retire typed Audio review/lifecycle stores as new-write authority while keeping
the tables physically present as immutable historical compatibility stores.

A1 will:

1. reuse the hardened shared Resource append helpers proven by Playlist
2. catch up any typed Audio review/lifecycle rows written after K4A but before
   A1
3. rewrite Audio submit to shared lifecycle + shared review authority
4. rewrite Audio review decisions to shared review authority and corresponding
   shared lifecycle authority
5. ensure Audio publish records canonical shared lifecycle history
6. reroute `audio.append_publication_lifecycle_event` into canonical shared
   Resource lifecycle authority
7. move pointer reads/writes in materially rewritten submit/review/publish
   paths to `editorial.resources.current_*`
8. move `get_admin_audio_publication_workspace` review/lifecycle history to
   shared Resource ledgers
9. preserve its JSON contract
10. move Audio review-thread exact-current-submitted checks onto canonical
    Resource submitted position
11. preserve all time-anchored review thread/comment tables and semantics
12. preserve Media public-safety checks and immutable submitted-master identity
13. preserve K1 bidirectional Audio pointer synchronization until A3
14. leave typed Audio event tables physically present with no new writers

A1 does not drop Audio typed pointer columns.

### K4C-A2: Remaining Audio pointer convergence

Purpose:

Remove remaining governed Audio command and helper dependence on typed
lifecycle pointer writes, then move remaining readers to canonical Resource
position where safe.

A2 must audit the complete live dependency surface rather than treating the
18-function broad scan as an exact mutation list.

Expected writer/read surfaces include:

- publication creation
- working snapshot
- archive / restore
- Citation / Credit metadata successor paths
- master/transcript/version helper paths that inspect working identity
- public Audio publication reads
- admin workbench reads
- Trust revision helpers
- review-thread integrity helpers

A2 exits only when:

- no governed Audio command directly writes
  `editorial.audio_publication_resources.current_*_version_id`
- no live Audio reader needs those typed fields except the K1 compatibility
  synchronization primitive itself
- canonical Resource pointer parity remains zero-drift

The four compatibility columns still remain during A2.

### K4C-A3: Audio pointer compatibility retirement

Purpose:

Retire the remaining Audio half of K1 pointer duplication only after A1/A2
prove that no live command or reader needs it.

A3 may then:

1. prove no live function depends on Audio typed pointer columns
2. remove `audio_publication_resources_sync_shared_lifecycle`
3. remove `resources_sync_typed_lifecycle_compatibility` if Audio is its last
   consumer
4. retire `editorial.sync_typed_lifecycle_from_resource()` if no dependency
   remains
5. retire `editorial.sync_resource_lifecycle_from_typed_binding()` if no
   dependency remains
6. drop the four Audio pointer foreign keys
7. drop the four Audio typed lifecycle pointer columns without `CASCADE`
8. preserve Audio binding identity and all non-pointer columns
9. regenerate database types from the canonical preview
10. prove browser RPC contracts remain unchanged

A3 must prove helper/trigger dependency counts before dropping shared
compatibility primitives. It must not assume Audio is the last consumer merely
because Playlist has already retired its side.

## A1 event catch-up rule

K4A already backfilled all three current typed Audio review events.

A1 must still defend the compatibility window.

Before switching writers, the migration should:

1. identify typed Audio review rows not mapped through
   `legacy_source_authority='audio_publication_review'`
2. identify typed Audio lifecycle rows not mapped through
   `legacy_source_authority='audio_publication_lifecycle'`
3. reject missing or cross-Resource Resource Version identity
4. reject legacy UUID collisions with unrelated shared events
5. append missing history deterministically after the current shared Resource
   event sequence
6. preserve source UUID, action, status, reason/note, actor, receipt,
   correlation, timestamp, and metadata exactly where present
7. leave typed source rows unchanged

Current production is expected to insert zero catch-up rows.

Preview acceptance must prove both review and lifecycle catch-up with committed
fixture state before A1 apply.

## Audio submit after A1

`public.submit_audio_publication_for_review` keeps its current signature,
idempotency, permissions, Media gate, and return shape.

Its authority changes should be limited to:

1. lock Audio publication and canonical Resource
2. preserve expected authority revision checks
3. validate exact current Media master + selected delivery
4. create the immutable submitted Audio version exactly as today
5. move canonical Resource submitted pointer
6. clear canonical approved pointer
7. preserve `audio.publications.status='ready_for_review'`
8. append shared lifecycle event `submitted`
9. append shared review event `submitted` targeting the exact submitted
   Resource Version
10. preserve one correlation ID across both events
11. complete through the existing command receipt substrate
12. write no typed Audio review event

K1 reverse synchronization may continue mirroring canonical Resource pointers
into the typed Audio binding until A3.

## Audio review after A1

`public.review_audio_publication` keeps current decisions:

- `start_review`
- `request_changes`
- `approve`

Review must target the exact canonical current submitted Resource Version.

The current stale-content protection remains mandatory:

- submitted fingerprint must still equal the current Audio cultural-content
  fingerprint
- Media selection used for the decision remains held stable during the command

### start_review

Append:

- shared review event `review_started`

Do not invent a lifecycle transition merely to mirror the typed table shape.

### request_changes

Append:

- shared review event `changes_requested`
- shared lifecycle event `changes_requested`

Preserve the exact submitted version as historical evidence.

Canonical approved position is cleared as required by the accepted transition.

### approve

Create the immutable approved Audio version exactly as today.

Append:

- shared review event `approved`
- shared lifecycle event `approved`

Move canonical approved pointer.

Write no typed Audio review event.

## Audio publish after A1

`public.publish_audio_publication_version` must preserve the accepted M3
publication identity contract:

- exact current approved Audio version
- last-moment Media public-safety validation
- immutable published Audio version
- stable podcast GUID
- stable enclosure identity
- immutable publication snapshot
- command receipt/idempotency behavior

A1 additionally requires publish to append canonical shared Resource lifecycle
history for the exact published version and move the canonical Resource
published pointer.

No typed Audio lifecycle event is required.

## Audio lifecycle helper after A1

Keep the existing signature of:

`audio.append_publication_lifecycle_event`

but change its implementation into a one-way adapter to
`editorial.append_resource_lifecycle_event`.

It should:

1. preserve the caller-supplied Audio Resource/publication/version identity
2. resolve/validate correlation identity from metadata or command receipt
3. fail closed if a new governed event cannot establish required canonical
   command identity
4. call the shared Resource lifecycle helper
5. return the canonical shared event UUID
6. never write `audio.publication_lifecycle_events`

Archive and restore can therefore converge event authority underneath their
existing command signatures before all remaining pointer reads/writes are
retired in A2.

## Audio workspace after A1

`public.get_admin_audio_publication_workspace` should preserve its JSON
contract while changing history source.

It should read:

- review history from `editorial.resource_review_events`
- lifecycle history from `editorial.resource_lifecycle_events`
- current lifecycle pointers from `editorial.resources`

Its existing publication, master, transcript, chapters, Trust, feed identity,
and capability fields remain unchanged.

Historical K4A imports plus new A1 writes must appear as one continuous
Resource timeline.

## Audio editorial workbench after A1

`public.get_audio_editorial_workbench` must preserve the frontend contract:

- current submitted version identity
- exact target version
- delivery URL
- waveform URL
- duration
- technical source probe
- frozen chapters
- anchored threads/comments
- review participation capability

Only the source of the current submitted pointer changes.

The workbench must continue to resolve the exact submitted immutable Audio
version and never fall back to mutable current Media state.

## Historical typed event tables after A1

A1 does not drop:

- `audio.publication_review_events`
- `audio.publication_lifecycle_events`

They become immutable historical compatibility stores.

Post-A1 ratchets:

- no live function inserts into either table
- admin workspace reads neither table
- current production row counts/fingerprints remain unchanged by ordinary A1
  migration
- preview catch-up fixture rows are cleaned before final seal
- no new compatibility event mirror is introduced

Physical event-table retirement is not required to prove new-write authority
retirement.

## Status compatibility

Audio keeps:

`audio.publications.status`

through A1/A2/A3.

That status remains domain working compatibility state and browser/workbench
language.

K4C Audio does not introduce a second status field and does not remove the
existing one merely because lifecycle history becomes canonical.

## Media authority is non-negotiable

K4C Audio must not weaken Phase 6A Media gates.

Submit and publish must continue to preserve:

- exact `audio_master` Media asset/revision
- selected exact `audio_delivery` variant
- verified `audio/mpeg`
- non-zero byte size
- immutable Media CDN URL
- active Media asset state
- approved public/redacted governance
- acceptable consent
- non-restricted rights
- released/no embargo

Review remains bound to the immutable submitted master.

Shared Resource convergence changes lifecycle/event authority, not Media
authority.

## Anchored review threads remain Audio-specific

K4C must preserve:

- `audio.publication_review_threads`
- `audio.publication_review_comments`
- time-point anchors
- time-range anchors
- open/resolved state
- rich comment/reply semantics
- immutable target version
- duration-bound anchor validation

A1/A2 may change current submitted pointer resolution to canonical Resource
position, but must not migrate these interaction rows into
`editorial.resource_review_events`.

A later cross-domain anchored-review primitive may generalize storage only
after Video proves the shared time-based contract.

## Idempotency and concurrency

All Audio convergence slices must preserve existing command receipt semantics.

Required properties:

- same idempotency key and request cannot duplicate Resource events or versions
- stale authority revision cannot append versions/events
- Resource row locking establishes canonical shared event order
- one command correlation ID survives across lifecycle + review events
- review targets exact canonical submitted version
- approval targets the exact submitted version
- publish targets exact approved version
- Media selection cannot drift through an in-flight governed review/publish
  decision

## Security boundary

K4C Audio must not broaden browser authority.

Requirements:

- no new public mutation RPC merely for convergence
- current Audio RPC signatures remain unchanged
- shared Resource event helpers remain internal
- typed Audio event tables gain no application-role write authority
- anchored review permissions remain
  `editorial.current_user_can_participate_audio_review`
- publish remains governed by existing Audio publish capability
- every privileged helper uses a fixed search path
- all changed function owner / SECURITY DEFINER / search-path / ACL metadata is
  preserved exactly unless a separately justified security fix is part of the
  same reviewed slice

## A1 permanent verifier contract

The A1 verifier must prove at minimum:

1. all typed Audio review history is mapped into shared review history
2. all typed Audio lifecycle history is mapped into shared lifecycle history
3. no live function inserts into `audio.publication_review_events`
4. no live function inserts into `audio.publication_lifecycle_events`
5. submit writes canonical shared lifecycle + review events
6. review writes canonical shared review events and appropriate lifecycle
   events
7. publish writes canonical shared lifecycle history
8. `audio.append_publication_lifecycle_event` routes only to shared Resource
   authority
9. admin workspace reads shared Resource ledgers
10. rewritten submit/review/publish use canonical Resource pointers
11. Audio editorial workbench resolves current submitted identity from
    canonical Resource position
12. timed review thread creation targets the exact canonical submitted version
13. typed Audio pointer mirrors remain exactly synchronized during A1
14. typed Audio review/lifecycle source rows remain unchanged
15. Media/publication identity semantics remain intact
16. Playlist P3 pointer-retirement ratchets remain intact
17. Video still has no typed review/lifecycle event ledger
18. application roles gain no direct event-table mutation authority

## A1 preview acceptance

A fresh disposable preview must first replay all 58 accepted migrations through
Playlist P3.

Before A1 apply, preview should create committed fixture state representing the
compatibility window:

1. temporary Audio Resource/publication
2. exact immutable Audio Resource Version identity
3. one typed Audio review event not yet mapped to shared history
4. one typed Audio lifecycle event not yet mapped to shared history

A1 apply must catch up both exactly while leaving typed source rows unchanged.

After apply, rollback-only governed Audio behavior should prove at minimum:

1. create Audio publication
2. set exact current master/delivery
3. working snapshot
4. submit exact immutable version
5. shared lifecycle `submitted`
6. shared review `submitted`
7. start review
8. shared review `review_started` only
9. create a valid time-point review thread
10. create a valid time-range review thread
11. reject anchor beyond submitted delivery duration
12. request changes with required note
13. resubmit
14. approve exact current submitted version
15. shared review `approved`
16. shared lifecycle `approved`
17. publish exact approved version
18. shared lifecycle `published`
19. stable GUID/enclosure identity unchanged
20. archive through shared lifecycle adapter
21. restore through shared lifecycle adapter
22. same idempotency key creates no duplicate shared events or versions
23. stale authority revision appends nothing
24. workspace JSON keys remain stable while history comes from shared ledgers
25. timed review thread/comment rows remain version-bound and unchanged in
    meaning
26. typed Audio event row counts do not increase during governed commands
27. Resource pointers and typed Audio mirrors remain equal
28. rollback leaves zero fixture residue

## A2 exit condition

A2 closes when no governed Audio command writes a typed lifecycle pointer
directly and no live Audio reader needs the typed pointer fields except the K1
compatibility synchronization primitive.

## A3 exit condition

A3 closes when:

- no live Audio function needs typed lifecycle pointer columns
- Audio typed pointer columns are removed
- Audio-specific typed-to-Resource synchronization is retired
- Resource-to-typed synchronization is retired if Audio is its last consumer
- obsolete shared compatibility helpers are removed only after dependency proof
- Audio Media/review/workbench contracts remain intact
- generated database types are preview-sealed
- production verifier confirms zero pointer compatibility debt for Playlist and
  Audio

## Explicit non-goals

K4C Audio does not:

- redesign the Audio Editorial Workbench
- move timed review comments into shared event ledgers
- add Video review comments
- change public Audio routes
- change RSS or enclosure delivery
- replace the Media pipeline
- change podcast GUID identity
- change Corrections
- remove `audio.publications.status`
- physically drop typed Audio event tables in A1
- modify Article command authority
- deploy an Edge Function
- require a frontend deploy when RPC contracts remain byte-compatible
- update Readdy

## Deployment classification

This design lock is documentation only.

- SQL migration needed: No
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: No
- production runtime change needed: No

## Exit condition

This design closes when merged through protected CI.

The next implementation milestone is:

**Phase 7A K4C-A1 Audio Shared-Event Convergence**

from the accepted 58-migration Playlist-P3 production baseline.
