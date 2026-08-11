# People Migration C live acceptance record

Date: 12 August 2026

## Status

Accepted in production.

People / Contributor Identity Migration C is complete.

This closes the database authority slice for validated Person Follow creation,
viewer-only Person Follow state, public aggregate follower counts, and reviewed
one-source Person adoption.

Frontend Person surfaces remain a separate implementation slice.

## Repository baseline

Migration C was implemented from the accepted Migration B main baseline:

`971540104b9d33b8228929fd2b10bf2b1049219e`

Source branch:

`feat/people-person-follow-source-adoption`

Production apply and live acceptance completed before the Migration C source
commit and pull request were created.

## Accepted production migration

Applied migration:

`20260811213300_people_person_follow_source_adoption.sql`

Migration SHA-256:

`ee61769b22a4f3e9c365696e9bf0f3481295c4cc498726ccc5c092714f67dc27`

After apply:

- linked production migration drift: zero
- authoritative migration count: 238
- latest migration:
  `20260811213300_people_person_follow_source_adoption.sql`

The exact Migration C runtime bytes were first accepted against the real
production schema and data boundary in one rollback-only transaction.

Rollback rehearsal marker:

`PEOPLE_PERSON_MIGRATION_C_PRODUCTION_ROLLBACK_REHEARSAL_ACCEPTED`

## Accepted verifier authority

Durable verifier:

`scripts/control-plane/verify-people-person-follow-source-adoption.sql`

Verifier SHA-256:

`d94f53581c2cb0e7b09746d2dd95d48dfa28a1c45b10bf0b6a97c892efe8a5d2`

Implementation audit:

`docs/engineering/people-person-migration-c-implementation-audit.md`

Audit SHA-256:

`6a0cce62a2a5a5729fce545d5f59545ae065c8699719a32531674da53b9f432f`

The durable verifier returned:

`verification = PASS`

Accepted rollback-only runtime coverage includes:

- malformed Person Follow rejection
- non-Person Resource rejection
- private Person rejection
- self-follow rejection
- valid public Person Follow
- canonical server-derived Person slug
- viewer-only Person Follow state
- public aggregate follower count
- Person unfollow
- archived Person rejection
- merged Person survivor canonicalization
- merged Person toggle continuity
- existing Artist Follow setter compatibility
- existing Artist Follow toggle compatibility
- direct Registry Author provisioning
- direct external-contributor provisioning
- deferred account-profile provisioning
- no cross-source automatic merge by matching display name
- generic other-user Follow reader rejection
- Shared Credit preservation
- existing Follow preservation

Verifier fixtures rolled back completely.

## Accepted Person Follow authority

Person Follow representation is:

- `target_type = 'person'`
- `target_id = person_resource_id::text`

Person Follow writes resolve a merged Person to the final active survivor before
the current Follow state is read or written.

Caller-supplied Person slugs are not trusted.

The server derives the canonical Person slug/path from governed Person Resource
authority.

Follow creation rejects:

- malformed Person ids
- non-Person Resource ids
- private/internal People
- archived People
- self-follow

Unfollow remains possible for an existing Person target even if the target later
becomes non-followable.

## Accepted Person Follow reads

Authenticated narrow read:

`public.community_get_person_follow_state(uuid)`

returns only:

- `person_id`
- `followed`

Public aggregate read:

`public.get_public_person_social_summary(uuid)`

returns only:

- `person_id`
- `follower_count`

Follower identities and public Following lists are not exposed.

The existing generic reader remains self-only and byte-equivalent:

`cdbfca495b27c6b2b240c2958d68e381`

## Accepted one-source Person adoption

Production reconciled from:

- 3 People
- 3 active Person identity links
- 10 unlinked account profiles
- 12 unlinked Registry Authors
- 0 unlinked external contributors

to:

- 25 People
- 25 Person identity links
- 25 active Person identity links
- 0 unlinked account profiles
- 0 unlinked Registry Authors
- 0 unlinked external contributors

Provisioning remains one-source and idempotent.

Migration C does not auto-merge account, Registry Author, and external
contributor identities by email, name, social metadata, or display-name
similarity.

## Accepted automatic provisioning

Deferred commit-time provisioning triggers are active for:

- `public.user_profiles`
- `public.registry_authors`
- `editorial.external_contributors`

`public.community_ensure_user_account(uuid)` also ensures the account-backed
Person identity idempotently.

Existing Migration A visibility/privacy synchronization remains authoritative
and was not duplicated.

## Production content preservation

Existing Shared Credits remained byte-equivalent through apply.

Shared Credit hash:

`f496ceaa554e26879646c44567c50bb6`

Existing community Follows remained byte-equivalent through apply.

Community Follow hash:

`9436eb1ef4998f988331e44e2ebf25ed`

Production Follow rows remained:

- total: 3
- Article: 1
- Artist: 2
- Person: 0

Migration C therefore did not fabricate Person Follows during adoption and did
not rewrite existing Article or Artist Follow authority.

## Generated production schema authority

Production types were regenerated only after live database acceptance.

Generated type file:

`src/types/database.types.ts`

Accepted type SHA-256:

`0108cec9d447cedb2ddb28ef1945daf47fa91a18ca2f2ee4e77f63b189741a5a`

The generated types include:

- `community_get_person_follow_state`
- `get_public_person_social_summary`

The live-schema baseline records:

- project ref: `pgzizndxdyhqmtyywjmt`
- migration count: 238
- latest migration:
  `20260811213300_people_person_follow_source_adoption.sql`
- exact generated type SHA-256 above

`schema:verify` confirmed that working-tree generated types match live
production.

## Critical acceptance

Post-apply critical acceptance passed:

- control-plane structural verification: PASS
- frozen Institute verification: PASS
- critical tests: PASS
- application build: PASS
- final production migration drift: zero

No frontend behavior was changed in Migration C.

## Explicit deferrals

Migration C does not:

- add the public Person page
- add frontend Person Follow controls
- add Playlist curator Follow UI
- link Article contributor UI to Person pages
- converge account profile UI onto Person
- add Person body-of-work cards to frontend surfaces
- add community activity UI
- add feed ranking
- deploy an Edge Function
- require a Readdy update

## Migration C exit gates

Passed.

- Exact runtime SQL passed against the real production boundary in rollback.
- Durable verifier passed in rollback rehearsal.
- Exact runtime SQL applied successfully to production.
- Linked production migration drift is zero.
- Durable verifier passed against live production.
- Production reconciled to 25 People / 25 active identity links.
- Reviewed account / Registry Author / external-contributor adoption is complete.
- Existing Shared Credits remained byte-equivalent.
- Existing Article and Artist Follow rows remained byte-equivalent.
- Person Follow rows remain zero until users explicitly follow People.
- Browser roles still have no direct Follow table CRUD.
- Narrow Person Follow state and aggregate social-summary RPCs are live.
- Production types were regenerated from live schema.
- Live-schema baseline matches those generated type bytes.
- Critical tests passed.
- Application build passed.

Migration C database authority is accepted.

Frontend Person implementation is unblocked.
