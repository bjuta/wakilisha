# Phase 1 — HTML Feature Inventory

Source of truth: `WAKILISHA-architecture-parity.html`.

This document converts the HTML bible into a structured feature inventory. It does not yet verify against the WordPress plugin or current React implementation. Those are Phase 2 and Phase 3.

## Disposition Vocabulary

| Disposition | Meaning |
|---|---|
| `CARRY_OVER` | Feature should cross into the React rebuild substantially intact. |
| `CONSOLIDATE` | Feature/workflow survives, but implementation should be collapsed, simplified, or re-homed. |
| `NEW_IN_REACT` | WordPress-era implementation should be replaced by native React architecture/components. |
| `DROP` | Explicitly out of scope for the React parity rebuild. Do not port. |

## Phase 1 Output Rule

Every feature below must later become a row in the master parity matrix with:

```txt
Domain | Feature | HTML Disposition | WP Verified | React Status | Action | Priority | Notes
```

---

# 1. Strategic Product Boundary

| Domain | Feature / Capability | HTML Disposition | Notes |
|---|---|---:|---|
| Product Core | Registry as the real product | CARRY_OVER | Ingestion, canonicalization, enrichment, quality, governance, public entity pages, search/API, user graph. |
| Product Core | Presentation scaffolding | DROP | WordPress workarounds caused by not owning the frontend. React owns rendering. |
| Product Core | Commerce/account layer | CONSOLIDATE | Auth and user graph survive. Woo skin is deferred/clean later module. |
| Product Core | Settings sprawl | CONSOLIDATE | Collapse options blob, GSC key, tabs, CPT surface settings, per-page hero settings into one structured framework. |

---

# 2. Major Capability Disposition

| Domain | Feature / Capability | HTML Disposition | Notes |
|---|---|---:|---|
| Ingestion | Chart ingestion pipeline — Spotify / Apple Music | CARRY_OVER | Re-home as backend job service. React admin screen becomes Ingest Studio. |
| Enrichment | Provider metadata enrichment | CARRY_OVER | Keep Spotify, Apple Music, Apple JWT, ACRCloud, YouTube/oEmbed logic where relevant. |
| Data Model | Registry data model — 77 tables | CARRY_OVER | Migrate intact. Drop nothing at schema-audit stage. |
| API | Registry Search + internal API | CARRY_OVER | Becomes public API contract consumed by React. |
| User Graph | Follow/feed/recommendations/identity | CARRY_OVER | Re-home permission model on tokens rather than WP cookies. |
| Auth | Sign in/register/verify/reset/Apple | CONSOLIDATE | Keep flows; replace `wp_set_auth_cookie` with token/session issuance. |
| Ops | Quality / Governance / Provenance / Snapshots / Stats | CARRY_OVER | Operational backbone of commercial-grade registry. |
| Appearance | Frontend appearance settings | CONSOLIDATE | Move into unified Appearance settings domain. |
| Settings | All settings stores | CONSOLIDATE | One structured settings framework. |
| Jobs | Cron/jobs/email notifications/GSC import | CARRY_OVER | Re-home as queue/scheduler. |
| Public Frontend | Public taxonomy/entity archives | CARRY_OVER | React routes backed by registry API. |
| Commerce | WooCommerce takeover skin | CONSOLIDATE | Defer; reintroduce only as clean commerce module if needed. |
| WordPress Shells | Universal content/taxonomy/page-registry/surface CPTs | DROP | Stopgap page shells obsolete in React. |
| Content Studio | Content Studio and GSC content ideas/draft generation | DROP | Explicitly out of scope. GSC data import may survive as analytics signal only. |
| Play Lab | `/play`, `wk_play_surface`, play lab routes | DROP | Explicitly excluded. |
| Editorial Templates | Guides / Magazine / Methodology / About / FAQ as hard-coded PHP templates | DROP | Re-author separately as CMS/static content if needed. Not parity scope. |
| Design System | WordPress Design System admin / icon registry | NEW_IN_REACT | Replace with React component library and design tokens. |

---

# 3. Current Stack Components to Account For

