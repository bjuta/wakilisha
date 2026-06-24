# WAKILISHA Design System Admin + Full App Parity Plan

## Source of truth

The uploaded `wakilisha-design-system-v5.html` is now treated as the visual constitution for the React rebuild. It defines 54 chapters across foundations, product primitives, media/editorial surfaces, reach, implementation rules, and React app UI archetypes.

The first implementation order is no longer “make pages pretty.” It is:

1. Install the design system as app infrastructure.
2. Make the design system browsable and interactive inside admin.
3. Replace every current prototype/mock surface with graph-backed pages that obey the system.
4. Add page-level parity gates before any page can be called complete.

## Repository additions

The repo now includes:

```text
packages/design-system/src/wakilisha.tokens.css
packages/design-system/src/designSystemManifest.ts
```

These are not decorative assets. They are the implementation bridge from the HTML design bible into React.

## Phase 1 — Install the system globally

### Files to wire

Import the token file once at the app root:

```ts
import '@wakilisha/design-system/wakilisha.tokens.css';
```

If aliases are not configured yet, import by relative path until package workspaces are formalized:

```ts
import '../../../packages/design-system/src/wakilisha.tokens.css';
```

### Required root behavior

The React app shell must set:

```html
<html data-wk-theme="dark">
```

or, inside the app root:

```tsx
<div className="wk-app-shell" data-wk-theme={theme}>
```

Theme mode must switch via `data-wk-theme`, not separate dark-mode class piles.

### Rules

- No new hard-coded colors.
- No generic Tailwind palette classes for brand/system colors.
- No one-off spacing values where a `--wk-s-*` token exists.
- No pages that bypass shared hero/card/row/player primitives.

## Phase 2 — Build `/admin/design-system`

This is the first admin product surface to build.

It is not a static PDF viewer. It is a living tool for admins, editors, designers, and devs.

### Route

```text
/admin/design-system
```

### Data source

Use:

```ts
packages/design-system/src/designSystemManifest.ts
```

### Required layout

Desktop:

- Sticky admin top bar.
- Left chapter navigation grouped by:
  - Foundations
  - Product
  - Media & Editorial
  - Reach
  - Implementation
  - React App UI
- Main chapter browser.
- Right-side page parity panel when a route is selected.

Mobile:

- Collapsible chapter drawer.
- Search first.
- Chapter cards stacked.
- Sticky “current chapter” mini header.

### Required features

1. Chapter browser
   - Browse all 54 chapters.
   - Filter by group.
   - Search by title, purpose, rules, and parity targets.

2. Token inspector
   - Show color tokens for dark and light mode.
   - Show spacing scale.
   - Show radius scale.
   - Show typography scale.
   - Show motion scale.

3. Component specimen wall
   - Buttons.
   - Tags/badges.
   - Cards/surfaces.
   - Track rows.
   - Chart rows.
   - Artist cards.
   - Genre cards.
   - Magazine cards.
   - Player dock/sheet/theater specimens.
   - Modal/sheet specimens.

4. Page archetype map
   - Show each route and the design chapters it must obey.
   - Each route should display required components and data source.

5. QA checklist
   - Data-backed: pass/fail.
   - No mock data: pass/fail.
   - Token compliance: pass/fail.
   - Mobile behavior: pass/fail.
   - Accessibility: pass/fail.
   - Voice/copy: pass/fail.

6. Theme toggle
   - Switch dark/light live.
   - The whole admin design-system page must update through tokens.

### Admin design language

Use Chapter 50 Admin Areas:

- Admin breadcrumb bar.
- KPI cards.
- Review tables.
- Design-system browser.
- Same tokens as public UI.

Do not make admin look like a detached CMS template.

## Phase 3 — Component foundation

Create shared components before rebuilding pages.

Suggested structure:

```text
apps/web/src/design-system/
  theme/
    ThemeProvider.tsx
    useTheme.ts
  primitives/
    Button.tsx
    IconButton.tsx
    Tag.tsx
    Surface.tsx
    PageShell.tsx
    PageHero.tsx
    StateBlock.tsx
    Modal.tsx
    Sheet.tsx
  media/
    WkImage.tsx
    EntityArtwork.tsx
    HeroScrim.tsx
  music/
    TrackRow.tsx
    ChartRow.tsx
    PlayerDock.tsx
    PlayerSheet.tsx
    ReleaseTrackRow.tsx
  registry/
    ArtistCard.tsx
    ReleaseCard.tsx
    LabelCard.tsx
    GenreCard.tsx
  editorial/
    StoryCard.tsx
    MagazineHero.tsx
    ArticleBody.tsx
  admin/
    AdminBar.tsx
    AdminKpi.tsx
    AdminTable.tsx
    DesignChapterCard.tsx
```

