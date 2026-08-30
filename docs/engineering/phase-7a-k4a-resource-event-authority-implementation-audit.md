# Phase 7A K4A Shared Resource Event Authority - Implementation Audit

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


Status: LOCAL CANDIDATE - PREVIEW NOT YET RUN

Implementation date: 26 August 2026

Accepted main baseline:

`9f4669b7e067cb716d5485894b3197caf5f9fe75`

Production migration head before K4A:

`20260826184252_phase_7a_k2_video_authority_foundation`

Production migration count before K4A:

`53`

Governing design:

`docs/engineering/phase-7a-k3-resource-review-lifecycle-event-convergence-design.md`

## Purpose

K4A implements the shared Resource event authority locked by K3.

It promotes two concepts that are already repeated across Article, Playlist, and Audio:

- append-only Resource lifecycle transition history
- append-only Resource review decision history

K4A does not add Video submit/review/publish commands yet.

The purpose of this slice is to make the shared authority exist, backfill existing history without rewriting it, and make Video consume that authority from its first governed lifecycle write in K4B.

## Candidate authority

The candidate introduces:

- `editorial.resource_lifecycle_actions`
- `editorial.resource_review_actions`
- `editorial.resource_lifecycle_events`
- `editorial.resource_review_events`

The shared ledgers reference:

- `editorial.resources`
- `editorial.resource_versions`
- `platform_private.command_receipts`
- `auth.users`

No typed Video event table is introduced.

## Existing typed compatibility history retained

K4A leaves these relations intact:

- `editorial.article_lifecycle_events`
- `editorial.playlist_lifecycle_events`
- `editorial.playlist_review_events`
- `audio.publication_lifecycle_events`
- `audio.publication_review_events`

The migration fingerprints every source relation before shared-authority work and proves the fingerprints are unchanged before commit.

## Production evidence used by the candidate

At K4A design time production contained:

- 35 Article lifecycle events
- 2 Playlist lifecycle events
- 5 Playlist review events
- 0 Audio publication lifecycle events
- 3 Audio publication review events

The migration does not hard-code those counts.

Backfill cardinality is derived from the source tables so replay remains correct if the accepted baseline changes before the candidate is applied.

## Historical identity strategy

The candidate preserves each legacy event UUID as the canonical shared event UUID.

Before doing so it proves there is no UUID collision between source relations feeding the same shared ledger.

This gives deterministic replay without introducing a migration-time random identity for historical rows.

Each shared historical row also records:

- `legacy_source_authority`
- `legacy_source_event_id`

A unique source-identity index prevents one legacy row from being represented twice.

## Canonical event numbering

Existing domains do not share one numbering contract.

Article lifecycle history has no typed `event_number`.

Playlist and Audio event history does.

K4A therefore assigns a canonical per-Resource sequence in the shared ledger while preserving the original typed event rows untouched.

For typed sources with an event number, source order participates in canonical ordering.

For Article lifecycle history, stable ordering is based on timestamp and source UUID.

The canonical number is shared-ledger history position, not a rewrite of the typed source number.

## Resource Version integrity

All shared version references use global Resource Version identity.

Lifecycle history uses:

`(resource_id, version_id) -> editorial.resource_versions(resource_id, id)`

Review history uses:

`(resource_id, target_version_id) -> editorial.resource_versions(resource_id, id)`

and:

`(resource_id, result_version_id) -> editorial.resource_versions(resource_id, id)`

The migration preflight fails if any existing typed event version cannot resolve through K0/K1 shared Resource Version authority.

## Command receipt integrity

Legacy Article lifecycle history predates command receipts.

K4A preserves that absence rather than fabricating receipts.

Existing Playlist and Audio receipt-backed events were audited before candidate construction and had zero Resource/actor mismatches.

For all new canonical shared event writes:

- `command_receipt_id` is required
- `correlation_id` is required
- receipt Resource identity must equal event Resource identity
- receipt actor identity must equal event actor identity

Historical rows are permitted to retain missing command/correlation identity only when they carry explicit legacy source identity.

## Action vocabulary

K4A creates controlled internal action vocabulary.