| Domain | Current WP Artifact / Module | HTML Disposition | React Target |
|---|---|---:|---|
| Bootstrap | `wakilisha-charts-v1.php` god-class | CONSOLIDATE | Split into API, services, jobs, settings, frontend. |
| Admin Registry | `Wakilisha_Registry_Browser_V1` | CARRY_OVER | React registry browser/admin drawer/merge UI. |
| Schema | `Wakilisha_Registry_Schema` | CARRY_OVER | Migration/schema audit service. |
| Graph | `Wakilisha_Registry_Graph` | CARRY_OVER | Relationship service and graph UI. |
| Provenance | `Wakilisha_Registry_Provenance` | CARRY_OVER | Field-level provenance service/UI. |
| Snapshots | `Wakilisha_Registry_Snapshots` | CARRY_OVER | Snapshot integrity/repair service/UI. |
| Quality | `Wakilisha_Registry_Quality` | CARRY_OVER | Duplicate candidates, repair queue, quality scores. |
| Stats | `Wakilisha_Music_Graph` | CARRY_OVER | Materialized stats service/jobs. |
| Search API | `Wakilisha_Registry_Search_API` | CARRY_OVER | Typed public API. |
| User Graph | `Wakilisha_User_Graph` | CARRY_OVER | Token-authenticated user graph API. |
| Jobs | Registry jobs + batch status | CARRY_OVER | Queue, worker, polling endpoints. |
| Editorial | `Wakilisha_Registry_Editorial` | CONSOLIDATE | Keep useful registry intelligence; drop content-generation/editorial-studio parts. |
| Governance | `Wakilisha_Registry_Governance` | CARRY_OVER | Corrections and governance workflows. |
| Reports | `Wakilisha_Registry_Reports` | CARRY_OVER | Reports/export admin tools. |
| Analytics | `Wakilisha_Analytics` | CARRY_OVER | Event/search analytics service. |
| Public Pages | `Wakilisha_Public_Entity_Pages` | CARRY_OVER | React entity pages backed by API. |
| Canvas | `Wakilisha_Registry_Canvas_Public` | CARRY_OVER | Registry canvas API/surface if still relevant. |
| Slugs | `Wakilisha_Registry_Slugs` | CARRY_OVER | Canonical slug generation/resolution. |
| Release Intel | `Wakilisha_Release_Intelligence` | CARRY_OVER | Release shells, no-match handling, canonicalization gaps. |
| Navbar | `WK_Navbar` | NEW_IN_REACT | Native React layout/navigation. |
| Woo | `WK_Woo_Skin` | CONSOLIDATE | Defer. Clean commerce later. |
| Audience | `Wakilisha_Audience_Registry_Admin` | CARRY_OVER | Audience/admin module. |
| UI | `Wakilisha_Media` / WP Design System | NEW_IN_REACT | Native component library/tokens. |

---

# 4. Custom Post Types Inventory

| Domain | WP Post Type | HTML Disposition | React Target / Notes |
|---|---|---:|---|
| Artist Entity | `wakilisha_artist` | CARRY_OVER | `/artists/:slug`; data should come from registry. |
| Track Entity | `wk_registry_track` | CARRY_OVER | `/tracks/:slug`; CPT shell becomes API-backed route. |
| Release Entity | `wk_registry_release` | CARRY_OVER | `/releases/:slug`; CPT shell becomes API-backed route. |
| Label Entity | `wk_registry_label` | CARRY_OVER | `/labels/:slug`; CPT shell becomes API-backed route. |
| Chart Series | `wk_chart_series` | CARRY_OVER | Recurring chart family and ingest settings. |
| Chart Edition | `wk_chart_edition` | CARRY_OVER | Dated chart instance/snapshot target. |
| Genre Entity | `wk_genre_page` | CARRY_OVER | `/genres` and likely `/genres/:slug`; canonical registry table wins. |
| Label Surface | `wk_labels_surface` | DROP | Surface shell replaced by React labels archive. |
| Top 10 Surface | `wk_top10_surface` | CONSOLIDATE | Feature may survive; surface CPT drops. |
| Methodology | `wk_methodology` | DROP | Static/CMS page if needed; not parity scope. |
| Magazine Surface | `wk_magazine_surface` | DROP | Out of scope. |
| Field Guide | `wk_field_guide` | DROP | Bespoke editorial; not ported. |
| Settings Surface | `wk_settings_surface` | DROP | Replaced by React settings route and unified settings API. |
| Profile Surface | `wk_profile_surface` | DROP | Replaced by React profile route over user graph API. |
| Corrections Page | `wk_correction_page` | CONSOLIDATE | Workflow survives; page surface drops. |
| Play Surface | `wk_play_surface` | DROP | Explicitly excluded. |

## Taxonomies

| Domain | Taxonomy | HTML Disposition | React Target / Notes |
|---|---|---:|---|
| Artist Genre | `wk_artist_genre` | CARRY_OVER | Collapse WP taxonomy duplication into canonical genre table. |
| Artist Origin | `wk_artist_origin` | CARRY_OVER | Country/region origin. Model as canonical metadata. |

---

