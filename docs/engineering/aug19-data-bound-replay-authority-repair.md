# August 19 Data-Bound Replay Authority Repair

Date: 20 August 2026

## Status

Stage A local replay-control-plane repair candidate.

## Incident

A disposable Supabase preview for Phase 6A failed before the Phase 6A migration
was applied.

The fresh replay stopped in:

`20260819124500_article_author_person_convergence.sql`

with:

`STOP: canonical Beautah Person moved from reviewed revision 1`

The failed preview was deleted without applying Phase 6A.

## Root cause

Two August 19 migrations mix two different kinds of authority:

1. enduring schema/function authority that every fresh database must replay;
2. one-time production-data reconciliation that is meaningful only against the
   reviewed production corpus.

The affected migrations are:

- `20260819124500_article_author_person_convergence.sql`
- `20260819203000_organization_identity_foundation.sql`

The Article migration locks named production Person UUIDs, production Follow
state, a 134-Article manifest, a 109-Article missing-credit manifest, and the
73-Article institutional boundary.

The Organization migration creates enduring Organization authority but also
locks and backfills the exact 73 current public `Wakilisha Staff` Articles.

A fresh data-empty Supabase preview cannot satisfy those production-only
assertions.

## Permanent repair shape

The exact production-applied migrations are preserved byte-identically under:

`docs/engineering/replay-baseline/retired-active-migrations/`

Replay-safe forward replacements are added for the enduring authority.

### Article Author Person replay authority

`20260820102000_article_author_person_replay_authority.sql`

Retains the enduring:

`public.resolve_public_registry_author_person(text)`

contract and its schema dependencies.

It does not replay the production Article reconciliation.

### Organization identity replay authority

`20260820102100_organization_identity_replay_authority.sql`

Retains:

- Organization Resource kind
- Organization tables
- Organization type vocabulary
- Registry Label pairing authority
- Resource binding integration
- Organization-backed Credit authority
- canonical WAKILISHA Organization seed
- Organization public readers

It removes only the locked 73-Article production backfill block.

The canonical WAKILISHA Organization seed uses the accepted Resource UUID:

`97d2dd8c-ff4d-48a0-95a7-5167f5e378d9`

Fresh controlled environments therefore reconstruct the same institutional
Resource identity rather than generating a different UUID.

## Two-stage cutover

The repair is split deliberately so protected CI never has to approve a branch
whose active migration ledger disagrees with production.

### Stage A: forward authority

This first change:

1. keeps both original August 19 migrations byte-identical in active replay;
2. preserves byte-identical historical copies in `retired-active-migrations/`;
3. adds both replay-safe forward replacement migrations;
4. records and tests the intended retirement.

Production can therefore remain on its current migration ledger while CI sees
only two normal forward-appended pending migrations.

After Stage A merges, apply the two forward replacements to production normally.

### Stage B: history retirement

A follow-up change then deletes only these two files from active replay:

- `20260819124500_article_author_person_convergence.sql`
- `20260819203000_organization_identity_foundation.sql`

With that follow-up branch prepared, use the native Supabase migration-history
repair command to mark those exact production migration versions `reverted`.

That history operation does not execute reverse SQL. It does not remove the
already-completed Article Author or Organization production data.

Once production migration history matches the Stage B branch:

1. protected CI must pass;
2. merge Stage B;
3. create a fresh disposable preview;
4. prove the complete replay reaches the new head.

## Phase 6 relationship

This repair was discovered by the Phase 6A preview gate.

It is not Audio implementation.

The sealed four-file Phase 6A M1 local candidate remains unchanged in its
dedicated stash.

Its original local migration timestamp is earlier than the replay replacements.
After Stage B closes, restore the same M1 SQL bytes under a new forward migration
timestamp later than `20260820102100`. No Audio SQL logic needs to change.
