# MIZIZI Slice 3 — Admin Registry Authority Convergence Record

Date: 2026-09-20

Status: **Production accepted**

Base main:

`79e0bd14c9c475480283c150d6dacdfeccbce773`

Accepted candidate branch:

`fix/slice3-admin-router-registry-authority`

Disposable Preview:

- project ref: `zoovlwdrssyrtiuuozog`
- branch id: `083eef5e-7183-4f3b-a238-2c1490ed83b1`
- migration ledger: **158**
- migration head: `20260920190646`
- `admin-router`: **v54 ACTIVE**
- `verify_jwt=true`

## 1. Authority problem

The Registry section of `supabase/functions/admin-router/index.ts` authenticated a
human caller and checked `manage_registry`, but canonical Artist, Track, Release,
Label, and Genre PATCH/DELETE operations were still executed by the Edge
Function's service-role client.

That meant caller authorization existed at the transport edge while canonical
mutation authority still belonged to a broad service-role table writer.

The accepted convergence keeps service-role Registry reads in the router but
moves canonical mutation to caller-bound database commands invoked with the
requester's JWT.

## 2. Accepted bounded commands

Migration:

`20260920173000_admin_registry_profile_authority_v1.sql`

installs five caller-bound profile commands:

- `admin_patch_registry_artist_profile_v1(...)`
- `admin_patch_registry_track_profile_v1(...)`
- `admin_patch_registry_release_profile_v1(...)`
- `admin_patch_registry_label_profile_v1(...)`
- `admin_patch_registry_genre_profile_v1(...)`

Each command requires:

- `auth.uid()`;
- `manage_registry`;
- one exact Registry entity UUID;
- a non-empty field-whitelisted JSON patch;
- exact `expected_updated_at` compare-and-set;
- domain-required identity fields to remain valid;
- Registry audit-log evidence;
- one canonical-write event.

Execution is granted to `authenticated` only and denied to `anon` and
`service_role`.

The router uses `SUPABASE_ANON_KEY` plus the request Authorization header to
invoke these commands as the real caller. It contains no direct INSERT/UPDATE/
UPSERT/DELETE call against the five core Registry tables.

## 3. Preview defect found: stale conflicts were retryable

The first real-JWT Preview PATCH succeeded and produced one audit row plus one
canonical write event.

Replaying the old `updated_at` correctly reached the stale-state branch, but
the database functions raised SQLSTATE `40001`. Supabase/PostgREST treated that
as a retryable serialization failure; the Edge request eventually surfaced an
upstream timeout instead of returning the intended stale response.

Forward repair migration:

`20260920185845_registry_admin_stale_conflict_transport_v1.sql`

changes Registry-admin stale conflicts from retryable `40001` to non-retryable
`P0001` carrying the stable marker:

`WK_STALE_UPDATE`

The shared Admin Registry router, Release-detail client, and Track/Release
archive client remain backward-compatible with legacy `40001` while also
recognizing the new marker.

Re-acceptance with the exact preserved fixture returned:

- HTTP 409;
- `error.code = stale_update`;
- elapsed time: 3 seconds;
- current entity returned;
- stale payload not persisted.

## 4. Preview defect found: hard delete conflicts with Resource identity

The original generic Artist DELETE design attempted to physically delete a
draft `registry_artists` row.

Preview acceptance proved that this is incompatible with the current Resource
Identity control plane. Every Registry Artist receives a durable
`editorial.resources` identity plus an
`editorial.registry_artist_resources` binding. That binding intentionally
uses `ON DELETE RESTRICT`.

The hard-delete attempt therefore failed on
`registry_artist_resources_artist_fkey`.

This is not treated as a missing cascade. The Phase 1A authority makes Resource
UUID identity durable and synchronizes Registry Artist lifecycle into the
Resource lifecycle.

Forward retirement migration:

`20260920190646_registry_artist_hard_delete_retirement_v1.sql`

removes the temporary draft-Artist hard-delete database command.

Final product semantics:

- draft removal is **Archive**, not Delete;
- the Artist list archives through
  `admin_patch_registry_artist_profile_v1(...)` with
  `status = 'archived'`;
- Artist UUID remains stable;
- Resource UUID remains stable;
- the Registry→Resource lifecycle trigger moves the Resource to
  `lifecycle_state = 'archived'`;
- the old generic Registry DELETE route returns HTTP 410
  `retired_registry_hard_delete`.

## 5. Real-JWT Preview acceptance

Caller:

- real Supabase password JWT;
- normal `subscriber` role from signup;
- least additional authority: `registry_editor`;
- `manage_registry` supplied by `registry_editor`.

Accepted runtime evidence:

1. caller-bound Artist bio PATCH: HTTP 200;
2. exactly one Registry audit row for the PATCH;
3. exactly one canonical write event for the PATCH;
4. stale replay of the original timestamp: HTTP 409 `stale_update`;
5. stale payload did not land;
6. untouched draft Artist archived through bounded PATCH: HTTP 200;
7. exactly one Registry audit row for the archive;
8. exactly one canonical write event for the archive;
9. archived Artist remains present;
10. its Resource identity remains present and is `archived`;
11. old DELETE route: HTTP 410 `retired_registry_hard_delete`;
12. fixture roles revoked after acceptance.

Final fixture evidence totals:

- accepted mutations: **2**
- Registry audit rows: **2**
- canonical write events: **2**
- stale-payload rows: **0**
- active fixture roles: **0**

## 6. Permanent control-plane contracts

The candidate adds:

`scripts/control-plane/verify-admin-registry-profile-authority.sql`

which verifies:

- all five bounded commands exist;
- authenticated execution is allowed;
- anon/service-role execution is denied;
- caller identity, `manage_registry`, CAS, audit, and canonical-write contracts
  remain present;
- stale conflicts use `WK_STALE_UPDATE`, not `40001`;
- the temporary draft Artist hard-delete command is absent;
- the Registry Artist→Resource lifecycle synchronization trigger remains present.

Phase 0B additionally rejects:

- reintroduction of direct core Registry DML in `admin-router`;
- loss of caller-JWT command invocation;
- reintroduction of the draft Artist hard-delete RPC;
- loss of the hard-delete fail-closed marker.

The canonical-writer inventory classifies the five retained bounded commands and
does not classify the retired hard-delete road.

## 7. Replay seal

Repository-native Preview sealing generated:

- `src/types/database.types.ts`;
- `docs/engineering/live-schema-baseline.json`;
- replay proof for `20260920173000_admin_registry_profile_authority_v1.sql`;
- replay proof for `20260920185845_registry_admin_stale_conflict_transport_v1.sql`;
- replay proof for `20260920190646_registry_artist_hard_delete_retirement_v1.sql`.

Seal authority:

- base main: `79e0bd14c9c475480283c150d6dacdfeccbce773`
- Preview project: `zoovlwdrssyrtiuuozog`
- Preview branch id: `083eef5e-7183-4f3b-a238-2c1490ed83b1`
- migration count: **158**
- migration head: `20260920190646`
- generated types SHA-256:
  `05e5971d4ad9b86a5db2404a05747692ab94ee5c327000182299c371acf90343`

Migration SHA-256 values:

- `20260920173000...`:
  `65c8cd30ebe8fd4b2391171c2f13d8642a82a0634ab5dd406e7ee9ded9531839`
- `20260920185845...`:
  `ce1b74c69b8697f8b946479081b203ee1ddcb6ecfabce319e395023d091231cb`
- `20260920190646...`:
  `eb059aa64c8056eaf484b34b9d84fd21e294a25fb7fb7bc9928258458ed49225`

## 8. Production acceptance

Repository authority:

- PR #998 merged to protected main;
- exact merged main: `02e63ebf47e0c4f9248d56ca9ff8897c62d8b75a`;
- final PR Critical Control Plane #1389: PASS;
- final PR MIZIZI Track Production Control Plane #70: PASS;
- final PR MIZIZI Release Production Control Plane #48: PASS;
- protected-main Critical Control Plane #1390: PASS.

Production SQL promotion:

- pre-promotion ledger: 155 / `20260920160500`;
- exact native pending set: the three migrations documented above;
- all three applied from exact merged main;
- post-apply native dry run: `Remote database is up to date.`;
- final ledger: **158 / `20260920190646`**;
- permanent verifier: **`ADMIN_REGISTRY_PROFILE_AUTHORITY_PASS`**.

Production RPC grant shape for all five bounded profile commands:

- authenticated EXECUTE: true;
- anon EXECUTE: false;
- service_role EXECUTE: false.

The temporary draft-Artist hard-delete RPC is absent.

Production Edge promotion:

- `admin-router` v51 -> **v52 ACTIVE**;
- `verify_jwt=true`;
- live deployed source is byte-for-byte identical to exact merged main;
- live source contains the caller-bound bounded command road;
- live source contains `retired_registry_hard_delete`;
- live source does not contain `admin_delete_registry_draft_artist_v1`;
- live source does not contain the retired direct core Registry update/delete road;
- post-deploy permanent verifier: PASS.

The disposable Preview may be retired after this Production evidence is sealed.

## 9. Slice 3 consequence

This convergence closes the remaining direct service-role canonical Registry DML
inside the live `admin-router` Registry Edge surface.

It does **not** by itself close Slice 3. The reopened authority audit still owns
separate database-function convergence/retirement debt, including high-blast
merge/decouple/repair roads and other exact domains tracked on #962.

Slice 4 remains blocked until #962 re-closes.
