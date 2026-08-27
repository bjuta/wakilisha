# Phase 7A K4C-P2: Playlist Pointer-Writer Convergence Implementation Audit

Status: PREVIEW SEALED - READY FOR PRE-PR PROMOTION

Opened: 27 August 2026

Accepted main at implementation open:

`1551503937e5e5d8f9865f64411d8ccc2bb1df7f`

Accepted production migration head at implementation open:

`20260827165416_phase_7a_k4c_p1_playlist_shared_event_convergence`

Accepted production migration count at implementation open:

`56`

Design authority:

`docs/engineering/phase-7a-k4c-playlist-command-convergence-design.md`

## Purpose

K4C-P2 removes the remaining governed Playlist command writes to the K1 typed lifecycle pointer mirrors in:

`editorial.playlist_resources.current_*_version_id`

The canonical lifecycle-position authority remains:

`editorial.resources.current_*_version_id`

P2 intentionally retains the typed columns and both K1 synchronization triggers for compatibility readers until K4C-P3.

## Production evidence at P2 open

Production P1 seal:

- migration count: 56
- migration head: `20260827165416`
- K4C-P1 permanent verifier: PASS
- Playlist pointer parity drift: 0
- live typed Playlist review/lifecycle event writers: 0
- typed Video review/lifecycle tables: absent

The production function audit found exactly seven governed direct typed-pointer writers:

1. `public.snapshot_playlist_working_version`
2. `public.save_resource_version_editorial_metadata`
3. `public.publish_playlist_version`
4. `public.publish_due_playlist_publications`
5. `public.unschedule_playlist_publication`
6. `public.unpublish_playlist`
7. `public.archive_playlist`

One additional direct `editorial.playlist_resources.current_*` writer exists by design:

`editorial.sync_typed_lifecycle_from_resource`

That function is the K1 Resource-to-typed compatibility sync and must remain until P3.

## Reader debt intentionally retained

Several Playlist functions still read typed lifecycle pointers, including publication, scheduling, archive/restore, public reads, preview links, Trust helpers, and compatibility services.

P2 does not migrate that reader surface merely to make this migration look more complete.

The P2 exit condition is writer retirement.

Remaining reader and compatibility-trigger retirement belongs to K4C-P3.

## Functions that do not need a P2 writer rewrite

`public.schedule_playlist_publication` and `public.restore_playlist_from_archive` consume typed pointers but do not write them directly in production.

They therefore remain unchanged in P2.

## Rewrite strategy

P2 does not copy or re-author the full bodies of the seven governed functions.

The migration reads each accepted definition with `pg_get_functiondef`, requires one exact legacy pointer-write fragment, substitutes only that fragment, and executes the otherwise unchanged definition.

This keeps business logic, signatures, command receipts, status transitions, event calls, ACLs, SECURITY DEFINER behavior, and fixed search paths intact.

The migration fails if an accepted function body has drifted from the expected fragment.

## Canonical replacements

### Working snapshot

`public.snapshot_playlist_working_version`

moves:

- typed `current_working_version_id` write

to:

- `editorial.resources.current_working_version_id`

The K1 reverse trigger continues mirroring the canonical pointer back into `editorial.playlist_resources`.

### Shared editorial metadata

`public.save_resource_version_editorial_metadata`

changes only the `playlist_version` branch.

The Playlist successor working pointer moves to `editorial.resources.current_working_version_id`.

The Audio branch continues to write `editorial.audio_publication_resources.current_working_version_id` and is explicitly outside P2.

### Direct publish

`public.publish_playlist_version`

moves the published-version pointer write to:

`editorial.resources.current_published_version_id`

Its existing Resource lifecycle-state/visibility update and publication snapshot logic remain unchanged.

### Due scheduled publication

`public.publish_due_playlist_publications`

moves the due publication pointer write to canonical Resource authority.

Schedule queue semantics, publication snapshot materialization, and status handling remain unchanged.

### Unschedule

`public.unschedule_playlist_publication`

can clear approved position when current content no longer matches the scheduled approved version.

That clear now writes canonical Resource approved position.

### Unpublish

`public.unpublish_playlist`

moves both conditional approved-pointer clearing and published-pointer clearing to canonical Resource authority.

### Archive

`public.archive_playlist`

moves published-pointer clearing to canonical Resource authority.

## Timestamp behavior

The old typed-to-Resource K1 synchronization function changes only pointer columns and does not update `editorial.resources.updated_at`.

P2 therefore also changes only pointer columns.

It intentionally does not add Resource timestamp churn as part of authority convergence.

## Migration-local invariants

Before rewrite, the migration requires:

- K1 sync functions and triggers present
- P1 shared event helpers present
- exact Playlist pointer parity
- exactly seven governed typed-pointer writers
- no unexpected direct typed-pointer writer outside the seven plus K1 compatibility sync
- no typed Playlist event writer regression

