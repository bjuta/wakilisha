# WAKILISHA — Final Release Plan

## 1. Project Description
WAKILISHA is a premier cultural institution and digital platform dedicated to preserving, promoting, and investing in African creative life. It builds the systems — discovery, documentation, funding, valuation, and sustainability — that help African creative work travel further, last longer, and generate meaningful value.

**Current state:** Music vertical is the mature layer. Real data has been imported from the legacy WordPress/Wkcharts stack into Supabase — 1,713 artists, 4,582 tracks, 687 releases, 232 labels, 27 genres, 164 chart editions, plus 74K+ relationship records. A repaired content API serves listing data. Admin infrastructure (Chart Ingestion Studio, WordPress-like CMS) is production-ready. Public listing pages (artists, genres, labels, releases, charts, magazine) are built with real API connections. Mobile counterparts exist for all listing pages.

**Gap:** Three critical pages are missing or non-functional (genre detail, label detail, track detail). Cross-linking between entities is incomplete. Relationship data (track↔artist, release↔track, artist↔genre, etc.) sits unresolved in staging with old database IDs instead of slugs. The repaired content API has no individual entity detail endpoints for genres, labels, or tracks.

## 2. What's Already Done (do not rebuild)

### Data & API
- All content entities staged in Supabase (`wk_wakilisha_entities` + `wk_import_staging_records`)
- Artist detail API with bio, discography, chart entries, related artists
- Release detail API with tracklist, metadata
- Listing APIs for artists, genres, labels, releases, magazine stories
- Supabase public API edge function (`wakilisha-public-api`)
- WordPress import pipeline (staging → resolution → finalize)
- Chart ingestion studio v2 (admin)
- Design system tokens and CSS variables

### Public Pages (desktop + mobile)
- Homepage (institutional)
- Charts directory + edition pages
- Artist directory + artist detail
- Genre directory (listing only — detail page MISSING)
- Label directory (listing only — detail page MISSING)
- Release detail
- Track detail (page exists but data is FAKE)
- Magazine, article, issue pages
- Guides listing
- Five vertical landing pages (film, fashion, food, language, places)
- Search, player, profile, settings, auth, author profile

### Admin
- Full registry admin (artists, tracks, releases, labels, genres — list + detail)
- Chart ingestion studio (programs, runs, editions, snapshots, mapping, QA, health)
- Content admin (articles, guides, pages, lyrics, archive, publishing)
- Media library, missing images, broken links
- Import jobs tracking
- Relationship viewer, duplicate merge
- Settings hub (charts, integrations, appearance, registry, navigation, etc.)
- User management

## 3. What Needs Building — The Final Release Backlog

---

### Phase 1: Relationship Resolution (Database) 🗄️
**Status:** NOT STARTED
**Goal:** Resolve all relationship staging records from old integer IDs to slug-based entity references. Without this, track→artist, release→track, artist→genre, and every other relationship is unusable at the API layer.

**What exists today:** 74K+ relationship records in `wk_import_staging_records` with types: `entity_relationships`, `track_artists`, `release_tracks`, `chart_entries`, `release_labels`, `artist_genres`, `artist_relationships`. Every record has `raw_record` with old MySQL/wkcharts IDs but `mapped_record` is missing the resolved slugs.

**What needs to happen:**
1. Build ID→slug lookup maps from entity staging records (artists, tracks, releases, labels, genres)
2. Write resolution script that reads each relationship type, resolves old IDs to slugs, writes back `mapped_record`
3. Handle the two-ID-space problem: WordPress post IDs (350 artists) vs Wkcharts auto-increment IDs (everything else)
4. Filter wp_term_relationships (68K records) to keep only those connecting known entities to useful taxonomies
5. Verify resolution completeness — no unresolved IDs left behind

**Deliverable:** All relationship staging records have `mapped_record` with slug-based entity references. Ready for API consumption.

---

### Phase 2: Repaired Content API — Detail Endpoints 🔌
**Status:** NOT STARTED
**Goal:** Add individual entity detail endpoints to the public API for genres, labels, and tracks. Currently only artists and releases have detail endpoints.

**What exists today:**
- `GET /repaired/artists/:slug` — ✅ functional
- `GET /repaired/releases/:artistSlug/:releaseSlug` — ✅ functional
- `GET /repaired/genres/:slug` — ❌ does not exist
- `GET /repaired/labels/:slug` — ❌ does not exist
- `GET /repaired/tracks/:slug` — ❌ does not exist
- `GET /repaired/artists`, `/genres`, `/labels`, `/releases`, `/magazine` — ✅ listing endpoints

