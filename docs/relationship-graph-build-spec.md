# WAKILISHA Relationship Graph Build Spec

## Decision

The next data-repair task is the relationship graph.

The current Supabase table `wk_entity_relationships` is empty, but the relationship evidence is not lost. It exists in the exported old registry rows and chart payloads. The React app should not guess relationships from page layout. It should build an explicit graph first.

## Why this matters

The relationship graph is what turns WAKILISHA from a set of flat tables into a cultural discovery system.

Without it, React pages can show individual records, but they cannot reliably answer questions like:

- Which artists made this track?
- Which releases contain this track?
- Which label released this project?
- Which genres is this artist connected to?
- Which chart appearances does this song have?
- Which artwork belongs to which entity?
- Which old URLs should resolve to this entity?
- Which entities are duplicates or need human review?

## Source tables

### Primary source

`wk_old_registry_rows`

This contains preserved rows from old WordPress registry tables. The important embedded source tables are:

- old track to artist links
- old release to track links
- old artist to genre links
- old entity slugs
- old chart edition items
- old track source rows
- old release source rows
- old release shell tracks
- old release shell artists

### Supporting sources

- `wk_tracks`
- `wk_releases`
- `wk_labels`
- `wk_genres`
- `wk_chart_entries`
- `wk_chart_editions`
- `wk_registry_entities`
- `wk_media_assets`
- `wk_old_primary_slugs`
- `wk_wordpress_items`

## Target table: `entity_relationships`

The graph table should be general enough to support public pages, search, recommendations, admin review, and future culture verticals.

Recommended columns:

```sql
id uuid primary key default gen_random_uuid(),
source_entity_type text not null,
source_entity_id text not null,
relationship_type text not null,
target_entity_type text not null,
target_entity_id text not null,
position integer,
role text,
confidence numeric,
source text,
source_ref text,
source_payload jsonb,
needs_review boolean default false,
review_reason text,
created_at timestamptz default now(),
updated_at timestamptz default now()
```

Recommended unique key:

```sql
unique (
  source_entity_type,
  source_entity_id,
  relationship_type,
  target_entity_type,
  target_entity_id,
  coalesce(role, ''),
  coalesce(position, -1)
)
```

## Relationship types to build first

### 1. `track_artist`

Connects tracks to credited artists.

Direction:

```text
track -> artist
```

Evidence priority:

1. Old track artist relationship rows.
2. Track table `artist_slug` / `artist_name`.
3. Chart entry `artist_slug` / `artist_name`.
4. Provider payload artists.

Output should also populate a direct `track_artists` table for fast page rendering.

Review flags:

- artist string contains comma, ampersand, x, feat, ft, with, or multiple separators.
- artist slug does not match a canonical artist.
- same track has conflicting primary artist evidence.

### 2. `release_track`

Connects releases to their tracklists.

Direction:

```text
release -> track
```

Evidence priority:

1. Old release track relationship rows.
2. Old release shell track rows.
3. Release `tracklist` JSON.
4. Release provider payloads.
5. Track table release fields, if present.

Output should also populate a direct `release_tracks` table.

Review flags:

- track title in release tracklist cannot be matched to a canonical track.
- same release has multiple conflicting tracklists.
- release is duplicate suspected or rejected.

### 3. `artist_genre`

Connects artists to genres.

Direction:

```text
artist -> genre
```

Evidence priority:

1. Old artist genre rows.
2. Artist metadata.
3. Chart/genre page context, if reliable.

Output should also populate a direct `artist_genres` table.

Review flags:

- genre slug does not exist.
- artist slug does not exist.
- inferred genre is too weak.

### 4. `chart_entry_track`

Connects chart entries to canonical tracks.

Direction:

```text
chart_entry -> track
```

Evidence priority:

1. Existing `track_slug` on chart entry.
2. Old edition item relationship.
3. ISRC match.
4. Provider track id match.
5. Title plus artist normalized match.

Review flags:

- chart entry title/artist has multiple possible tracks.
- track slug missing.
- ISRC conflict.

