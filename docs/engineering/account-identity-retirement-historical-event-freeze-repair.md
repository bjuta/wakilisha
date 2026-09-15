# Account Identity Retirement — Historical Event Freeze Compatibility Repair

Date: 15 September 2026

## Status

Candidate repair for a Production account-retirement regression discovered while
cleaning the successful Artist-enrichment runtime-smoke principal.

No Artist-enrichment canonical data is changed by this repair.

## Failure evidence

The canonical `public.retire_account_identity(...)` command reached Auth deletion
and failed with SQLSTATE `55000`:

`Historical typed event tables are frozen evidence. Use shared Resource event authority.`

The target smoke account had zero rows in all five retained typed historical event
tables, proving the failure was not target-owned historical content.

## Root cause

Phase 7A intentionally retained five typed event tables as frozen historical evidence:

- `editorial.article_lifecycle_events`
- `editorial.playlist_lifecycle_events`
- `editorial.playlist_review_events`
- `audio.publication_lifecycle_events`
- `audio.publication_review_events`

Each table retained an `actor_id -> auth.users(id) ON DELETE SET NULL` foreign key,
matching the live shared Resource event model.

The freeze was implemented as a statement-level `BEFORE INSERT OR UPDATE OR DELETE`
trigger. PostgreSQL issues FK-maintenance `UPDATE` statements for `ON DELETE SET NULL`
during Auth-user deletion. A statement-level trigger runs even when that statement
matches zero rows, so every governed Auth-user deletion became impossible.

This regressed the previously accepted account-retirement design, whose audit
explicitly relies on existing cascade / `SET NULL` behavior.

## Repair

Migration
`20260915213000_historical_event_actor_retirement_compatibility.sql`:

1. retains all five historical tables;
2. retains all five actor `ON DELETE SET NULL` foreign keys;
3. retains closed ACLs and the same frozen-evidence error;
4. changes the five freeze triggers to `FOR EACH ROW`;
5. allows only a nested `actor_id: UUID -> NULL` transition where every other
   historical field is unchanged;
6. rejects inserts, deletes, direct updates, and every other update.

The nested-trigger requirement ensures ordinary direct updates cannot use the
exception. The exception exists only for referential maintenance inside Auth-user
deletion.

## Permanent ratchets

- `scripts/control-plane/verify-historical-event-account-retirement-compatibility.sql`
  checks all five actor FKs, all five row-scoped freeze triggers, the narrow guard,
  and closed helper EXECUTE privileges.
- `test/people/account-identity-retirement-historical-event-compatibility.test.ts`
  statically binds the migration and verifier contract.
- The focused test is added to `test:critical`.

## Acceptance boundary

Before Production promotion:

- disposable Preview applies exactly migration 136;
- permanent SQL verifier passes;
- a Preview-only administrator retires a Preview-only target through the real
  `retire_account_identity(...)` RPC;
- target Auth/profile state disappears;
- target Person is archived at revision 3;
- retired account tombstone and historical identity-link snapshot remain.

Only after those gates pass may the migration go through protected CI and the
canonical Production migration runner.

Issue #945 remains open.
