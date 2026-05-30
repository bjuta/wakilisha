# WAKILISHA WordPress Plugin Audit — v2.0.199

## Executive read

The old WAKILISHA plugin is not simply a charts plugin. It is a WordPress-contained cultural data platform. It mixes product layers that should survive the React migration with WordPress-specific mounting strategies that should be left behind.

The durable product layers are registry data, chart ingestion and canonicalization, public discovery surfaces, the global player system, editorial/magazine/guides surfaces, audience/follow systems, analytics, corrections, reports, and governance.

The fragile WordPress layers are CPT surface shells, shortcode-mounted pages, rewrite/query-var routing, template interception, virtual `WP_Post` objects, `admin-post.php` and `wp_ajax_*` handlers acting as app APIs, global footer/player injection, SEO plugin filters, dbDelta migrations, and admin-init repair side effects.

React should preserve the durable model and replace the WordPress transport layer with explicit routes, APIs, jobs, and database migrations.

---

## Plugin structure found

### Entry point

`wakilisha-charts-v1.php`

Declared plugin metadata:

- Plugin Name: `WAKILISHA Charts`
- Description: cultural infrastructure for WAKILISHA, beginning with music through charts, registry, artist files, releases, signals, editorial surfaces, and public archive routes.
- Version: `2.0.199`

### Registry modules

The entry file loads these durable modules:

- `registry-browser.php` — admin registry browser, entity tabs, drawers, merge search, editable forms, preview manual review queue, dependency reporting.
- `registry-schema.php` — schema audit and registry contract documentation.
- `registry-graph.php` — entity relationships and repair queue.
- `registry-provenance.php` — field provenance, registry events, audit events.
- `registry-snapshots.php` — chart edition snapshots and integrity checks.
- `registry-release-intelligence.php` — release/tracklist intelligence helpers.
- `registry-jobs.php` — background-style registry jobs, queue, logs, runner.
- `registry-job-batch-status.php` — grouped batch job UI.
- `registry-quality.php` — quality scores and duplicate candidate detection.
- `registry-stats.php` — materialized stats for artists, tracks, releases, genres, labels, chart series.
- `registry-search-api.php` — public/admin search API and entity API projection.
- `registry-ui.php` — shared registry UI components.
- `registry-public-pages.php` — public virtual pages for tracks, releases, labels.
- `registry-slugs.php` — canonical public slugs, lifecycle, URL generation, lookup.
- `registry-editorial.php` — editorial summaries and prompts.
- `registry-reports.php` — registry reports, exports, partner feeds.
- `registry-governance.php` — corrections, capability governance, recovery snapshots.
- `registry-navbar.php` — global navbar/menu rendering and settings.
- `registry-canvas-public.php` — public `/registry/` infinite/graph canvas API and page.
- `registry-woo.php` — WooCommerce visual/checkout integrations.
- `registry-analytics.php` — event tracking, newsletter analytics, follow/search/music dashboards.
- `audience-registry-admin.php` — audience/subscriber analytics and CRM export.
- `registry-user-graph.php` — follows, feed, identity snapshots, recommendations.

### Templates

Public discovery/archive routes:

- `archive-chart.php`
- `archive-series.php`
- `archive-artist.php`
- `archive-genre.php`
- `archive-label.php`
- `archive-collection.php`

Public detail routes:

- `single-chart.php`
- `single-series.php`
- `single-artist.php`
- `single-genre.php`
- `single-registry-entity.php`
- `single-collection.php`

App/surface routes:

- `play.php`
- `top10.php`
- `magazine.php`
- `magazine-section-editor.php`
- `page-registry.php`
- `public-registry-canvas.php`

Editorial/content routes:

- `guides-index.php`
- `guide-in-minor-keys.php`
- `guide-dakar-biennale-2026.php`
- `guide-kenyan-literary-scene.php`
- `universal-content-shell.php`
- `universal-taxonomy-shell.php`

Utility/account routes:

- `auth.php`
- `profile.php`
- `public-profile.php`
- `settings.php`
- `corrections.php`
- `methodology.php`
- `search.php`
- `about.php`
- `contacts.php`
- `faq.php`
- `privacy.php`

Commerce routes:

- `shop.php`
- `cart.php`
- `checkout.php`
- `order-received.php`
- `single-product.php`

### Assets

Important assets include:

- `wkcharts.js` — global frontend behavior, theme, modals, interactions, player, Apple Music bridge, preview audio bridge, share behavior, search, mobile and surface synchronization.
- `wkcharts.css` — broad global styling for plugin-controlled pages.
- `wkcharts-mobile.js`, `wkcharts-mobile.css`, `wkcharts-mobile-system.css` — mobile player/layout behavior.
- `wk-registry-canvas-public.js`, `wk-registry-canvas-public.css` — public registry canvas.
- Logos, icons, momentum badges, discover hero fallbacks, and guide media.

---

## Public route inventory

### Canonical public routes to preserve

| Route | Old mechanism | React route target | Notes |
|---|---|---|---|
| `/` | WordPress/front-page and magazine overrides | Home/Magazine landing | Choose one explicit React home route. |
| `/magazine/` | CPT `wk_magazine_surface` + template | Magazine index | Configurable magazine sections/search/queries. |
| `/charts/` | Chart archive template | Charts index | Public chart discovery and archive cards. |
| `/charts/discover/` | Rewrite query var | Chart discovery hub | Should become a real route. |
| `/charts/discover/:slug/` | Rewrite query var | Chart discovery segment | Segment pages. |
| `/charts/:series/` | Rewrite query var | Chart series page | Show series overview/latest/past editions. |
| `/charts/:series/:country/` | Rewrite query var | Country-filtered chart series | Preserve if public URLs exist. |
| `/charts/:series/:date/` | Rewrite query var | Chart edition | Canonical dated edition route. |
| `/charts/:series/:country/:date/` | Rewrite query var | Country-specific edition | Preserve if published URLs exist. |
| `/artists/` | `wakilisha_artist` archive | Artists directory | Public archive. |
| `/artists/:slug/` | Custom query var `wk_artist_slug` | Artist detail | Artist post + registry profile data. |
| `/genres/` | CPT `wk_genre_page` archive | Genres directory | Public archive. |
| `/genres/:slug/` | CPT or registry-backed page | Genre detail | Use canonical genre table/slug in React. |
| `/labels/` | CPT `wk_labels_surface` shell | Labels directory | Public directory. |
| `/labels/:slug/` | Public entity rewrite | Label detail | Registry-backed virtual entity. |
| `/tracks/:artistSlug/:trackSlug/` | Public entity rewrite | Track detail | Registry-backed; no old public `/tracks/` directory. |
| `/releases/:artistSlug/:releaseSlug/` | Public entity rewrite | Release detail | Registry-backed; no old public `/releases/` directory. |
| `/registry/` | Registry canvas rewrite/template | Registry canvas | Infinite/discovery canvas across entity types. |
| `/collections/` | Rewrite query var | Collections index | Preserve if data exists. |
| `/collections/:slug/` | Rewrite query var | Collection detail | Preserve. |
| `/play/` | CPT shell + template | Play surface | Global music player/lab surface. |
| `/play/app/` | Query var app route | Play app | Consider merging unless URLs require both. |
| `/my-top-10/` | CPT shell + token query | Top 10 draft/create | Tokenized list behavior. |
| `/my-top-10/:token/` | Rewrite token | Top 10 list | Preserve token sharing. |
| `/guides/` | CPT archive `wk_field_guide` | Guides index | Field guides as editorial products. |
| `/guides/:slug/` | CPT single + special templates | Guide detail | Some guides have bespoke layouts/media. |
| `/methodology/` | CPT shell | Methodology page | Public trust page. |
| `/methodology/app/` | Query var | Methodology app | Decide if this remains separate. |
| `/corrections/` | CPT shell | Corrections hub | Public correction submission. |
| `/corrections/submitted/` | Rewrite state | Correction submitted state | Preserve. |
| `/corrections/:type/:ref/` | Rewrite type/ref | Entity-specific correction | Preserve for tracks, releases, labels, artists. |
| `/settings/` | CPT shell | Settings | Account-gated. |
| `/profile/` | CPT shell | Profile | Account-gated. |
| `/@username/` | Public profile rewrite | Public profile | Preserve username routes. |
| `/newsletter/mm/dd/yyyy/key/` | Rewrite to newsletter web view | Newsletter issue view | Preserve or redirect. |
| `/shop/`, `/cart/`, `/checkout/`, `/order-received/` | WooCommerce templates | Commerce routes | Decide whether commerce stays in React. |

### Routes intentionally not public in old site

- `/tracks/` is not a public archive/directory in the old app.
- `/releases/` is not a public archive/directory in the old app.

React can still build beautiful internal/admin entity browsers for tracks and releases, but public directory pages would be a product decision, not strict parity.

---

## Data model inventory

