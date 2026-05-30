# WAKILISHA Data Contract for React Migration

## Core principle

The React app must be built around WAKILISHA's data graph, not around prebuilt UI buckets.

The old WordPress app contains public pages, admin tools, and visual templates, but the durable system is the registry graph underneath them.

---

## Canonical entity types

### Artist

Required fields:

- `id`
- `display_name`
- `slug`
- `status`
- `visibility`
- `legacy_wp_post_id`
- `country/origin` where available
- `bio/summary` where available
- `image_url`
- `hero_image_url`
- `created_at`
- `updated_at`

Relationships:

- aliases
- sources
- genres
- tracks
- releases
- related artists
- chart appearances through tracks
- follows
- editorial summaries
- provenance

### Track

Required fields:

- `id`
- `title`
- `normalized_key`
- `slug`
- `status`
- `visibility`
- `isrc`
- `apple_track_id`
- `preview_url`
- `artwork_url`
- `duration_ms`
- `release_id` when canonical release is known
- `created_at`
- `updated_at`

Relationships:

- artists with roles/order
- sources/providers
- chart entries
- releases/tracklists
- stats
- public slug
- provenance

### Release

Required fields:

- `id`
- `title`
- `normalized_key`
- `slug`
- `release_type`
- `status`
- `visibility`
- `release_date`
- `artwork_url`
- `apple_release_id`
- `upc`
- `created_at`
- `updated_at`

Relationships:

- tracks with disc/track order
- artists
- labels
- sources/providers
- charting tracks
- public slug
- provenance

### Label

Required fields:

- `id`
- `name`
- `slug`
- `status`
- `visibility`
- `image_url`
- `summary`
- `created_at`
- `updated_at`

Relationships:

- releases
- artists through releases/tracks
- tracks through releases
- public slug
- stats
- provenance

### Genre

Required fields:

- `id`
- `name`
- `slug`
- `status`
- `visibility`
- `description`
- `image_url`
- `created_at`
- `updated_at`

Relationships:

- artists
- chart discovery routes
- stats
- public pages
- provenance

### Chart series

Required fields:

- `id`
- `slug`
- `title`
- `description`
- `status`
- `visibility`
- `country_scope`
- `frequency`
- `created_at`
- `updated_at`

Relationships:

- editions
- entries through editions
- stats
- snapshots

### Chart edition

Required fields:

- `id`
- `series_id`
- `edition_date`
- `country`
- `status`
- `visibility`
- `title`
- `description`
- `published_at`
- `created_at`
- `updated_at`

Relationships:

- entries
- snapshots
- review issues
- unresolved entities
- audit events

### Chart entry

Required fields:

- `id`
- `edition_id`
- `position`
- `previous_position`
- `movement`
- `raw_title`
- `raw_artist`
- `track_id`
- `resolution_status`
- `resolution_method`
- `created_at`
- `updated_at`

Relationships:

- canonical track
- unresolved entity if not matched
- review issues
- provenance

---

## Route contract

### Public entity detail routes

- Artist: `/artists/:artistSlug/`
- Track: `/tracks/:artistSlug/:trackSlug/`
- Release: `/releases/:artistSlug/:releaseSlug/`
- Label: `/labels/:labelSlug/`
- Genre: `/genres/:genreSlug/`
- Chart series: `/charts/:seriesSlug/`
- Chart edition: `/charts/:seriesSlug/:date/`
- Country chart edition: `/charts/:seriesSlug/:country/:date/`

### Public directories

- `/artists/`
- `/genres/`
- `/labels/`
- `/charts/`
- `/collections/`
- `/guides/`
- `/magazine/`
- `/registry/`

### Not strict parity unless approved

- `/tracks/`
- `/releases/`

The old app exposes track and release detail pages, not public track/release archive pages.

---

## Slug contract

React should use a dedicated `entity_slugs` table.

Fields:

- `id`
- `entity_type`
- `entity_id`
- `slug`
- `full_path`
- `status` — `active`, `redirect`, `retired`
- `is_primary`
- `locked`
- `redirect_to_slug_id`
- `legacy_path`
- `created_at`
- `updated_at`

Rules:

1. One primary active slug per public entity.
2. Historical slugs become redirects, not overwritten strings.
3. Track and release full paths include artist context.
4. Slug resolution must not depend on WordPress post names.
5. Migration should preserve old public paths where possible.

---

## Player metadata contract

Every playable item should expose:

- `track_id`
- `title`
- `artist_display`
- `artwork_url`
- `preview_url`
- `apple_track_id`
- `isrc`
- `duration_ms`
- `source_provider`
- `source_url`
- `release_id`
- `release_title`

Coverage report required after migration:

- tracks with preview URL.
- tracks with Apple track ID.
- tracks with ISRC.
- tracks with artwork.
- tracks with both canonical artist and playable metadata.

---

## Ingestion contract

### Import states

- `uploaded`
- `parsed`
- `normalized`
- `matched`
- `needs_review`
- `approved`
- `published`
- `failed`

### Row resolution states

- `matched_existing_track`
- `created_new_track`
- `linked_to_release_track`
- `unresolved_artist`
- `unresolved_track`
- `duplicate_candidate`
- `ignored`

### Required audit event for any canonical change

- `operation_id`
- `actor_id`
- `entity_type`
- `entity_id`
- `action`
- `before_json`
- `after_json`
- `source`
- `created_at`

---

## Provenance contract

Any imported, inferred, or manually edited registry value should be able to answer:

1. Where did this value come from?
2. Who or what changed it?
3. When was it changed?
4. Was it imported, inferred, or manually verified?
5. What confidence level does the system have?
6. Which public pages depend on it?

---

## Migration acceptance tests

### Entity count tests

For every old source table:

- old row count captured.
- new row count captured.
- skipped rows explained.
- duplicate merges explained.

### Relationship tests

- Track artist counts match or have documented merge reasons.
- Release tracklists match old order where old order exists.
- Chart edition entry counts match exactly.
- Chart entry positions match exactly.
- Label release links match.
- Artist genre links match.

### Route tests

For every known public old URL:

- `200` in React, or
- `301/308` to canonical React URL, or
- documented retirement.

### Player tests

- A chart row can play a preview.
- An artist popular track can play a preview.
- A release tracklist item can play a preview.
- A magazine embedded track row can play a preview.
- Player state stays synchronized across mini/nav/mobile surfaces.
- Apple Music path does not get hijacked by preview fallback.

### Admin tests

- Import a chart file.
- Resolve unmatched rows.
- Publish an edition.
- Create snapshot.
- Refresh materialized stats.
- Edit a track/artist/release.
- View provenance/audit trail.
- Submit and review correction.

---

## What must not happen

- Do not use UI categories as the source of truth.
- Do not create a React page only because a WordPress template exists.
- Do not drop draft/private entities unless explicitly approved.
- Do not turn tracks/releases into public directories under the claim of parity.
- Do not migrate only published data if the admin workflow needs drafts and review queues.
- Do not flatten track, artist, release, and chart data into one denormalized table.
- Do not lose provenance, review state, snapshots, or audit logs.