## Phase 4 — Data payload layer before public page rebuild

Every public page must consume graph-backed payloads, not mock data.

Create:

```text
packages/data/src/payloads/
  artistPayload.ts
  trackPayload.ts
  releasePayload.ts
  labelPayload.ts
  genrePayload.ts
  chartPayload.ts
  magazinePayload.ts
  homePayload.ts
```

Payloads must read from repaired tables:

```text
wakilisha_repaired.entity_slugs
wakilisha_repaired.entity_relationships
wakilisha_repaired.track_artists
wakilisha_repaired.release_tracks
wakilisha_repaired.artist_genres
wakilisha_repaired.track_playback_sources
wakilisha_repaired.content_route_classification
wakilisha_repaired.review_queue
```

No page should import raw CSVs or hard-coded fixture arrays.

## Phase 5 — Full page parity rebuild

All pages must be rebuilt around design-system chapters.

### `/`

Archetype: Home / cultural graph overview.

Must use chapters:

- 01 North Star
- 04 Color
- 05 Typography
- 06 Spacing & Layout
- 13 Cards & Surfaces
- 16 Player System
- 19 Image System
- 21 Charts & Rankings
- 22 Registry
- 35 Hero Sections
- 38 Magazine Page

Required content:

- Cinematic graph-backed hero.
- Current/featured chart module.
- Featured artists from real relationships.
- Releases from release graph.
- Genre discovery from artist_genres.
- Label/industry module.
- Editorial module from content classification.
- Footer with graph counts.

### `/charts` and chart edition pages

Must use chapters 21, 39, 15, 16.

Required:

- Chart hero.
- Ranked rows.
- Expandable chart rows.
- Playable preview when playback exists.
- Track and artist links.
- Label/metadata.
- Movement/history only when data exists. Do not fabricate.

### `/artists` and `/artists/:slug`

Must use chapters 22, 37, 35.

Required:

- Directory grid/list toggle.
- Search/filter.
- Artist cards with real track/release/genre/chart counts.
- Artist detail page with tracks, releases, genres, chart appearances, media.

### `/tracks/:slug`

Must use chapters 16, 21, 22, 40.

Required:

- Track hero.
- Real artist links.
- Playback sources.
- Artwork/media.
- ISRC/provider/source when available.
- Release relationships.
- Chart appearances.

### `/releases` and `/releases/:slug`

Must use chapters 41, 42, 22.

Required:

- Catalog filters: album, EP, single, review-needed if internal.
- Release cards with track count, label, artist.
- Release detail with tracklist from release_tracks.
- Label and related artist links.
- Quick-view modal.

### `/genres` and `/genres/:slug`

Must use chapter 36.

Required:

- Genre cards with counts.
- Representative artists/tracks.
- Genre page exposing related artists and tracks.

### `/labels` and `/labels/:slug`

Must use chapter 43.

Required:

- Label directory with releases/artists counts.
- Label page with releases, artists, tracks, chart activity if available.

### `/magazine` and `/magazine/:slug`

Must use chapters 20, 38, 44.

Required:

- Feature story.
- Sections.
- Story cards.
- Real classified editorial only.
- Exclude app shells and utility pages.
- Article pages with reading width, byline, hero, related graph embeds.

### User/profile/settings/admin pages

Must use chapters 48, 49, 50, 51, 52.

Build after public registry/chart/magazine parity unless auth is already required.

## Phase 6 — Anti-slop gate

A page fails if any of the following are true:

- Uses mock data in production route.
- Hard-codes WAKILISHA content already available in repaired graph.
- Uses non-token colors.
- Uses generic CTAs like “Learn more” where a specific action exists.
- Has desktop-only layout with collapsed mobile afterthought.
- Uses fake chart movement/history.
- Shows a play button where no playback source exists.
- Ignores image fallback/attribution.
- Has no empty/loading/error state.
- Does not map to a design-system chapter/archetype.

## Immediate implementation order

1. Import `wakilisha.tokens.css` globally.
2. Build `/admin/design-system` from `designSystemManifest.ts`.
3. Add component primitives.
4. Add page archetype map to admin.
5. Build payload layer.
6. Rebuild pages in this order:
   - Home
   - Charts
   - Track detail
   - Artist directory/detail
   - Releases directory/detail
   - Genres
   - Labels
   - Magazine/articles
7. Add mobile pass.
8. Add QA pass.

## Acceptance gate for this phase

The phase is complete only when:

- `/admin/design-system` exists and is useful.
- Admin can browse all design-system chapters.
- Theme toggle works.
- Token specimens render.
- Page archetype map exists.
- At least home, charts, artists, tracks, releases, genres, labels, and magazine have parity plans inside the admin tool.
- Public UI uses tokens globally.
- Mock data is removed from production routes.