The plugin uses the prefix `wp_wkcharts_` conceptually through `$wpdb->prefix . 'wkcharts_'`. React/Postgres should drop the WordPress prefix and use explicit snake-case table names.

### Core canonical tables

- `charts`
- `editions`
- `edition_items`
- `chart_entry_links`
- `tracks`
- `track_sources`
- `track_artists`
- `track_stats`
- `artists`
- `artist_aliases`
- `artist_sources`
- `artist_profiles`
- `artist_genres`
- `artist_relations`
- `artist_track_stats`
- `artist_summary_stats`
- `artist_directory_stats`
- `genres`
- `labels`
- `release_labels`
- `releases`
- `release_sources`
- `release_tracks`
- `release_admin_history`
- `release_shells`
- `release_shell_tracks`
- `release_shell_artists`
- `collections`
- `collection_items`
- `collection_directory_stats`
- `top10_lists`
- `top10_items`
- `review_issues`
- `unresolved_entities`
- `audit_log`
- `ingest_runs`

### Registry trust/infrastructure tables

- `field_provenance`
- `registry_events`
- `registry_audit_events`
- `registry_quality_scores`
- `registry_duplicate_candidates`
- `entity_relationships`
- `relationship_repair_queue`
- `relationship_sync_runs`
- `edition_snapshots`
- `edition_snapshot_items`
- `snapshot_integrity_checks`
- `snapshot_repair_log`
- `registry_jobs`
- `registry_job_logs`
- `registry_reports`
- `registry_report_exports`
- `registry_partner_feeds`
- `editorial_summaries`
- `editorial_summary_versions`
- `editorial_prompts`
- materialized stat tables for artists, tracks, releases, genres, labels, chart series.

### Audience, analytics, user graph

- `subscribers`
- `optins`
- `subscriber_events`
- `newsletter_issues`
- analytics event table
- newsletter stats table
- `user_entity_follows`
- `user_feed_items`
- `user_recommendations`
- `user_identity_snapshots`

### External integration/experimental tables

- ACR/airplay: `airplay_projects`, `airplay_sources`, `airplay_detections`, `airplay_evidence`.
- Google Search Console/content intelligence: `gsc_import_runs`, `gsc_query_rows`, `gsc_artist_matches`, `artist_trend_scores`, `editorial_opportunities`, `content_ideas`.

---

## Entity relationships React must understand

### Track

A track can connect to artists through `track_artists`, chart appearances through `edition_items` and `chart_entry_links`, provider rows through `track_sources`, releases through `release_tracks`, stats, public slug, preview/player metadata, provenance, and audit events.

### Artist

An artist connects to aliases, sources, artist profile metadata, genres, tracks, releases, related artists, summary/directory stats, public post in the old system, follows, editorial summaries, and provenance.

### Release

A release connects to tracks through `release_tracks`, artists through sources/shells/inferred primary artist and tracklist roles, labels through `release_labels`, providers through `release_sources`, tracklist canonicalization history, and public slug.

### Label

A label connects to releases through `release_labels`, public label pages, aggregate artist/track/release counts, and source/provider metadata where available.

### Genre

A genre connects to artists through `artist_genres`, public genre routes, materialized stats, chart discovery, and editorial route logic.

### Chart edition

A chart edition connects to chart series, date/country/status, edition items, canonical tracks through `chart_entry_links`, snapshots, unresolved entities, review issues, and audit events.

---

## Ingestion and canonicalization flow

The plugin’s ingestion flow is a multi-stage registry reconciliation system.

Old flow:

1. Admin imports chart data through Ingest Studio.
2. Raw rows become chart editions and edition items.
3. Each row is matched to a canonical track if possible.
4. Unmatched rows become unresolved entities.
5. Resolved items get `chart_entry_links` to canonical tracks.
6. Tracks connect to artists through `track_artists`.
7. Releases are backfilled or canonicalized through release shells, release sources, release tracks, and release labels.
8. Review issues are created for uncertain matches, duplicates, missing previews, missing release links, or canonicalization gaps.
9. Snapshots capture published chart state and check integrity.
10. Materialized stats are refreshed.
11. Provenance, audit events, and quality scores record trust state.
12. Public pages read the canonical registry, not raw ingest rows.

React version should become:

1. `staging_chart_imports`
2. `staging_chart_rows`
3. deterministic normalizer
4. match candidate generation
5. human review queue
6. canonical entity upsert transaction
7. chart edition publish transaction
8. snapshot creation
9. provenance/audit events
10. stat refresh job
11. search index refresh
12. public route availability check

---

## Player behavior to preserve

The old player is one of the most important product behaviors.