**What needs to happen:**
1. Add `getGenre(slug)` → returns genre detail with full artist roster, related genres, activity stats
2. Add `getLabel(slug)` → returns label detail with full roster, release catalog, country info, description
3. Add `getTrack(slug)` → returns track detail with ISRC, playback sources, chart history, artist collaborations, release linkage, lyrics contributor info, credits
4. Add corresponding TypeScript types (`RepairedGenreDetail`, `RepairedLabelDetail`, `RepairedTrackDetail`)
5. Add frontend client methods in `src/services/repairedContent/client.ts`
6. Update the Supabase edge function (`wakilisha-public-api`) to serve these endpoints

**Deliverable:** All three entity types have functional detail APIs returning rich, relationship-aware data.

---

### Phase 3: Genre Detail Page 🎵
**Status:** NOT STARTED (page does not exist — dead links on genre listing)
**Goal:** Build public genre detail page at `/genres/:slug` (desktop + mobile).

**What exists today:** Genre listing page (`/genres`) with cards linking to `/genres/:slug`. Admin genre detail page exists at `/admin/registry/genres/:slug`. No public detail page.

**What needs to happen:**
1. Create `src/pages/genres/detail/page.tsx` — genre detail page
2. Create `src/pages/mobile/genres/detail/page.tsx` — mobile variant
3. Design page sections:
   - Hero with genre name, gradient identity, stats (artist count, track count)
   - Representative artists grid (linked to artist pages)
   - Top tracks from this genre
   - Related genres
   - Activity timeline / recent additions
   - Genre description / cultural context
4. Add routes in `src/router/config.tsx` for `/genres/:slug`
5. Wire to `getGenre(slug)` API (Phase 2 deliverable)
6. Create placeholder/mock data for development before API is ready

**Deliverable:** Functional genre detail page at `/genres/:slug` with real data, accessible from genre listing cards.

---

### Phase 4: Label Detail Page 🏢
**Status:** NOT STARTED (page does not exist — dead links on label listing)
**Goal:** Build public label detail page at `/labels/:slug` (desktop + mobile).

**What exists today:** Label listing page (`/labels`) with cards linking to `/labels/:slug`. Admin label detail page exists at `/admin/registry/labels/:slug`. No public detail page.

**What needs to happen:**
1. Create `src/pages/labels/detail/page.tsx` — label detail page
2. Create `src/pages/mobile/labels/detail/page.tsx` — mobile variant
3. Design page sections:
   - Hero with label name, country, description
   - Stats bar (artist count, release count, chart presence)
   - Full roster of artists (linked to artist pages)
   - Release catalog (linked to release pages)
   - Chart presence / notable achievements
   - Related labels / imprints
   - Country context
4. Add routes in `src/router/config.tsx` for `/labels/:slug`
5. Wire to `getLabel(slug)` API (Phase 2 deliverable)

**Deliverable:** Functional label detail page at `/labels/:slug` with real data, accessible from label listing cards.

---

### Phase 5: Track Detail — Real Data Connection 🎧
**Status:** PAGE EXISTS but uses fake data (`getTrackBySlug` returns `undefined`, `TRACK_DETAILS = []`)
**Goal:** Wire the existing track detail page to real API data.

**What exists today:** Beautifully designed track detail page at `/tracks/:slug` with hero, tabs (Overview/Chart Stats/Lyrics/Credits), play button, streaming badges, related tracks. But all data is hardcoded to empty — the page renders "Track not found" for every slug.

**What needs to happen:**
1. Replace `getTrackBySlug` stub with real `getTrack` call from Phase 2 API
2. Replace `getRelatedTracks` with real related tracks from API
3. Replace `getTimedLyrics` with real lyrics data from API
4. Add loading state (currently goes straight to "not found")
5. Add error state with retry
6. Connect streaming badges to real playback sources
7. Connect chart history to real chart data
8. Wire ISRC display, release/album linkage, collaboration artists
9. Mobile variant page (`src/pages/mobile/tracks/detail/page.tsx`) — verify it also gets real data

**Deliverable:** Track detail page shows real data for every track in the registry. All four tabs functional.

---

### Phase 6: Cross-Linking Cleanup 🔗
**Status:** PARTIAL — some links exist, many are dead text
**Goal:** Every entity reference on every page is a working link.

**What's broken today:**
| Page | Issue |
|------|-------|
| Artist Detail | Genre tags are plain text (should link to `/genres/:slug`) |
| Release Detail | Label name is plain text (should link to `/labels/:slug`). Tracklist items not linked to track pages. No genre tags. |
| Track Detail | Label shown as text, not linked. No album/release link. Artist collaborations not linked. |
| Genre Listing | Already links to genre detail — ✅ (once Phase 3 completes) |
| Label Listing | Already links to label detail — ✅ (once Phase 4 completes) |
| Chart Edition | Track rows and artist names should link to detail pages |

**What needs to happen:**
1. Artist detail: Wrap genre tags in `<Link to={/genres/:slug}>`
2. Release detail: Link label name to `/labels/:slug`, link tracklist items to `/tracks/:slug`, add genre tags with links
3. Track detail: Link label to `/labels/:slug`, link release/album, link collaborating artists to `/artists/:slug`
4. Chart edition: Verify track rows and artist columns link correctly
5. Chart directory: Verify artist rolodex entries link to artist pages

