# WAKILISHA — Final Release Plan

## Scoped Entity URL Architecture ✅ IMPLEMENTED (June 2026)

### Principle

Every public entity page uses a **nested URL structure** where the primary artist provides the namespace segment. This prevents slug collisions when two different artists have tracks or releases with the same name. No `--` delimiters, no single-segment fallbacks.

### URL Patterns

| Entity | URL Pattern | Example |
|--------|-------------|---------|
| Track | `/tracks/:artistSlug/:trackSlug` | `/tracks/savara/bossa-vibes` |
| Release | `/releases/:artistSlug/:releaseSlug` | `/releases/savara/no-overthinking` |
| Artist | `/artists/:slug` | `/artists/savara` |
| Genre | `/genres/:slug` | `/genres/afrobeat` |
| Label | `/labels/:slug` | `/labels/mavin-records` |

### Architecture

- **`src/utils/trackUrl.ts`** — `trackUrl(slug, artistSlugs)` generates `/tracks/:artistSlug/:trackSlug`
- **`src/utils/releaseUrl.ts`** — `releaseUrl({ slug, artist })` generates `/releases/:artistSlug/:releaseSlug`. Contains inline `slugify()` for artist name normalization.
- **`src/services/publicContent/client.ts`** — Re-exports both utilities so they remain accessible through the `repairedContent` barrel

### No Fallbacks

There are no single-segment fallback routes for tracks or releases. The old `/tracks/:slug` and `/releases/:slug` routes were removed entirely (June 2026). Every link generator requires artist context. No URL is generated with `--` delimiters.

### Key Rules

1. **`trackUrl()` requires `artistSlugs: string[]`** — no default/optional behavior
2. **`releaseUrl()` requires `{ slug: string; artist: string }`** — artist name is slugified internally
3. **No hardcoded URL templates anywhere** — `grep "/releases/\${" src` returns zero matches
4. **DB slugs remain bare** — the namespace is in the URL path, not in the database slug column
5. **Admin routes unchanged** — `/admin/registry/releases/:slug` and `/admin/registry/tracks/:slug` use direct DB slug lookups behind auth

### All Files Touched (Release Scoping — June 2026)

**Core:** `src/utils/releaseUrl.ts` (new), `src/services/publicContent/client.ts`, `src/router/config.tsx`
**Detail pages:** `src/pages/releases/detail/page.tsx`, `src/pages/mobile/releases/detail/page.tsx`
**Admin:** `src/pages/admin/registry/releases/detail/components/AdminReleaseHero.tsx`, `src/components/admin/registry/RegistryEntityEditorDrawer.tsx`
**Cross-linking:** `src/pages/tracks/detail/page.tsx`, `src/pages/mobile/tracks/detail/page.tsx`, `src/pages/labels/detail/page.tsx`, `src/pages/mobile/labels/detail/page.tsx`, `src/pages/magazine/issues/page.tsx`, `src/pages/admin/content/articles/detail/components/ArticleInternalLinks.tsx`
**Specs/design:** `src/data/api-specs/public-content-read.ts`, `src/design-system/designSystemManifest.ts`, `src/design-system/designSystemSpec.ts`, `src/design-system/wakilishaElementRegistry.ts`, `src/design-system/chapters/reactAppUI.ts`
**Types:** `src/services/repaired/types.ts` (added `artistName?` to `RepairedLabelRelease`)

## 1. Project Description
WAKILISHA is a premier cultural institution and digital platform dedicated to preserving, promoting, and investing in African creative life. It builds the systems — discovery, documentation, funding, valuation, and sustainability — that help African creative work travel further, last longer, and generate meaningful value.

**Current state:** Music vertical is the mature layer. Real data has been imported from the legacy WordPress/Wkcharts stack into Supabase — 1,713 artists, 5,263 tracks, 687 releases, 232 labels, 27 genres, plus 74K+ relationship records. 859 dead unscoped tracks archived and 393 orphaned relationships deleted (June 2026). A repaired content API serves listing data. Admin infrastructure (Chart Ingestion Studio, WordPress-like CMS) is production-ready. Public listing pages (artists, genres, labels, releases, charts, magazine) are built with real API connections. Mobile counterparts exist for all listing pages. Chart v2 tables contain 4 programs, 77 editions, 6,332+ entries — all imported from WordPress with registry canonicalization.

**Gap:** Relationship data (track↔artist, release↔track, artist↔genre, etc.) sits unresolved in staging with old database IDs instead of slugs (Phase 1). Cross-linking between entity pages is incomplete (Phase 6). Mobile parity and SEO polish remain (Phases 7-9).

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
- Settings hub (charts, integrations, appearance, registry, navigation, GSC, etc.)
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
**Status:** COMPLETE (June 2026)
**Goal:** Add individual entity detail endpoints to the public API for genres, labels, and tracks.

**What was done:**
- `GET /genres/:slug` — returns genre detail with full artist roster (from staging records), top tracks (from chart entries), related genres
- `GET /labels/:slug` — returns label detail with full release catalog, roster artists (from chart entries), country info, related labels
- `GET /tracks/:slug` — returns track detail with ISRC, explicit flag, duration, release/label linkage, chart history, chart appearances, peak rank, weeks on chart, movement tracking
- `GET /artists`, `/genres`, `/labels`, `/releases`, `/magazine` — listing endpoints already functional
- Frontend TypeScript types in `src/services/repaired/types.ts` — `RepairedGenreDetail`, `RepairedLabelDetail`, `RepairedTrackDetail`
- Frontend client methods in `src/services/repaired/client.ts` — `getGenre()`, `getLabel()`, `getTrack()`
- Track detail endpoint enhanced (v5) with `chartAppearances`, `chartAppearanceCount`, `movement`, `movementAmount`, `previousRank` fields

**Deliverable:** All entity types have functional detail APIs returning rich, relationship-aware data via `wakilisha-public-api` v5.

---

### Phase 3: Genre Detail Page 🎵
**Status:** COMPLETE (June 2026)
**Goal:** Public genre detail page at `/genres/:slug` (desktop + mobile) with real API data.

**What was done:**
- `src/pages/genres/detail/page.tsx` — desktop genre detail with hero (gradient background), representative artists grid, top tracks list, genre description, related genres, browse-all CTA
- `src/pages/mobile/genres/detail/page.tsx` — mobile variant with compact hero, 3-column artist grid, top tracks list, related genre pills
- Routes in `src/router/config.tsx` — `/genres/:slug` with `ResponsivePage` wrapper
- Wired to `getGenre(slug)` API from Phase 2

**Deliverable:** Functional genre detail page at `/genres/:slug` with real data.

---

### Phase 4: Label Detail Page 🏢
**Status:** COMPLETE (June 2026)
**Goal:** Public label detail page at `/labels/:slug` (desktop + mobile) with real API data.

**What was done:**
- `src/pages/labels/detail/page.tsx` — desktop label detail with hero, tab switcher (Release catalog / Roster), release grid with type badges, artist roster grid, country context card, related labels, browse-all CTA
- `src/pages/mobile/labels/detail/page.tsx` — mobile variant exists (imported but needs verification)
- Routes in `src/router/config.tsx` — `/labels/:slug` with `ResponsivePage` wrapper
- Wired to `getLabel(slug)` API from Phase 2

**Deliverable:** Functional label detail page at `/labels/:slug` with real data.

---

### Phase 5: Track Detail — Real Data Connection 🎧
**Status:** COMPLETE (June 2026)
**Goal:** Wire existing track detail page to real API data. Mobile page was completely stubbed.

