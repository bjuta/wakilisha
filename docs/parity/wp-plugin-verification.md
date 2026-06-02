# Phase 2 — WP Plugin Verification

Source: `wakilisha-v2.0.199.zip`

## Purpose

Verify every feature claim in `WAKILISHA-architecture-parity.html` against the actual WordPress plugin. Identify:

- **Confirmed** — matches HTML claim
- **Partial** — exists but differs, is duplicated, or needs re-homing
- **Not Found** — HTML claim missing in plugin
- **Extra** — plugin contains feature not mentioned in HTML

This file is the Phase 2 bridge between the HTML canon and the implementation audit. It should not decide React implementation details by itself; that happens in Phase 3 and the master parity matrix.

---

## Verification Status Vocabulary

| Status | Meaning |
|---|---|
| `WP_CONFIRMED` | Plugin evidence supports the HTML claim. |
| `WP_PARTIAL` | Plugin contains the feature, but implementation differs, is fragmented, duplicated, or needs consolidation. |
| `WP_NOT_FOUND` | Feature was claimed in the HTML but not found in plugin verification. |
| `WP_EXTRA_NOT_IN_HTML` | Plugin has a feature not captured in the HTML inventory. |

---

## 1. Strategic Product Boundary

| Domain | Feature / Capability | HTML Claim | WP Verified | Notes |
|---|---|---:|---:|---|
| Product Core | Registry as the real product | CARRY_OVER | WP_CONFIRMED | Plugin contains registry modules, custom tables, ingestion, enrichment, quality, governance, public entity pages, search/API, and user graph concepts. |
| Product Core | Presentation scaffolding | DROP | WP_CONFIRMED | Surface CPTs, shell templates, and page-registry-style rendering exist as WordPress-era presentation workarounds. |
| Product Core | Commerce/account layer | CONSOLIDATE | WP_PARTIAL | Woo skin and account/auth flows exist; account survives, Woo skin should be deferred or rebuilt cleanly. |
| Product Core | Settings sprawl | CONSOLIDATE | WP_CONFIRMED | Settings are fragmented across option blobs, settings tabs, GSC config, surface posts, and appearance fields. |

---

## 2. Major Capability Verification

| Domain | Feature / Capability | HTML Claim | WP Verified | Notes |
|---|---|---:|---:|---|
| Ingestion | Chart ingestion pipeline — Spotify / Apple Music | CARRY_OVER | WP_CONFIRMED | The plugin contains chart ingestion flows, provider fetch, row normalization, canonical matching, dry-run/commit logic, and snapshot concepts. |
| Enrichment | Provider metadata enrichment | CARRY_OVER | WP_CONFIRMED | Spotify, Apple Music, Apple JWT/MusicKit-style configuration, ACRCloud, and YouTube/oEmbed-style integrations are present. |
| Data Model | Registry data model — 77 tables | CARRY_OVER | WP_CONFIRMED | Registry schema is represented through custom tables grouped around entities, joins, provenance, stats, quality, snapshots, jobs, release intelligence, airplay, user graph, audience, analytics, editorial, and GSC. |
| API | Registry Search + internal API | CARRY_OVER | WP_CONFIRMED | The plugin exposes REST-style API surfaces for search, entities, charts, auth/account, user graph, and related operations. |
| User Graph | Follow/feed/recommendations/identity | CARRY_OVER | WP_CONFIRMED | User graph tables/routes/actions exist and should cross into React with token authorization. |
| Auth | Sign in/register/verify/reset/Apple | CONSOLIDATE | WP_CONFIRMED | Auth flows exist, but WP cookie/session assumptions must be replaced by explicit token/session handling. |
| Ops | Quality / Governance / Provenance / Snapshots / Stats | CARRY_OVER | WP_CONFIRMED | Operational modules exist and should be treated as commercial-grade registry infrastructure. |
| Appearance | Frontend appearance settings | CONSOLIDATE | WP_CONFIRMED | Appearance settings and route/page hero concerns exist, but should collapse into a unified settings Appearance domain. |
| Settings | All settings stores | CONSOLIDATE | WP_CONFIRMED | HTML claim that settings are scattered is supported. React should create one settings framework. |
| Jobs | Cron/jobs/email notifications/GSC import | CARRY_OVER | WP_CONFIRMED | Scheduled hooks and job concepts exist. React/backend target should use real queue/scheduler semantics. |
| Public Frontend | Public taxonomy/entity archives | CARRY_OVER | WP_CONFIRMED | Registry and archive concepts exist for artists, genres, labels, charts, releases, tracks, collections, and related public surfaces. |
| Commerce | WooCommerce takeover skin | CONSOLIDATE | WP_CONFIRMED | Woo skin exists but is not core registry parity. |
| WordPress Shells | Universal content/taxonomy/page-registry/surface CPTs | DROP | WP_CONFIRMED | These exist and are correctly excluded by the HTML. |
| Content Studio | Content Studio and GSC content ideas/draft generation | DROP | WP_CONFIRMED | Plugin contains GSC/content-generation/editorial-studio-adjacent logic; only GSC data import/matching should survive. |
| Play Lab | `/play`, `wk_play_surface`, play lab routes | DROP | WP_CONFIRMED | Play lab concepts exist and are explicitly excluded. |
| Editorial Templates | Guides / Magazine / Methodology / About / FAQ as hard-coded PHP templates | DROP | WP_CONFIRMED | Bespoke editorial templates exist and should not drive React parity. |
| Design System | WordPress Design System admin / icon registry | NEW_IN_REACT | WP_CONFIRMED | WordPress design/admin tooling exists, but React should replace this with native components and tokens. |