# 5. Registry Data Model Inventory

HTML verdict: **all registry tables migrate intact**. Tables are grouped by domain for later verification.

| Domain | Tables / Table Group | HTML Disposition | Notes |
|---|---|---:|---|
| Core Entities | artists, tracks, releases, labels, genres, charts, collections, editions, edition_items, collection_items | CARRY_OVER | Registry core. |
| Relationships | track_artists, release_tracks, release_labels, artist_genres, artist_relations, artist_aliases, entity_relationships, chart_entry_links | CARRY_OVER | Graph and joins. |
| Provenance | artist_sources, track_sources, release_sources, airplay_sources, registry_partner_feeds, field_provenance | CARRY_OVER | Field/source confidence. |
| Materialized Stats | artist_stats_materialized, track_stats_materialized, release_stats_materialized, genre_stats_materialized, label_stats_materialized, chart_series_stats_materialized, artist_summary_stats, artist_track_stats, artist_trend_scores, track_stats, artist_directory_stats, collection_directory_stats | CARRY_OVER | Preserve precompute strategy. |
| Quality/Governance | registry_quality_scores, registry_duplicate_candidates, relationship_repair_queue, relationship_sync_runs, review_issues, unresolved_entities, governance_capability_audit, governance_corrections, registry_audit_events, audit_log | CARRY_OVER | Commercial-grade operations. |
| Snapshots/Integrity | edition_snapshots, edition_snapshot_items, snapshot_integrity_checks, snapshot_repair_log, recovery_snapshots | CARRY_OVER | Chart snapshot confidence. |
| Jobs/Events | registry_jobs, registry_job_logs, registry_events, ingest_runs, registry_reports, registry_report_exports | CARRY_OVER | Queue and operations logs. |
| Release Intelligence | release_shells, release_shell_tracks, release_shell_artists, release_admin_history | CARRY_OVER | No-match/canonicalization support. |
| Airplay | airplay_projects, airplay_detections, airplay_evidence | CARRY_OVER | Airplay/fingerprint evidence. |
| User Graph | user_entity_follows, user_feed_items, user_recommendations, user_identity_snapshots | CARRY_OVER | Follow/feed/recs/identity. |
| Audience | subscribers, subscriber_events, optins, newsletter_issues | CARRY_OVER | Audience lifecycle. |
| Analytics | search_events, search_analytics, search_logs, internal_search_events, site_search_events | CARRY_OVER | Search/site/internal event capture. |
| Editorial | editorial_summaries, editorial_summary_versions, editorial_prompts, editorial_opportunities | CONSOLIDATE | Keep registry intelligence; drop content-studio generation. |
| GSC | gsc_query_rows, gsc_artist_matches, gsc_import_runs | CONSOLIDATE | Keep as analytics signal. |
| GSC Content Ideas | content_ideas | DROP | Drops with Content Studio. |

---

# 6. Public URL / Routing Inventory

| Domain | Route Pattern | HTML Disposition | React Target / Notes |
|---|---|---:|---|
| Charts | `/charts/:series/` | CARRY_OVER | Latest edition of chart series. |
| Charts | `/charts/:series/:date` | CARRY_OVER | Specific dated edition. |
| Charts | `/charts/:series/:cc/` | CARRY_OVER | Country-scoped chart. |
| Charts | `/charts/:series/:cc/:date` | CARRY_OVER | Country + dated edition. |
| Charts | `/charts/discover/` | CARRY_OVER | Chart discovery hub. |
| Charts | `/charts/discover/:x` | CARRY_OVER | Discovery subroute. |
| Artists | `/artists/:slug/` | CARRY_OVER | Artist entity page. |
| Genres | `/genres/` | CARRY_OVER | Genre directory. |
| Labels | `/labels/` | CARRY_OVER | Labels archive. |
| Collections | `/collections/` | CARRY_OVER | Collections archive. |
| Collections | `/collections/:slug` | CARRY_OVER | Collection detail. |
| Profiles | `/@:username/` | CARRY_OVER | Public profile handle route. |
| Top 10 | `/my-top-10/` | CONSOLIDATE | Feature survives; implementation native React. |
| Top 10 | `/my-top-10/:token` | CONSOLIDATE | Shareable token route. |
| Settings | `/settings/` | CONSOLIDATE | Native settings route over unified settings/user preferences. |
| Profile | `/profile/` | CARRY_OVER | User profile route. |
| Corrections | `/corrections/` | CONSOLIDATE | Workflow survives. |
| Corrections | `/corrections/submitted` | CONSOLIDATE | Submission state. |
| Corrections | `/corrections/:type/:id` | CONSOLIDATE | Entity-specific correction flow. |
| Methodology | `/methodology/` | DROP | Not core parity. |
| Methodology | `/methodology/app` | DROP | Not core parity. |
| Magazine | `/magazine/` | DROP | Explicitly out of scope. |
| Newsletter | `/newsletter/:mm/:dd/:yyyy/:slug` | CONSOLIDATE | Could become CMS/audience issue route; not core registry first pass. |
| Play Lab | `/play/` | DROP | Explicitly excluded. |
| Play Lab | `/play/app/` | DROP | Explicitly excluded. |