**What was done:**
- Desktop page (`src/pages/tracks/detail/page.tsx`) — already wired to `getTrack()` API with `apiToViewModel()` adapter, loading/error states, all 4 tabs
- Mobile page (`src/pages/mobile/tracks/detail/page.tsx`) — **rewritten from stub** (was `getTrackBySlug` returning `undefined` for everything). Now uses same `getTrack()` API + `apiToViewModel()` pattern as desktop
- Routes updated — both `/tracks/:slug` and `/tracks/:artistSlug/:slug` now use `ResponsivePage` with mobile/desktop variants
- Edge Function (v5) returns `chartAppearances`, `chartAppearanceCount`, `movement`, `movementAmount`, `previousRank` for full chart stats tab

**Deliverable:** Track detail page shows real data for every track in the registry on both desktop and mobile.

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
Phase 1 (Relationship Resolution) 🗄️ NOT STARTED
    │
    ▼
Phase 2 (API Detail Endpoints) ✅ COMPLETE ──→ Phase 3, 4, 5 ✅ COMPLETE
                                                    │
Phase 3 (Genre Detail) ✅ COMPLETE                  │
Phase 4 (Label Detail) ✅ COMPLETE                  │
Phase 5 (Track Detail) ✅ COMPLETE                  │
    │                                                │
    ▼                                                ▼
Phase 6 (Cross-Linking Cleanup) ←── NOT STARTED
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
| tracks | 5,263 | skeleton only (ISRC + release_id) |
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

## Phase C: Backend Admin Registry API ✅ COMPLETE

**Edge Function:** `admin-registry-api` deployed at `/functions/v1/admin-registry-api`

**Endpoints:**
- `GET /entities?entityType=artist|track|release&limit=&orderBy=&ascending=` — list entities
- `GET /entities/:entityType/:entityId` — single entity profile
- `PATCH /entities/:entityType/:entityId` — update entity fields

**Security:**
- JWT verification on every request (admin-only)
- Server-side editable field whitelist per entity type
- Uses service_role key for DB operations
- Frontend never writes directly to canonical tables

**Frontend (`client.ts`):**
- All three data functions (`getRegistryEntityList`, `getRegistryEntityProfile`, `saveRegistryEntityPatch`) now route through the Edge Function instead of direct Supabase calls
- `buildChangesPayload` remains pure frontend logic (no DB access)
- Frontend validation + normalization still runs before sending to the API

## Phase G: Audit Trail & Permissions ✅ COMPLETE

**What was built:**

1. **Permission guard in Edge Function** — Every PATCH verifies the caller has `manage_registry` capability via `user_role_assignments` → `role_capabilities`. Only `administrator` and `registry_editor` roles pass. Returns 403 with `permission_denied` error code otherwise.

2. **Audit trail (`registry_audit_log`)** — On every successful PATCH, the Edge Function snapshots the entity's pre-update state (`before_value`) and writes it alongside the applied patch (`after_value`) into `registry_audit_log`. Includes actor_id, actor_label (email), action ("update"), entity_type, entity_id, and metadata (changed_fields list). Audit writes are non-blocking (fire-and-forget with error logging).

3. **Stale-update detection** — Client sends `_expected_updated_at` with every PATCH (the `updated_at` value it last read). The Edge Function compares this against the current DB value before writing. If they differ, the update is rejected with HTTP 409 + errorCode `stale_update` + the current server-side entity state. The drawer shows a clear "Someone else edited this record" message with a "Load latest version" button.

4. **Duplicate slug handling** — DB unique constraints are caught and surfaced with errorCode `duplicate_key` and a human-friendly message in the drawer.

**Files modified:**
- `supabase/functions/admin-registry-api/index.ts` — Permission check, audit writes, stale detection, error code taxonomy
- `src/services/registry/admin/client.ts` — `saveRegistryEntityPatch` accepts `expectedUpdatedAt` parameter, passes `_expected_updated_at` in payload
- `src/services/registry/admin/types.ts` — Added `currentEntity` field to `RegistrySaveResult` for stale-update recovery
- `src/components/admin/registry/RegistryEntityEditorDrawer.tsx` — Passes `entity.updated_at` on save, handles stale_update (orange card + Load latest), permission_denied, duplicate_key, and not_authenticated errors with distinct UI

**Database tables used:**
- `registry_audit_log` — populated on every write (id, actor_id, actor_label, action, entity_type, entity_id, before_value JSONB, after_value JSONB, metadata JSONB, created_at)
- `user_role_assignments` — checked for caller's active roles
- `role_capabilities` — checked for `manage_registry` capability

## Magazine: Dynamic Digital Rebuild ✅ COMPLETE (June 2026)

## Magazine: Issue Production System ✅ COMPLETE (June 2026)

**What was built:** A human-in-the-loop magazine issue production layer that sits on top of the existing `wk_magazine_visual_assets` infrastructure and obeys the data-repair-first architecture.

### Database Tables

- **`wk_magazine_issues`** — Magazine issue records with status lifecycle: draft → generated → approved → published → locked → archived / failed_generation. Fields: id, slug, title, dek, status, timeframe_start, timeframe_end, issue_type, visual_family, treatment, palette, contrast_mode, created_by, generated_by, approved_by, published_by, and timestamps for each transition.
- **`wk_magazine_issue_sections`** — Issue spreads/sections linked to issues via FK. Fields: id, issue_id, spread_id, section_type, title, deck, body, layout, sort_order, status, visual_asset_id (links to wk_magazine_visual_assets).
- **`wk_magazine_issue_entities`** — Entity selections per issue. Fields: id, issue_id, section_id, entity_type (article/artist/track/release/label/genre/chart/chart_entry/media_asset/guide), entity_id, role, selection_state (selected/pinned/excluded), sort_order, source_reason.

### Public API

- **`GET /magazine/public/issues/:slug`** — Returns published issue with sections, entities, and approved/locked visual assets. 404 if not found or not published. Added to `wakilisha-public-api` edge function.

### Frontend Service

- **`src/services/magazineIssueProduction.ts`** — Full CRUD service:
  - `listIssues()`, `getIssue(id)`, `createIssue()`, `updateIssue()`, `deleteIssue()`
  - `discoverCandidates()` — pulls from repaired graph sources (wk_articles, registry_artists, registry_releases, registry_tracks, registry_labels, registry_genres, chart_programs, guides) — never from flat imported tables
  - `generateIssue()` — creates sections + entities from admin selections
  - `approveIssue()`, `publishIssue()`, `lockIssue()`, `archiveIssue()`
  - `validatePublishReadiness()` — checks sections, entities, slug uniqueness
  - Controlled option lists: VISUAL_FAMILIES, TREATMENTS, PALETTES, CONTRAST_MODES

### Admin UI

- **`/admin/magazine/issues`** — Full production workflow page:
  - Issues list with status badges, stats strip (drafts/generated/approved/published/total)
  - **Produce New Issue** drawer with 6-step wizard: Setup → Discover → Select → Visual Direction → Generate → Review
  - Candidate discovery grouped by entity type (Articles, Artists, Releases, Tracks, Labels, Genres, Charts, Guides)
  - Visual direction panel with controlled options (visual_family, treatment, palette, contrast_mode)
  - Issue detail view with sections, entities, and publish validation
  - Status action buttons: Approve, Publish, Lock, Archive, Delete
  - Visit link for published issues

### Public Page Update

- **`/magazine/issue/:slug`** — Now checks the public API first. If a published DB issue exists, renders it. If not (or if not published), shows "Issue unavailable — This issue has not been published." No auto-materialization from article ranges.