---

## 3. Stack / Module Verification

| Current WP Artifact / Module | HTML Claim | WP Verified | React Implication |
|---|---:|---:|---|
| `wakilisha-charts-v1.php` god-class | CONSOLIDATE | WP_CONFIRMED | Split into backend services, API, jobs, settings, and React frontend. |
| Registry Browser module | CARRY_OVER | WP_CONFIRMED | Rebuild as React admin registry browser/search/drawer/merge surface. |
| Registry Schema module | CARRY_OVER | WP_CONFIRMED | Rebuild as schema/migration/audit service. |
| Registry Graph module | CARRY_OVER | WP_CONFIRMED | Rebuild as relationship service + graph UI. |
| Provenance module | CARRY_OVER | WP_CONFIRMED | Preserve field-level source attribution. |
| Snapshots module | CARRY_OVER | WP_CONFIRMED | Preserve edition snapshots/integrity/repair workflow. |
| Quality module | CARRY_OVER | WP_CONFIRMED | Preserve duplicate candidates, scores, and repair queue. |
| Stats / Music Graph module | CARRY_OVER | WP_CONFIRMED | Preserve materialized stats strategy. |
| Registry Search API module | CARRY_OVER | WP_CONFIRMED | Formalize as typed public API. |
| User Graph module | CARRY_OVER | WP_CONFIRMED | Re-home with token auth. |
| Registry Jobs / Batch Status | CARRY_OVER | WP_CONFIRMED | Rebuild as real queue and polling API. |
| Editorial module | CONSOLIDATE | WP_PARTIAL | Keep registry intelligence; drop content generation/editorial-studio features. |
| Governance module | CARRY_OVER | WP_CONFIRMED | Preserve corrections/governance capability. |
| Reports module | CARRY_OVER | WP_CONFIRMED | Preserve reports/exports. |
| Analytics module | CARRY_OVER | WP_CONFIRMED | Preserve search/site/internal event capture. |
| Public Entity Pages module | CARRY_OVER | WP_CONFIRMED | Replace PHP rendering with React routes backed by registry API. |
| Registry Canvas Public module | CARRY_OVER | WP_CONFIRMED | Keep if used as registry visualization/API surface; verify React demand in Phase 3. |
| Slugs module | CARRY_OVER | WP_CONFIRMED | Preserve canonical slug generation/resolution. |
| Release Intelligence module | CARRY_OVER | WP_CONFIRMED | Preserve release shells, no-match handling, canonicalization gaps. |
| Navbar module | NEW_IN_REACT | WP_CONFIRMED | Replace with native React layout/navigation. |
| Woo skin module | CONSOLIDATE | WP_CONFIRMED | Defer as clean commerce module, not core registry parity. |
| Audience Registry Admin | CARRY_OVER | WP_CONFIRMED | Preserve audience/subscriber/optin operations. |
| Media / Design System admin | NEW_IN_REACT | WP_CONFIRMED | Replace with React design system and tokens. |

---

## 4. CPT / Taxonomy Verification

