# MIZIZI Slice 3 Candidate D2: `admin-registry-api` Retirement

Date: 17 September 2026

Repository base: `main@6852c24f312deb32345977e78aece06eb8c9387d`

Issue authority: #962, MIZIZI Slice 3: Obsolete Authority Retirement & Bypass Closure

## Decision

Retire the standalone `admin-registry-api` runtime after D1 replacement proof.

This D2 repository candidate does not delete the Production deployment. Production v37 remains available only as rollback authority until this repository retirement contract is merged and a final traffic audit remains zero.

## Replacement proof

Generic Registry entity list/profile/PATCH/DELETE authority is already served by `admin-router/registry`.

Artist Top Songs presentation authority is now separated from evidence-backed Registry relationship truth:

- read: `get_artist_top_songs_v1`
- write: `admin_replace_artist_top_songs_v1`

D1 Production acceptance proved:

- service-role presentation-table DML is closed;
- public readers use presentation authority;
- unresolved legacy Top Songs identity exceptions do not leak into public output;
- the canonical frontend is deployed from merged `main`;
- the authenticated Admin read path resolves the presentation authority;
- the authenticated Admin write RPC executes successfully under a forced rollback with zero persistent acceptance mutation.

## Remaining v37 behavior

The retained Production v37 deployment contains no unique product capability after D1:

- duplicate generic entity GET/PATCH routes;
- legacy Top Songs GET;
- legacy Top Songs destructive POST over `registry_entity_relationships`.

Its Production deployment baseline before retirement is:

- function id: `fb5b72d4-6321-4224-adf8-a8811b7be498`
- version: `37`
- `verify_jwt = true`
- bundle SHA-256: `d81d55c883633c4756a0971ae28648879c9baad02777d9412092dfae65694a19`

## Initial Production traffic receipt

Conservative audit start: `2026-09-17T16:56:29Z`, immediately before the canonical D1 frontend activation.

Receipt end: `2026-09-17T17:27:11Z`.

Window: 30 minutes.

Recorded `admin-registry-api` invocations: **0**.

Recorded OPTIONS invocations: **0**.

Recorded non-OPTIONS invocations: **0**.

This is an initial retirement receipt, not the final deletion authorization. D2 must repeat the traffic audit immediately before Production deletion after the repository retirement change is merged.

## Pre-retirement canonical fingerprint

The following exact Production counts and deterministic content hashes were captured before any D2 runtime deletion:

| Authority | Rows | MD5 |
|---|---:|---|
| `registry_artists` | 1227 | `d06edba88b4568cf1141eeb7235fea27` |
| `registry_tracks` | 2453 | `ee6efcc3e4aa782ac4807a8e4a32a2d7` |
| `registry_releases` | 842 | `5d9ce14f1109da84684d10c97e9dff5c` |
| `registry_labels` | 232 | `d822af6b2fc977c2d4c7e4ed5307e355` |
| `registry_genres` | 45 | `d4b1c05ff2148b08cecc7643594878c9` |
| `registry_entity_relationships` | 165 | `bf64fbe3fb29a830a3fd417e94ec8450` |
| `artist_top_song_curations` | 73 | `06ceaf1674483f6b6493ab3da9c769bb` |
| `artist_top_song_curation_migration_map` | 77 | `3d273a2d7d6f28abfefb4282396eb8b3` |
| `artist_top_song_curation_events` | 9 | `c06c43954d1812a12c5f2c936c23ac99` |

The post-deletion acceptance must reproduce this fingerprint exactly. Operational telemetry tables are intentionally excluded.

## Repository retirement contract

This candidate:

- deletes `supabase/functions/admin-registry-api/index.ts`;
- removes `admin-registry-api` from the privileged-writer manifest;
- removes the stale Admin Top Songs source comment;
- preserves historical D1 documentation;
- adds a negative regression test proving the runtime source and active product references cannot silently return.

There is no SQL migration, schema change, replay seal, frontend behavior change, or Production mutation in this candidate.

## Production deletion gate

Production v37 may be deleted only after:

1. this repository retirement candidate is merged through protected CI;
2. current `main` still has no active product/runtime caller;
3. a fresh bounded Production traffic audit since the D1 frontend release still records zero invocations;
4. the pre-retirement canonical fingerprint is re-confirmed immediately before deletion.

After deletion:

1. `admin-registry-api` must be absent from the Production Edge deployment list;
2. the old URL must fail closed;
3. the exact canonical fingerprint above must be unchanged;
4. D1 public-reader acceptance must remain green;
5. Admin Top Songs must remain on the typed RPC authority.