---

# 7. Chart Ingestion Workflow Inventory

| Domain | Pipeline Stage | HTML Disposition | Notes |
|---|---|---:|---|
| Ingestion | Input + validation | CARRY_OVER | Chart title/slug/date, size, kind, cover style, source URLs, saved series settings. |
| Ingestion | Provider detection | CARRY_OVER | Spotify, Apple Music. Spotify market defaults to KE. |
| Ingestion | Resource guard | CARRY_OVER | Throttle/check source count before fetching. |
| Ingestion | Source fetch | CARRY_OVER | Multi-source provider fetch. |
| Ingestion | Normalize rows | CARRY_OVER | Convert provider rows to uniform rank/title/artist/release/identifier shape. |
| Ingestion | Canonical match | CARRY_OVER | Match to registry; create release shells/no-match gaps. |
| Ingestion | Enrichment | CARRY_OVER | Provider metadata, previews, audio fingerprinting. |
| Ingestion | Snapshot / commit | CARRY_OVER | Write editions, edition items, snapshots, ingest runs, integrity checks. |
| Ingestion UI | Dry run | CARRY_OVER | Must exist before commit. |
| Ingestion UI | Run status polling | CARRY_OVER | Use job/batch poll pattern. |

---

# 8. Provider / Enrichment Inventory

| Domain | Provider / Feature | HTML Disposition | Notes |
|---|---|---:|---|
| Provider | Spotify Web API | CARRY_OVER | Chart rows, track/artist metadata, preview source, market scoping. |
| Provider | Apple Music | CARRY_OVER | Chart rows, artwork, signed preview playback. |
| Provider | Apple developer JWT ES256 | CARRY_OVER | MusicKit/previews. |
| Provider | ACRCloud | CARRY_OVER | Audio fingerprint/recognition/preview recovery. |
| Provider | YouTube oEmbed/watch | CARRY_OVER | Embeddable playback links. |
| Provider | Google Search Console data import | CONSOLIDATE | Keep import and artist matching only. |
| Content Studio | GSC content idea generation | DROP | Explicit content-studio exclusion. |
| Content Studio | GSC content draft generation | DROP | Explicit content-studio exclusion. |
| Content Studio | Editorial radar from GSC | DROP | Explicit content-studio exclusion. |

---

# 9. Registry Operations Inventory

| Domain | Admin / Ops Module | HTML Disposition | React Target / Notes |
|---|---|---:|---|
| Registry Ops | Registry Browser | CARRY_OVER | Browse/search/drawer/merge. |
| Registry Ops | Schema Audit | CARRY_OVER | Verify/repair all registry tables. |
| Registry Ops | Registry Graph | CARRY_OVER | Entity relationship graph. |
| Registry Ops | Provenance | CARRY_OVER | Field attribution/confidence. |
| Registry Ops | Snapshot Integrity | CARRY_OVER | Validate/repair edition snapshots. |
| Registry Ops | Data Quality | CARRY_OVER | Quality scores, duplicates, repair queue. |
| Registry Ops | Materialized Stats | CARRY_OVER | Refresh/precompute stats. |
| Registry Ops | Registry Jobs | CARRY_OVER | Queue: enqueue/run-next/retry/cancel/poll/batch-poll. |
| Registry Ops | Governance | CARRY_OVER | Capability audit and corrections. |
| Registry Ops | Reports + Exports | CARRY_OVER | Export/report generation. |
| Registry Ops | Coverage | CARRY_OVER | Maintenance dashboard. |
| Registry Ops | Promotions | CARRY_OVER | Maintenance dashboard. |
| Registry Ops | Tracklists | CARRY_OVER | Maintenance dashboard. |
| Registry Ops | Repairs | CARRY_OVER | Maintenance dashboard. |
| Registry Ops | Text Integrity | CARRY_OVER | Unicode/text repair. |
| Release Ops | Release Shells | CARRY_OVER | No-match workflow. |
| Release Ops | Canonicalization Gaps | CARRY_OVER | Resolve ingest gaps. |
| Enrichment Ops | Track Enrichment | CARRY_OVER | Entity enrichment admin. |
| Enrichment Ops | Artists | CARRY_OVER | Artist identity/admin operations. |
| Genre Ops | Genre Registry | CARRY_OVER | Canonical genre registry and sync. |
| Airplay Ops | Airplay | CARRY_OVER | Projects/detections/evidence. |
| Audience Ops | Audience Registry | CARRY_OVER | Subscribers/optins/audience. |
| Editorial Ops | Editorial Intelligence | CONSOLIDATE | Keep registry intelligence; drop content generation. |
| SEO/Data | SEO Automation / GSC | CONSOLIDATE | Keep analytics/data import parts only. |
| Design System | Design System admin | NEW_IN_REACT | Replace with native component library. |