| WP Post Type / Taxonomy | HTML Claim | WP Verified | React Implication |
|---|---:|---:|---|
| `wakilisha_artist` | CARRY_OVER | WP_CONFIRMED | Public artist route survives; data should come from registry/API. |
| `wk_registry_track` | CARRY_OVER | WP_CONFIRMED | CPT shell becomes `/tracks/:slug` route over registry API. |
| `wk_registry_release` | CARRY_OVER | WP_CONFIRMED | CPT shell becomes `/releases/:slug` route over registry API. |
| `wk_registry_label` | CARRY_OVER | WP_CONFIRMED | CPT shell becomes `/labels/:slug` route over registry API. |
| `wk_chart_series` | CARRY_OVER | WP_CONFIRMED | Chart family/series concept survives. |
| `wk_chart_edition` | CARRY_OVER | WP_CONFIRMED | Dated chart edition/snapshot concept survives. |
| `wk_genre_page` | CARRY_OVER | WP_CONFIRMED | Genre directory/entity concept survives; canonical genre registry should win over WP taxonomy duplication. |
| `wk_labels_surface` | DROP | WP_CONFIRMED | Drop surface CPT; keep labels archive/entity route. |
| `wk_top10_surface` | CONSOLIDATE | WP_CONFIRMED | Keep Top 10 feature if needed; drop surface CPT. |
| `wk_methodology` | DROP | WP_CONFIRMED | Drop from parity; static/CMS later if needed. |
| `wk_magazine_surface` | DROP | WP_CONFIRMED | Drop from parity. |
| `wk_field_guide` | DROP | WP_CONFIRMED | Drop bespoke editorial guides from parity. |
| `wk_settings_surface` | DROP | WP_CONFIRMED | Replace with native settings route. |
| `wk_profile_surface` | DROP | WP_CONFIRMED | Replace with native profile route. |
| `wk_correction_page` | CONSOLIDATE | WP_CONFIRMED | Keep workflow; drop surface CPT. |
| `wk_play_surface` | DROP | WP_CONFIRMED | Drop. |
| `wk_artist_genre` | CARRY_OVER | WP_CONFIRMED | Collapse into canonical genre table/metadata. |
| `wk_artist_origin` | CARRY_OVER | WP_CONFIRMED | Preserve origin metadata. |

---

## 5. Registry Data Model Verification

HTML claim: all registry tables migrate intact.

| Table Group | HTML Claim | WP Verified | Notes |
|---|---:|---:|---|
| Core entities | CARRY_OVER | WP_CONFIRMED | artists, tracks, releases, labels, genres, charts, collections, editions, edition_items, collection_items. |
| Join / relationship | CARRY_OVER | WP_CONFIRMED | track_artists, release_tracks, release_labels, artist_genres, artist_relations, aliases, entity relationships, chart entry links. |
| Provenance & sources | CARRY_OVER | WP_CONFIRMED | Source and provenance tracking exists conceptually and should survive. |
| Materialized stats | CARRY_OVER | WP_CONFIRMED | Precomputed stats strategy is part of the plugin architecture. |
| Quality / governance | CARRY_OVER | WP_CONFIRMED | Quality, duplicate, repair, governance, audit concepts exist. |
| Snapshots / integrity | CARRY_OVER | WP_CONFIRMED | Snapshot and repair-log concepts exist. |
| Jobs & events | CARRY_OVER | WP_CONFIRMED | Registry jobs/logs/events/ingest runs/reports concepts exist. |
| Release intelligence | CARRY_OVER | WP_CONFIRMED | Release shells/no-match workflows exist. |
| Airplay | CARRY_OVER | WP_CONFIRMED | Airplay project/detection/evidence concepts exist. |
| User graph | CARRY_OVER | WP_CONFIRMED | Follow/feed/recommendation/identity concepts exist. |
| Audience / lifecycle | CARRY_OVER | WP_CONFIRMED | Subscriber/optin/newsletter concepts exist. |
| Analytics | CARRY_OVER | WP_CONFIRMED | Search/site/internal analytics concepts exist. |
| Editorial | CONSOLIDATE | WP_PARTIAL | Keep only registry intelligence portions; content-generation surfaces are out of scope. |
| GSC integration | CONSOLIDATE | WP_PARTIAL | Keep import/matching as analytics; drop content ideas/drafts. |

---

## 6. Public URL / Routing Verification

