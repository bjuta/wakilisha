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