---

# 10. REST API Inventory

## Auth & Account

| Domain | Method / Route | HTML Disposition | Notes |
|---|---|---:|---|
| Auth | `POST /auth/signin` | CONSOLIDATE | Re-home to token/session auth. |
| Auth | `POST /auth/register` | CONSOLIDATE | Keep verification flow; token/session auth. |
| Auth | `POST /auth/resend-verification` | CARRY_OVER | Keep. |
| Auth | `POST /auth/forgot-password` | CARRY_OVER | Keep. |
| Auth | `POST /auth/reset-password` | CARRY_OVER | Keep. |
| Auth | `POST /auth/apple` | CARRY_OVER | Keep. |
| Auth | `GET /auth/ping` | CARRY_OVER | Session check. |
| User | `GET /me` | CARRY_OVER | Current user payload. |
| User | `GET /profile` | CARRY_OVER | Read profile. |
| User | `POST /profile` | CARRY_OVER | Update profile. |
| User | `GET /username/check` | CARRY_OVER | Handle availability. |
| Preferences | `POST /preferences/display` | CONSOLIDATE | Consolidate into user preferences object. |
| Preferences | `POST /preferences/audible` | CONSOLIDATE | Consolidate into user preferences object. |
| Preferences | `POST /preferences/notifications` | CONSOLIDATE | Consolidate into user preferences object. |
| Follow | `POST /follow/artist` | CARRY_OVER | Unify with generic follow API. |
| Follow | `POST /follow/chart` | CARRY_OVER | Unify with generic follow API. |
| Follow | `GET /follow/all` | CARRY_OVER | List follows. |
| Top 10 | `GET /top10` | CONSOLIDATE | Feature survives. |
| Top 10 | `POST /top10` | CONSOLIDATE | Feature survives. |
| Top 10 | `/top10/:token` | CONSOLIDATE | Share token. |
| Playback | `/playback/apple-state` | CARRY_OVER | Apple playback connection state. |
| ACRCloud | `/acrcloud/result` | CARRY_OVER | Recognition callback/result. |
| ACRCloud | `/acrcloud/state` | CARRY_OVER | Recognition state. |

## Registry Search & Entities

| Domain | Route | HTML Disposition | Notes |
|---|---|---:|---|
| Search | `GET /search` | CARRY_OVER | Global search. |
| Search | `GET /registry/search` | CARRY_OVER | Registry-scoped search. |
| Artists | `GET /artists/:id` | CARRY_OVER | Artist entity. |
| Releases | `GET /releases/:id` | CARRY_OVER | Release entity. |
| Tracks | `GET /tracks/:id` | CARRY_OVER | Track entity. |
| Labels | `GET /labels/:id` | CARRY_OVER | Label entity. |
| Genres | `GET /genres/:id` | CARRY_OVER | Genre entity. |
| Charts | `GET /charts/:series` | CARRY_OVER | Chart series data. |
| Charts | `GET /charts/:series/:date` | CARRY_OVER | Dated edition data. |

## User Graph & Canvas

| Domain | Route | HTML Disposition | Notes |
|---|---|---:|---|
| User Graph | `POST /follow/entity` | CARRY_OVER | Generic follow API. |
| User Graph | `GET /me/feed` | CARRY_OVER | Personalized feed. |
| User Graph | `GET /me/recommendations` | CARRY_OVER | Recommendations. |
| User Graph | `GET /me/identity` | CARRY_OVER | Identity snapshot. |
| Canvas | `/registry/canvas` | CARRY_OVER | Public registry canvas data. |

---

# 11. AJAX Endpoint Inventory by Domain