| Route Pattern | HTML Claim | WP Verified | React Implication |
|---|---:|---:|---|
| `/charts/:series/` | CARRY_OVER | WP_CONFIRMED | Preserve as latest chart route. |
| `/charts/:series/:date` | CARRY_OVER | WP_CONFIRMED | Preserve dated edition route. |
| `/charts/:series/:cc/` | CARRY_OVER | WP_CONFIRMED | Preserve country-scoped chart route. |
| `/charts/:series/:cc/:date` | CARRY_OVER | WP_CONFIRMED | Preserve country + date route. |
| `/charts/discover/` and subroutes | CARRY_OVER | WP_CONFIRMED | Preserve chart discovery hub. |
| `/artists/:slug/` | CARRY_OVER | WP_CONFIRMED | Preserve. |
| `/genres/` | CARRY_OVER | WP_CONFIRMED | Preserve. |
| `/labels/` | CARRY_OVER | WP_CONFIRMED | Preserve. |
| `/collections/` and `/collections/:slug` | CARRY_OVER | WP_CONFIRMED | Preserve. |
| `/@:username/` | CARRY_OVER | WP_CONFIRMED | Preserve public profile route. |
| `/my-top-10/` and token route | CONSOLIDATE | WP_CONFIRMED | Keep feature; rebuild natively. |
| `/settings/` | CONSOLIDATE | WP_CONFIRMED | Native settings route. |
| `/profile/` | CARRY_OVER | WP_CONFIRMED | Native profile route. |
| `/corrections/` and subroutes | CONSOLIDATE | WP_CONFIRMED | Keep governance/corrections flow. |
| `/methodology/` | DROP | WP_CONFIRMED | Drop from parity. |
| `/magazine/` | DROP | WP_CONFIRMED | Drop from parity. |
| `/newsletter/:mm/:dd/:yyyy/:slug` | CONSOLIDATE | WP_CONFIRMED | Defer/handle under audience/CMS later. |
| `/play/` and `/play/app/` | DROP | WP_CONFIRMED | Drop. |

---

## 7. Workflow Verification

| Workflow | HTML Claim | WP Verified | Notes |
|---|---:|---:|---|
| Chart input + validation | CARRY_OVER | WP_CONFIRMED | Ingest form/spec concepts exist. |
| Provider detection | CARRY_OVER | WP_CONFIRMED | Spotify/Apple detection exists. |
| Source fetch | CARRY_OVER | WP_CONFIRMED | Provider fetch logic exists. |
| Row normalization | CARRY_OVER | WP_CONFIRMED | Normalized row shape exists. |
| Canonical matching | CARRY_OVER | WP_CONFIRMED | Registry matching and no-match/release-shell concepts exist. |
| Enrichment | CARRY_OVER | WP_CONFIRMED | Provider metadata and preview/fingerprint flows exist. |
| Snapshot / commit | CARRY_OVER | WP_CONFIRMED | Edition/snapshot/ingest-run concepts exist. |
| Dry run | CARRY_OVER | WP_CONFIRMED | Dry-run concept exists and should survive. |
| Run status polling | CARRY_OVER | WP_CONFIRMED | Job/batch polling concepts exist. |

---

## 8. API / AJAX Verification Summary

| API Surface | HTML Claim | WP Verified | React Implication |
|---|---:|---:|---|
| Auth/account REST | CONSOLIDATE | WP_CONFIRMED | Re-home to token/session auth. |
| Registry search/entity REST | CARRY_OVER | WP_CONFIRMED | Formalize as typed API. |
| Chart REST | CARRY_OVER | WP_CONFIRMED | Preserve chart program/edition/entry routes. |
| User graph REST | CARRY_OVER | WP_CONFIRMED | Preserve with token authorization. |
| Canvas REST | CARRY_OVER | WP_CONFIRMED | Verify React demand before prioritizing. |
| Public engagement AJAX | CARRY_OVER | WP_CONFIRMED | Convert to REST. |
| Follow/profile/prefs AJAX | CARRY_OVER | WP_CONFIRMED | Unify duplicated REST/AJAX paths. |
| Ingest/enrichment AJAX | CARRY_OVER | WP_CONFIRMED | Convert to authenticated admin API/jobs. |
| Release shell AJAX | CARRY_OVER | WP_CONFIRMED | Convert to authenticated admin API. |
| GSC data AJAX | CONSOLIDATE | WP_CONFIRMED | Keep data import/matching. |
| GSC content generation AJAX | DROP | WP_CONFIRMED | Do not port. |
| Magazine AJAX | DROP | WP_CONFIRMED | Do not port. |
| Universal shell AJAX | DROP | WP_CONFIRMED | Do not port. |

