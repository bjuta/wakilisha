# Phase 7A K4B Video Governed Lifecycle Commands Implementation Audit

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


Status: LOCAL CANDIDATE

Accepted main at milestone open:

`4aeab5c3ef37d82f216a7960f6e70207b2a86807`

Accepted production migration head:

`20260827095753_phase_7a_k4a_resource_event_authority`

Production migration count:

`54`

## Purpose

K4B activates the minimum governed Video lifecycle command surface after K0, K1, K2, K3, and K4A established the kernel primitives it must consume.

The slice is intentionally narrow:

- snapshot current Video working state
- submit the exact current working Video version
- review the exact submitted Video version
- approve an immutable Video version
- publish the exact approved Video version

No Video editor frontend, public playback route, history API, generic review-comment storage, HLS authority, user upload, or Field Capture is introduced here.

## Kernel authority decisions

### Resource remains lifecycle position authority

K4B does not add:

- `video.publications.status`
- Video lifecycle pointer mirrors
- Video review-event tables
- Video lifecycle-event tables

Mutable position remains exclusively on:

`editorial.resources`

through:

- `current_working_version_id`
- `current_submitted_version_id`
- `current_approved_version_id`
- `current_published_version_id`

`lifecycle_state` remains the coarse Resource state. Review state is reconstructed from immutable shared event history and exact pointers rather than a Video status mirror.

### Shared K4A ledgers are the only new event authority

Video submit writes:

- one `editorial.resource_lifecycle_events` row
- one `editorial.resource_review_events` row

Video review writes:

- one shared review event for every accepted decision
- a shared lifecycle event only for `changes_requested` and `approved`

`review_started` remains a review decision, not a fabricated lifecycle action.

Video publish writes:

- one shared lifecycle `published` event

No typed compatibility mirror exists for Video.

### Working snapshot is meaningful authority

K4B does not make the working-snapshot command ceremonial.

Submit requires:

- an exact current `current_working_version_id`
- typed Video `version_kind='working'`
- the same Video Resource and publication identity
- current content fingerprint equality
- the working snapshot `source_authority_revision` to equal the current publication authority revision

If any condition drifted, submit rejects and requires a new working snapshot.

### Immutable Video snapshot content

The current Video content fingerprint covers:

- Video Resource/publication identity
- standalone identity or canonical shared Show Episode identity
- shared Show/Show Episode authority revisions
- classification
- exact immutable selected Video Source identity
- Video metadata
- typed caption semantics
- typed chapter semantics
- active Video Media usage identity

A Video Episode snapshot derives slug/title/summary from `editorial.show_episodes`, never from new Video-local duplicate fields.

### Media usage is version-bound provenance

Every working Video snapshot copies active unversioned Video Media usage into immutable version-bound usage with:

- `target_authority='video'`
- `target_kind='video_publication'`
- `target_version_kind='video_publication_version'`
- exact target Video version UUID
- `resolution_mode='exact_revision'`
- exact Media asset/revision
- semantic usage role and placement snapshots

Submitted, approved, and published Video versions copy the exact version-bound Media usage from their source version.

This activates the version-bound Video Media contract that K2 intentionally prepared without reinterpreting historical Article/Playlist Media semantics.

### Caption semantic and Media agreement

Before snapshot:

- every typed `video.caption_tracks` row must have matching active exact-revision `video_caption` Media usage
- every active working `video_caption` usage must resolve to typed Video caption semantics

Native selected source still requires one exact active working `video_master` usage matching the immutable Video Source.

Provider-backed Video still requires zero native master usages.

### Review authority

Submit uses Video edit authority.

Review decisions require:

- administrator, or
- `manage_review_queue`

K4B also adds the internal hardened helper:

`editorial.current_user_can_participate_video_review(resource_id)`

for future review workspace reads, composing Video edit authority with existing review queue capabilities.

No new Video-specific reviewer capability is invented.

### Publishability

Publish requires:

- exact current approved Resource Version
- current Video authority revision
- approved content fingerprint still matching current working publication content
- `publish_video`
- current provider enabled for provider-backed Video, or exact native source Media still public-safe
- every version-bound active Media usage still exact-revision and public-safe

For native Media, the current governance recheck retains the K2 public safety boundary:

- active Media asset
- exact verified revision
- public safety approved
- rights allowed
- consent granted/not required
- source protection public/public-redacted
- retention retain/review-required
- no blocking embargo

Publishing creates a new immutable `published` Video version rather than relabeling the approved version.

The prior published Resource Version identity is recorded in lifecycle event metadata.

## Authority revision semantics

`video.publications.authority_revision` remains the command concurrency token.

Working snapshot does not mutate content or increment the revision.

Accepted submit/review/publish commands increment it exactly once.

The content fingerprint deliberately excludes the mutable command revision. That lets lifecycle commands serialize without pretending editorial content changed.

A working snapshot is not reused after a lifecycle command solely because content happens to be unchanged. Its `source_authority_revision` must also equal the current publication authority revision.

## Idempotency

All four public lifecycle RPCs use the existing Resource command substrate:

- `platform_private.begin_authenticated_resource_command`
- `platform_private.read_authenticated_resource_command_result`
- `platform_private.reject_resource_command`
- `platform_private.complete_resource_command`

Same principal + command type + idempotency key + same request returns the existing command receipt/result without:

- duplicate Video versions
- duplicate shared lifecycle events
- duplicate shared review events

A reused idempotency key with a different request remains rejected by the existing command substrate.

## Public RPC surface

K4B exposes only:

- `public.snapshot_video_publication_working_version`
- `public.submit_video_publication_for_review`
- `public.review_video_publication`
- `public.publish_video_publication_version`

Anonymous execution is revoked.

Authenticated and service-role execution is granted, matching the governed Audio/Playlist command boundary.

