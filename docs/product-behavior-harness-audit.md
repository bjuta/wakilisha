# WAKILISHA Product Behavior Harness Audit

This document records the result of building a local product-behavior harness from the uploaded WordPress plugin and full Supabase CSV export.

## What was built

A static, clickable harness was created from:

- WordPress plugin: `wakilisha-v2.0.199`
- Supabase full CSV export: `Archive 2.zip`

The harness does not install WordPress. It reconstructs user-facing product behavior using the real exported WAKILISHA data and the plugin's templates/assets/interaction patterns.

## Reconstructed surfaces

The harness includes:

- Home/system overview
- Charts index
- Chart series page
- Chart edition timeline
- Chart ranked rows with movement and detail drawers
- Global player shell
- Artists directory
- Artist detail pages
- Tracks audit route and track detail pages
- Releases directory
- Release detail pages with tracklists
- Labels directory
- Label detail pages
- Genres directory
- Genre detail pages
- Registry canvas / graph audit
- Magazine/content classifier view
- Guides
- Play Lab behavior simulation
- Top 10 local picker
- Corrections surface
- Admin Studio map

## Real data loaded into the harness

- Tracks: 5,549
- Artists: 1,712 registry artist entities
- Releases: 169
- Labels: 232
- Genres: 17
- Chart series: 5
- Chart editions: 87
- Chart entries: 6,332
- Media assets: 1,929
- Old registry rows: 42,162
- WordPress items: 1,867

## Rebuilt relationship evidence

The exported `wk_entity_relationships` table was empty, so the harness rebuilt relationship evidence from `wk_old_registry_rows`:

- Track-artist relationships: 7,295
- Release-track relationships: 4,293
- Artist-genre relationships: 131

## Major behavior findings

### 1. The player is a global product primitive

Every surface should talk to one shared player provider: chart rows, artist tracks, release tracklists, track detail pages, magazine music embeds, and registry cards.

The direct `preview_url` columns are unreliable. Preview metadata must be extracted from nested payloads and old source rows into a clean playback table.

### 2. Charts are edition-led historical records

Chart rows should preserve rank, previous rank, movement, title, artist, artwork, resolved state, and player handoff. Repeated appearances across editions are historical chart memory, not duplicate content to be collapsed away.

### 3. Artist pages are aggregation pages

Artist pages should aggregate tracks, releases, chart appearances, genres, media, related entities, and editorial profile data.

Some artist rows are combined artist strings and require review before becoming canonical artist pages.

### 4. Releases carry operational review state

Release statuses include canonicalized, duplicate suspected, review needed, and rejected. React should preserve these states and not flatten all releases into a simple public list.

### 5. Labels and genres need editorial enrichment

Labels mostly arrive as normalized names/slugs. Genres exist but many descriptions are empty. React can render parity pages now, but product-quality pages need enrichment and graph repair.

### 6. Magazine/content rows need classification

The export contains true editorial posts and many page/app surfaces. React must classify content before building magazine and page routes, otherwise shell pages may become fake articles.

### 7. Admin Studio is mandatory for parity

A React public app without an Admin Studio would not be true parity. WAKILISHA needs tools for ingest, review, canonicalization, preview recovery, slug management, graph repair, reports, analytics, magazine curation, and corrections.

## React migration rule confirmed

Do not rebuild WordPress in React.

Preserve:

- registry entities
- chart history
- player behavior
- route expectations
- editorial surfaces
- corrections/governance
- provenance/audit/review state
- admin workflows

Replace:

- CPT shells
- shortcodes
- rewrite/query-var routing
- template interception
- virtual WordPress posts
- footer injection
- WordPress AJAX/admin-post APIs
- SEO plugin filters as metadata source

## Next implementation recommendation

Before public UI work, build a data repair package that:

1. Imports the CSVs into staging tables.
2. Builds clean entity slugs and redirect map.
3. Rebuilds track-artist relationships.
4. Rebuilds release-track relationships.
5. Rebuilds artist-genre relationships.
6. Extracts preview/player metadata.
7. Classifies articles vs page/app surfaces.
8. Produces a route coverage report.
9. Produces a graph coverage report.
10. Produces a public page payload contract for React.
