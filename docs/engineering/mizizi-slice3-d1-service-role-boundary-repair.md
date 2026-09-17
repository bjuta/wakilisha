# MIZIZI Slice 3 D1: Top Songs Service-Role Boundary Repair

Status: **LOCAL REPAIR CANDIDATE - NOT YET PRODUCTION-ACTIVE**

Programme issue: #962

Merged D1 authority: `fcaee5d5232a8e1f519098f4caed9581ad913cc7`

Production D1 migration: `20260917121500_artist_top_song_presentation_authority_v1.sql`

## Finding

Independent Production acceptance after the D1 SQL promotion proved that the
three new presentation tables inherited direct `service_role` table privileges.

The D1 product boundary does not require those privileges:

- public gateways need `service_role` EXECUTE on `get_artist_top_songs_v1`;
- the public gateways do not need direct table access;
- `admin_replace_artist_top_songs_v1` is caller-bound to authenticated
  `manage_registry` authority and must remain unavailable to `service_role`;
- the private fingerprint function remains unavailable to `service_role`.

The initial permanent verifier covered browser direct authority but did not
assert the service-role table boundary. That omission is repaired here.

## Containment

The gap was detected before either D1 public Edge reader was promoted to
Production. The existing Production readers therefore did not depend on the
new table grants.

The D1 backfill itself independently passed:

- migration history `148 / 20260917121500`;
- 77 active legacy relationships exactly mapped;
- 73 resolved presentation rows;
- 4 `needs_review` lineage rows;
- 9 migration-backfill events;
- zero lineage-set drift against the active legacy relationship UUID set.

No rollback of presentation data is required.

## Repair

`20260917121600_artist_top_song_service_role_boundary_v1.sql`:

- revokes all direct `service_role` privileges on all three Top Songs
  presentation tables;
- reasserts only service-role EXECUTE on `get_artist_top_songs_v1`;
- reasserts that `service_role` cannot execute the admin replacement RPC;
- reasserts that `service_role` cannot execute the private fingerprint helper.

The permanent D1 verifier is hardened to fail if any direct table authority
returns or if the service-role RPC boundary drifts.

## Deployment classification

- SQL migration needed: **Yes**
- Edge Function deploy needed for this repair: **No**
- frontend deploy needed for this repair: **No**
- Production Finish update needed: **No**
- presentation data mutation required: **No**
- ACL mutation required: **Yes**
