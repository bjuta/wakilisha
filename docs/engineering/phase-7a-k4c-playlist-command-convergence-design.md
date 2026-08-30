# Phase 7A K4C: Playlist Command Convergence Design

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

Opened: 27 August 2026

Accepted production migration head:

`20260827125306_phase_7a_k4b_video_governed_lifecycle_commands`

Accepted production migration count:

`55`

Accepted main at design open:

`ac06e56c41b6a2da0e03ca9987f09d2c96fc4a22`

Depends on:

- Phase 7A K0 Resource Version Foundation
- Phase 7A K1 Resource Lifecycle Position Convergence
- Phase 7A K2 Video Authority Foundation
- Phase 7A K3 Resource Review and Lifecycle Event Convergence Design
- Phase 7A K4A Shared Resource Event Authority
- Phase 7A K4B Video Governed Lifecycle Commands

## Purpose

K4C begins retirement of legacy duplicated command authority domain by domain.

The accepted K3 design explicitly requires K4C to converge:

1. Playlist
2. Audio
3. Article

without combining every legacy rewrite into one high-blast-radius migration.

Playlist is the first domain because its event-authority surface is materially narrower than Audio or Article and already sits inside the same `editorial` schema boundary as the shared Resource event ledgers.

This design locks the Playlist sequence before SQL.

## Production evidence at K4C open

### Shared K4A authority

Canonical append-only history already exists in:

- `editorial.resource_lifecycle_events`
- `editorial.resource_review_events`

K4B proved that a new domain can consume those ledgers directly from its first governed lifecycle command.

### Playlist typed compatibility stores

Production currently retains:

- `editorial.playlist_review_events`
- `editorial.playlist_lifecycle_events`

Observed production counts at K4C open:

- typed Playlist review rows: `5`
- typed Playlist lifecycle rows: `2`

All seven typed Playlist event rows are already represented in the shared K4A ledgers.

Observed unmapped rows:

- Playlist review not backfilled: `0`
- Playlist lifecycle not backfilled: `0`

Latest typed Playlist review event:

`2026-08-11T13:46:37.724538+00:00`

Latest typed Playlist lifecycle event:

`2026-08-11T13:48:23.488948+00:00`

No Playlist typed event has been written since K4A landed.

### Current Playlist event writers

Review writers:

- `public.submit_playlist_for_review`
- `public.review_playlist`

Lifecycle writers funnel through:

- `editorial.append_playlist_lifecycle_event`

That helper is consumed by governed schedule, publish, unpublish, archive, restore, and related publication paths, including `editorial.record_playlist_publication_lifecycle_event`.

### Current Playlist typed event reader

The only live Playlist editorial workspace reader of typed event history is:

- `public.get_playlist_review_workspace`

No browser service reads the typed event tables directly.

### K1 pointer compatibility debt

K1 made `editorial.resources.current_*_version_id` canonical lifecycle position and explicitly downgraded:

`editorial.playlist_resources.current_*_version_id`

to synchronized compatibility mirrors.

K1 also ratcheted that when Playlist command authority is materially rewritten, rewritten command paths should consume canonical Resource pointers instead of renewing the typed pointer dependency.

The production audit found a broader Playlist pointer dependency surface, including review, snapshot, publish, scheduling, public reads, Trust helpers, and compatibility synchronization.

That wider surface is too large to retire safely in the same SQL change as first event convergence.

## K4C sequencing decision

K4C Playlist convergence is split into three explicit slices.

### K4C-P1: Playlist shared-event convergence

Purpose:

Retire Playlist typed event tables as new-write authority while keeping them physically present as immutable historical compatibility stores.

P1 will:

1. add reusable internal shared Resource event append helpers
2. catch up any Playlist typed events written after K4A but before K4C-P1
3. rewrite Playlist submit to shared lifecycle + shared review history
4. rewrite Playlist review decisions to shared review history and lifecycle history where appropriate
5. reroute `editorial.append_playlist_lifecycle_event` to canonical shared lifecycle history
6. move rewritten submit/review pointer reads and writes to `editorial.resources.current_*`
7. move `public.get_playlist_review_workspace` to shared Resource event history and canonical Resource pointers
8. preserve typed Playlist event tables without new writers
9. preserve every existing Playlist command signature and browser contract
10. preserve K1 bidirectional pointer synchronization during the transition

