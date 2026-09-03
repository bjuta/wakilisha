# Show / Video Public Route Convergence — Production Closure Record

Status: CLOSED — PRODUCTION ACCEPTED

Closed: 3 September 2026

## Decision

This work is closed as post-Phase-7B product maintenance.

It does not reopen Phase 7A or Phase 7B, and it does not change the current numbered programme. Phase 8: Field Capture remains current.

The correction restores the existing shared Show primitive as the only public hierarchy for Show Episodes.

Accepted public route contract:

- Show directory: `/shows`
- Show detail: `/shows/:showSlug`
- Show Episode: `/shows/:showSlug/:episodeSlug`
- standalone Video detail: `/video/:slug`

Rejected public identities:

- `/video/:showSlug/:episodeSlug`
- a Show Episode leaking through `/video/:slug`

No legacy redirect was retained for the retired episodic Video route.

## Root cause

The published Video `Monday Morning in September` already consumed the canonical shared Show and Show Episode primitives correctly.

The production defect came from three public-authority gaps:

1. the Video publication path exposed a competing `/video/:showSlug/:episodeSlug` identity
2. governed Video publication did not promote the bound shared Show and Show Episode to public visibility
3. public Show reads were still Audio-backed rather than true cross-media shared reads

The repair did not create a Video-owned series hierarchy.

## Accepted implementation

PR #811 merged at:

`11eb22327d3286155375a197f77c57e5f57a435a`

Protected-main Critical Control Plane run #941: PASS.

Repository migration:

`20260903150511_show_video_public_route_convergence.sql`

Migration SHA-256:

`ae66f2ac796c0b087e922dd5392ebaba91594a2a81b58012a01d64e6f1ef58a1`

Accepted production database state:

- migration count: `84`
- migration head: `20260903150511_show_video_public_route_convergence.sql`
- pending repository migrations: `0`

The migration:

- preserves the mature Phase 7B Video delivery reader internally
- preserves the accepted Audio-backed Show Episode reader internally
- exposes corrected public Video identity
- composes shared Show Episodes across published Audio, Video, or both
- exposes a first-class public Show index
- promotes shared Show and Show Episode visibility when a governed Video Episode becomes current-public
- backfills already-current public Video Episode hierarchy visibility
- does not republish Video
- does not create a new immutable Video version

## Real production authority

Real Show:

- title: `The Sounds of Nairobi`
- resource id: `8652a638-82ca-4cc9-89b4-db174155fbeb`
- visibility: `public`
- lifecycle: `active`
- canonical path: `/shows/the-sounds-of-nairobi`
- Episode count: `1`
- Video Episode count: `1`
- Audio Episode count: `0`

Real Show Episode:

- title: `Monday Morning in September`
- resource id: `190796c6-ce9b-499f-a8c4-e94fc1d0d63d`
- visibility: `public`
- lifecycle: `active`
- canonical path:
  `/shows/the-sounds-of-nairobi/monday-morning-in-september`

Current immutable Video remained unchanged:

- version number: `16`
- version id: `4ab5a5bb-b0f4-4b8b-8ea2-94fe1be8786e`
- resource id: `114618c2-2246-4503-9202-4a6631159d96`
- publication kind: `episode`
- content fingerprint:
  `0e0529126f764cfe235f78848e0bf49c7b5da558030cf5f19feb220373ac4be8`

The repair did not publish the draft Audio Episode.

## Delivery continuity

The accepted Video delivery authority remained intact after route convergence:

- native MP4 delivery preserved
- adaptive HLS preserved
- governed 360p and 720p renditions preserved
- Sheng caption track preserved
- governed transcript preserved
- Video version id preserved
- no Edge Function deployment required

Public Show-scoped Video canonical path now resolves to:

`/shows/the-sounds-of-nairobi/monday-morning-in-september`

Standalone lookup for the Episode returns no publication.

## Frontend production acceptance

Accepted production/frontend main:

`11eb22327d3286155375a197f77c57e5f57a435a`

Complete exact-main production build: PASS.

Accepted frontend artifact:

- entry: `assets/index-CZBM1l7e.js`
- index SHA-256:
  `8db2244ec6b98d41043bdf1e86d1d1f2d24e911ab8605925b9e34e2c7c9d44ca`