### 5. `release_label`

Connects releases to labels.

Direction:

```text
release -> label
```

Evidence priority:

1. Release table label slug.
2. Old release label rows if present.
3. Release provider payload.
4. Track label fields.

Review flags:

- label slug does not exist.
- conflicting label values across sources.

### 6. `entity_media`

Connects entities to media assets.

Direction:

```text
entity -> media_asset
```

Evidence priority:

1. `wk_media_assets.entity_type` and `entity_slug`.
2. Entity direct image fields.
3. Artwork fields in track/release/chart entries.

Review flags:

- media entity slug does not resolve.
- media URL appears broken or external-only.

### 7. `redirects_to`

Connects old slugs/routes to canonical entities.

Direction:

```text
old_slug -> canonical_entity
```

Evidence priority:

1. `wk_old_primary_slugs`.
2. Old entity slug rows.
3. Registry hrefs.
4. WordPress item permalinks.

Review flags:

- old slug maps to missing entity.
- two active entities want the same route.
- old release slug has no current release.

### 8. `duplicate_candidate`

Connects possible duplicates for human review.

Direction:

```text
entity -> entity
```

Evidence priority:

1. Release status `duplicate_suspected`.
2. Same normalized title + artist + release date.
3. Same ISRC/provider ID across different track IDs.
4. Old quality/duplicate rows if present.

Review flags:

- always true; duplicates should not be auto-merged without review.

## Build order

1. Canonical entity index.
2. Slug resolver.
3. Track to artist graph.
4. Release to track graph.
5. Artist to genre graph.
6. Chart entry to track graph.
7. Release to label graph.
8. Entity to media graph.
9. Redirect graph.
10. Duplicate candidate graph.

## Matching rules

### Canonical identity priority

When linking rows, resolve in this order:

1. Direct ID match.
2. Entity type + exact slug.
3. Old slug map.
4. Provider ID or ISRC.
5. Normalized title/name plus context.
6. Human review.

### Normalization rules

Use normalized matching only as a fallback.

Normalize by:

- lowercase
- trim whitespace
- remove duplicate spaces
- remove punctuation only for matching key, not display text
- preserve accents in display text
- strip common featuring tokens only for candidate generation, not final credit

### Combined artist caution

Do not automatically split artist records into permanent canonical artists unless the split entities already exist or confidence is high.

Flag combined artist patterns for review when names contain:

- comma
- ampersand
- `feat.`
- `ft.`
- `featuring`
- `with`
- `x`
- `/`

## Reports required

### `graph-coverage.json`

Should show:

- total tracks
- tracks with artists
- tracks without artists
- releases with tracklists
- releases without tracklists
- artists with genres
- chart entries linked to tracks
- media assets linked to entities
- old routes resolved
- old routes unresolved

### `relationship-review-queue.csv`

Columns:

- entity type
- entity id
- entity label
- proposed relationship type
- proposed target
- reason
- source
- confidence
- recommended action

### `relationship-build-summary.md`

Human-readable summary for founder/dev review.

## Acceptance criteria

The graph phase is complete when:

- `entity_relationships` is no longer empty.
- every track has at least one artist relationship or a review reason.
- every release has tracklist relationships or a review reason.
- every old artist-genre link is restored or flagged.
- every chart entry links to a canonical track or a review reason.
- every media asset is linked to an entity or flagged.
- every old route is active, redirected, retired, or flagged.
- duplicate candidates are flagged, not silently merged.
- React page payloads can be generated from graph queries.

## React impact

After this graph exists, React pages can be built cleanly:

- Artist pages can query tracks, releases, genres, chart appearances, and media.
- Track pages can query artists, releases, chart history, playback, and artwork.
- Release pages can query tracklists, artists, labels, artwork, and review status.
- Label pages can query releases and related artists/tracks.
- Genre pages can query artists, tracks, charts, and editorial context.
- Chart pages can query entries and canonical tracks without relying on raw chart strings.

This is the foundation for WAKILISHA feeling unified in React rather than becoming another collection of disconnected pages.