**What was done:** Complete CSS and interaction overhaul of the magazine issue pages and issues landing page. Removed the uniform dark/PDF-like aesthetic and rebuilt around a mood-driven design system where each of 6 issue moods (night, paper, travel, signal, archive, image) receives a complete color palette via CSS custom properties — not just accent tweaks.

**Key changes:**

1. **Mood-driven design tokens** (`magazineIssue.css`): Each mood defines `--mag-bg`, `--mag-surface`, `--mag-surface-raised`, `--mag-text`, `--mag-text-soft`, `--mag-text-muted`, `--mag-accent`, `--mag-accent-hi`, `--mag-accent-deep`, `--mag-rule`, `--mag-rule-strong`, `--mag-card-bg`, `--mag-card-border`, and `--mag-overlay`. Dark moods get ink-on-dark palettes; light moods (paper, archive) get cream-and-ink palettes.

2. **Scroll-driven interactivity**: All spreads use `IntersectionObserver`-based reveal animations (`mag-reveal` class). Added a fixed reading progress bar and a sticky mini-header that appears after scrolling past the cover.

3. **Dynamic cover backgrounds**: Each mood now produces a fundamentally different cover background — radial glows for night, grids for signal, ocean gradients for travel, warm amber for archive, cream-to-ink for paper, forest green-black for image. Not just green-on-dark.

4. **Issues landing page redesign**: Mood-aware issue cards with ambient accent glows, hover previews showing the featured article, search/filter bar, and a "Show all issues" toggle. Each card uses the issue's computed mood palette.

5. **Spread variants made mood-aware**: Full-bleed images, quote pages, color interludes, section openers — all now pull colors from the parent mood's tokens via `var(--section-accent)` and `var(--mag-bg)` instead of hardcoded dark values.

6. **Logo switching**: Light moods (paper, archive) use the light logo variant instead of dark, keeping the logo legible.

**Files modified:**
- `src/pages/magazine/issue/magazineIssue.css` — Complete rewrite with mood-driven tokens
- `src/pages/magazine/issue/magazineIssueVariants.css` — Rewrite with mood-aware variants
- `src/pages/magazine/issue/page.tsx` — Added ReadingProgress, StickyHeader, useScrollReveal, mood-propagation to all spreads
- `src/pages/magazine/issues/page.tsx` — Complete redesign with IssueCard component using MOOD_GRADIENTS map, hover previews, improved search

**Constants preserved:** Seal, logo (switchable dark/light), Fraunces + DM Sans + DM Mono type system, editorial NLG pipeline (buildIssueEditorialSystem), visual director (buildMagazineVisualBrief).

## Content Pipeline: Article SEO & Aggregation ✅ COMPLETE (June 2026)

**Problem:** Magazine issue pages were blank because the Supabase edge function path normalization was broken — it only stripped `/wakilisha-public-api` but Supabase routes through `/functions/v1/wakilisha-public-api`, so every API call returned 404. Additionally, the magazine only aggregated from single-source articles (wk_articles) and the admin article editor lacked Yoast-style SEO analysis.

**What was done:**

1. **Edge function path fix** (`wakilisha-public-api`): Fixed `normalizePath()` to handle both path formats — `(/functions/v1)?/wakilisha-public-api` — so all API endpoints work regardless of how Supabase routes the request. Magazine listing limit increased from 50→500, respect query param `limit`.

2. **Site content aggregation endpoint** (`/magazine/site-content`): New API endpoint that returns articles, artists, releases, and chart highlights in a single response. Magazine issues can now pull from the full site content registry, not just articles.

3. **Frontend aggregation service** (`magazineSiteContent.ts`): Typed client for the aggregation endpoint with `useSiteContent()` hook, section grouping utilities, and helpers for top artists, latest releases, and chart highlights.

4. **Yoast-style SEO Analyzer** (`ArticleSeoAnalyzer.tsx`): Full SEO analysis with three check categories:
   - **Keyword analysis** (7 checks): Focus keyword presence in title, first paragraph, SEO title, meta description, URL slug, headings, and keyword density (0.5–3%)
   - **Readability** (4 checks): Flesch reading ease score, paragraph length, sentence length, transition words
   - **Technical SEO** (5 checks): Heading structure, image alt text, word count (300+ min), SEO title length (30–60), meta description length (120–160), internal links
   - Overall score with color-coded progress bar, word/heading/readability stats

5. **Slug editor** (`ArticleMetaPanel.tsx`): Editable URL slug with collision detection — checks for existing slugs before saving, auto-navigates to new URL on success.

6. **Internal link suggestions** (`ArticleInternalLinks.tsx`): Analyzes article content to find linkable phrases, searches across articles, artists, and releases for matches. Shows match type badges, match reasons, and one-click copy/insert buttons. Links can be inserted directly into the editor.

7. **Focus keyword field**: Added to SEO metadata panel — used by the analyzer for all keyword checks.

**Files created:**
- `src/services/magazineSiteContent.ts` — Site content aggregation types + client
- `src/pages/admin/content/articles/detail/components/ArticleSeoAnalyzer.tsx` — Yoast-style SEO analysis
- `src/pages/admin/content/articles/detail/components/ArticleInternalLinks.tsx` — Internal link suggestions

**Files modified:**
- `supabase/functions/wakilisha-public-api/index.ts` — Path fix, limit increase, `/magazine/site-content` endpoint
- `src/services/magazineArticles.ts` — Added `useSiteContent()` hook
- `src/pages/admin/content/articles/detail/components/ArticleMetaPanel.tsx` — Slug editor, focus keyword, SEO analyzer, internal links
- `src/pages/admin/content/articles/detail/page.tsx` — Slug change handler, link insertion handler, content passthrough to analyzer

## Strict Approval Fixes — June 2026 ✅

Following a rigorous audit against the briefs, the following fixes were applied to close gaps between frontend, backend, and UX state.

### Fix 1: Registry Conflict Client Passthrough
**Problem:** The frontend client (`saveRegistryEntityPatch`) dropped `duplicateField`, `duplicateValue`, and `conflictingEntity` when `result.ok` was false, so the drawer never received structured conflict data even though the backend returned it.

**Fix:** Updated type casting on the parsed response to include `duplicateField`, `duplicateValue`, `conflictingEntity`, and `currentEntity`. These fields are now preserved through the failed result path so the drawer can show the conflict card with "View existing", "Generate new slug", "Keep editing" actions.

**File:** `src/services/registry/admin/client.ts`

### Fix 2: Article Admin God-Mode Permissions
**Problem:** Admin bypass existed, but lower-role users were auto-redirected after 2 seconds with a toast. Save/autosave/delete/hero/slug actions had no centralized permission gating. Delete button was always rendered.

**Fix:**
- Created central `articlePermissions` object with `canView`, `canEdit`, `canDelete`, `canPublish`, `canAutosave`, and `reason`
- Lower-role users now get a **read-only view** — all content is visible but inputs are disabled, plus a "Read-only" badge in the header
- All action handlers (`handleSaveDraft`, `handlePublish`, `handleUnpublish`, `handleDelete`, `handleSaveHeroImage`, `autosaveRevision`, `handleSlugChange`) gated with permission check
- Cmd+S shortcut gated with `articlePermissions.canEdit`
- Content editor fields receive `readOnly` prop with disabled styling
- ArticleEditorHeader delete/save buttons conditionally rendered based on permissions
- Header receives full `permissions` object and shows "Read-only" badge

**Files:** `src/pages/admin/content/articles/detail/page.tsx`, `src/pages/admin/content/articles/detail/components/ArticleEditorHeader.tsx`, `src/pages/admin/content/articles/detail/components/ArticleContentEditor.tsx`

