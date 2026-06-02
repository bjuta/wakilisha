# Phase 3 — React App Audit Against HTML Canon

## Purpose

Audit the current React app against the HTML canon and WP plugin verification. Preserve the newly developed charts family, taxonomical ordering, and React-specific improvements, and align all features with the canon rather than reducing to WP HTML or legacy layouts.

This audit should:
1. Identify which HTML-verified features are already implemented in React.
2. Identify missing features or partial implementations.
3. Identify React-specific enhancements that go beyond WordPress (e.g., chart families, taxonomical ordering, design system improvements).
4. Provide actionable guidance for Phase 4 (master parity matrix) to drive implementation.

## Verification Columns

| Domain | Feature / Capability | HTML Canon Disposition | WP Verified | React Status | Notes / React Enhancements |
|---|---|---|---|---|---|
| Charts | Charts directory `/charts` | CARRY_OVER | CONFIRMED | IMPLEMENTED | React maintains full chart families; supports discover, latest edition, country & date variants. |
| Charts | Chart edition `/charts/:series/:edition` | CARRY_OVER | CONFIRMED | IMPLEMENTED | React renders chart entries, preserves rankings, movement, artist relationships, track links. |
| Artists | Artist detail `/artists/:slug` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Maintains canonical artist/genre/label relationships; enhanced UI over WP template. |
| Tracks | Track detail `/tracks/:slug` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Preserves historical chart performance, artist linkages, player integration. |
| Releases | Release detail `/releases/:slug` | CARRY_OVER | CONFIRMED | IMPLEMENTED | React combines multiple release types (EP/single/album) with canonical track association. |
| Labels | Label detail `/labels/:slug` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Supports registry-linked releases, tracks; enhanced directory features. |
| Genres | Genre directory `/genres` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Canonical genre table with taxonomical ordering; supports enhanced filtering. |
| Collections | Collection directory `/collections` | CARRY_OVER | CONFIRMED | PARTIAL | Needs `/collections/:slug` detail route; React supports family/edition mapping already. |
| User Profiles | Public profile `/@:username` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Supports follow graph and content feed; improved layout vs WP shell. |
| Top 10 | My Top 10 `/my-top-10` | CONSOLIDATE | CONFIRMED | PARTIAL | Shareable token route exists; UI integrated with React player and registry. |
| Settings | `/settings` | CONSOLIDATE | CONFIRMED | PARTIAL | React unified settings framework partially implemented; appearance & player defaults need consolidation. |
| Profile | `/profile` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Profile data backed by tokenized user graph; includes preferences. |
| Corrections | `/corrections` | CONSOLIDATE | CONFIRMED | PARTIAL | React has workflow, but submission & audit UI enhancements pending. |
| Ingestion | Ingest Studio `/admin/charts/ingest` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Supports dry run, commit, snapshot; preserves new job queue and polling improvements. |
| Admin Charts | Admin dashboard `/admin/charts/dashboard` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Consolidates chart analytics and QA tools; maintains new taxonomy ordering. |
| Design System | `/admin/design-system` | NEW_IN_REACT | CONFIRMED | IMPLEMENTED | Fully React-native, uses design tokens and element foundation; enhances WP admin approach. |
| Player | Desktop & mobile player `/player` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Maintains playback defaults, motion, audible UI, playlist state. |
| Public Search | `/search` | CARRY_OVER | CONFIRMED | IMPLEMENTED | Enhanced React search with filters and registry integration. |
| Magazine & Editorial | `/magazine`, `/magazine/:slug` | DROP | CONFIRMED | OMITTED | Editorial templates intentionally excluded; React may support CMS/static content separately. |
| Play Lab | `/play`, `/play/app` | DROP | CONFIRMED | OMITTED | Explicitly excluded from parity; React `/player` remains. |
| Content Studio | GSC content idea/draft | DROP | CONFIRMED | OMITTED | Only analytics import survives; no content-generation features ported. |
| API Routes | Registry API `/wkcharts/v1` | CARRY_OVER | CONFIRMED | PARTIAL | React consumes chart, entity, search, user graph APIs; missing any advanced GSC analytics or audit routes. |
| Auth | `/auth` flows | CONSOLIDATE | CONFIRMED | PARTIAL | Tokenized auth implemented; social sign-in (Apple) present; legacy WP cookies removed. |
| Jobs & Scheduler | Cron & queue | CARRY_OVER | CONFIRMED | PARTIAL | Job queue exists in React backend; some legacy cron hooks need mapping to real queue service. |

## Notes
- **Maintain React Enhancements**: All chart family structures, taxonomical ordering, and any UI/UX improvements in React are preserved as the new baseline.
- **Align Canon**: Every feature is cross-checked with HTML/WP; enhancements are noted in the `Notes / React Enhancements` column.
- **Partial Implementations**: Marked as `PARTIAL` and scheduled for Phase 4 (master parity matrix) to plan completion.
- **Dropped Features**: Explicitly omitted to prevent regression to WordPress-era structures.

## Next Steps
1. Populate the master parity matrix using this audit and the Phase 2 WP plugin verification.
2. Identify gaps in React for `PARTIAL` items.
3. Plan phased implementation for alignment and enhancement completion.