| Domain | Representative AJAX Actions | HTML Disposition | React Target |
|---|---|---:|---|
| Public Engagement | `track_share`, `get_share_counts`, `persist_share_count`, `optin`, `analytics_track`, `wk_tax_load_more` | CARRY_OVER | Convert to REST. Guide download drops with guides. |
| Follow/Profile/Prefs | `toggle_follow_artist`, `toggle_follow_chart`, `save_profile_preferences`, user graph feed/recs actions | CARRY_OVER | Unify duplicated REST/AJAX paths. |
| Ingest/Enrichment | `top_song_enrich_row`, `top_song_enrich_batch`, registry search/attach/create/save/resolve actions | CARRY_OVER | Authenticated admin API/jobs. |
| Release Shells | create/set/merge/delete/search/embed actions | CARRY_OVER | Authenticated admin API. |
| Artist Identity | `save_artist_identity`, related artists, hide release item | CARRY_OVER | Authenticated admin API. |
| Genre Registry | registry action and sync | CARRY_OVER | Authenticated admin API. |
| Registry Ops | browser/jobs/stats/global search actions | CARRY_OVER | Authenticated admin API/jobs. |
| Playback/Preview | Apple state, preview recovery | CARRY_OVER | REST/API service. |
| Phase 1 Catalog | catalog project promotion/state | CARRY_OVER | Verify in plugin; decide exact React target later. |
| GSC Data | OAuth, properties, test connection, matching, import, scoring, settings, disconnect | CONSOLIDATE | Keep data import/matching only. |
| GSC Content Studio | content idea/draft/editorial radar actions | DROP | Do not port. |
| Magazine | magazine config/search/preview actions | DROP | Do not port. |
| Universal Shells | save/reset universal shell | DROP | Do not port. |
| Auth Maintenance | clear auth rate limits | CARRY_OVER | Admin maintenance endpoint. |

---

# 12. Admin Console Inventory

## Visible Admin Areas

| Domain | Admin Page / Area | HTML Disposition | React Target |
|---|---|---:|---|
| Ingest | Ingest Studio | CARRY_OVER | Top-level admin section. |
| Registry | Registry Browser | CARRY_OVER | Admin section. |
| Registry | Schema Audit | CARRY_OVER | Admin section/tool. |
| Registry | Registry Graph | CARRY_OVER | Admin section/tool. |
| Registry | Provenance | CARRY_OVER | Admin section/tool. |
| Registry | Snapshot Integrity | CARRY_OVER | Admin section/tool. |
| Registry | Data Quality | CARRY_OVER | Admin section/tool. |
| Registry | Materialized Stats | CARRY_OVER | Admin section/tool. |
| API | Search + API | CARRY_OVER | Admin diagnostics/API QA. |
| Design | Design System | NEW_IN_REACT | Native components; do not prioritize as WP parity surface. |
| User Graph | User Graph | CARRY_OVER | Admin/audience/user graph. |
| Public Entities | Public Entities | CARRY_OVER | Entity publishing diagnostics. |
| SEO | SEO Automation | CONSOLIDATE | Data/SEO only; no content studio. |
| Editorial | Editorial Intelligence | CONSOLIDATE | Keep registry intelligence only. |
| Reports | Reports + Exports | CARRY_OVER | Admin section. |
| Governance | Governance | CARRY_OVER | Admin section. |
| Registry | Registry Home | CARRY_OVER | Admin overview. |
| Ops | Coverage | CARRY_OVER | Admin tool. |
| Ops | Promotions | CARRY_OVER | Admin tool. |
| Ops | Tracklists | CARRY_OVER | Admin tool. |
| Ops | Repairs | CARRY_OVER | Admin tool. |
| Ops | Text Integrity | CARRY_OVER | Admin tool. |
| Ops | Registry Ops | CARRY_OVER | Jobs/queue/admin ops. |
| Enrichment | Track Enrichment | CARRY_OVER | Admin tool. |
| Releases | No-match Releases | CARRY_OVER | Admin tool. |
| Releases | Release Shells | CARRY_OVER | Admin tool. |
| Drafts | Drafts | CONSOLIDATE | Verify scope; avoid editorial/content-studio drift. |
| Snapshots | Snapshots | CARRY_OVER | Admin tool. |
| Review | Review | CARRY_OVER | QA/governance review. |
| Artists | Artists | CARRY_OVER | Entity admin. |
| Genres | Genre Registry | CARRY_OVER | Entity admin. |
| Airplay | Airplay | CARRY_OVER | Admin section. |
| Integrations | Data Integrations / GSC | CONSOLIDATE | Keep data import/matching only. |
| Briefings | Briefings | CARRY_OVER | Email/audience/scheduled briefings if retained. |
| Audience | Audience | CARRY_OVER | Admin section. |
| Settings | Settings | CONSOLIDATE | Unified settings. |
| Appearance | Frontend Appearance | CONSOLIDATE | Appearance domain inside settings. |

