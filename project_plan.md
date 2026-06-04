# WAKILISHA — African Culture Infrastructure Platform

## 1. Project Description
WAKILISHA is a premier cultural institution and digital platform dedicated to preserving, promoting, and investing in African creative life. It builds the systems — discovery, documentation, funding, valuation, and sustainability — that help African creative work travel further, last longer, and generate meaningful value.

The platform spans seven cultural verticals, designed as an intentional ecosystem:
- **Music** (mature — Charts, artists, tracks, releases, labels, genres)
- **Guides** (launched — practical discovery layer for culture)
- **Film** (future — filmmaker profiles, cinema, documentaries, festivals)
- **Fashion / Style** (future — designers, textiles, editorials, aesthetics)
- **Food** (future — chefs, street food, histories, culinary routes)
- **Language** (future — indigenous archives, oral histories, annotation)
- **Places / Travel** (future — venues, cities, festivals, cultural routes)

Music is the first major proof layer. Guides is the recently launched second. The remaining verticals have designed landing pages and will grow over time.

## 2. Public Page Routes
- `/` — Home (institutional — seven pillars, flagship Charts, Guides, Magazine, newsletter)
- `/charts` — Charts directory
- `/charts/:series` — Chart edition
- `/charts/:series/:edition` — Chart edition (canonical)
- `/guides` — Guides listing
- `/film` — Film (coming soon)
- `/fashion` — Fashion (coming soon)
- `/food` — Food (coming soon)
- `/language` — Language (coming soon)
- `/places` — Places (coming soon)
- `/artists` — Artist directory
- `/artists/:slug` — Artist detail
- `/tracks/:slug` — Track detail
- `/releases/:artistSlug/:releaseSlug` — Release detail
- `/genres` — Genre directory
- `/labels` — Label directory
- `/magazine` — Magazine
- `/magazine/:slug` — Article
- `/search` — Search
- `/player` — Desktop player
- `/profile` — Profile
- `/settings` — Settings
- `/authors/:slug` — Author profile

## 3. Admin Routes
(Chart Ingestion Studio — see original plan for full admin route listing)

## 4. Design System
- WAKILISHA Design System v5 with dark/light theme
- Vertical color tokens: `--wk-v-music`, `--wk-v-film`, `--wk-v-fashion`, `--wk-v-food`, `--wk-v-language`, `--wk-v-dance`, `--wk-v-places`, `--wk-v-intel`
- Brand: green (`--wk-brand`), institutional identity
- Fonts: Inter (display/UI), DM Sans (body), DM Mono (code)

## 5. Development Phase Plan

### ✅ Phase 0 — Chart Ingestion Studio (Admin)
Complete. See original project plan for details.

### ✅ Phase 1 — Institutional Homepage + Verticals Framework (CURRENT)
- Institutional homepage (desktop + mobile) with mission, seven pillars, flagship Charts, Guides preview, Magazine, newsletter
- Navigation and footer updated to reflect cultural institution identity
- Guides public listing page
- Five vertical "coming soon" landing pages (Film, Fashion, Food, Language, Places)
- All routes wired

### ⏳ Phase 2 — Guides Deepening
- Guide detail pages
- Guide categories and filtering
- Related guides and discovery cross-linking

### ⏳ Phase 3 — First New Vertical Launch
- Choose next vertical to build (likely Film or Food)
- Build full vertical infrastructure: entity types, listing, detail, discovery
- Cross-link with existing verticals

### ⏳ Phase 4+ — Continue Vertical Expansion
- Repeat for remaining verticals
- Build shared infrastructure: cross-vertical search, unified discovery, contributor system