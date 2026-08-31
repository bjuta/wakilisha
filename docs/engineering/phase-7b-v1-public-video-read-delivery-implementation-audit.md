# Phase 7B V1 Public Video Read and Delivery Implementation Audit

Status: PREVIEW ACCEPTED, PROTECTED CI PENDING

Date: 31 August 2026

Base main:

`b6bbe5ac2a09d5bbe345f7c91936eb62e4f6fee1`

## Problem layer

Public Video product.

Phase 7A closed the internal Video publication authority. Phase 7B now needs a public Video surface that reads only the current immutable published version, serves only public-safe derivatives, delivers governed captions without exposing protected Media paths, and works across desktop and mobile.

## Real cultural output

The acceptance instrument remains the real Phase 7A Video:

`Monday Morning in September`

Final internal authority entering Phase 7B:

- published Video version: v8
- published version id: `959651c7-d058-44ae-9ad6-b797c5c0f7b8`
- Video fingerprint: `228e93ca257f031106e7cc0f083b0fec3ff9964a27399e39c64044fd9e3bfe4e`
- native Media revision: `678e502b-c049-4b1b-81b1-08d4399868ff`
- governed Sheng caption revision: `49427742-501d-44a0-951e-da56e51992ae`
- caption language: `und-x-sheng`

No synthetic public acceptance record replaces this real Video.

## V1 boundary

This slice establishes the first public Video read and delivery path.

It includes:

- public Video collection route
- public standalone Video route
- public Show-bound Video Episode route
- current-published-version read authority
- native public Video derivative selection
- provider-backed Video embedding metadata
- governed VTT caption relationship
- service-only protected caption file target
- caption transport Edge Function
- responsive native `<video>` player
- governed `<track>` captions
- chapter seeking when chapters exist
- shared public Credits, Citations, and provenance presentation
- public route splitting and schema/type control-plane coverage

It does not close all of Phase 7B.

Still remaining after V1 includes:

- real production Video route smoke
- desktop and mobile visual acceptance
- public caption transport proof against the real VTT
- public Corrections presentation and correction submission continuity
- search/discovery convergence beyond the bounded Video directory
- complete SEO/prerender/sitemap integration
- cached read-model treatment required by the full Phase 7B contract
- final Phase 7B exit proof

## Authority design

### Public Video reader

`public.get_public_video_publication(text,text)`

The reader resolves only:

- a Video Resource in `published` lifecycle
- public Video Resource visibility
- `current_published_version_id`
- the exact immutable `video.publication_versions` row
- `version_kind = 'published'`

The reader then re-runs current Video publishability before returning data. A previously published Video can therefore disappear from the public read if current Media governance later becomes unsafe.

Native Video delivery uses only a verified public `video_transcode` derivative under the public Media derivative boundary. The preservation master path is never returned.

### Shared Show identity

A Video Episode remains bound to the shared Show and Show Episode identity created before Phase 7B.

Phase 7B does not create a Video-owned series system.

The public Video route can use the shared Show slug for Video Episode identity even when the shared Show's own `/shows/:slug` route is not publicly exposed. In that case the public Video page renders the Show name without creating a dead public Show link.

### Caption delivery

Public Video payloads expose only the stable caption relationship:

`/video/captions/:publishedVersionId/:trackNumber.vtt`

The browser never receives the protected Media `storage_path`.

`public.get_public_video_caption_delivery_target(uuid,integer)` is executable only by `service_role`. It re-checks:

- the exact current published Video version
- Video publishability
- exact active `video_caption` Media usage
- exact caption Media revision
- verified `text/vtt` file authority
- canonical protected caption storage namespace

The `video-public-delivery` Edge Function acts only as a transport adapter. It signs the service-approved protected path and proxies the VTT bytes with public cache headers.

## Primitive compounding disposition

### Reused primitives

- shared Resource identity
- immutable Resource and Video version authority
- shared Show and Show Episode identity
- canonical Media assets, revisions, variants, and usage links
- Media publishability governance
- shared Credits and Citations
- shared provenance lifecycle events
- `PublicTrustSummary`
- `ResponsivePage`
- existing public lazy-route architecture
- existing Supabase public-read pattern
- existing private Media signing boundary

### Candidate primitive from real need

The public Video watching surface is domain-specific presentation and remains Video-specific.

The caption transport adapter is also Video-specific in V1. It is not promoted to a universal protected-text-delivery primitive yet. A second real domain must prove that generalization before promotion.

## Preview proof

Disposable Supabase preview:

- name: `phase-7b-v1-public-video-read-delivery-sealed`
- project ref: `qibfvikjievhmcpjlvfb`
- branch id: `c26d4168-dd8a-4a0d-820a-a47af96e3ef0`

The preview first replayed the entire accepted production baseline:

- migration count: `75`
- head: `20260831080826`

Only after baseline replay completed did V1 apply.

Accepted preview candidate:

- migration: `20260831111000_phase_7b_v1_public_video_read_delivery_authority.sql`
- preview migration count: `76`
- preview head: `20260831111000`
- migration SHA-256: `623198ec0e856b731ab5758434519dfcf0900d8aadd5a9ab21635d7485482fb7`
- repository SQL and preview-applied SQL byte equality: PASS
- permanent read-only verifier: PASS
- rollback-only anonymous behavior fixture: PASS
- Edge Function `video-public-delivery`: ACTIVE
- Edge Function preview SHA-256: `c033259e2cafbf1dc48859efc7b64a3b1a36b520cd63e2b158332d905886b64e`

Replay proof:

`docs/engineering/replay-proofs/20260831111000_phase_7b_v1_public_video_read_delivery_authority.sql.json`

## Security disposition

The Supabase advisor reports the expected warning that the two public read RPCs are `SECURITY DEFINER` and executable by browser roles.

That is intentional. These functions are narrow read surfaces whose explicit job is to expose public Video data while keeping the underlying private tables inaccessible.

The protected caption delivery target is not executable by `anon` or `authenticated`. It remains service-only.

No browser role receives:

- Media preservation-master paths
- protected caption storage paths
- service-role credentials
- signing secrets

## User-facing language gate

The new public Video strings contain no em dash and no literal double-hyphen copy.

No new badge or unexplained status vocabulary is introduced.

## Deployment gates

Before production:

1. focused Phase 7B V1 structural test
2. public route splitting audit
3. `npm run build:app`
4. protected Critical Control Plane
5. merge
6. production SQL promotion
7. production migration-history verification
8. merged production SQL verifier
9. deploy only `video-public-delivery`
10. complete exact-main production frontend build
11. frontend activation
12. real Video desktop/mobile smoke
13. real Sheng caption delivery smoke
14. preview deletion

## Current deployment checklist

- SQL migration needed: Yes, after protected CI
- Supabase Edge Function deploy needed: Yes, after production SQL authority
- Readdy Finish update needed: No
- frontend deploy needed: Yes, after merge and production backend proof
- PR needed now: Yes, for protected CI because the candidate is preview-sealed
- next test: focused V1 test, route audit, application build, then protected CI
