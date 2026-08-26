# Phase 7A K1: Resource Lifecycle Position Convergence

Status: IMPLEMENTATION CANDIDATE — K0 ACCEPTED

Depends on: Phase 7A K0 Resource Version Foundation

## Problem

K0 gives every immutable Article, Playlist, and Audio version one global Resource Version identity without changing lifecycle position.

Lifecycle position is still split:

- Article working/submitted/approved/published pointers live on `editorial.resources`;
- Playlist pointers live on `editorial.playlist_resources`;
- Audio publication pointers live on `editorial.audio_publication_resources`.

That split was a valid compatibility response while `editorial.resources.current_*_version_id` physically referenced Article versions. It is not the ten-year Resource primitive.

## K1 decision

`editorial.resources` becomes the canonical cross-domain location for current lifecycle position:

- `current_working_version_id`
- `current_submitted_version_id`
- `current_approved_version_id`
- `current_published_version_id`

Those pointers validate against `editorial.resource_versions`, not any typed domain version table.

Typed domain snapshots remain typed.

Playlist and Audio binding pointer columns remain temporarily as compatibility mirrors because existing governed commands still write them. K1 makes that duplication explicit, synchronized, and non-renewable rather than pretending it is still independent authority.

## Historical-preservation rule

K1 changes pointer **authority**, not historical lifecycle meaning.

In production, legacy Article working/published pointers legitimately reference version kinds such as `baseline`, `manual_save`, and `published`. K1 must not relabel, recreate, or normalize those versions.

The generic pointer integrity contract therefore requires:

- every non-null pointer belongs to the same Resource;
- submitted pointers target a `submitted` Resource Version, preserving the existing Article constraint;
- no new version-kind reinterpretation for working, approved, or published pointers.

## Integrity execution boundary

`editorial.resource_versions` is internal immutable authority and is not directly readable by browser or service roles. The deferred Resource pointer-integrity trigger therefore runs through a non-callable `SECURITY DEFINER` helper with a fixed `pg_catalog, editorial` search path. The helper performs validation only, never mutation, and direct `EXECUTE` remains revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`.

## K1 migration boundary

K1 should:

1. require a complete, exact K0 Resource Version backfill;
2. replace Article-specific Resource pointer foreign keys with Resource-Version foreign keys;
3. replace Article-specific pointer-integrity trigger logic with Resource-Version pointer integrity;
4. backfill Playlist and Audio current lifecycle position into `editorial.resources`;
5. install compatibility synchronization from Playlist/Audio typed binding pointers to Resource pointers;
6. install reverse compatibility synchronization from Resource pointers to Playlist/Audio typed binding pointers;
7. prove the two copies cannot drift in a committed transaction;
8. preserve all existing version UUIDs and pointer values;
9. preserve current Article, Playlist, and Audio commands without requiring an immediate command rewrite;
10. add a permanent read-only verifier and focused control-plane contract.

K1 should not:

- remove Playlist or Audio pointer columns yet;
- rewrite all existing domain commands merely to claim convergence;
- alter typed version snapshot payloads;
- normalize historical Article `version_kind` values;
- create Video authority;
- create generic review events yet;
- change frontend, Edge Functions, public routes, or public read models.

## Compatibility debt created deliberately by K1

The following columns become compatibility mirrors, not independent lifecycle authority:

- `editorial.playlist_resources.current_*_version_id`
- `editorial.audio_publication_resources.current_*_version_id`

Their retirement is ratcheted:

- new domains must not create another typed lifecycle-pointer set;
- Video must write/read Resource lifecycle position directly;
- when Playlist or Audio command authority is next materially rewritten, it should migrate to Resource pointers and remove the corresponding compatibility writer dependency;
- once no legacy writer depends on a typed pointer set, those duplicate columns can be removed in a dedicated compatibility-retirement migration.

## Why synchronization is acceptable here

K1 does not call the mirrored columns co-equal truth.

`editorial.resources` is the canonical primitive. The typed columns survive only because existing production command functions already write them. Exact bidirectional synchronization allows safe migration without a high-blast-radius rewrite of every Playlist and Audio command in the same kernel migration.

The permanent verifier must treat any divergence as a platform-authority failure.

## Primitive impact

### Foundation authority

- Resource identity
- Resource Version identity
- Resource lifecycle position

### Compatibility authority retained temporarily

- Playlist typed lifecycle pointer columns
- Audio typed lifecycle pointer columns

### Rule for Video

Video must not create `editorial.video_resources.current_*_version_id` as new lifecycle authority. Its typed binding may identify the Video domain object, but lifecycle position belongs to the Resource primitive from its first implementation.

## Deployment classification

- SQL migration needed: Yes, after K0 is independently accepted
- Supabase Edge Function deploy needed: No
- frontend deploy needed: No
- Readdy Finish update needed: No
- production runtime code change needed: No