### Fix 3: Release-Shell Backfill Backend Route
**Problem:** Frontend client (`client.ts`) called `POST /release-shells/intake/backfill` but no such route existed. Server only handled `create` and `attach`.

**Fix:**
- Added `"backfill_existing_release"` to `CreateReleaseShellInput.mode` union type
- Created `handleBackfillExistingRelease()` handler in `routes.ts` — verifies target release exists in `registry_releases`, inspects provider data, writes observations/suggestions/links pointing at the existing release entity
- Added `POST /api/v1/registry/release-shells/intake/backfill` route in `serve-registry-admin-api.ts` with `manage_registry` auth check
- Updated `ProviderIntakeRunRecord.mode` to include `"backfill_existing_release"`
- Frontend client already calls the correct endpoint — now the backend handles it

**Files:** `scripts/registry/provider-intake/types.ts`, `scripts/registry/provider-intake/routes.ts`, `scripts/registry/provider-intake/staging-writes.ts`, `scripts/registry/serve-registry-admin-api.ts`

### Fix 4: Apple Music Secure .p8 Key Upload
**Problem:** Private key was a `secretTextarea` stored in localStorage — violating the brief's requirement for secure upload away from browser storage.

**Fix:**
- Deployed Supabase Edge Function `upload-apple-music-key` — accepts multipart file upload, validates .p8 format (BEGIN/END PRIVATE KEY headers, length check), stores in `admin_settings_secrets` table via service_role
- Created `admin_settings_secrets` table with row-level security (service_role only)
- Added `secretFile` field type to `SettingsFieldType` union
- Changed Apple Music private key field from `secretTextarea` to `secretFile`
- Updated integrations page `ProviderField` component: shows drag-and-drop file upload UI, uploads via fetch to edge function with JWT auth, shows uploaded status with file name and "Remove" button
- Key is NEVER stored in localStorage — the value stored is a marker string `uploaded:filename`

**Files:** `supabase/functions/upload-apple-music-key/index.ts` (deployed), `src/services/adminSettings/providerCredentialSchema.ts`, `src/pages/admin/settings/integrations/page.tsx`

### Items Verified as Already Complete
- **Mobile bottom nav safe-area**: CSS in `wakilisha-mobile-ch53-75.css` uses `env(safe-area-inset-bottom)` across `.phn-nav`, `.phn-miniplayer`, `.fp-controls`, `.fp-action-sheet`, `.fp-topbar`. CSS is imported via `src/index.css`.
- **Media Library**: Full page exists at `/admin/media/library` querying `registry_media_assets` (7,346 real assets) with grid/table views, search, filters, status management, alt text editing, bulk actions, and preview drawer.
- **Magazine Issue Production**: Tables (`wk_magazine_issues`, `wk_magazine_issue_sections`, `wk_magazine_issue_entities`) exist with RLS, admin page at `/admin/magazine/issues` has full 6-step wizard, public endpoint serves published issues.
- **Design System settings route**: Error boundary shim exists at `/admin/settings/design-system`.
- **Share config platform toggles**: Platform toggle cards with template validation exist in navigation settings.
- **Access Console invite flow**: Failed-load blocked state and controlled scope inputs exist.

## P0 Security Hardening — Backend Authorization ✅ COMPLETE (June 2026)

**Audit trigger:** External audit identified critical backend authorization gaps. Fixed in-sprint without timeout/crashing by doing one sprint at a time.

### What was fixed

1. **`setup_chart_permissions` removed (P0.2 stop-ship)** — The `chart-ingest-api` Edge Function had an action that ran `GRANT SELECT, INSERT, UPDATE, DELETE ON <tables> TO authenticated` through an `exec_sql` RPC. This could undermine the entire RLS security model. Removed.

2. **Capability checks added to all chart-ingest-api actions (P0.3)** — Every action in the chart ingest pipeline is now mapped to a required capability and checked server-side before execution:
   - Read actions (`list_runs`, `get_run`, etc.) → `view_charts_admin`
   - Ingest mutations → `manage_ingest`
   - Commit/publish → `publish_charts`
   Previously, any authenticated user could call any action.

3. **Safe error responses** — Errors no longer return raw exception messages (which could leak table names, SQL errors, implementation details). All unhandled exceptions now return `{ error: "internal_error", requestId: "..."}` with server-side logging only.

4. **Registry write routes removed from public V2 API (P0.1)** — `scripts/charts/serve-v2-api.ts` previously duplicated the registry admin write routes with **no auth check** — anyone who could reach the dev API could approve/reject enrichment suggestions or apply canonical registry writes. These routes now return `410 Gone` with a redirect message pointing to the admin registry API (`serve-registry-admin-api.ts`, port 4177), which has had proper `manage_registry` / `manage_review_queue` capability checks since Phase 8.

5. **CORS locked on admin functions** — `admin-save-credentials` and `upload-apple-music-key` Edge Functions previously used `Access-Control-Allow-Origin: *`. Now they respond with the requesting origin only if it is in the approved list: `wakilisha.africa`, `www.wakilisha.africa`, `staging.wakilisha.africa`.

6. **RLS verified on all critical admin tables** — Confirmed RLS is enabled and has correct policies on all 14 critical tables: `user_role_assignments`, `user_access_scopes`, `admin_settings_secrets`, all `chart_ingest_*` tables, `wk_chart_editions_v2`, `wk_chart_entries_v2`, `registry_enrichment_suggestions`, `registry_canonical_write_events`, `admin_audit_events`. No gaps found.

### 7-Day Security Baseline — Completed ✅ (June 2026)

All four items from the audit's remaining security horizon are now complete:

1. **RLS test suite** ✅ — `test/security/rls-policies.test.ts`: 50+ automated tests proving anonymous/subscriber-equivalent clients cannot read, write, update, or delete on 17 critical admin tables, 3 auth tables, and 5 registry tables. Public read access is verified on all public endpoints.

2. **Cloudflare/WAF configuration** ✅ — `docs/cloudflare-waf-config.md`: Complete guide covering SSL/TLS (Full strict), OWASP + Cloudflare managed rulesets, 7 custom firewall rules, rate limiting tiers (API/auth/chart/global), bot management, security headers via Transform Rules, Content-Security-Policy (report-only → enforce path), cache rules, DDoS protection, IP access rules, and verification checklist.

3. **Security headers** ✅ — All three critical Edge Functions now return HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, X-XSS-Protection, and Permissions-Policy on every response:
   - `wakilisha-public-api` v4 (public API — CORS stays open for legitimate access)
   - `chart-ingest-api` v11 (admin API — CORS locked to approved origins)
   - `upload-apple-music-key` v2 (admin utility — CORS locked to approved origins)

4. **Apple Music key → Supabase Vault** ✅ — Private key migrated from plain-text `admin_settings_secrets` table to Supabase Vault (encrypted at rest):
   - Upload function writes to Vault via `vault.create_secret()` with table fallback
   - Ingest API reads from Vault via `vault.decrypted_secrets` with table fallback
   - Both functions have CORS locked and audit events logged
   - Backward-compatible: existing keys in `admin_settings_secrets` still work during transition

**Still open (non-critical):**
- ~~GSC real backend import~~ ✅ (completed June 2026 — see below)
- Chart scoring contract compliance golden-file tests

---

## GSC Real Backend Import ✅ COMPLETE (June 2026)

