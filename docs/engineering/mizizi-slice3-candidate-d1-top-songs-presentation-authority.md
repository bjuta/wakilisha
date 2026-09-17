# MIZIZI Slice 3 Candidate D1: Top Songs Presentation Authority

Status: **LOCAL IMPLEMENTATION CANDIDATE - PREVIEW NOT YET APPLIED**

Programme issue: #962

Exact entry authority:

- merged `main`: `8b45840e9aa142c16021f6dd694eddbb1c14bdae`
- Production project: `pgzizndxdyhqmtyywjmt`
- Production migration head: `20260916210001`

## Why the boundary changed

The initial retirement design proposed keeping editorial Top Songs directly in `registry_entity_relationships` while normalizing new writes. Production evidence disproved that simplification.

At least one current Top Songs row, Savara / Balance, is approved, public-safe, and linked to approved default-retrieval evidence. Treating the entire `popular_track/top_song` family as disposable presentation rows would therefore destroy or distort evidence-backed relationship truth.

D1 separates editorial presentation from the relationship graph instead.

## Production baseline

Read-only audit established:

- 77 distinct active historical `popular_track/top_song` relationship rows;
- 9 Artists represented;
- 27 historical rows missing `source_entity_id`;
- 27 historical rows missing `target_entity_id`;
- zero duplicate Artist/sort-order groups;
- zero duplicate resolved Artist/Track selections;
- four rows across three Artists cannot be safely rebound to exactly one active Track today.

Those four rows are not guessed. They are captured in migration lineage as `needs_review` exceptions and excluded from the live presentation set until identity is explicitly resolved.

## D1 authority

D1 adds a dedicated presentation layer:

- `artist_top_song_curations` is the current editorial exact set;
- `artist_top_song_curation_migration_map` permanently records how every historical relationship row was resolved or quarantined;
- `artist_top_song_curation_events` is the append-only write receipt stream;
- `get_artist_top_songs_v1` serves both authorized Admin callers and service-role public gateways;
- `admin_replace_artist_top_songs_v1` is caller-bound to `manage_registry`, limited to 20 Tracks, duplicate-safe, canonical-ID based, and protected by a stale-state fingerprint.

New selections must already belong to the Artist through active Track credit or active Release discography. Existing migrated selections can be retained even if historical data no longer satisfies that modern admission rule.

## Relationship preservation

The migration reads historical `registry_entity_relationships` only for lineage and backfill. It does not update or delete that table. Evidence links, review decisions, public-safe state, and historical relationship UUIDs remain untouched.

## Runtime convergence

The Admin Artist Top Songs panel moves from `admin-registry-api/top-songs/:slug` to the two typed RPCs and receives canonical `artist.id`.

Both public gateways move their Top Songs reads from relationship-slug lookup to `get_artist_top_songs_v1`, eliminating ambiguous Track-slug selection from presentation.

`admin-registry-api` remains deployed during D1 as rollback authority. Its full source and Production deployment are retired only in D2 after D1 acceptance and caller/traffic proof.

## Deployment classification

- SQL migration needed: **Yes**
- Admin frontend deploy needed: **Yes**
- `public-content-read` Edge deploy needed: **Yes**
- `wakilisha-public-api` Edge deploy needed: **Yes**
- `admin-registry-api` deletion needed in D1: **No**
- Production Finish update needed: **No**
- Production data mutation: **Yes, bounded presentation backfill only; relationship truth is read-only**