Observed behavior from code:

- One global shared player shell rendered in the footer.
- Many surfaces launch playback: preview buttons, entity mini players, chart rows, magazine play rows, release embeds, track cards, label preview buttons, and buttons with `data-preview-url`, `data-wk-preview-url`, `data-apple-track-id`, `data-track-id`, or `data-isrc`.
- Preview audio uses a canonical shared audio element when available, with fallback audio only before the canonical player boots.
- Apple Music is treated as an upgrade path for connected users with a developer token and catalog authorization.
- Tracks may resolve Apple catalog IDs through ISRC or title/artist search.
- The player distinguishes preview mode from Apple/full-track mode and prevents preview audio from stealing ownership when Apple playback is intended.
- The player syncs title, artist, artwork, mini/nav/mobile state, expanded state, queue state, and source labels.
- Mobile has special player sheet/curtain behavior and queue handling.

React player contract:

Build one `PlayerProvider` at app root. Every track row/card/embed should call the same `usePlayer().play(track, options)` function. No surface should own its own audio state.

---

## Magazine behavior

The old magazine is a configurable surface, not just a post archive.

It includes magazine surface CPT shell, configurable frontend sections, AJAX config get/save/reset/validate, post and term search for section building, preview query endpoint, universal content shell logic that matches articles to ecosystem links, YouTube link auto-embedding, SEO/title formatting, and share label behavior.

React should model magazine as:

- `articles`
- `article_categories/tags`
- `magazine_sections`
- `magazine_section_items`
- `article_entity_mentions` or computed entity links
- `article_media_embeds`
- editorial curation config

---

## Guides behavior

Guides are public editorial products with bespoke layouts and media.

Existing guide routes include:

- `/guides/in-minor-keys/`
- `/guides/dakar-biennale-2026/`
- `/guides/the-day-reading-changed/`, migrated from `/guides/the-kenyan-literary-scene/`.

Guides have issue number/key, hero image, featured image, share image, bespoke CSS/JS and media assets, SEO fallback metadata, and download/notify forms.

React should preserve guides as structured editorial products, not hard-coded PHP templates.

---

## Admin surfaces to replace

React should not port WordPress admin pages literally. It should create a WAKILISHA Admin Studio with modules:

1. Dashboard / Registry Home
2. Ingest Studio
3. Registry Browser
4. Entity Detail Editor
5. Review Queue
6. Unresolved Entities
7. Release Canonicalization
8. Release Shells
9. Track Enrichment / Preview Recovery
10. Artist Admin
11. Genre Registry
12. Data Quality / Duplicates
13. Provenance / Audit Log
14. Graph / Relationships
15. Snapshots / Integrity
16. Materialized Stats
17. Jobs / Batch Jobs
18. Reports / Exports
19. Editorial Intelligence
20. Audience Registry
21. Analytics
22. Governance / Corrections
23. Frontend Appearance / Design System
24. Navbar/Menu settings, if navigation remains admin-configurable

---

## Stop-gap solutions not to carry forward

- Creating CPTs only to mount app pages.
- Shortcodes for app pages.
- Query vars as routing primitives.
- Virtual `WP_Post` objects for registry entities.
- Global `wp_footer` injection of player/footer/theme toggle.
- SEO plugin filters for title/canonical/OG behavior.
- Admin action URLs as the application API.
- Repair jobs running opportunistically on `admin_init`.
- Inline CSS/JS in templates and admin pages.
- WooCommerce checkout customization inside the core cultural registry plugin.
- Compatibility aliases and fallback methods masking broken internal calls.

React should replace these with typed routes, API endpoints, job queue/worker, schema migrations, explicit SEO metadata per route, app shell providers, and a separate commerce boundary.

---

## Major unknowns / required export inputs

The zip contains plugin code/assets, but not the live WordPress database contents.

Before data migration can be verified, export these from the old site:

1. WordPress posts for relevant CPTs: artists, chart series, chart editions, guide pages, magazine surfaces, genre pages, labels surfaces, top 10, play, methodology, settings/profile/corrections surfaces.
2. WordPress postmeta for those CPTs.
3. WordPress terms/termmeta for categories, tags, artist genres, artist origins, and editorial taxonomy shell fields.
4. All `wp_wkcharts_*` tables.
5. Media attachment table/metadata and upload file references.
6. Users required for authorship, profiles, subscriptions, follows, and admin history.
7. WooCommerce product/order data only if WAKILISHA commerce remains in scope.

Without those exports, we can design the migration contract but cannot verify row-level parity.
