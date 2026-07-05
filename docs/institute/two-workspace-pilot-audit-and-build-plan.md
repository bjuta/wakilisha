# Institute Two-Workspace Pilot: Audit and Build Plan

## Decision

Do not create a new Registry workspace. WAKILISHA Records already exists.

Do not build generic evidence forms for Link, Citation, Chart data, Social post, Contributor memory, or Personal note yet.

Build two pilots first:

1. Level up the existing WAKILISHA Records workspace.
2. Build Playlist as a new production vertical.

These two prove the architecture without wasting time on seven weak workspaces.

## Repo evidence

- `src/services/institute/instituteArticleBridgeService.ts` proves Article is the current true Institute vertical bridge. It creates or fetches a linked article draft, stores it in `institute_work_product_links`, opens the article editor, and submits review packets.
- `supabase/migrations/202607020004_institute_work_product_links.sql` proves `product_type` currently only allows `article`. It is a `text` column with a check constraint, not a Postgres enum.
- `src/services/institute/instituteReviewDeskService.ts` proves Review Desk already has generic work product fields: `linkId`, `productType`, `formatLabel`, `productId`, `productSlug`, and `status`.
- `src/pages/admin/institute/inquiry-interface/WakilishaRecordWorkspace.tsx` proves WAKILISHA Records already exists and supports existing record evidence, missing record suggestions, correction/enrichment notes, record health, rich previews, and snapshots.
- `src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts` proves WAKILISHA Records already searches artists, tracks, releases, labels, genres, articles, authors, and chart families.
- `src/router/config.tsx` proves there is no `/playlists` or `/playlists/:slug` public route today.
- `src/services/chartsIngestion/spotifyFetch.ts` proves Spotify playlist ingestion exists for charts, but it handles playlist URLs, not public track URLs.
- `src/services/registry/provider-adapters/spotify-adapter.ts` is still a skeleton. Track, album, artist, and search support are TODO.
- `supabase/migrations/202606240004_provider_link_schema.sql` proves `registry_track_provider_links` exists and should be reused for provider identity and matching.

## Pilot 1: Level up WAKILISHA Records

Keep the existing workspace.

Add structured modes:

- use existing record
- suggest missing record
- suggest correction
- suggest merge/duplicate
- suggest relationship
- suggest provider/media/credit update

The next build is not search or preview. Those already exist. The next build is structured registry review payloads and Review Desk routing.

Contributors must not mutate registry production tables directly from Institute. Editors and registry reviewers control final action.

## Pilot 2: Build Playlist as a production vertical

Playlist does not exist yet.

Build:

- `wk_playlists`
- `wk_playlist_items`
- `src/services/institute/institutePlaylistBridgeService.ts`
- `src/pages/admin/institute/inquiry-interface/PlaylistWorkspace.tsx`
- public `/playlists`
- public `/playlists/:slug`

Playlist workspace must support:

- selecting existing registry tracks
- attaching artists and releases where useful
- entering public Spotify track URLs
- server-side Spotify track normalization
- matching against `registry_tracks`
- matching against `registry_track_provider_links`
- external-only pending playlist items
- missing track, artist, or release suggestions
- item ordering
- Review Desk submission
- editor-controlled publishing

## Data model notes

`institute_work_product_links.product_type` is text with a check constraint, not an enum.

Later migration should drop and recreate the check constraint to allow:

- `article`
- `playlist`
- `registry_suggestion`
- `registry_correction`
- `registry_merge`
- `registry_relationship`
- `registry_provider_update`

Do not use `ALTER TYPE`.
Do not use `ADD VALUE`.

Suggested playlist tables:

- `wk_playlists`
- `wk_playlist_items`

Suggested `wk_playlist_items` fields:

- `playlist_id`
- `position`
- `registry_track_id`
- `provider_key`
- `provider_track_id`
- `provider_url`
- `title`
- `artist_names`
- `release_title`
- `artwork_url`
- `preview_url`
- `duration_ms`
- `isrc`
- `match_status`
- `match_confidence`
- `normalization_payload`
- `notes`

Do not create a parallel provider identity model. Reuse `registry_track_provider_links`.

## Spotify normalization

Spotify normalization should likely be server-side, probably a Supabase Edge Function, because provider credentials must not be exposed in the browser.

The normalizer should return:

- provider
- provider track ID
- public URL
- canonical track title
- primary artists
- featured artists
- album or release
- duration
- artwork
- ISRC if available
- preview URL if available
- external URL
- raw payload

## Public playlist requirements

Public playlist pages must have:

- `/playlists`
- `/playlists/:slug`
- canonical URL
- title and description
- Open Graph image
- track count
- curator label
- internal links to matched artists
- internal links to matched tracks
- internal links to matched releases
- no private inquiry notes
- no unpublished drafts
- no rejected content

## Review governance

Review packets must include governance equivalent to:

- `contributorCanPublish: false`
- `editorMustReviewBeforePublication: true`
- `publicReleaseAllowedFromInstitute: false`

Review Desk status changes should update linked work product status.

## Non-goals

Do not build yet:

- Citation workspace
- Link workspace
- Social post workspace
- Contributor memory workspace
- Chart data workspace
- generic field renderer
- new Registry workspace

Do not:

- mutate registry directly from Institute
- expose provider credentials client-side
- auto-publish playlist drafts
- create a second provider identity model

## Build phases

1. Docs and architecture confirmation.
2. WAKILISHA Records structured review payloads.
3. Work product link extension.
4. Playlist schema and bridge.
5. Playlist workspace draft UI.
6. Spotify track normalization and registry matching.
7. Public playlist routes and SEO.
8. Review Desk approval and publishing path.

## Acceptance criteria

WAKILISHA Records is accepted when:

- the existing workspace remains the only Registry workspace
- search still covers artists, tracks, releases, labels, genres, articles, authors, and chart families
- existing record evidence still works
- missing record suggestion still works
- correction/enrichment becomes structured
- merge/duplicate suggestion exists
- relationship suggestion exists
- provider/media/credit update suggestion exists
- registry suggestions create review packets
- contributors cannot mutate registry tables directly

Playlist is accepted when:

- `wk_playlists` exists
- `wk_playlist_items` exists
- Institute can create or fetch a linked playlist draft
- linked playlist drafts use `institute_work_product_links`
- Playlist workspace opens from Inquiry
- user can add existing registry tracks
- user can add Spotify public track URLs
- Spotify track URLs normalize server-side
- normalized tracks can match registry tracks or provider links
- user can keep external-only pending items
- user can suggest missing tracks, artists, or releases
- playlist draft can be submitted to Review Desk
- contributors cannot publish
- editors control publishing
- `/playlists` exists
- `/playlists/:slug` exists
- public pages include SEO/share metadata
- public pages link to matched artists, tracks, and releases
- unpublished drafts are not public

## Deployment checklist

- SQL migration needed: Yes, later
- Supabase Edge Function deploy needed: likely Yes for Spotify normalization
- Readdy Finish update needed: No
- Frontend deploy needed: No for this docs-only PR
- PR needed now: Yes, docs-only architecture PR
- Next test: docs review only