## Hidden Detail Pages

| Domain | Hidden Page | HTML Disposition | React Target |
|---|---|---:|---|
| Ingest | Ingest Runs | CARRY_OVER | Detail route/drawer. |
| Jobs | Admin Queue | CARRY_OVER | Detail route/drawer. |
| Entities | Tracks | CARRY_OVER | Entity detail/admin route. |
| Entities | Releases | CARRY_OVER | Entity detail/admin route. |
| Releases | Release Canonicalization Gaps | CARRY_OVER | Detail route/drawer. |
| Audit | Audit Log | CARRY_OVER | Detail route/admin log. |
| Airplay | Airplay Projects | CARRY_OVER | Detail route. |
| Airplay | Airplay Detections | CARRY_OVER | Detail route. |
| Airplay | Airplay Evidence | CARRY_OVER | Detail route. |
| Locking | V1 Lock | CONSOLIDATE | Verify purpose before porting. |

---

# 13. Shortcodes & Page Surface Inventory

| Domain | Shortcode | HTML Disposition | React Target |
|---|---|---:|---|
| Top 10 | `wkcharts_top10_page` | CONSOLIDATE | Native route/component. |
| Profile | `wkcharts_profile_page` | CONSOLIDATE | Native route/component. |
| Settings | `wkcharts_settings_page` | CONSOLIDATE | Native route/component. |
| Auth | `wkcharts_auth_page` | CONSOLIDATE | Native route/component. |
| Corrections | `wkcharts_corrections_page` | CONSOLIDATE | Native correction workflow. |
| Corrections | `wakilisha_correction_form` | CONSOLIDATE | Native correction workflow. |
| Entity Embeds | `wk_artist_projects` | CARRY_OVER | Native component if still needed. |
| Entity Embeds | `wk_release` | CARRY_OVER | Native component if still needed. |
| Methodology | `wkcharts_methodology_page` | DROP | Do not port. |
| Play Lab | `wkcharts_play_page` | DROP | Do not port. |

---

# 14. Unified Settings Inventory

| Settings Domain | Absorbs | HTML Disposition | Notes |
|---|---|---:|---|
| Integrations | Spotify, Apple, ACRCloud, GSC settings/token | CONSOLIDATE | Secrets must remain server-side. |
| Appearance | Appearance tab, Frontend Appearance page, per-page heroes | CONSOLIDATE | Route appearance records and tokens. |
| Player & Playback | Artist song previews tab | CONSOLIDATE | Player variant, motion, audible UI defaults. |
| Ingestion | Per-series ingest settings, CSV phase 1 | CONSOLIDATE | Source URLs, windows, size, kind, field maps. |
| Registry | Registry tab/schema/materialization/quality thresholds | CONSOLIDATE | Typed registry config. |
| Artists | Artists tab/defaults/newsletter shortcode | CONSOLIDATE | Artist defaults and form refs. |
| Editorial / SEO | SEO automation, methodology copy fields | CONSOLIDATE | Keep SEO/data; avoid editorial-template drift. |
| Email & Audience | Test email, briefing config | CONSOLIDATE | Transactional templates/cadence. |
| Maintenance | Maintenance tab | CONSOLIDATE | Repairs, rate limits, debug. |
| Navigation | Navbar tab and share tab | CONSOLIDATE | App navigation/share config. |

---

# 15. Frontend Appearance Inventory

| Domain | Current Input | HTML Disposition | React Target |
|---|---|---:|---|
| Route Hero Assets | Artists/genres/charts/series/about/shop/checkout/contact/faq/privacy/discover hero images and credits | CONSOLIDATE | Managed route appearance records. |
| Accent Colors | `light_mode_accent_hex`, `dark_mode_accent_hex` | CONSOLIDATE | Design token overrides. |
| Login Background | login background image/value/credit | CONSOLIDATE | Auth route appearance asset. |
| Theme Mode | theme mode and dark-mode logic | CONSOLIDATE | Theme provider/tokens. |
| Archive Behavior | chart archive filters, player/motion/audible defaults | CONSOLIDATE | App config/settings. |

---

# 16. Auth & User Graph Inventory

