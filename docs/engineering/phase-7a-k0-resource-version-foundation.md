# Phase 7A K0: Resource Version Foundation

Status: IMPLEMENTATION CANDIDATE — PREVIEW NOT YET PROVEN

Base main: `76c17b038207f4396ef3ffe6c6062602979cc5a9`

## Decision

Phase 7A Video implementation is paused at the domain boundary long enough to extract a platform authority that is already proven across Article, Playlist, and Audio.

WAKILISHA now treats **Resource identity** and **Resource Version identity** as platform-foundation authority primitives.

This is not a universal content model. Typed domain snapshots remain authoritative in their existing domain tables.

The Resource Version primitive answers only:

> Which immutable version of which WAKILISHA Resource is this?

## Why K0 exists

`editorial.resources` currently carries Article-only working/submitted/approved/published version foreign keys, while Playlist and Audio carry the same lifecycle position in typed Resource binding tables.

Shared Trust and Discovery tables already address multiple version types through `resource_id`, `target_version_type`, and `target_version_id`.

Adding Video-specific lifecycle pointers before reconciling this would create another dependency on a known split authority.

K0 therefore introduces a global Resource Version identity envelope without changing current domain lifecycle behavior.

## K0 boundary

K0 must:

1. introduce `editorial.resource_version_types` as controlled version-type vocabulary;
2. introduce `editorial.resource_versions` as immutable global version identity;
3. use the existing typed domain version UUID as the Resource Version UUID;
4. backfill Article, Playlist, and Audio immutable versions without changing any domain UUID;
5. guarantee each Resource Version belongs to exactly one Resource and one controlled version type;
6. preserve typed domain tables as the content authority;
7. provide an idempotent internal registration helper for future typed domain versions;
8. add exact integrity verification for existing Article, Playlist, and Audio versions;
9. leave `editorial.resources.current_*_version_id` unchanged in K0;
10. leave Playlist and Audio typed lifecycle pointers unchanged in K0;
11. make no frontend, Edge Function, public-route, or production-runtime changes.

K0 must not:

- create Video authority yet;
- rewrite Article, Playlist, or Audio version content;
- migrate lifecycle pointers yet;
- create a generic JSON content store;
- weaken any typed foreign-key authority;
- delete or rename existing version tables;
- create another review-event implementation.

## K1 boundary after K0 is proven

K1 will converge lifecycle position onto Resource Version identity by changing the shared Resource lifecycle pointer authority from Article-specific version references to Resource Version references, backfilling Playlist and Audio position, and retaining compatibility verification until typed duplicate pointers can be retired safely.

K1 must not begin until K0 is sealed in a production-equivalent disposable preview.

## Primitive impact

### Promoted to foundation authority

- Resource identity
- Resource Version identity

### Existing typed authority retained

- Article versions
- Playlist versions
- Audio publication versions

### Deferred until K1

- shared working/submitted/approved/published Resource position
- convergence of duplicate typed lifecycle pointers
- common Resource review/lifecycle event authority

## Deployment classification

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- frontend deploy needed: No
- Readdy Finish update needed: No
- production mutation during candidate work: No