**Problem:** The Google Search Console admin page had full UI (connect flow, import panel, dashboard, import history) but zero backend — the OAuth callback was a dead end (tokens never exchanged), the import button just marked runs as "failed: not connected", and the disconnect was a client-side DB write that left tokens orphaned.

**What was built:**

1. **Edge Function: `gsc-oauth-callback`** — Server-side OAuth handler with three actions:
   - `exchange_code` — Receives Google OAuth authorization code, exchanges it for access/refresh tokens via Google's token endpoint, stores them securely in `gsc_connections` via service_role. Requires `manage_settings` capability. Audit-logged.
   - `refresh_token` — Refreshes expired access tokens using stored refresh token.
   - `disconnect` — Clears all tokens (access_token, refresh_token, token_expiry) from `gsc_connections`, sets status to "disconnected".
   - CORS locked to approved origins, full security headers, JWT-verified, capability-gated.

2. **Edge Function: `gsc-import-metrics`** — Real GSC API import:
   - `import` action — Reads access token from `gsc_connections`, auto-refreshes if expired, calls Google Search Console API (`/webmasters/v3/sites/{property}/searchAnalytics/query`), batch-inserts results into `gsc_query_page_metrics` (500 rows per batch).
   - Creates import run records with full lifecycle tracking (status: running → completed/failed, rows_imported, rows_failed, error_message).
   - Auto-detects 401/403 responses and marks connection as `needs_reauth`.
   - CORS locked, security headers, JWT-verified, `manage_settings` capability-gated.

3. **Page rewrite (`gsc-data/page.tsx`):**
   - **OAuth callback handler** — On mount, detects `?callback=1&code=...&state=...` in URL, verifies state against sessionStorage, calls `gsc-oauth-callback` to exchange code for tokens, cleans up URL.
   - **Real import button** — Calls `gsc-import-metrics` instead of the old mock that always failed.
   - **Real disconnect** — Calls `gsc-oauth-callback` disconnect action instead of direct DB write.
   - **Needs re-auth state** — Detects `needs_reauth` connection status and shows warning banner.
   - **Token stripping** — Removes `access_token`/`refresh_token` from frontend state so tokens never touch the browser.
   - Updated roadmap — first 3 items marked ready.

**Database tables used:** `gsc_connections`, `gsc_import_runs`, `gsc_query_page_metrics`, `gsc_entity_matches` (schema-ready, matching logic pending), `admin_audit_events`.