P1 does not remove Playlist typed lifecycle pointer columns.

### K4C-P2: Remaining Playlist pointer-writer convergence

Purpose:

Remove remaining governed Playlist command dependence on typed lifecycle pointer writes.

P2 will migrate remaining command writers to canonical `editorial.resources.current_*`, including the applicable paths for:

- working snapshot
- publish
- scheduled publish
- unschedule
- unpublish
- archive
- restore
- due scheduled publication execution
- any shared metadata or Trust command that still mutates Playlist pointer mirrors

P2 does not drop compatibility columns yet.

P2 exits only when no governed Playlist command writes `editorial.playlist_resources.current_*_version_id` directly.

### K4C-P3: Playlist pointer compatibility retirement

Purpose:

Retire the Playlist half of K1 pointer duplication only after writers and readers no longer depend on it.

P3 may then:

1. migrate remaining Playlist readers/helpers to canonical Resource pointers
2. prove no live function depends on Playlist typed pointer columns
3. remove the Playlist typed-to-Resource synchronization trigger
4. narrow the Resource-to-typed synchronization function so Playlist no longer participates
5. drop Playlist typed lifecycle pointer columns in a dedicated compatibility-retirement migration
6. preserve Audio pointer compatibility until the Audio K4C slice completes

P3 must not modify Audio compatibility merely because the synchronization primitive is shared.

## Why Playlist goes before Audio

Playlist has:

- two direct review writers
- one lifecycle append helper
- one concentrated review-workspace event reader
- seven historical typed event rows
- no post-K4A typed event drift today

Audio has:

- separate `audio` schema authority
- review and lifecycle typed stores
- a larger editorial workbench
- time-based review semantics
- deeper Media coupling

Playlist is therefore the lower-risk first proof that a mature legacy domain can converge onto K4A without renewing dual truth.

## Why Article goes after Playlist and Audio

Article currently has substantially broader lifecycle coupling.

The production audit found typed Article lifecycle writes in commands covering:

- submit
- changes requested
- approval
- publication
- scheduled publication execution
- archive
- restore
- unpublish
- suggestion acceptance
- review-mode interaction

Article also participates in Corrections and scheduled publication proof.

Article convergence should therefore consume the patterns proven by Playlist and Audio rather than becoming the first legacy rewrite.

## K4C-P1 canonical event helpers

P1 should introduce reusable internal helpers rather than copying K4B raw event-number logic into every legacy domain.

Candidate internal helpers:

- `editorial.append_resource_lifecycle_event`
- `editorial.append_resource_review_event`

The helpers should:

1. be `SECURITY DEFINER`
2. use fixed `search_path`
3. have direct execution revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`
4. lock the target `editorial.resources` row before allocating the next event number
5. require canonical Resource / Resource Version identity
6. require command receipt and correlation identity for new events
7. preserve the K4A actor/receipt integrity contract
8. return an existing event for the same receipt/action where K4A idempotency already defines that identity
9. never write a typed compatibility event row

These helpers become reusable foundations for Audio and Article K4C slices.

## K4C-P1 catch-up rule

K4A backfilled typed history at one point in time.

P1 must protect against a narrow compatibility window in which an environment could receive another typed Playlist event after K4A and before K4C-P1.

Before switching writers, the migration should:

1. identify typed Playlist lifecycle rows not mapped through `legacy_source_authority='playlist_lifecycle'`
2. identify typed Playlist review rows not mapped through `legacy_source_authority='playlist_review'`
3. reject missing or cross-Resource Resource Version identity
4. reject legacy UUID collisions with unrelated shared events
5. append missing history deterministically after the current shared Resource event sequence
6. preserve source UUID as both canonical row UUID and `legacy_source_event_id` where safe
7. preserve source action, status, note/reason, actor, receipt, timestamp, and metadata exactly
8. classify those rows as legacy compatibility imports, not new canonical command events
9. leave the typed source rows byte-for-byte unchanged

Current production is expected to insert zero catch-up rows.

Preview acceptance must prove the catch-up path with committed fixture state before P1 apply.

## Playlist submit after P1

`public.submit_playlist_for_review` must preserve existing Playlist business rules and browser return shape.

Its authority changes should be limited to:

1. lock Playlist and canonical Resource
2. use `editorial.resources.current_*` for lifecycle position
3. preserve expected authority revision checks
4. preserve existing working snapshot / Trust requirements
5. create the immutable submitted Playlist version exactly as today
6. move canonical Resource submitted pointer
7. clear canonical approved pointer
8. append one shared lifecycle event:
   - action: `submitted`
9. append one shared review event:
   - action: `submitted`
   - target: exact submitted Resource Version
10. preserve one correlation ID across both shared events
11. complete through the existing command receipt substrate

No typed Playlist review event is written.

K1 reverse synchronization may continue mirroring canonical Resource pointers into `editorial.playlist_resources` until P3.

## Playlist review after P1

`public.review_playlist` keeps existing decisions:

- `start_review`
- `request_changes`
- `approve`

It must target the exact canonical current submitted Resource Version.

### start_review

Append:

- shared review event `review_started`

Do not invent a lifecycle event.

### request_changes

Append:

- shared review event `changes_requested`
- shared lifecycle event `changes_requested`

The exact submitted version remains historical evidence.

Canonical approved pointer is cleared.

### approve

Create the immutable approved Playlist version exactly as today.

Append:

- shared review event `approved`
- shared lifecycle event `approved`

Move canonical approved pointer.

No typed Playlist review event is written.

## Playlist lifecycle helper after P1

The existing public command surface should not be expanded merely to change event storage.

Keep the current signature of:

`editorial.append_playlist_lifecycle_event`

but change its implementation into a one-way adapter to canonical shared Resource lifecycle authority.

It should:

1. resolve correlation identity from explicit metadata when present
2. otherwise resolve correlation from the command receipt request/result payload
3. fail if no valid correlation can be established for a new event
4. call the shared Resource lifecycle helper
5. return the canonical shared event UUID
6. never write `editorial.playlist_lifecycle_events`

This lets existing schedule/publish/unpublish/archive/restore commands converge their event writes without rewriting their full business logic in P1.

## Playlist publication trigger

`editorial.record_playlist_publication_lifecycle_event` currently records `published` through the Playlist lifecycle helper.

P1 keeps the trigger contract but changes the helper underneath it.

The trigger therefore becomes a canonical shared lifecycle writer without becoming a second source of event authority.

## Playlist workspace after P1

`public.get_playlist_review_workspace` should preserve its JSON contract while changing the source of truth.

It should read:

- review history from `editorial.resource_review_events`
- lifecycle history from `editorial.resource_lifecycle_events`
- working/submitted/approved/published pointers from `editorial.resources`

Historical K4A backfill plus new P1 writes must therefore appear as one continuous Resource timeline.

The workspace must not query Playlist typed event tables after P1.

## Historical typed tables after P1

P1 does not drop:

- `editorial.playlist_review_events`
- `editorial.playlist_lifecycle_events`

They remain historical compatibility stores.

Required post-P1 ratchets:

- no live function inserts into either table
- no Playlist review workspace reads either table
- their production row counts and fingerprints remain unchanged by ordinary P1 migration on current production
- any catch-up fixture rows used in preview are cleaned before seal
- no new compatibility mirror is introduced

Physical table retirement is not required to prove new-write authority retirement.

## Status compatibility

P1 does not remove `public.wk_playlists.status`.

That column remains existing Playlist working compatibility state.

K3 explicitly allows domain working-status columns to remain temporarily where current commands depend on them.

P1 must not invent a second new status field.

## K1 pointer compatibility during P1

P1 intentionally retains:

- `playlist_resources_sync_shared_lifecycle`
- `resources_sync_typed_lifecycle_compatibility`

The rewritten submit/review/workspace path uses canonical Resource pointers directly.

The reverse K1 synchronization trigger keeps typed mirrors equal for untouched Playlist functions until P2/P3.

The permanent verifier must continue to require exact pointer parity.

## Idempotency and concurrency

P1 must preserve the existing Playlist command receipt semantics.

Required properties:

- same idempotency key and request cannot duplicate shared events
- stale authority revision cannot append versions or events
- Resource row locking establishes shared event order
- one command correlation ID survives across lifecycle + review rows
- review must target exact canonical submitted pointer
- approval must move exact canonical approved pointer

## Security boundary

P1 must not broaden browser authority.

Requirements:

- no new public mutation RPC
- current Playlist RPC signatures remain unchanged
- shared event helpers remain internal
- typed event tables remain unavailable for direct application-role mutation
- shared event table ACL/RLS remains K4A authority
- anonymous execution behavior of existing Playlist RPCs remains unchanged
- all new privileged helpers use fixed search paths and closed ACLs

## K4C-P1 permanent verifier contract

The verifier must prove at minimum:

1. generic shared lifecycle/review append helpers exist and are hardened
2. Playlist typed review/lifecycle tables still exist
3. Playlist typed table historical source rows remain represented in shared history
4. no typed Playlist source row is left unmapped
5. no live function contains an insert into `editorial.playlist_review_events`
6. no live function contains an insert into `editorial.playlist_lifecycle_events`
7. `submit_playlist_for_review` writes shared lifecycle and shared review authority
8. `review_playlist` writes shared review authority and lifecycle authority for changes/approval
9. rewritten submit/review use canonical `editorial.resources.current_*` pointers
10. `append_playlist_lifecycle_event` routes only to shared lifecycle authority
11. `get_playlist_review_workspace` reads shared Resource ledgers
12. `get_playlist_review_workspace` reads canonical Resource pointers
13. Playlist typed pointer mirrors remain exactly synchronized with Resource pointers
14. K4A append-only / Resource-Version event integrity remains intact
15. K4B Video no-typed-ledger ratchet remains intact
16. application roles gain no direct event-table mutation authority

## K4C-P1 preview acceptance

A fresh disposable preview must replay the full accepted 55-migration K4B baseline first.

Before P1 apply, preview should create rollback-capable committed fixture state that simulates the compatibility window:

1. temporary Playlist Resource
2. exact Playlist Resource Version identity
3. one typed Playlist review event not yet mapped to shared history
4. one typed Playlist lifecycle event not yet mapped to shared history

P1 apply must prove those rows are caught up exactly and source rows are unchanged.

After apply, rollback-only governed Playlist behavior should prove:

1. working snapshot
2. submit
3. shared lifecycle `submitted`
4. shared review `submitted`
5. start review
6. shared review `review_started` only
7. request changes path with reason
8. resubmit
9. approve exact current submitted version
10. shared review `approved`
11. shared lifecycle `approved`
12. schedule and unschedule through the rerouted lifecycle helper
13. publish through the publication trigger/helper path
14. unpublish
15. archive
16. restore
17. idempotent replay creates no duplicate shared events
18. stale revision creates no version/event append
19. workspace returns the same JSON keys but history from shared ledgers
20. typed Playlist event row counts do not increase during governed commands
21. Resource pointers and typed compatibility mirrors remain equal
22. rollback leaves zero temporary fixture residue

## P1 non-goals

K4C-P1 does not:

- drop Playlist typed event tables
- drop Playlist typed lifecycle pointer columns
- remove K1 synchronization triggers
- rewrite every Playlist pointer-dependent helper
- change Playlist UI
- change public Playlist route contracts
- deploy an Edge Function
- modify Audio command authority
- modify Article command authority
- change Video lifecycle commands
- introduce generic review comments
- modify Corrections
- remove `wk_playlists.status`

## P2 exit condition

K4C-P2 closes when no governed Playlist command writes a typed lifecycle pointer directly.

The compatibility columns may still exist until P3.

## P3 exit condition

K4C-P3 closes when:

- no live Playlist function needs typed lifecycle pointer columns
- Playlist typed pointer columns are removed in their dedicated compatibility-retirement migration
- Playlist-specific typed-to-Resource synchronization is retired
- Resource-to-typed synchronization no longer includes Playlist
- Audio compatibility remains untouched until its own convergence slice

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

**Phase 7A K4C-P1 Playlist Shared-Event Convergence**

from the accepted 55-migration K4B production baseline.