Lifecycle actions initially include:

- `submitted`
- `changes_requested`
- `approved`
- `scheduled`
- `unscheduled`
- `published`
- `unpublished`
- `archived`
- `restored`

Review actions initially include:

- `submitted`
- `review_started`
- `changes_requested`
- `approved`
- `rejected`

The insert-integrity guard requires the selected action to remain enabled.

Historical status strings are preserved exactly and are not normalized into a new cross-domain status vocabulary.

## Review decision shape

An `approved` review event requires a result Resource Version.

Other initial review actions do not carry a result version.

`changes_requested` and `rejected` require a non-empty reason.

These constraints preserve existing Playlist/Audio review meaning while giving Video a shared contract for K4B.

## Append-only boundary

Both canonical event ledgers are protected against durable row mutation.

The shared trigger helper raises on update/delete.

Historical correction means append a later event, not rewrite an old event.

## Security boundary

All four new tables have RLS enabled as defense in depth.

No direct table privilege is granted to:

- `PUBLIC`
- `anon`
- `authenticated`
- `service_role`

The two internal trigger helpers are `SECURITY DEFINER` with fixed search paths.

Direct helper execution is revoked from application roles.

K4A creates no public RPC.

## Explicit non-goals

K4A does not:

- create Video submit/review/publish RPCs
- create Video review threads/comments
- create a Video lifecycle status column
- create `video.review_events`
- create `video.lifecycle_events`
- rewrite Article/Playlist/Audio commands
- remove legacy event tables
- create a public history API
- change frontend behavior
- deploy Edge Functions
- activate public Video routes

## Required local gates

Before preview:

1. exact branch from accepted main
2. native `supabase migration new` identity
3. exact migration/verifier/test/audit scope
4. focused K4A static contract
5. K1/K2 regression contracts
6. Primitive Compounding
7. `git diff --check`
8. `npm run build:app`

## Required preview gates

K4A is not accepted until a disposable preview proves:

1. full 53-migration K2 baseline replay succeeds
2. exact K4A candidate is the only pending migration
3. exact candidate applies transactionally
4. permanent verifier passes
5. historical source fingerprints/counts remain intact
6. valid shared lifecycle fixture succeeds
7. valid shared review fixture succeeds
8. cross-Resource version reference fails
9. command receipt Resource/actor mismatch fails
10. new event without receipt/correlation fails
11. event update/delete fails
12. duplicate canonical event number fails
13. duplicate legacy source identity fails
14. application-role direct write fails
15. rollback fixture cleanup leaves zero residue
16. post-push dry-run reports zero pending
17. replay proof and schema snapshot are regenerated from the exact preview

## Production boundary

No production mutation is authorized by this local candidate.

Production remains at K2 until:

- preview acceptance is complete
- exact candidate bytes are sealed
- replay proof is committed
- protected CI is green
- PR is merged
- production promotion runs separately from exact merged main
- permanent K4A verifier passes independently in production

## Deployment classification

SQL migration needed: Yes, after preview/PR acceptance.

Supabase Edge Function deploy needed: No.

Readdy Finish update needed: No.

Frontend deploy needed: No.

PR needed now: Not yet.

## Next test

Create the native K4A migration file on the accepted-main branch, materialize this candidate, and run the focused local contract before any disposable preview is created.

## Preview acceptance result

Status: PREVIEW SEALED - READY FOR PRE-PR PROMOTION

Disposable preview project ref:

`rrkcxarqscjfwtbrsjks`

Disposable preview branch id:

`aa0f1da9-ce6e-4e48-b11f-b5c3d3cc2ebf`

Accepted K3 base:

`9f4669b7e067cb716d5485894b3197caf5f9fe75`

Preview acceptance proved:

1. the fresh disposable preview replayed all 53 K2 baseline migrations
2. K1 permanent verification passed on the fresh baseline
3. K2 permanent verification passed on the fresh baseline
4. the exact K4A migration was the only pending migration
5. the exact K4A migration applied transactionally
6. the preview migration ledger advanced from 53 to 54 exactly
7. the K4A permanent verifier passed against the applied preview
8. rollback-only shared lifecycle and review fixtures passed
9. cross-Resource version references were rejected
10. command receipt Resource mismatch was rejected
11. new canonical events without command trace were rejected
12. canonical event update and delete were rejected
13. duplicate canonical event numbers were rejected
14. duplicate legacy source identity was rejected
15. direct application-role table write authority remained closed
16. rollback fixture cleanup left zero residue
17. post-push native dry-run reported zero pending migrations
18. the canonical replay proof and repository schema snapshot were regenerated from this exact preview
19. the migration replay contract, K4A/K1/K2 focused contracts, Primitive Compounding, critical control-plane suite, and application build passed after the preview seal

Production remained untouched during preview acceptance.

The disposable preview must remain available through PR/CI acceptance and is deleted only after production promotion and independent production verification complete.


## Production promotion incident and in-place repair

The first production promotion attempt on 27 August 2026 failed transactionally before K4A was recorded.

Production error:

`cannot ALTER TABLE "resource_lifecycle_events" because it has pending trigger events (SQLSTATE 55006)`

Cause:

- production contains durable Article, Playlist, and Audio lifecycle/review history
- the K4A historical backfill inserted canonical rows into the new shared event ledgers
- the shared event sequence constraints are `DEFERRABLE INITIALLY DEFERRED` constraint triggers
- those inserts therefore left pending deferred trigger events
- the migration later attempted `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- PostgreSQL rejects that table-level DDL while deferred trigger events remain pending

Why the original preview did not detect this:

- disposable Supabase branches do not carry production data
- the original preview therefore had no legacy lifecycle/review rows to backfill
- no deferred sequence trigger events were queued before the RLS DDL

Production rollback verification after the failed promotion proved:

- migration history remained at 53 migrations with K2 as head
- `20260827095753` was not recorded
- `editorial.resource_lifecycle_actions` did not exist
- `editorial.resource_review_actions` did not exist
- `editorial.resource_lifecycle_events` did not exist
- `editorial.resource_review_events` did not exist

The failed attempt therefore left no partial K4A production authority.

Repair:

The existing unapplied K4A migration is repaired in place under the same native migration identity. Immediately after both historical backfills and before RLS table DDL, the migration now executes:

```sql
set constraints all immediate;
set constraints all deferred;
```

The first statement forces deferred integrity checks created by the backfill to execute and clears pending trigger events. The second restores deferred semantics for the rest of the transaction.

A focused regression test requires this ordering:

1. lifecycle backfill
2. review backfill
3. deferred-trigger flush
4. deferred-mode re-arm
5. RLS table DDL

The repaired candidate must be replay-proven again from K2 on a disposable preview containing at least one committed legacy lifecycle row before production is retried.

## Repaired production-shaped native replay proof

After the production-only deferred-trigger failure, the repaired K4A migration was replayed again on a fresh disposable preview created directly from the still-K2 production main.

Repair preview:

`dgyyisflgklfajzufjeg`

Repair preview branch id:

`d278391e-1e14-49c7-b0e9-e32296f8916f`

Before K4A, the preview was deliberately seeded with one committed legacy Article lifecycle event through the canonical Article Resource provisioning path.

This creates the exact condition that the original empty preview lacked: K4A historical backfill inserts at least one shared lifecycle event and therefore queues the deferrable sequence-integrity constraint trigger before the migration reaches the RLS table DDL.

The repaired migration then passed through the native Supabase CLI and proved:

1. exact K2 baseline at 53 migrations
2. exactly one pending K4A migration
3. one committed legacy Article lifecycle source row before K4A
4. repaired K4A native push succeeds
5. migration ledger advances 53 -> 54 exactly
6. post-push native dry-run reports zero pending
7. permanent K4A verifier passes
8. the legacy Article event is preserved
9. exactly one canonical shared lifecycle row is backfilled for that legacy source identity
10. RLS is enabled on both shared event ledgers
11. anon, authenticated, and service_role retain no direct INSERT privilege
12. canonical replay proof and schema snapshot are regenerated from the repaired migration bytes and this production-shaped preview

This production-shaped replay supersedes the original empty-preview replay for production promotion confidence.
