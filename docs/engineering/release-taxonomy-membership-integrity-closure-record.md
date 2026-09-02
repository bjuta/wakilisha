# Release Taxonomy and Membership Integrity Closure Record

Status: CLOSED - PRODUCTION ACCEPTED

Date: 1 September 2026

Accepted production application main:

`1dc7277d75256b109b485a3cc98c02229e9ccce4`

Production schema authority:

- migration count: `78`
- migration head: `20260901114500_mizizi_track_identity_write_boundary.sql`
- SQL migration for this closure: none
- Registry data mutation for this closure: none
- historical MIZIZI apply: not run

Accepted Edge Functions:

- `public-content-read` v79
- `artist-discography` v42
- `wakilisha-public-api` v95
- `seo-sitemap-admin` v40

Accepted frontend:

- entry: `assets/index-CU1jyD6_.js`
- entry SHA-256: `b430d0b6aa5b1f84d00a13b2bd088745b67a52f60e86e2d1c739581d9bacb10c`
- index SHA-256: `01d6defd6bf05f6b05ec0bb0782d349696027a73a6e9e34b513129dc843fec85`
- rollback snapshot: `/opt/wakilisha-react-backups/release-membership-integrity-20260901T162124Z-1dc7277d`

## Decision

Releases is the collective domain.

Canonical taxonomy is derived from resolvable active Track membership:

- 1 Track: Single
- 2 through 6 Tracks: EP
- 7 or more Tracks: Album

A resolvable active membership is an active `registry_release_tracks` relationship whose target is an active Registry Track.

The taxonomy describes the cultural Release object. It is separate from public detail-page ownership.

## Public identity contract

Singles remain first-class Release objects.

They remain visible in:

- the Releases collection
- Artist Discography
- Appears On

A Single does not own a second public Release detail page.

Its public destination is its one canonical Track:

`/tracks/{artist-slug}/{track-slug}`

EPs and Albums own:

`/releases/{artist-slug}/{release-slug}`

Registry UUIDs remain internal identity. This closure does not introduce UUID public Track routes.

## PR sequence

PR #781 restored the correct distinction between Release taxonomy and public page ownership.

It:

- introduced the shared 1 / 2-6 / 7+ taxonomy primitive
- restored Singles to public Release collections
- restored Singles to Artist Discography and Appears On
- routed Single cards to their canonical Track
- retained dedicated Release pages for multi-Track Releases
- removed the checked-in stale `public/sitemap.xml` as music-route authority
- regenerated sitemap output from current metadata and prerender authority

The exact-main production build then exposed a real Registry-integrity defect.

`Son of the City - EP` had six active `registry_release_tracks` rows, but none of those relationships resolved to an active Track. Sitemap authority counted the relationship rows and emitted a Release page while the Release detail reader resolved zero Tracks.

PR #782 corrected this at the authority boundary.

Public Release identity now counts only relationships whose targets are active Registry Tracks.

No broken relationship evidence was deleted.

## Production data exposed

The read-only production audit after the correction found:

- 841 active Releases
- 673 Singles by resolvable active Track count
- 53 EPs
- 102 Albums
- 13 active Releases with zero resolvable active Tracks
- 18 bad active Release-membership relationships across those 13 Releases
- 32 stored Release-type mismatches against canonical taxonomy
  - 11 EP -> Single
  - 19 Album -> EP
  - 2 EP -> Album

The 32 taxonomy mismatches are not repaired by this closure.

They are the next deterministic MIZIZI Release-taxonomy audit/repair set after the rule is added and proved.

## Sitemap authority

The checked-in historical sitemap is no longer a source of music-detail truth.

The complete production build now derives canonical routes from current public/Registry metadata authority and current prerender output.

Production canaries prove:

- canonical NERVOUS Track is present
- stale NERVOUS Single Release URL is absent
- stale Release-scoped NERVOUS Track URL is absent
- orphan-target `/releases/trio-mio/son-of-the-city-ep` is absent

## Deployment incident and prevention

The first exact-main production deployment runner stopped after frontend activation because its direct-origin entry hash did not follow the HTTP-to-HTTPS redirect.

The unfollowed 301 response body had SHA-256:

`7cb59ce037656d9a4e8ee9194bc31dfc540cbc8fd5b19c64439a89631cde3715`

The actual live entry file already had the accepted SHA-256:

`b430d0b6aa5b1f84d00a13b2bd088745b67a52f60e86e2d1c739581d9bacb10c`

A read-only diagnostic proved:

- remote live file byte parity
- followed direct-origin byte parity
- public HTTPS byte parity

The deployment was not rerun.

A final read-only acceptance runner then passed exact main, live artifact identity, rollback presence, direct origin, public HTTPS, affected routes, and sitemap canaries.

The production runbook now explicitly requires redirect-aware asset hashing and surgical resume after a partially completed deployment.

## MIZIZI boundary

MIZIZI did not create this public page model.

The public product/identity layer owns whether a Release receives a dedicated page.

MIZIZI owns Registry hygiene underneath that model.

The deterministic Release taxonomy extension is implemented in MIZIZI rule-set v1.1.0.

It:

- derives canonical taxonomy from resolvable active Track membership
- preserves provider classification and broken relationship rows as evidence
- expected-value locks the stored type
- re-counts resolvable active Track targets before writing
- records canonical write provenance
- creates no review work for a deterministic mismatch
- emits no taxonomy candidate for zero-resolvable Releases

The first read-only production audit found exactly 32 candidates: 11 EP to Single, 19 Album to EP, and 2 EP to Album.

No taxonomy apply has been run.

Historical Track-slug apply remains separately unrun.

## Deployment classification

- SQL migration needed: No
- Supabase Edge Function deployment needed: Done
- frontend deployment needed: Done
- Readdy Finish update needed: No
- Registry data mutation: No
- MIZIZI historical apply: No

## Subsequent historical MIZIZI apply - 2 September 2026

The 32 deterministic Release taxonomy mismatches documented above were subsequently applied and production accepted through reviewed trigger PR #797 and governed MIZIZI Release Production Control Plane run #9.

That later historical data mutation does not change this closure's Release taxonomy, membership-integrity, or public-identity decisions. It changes only the stored `registry_releases.release_type` values for the accepted 32-row set.

Canonical subsequent closure record:

- `docs/engineering/mizizi-historical-release-taxonomy-production-closure-record.md`

The 18 bad active Release-membership relationships across 13 active Releases remain preserved evidence.
