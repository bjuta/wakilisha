# MIZIZI historical Release taxonomy production closure record

Date: 2 September 2026

## Status

Accepted in production.

The historical MIZIZI Release taxonomy apply is complete.

This closure is Release-taxonomy-only. It does not rewrite Release membership evidence, Release title/slug provider packaging, public route grammar, or the separately closed historical Track identity programme.

## Production authority

Production apply main:

`2be4da08001bc0b01d2e419120fc2046585865a2`

Accepted Release control-plane infrastructure:

- PR #796, `Add MIZIZI Release production control plane`
- merged main: `1f4a5cc0711410bd79696586f1bfd214c2f9963e`
- Release preflight #7: PASS
- Critical Control Plane #898: PASS
- protected-main Critical Control Plane #899: PASS

Reviewed production trigger:

- PR #797, `Authorize historical MIZIZI Release taxonomy apply`
- trigger file: `.github/mizizi-release-production-apply.json`
- accepted Release authority fingerprint: `cf71fc24d54bb71d64a469e159daaf06b137680f294efe4542b1b691aee68b16`
- accepted candidate-set fingerprint: `238a817a5e342f8311ac04fc9a6bc978f67276cb664046cddc9e375bc323e9c4`
- expected taxonomy writes: 32
- expected split: 11 EP to Single / 19 Album to EP / 2 EP to Album

Trigger-PR acceptance:

- MIZIZI Release Production Control Plane #8: PASS
- Critical Control Plane #900: PASS

Governed production run:

- workflow: `MIZIZI Release Production Control Plane`
- run: #9
- run id: `33659753091`
- result: PASS
- evidence artifact id: `9858232401`
- evidence artifact SHA-256: `d02a57ec57f33e0b2a31b495ef005b0ff0860b00f78d73eff4a6ef27cdeebe24`

Protected push acceptance:

- `Critical Control Plane` run #901: PASS

## Accepted control-plane boundary

The historical Release mutation remained closed until GitHub could prove the accepted production state through the Release-scoped control plane.

The accepted path:

1. runs from GitHub's production control plane
2. requires a separately reviewed trigger manifest
3. locks the exact accepted MIZIZI Release runtime bytes
4. requires the exact Release authority fingerprint
5. requires the exact 32-row candidate-set fingerprint
6. enters production temporary database access only for the governed run
7. proves a live JIT `postgres@postgres` session before database work
8. performs a fresh read-only Release audit before mutation
9. applies Release taxonomy candidates through the existing serializable row-level MIZIZI primitive
10. accepts only the exact 32-event post-apply state
11. performs a fresh read-only post-apply audit
12. restores the JIT mapping and leaves production temporary access disabled at rest
13. treats accepted post-apply state as valid preflight authority and refuses repeat production mutation
14. fails closed on partial or mixed production state

Read-only audit invocations may retry bounded transient JIT-provider readiness failures. The mutating apply remains single-shot and is not automatically retried.

No laptop database password, custom long-lived Postgres role, or ad hoc production credential became part of the accepted deployment surface.

## Accepted pre-apply authority

Immediately before the governed apply:

- active Releases: 841
- zero-resolvable active Releases: 13
- taxonomy candidates: 32
- EP to Single: 11
- Album to EP: 19
- EP to Album: 2
- bad active Release-membership relationships: 18
- active Releases containing those bad relationships: 13
- MIZIZI Release canonical-write events: 0
- open Release-specific MIZIZI reviews: 0
- migration count: 79
- migration head: `20260901170500_community_track_registry_identity.sql`
- Release authority fingerprint: `cf71fc24d54bb71d64a469e159daaf06b137680f294efe4542b1b691aee68b16`
- candidate-set fingerprint: `238a817a5e342f8311ac04fc9a6bc978f67276cb664046cddc9e375bc323e9c4`

Fresh pre-apply Release audit:

- findings: 1,448
- observed findings: 1,416
- automatic taxonomy candidates: 32
- applied: 0
- queued for review: 0
- stale: 0
- Releases scanned: 841
- Tracks scanned: 0
- chart entries scanned: 0

The audit reported:

`Audit mode completed. No Registry rows were changed.`

## Accepted production apply

The governed apply completed with exactly:

- canonical Release taxonomy writes: 32
- unique finding fingerprints: 32
- `release_taxonomy_drift` rule/version matches: 32
- canonical field/target-path matches: 32
- downstream impact payload matches: 32
- canonical event-to-current Release matches: 32
- remaining Release taxonomy candidates: 0
- Release-specific review items created: 0

Exact transition split:

- EP to Single: 11
- Album to EP: 19
- EP to Album: 2

Only `registry_releases.release_type` changed for these accepted candidates.

## Preserved Release-membership evidence

The historical apply did not delete, rewrite, infer, or repair the bad active Release-membership relationships.

Accepted preserved state:

- bad active Release-membership relationships: 18
- affected active Releases: 13
- zero-resolvable active Releases: 13

Those relationship rows remain Registry evidence. They do not manufacture Release taxonomy because MIZIZI counts only active memberships whose Track target resolves to an active Registry Track.

## Accepted post-apply audit

Fresh post-apply Release audit:

- findings: 1,430
- observed findings: 1,430
- automatic taxonomy candidates: 0
- applied: 0
- queued for review: 0
- stale: 0
- Releases scanned: 841
- Tracks scanned: 0
- chart entries scanned: 0

The post-apply audit reported:

`Audit mode completed. No Registry rows were changed.`

No `release_taxonomy_drift` candidate remains.

## Production database preservation

After the Release apply:

- active Releases: 841
- MIZIZI Release canonical-write events: 32
- open Release-specific MIZIZI reviews: 0
- migration count: 79
- migration head: `20260901170500_community_track_registry_identity.sql`

The separately accepted historical Track state remains intact:

- MIZIZI Track canonical-write events: 440
- open MIZIZI review items: 66

No repository migration was added or applied by this historical Release data mutation.

Production temporary database access was restored to disabled at rest after the governed run.

## Explicit non-effects

This closure does not:

- delete or rewrite the 18 bad active Release-membership relationships
- manufacture taxonomy for the 13 zero-resolvable Releases
- modify Release titles
- modify Release slugs
- create slug redirects
- change Track rows
- change public Track route grammar
- change Single public-destination policy
- add a SQL migration
- deploy a Supabase Edge Function
- deploy frontend assets
- require a Readdy Finish update
- reopen Phase 7A
- change Phase 7B as the current numbered programme phase

## Exit gates

Passed.

- Release control-plane infrastructure accepted through PR #796.
- Production re-sealed after infrastructure merge at 841 / 13 / 32 / 18 / 0 / 79.
- Trigger PR #797 contained exactly one production-authorization file.
- Trigger-PR Release preflight #8 passed with no Registry mutation.
- Trigger-PR Critical Control Plane #900 passed.
- Governed production run #9 passed.
- Exactly 32 Release taxonomy writes committed.
- Transition split matched 11 / 19 / 2.
- Canonical write events are 32 with 32 unique finding fingerprints.
- Rule, field, impact, and event-to-current-Release acceptance all match 32 / 32.
- Remaining taxonomy candidates are zero.
- The 18 bad memberships across 13 Releases remain preserved.
- Release-specific MIZIZI reviews remain zero.
- Fresh post-apply audit is 1,430 findings / 1,430 observations / 0 candidates / 841 Releases with no mutation.
- Migration history remains 79 through `20260901170500`.
- Critical Control Plane #901 passed.
- JIT mapping was restored and production temporary access is disabled at rest.

Historical MIZIZI Release taxonomy apply is closed.

The remaining 66 historical Track identity candidates continue as governed review work, and the 18 bad Release-membership relationships remain preserved evidence rather than permission for inferred identity.
