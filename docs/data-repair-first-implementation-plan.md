# WAKILISHA Data Repair First

## Decision

The next phase is data repair before React UI work.

The Supabase export proves that the WAKILISHA data exists, but the current tables are not yet a clean React-ready graph. The relationship table is empty, while the old relationship evidence is preserved in the raw registry export.

The React app should not be built directly on top of the flat imported tables. It should be built after a repair layer creates clean relationships, route maps, playback metadata, and content classifications.

## What must be repaired first

1. Track to artist relationships.
2. Release to track relationships.
3. Artist to genre relationships.
4. Chart entry to canonical track relationships.
5. Media to entity relationships.
6. Old public slugs to new React routes.
7. Preview and playback metadata.
8. Article versus page surface classification.
9. Duplicate release and combined artist review queues.

## Minimum clean tables to produce

### `entity_slugs`

Preserves old public URLs and maps them to canonical React routes.

Needed fields:

- entity type
- entity id
- slug
- full path
- status: active, redirect, retired, duplicate
- redirect target where relevant
- old path
- source

### `entity_relationships`

Universal graph table for connections between entities.

Needed relationship types:

- track artist
- release track
- release artist
- release label
- artist genre
- chart entry track
- entity media
- redirect target
- duplicate candidate

### `track_artists`

Fast direct table for track credits.

Needed fields:

- track id
- artist id
- artist name snapshot
- role
- position
- source
- needs review

### `release_tracks`

Fast direct table for release tracklists.

Needed fields:

- release id
- track id
- disc number
- track number
- title snapshot
- artist snapshot
- source
- needs review

### `artist_genres`

Fast direct table for genre pages and artist profiles.

Needed fields:

- artist id
- genre id
- source
- confidence
- needs review

### `track_playback_sources`

Clean player data table.

Needed fields:

- track id
- provider
- provider track id
- ISRC
- preview URL
- duration
- artwork URL
- source reference
- confidence

### `content_route_classification`

Prevents app shell pages from becoming fake editorial articles.

Needed classifications:

- article
- guide
- surface page
- app mount
- taxonomy shell
- utility page
- commerce page
- retire

## Repair jobs

### Job 1: Detect and load exports

The script should identify each CSV by its columns, not by the downloaded filename.

Success: all uploaded CSVs are recognized and counted.

### Job 2: Build canonical entity index

Create lookup maps for tracks, artists, releases, labels, genres, and registry entities.

Success: every main entity has a canonical lookup row or a review reason.

### Job 3: Build slug and redirect map

Use old slugs, registry hrefs, and WordPress items to produce active routes, redirects, retired routes, and conflicts.

Success: every known old public route is accounted for.

### Job 4: Rebuild track artists

Use old relationship rows, track fields, chart entry fields, and provider payloads.

Success: every track has at least one artist relationship or a review reason.

### Job 5: Rebuild release tracklists

Use old release track rows, release shell rows, release table tracklists, and provider payloads.

Success: every release has a tracklist or a review reason.

### Job 6: Rebuild artist genres

Use old artist genre relationship rows and the genre table.

Success: old artist-genre links are restored or flagged.

### Job 7: Extract playback metadata

Do not trust the direct preview field alone. Extract clean preview and provider data from nested payloads and old source rows.

Success: the player can query one clean playback table.

### Job 8: Classify content and page surfaces

Separate real articles and guides from app shells, utility pages, taxonomy shells, and commerce pages.

Success: magazine content does not accidentally include app mount pages.

### Job 9: Produce reports

Required reports:

- graph coverage
- route coverage
- playback coverage
- content classification
- review queue
- migration summary

## Review queue categories

The repair package should flag risky cases instead of guessing silently.

Flag:

1. Combined artist names that appear to contain multiple artists.
2. Duplicate release candidates.
3. Old release slugs that do not map cleanly to current releases.
4. Tracks without playable metadata.
5. Tracks without artist relationships.
6. Releases without tracklists.
7. Labels without useful metadata.
8. Genres without descriptions.
9. Page shells that might be misclassified as articles.
10. Route conflicts.

## Phase acceptance criteria

Data repair is complete when:

- all full CSV exports load repeatedly.
- every main entity has a canonical identity.
- every old public route is active, redirected, retired, or flagged.
- the empty relationship graph has been rebuilt.
- track artist links exist.
- release tracklists exist.
- artist genre links exist.
- player metadata is clean enough for the global player.
- article/page/surface classification is complete.
- a human review queue exists.
- React page payloads can be generated from repaired data.

## Migration stance

Do not start by designing pages.

Start by making the WAKILISHA data trustworthy.

Once the graph is repaired, the React app can safely build charts, artist pages, track pages, release pages, label pages, genre pages, magazine, guides, registry canvas, the player, corrections, and Admin Studio.
