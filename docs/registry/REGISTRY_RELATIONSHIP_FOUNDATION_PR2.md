# Registry Relationship Foundation PR2

## Purpose

Strengthen `registry_entity_relationships` so it can become WAKILISHA's reviewed flexible cultural graph without breaking current readers, writers, or the 6,468 existing rows.

## Current consumer audit

The table is currently used by:

- public related-entity reads
- Registry admin pages
- Institute record search
- public APIs
- Registry enrichment review
- artist relationship backfills
- top-song backfills
- scraper-derived collaboration writes
- cleanup functions

Current consumers explicitly select or insert named legacy columns. They do not depend on `select *` response shape for core behavior. PR2 therefore uses an additive migration.

## Current data profile

Before PR2:

- 6,468 total rows
- 6,332 `entity_media` rows
- 50 `popular_track` rows
- 35 `featured_on` rows
- 32 `features` rows
- 19 `collaboration` rows
- all rows use lifecycle status `active`
- 15 unresolved source artist slugs
- 8 unresolved target artist slugs
- no unresolved target tracks
- no unresolved media targets

Typed Registry joins remain authoritative for structural relationships:

- `registry_track_artists`
- `registry_release_artists`
- `registry_release_tracks`
- `registry_artist_genres`

## Migration strategy

PR2 is additive.

It adds:

- canonical source entity UUID
- canonical target entity UUID
- plain-language reason
- review status
- public-safe state
- validity period
- reviewer fields
- review note
- status reason
- supersession link
- creator and updater fields

It safely backfills canonical IDs for:

- artist
- track
- release
- label
- genre

It does not:

- delete rows
- rename legacy columns
- change existing lifecycle statuses
- mark legacy rows approved
- mark legacy rows public-safe
- drop existing indexes
- modify public APIs
- modify Edge Functions
- modify frontend code

## Why IDs are nullable

The table currently contains entity types that do not yet share one canonical UUID contract, including chart entries and media assets. UUID fields therefore remain nullable during the transition.

Slugs remain available for compatibility and human readability.

A later Registry entity-index PR will provide a stable cross-domain identity layer for people, places, scenes, institutions, events, concepts, chart objects, and media objects.

## Review model

Lifecycle and review are intentionally separate.

### Lifecycle status

Existing `relationship_status` continues to describe whether the row is active, draft, awaiting repair, or archived.

### Review status

New `review_status` describes institutional judgment:

- `unreviewed`
- `pending_review`
- `approved`
- `rejected`
- `disputed`
- `superseded`

Legacy rows remain `unreviewed` after migration.

Public use requires all of:

- `relationship_status = 'active'`
- `review_status = 'approved'`
- `public_safe = true`

No current row is silently promoted.

## Index decision

Production currently contains several overlapping unique indexes created by past import and scraper work.

PR2 does not drop them.

Index cleanup is deferred until every writer has been exercised against the new schema and duplicate enforcement has been compared on real data.

PR2 adds only narrow indexes for:

- canonical source ID
- canonical target ID
- review queue
- approved public-safe relationships
- supersession lookup

## Verification SQL

Run after applying the migration.

```sql
-- 1. Row preservation
select count(*) as relationship_rows
from public.registry_entity_relationships;

-- Expected at the audited baseline: 6468.
-- A higher count is acceptable if legitimate writes occurred after the audit.
-- A lower count is a failure.

-- 2. New columns exist
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'registry_entity_relationships'
  and column_name in (
    'source_entity_id',
    'target_entity_id',
    'plain_reason',
    'review_status',
    'public_safe',
    'valid_from',
    'valid_to',
    'reviewed_by',
    'reviewed_at',
    'review_note',
    'status_reason',
    'superseded_by_relationship_id',
    'created_by',
    'updated_by'
  )
order by column_name;

-- 3. No legacy row was silently approved or made public-safe
select
  count(*) filter (where review_status = 'approved') as approved_rows,
  count(*) filter (where public_safe) as public_safe_rows
from public.registry_entity_relationships;

-- Expected immediately after migration: 0 and 0 unless a reviewed write happened later.

-- 4. Canonical ID coverage
select
  source_entity_type,
  count(*) as rows,
  count(source_entity_id) as rows_with_source_id
from public.registry_entity_relationships
group by source_entity_type
order by rows desc;

select
  target_entity_type,
  count(*) as rows,
  count(target_entity_id) as rows_with_target_id
from public.registry_entity_relationships
group by target_entity_type
order by rows desc;

-- 5. Unresolved artist slugs stay visible for repair
select
  count(*) filter (
    where source_entity_type = 'artist'
      and source_entity_id is null
  ) as unresolved_source_artists,
  count(*) filter (
    where target_entity_type = 'artist'
      and target_entity_id is null
  ) as unresolved_target_artists
from public.registry_entity_relationships;

-- 6. Public-safe invariant
select count(*) as invalid_public_rows
from public.registry_entity_relationships
where public_safe = true
  and (
    review_status <> 'approved'
    or relationship_status <> 'active'
  );

-- Expected: 0.

-- 7. Supersession invariant
select count(*) as invalid_superseded_rows
from public.registry_entity_relationships
where review_status = 'superseded'
  and superseded_by_relationship_id is null;

-- Expected: 0.

-- 8. Existing relationship distribution remains intact
select relationship_type, count(*)
from public.registry_entity_relationships
group by relationship_type
order by count(*) desc;
```

## Rollback plan

PR2 does not provide an automatic destructive rollback because dropping populated columns would erase any review work added after deployment.

If the migration must be reversed before any new fields are used:

1. confirm all new columns remain at their migration defaults
2. drop only the five PR2 indexes
3. drop PR2 constraints
4. drop the added columns

Once review data exists, rollback means forward-migrating consumers, not deleting institutional history.

## Manual product checks after deployment

- Artist pages still load related entities.
- Genre search still resolves related artists.
- Registry artist, track, release, and genre admin pages still load.
- Institute Registry search still works.
- Public content gateway still returns Registry records.
- Public API still returns Registry relationships.
- Existing backfill functions can detect and insert legacy-shaped rows.
- New rows receive `review_status = 'unreviewed'` and `public_safe = false` by default.

## Deferred work

Not included in PR2:

- evidence tables
- relationship-evidence links
- controlled relationship vocabulary table
- review UI
- public display of reviewed relationships
- unresolved-slug repair
- duplicate index removal
- Registry entity index
- embeddings and retrieval