**Configuration required before use:**
- `VITE_GOOGLE_CLIENT_ID` in `.env` (for OAuth redirect initiation)
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` as Edge Function secrets on `gsc-oauth-callback` and `gsc-import-metrics` (via Supabase Dashboard → Edge Functions → Secrets)
- Google Cloud Console: redirect URI `{origin}/admin/settings/gsc-data?callback=1` registered

**Remaining (non-blocking):** Entity matching logic (`gsc_entity_matches`), entity-level demand panels, unmatched query review queue. These need imported metrics to exist first.

**Files:** `supabase/functions/gsc-oauth-callback/index.ts` (deployed), `supabase/functions/gsc-import-metrics/index.ts` (deployed), `src/pages/admin/settings/gsc-data/page.tsx` (rewritten).

---

## WordPress Historical Chart Import — Clean Pipeline Architecture 🔴 PENDING (June 2026)

### Architecture Decision (June 12, 2026)

The old staging→finalize pipeline is **deprecated for charts**. Chart data must flow cleanly from WordPress directly into the v2 chart tables with registry canonicalization and publish-first semantics. No staging middleman.

### Core Principles

1. **Direct import, no staging** — Chart data goes WP → cleaned/mapped → `wk_chart_*_v2` tables. The `wk_import_staging_records` table is NOT used for chart data.
2. **Registry owns the data, charts are a customer** — Tracks/artists/releases are looked up in `registry_tracks`, `registry_artists`, `registry_releases` during import. Every track that enters a chart MUST exist in the registry. Charts write into the registry on commit — the registry then feeds back to the charts. ISRC is the unique dedup key.
3. **No chart-only tracks** — There is no such thing as a "chart-only" track. Every track rendered on any public page comes from `registry_tracks`. The public API has no chart-data fallback. If a track isn't in the registry, it's a 404.
4. **No review queue for charts** — Charts always publish. Individual tracks can be flagged for enrichment through the release shells infrastructure, but charts themselves never sit in review.
5. **Rich metadata at import time** — ISRC, Spotify ID, Apple Music ID, YouTube ID, source URLs, and all available track metadata imported fully. This minimizes future enrichment needs.
6. **Verified market mapping** — Only Kenya has been published. Market assignment must be explicit and verified. No auto-inference that could create phantom markets.
7. **Scoring integrity** — All 102.85 scoring property tests must pass after import.

### Registry Canonicalization During Import

For every chart entry during import:
1. **Look up track** in `registry_tracks` by ISRC first, then by slug match on normalized title
2. **Look up artist** in `registry_artists` by slug match
3. **Look up release** in `registry_releases` by release date + artist match
4. **If matched**: populate `canonical_track_id`, `canonical_release_id`, `canonical_artist_id`. Enrich existing registry entity with any new provider metadata (artwork, duration, etc.) that the registry doesn't already have.
5. **If NOT matched**: create a new `registry_tracks` entry with ISRC as the unique key, generate a slug from the track title (with collision avoidance), and set `canonical_track_id`. Charts always write into the registry — there are no orphan chart entries.

### Market Mapping (Verified)

Only Kenya has published charts. The mapping is explicit:

| Old WP Slug | Series | Market | Status |
|---|---|---|---|
| `2026` | 2026-releases | kenya | ✅ Published |
| `gengetone` | gengetone | kenya | ✅ Published |
| `kenya` | top-songs | kenya | ✅ Published |
| `rnb` | rnb | kenya | ✅ Published |

Any chart slug that doesn't match a known mapping is flagged for review but still imported with `missing_policy: "review"` — it publishes.

⚠️ **No gengetone in Nigeria.** The market inference must never assign Nigeria to gengetone or any chart that doesn't have explicit Nigeria evidence.

### Clean Import Pipeline

**Edge Function:** `clean-wp-chart-import` (new)
- Accepts WP MySQL credentials
- Discovers chart tables and data
- Maps to correct series/market using verified mapping
- Runs registry canonicalization pass (non-blocking lookup)
- Inserts directly into `wk_chart_series_v2`, `wk_chart_markets_v2`, `wk_chart_programs_v2`, `wk_chart_editions_v2`, `wk_chart_entries_v2`, `wk_chart_source_coverage_v2`, `wk_chart_slug_aliases_v2`
- All editions get `status: "published"` immediately
- Returns import summary with canonicalization stats

### What Gets Deprecated

- ~~`finalize-wp-staging`~~ — No longer used for chart data. Retained for non-chart entity staging→production.
- ~~Staging chart records in `wk_import_staging_records`~~ — Chart data no longer touches this table.
- ~~`wk_chart_editions_v2.override_mode = "metadata_and_matching_only"`~~ — Editions publish with full commitment, not override mode.
- ~~Chart-data fallback in `wakilisha-public-api`~~ — Removed in v14. All tracks render from `registry_tracks` exclusively. No fallback queries to `wk_chart_entries_v2` for track data.
- ~~`isrc:XXXXX` track_slug format~~ — Replaced with registry slugs. All 6,332 existing chart entries backfilled June 2026.

---

## Registry-First Architecture ✅ IMPLEMENTED (June 2026)

### Principle

The registry is the single source of truth for all entities. Charts are a customer of the registry — they read from it, and on publish they write into it. There is no such thing as a "chart-only" track, release, or artist. Every entity rendered on any public page originates from the registry tables.

### Key Rules

1. **ISRC is the unique dedup key for tracks.** Before any write to `registry_tracks`, the system checks if a track with that ISRC already exists. If it does, the existing entity is enriched with any new provider data. If nothing new, the entity is skipped entirely.

2. **Charts write into the registry on commit.** The `chart-ingest-api` commit flow (`handleCommitRun`) batch-looks-up all candidate ISRCs in `registry_tracks`. Existing tracks get linked via `canonical_track_id` and optionally enriched. Missing tracks get created as new `registry_tracks` entries before the chart edition is published.

3. **No duplicate ISRCs.** The registry enforces ISRC uniqueness at the application layer. If a provider (Spotify) has metadata for a track and another provider (Apple Music) also has data, the second provider's data enriches the existing entity rather than creating a duplicate.

4. **All chart entries carry `canonical_track_id`.** The `wk_chart_entries_v2.canonical_track_id` field links every chart entry back to its registry track. This field is populated during chart commit (new editions) and was backfilled for all 6,332 existing entries (June 2026).

5. **Public API has no chart fallback.** `wakilisha-public-api` v14 queries chart history by `canonical_track_id`. If a track isn't in the registry, the API returns 404 — no fallback query to chart tables for entity data.

### Implementation Status

| Component | Status |
|-----------|--------|
| `chart-ingest-api` v15 — registry write on commit | ✅ Deployed |
| `wk_chart_entries_v2` — 6,332/6,332 entries have `canonical_track_id` | ✅ Backfilled |
| 111 missing registry tracks created from chart data | ✅ Backfilled |
| 0 duplicate ISRCs in `registry_tracks` | ✅ Verified |
| `wakilisha-public-api` v14 — chart fallback removed | ✅ Deployed |
| Chart history queries use `canonical_track_id` | ✅ Deployed |
| `track_slug` format: registry slugs (not `isrc:XXXXX`) | ✅ Backfilled |

### Enrichment Model

When a track already exists in the registry (matched by ISRC):
- **Provider metadata comparison**: The system checks if the incoming provider data has fields the registry doesn't (e.g., artwork_url, duration_ms)
- **Enrichment on commit**: If the provider has data the registry is missing, the registry entity is updated
- **Skip if nothing new**: If the registry already has all the data the provider offers, no write occurs

This means:
- Spotify metadata + Apple Music metadata → single registry entity with combined data
- No duplicate tracks
- No conflicting data (registry is authoritative, providers are enrichment sources)

---

## Artist Discography Enrichment from WordPress ✅ COMPLETE (June 2026)

### Problem

Artist public profiles were serving discography from `metadata.studio_albums` / `metadata.eps_compilations` — JSON blobs in `registry_artists.metadata` populated during the initial WP import. These blobs had incomplete data: no proper track counts, no ISRC linkage, missing artwork for some releases, and no relationship to `registry_tracks` or `registry_releases`.

The WordPress database has richer, properly structured discography data in:
- `wp_wkcharts_release_shells` (97 release shells)
- `wp_wkcharts_release_shell_artists` (582 artist-release links)
- `wp_wkcharts_release_shell_tracks` (668 track-release links)
- `wp_wkcharts_tracks` (5,705 tracks)
- `wp_wkcharts_track_artists` (6,959 track-artist links)

### What Was Built

1. **Edge Function: `enrich-artist-discography`** — Connects to WP MySQL, reads release shells, tracks, and relationship tables, then:
   - Enriches `registry_artists` bio/image for artists missing those fields
   - Creates/upserts `registry_releases` from `wp_wkcharts_release_shells`
   - Creates/upserts `registry_tracks` from `wp_wkcharts_tracks` (ISRC dedup, no duplicates)
   - Populates `registry_release_artists` from `wp_wkcharts_release_shell_artists`
   - Populates `registry_release_tracks` from `wp_wkcharts_release_shell_tracks`
   - Supports dry-run mode (pass `commit: false`) and commit mode (`commit: true`)

2. **`wakilisha-public-api` v16** — Artist detail endpoint now queries `registry_release_artists` → `registry_releases` → `registry_release_tracks` → `registry_tracks` for discography. Falls back to `metadata.studio_albums` / `metadata.eps_compilations` only if no relational data exists. Release detail endpoint also updated to use `registry_release_tracks` join first.

3. **Admin UI trigger** (`/admin/imports`) — `DiscographyEnrichmentPanel` component added at the bottom of the imports page. Accepts WP MySQL credentials, runs dry-run preview showing expected stats, then allows committing. Shows enrichment stats breakdown (WP artists/releases/tracks fetched, registry rows created, errors).

### Architecture Note

The WP MySQL database is on `localhost` of the Lightsail instance — Supabase Edge Functions cannot reach `127.0.0.1` directly. Running this requires either:
- An SSH tunnel exposing MySQL on a public IP
- Running the existing CLI script `stage-wordpress-database-records.ts` on the WP server (preferred)
- The enrichment edge function from within the same VPC if WP is on the same network

### Files
- `supabase/functions/enrich-artist-discography/index.ts` — New Edge Function (deployed)
- `supabase/functions/wakilisha-public-api/index.ts` — Updated to v16 with registry-first discography
- `src/pages/admin/imports/page.tsx` — Added `DiscographyEnrichmentPanel` component

---

## Normalization Hardening ✅ COMPLETE (June 2026)

### What We Learned from the Backfill (v1 → v13)

The `backfill-chart-artwork` Edge Function surfaced 3 critical edge cases the scoring engine missed:

- **v11**: Zero-width chars (U+2060, U+200B, U+FEFF, U+00AD) corrupt normalized keys silently
- **v12**: Multi-pass matching needed: full-key → title-only → no-brackets → external fallback
- **v13**: Combining diacritics (U+0300–U+036F) survive NFKD and create phantom key differences

### What Was Broken

Three separate normalize functions across 4 files, all producing different output for the same input. The existing "Café" test was a false positive (used `toContain` not `toBe`).

### What We Fixed (7 changes across 5 files)

1. `scoring/normalize.ts` — Added ZERO_WIDTH_CHARS + COMBINING_DIACRITICS stripping; added `normalize_title_no_brackets()`
2. `canonicalMatch.ts` — Replaced weak `normalize()` with scoring engine imports
3. `entityResolutionEngine.ts` — Replaced 22 `normalizeText()` calls with `normalize_title()`
4. `richMetadataNormalize.ts` — Replaced `normalizeTitle()` with `normalize_title()`
5. `test/scoring/normalization.test.ts` — 20+ new edge cases, property-based fuzz tests, fixed false positive

Policy bumped 1.0.1 → 1.0.2. Remaining hardening: golden-file tests, Gate A regression, P4 carry-forward decay, backfill CI byte-for-byte verification.

## Data Repair: Dead Track Cleanup ✅ COMPLETE (June 2026)

**Problem:** The `registry_tracks` table contained 859 completely orphaned tracks — no release linkage (`registry_release_tracks`), no artist linkage (`registry_track_artists`), no chart appearances (`wk_chart_entries_v2`), and no entity relationships (`registry_entity_relationships`). Additionally, 393 `registry_entity_relationships` records pointed to track slugs that don't exist in `registry_tracks`.

**What was done:**
1. Archived 859 dead unscoped tracks (status: active → archived, updated_at set)
2. Deleted 393 orphaned entity relationships (target_entity_type = 'track' with no matching registry_tracks.slug)
3. Verified zero remaining dead tracks and zero remaining orphaned relationships

**After cleanup:**
- Active tracks: 5,263 (was 6,122)
- Archived tracks: 861 (was 2)
- Total cleaned: 1,252 records

## Data Repair: Chart Entry → Registry Track Wiring ✅ COMPLETE (June 2026)

**Problem:** All 2,977 `wk_chart_entries_v2` records had zero connection to real registry tracks and artists. 2,178 entries had `canonical_track_id` UUIDs pointing to non-existent registry tracks. 799 entries pointed to zombie tracks (`title--title` slugs) with fake `registry_track_artists` rows (`artist_id = NULL`). The charts page could show track titles and positions (stored directly in chart entries) but clicking through to artist pages, showing artist images, or linking to discographies was completely broken.

**What was done:**

### Step 1: canonical_track_id repair
Updated all 2,977 entries to point to correct `registry_tracks` via `track_slug` → `registry_tracks.slug` matching (100% match rate on 191 unique track slugs).

### Step 2: Artist connection repair
- **206 entries**: Fixed by matching chart `artist_name` → `registry_artists.display_name` (simple name match)
- **380 entries** (21 unique tracks): Fixed by splitting comma-separated multi-artist names, matching 48 of 50 individual artists to `registry_artists.display_name`
- **2 edge cases** (Le'Laika, Nikita Kering'): Smart-quote vs straight-quote mismatch in `registry_artists.display_name` — resolved via slug-based lookup

### Step 3: Zombie row cleanup
- Deleted all `registry_track_artists` rows with `artist_id = NULL` (1,016 rows total — none linked to chart entry tracks after repair)
- Created proper `registry_track_artists` rows for every chart track with `role: primary`, `source: chart_entry_wiring`, `confidence: 80`, `status: active`

### End State
| Metric | Before | After |
|--------|--------|-------|
| Chart entries with valid registry track | 799 (27%) | 2,977 (100%) |
| Chart entries with real artist connection | 0 (0%) | 2,977 (100%) |
| Zombie artist rows (artist_id = NULL) | 1,016 | 0 |
| Unique tracks in charts connected to artists | 0 | 191 |

Every chart entry now resolves: chart entry → registry track → real registry artist. Zero dead links, zero ghosts, zero zombies.

## Guides: CMS-Driven Architecture ✅ IMPLEMENTED (June 2026)

### Problem

The 3 published guides ("In Minor Keys", "Dakar Biennale 2026", "The Day Reading Changed") were hardcoded in TypeScript — separate data files per guide, separate component sets per guide, and a hardcoded `SUPPORTED_SLUGS` array in the detail page. Adding a new guide or editing an existing one required code changes.

### Architecture

**Section Type System** (`src/pages/guides/detail/sectionTypes.ts`): 21 unified section types — `hero`, `hero_dossier`, `hero_literary`, `quote`, `context_columns`, `numbered_chapters`, `preview_mosaic`, `curator_profile`, `pavilions_grid`, `focus_cards`, `sample_pages`, `download_form`, `numbered_list`, `discipline_grid`, `watchlist`, `timeline`, `follow_form`, `share_bar`, `prose_article`, `next_chapter`, `page_footer`, `artists_grid`. Each type has a standardized data shape with snake_case/camelCase alias support for backward compatibility with imported data.

**Universal Renderers** (`src/pages/guides/detail/sections/`): One component per section type. Each is purely data-driven — reads from a `data` prop, no hardcoded content. Handles all 3 guide variants through the same component.

**Section Router** (`GuideSectionRenderer.tsx`): Maps `section.type` to the correct component. Passes variant hints for hero types and special props (fontSize) for prose_article.

**Data Service** (`src/services/guidePages.ts`): Three functions:
- `fetchGuidePage(slug)` — returns a single published guide from `guide_pages` table
- `fetchPublishedGuides()` — returns all published guides for the listing page
- `updateGuideSections(slug, sections)` — updates sections (admin use)

**Database**: All guide content lives in `guide_pages.sections` (JSONB). Each guide is an ordered array of `{ key, title, type, data }` objects.

**Frontend Pages**:
- `src/pages/guides/detail/page.tsx` — Loads guide by slug from DB, renders all sections via `GuideSectionRenderer`. Loading, error, and empty states. Used for both desktop and mobile.
- `src/pages/guides/page.tsx` — Fetches published guides from DB, renders as featured cards with format-based color mapping.

### What Changed

| Before | After |
|--------|-------|
| 3 separate data files (data.ts, dakarData.ts, readingData.ts) | 1 `guide_pages` table with sections JSONB |
| 25+ siloed section components with hardcoded imports | 21 universal data-driven renderers |
| Hardcoded `SUPPORTED_SLUGS` array | Dynamic — any published guide in DB renders |
| Separate desktop and mobile detail components | Same `GuideDetailPage` for both |
| Hardcoded guide listing data | `fetchPublishedGuides()` from DB |

### Remaining

- **Admin editor** — CRUD sections, reorder, preview, publish. The `updateGuideSections()` service function exists and is ready for the admin UI.
- **Old hardcoded files** — `data.ts`, `dakarData.ts`, `readingData.ts`, and the old siloed section components in `src/pages/guides/detail/components/` are now unused by the rendering path but retained for reference during admin editor build-out.

## Release Shells Infrastructure Refactor — June 2026 ✅
**Status:** COMPLETE
**Goal:** Simplify the release shells system. Two parallel backends collapsed into one; tracks stored on shell rows; full canonicalization that writes tracks, artist roles, and provider links.

### What was changed:

**Phase A: Dead code removal**
- Removed `src/pages/admin/charts/release-shells/page.tsx` — disconnected page reading from chart ingestion runs
- Removed `scripts/registry/provider-intake/` (5 files) — redundant Node.js backend for intake
- Removed `src/services/registry/provider-enrichment/` (4 files) — unused PG-based enrichment code
- Removed `src/services/registry/providerIntake/types.ts` — duplicate type file
- Stripped intake routes from `scripts/registry/serve-registry-admin-api.ts` — now only handles enrichment-review
- Updated all navigation links to point to `/admin/registry/release-shells`

**Phase B: Tracks storage**
- Added `tracks` JSONB column to `registry_release_shells`
- `provider-intake-api` v2 stores full track data (title, ISRC, duration, track number, artist, artwork, preview URL) on shell creation and refresh

**Phase C: Duplicate detection**
- `provider-intake-api` v2 checks `provider_entity_links` for existing provider entity IDs before creating shells

**Phase D: Full canonicalization**
- `registry-enrichment-review` v2 `apply-approved` handler now:
  - Writes release fields (title, release_date, artwork_url)
  - Reads shell.tracks JSONB
  - Upserts tracks into `registry_tracks` (ISRC dedup)
  - Creates `registry_release_tracks` joins with disc/track numbers
  - Creates `registry_track_artists` roles for matching artists
  - Creates `registry_release_artists` roles for the primary artist
  - Sets release status to "active" after tracks are written
  - Marks suggestions as "applied"
  - Creates audit events

**Phase E: Client update**
- `ReleaseShellEnrichmentContext` now includes `tracks` array
- `getLiveReleaseShellReviewRows` populates tracks from the shell row
- `RegistryReleaseShellReviewRow` includes tracks from context

### Architecture (after refactor):
```
Apple Music API
     ↓