Authorization still occurs inside each security-definer function.

## Preview acceptance requirements

A fresh disposable preview must first replay all 54 accepted migrations through K4A.

Only after baseline replay is healthy may K4B apply.

Rollback-only fixtures must exercise at minimum:

1. create temporary standalone Video Resource/publication
2. register an enabled external provider Video Source
3. select the source
4. snapshot working
5. replay snapshot idempotently and prove no duplicate working version
6. submit exact working version
7. prove Resource submitted pointer
8. prove shared lifecycle `submitted`
9. prove shared review `submitted`
10. start review
11. approve exact submitted version
12. prove approved Resource pointer
13. publish exact approved version
14. prove published Resource pointer/state/visibility
15. prove shared lifecycle history is contiguous and exact
16. prove shared review history is contiguous and exact
17. replay submit/review/publish idempotency keys and prove no duplicate versions/events
18. use stale expected authority revision and prove no event/version append
19. prove no typed Video event table exists
20. rollback every fixture and independently prove zero residue

A second focused fixture should exercise at least one native exact-revision Media snapshot path before production so version-bound Media usage is not proven only through provider-backed Video.

## Production-shape rule learned from K4A

K4B has no historical backfill.

Even so, preview proof must not rely only on empty tables when a command path is supposed to consume existing kernel primitives.

At minimum the preview must contain committed fixture state that activates:

- shared Resource pointers
- shared K4A event sequencing
- exact Resource Version registration
- command receipts
- external-provider lifecycle
- native Media version-bound usage

No production promotion is allowed from static/empty-state proof alone.

## Security posture

New internal helpers are:

- fixed-search-path where privileged
- direct execution revoked from PUBLIC, anon, authenticated, and service_role

Public lifecycle commands are security-definer RPC boundaries.

Direct Video table mutation remains closed.

Direct shared event table mutation remains closed.

No browser role receives new table grants.

## Explicit non-goals

K4B does not add:

- Video Editor UI
- public Video read route
- public playback
- public Video history API
- review comment/thread storage
- timecode comment primitive
- HLS/adaptive streaming
- user Video upload
- Video source/create/edit RPCs beyond the lifecycle commands in this slice
- Article embeds
- Corrections duplication
- lifecycle pointer mirrors
- typed Video event tables
- a Video status column

## Deployment classification

SQL migration needed: Yes.

Supabase Edge Function deploy needed: No.

Readdy Finish update needed: No.

Frontend deploy needed: No.

PR needed now: Not yet.

Production runtime mutation before preview/merge: No.

## Exit condition

K4B closes only after:

1. exact native migration identity
2. local focused gates
3. fresh 54-migration K4A baseline replay
4. K4B candidate apply
5. permanent verifier pass
6. provider-backed lifecycle fixture pass
7. native Media version-bound fixture pass
8. rollback/residue pass
9. canonical replay proof/schema snapshot
10. focused + critical + build gates
11. exact candidate bytes
12. commit/push/PR
13. protected PR CI
14. merge
15. post-merge CI
16. separate production SQL promotion
17. independent production verifier/advisors/smoke
18. disposable preview cleanup

## Preview acceptance result

Status: PREVIEW SEALED - READY FOR PRE-PR PROMOTION

Disposable preview project ref:

`vgrsjjsibewtrzqlxbia`

Disposable preview branch id:

`cff30424-855a-43bf-8acc-2279e1a861a9`

Accepted K4A base:

`4aeab5c3ef37d82f216a7960f6e70207b2a86807`

K4B native migration identity:

`20260827125306_phase_7a_k4b_video_governed_lifecycle_commands.sql`

Preview acceptance proved:

1. fresh disposable preview replayed the full 54-migration K4A baseline
2. K4A permanent verifier passed on the fresh baseline
3. exact K4B migration was the only pending migration
4. exact repaired K4B migration applied through pinned native Supabase CLI
5. preview migration ledger advanced 54 -> 55 exactly
6. post-push native dry-run reported zero pending migrations
7. permanent K4B verifier passed
8. provider-backed Video lifecycle produced exactly four immutable Video versions
9. provider-backed lifecycle produced shared lifecycle history `submitted -> approved -> published`
10. provider-backed review history produced `submitted -> review_started -> approved`
11. Resource working/submitted/approved/published pointers resolved to the exact corresponding Video versions
12. command idempotency replayed snapshot, submit, approve, and publish without duplicate versions or events
13. stale authority revision was rejected without appending Video versions or shared events
14. `request_changes` produced exact shared review/lifecycle history, preserved the reason, and left approved pointer null
15. native exact-revision Video Media lifecycle produced four immutable Video versions
16. every native working/submitted/approved/published Video version carried exactly one version-bound exact-revision `video_master` Media usage
17. successful native publish rechecked current public-safe Media governance
18. disabling the selected external provider after approval caused publish rejection with no published version/event/pointer
19. appending blocked Media governance and advancing the asset governance pointer caused native publish rejection with no published version/event/pointer
20. no typed Video review/lifecycle event tables were introduced
21. rollback-only fixtures left zero residue across synthetic Auth users, role assignments, Resources, Video publications/sources/versions, Media assets/files/revisions/governance/usages, command receipts, and shared events
22. provider registry state was restored after rollback
23. K4B-specific performance advisors reported no findings
24. security advisor warnings for the four authenticated K4B `SECURITY DEFINER` RPCs match the accepted governed Audio/Playlist authenticated command pattern; anonymous K4B execution remains revoked
25. canonical replay proof and repository schema snapshot were regenerated from this exact preview and exact migration bytes

Production remained untouched during K4B preview acceptance.

The disposable preview must remain available through PR/CI acceptance and is deleted only after production promotion and independent production verification complete.