It snapshots:

- complete Playlist binding rows
- complete Playlist Resource rows
- target function owner
- SECURITY DEFINER flag
- function config/search path

RPC execution ACL is normalized explicitly instead of copied from replay history, because fresh replay exposed historical default grants that production has already closed.

After rewrite, the migration requires:

- every exact old fragment absent
- every canonical replacement present
- zero direct typed-pointer writer outside K1 Resource-to-typed compatibility sync
- K1 sync triggers still present
- pointer parity still exact
- Playlist lifecycle data unchanged
- function owner/SECURITY DEFINER/search-path unchanged
- PUBLIC/anon execution closed on all seven replaced RPCs
- authenticated/service_role execution retained on all seven replaced RPCs
- no typed Playlist event writer
- no typed Video event tables

## Permanent verifier

The read-only verifier proves:

- all seven governed functions exist
- zero direct governed typed-pointer writer remains
- each applicable function writes the expected canonical Resource pointer
- shared editorial metadata converges Playlist only and retains Audio typed compatibility
- K1 sync triggers remain for P3
- Resource-to-typed sync still contains Playlist and Audio compatibility branches
- Playlist pointer parity is exact
- P1 event authority remains converged
- Video does not gain typed event tables
- PUBLIC/anon execution remains closed
- authenticated/service_role execution remains available
- target functions remain SECURITY DEFINER


## Disposable safety sandbox proof

A disposable branch was created from the production-sealed 56/K4C-P1 baseline:

- branch id: `3b0a0988-f699-4f94-b765-dc856e9d8946`
- preview project ref: `kqopezdyjkqiuiekshcr`
- production data copied: false
- baseline migration count: 56
- baseline head: `20260827165416`
- baseline Playlist pointer parity drift: 0

The eight exact pointer-writer substitutions applied successfully without creating a migration-history entry.

Independent structural proof after rewrite:

- governed direct typed-pointer writers: 0
- K1 Resource-to-typed compatibility writer retained: true
- Playlist pointer parity drift: 0
- Playlist branch of shared Discovery metadata writes canonical Resource working position
- Audio Discovery branch remains on existing Audio compatibility authority
- migration history remains 56/K4C-P1

### Replay ACL finding

The fresh replay branch exposed historical default anonymous EXECUTE grants on six of the seven replaced public SECURITY DEFINER RPCs.

Production already has the intended perimeter on all seven:

- PUBLIC execute: false
- anon execute: false
- authenticated execute: true
- service_role execute: true

P2 therefore explicitly normalizes those seven RPCs after replacement instead of trusting replay-baseline ACL state.

After normalization:

- anonymous SECURITY DEFINER warnings on the P2 surface: 0
- P2 performance advisor findings: 0
- remaining P2 security findings are only the expected authenticated SECURITY DEFINER warnings for the existing browser/service RPC boundary

### Rollback-only working pointer proof

Governed create/add/snapshot plus Discovery metadata successor proved:

- working snapshot moves canonical Resource working position
- K1 typed working mirror follows
- Discovery save creates an immutable successor working version
- successor metadata revision advances
- canonical Resource working position moves to the successor
- K1 mirror follows
- typed Playlist event history does not grow

### Rollback-only direct publication proof

Governed submit/approve/direct-publish/unpublish proved:

- direct publish moves canonical Resource published position
- K1 published mirror follows
- unpublish clears canonical Resource published position
- K1 mirror follows
- unchanged-content unpublish preserves approved position
- shared lifecycle sequence remains `submitted, approved, published, unpublished`
- typed Playlist event history does not grow

### Rollback-only archive proof

Published Playlist archive proved:

- canonical published position clears
- K1 mirror clears
- Resource lifecycle becomes archived/private
- shared lifecycle sequence remains `submitted, approved, published, archived`
- typed Playlist lifecycle history does not grow

### Rollback-only unschedule proof

A scheduled Playlist was made stale inside the rollback transaction, then unscheduled through the governed RPC.

The command proved:

- lifecycle resolves to draft
- canonical approved position clears
- K1 approved mirror clears
- shared lifecycle sequence remains `submitted, approved, scheduled, unscheduled`
- typed Playlist lifecycle history does not grow

### Rollback-only due publication proof

The scheduler table enforces `run_after > created_at`.

The due fixture legally moved both timestamps backward while preserving:

`created_at < run_after < now()`

No constraint or trigger was disabled.

`publish_due_playlist_publications` then proved:

- the expected scheduled Playlist is published
- canonical Resource published position moves to the new published version
- K1 mirror follows
- schedule row becomes published
- shared lifecycle sequence remains `submitted, approved, scheduled, published`
- typed Playlist lifecycle history does not grow

All successful fixtures ended in rollback.

Final sandbox residue:

- fixture auth users: 0
- fixture role assignments: 0
- fixture Registry tracks: 0
- fixture Playlists: 0
- fixture command receipts: 0
- fixture scheduled-publication rows: 0
- fixture shared review events: 0
- fixture shared lifecycle events: 0

Final sandbox authority state:

- governed direct typed-pointer writers: 0
- Playlist pointer parity drift: 0
- typed Playlist event writers: 0
- migration history remains 56/K4C-P1

## Preview acceptance

A fresh disposable preview must first prove the complete accepted 56-migration K4C-P1 baseline.

After P2 apply, rollback-only governed behavior should prove the canonical pointer path for:

1. working snapshot
2. Playlist Discovery metadata successor
3. direct publish
4. unschedule with approved-pointer clear
5. unpublish
6. archive
7. due scheduled publication

For every command:

- Resource pointer is authoritative
- typed mirror remains equal through K1 reverse sync
- no typed event history is renewed
- shared lifecycle history remains canonical
- idempotency/revision behavior remains accepted

Fixtures must leave zero residue.

## Non-goals

K4C-P2 does not:

- drop Playlist typed pointer columns
- remove either K1 synchronization trigger
- migrate all Playlist pointer readers
- modify Audio pointer compatibility
- modify Article authority
- change Video lifecycle authority
- change Playlist UI
- change public Playlist RPC signatures
- deploy Edge Functions
- deploy frontend
- update Readdy

## Deployment boundary

Current candidate phase:

- SQL migration needed: Yes, canonical K4C-P2 migration ready for PR
- canonical migration filename minted: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: No
- production mutation: No
- PR ready: Yes after exact-scope commit and push

## Exit condition

K4C-P2 closes when:

- no governed Playlist command writes `editorial.playlist_resources.current_*_version_id` directly
- K1 typed mirrors remain parity-safe for compatibility readers
- preview/replay/production proof is sealed

K4C-P3 then retires the remaining Playlist pointer readers, synchronization dependency, and typed pointer columns without touching Audio compatibility.

## Canonical repaired-baseline preview proof

K4C-P2 was resealed against accepted main
`dfd47fe093ec84205c817bcdcaf366237556ce13`, after the replay-baseline
default-privilege parity repair was merged and post-merge Critical Control
Plane #629 passed.

Canonical preview authority:

- project ref: `qhhrgblrmoxddlruwdxd`
- branch id: `6936b88f-bfda-41cb-be40-4867c3442ced`
- pre-apply migration state: `56 / 20260827165416` (K4C-P1)
- post-apply migration state: `57 / 20260827182809` (K4C-P2)
- pending migrations after native apply: `0`
- migration SHA-256:
  `069e5807d3b58fb2bb1ce583b34ce28c4ffde792fb5160284efc305d5aad0b36`

Remote runtime proof after canonical apply:

- all seven governed Playlist lifecycle RPC writers moved direct pointer writes
  from `editorial.playlist_resources` to canonical `editorial.resources`;
- the only remaining typed Playlist pointer writer is
  `editorial.sync_typed_lifecycle_from_resource()`, the K1 compatibility writer
  intentionally retained for K4C-P3;
- Playlist pointer parity drift: `0`;
- typed Playlist event writers: `0`;
- typed Video review/lifecycle event tables remain absent;
- both K1 compatibility triggers remain present;
- K1 helper definitions remain byte-identical to production:
  - typed-to-shared MD5: `1a9a366b7a26d023aa589767a2024651`
  - shared-to-typed MD5: `4f52dd85356906f9f6fb2e9dcd24551a`
- P1 shared event helper definitions remain byte-identical to production:
  - lifecycle append MD5: `d84d503da70733c010a93025bca7cda7`
  - review append MD5: `54b3f889a5b91bf399bb64b52b830134`;
- the seven replaced RPCs retain the exact accepted semantic ACL perimeter:
  21 ACL rows, semantic ACL MD5
  `c94358a55b4d79fb8ffbb87e1ef4b402`;
- owner, `SECURITY DEFINER`, and search paths match production for all seven
  target RPCs;
- the Audio context inside
  `save_resource_version_editorial_metadata(...)` is byte-identical to
  production, MD5 `976d4b50e55ab1e6899c3694fe1efd8a`;
- new Supabase Advisor security `WARN`/`ERROR` findings: `0`;
- new Supabase Advisor performance `WARN`/`ERROR` findings: `0`;
- the additional preview performance findings are INFO-only unused-index
  notices caused by the zero-data preview;
- no Playlist binding, Resource Version, shared event, or typed Playlist event
  fixture residue exists after the apply;
- the single `editorial.resources` row on the preview is the pre-existing
  `organization` bootstrap row with all four lifecycle pointers null;
- fail-closed remote verifier marker:
  `K4C_P2_REMOTE_FAIL_CLOSED_VERIFIER_PASS`.

Production remained `56 / 20260827165416` throughout this proof. K4C-P2 was
applied only to the canonical preview.