**Deliverable:** Zero dead-end text. Every entity name anywhere on the site is a clickable link to its detail page.

---

### Phase 7: Mobile Parity Pass 📱
**Status:** PARTIAL — some mobile pages are stubs
**Goal:** Every desktop page has a properly designed mobile counterpart.

**What needs to happen:**
1. Verify mobile genre detail page (created in Phase 3)
2. Verify mobile label detail page (created in Phase 4)
3. Audit existing mobile pages for visual consistency with desktop
4. Ensure mobile navigation and player dock work correctly on all pages
5. Test on actual mobile viewport sizes

**Deliverable:** Complete mobile experience parity with desktop.

---

### Phase 8: Performance, SEO & Polish ✨
**Status:** NOT STARTED
**Goal:** Production-ready performance, SEO, and visual polish.

**What needs to happen:**
1. SEO: Review meta tags, titles, descriptions for all entity detail pages
2. SEO: Add Schema.org structured data (MusicAlbum, MusicGroup, MusicRecording) to appropriate pages
3. Performance: Image optimization, lazy loading audit
4. Performance: API response caching strategy
5. Visual polish: Consistent loading skeletons on all pages
6. Visual polish: Smooth page transitions
7. Error states: Friendly error messages with retry on all data-dependent pages
8. 404 handling: Verify NotFound page renders for invalid slugs on all entity types

**Deliverable:** Production-grade polish across the entire site.

---

### Phase 9: Launch Readiness 🚀
**Status:** NOT STARTED
**Goal:** Final pre-launch verification and hardening.

**What needs to happen:**
1. Full site walkthrough — click every link, test every interaction
2. Cross-browser testing
3. API error handling — verify graceful degradation when API is down
4. Content QA — spot-check data accuracy on detail pages
5. Remove any remaining mock data, placeholder text, or debug UI
6. Environment configuration for production
7. Build verification — zero compilation errors, zero console errors

**Deliverable:** Site is launch-ready.

---

## 4. Dependency Graph

```
Phase 1 (Relationship Resolution)
    │
    ▼
Phase 2 (API Detail Endpoints) ────── required by ──→ Phase 3, 4, 5
                                                        │
Phase 3 (Genre Detail) ◄─── can start in parallel ──→ Phase 4 (Label Detail)
    │                                                    │
    ▼                                                    ▼
Phase 5 (Track Detail Real Data)
    │
    ▼
Phase 6 (Cross-Linking Cleanup) ←── depends on 3, 4, 5 completing
    │
    ▼
Phase 7 (Mobile Parity)
    │
    ▼
Phase 8 (Performance, SEO & Polish)
    │
    ▼
Phase 9 (Launch Readiness)
```

**Parallelizable work:** Phases 3 and 4 can be built simultaneously (they share zero dependencies on each other). Phase 5 can also start in parallel with 3/4 since it's a different page. The key blocker for all three is Phase 2 (API endpoints).

Phase 1 is a pure database/scripts task — no frontend changes. It unblocks richer API responses in Phase 2.

## 5. Data Model (What's in Supabase)

### Content Entities (`wk_wakilisha_entities`)
| entity_type | count | has rich content |
|-------------|-------|-----------------|
| artists | 1,713 | 64 have bios, 84 have excerpts |
| tracks | 4,582 | skeleton only (ISRC + release_id) |
| releases | 687 | empty mapped_record |
| labels | 232 | empty mapped_record |
| chart_editions | 164 | minimal |
| genres | 27 | empty |

### Relationship Records (`wk_import_staging_records`)
| record_type | count | resolution status |
|-------------|-------|-------------------|
| entity_relationships | 74,716 | needs_review — old IDs |
| track_artists | 7,295 | needs_review — old IDs |
| release_tracks | 4,293 | needs_review — old IDs |
| chart_entries | 6,332 | needs_review — old IDs |
| release_labels | 227 | needs_review — old IDs |
| artist_genres | 131 | needs_review — old IDs |
| artist_relationships | 1,094 | needs_review — old IDs |
| artist_taxonomy_terms | 37 | mapped (wakilisha_taxonomy: true) |

## 6. Technical Notes

- **No new third-party integrations needed** — Supabase is already connected, Shopify/Stripe not required
- **No auth changes needed** — existing auth flow works
- **No new dependencies** — all work uses existing stack (React 19, TailwindCSS 3.4, TypeScript)
- **API is serverless** — Supabase Edge Function (`wakilisha-public-api`) handles all requests
- **Image placeholders** — `Chapter19FallbackImage` component handles missing artwork with gradient placeholders
- **Design system** — All pages must use WAKILISHA CSS custom properties (`var(--wk-*)`) and follow existing design patterns