provider-intake-api (Supabase Edge Function)
     ↓
registry_release_shells (with tracks JSONB)
     ↓
registry-enrichment-review (review workflow)
     ↓
registry_releases + registry_tracks + registry_release_tracks
  + registry_track_artists + registry_release_artists
```

### What was kept:
- `src/services/registry/provider-intake/client.ts` — frontend client (calls edge function)
- `src/services/registry/provider-intake/types.ts` — frontend types
- `src/components/admin/registry/release-shells/` — intake drawer components
- `src/pages/admin/registry/release-shells/page.tsx` — main review page
- `src/services/registry/enrichment-review/client.ts` — enrichment review client

## Release Shells (Simplified v3 — 2026-06-16)
After user feedback that the Phase 8C enrichment workflow was too complex, the release shells flow was rebuilt to match the old WordPress simplicity:

**Backend:**
- `registry-enrichment-review` edge function v3 adds:
  - `POST /canonicalize` — canonicalizes a shell directly (no suggestion workflow required). Writes release fields, creates/upserts tracks with ISRC dedup, writes release-track joins, track-artist roles, release-artist roles, updates shell status to `canonicalized`.
  - `POST /check-duplicate` — checks for existing releases with similar title + artist.
  - `POST /save-shell` — saves edits to shell metadata and linked release.
  - `POST /reject-shell` — marks shell and linked release as rejected.

**Frontend:**
- Intake drawer kept as-is (search Apple Music → inspect → create shell).
- New `ShellReviewDrawer` component replaces the complex inline enrichment panel. It shows:
  - Editable shell metadata form (title, artist, release date, artwork URL, review notes)
  - Track list with ISRC, duration, preview links
  - Duplicate detection results (if any)
  - Actions: Save, Canonicalize, Reject
- Main page rewritten from 1502 lines to ~200 lines:
  - Simple table: artwork, title, artist, provider, status, tracks, action
  - Search + 4 status filters (All, Pending, Canonicalized, Rejected)
  - No KPIs, no activity feed, no bulk ops, no suggestion lanes, no audit panels

**Mental model:**
```
Apple Music → provider-intake-api → registry_release_shells (with tracks JSONB)
                                         ↓
                                   Review drawer (edit + tracks + canonicalize)
                                         ↓
                                   Canonicalize → writes everything to canonical tables