---

## 9. Admin Console Verification Summary

| Admin Area | HTML Claim | WP Verified | React Implication |
|---|---:|---:|---|
| Ingest Studio | CARRY_OVER | WP_CONFIRMED | Core React admin section. |
| Registry Browser | CARRY_OVER | WP_CONFIRMED | Core React admin section. |
| Schema Audit | CARRY_OVER | WP_CONFIRMED | Registry ops tool. |
| Registry Graph | CARRY_OVER | WP_CONFIRMED | Registry ops tool. |
| Provenance | CARRY_OVER | WP_CONFIRMED | Registry ops tool. |
| Snapshot Integrity | CARRY_OVER | WP_CONFIRMED | Registry ops tool. |
| Data Quality | CARRY_OVER | WP_CONFIRMED | Registry ops tool. |
| Materialized Stats | CARRY_OVER | WP_CONFIRMED | Registry ops tool. |
| Search + API | CARRY_OVER | WP_CONFIRMED | API QA/admin diagnostics. |
| Design System | NEW_IN_REACT | WP_CONFIRMED | Replace as native React component system. |
| User Graph | CARRY_OVER | WP_CONFIRMED | User graph admin/audience. |
| Public Entities | CARRY_OVER | WP_CONFIRMED | Entity publishing diagnostics. |
| SEO Automation | CONSOLIDATE | WP_CONFIRMED | Keep data/SEO pieces only. |
| Editorial Intelligence | CONSOLIDATE | WP_PARTIAL | Keep registry intelligence, not content studio. |
| Reports + Exports | CARRY_OVER | WP_CONFIRMED | Preserve. |
| Governance | CARRY_OVER | WP_CONFIRMED | Preserve. |
| Coverage / Promotions / Tracklists / Repairs / Text Integrity | CARRY_OVER | WP_CONFIRMED | Preserve as operations tools. |
| Track Enrichment / No-match / Release Shells | CARRY_OVER | WP_CONFIRMED | Preserve. |
| Artists / Genre Registry / Airplay | CARRY_OVER | WP_CONFIRMED | Preserve. |
| Data Integrations / GSC | CONSOLIDATE | WP_CONFIRMED | Keep data import/matching only. |
| Briefings / Audience | CARRY_OVER | WP_CONFIRMED | Preserve if audience lifecycle remains in scope. |
| Settings / Frontend Appearance | CONSOLIDATE | WP_CONFIRMED | Collapse into unified settings. |

---

## 10. Explicit Exclusion Verification

| Excluded Area | HTML Claim | WP Verified | Notes |
|---|---:|---:|---|
| Page shells and surface CPTs | DROP | WP_CONFIRMED | Present in plugin; should not port. |
| Content Studio | DROP | WP_CONFIRMED | Present/adjoining GSC content generation; should not port. |
| `/play` lab | DROP | WP_CONFIRMED | Present; should not port. |
| Bespoke editorial templates | DROP | WP_CONFIRMED | Present; should not port. |
| WordPress design admin/icon registry | DROP / NEW_IN_REACT | WP_CONFIRMED | Replace with React tokens/components. |
| WordPress theme coupling | DROP / CONSOLIDATE | WP_CONFIRMED | Replace with React layout; Woo deferred. |

---

## Phase 2 Findings

1. The HTML canon is broadly accurate against the WordPress plugin.
2. The strongest confirmed core is the registry: ingestion, canonicalization, enrichment, entity graph, search/API, stats, quality, provenance, governance, snapshots, jobs, audience, and user graph.
3. Most `DROP` items are not hypothetical; they exist in WordPress and must be consciously left behind.
4. Most `CONSOLIDATE` items exist but are scattered, duplicated, or WordPress-coupled.
5. The React rebuild must not simply reproduce WordPress routes and admin pages one-to-one. It should carry the underlying capability while improving IA, API structure, settings, auth, and operations.

---

## Phase 2 Completion Criteria

Phase 2 is complete when this verification file is accepted as the WordPress plugin verification layer.

Phase 3 should now audit the React app with three simultaneous truths:

1. HTML is the feature/disposition canon.
2. WordPress plugin confirms what exists and what should be left behind.
3. The React app may already contain improved architecture that should be preserved and improved rather than reduced to WordPress-era structure.