| Domain | Concern | HTML Disposition | React Target |
|---|---|---:|---|
| Auth | Credential auth | CONSOLIDATE | Same flows; token/session auth. |
| Auth | Sign in with Apple | CARRY_OVER | Keep. |
| Authorization | WP cookie trust + open permission callbacks | CONSOLIDATE | Real per-route token authorization. |
| Rate Limiting | Auth rate limits and manual clear | CARRY_OVER | Middleware/admin maintenance. |
| Follow Graph | `user_entity_follows` and duplicate follow APIs | CARRY_OVER | One generic follow API. |
| Feed/Recs | `user_feed_items`, `user_recommendations` | CARRY_OVER | Recompute job + API. |
| Identity | `user_identity_snapshots` | CARRY_OVER | Keep API and display. |
| Preferences | Display/audible/notifications/profile prefs | CONSOLIDATE | One preferences object. |

---

# 17. Jobs, Cron & Email Inventory

| Domain | Scheduled Hook / Job | HTML Disposition | React Target |
|---|---|---:|---|
| Email | `wk_send_artist_optin_weekly_emails` | CARRY_OVER | Scheduler/queue. |
| Notifications | `wk_send_follow_notifications` | CARRY_OVER | Scheduler/queue. |
| Briefings | `wk_send_briefing_issues` | CARRY_OVER | Scheduler/queue if retained. |
| GSC | `wakilisha_v1_gsc_scheduled_private_import` + retry | CONSOLIDATE | Scheduled data import only. |
| Performance | `wkcharts_v1_perf_cron` | CARRY_OVER | Stats/perf maintenance job. |
| Jobs | Registry job queue | CARRY_OVER | Queue service with logs and polling. |
| Email Templates | `wk_email_template`, `wk_email_headers` | CARRY_OVER | Transactional email template service. |

---

# 18. Explicit Exclusions Inventory

| Domain | Excluded Feature | HTML Disposition | Replacement |
|---|---|---:|---|
| WordPress Shells | `universal-content-shell`, `universal-taxonomy-shell`, `page-registry`, special/surface CPTs, per-page hero customization | DROP | React route components + settings-driven appearance. |
| Content Studio | GSC content ideas/drafts/editorial radar, magazine config/editor, `content_ideas` | DROP | None in parity scope. |
| Play Lab | `wk_play_surface`, `/play`, `/play/app`, `wkcharts_play_page`, play lab hover sounds | DROP | None. |
| Bespoke Editorial | Field guides, magazine, methodology/about/FAQ hardcoded templates, guides CSS | DROP | Re-author later as CMS/static if needed. |
| WP Design Admin | Design System admin + PHP icon registry | DROP / NEW_IN_REACT | Native React component library and tokens. |
| Theme Coupling | Navbar/footer PHP render, Woo skin takeover, heavy WP CSS/mobile bundles | DROP / CONSOLIDATE | React layout/design system; commerce later. |

---

# 19. Target React Architecture Inventory

| Layer | Target Capability | HTML Disposition | Notes |
|---|---|---:|---|
| Backend | Registry DB | CARRY_OVER | 77 tables migrated intact. |
| Backend | Public API | CARRY_OVER | Search/entity/chart/user-graph routes formalized and typed. |
| Backend | Ingestion service | CARRY_OVER | Spotify/Apple/ACRCloud, canonical match, snapshots. |
| Backend | Enrichment service | CARRY_OVER | Provider metadata, Apple JWT, ACRCloud recovery. |
| Backend | Ops services | CARRY_OVER | Quality, governance, provenance, snapshots, stats, reports. |
| Backend | Auth service | CONSOLIDATE | Token auth, authorization, rate limiting. |
| Backend | Scheduler/queue | CARRY_OVER | Replace WP cron. |
| Backend | Settings service | CONSOLIDATE | Domain-structured config and secrets. |
| Frontend | Public routes | CARRY_OVER | Charts, artists, genres, labels, collections, profiles, discover, search. |
| Frontend | Account routes | CONSOLIDATE | Auth, profile, settings, feed, Top 10, corrections. |
| Frontend | Admin console | CONSOLIDATE | Ingest, Registry, Entities, Operations, Audience, Settings. |
| Frontend | Design system | NEW_IN_REACT | Native tokens/components. |
| Frontend | Player | CARRY_OVER | Playback with settings-driven defaults. |

---

# Phase 1 Completion Criteria

Phase 1 is complete when this inventory is accepted as the extracted HTML feature list.

Phase 2 must not rewrite these dispositions casually. It should only mark whether each item is:

- `WP_CONFIRMED`
- `WP_PARTIAL`
- `WP_NOT_FOUND`
- `WP_EXTRA_NOT_IN_HTML`

Phase 3 should then mark React status:

- `REACT_PRESENT`
- `REACT_PARTIAL`
- `REACT_MISSING`
- `REACT_SHOULD_REMOVE`
- `REACT_DEFER`