- entry SHA-256:
  `7092d872ad405d2a32616f2cca5bc63f1b118ca2ee0a1c21d85e724a7306b05d`
- file count: `3691`
- accepted build dist-tree SHA-256:
  `2ba6dcbde9093001e72c92a60ed60ddb3926dc8c6e1098504b0467f3b9ba2718`
- live relative-manifest tree SHA-256:
  `f2519dcdd2ee085fa7d9378feae5c51ec207dde7b1a41edfadd536b0a15aeff8`

Complete production build acceptance included:

- home delivery audit: PASS
- Admin route splitting: PASS
- responsive image audit: PASS
- public route splitting: PASS
- GA4 implementation audit: PASS
- production Vite build: PASS
- Admin route build-output audit: PASS
- public route build-output audit: PASS
- GA4 build-output audit: PASS
- SEO prerender/fallback/sitemap audit: PASS
- no hard SEO regression

Production rollback snapshot:

`/opt/wakilisha-react-backups/show-video-public-route-convergence-20260903T154716Z-11eb2232`

Live acceptance proved:

- complete server live-tree byte parity
- redirect-aware direct-origin index and entry byte parity
- public HTTPS index and entry byte parity
- Nginx configuration valid
- `/shows`: HTTP 200
- `/shows/the-sounds-of-nairobi`: HTTP 200
- `/shows/the-sounds-of-nairobi/monday-morning-in-september`: HTTP 200

The first activation runner stopped after successful activation because its server-local HTTPS origin check could not validate the local issuer chain. The deployment was not rerun. A read-only redirect-aware acceptance runner proved the live artifact instead.

## Real browser acceptance

Rendered Google Chrome acceptance passed against production.

`/shows` rendered:

- `Stories that continue`
- `The Sounds of Nairobi`
- `1 Episode`
- `1 Watch`
- no unavailable or empty-state error

`/shows/the-sounds-of-nairobi` rendered:

- shared Show banner
- `Watch latest`
- `Monday Morning in September`
- `Episode 1`
- `1 Watch`

`/shows/the-sounds-of-nairobi/monday-morning-in-september` rendered:

- `Monday Morning in September`
- `The Sounds of Nairobi`
- `Episode 1`
- governed transcript action
- a real `<video>` element
- canonical Show Episode URL
- no unavailable or 404 surface

Retired identities rendered WAKILISHA's `Page not found` surface:

- `/video/the-sounds-of-nairobi/monday-morning-in-september`
- `/video/monday-morning-in-september`

This confirms there is no legacy redirect and no standalone Video identity leak for the Episode.

## Preview acceptance and cleanup

Accepted disposable Supabase preview:

- name: `show-video-public-route-convergence`
- branch id: `24fe30b5-31a5-45ca-8225-4aa919896c2b`
- project ref: `ckawmppbefnyfljwuqvn`

Preview acceptance included:

- baseline migration parity with production
- exact candidate migration application
- rollback-only Show / Video behavior proof
- public Show directory proof
- shared visibility promotion proof
- standalone leakage guard
- Phase 7B V1 verifier: PASS
- Phase 7B V4B verifier: PASS
- Phase 7B V4C verifier: PASS
- transcript authority verifier: PASS
- exact migration-history timestamp alignment
- `supabase db push --dry-run --linked`: remote database up to date

The preview was deleted after complete production browser acceptance.

No paid disposable Show / Video preview remains.

## Primitive compounding disposition

The correction strengthens the Primitive Compounding Contract.

It reuses:

- shared Show identity
- shared Show Episode identity
- existing Audio publication authority
- existing Video publication authority
- existing Media/HLS/caption/transcript authority
- existing immutable Video version authority

It does not create:

- Video Series
- Video Show
- a second Episode hierarchy
- a legacy route compatibility layer
- a new Video version

The shared Show primitive is now a genuine cross-media public primitive.

## Programme disposition

Phase 7B remains CLOSED.

This corrective convergence is accepted post-closure maintenance and becomes the new production baseline inherited by Phase 8.

Current numbered programme remains:

**Phase 8: Field Capture**

## Deployment classification

- SQL migration needed: No — live and accepted
- Supabase Edge Function deploy needed: No
- frontend deploy needed: No — live and accepted
- Production Finish update needed: No — this closure records the accepted state
- production content republish needed: No
- PR needed now: documentation closure only
- disposable preview needed: No — deleted
