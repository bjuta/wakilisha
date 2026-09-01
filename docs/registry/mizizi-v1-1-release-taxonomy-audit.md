# MIZIZI v1.1 Release Taxonomy Audit

Status: IMPLEMENTED, READ-ONLY PRODUCTION AUDIT ACCEPTED, APPLY NOT RUN

Date: 1 September 2026

Accepted base main:

`5dfe86819aaf8914e9754c6905e0ead58826e304`

Candidate branch:

`feat/mizizi-v1-1-release-taxonomy`

## Purpose

Make the accepted Release taxonomy a permanent MIZIZI Registry-hygiene rule without changing public route grammar or mutating production during implementation.

Canonical taxonomy:

- 1 resolvable active Track: Single
- 2 through 6 resolvable active Tracks: EP
- 7 or more resolvable active Tracks: Album

A resolvable active Track membership is an active `registry_release_tracks` row whose target is an active `registry_tracks` row.

## Rule

MIZIZI rule-set version advances to `1.1.0`.

New rule:

`release_taxonomy_drift`

The rule is an automatic-fix candidate only when:

1. at least one active Track target resolves
2. the shared Release-taxonomy primitive derives a canonical type
3. the stored `registry_releases.release_type` differs from that type

Zero-resolvable Releases do not receive taxonomy mutation candidates.

Release title and slug provider-packaging rules remain observe-only.

## Apply safety

The implementation does not rely on the earlier audit result at write time.

For each candidate, apply mode:

1. starts a serializable transaction
2. takes a Release-scoped advisory lock
3. locks the active Release row
4. verifies the stored `release_type` still equals the expected before-value
5. re-counts active memberships whose Track targets are active
6. re-derives taxonomy through the shared primitive
7. refuses the write as stale if count or taxonomy changed
8. updates only `release_type`
9. writes `registry_canonical_write_events`
10. commits atomically

No Release title, slug, Track membership, provider observation, redirect, or public route is changed by this rule.

## Read-only production audit

Production project:

`pgzizndxdyhqmtyywjmt`

Audit result:

- active Releases: 841
- zero-resolvable active Releases: 13
- automatic `release_taxonomy_drift` candidates: 32
- EP to Single: 11
- Album to EP: 19
- EP to Album: 2

The 13 zero-resolvable Releases are excluded from the taxonomy candidate set.

No Registry rows were changed by the audit.

## Deployment classification

- SQL migration needed: No
- Supabase Edge Function deploy needed: No
- frontend deploy needed: No
- Readdy Finish needed: No
- production Registry mutation: No
- MIZIZI apply: No
