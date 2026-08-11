# People Migration B live acceptance record

Date: 12 August 2026

## Status

Accepted in production.

People / Contributor Identity Migration B is complete.

This closes the Migration B slice for governed Person reconciliation, merge
continuity, Shared Credit to Person resolution, and current-public Article and
Playlist body of work.

Person Follow creation and follower counts remain deferred to Migration C.

## Repository baseline

Migration B was implemented from the accepted Migration A main baseline:

`b43b5f3da84f678acb7e4f3da12412763260557a`

Source branch:

`feat/people-person-reconciliation-body-of-work`

The production apply and live acceptance were completed before the Migration B
source commit and pull request were created.

## Accepted production migration

Applied migration:

`20260811190000_people_person_reconciliation_body_of_work.sql`

Migration SHA-256:

`5eed538abb579d18124d37e62cc38db90b6b6f0c800f532b1cdcebcd8285f2bd`

After apply:

- linked production migration drift: zero
- authoritative migration count: 237
- latest migration:
  `20260811190000_people_person_reconciliation_body_of_work.sql`

The applied migration was the exact runtime SQL previously accepted against a
fresh schema-only clone of current production.

## Accepted verifier authority

Durable verifier:

`scripts/control-plane/verify-people-person-reconciliation-body-of-work.sql`

Verifier SHA-256:

`dedf1b76ddfd3e9b2ac7a9ca3ed542e392aecdd140d17a74c68b65939454165a`

Implementation audit:

`docs/engineering/people-person-migration-b-implementation-audit.md`

Audit SHA-256:

`dde4778388134d1cf2a52f06692aa60feb96609cd750a965406024a709bfd0f7`

The durable verifier returned:

`verification = PASS`

Accepted rollback-only fixture summary:

- People capabilities: 3
- Person command types: 3
- target Person current-public work rows: 2
- Article current-public work rows: 1
- Playlist current-public work rows: 1
- Person Follow merge-transfer rows: 2

The verifier fixtures rolled back completely.

## Accepted Person identity authority

Migration B accepts:

- immutable Shared Credit to Person resolution at read time
- account-backed Credit resolution
- Registry Author-backed Credit resolution
- external-contributor-backed Credit resolution
- governed Person identity link
- governed Person identity unlink
- governed Person merge
- idempotent successful merge replay
- stale-revision rejection
- merge-cycle rejection
- merge continuity without rewriting historical Shared Credits

Historical Credits remain immutable.

Person reconciliation changes identity resolution, not historical Credit
snapshots.

## Accepted current-public body of work

Public Person work supports:

- Article
- Playlist

A work appears only when the matching public-safe Shared Credit is attached to
the exact current published version.

Historical version Credit attachments are not enumerated as separate public
work.

One work row is returned per Resource.

Multiple public-safe roles for the Person on the exact current public version
are aggregated on that work row.

The public work representation does not expose internal Shared Credit ids.

## Accepted public Person role authority

`public.get_public_person(...)` derives `public_roles` from distinct Shared
Credit roles represented in the Person's current-public body of work.

Account RBAC roles are not used as public creative-role labels.

The accepted verifier explicitly proved the synthetic Article `author` role and
Playlist `contributor` role through current-public Shared Credit authority.

## Live production body-of-work proof

Hafare Segelan resolves through the Registry Author identity path to a stable
Person.

The accepted live production proof established exactly one current-public
Playlist work row for:

`/playlists/top-50-kenyan-songs-of-2025`

That work resolves the accepted `curator` Shared Credit role.

An existing external-contributor-backed Person also resolved at least one
current-public Article work row.

Both live checks returned verification PASS.

## Person Follow merge continuity

Migration B adds append-only Person Follow merge-transfer history and preserves
existing Person-target Follows through governed Person merge.

The accepted proof covers:

- moved Follow state
- deduplicated Follow state
- transfer history
- merged source Person resolution to the survivor

Migration B does not enable new public Person Follow creation.

Migration B does not expose follower counts.

Migration B does not add Migration C Person Follow read functions.

## Production content preservation

The production apply was checked before and after against exact content hashes.

Accepted counts remained:

- People: 3
- active identity-link rows in the production proof set: 3
- Shared Credits: 3
- existing community Follows: 3

Accepted pre/post hashes remained byte-equivalent:

People:

`dca337dc6d6324c2d896e80542c74775`

Person identity links:

`fc2408c08345f24a63fdb4fad4fa88bc`

Shared Credits:

`f496ceaa554e26879646c44567c50bb6`

Community Follows:

`9436eb1ef4998f988331e44e2ebf25ed`

Existing private Follow reader definition:

`cdbfca495b27c6b2b240c2958d68e381`

Existing generic Follow setter definition:

`b67beb7b5aa874911bfe83469c2fca86`

Migration B therefore did not rewrite existing Person, identity-link, Credit,
or Follow content during apply, and it did not weaken the existing Follow
reader or generic Follow setter.

## Generated production schema authority

Production types were regenerated after live acceptance.

Generated type file:

`src/types/database.types.ts`

Accepted type SHA-256:

`af14cd2422581c868d9402bdbc4875c22e33f5248facb1a926bd80f716351ead`

The generated types include the Migration B surface for:

- `person_follow_merge_transfers`
- `resolve_credit_person`
- `get_public_person`
- `list_public_person_work`
- `merge_people`

The live-schema baseline records:

- project ref: `pgzizndxdyhqmtyywjmt`
- migration count: 237
- latest migration:
  `20260811190000_people_person_reconciliation_body_of_work.sql`
- exact generated type SHA-256 above

`schema:verify` confirmed that the generated working-tree types match live
production.

## Critical acceptance

Post-apply critical acceptance passed:

- control-plane structural verification: PASS
- frozen Institute verification: PASS
- critical test files: 11 passed
- critical tests: 109 passed
- application build: PASS
- final production migration drift: zero

The application build was performed against the regenerated production types.

No frontend source code changed in Migration B.

## Explicit deferrals

Migration B does not:

- enable Person Follow creation
- expose Person follower counts
- add Migration C Person Follow read functions
- create a Person split command
- bulk backfill People
- bulk backfill Article or Playlist Resource aliases
- rewrite historical Shared Credits
- add Guide body-of-work authority
- change frontend routes
- deploy an Edge Function
- require a Readdy update

## Migration B exit gates

Passed.

- Exact runtime SQL rehearsed against a fresh schema-only production clone.
- Durable verifier passed in the clone.
- Exact runtime SQL applied successfully to production.
- Linked migration history is current.
- Durable verifier passed against production.
- Hafare Segelan current-public Top 50 Playlist work passed.
- Existing external-contributor Article work passed.
- Existing Person, identity-link, Credit, Follow, and Follow-function authority
  remained byte-equivalent through apply.
- Production types were regenerated from live schema.
- Live-schema baseline matches those exact generated type bytes.
- Critical tests passed.
- Application build passed.
- Production migration drift remains zero.

Migration B is accepted.

Migration C is unblocked, but remains a separate authority slice.