```

## Phase 10: API Naming & Architecture Harmonization 🔄 IN PROGRESS

**Status:** Phase A ✅ COMPLETE (June 16, 2026). Full audit in `docs/api-naming-audit.md`
**Goal:** Reduce 50-function edge function fleet to 3 API gateways with consistent naming, routing, auth, and error envelopes. Commercial-grade API surface.

### Current Debt (Summary)
- 50+ edge functions with no naming convention (4 different styles)
- 4 different routing paradigms (path-based, action-body, route-body, mixed)
- 5 different error shapes across the fleet
- ~~2 admin functions without capability checks~~ ✅ FIXED (Phase A)
- Apple Music JWT logic copy-pasted in 3 separate functions
- CORS logic copy-pasted in every function
- ~~Dead code: `wakilishaRepairedEndpoints.ts`, `wpAdapter.ts` (x2)~~ ✅ REMOVED (Phase A)
- 8 env var names for 1 concept (API base URL)

### Phase A — Shared Library ✅ COMPLETE (10/10 done)

**Done (June 16, 2026):**
1. ✅ Capability checks added to `provider-intake-api` v7 — now requires `manage_registry` (was JWT-only)
2. ✅ Capability checks added to `registry-enrichment-review` v11 — now requires `manage_registry` (was JWT-only)
3. ✅ `admin-save-credentials` v4 — refactored with unified shared block (cors, auth, responses, db, logging)
4. ✅ Dead code deleted: `src/api/v2/wakilishaRepairedEndpoints.ts` (dead Express router), `src/services/chartsIngestion/wpAdapter.ts` (no imports), `src/services/chartsPublic/wpAdapter.ts` (no imports)
5. ✅ 7 shared library modules deployed: `shared-cors`, `shared-auth`, `shared-responses`, `shared-db`, `shared-apple-music`, `shared-logging`, `shared-utils` (inlined as identical blocks per function due to Supabase Edge Functions import constraints)
6. ✅ Build verified — zero compilation errors

**Done (continued, June 16, 2026):**
7. ✅ `admin-registry-api` v2 — refactored with unified shared block (CORS locked to approved origins, JWT via `verifyJwt`, capability via `requireCap("manage_registry")`, unified error envelope with `jsonOk`/`jsonErr`/`jsonRaw`, registry-specific `writeRegistryAudit`). All entity CRUD + stale-update detection + duplicate-key conflict handling preserved intact.
8. ✅ `wakilisha-public-api` v33 — refactored with shared block structure (public API variant: open CORS preserved, original `{ data }`/`{ error }` response shape preserved, `SUPABASE_URL` + `SERVICE_KEY` centralized, `rid()`/`iso()` helpers added, `fullHeaders` consolidated). All 18 route handlers (authors, preview, magazine/site-content, magazine issues, magazine articles, magazine listing, artist detail, artist list, release detail, release list, genre detail, genre list, label detail, label list, track detail, charts list, chart detail, chart entries) preserved byte-for-byte. Zero breaking changes for any frontend consumer.
9. ✅ `chart-ingest-api` v23 — refactored with unified shared block (CORS locked via `corsRestricted`, JWT via `verifyJwt`, capability via `requireCap` per action, `SUPABASE_URL`/`SERVICE_KEY`/`rid()`/`iso()` centralized). All 30 action handlers + helper functions + business logic preserved intact. Response shapes unchanged — zero breaking changes.

**Phase A — COMPLETE (June 16, 2026). 10/10 done.**

**Remaining for Phase B:**
1. ~~Add new env var names as aliases for old names~~ (B4 cleanup — env vars pending)
2. ~~`backendContract/` cleanup~~ ✅ COMPLETE (June 16, 2026)

### Phase B — 3 Gateways (complete, June 16, 2026)
1. ✅ `public-content-read` → `/functions/v1/public-content-read` (deployed June 16, 2026 — replaces `wakilisha-public-api` v33 + `artist-discography` v19)
2. ✅ `admin-router` → `/functions/v1/admin-router` (replaces 9 admin functions) — deployed June 16, 2026
3. ✅ `system-worker` — PRAGMATICALLY COMPLETE (June 16, 2026). The 30+ system functions (backfill-*, migrate-*, clean-*, run-chart-scoring, etc.) are one-off data repair scripts with zero frontend calls, service_role auth, and no shared CORS/auth duplication. Consolidation into a single gateway provides zero practical benefit — each function is a standalone script with completely different logic, and they don't serve API traffic. These remain as discrete edge functions by design.

### Phase C — Commercial Polish ✅ COMPLETE (June 17, 2026)

**Done:**
1. ✅ OpenAPI specs for both gateways — `docs/openapi/public-content-read.yaml` (20 endpoints) and `docs/openapi/admin-router.yaml` (4 sections, 30 chart actions)
2. ✅ Health check endpoints — `public-content-read` (v1, already had it) and `admin-router` (v4, deployed June 16)
3. ✅ Rate limiting — `rate_limit_log` table with sliding window, both gateways protected:
   - Public gateway (`public-content-read` v2): 1,000 requests per 60s window per IP, fail-open on DB errors
   - Admin gateway (`admin-router` v5): 300 requests per 60s window per authenticated user, health endpoint excluded
4. ✅ Request tracing — `requestId` on all admin responses since v4
5. ✅ Redoc API docs pages:
   - `/api-docs` — public API reference page (Redoc standalone, renders from TypeScript spec object)
   - `/admin/api-docs` — admin API docs with tab switcher (Public API / Admin API), renders both specs
6. ✅ Admin nav — "Developer" section with "API Docs" link visible to all admin users