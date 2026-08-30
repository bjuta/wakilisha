# Phase 7A Kernel Movement Closure Record

Status: KERNEL MOVEMENT CLOSED

Closure baseline: 30 August 2026

Accepted production kernel baseline before post-kernel hardening:

- repository main: `abd973378615c36c2f0dc1908fe04ef8345f4b28`
- production migration count: `64`
- production migration head:
  `20260830070752_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement`
- production pending migrations at kernel closure: `0`

Post-kernel hardening repository commit:

- `79b26e4c8db83fe178459c4c497c8fbc8714bb2b`
- migration candidate:
  `20260830082941_phase_7a_post_kernel_business_logic_and_historical_event_hardening.sql`
- classification: bounded post-kernel hardening; it does **not** reopen the kernel movement
- acceptance status at this documentation commit: disposable preview accepted; protected CI and production promotion still required

## Decision

The Phase 7A kernel detour is complete.

WAKILISHA now has one cross-domain Resource kernel for:

- Resource identity
- immutable Resource Version identity
- lifecycle position on `editorial.resources.current_*_version_id`
- shared lifecycle history in `editorial.resource_lifecycle_events`
- shared review history in `editorial.resource_review_events`
- command idempotency, correlation and optimistic-concurrency substrate

Typed Article, Playlist, Audio and Video snapshots remain domain-owned.

Typed lifecycle pointer mirrors are retired.

Typed Playlist and Audio event writers are retired.

Article typed lifecycle readers and writers are retired.

Video was born directly on the shared Resource kernel and has no typed lifecycle/review event tables.

The canonical current verifier is:

`scripts/control-plane/verify-phase-7a-kernel-closure.sql`

Earlier K1, K4C-P3, K4C-A3 and K4C-AR3 verifier scripts are historical checkpoint verifiers. They remain useful for proving their exact migration checkpoints, but they are not the current end-state authority.

## Closed kernel sequence

### K0 — Resource Version foundation

Closed.

Global `editorial.resource_versions` is the immutable cross-domain version identity envelope. Domain snapshot tables remain typed.

### K1 — Resource lifecycle-position convergence

Closed and subsequently simplified.

`editorial.resources.current_working_version_id`,
`current_submitted_version_id`,
`current_approved_version_id`, and
`current_published_version_id` are canonical.

The Playlist and Audio typed pointer mirrors introduced temporarily by K1 were explicitly non-renewable compatibility debt and are now physically absent.

### K4A — shared Resource event authority

Closed.

`editorial.resource_lifecycle_events` and
`editorial.resource_review_events` are canonical shared event authority.

### K4B — Video governed lifecycle proof

Closed.

Video proved the kernel with direct shared Resource pointers/events and no new typed event ledger.

### K4C — legacy-domain command/event convergence

Closed.

Playlist: P1 shared-event convergence -> P2 pointer-writer convergence -> P3 pointer compatibility retirement.

Audio: A1 shared-event convergence -> A2 remaining pointer convergence -> A3 pointer compatibility retirement.

Article: AR1 review/editorial event convergence -> AR2 publication/scheduling event convergence -> AR3 cross-system reader convergence and typed-event retirement.

## Separate business-logic debt closed by the post-kernel hardening candidate

Two defects were deliberately excluded from their convergence migrations so those migrations would not hide unrelated business-logic changes.

### Audio working-snapshot reuse

The working-snapshot command could reuse an existing working version when its content fingerprint matched even if that version came from an older Audio `authority_revision`.

The repair requires both equal content fingerprint and equal `source_authority_revision = publications.authority_revision`.

### Article correction republish continuity

Normal review submission changed workflow status to `pending` and rebuilt a submitted Article fingerprint. For an exact current correction version this could change the fingerprint even when editorial content had not changed, preventing later correction publication proof.

The repair copies the exact correction snapshot into submitted lifecycle shape when its draft identity and editorial fingerprint still match, preserving corrected content identity through submit -> approve -> publish.

## Historical typed event table retention decision

Retained historical tables at the 64/AR3 baseline:

- `editorial.article_lifecycle_events`
- `editorial.playlist_lifecycle_events`
- `editorial.playlist_review_events`
- `audio.publication_lifecycle_events`
- `audio.publication_review_events`

Observed production footprint:

- Article lifecycle: 35 rows / 65,536 bytes
- Playlist lifecycle: 2 rows / 81,920 bytes
- Playlist review: 5 rows / 81,920 bytes
- Audio lifecycle: 0 rows / 40,960 bytes
- Audio review: 3 rows / 81,920 bytes

Combined footprint is only a few hundred kilobytes.

### Security risk

Before hardening: **moderate**, because stale authorization remained on historical Playlist event stores. In particular, the historical Playlist review table still exposed an authenticated participant-read policy and Playlist historical tables retained service-role write capability.

After the hardening candidate: **low**, because application policies are removed, SELECT/INSERT/UPDATE/DELETE is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`, and all five tables reject mutation.

The old names themselves are not a vulnerability. Writable/readable alternate authority surfaces are.

### Bloatware risk

Physical/storage bloat: **low**.

Schema/cognitive bloat: **moderate if unmanaged**, because old names can mislead future developers and old checkpoint verifiers can be mistaken for current authority.

The closure ratchet reduces that risk by requiring:

- zero live business readers/writers
- zero application-role table privileges
- zero application policies
- mutation freeze
- complete mapping into canonical shared history
- one final end-state verifier
- explicit historical-checkpoint labels on older verifiers

Deleting the tables now would save negligible storage while removing convenient source-form provenance.

### Future deletion gate

A later physical-retirement migration may drop a retained typed historical table only after proving:

- every source row is durably represented in canonical shared history
- no FK, trigger, function, view, materialized view, RLS policy, audit tool, recovery path, or forensic workflow needs the source table
- no legal/provenance/recovery requirement benefits from keeping the source representation
- an immutable export exists if source-form preservation remains desirable
- deletion creates meaningful operational simplification rather than cosmetic tidiness

Until then, frozen evidence is preferable to destructive cleanup.

## Primitive impact

The kernel detour established authority primitives, not a universal editor.

The Primitive Compounding Contract remains binding. Video must reuse the finalized authority primitives and must still prove candidate interaction primitives through real second-domain use before promotion.

## Phase 7A resume point

Current numbered work remains **Phase 7A: Video publication authority**.

Do not reopen K0/K1/K4A/K4C.

After post-kernel hardening acceptance, resume Video at the missing governed editorial command/admin-read surface for create, metadata, source, optional shared Show Episode binding, poster, captions/subtitles, transcript, chapters, and exact admin workspace reads.

Only then compose the purpose-built Video Editor and perform evidence-driven primitive promotion.


## Post-kernel hardening preview acceptance

Disposable preview:

- branch id: `666a8ad3-f939-4f5b-81b2-892a369f875d`
- project ref: `nwtsdoqkggyktyfdjmdd`
- cost: `$0.01344/hour`
- initial provision replayed stale 63/AR2; candidate was **not** applied
- branch reset then replayed exact 64/AR3
- AR3 historical checkpoint verifier: PASS
- candidate migration apply: PASS
- final kernel verifier: `PHASE_7A_KERNEL_CLOSURE_PASS`
- Audio authority-revision fixture: `AUDIO_REVISION_SAFE_SNAPSHOT_FIXTURE_PASS`
- Article correction continuity fixture:
  `ARTICLE_CORRECTION_FINGERPRINT_CONTINUITY_FIXTURE_PASS`
- Article fixture lifecycle:
  `baseline -> correction -> submitted -> approved -> published`
- distinct Article content fingerprints across that fixture: `1`
- historical event hard-freeze fixture:
  `HISTORICAL_EVENT_HARD_FREEZE_FIXTURE_PASS`
- generated TypeScript schema parity with production: exact byte equality
- preview/prod generated type byte length: `618219`
- advisor outcome: no candidate-specific security/performance WARN/ERROR; the expected historical Playlist review change is removal of its application-readable policy

All behavior fixtures ran in transactions ending in `ROLLBACK`; no fixture residue was retained.

The preview remains disposable and must be deleted only after independent production verification.
