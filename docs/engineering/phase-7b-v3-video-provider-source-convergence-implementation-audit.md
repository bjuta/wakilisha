# Phase 7B V3 Video Provider Source Convergence Implementation Audit

Status: PREVIEW AUTHORITY SEALED, LOCAL PRE-PR GATES PENDING

Accepted base main: `b6886d9fb6695e33494036e04118ed6e7b9d6ad7`

Candidate branch: `phase-7b-v3-provider-source-convergence`

## Purpose

Phase 7B V2 proved the shared playback canvas and preserved the established Video card, lightbox, picture-in-picture, navigation, and player presentation.

V3 removes the remaining provider identity split.

The target is:

```text
legacy Article or Artist provider reference
            |
            v
canonical video.sources identity
            |
            v
public provider descriptor
            |
            v
shared VideoPlaybackCanvas provider adapter
```

Legacy Article HTML remains historical content. V3 does not rewrite it.

## Production evidence audit

The current published corpus was measured directly before candidate construction.

Current immutable published Article authority contains:

- 646 unique YouTube provider object IDs
- 742 extracted YouTube ID occurrences
- 720 distinct Article and Video pairs
- 22 repeated uses of the same Video inside the same Article
- 231 current YouTube iframe occurrences
- 214 unique YouTube IDs inside current iframe markup
- 82 Articles with current YouTube iframe playback
- 55 other iframe occurrences belonging to other providers such as Spotify, Apple Music, and SoundCloud

Current active Registry Artist metadata contains:

- 45 YouTube Video items
- 45 parseable YouTube provider object IDs
- 45 unique YouTube provider object IDs
- six Artists with this legacy Video catalog metadata

The six current Artist catalogs are:

- Khaligraph Jones: 10
- Wakadinali: 10
- Nyashinski: 9
- Boutross: 8
- Bien: 4
- Kodongklan: 4

Twenty-one YouTube IDs occur in both the published Article corpus and Artist metadata.

Therefore the exact current union is:

```text
646 Article IDs
+45 Artist IDs
-21 overlap
=670 unique YouTube provider object IDs
```

YouTube provider object IDs are case-sensitive. V3 preserves their original case. The migration does not lowercase provider object IDs.

One current Vimeo reference was also observed, provider object ID `661682407`. It is not part of the 670-ID YouTube migration and remains a separate provider activation follow-up.

## Existing authority already present

Phase 7A already created the required primitives:

- `video.sources`
- immutable external provider source rows
- `video.source_providers`
- enabled YouTube and Vimeo provider definitions
- unique provider identity on `(provider_key, provider_object_id)`
- `public.register_video_source(...)`
- provider capability authority

V3 compounds those primitives. It does not create a second Video identity system.

## Candidate SQL

Migration:

`supabase/migrations/20260831173500_phase_7b_v3_video_provider_source_convergence.sql`

The migration:

1. Reads immutable current published Article versions.
2. Reads current active Registry Artist `youtube_videos` metadata.
3. Normalizes accepted YouTube watch, embed, shorts, short-link, and direct-ID forms.
4. Inserts one immutable `video.sources` row per distinct YouTube provider object ID.
5. Uses the existing partial unique provider identity index for idempotent conflict handling.
6. Does not update Article HTML.
7. Does not update Registry Artist metadata.
8. Adds one service-role-only resolver RPC for the public Edge gateway.
9. Does not hardcode 670 as a replay precondition.

The number 670 is a current production proof value, not a permanent schema invariant. Future content can legitimately increase the provider-source corpus.

## Public read convergence

`public-content-read` now resolves provider references through the service-role-only Video source resolver.

Published Article detail responses add `videoSources` descriptors carrying:

- canonical source ID
- provider key
- provider object ID
- canonical provider URL

Artist Video responses carry the same canonical provider source identity.

The current legacy Artist `url` field remains only as a rollout compatibility field. New playback code does not use it as identity.

## Player convergence

`VideoPlaybackCanvas` no longer accepts a premanufactured provider iframe URL.

Provider playback now receives:

- source ID where available
- provider key
- provider object ID
- canonical URL

`providerSource.ts` is the one provider adapter that owns:

- legacy provider URL parsing
- canonical provider URL construction
- embeddable provider URL construction
- provider labels
- provider source keys

This keeps provider-specific iframe construction out of Article, Artist, Video detail, and overlay surfaces.

## Preserved product behavior

V3 deliberately preserves the accepted Video experience:

- existing Video cards
- lightbox playback
- collapse to picture-in-picture
- expand
- draggable picture-in-picture
- previous and next navigation
- keyboard behavior
- shared playback canvas
- current native Video controls
- current in-player governed captions

This is authority convergence, not another Video redesign.

## Analytics convergence

Legacy Video interaction analytics previously treated raw provider URLs as identity.

V3 records:

- canonical Video source ID
- provider key
- provider object ID
- canonical URL
- presentation platform
- title and index

## Permanent verification

Read-only verifier:

`scripts/control-plane/verify-phase-7b-v3-video-provider-source-convergence.sql`

It verifies:

- every current public YouTube evidence ID has canonical `video.sources` authority
- no malformed YouTube source IDs exist
- canonical URLs agree with provider object IDs
- provider rows do not carry native Media identity
- anonymous and authenticated callers cannot execute the provider resolver
- service role can execute the resolver
- resolver output can recover a canonical evidence sample

It reports the current Article, Artist, union, and canonical-source counts without hardcoding the production count.

## Protected regression contract

Focused regression:

`test/video/phase-7b-v3-video-provider-source-convergence.test.ts`

Critical Control Plane now has an explicit V3 enforcement step after V2.

## Preview proof

The existing disposable Phase 7B preview was reused rather than creating redundant infrastructure.

Preview ref:

`qibfvikjievhmcpjlvfb`

The preview began at the accepted production baseline:

- 76 migrations
- migration head `20260831111643`
- no external provider rows in `video.sources`

A disposable Article fixture exercised four YouTube shapes:

- watch URL: `AbCdEfGhI12`
- YouTube nocookie embed: `QwErTyUiO34`
- short link: `ZxCvBnMmN56`
- Shorts URL: `XyZaBcDeF90`

A disposable Artist fixture exercised:

- direct provider object ID: `QwErTyUiO34`
- watch URL: `LmNoPqRsT78`
- object URL field: `NmOpQrStU91`

The overlap makes the expected fixture union six provider identities.

The first migration rehearsal exposed a candidate defect: SQL regular expressions in both the migration and verifier contained doubled backslashes. Only the direct Artist ID migrated, and the verifier falsely passed because it repeated the same faulty parser.

The stopped state was diagnosed before any retry. The migration and verifier were repaired in source, and the focused V3 test now ratchets the SQL escape shape to prevent recurrence.

A platform branch reset was attempted once and failed inside the Supabase branch-action workflow. It was not retried. The exact three candidate artifacts on the disposable preview were rewound surgically: the one candidate source row, the resolver function, and the preview-only migration-history entry. The preview was independently confirmed back at the 76-migration baseline with fixtures preserved.

The repaired, byte-current candidate then passed:

- six of six fixture provider identities materialized
- Article and Artist evidence flags were correct
- resolver returned six of six requested identities
- anonymous resolver execution: denied
- authenticated resolver execution: denied
- service-role resolver execution: allowed
- permanent read-only verifier: PASS

The candidate `public-content-read` Edge Function was then deployed to the preview as version 76 with its prior JWT setting preserved.

Runtime smoke through the preview Edge Function passed:

- fixture Article endpoint: HTTP 200
- Article response preserved legacy HTML and returned four canonical `videoSources`
- fixture Artist endpoint: HTTP 200
- Artist response returned three canonical Video source descriptors

Supabase security and performance advisors were run after the candidate DDL. No advisor finding references the new resolver. The only findings involving `video.sources` are pre-existing informational notices: RLS enabled with no table policy, consistent with the private authority boundary, and an unrelated native Media foreign-key indexing advisory.

The preview remains intentionally available until the promotion and production smoke gates are complete. Disposable fixtures will disappear with final preview deletion rather than weakening immutable governance to delete them individually.

## Remaining pre-PR gate

Preview authority is sealed. The remaining gate before PR is repository-local verification:

1. focused V1, V2, and V3 Video tests
2. directly affected analytics/public-content checks
3. changed-copy mechanical checks
4. `git diff --check`
5. `npm run build:app`
6. exact changed-scope inspection

## Production impact

No production mutation has occurred from this candidate branch.

Expected promotion requirements after preview and PR acceptance:

- SQL migration: yes
- Edge Function: yes, `public-content-read` only
- Frontend: yes
- `video-public-delivery`: no
- Media mutation: no
- existing published Video mutation: no
- legacy Article HTML rewrite: no
- Registry Artist metadata rewrite: no
