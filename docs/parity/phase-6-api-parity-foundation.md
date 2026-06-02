# Phase 6 — API Parity Foundation

## Purpose

Document and implement API parity for the React rebuild. All React pages/routes must have API endpoints aligned with HTML canon and WP verification, preserving v2 chart API and chart-family enhancements.

## Endpoint Categories

| Domain | Endpoint | HTML Disposition | WP Verified | React Status | Action | Priority | Notes |
|---|---|---|---|---|---|---|---|
| Charts | `/wp-json/wakilisha/v2/charts/health` | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Health, readiness, edition counts, totals. |
| Charts | `/wp-json/wakilisha/v2/charts` | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P0 | List all chart programs/families with chart-family data. |
| Charts | `/wp-json/wakilisha/v2/charts/resolve/:series` | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P0 | Resolve aliases to canonical series. |
| Charts | `/wp-json/wakilisha/v2/charts/:series/latest` | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P0 | Latest edition with normalized entries. |
| Charts | `/wp-json/wakilisha/v2/charts/:series/:edition/entries` | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P0 | Paginated, sorted, normalized entries. |
| Tracks | `/wp-json/wakilisha/v2/tracks/:id/chart-history` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P1 | Historical chart positions for track pages. |
| Artists | `/wp-json/wakilisha/v2/artists/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P1 | Artist data, relationships, releases, genres. |
| Tracks | `/wp-json/wakilisha/v2/tracks/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P1 | Track metadata, chart history, artist links, releases. |
| Releases | `/wp-json/wakilisha/v2/releases/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P1 | Release metadata, tracks, labels, artists. |
| Labels | `/wp-json/wakilisha/v2/labels/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P1 | Label details, relationships, chart presence. |
| Genres | `/wp-json/wakilisha/v2/genres/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P1 | Canonical genre hierarchy/taxonomy. |
| Collections | `/wp-json/wakilisha/v2/collections/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P1 | Collection directory/detail. |
| User Graph | `/wp-json/wakilisha/v2/follow/entity` | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P2 | Generic follow/unfollow API. |
| User Graph | `/wp-json/wakilisha/v2/me/feed` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P2 | Personalized feed data. |
| User Graph | `/wp-json/wakilisha/v2/me/recommendations` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P2 | Recommendations endpoint. |
| User Graph | `/wp-json/wakilisha/v2/me/identity` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P2 | Identity snapshot endpoint. |
| Auth | `/wp-json/wakilisha/v2/auth/signin` | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P2 | Token/session auth; remove WP cookies. |
| Auth | `/wp-json/wakilisha/v2/auth/register` | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P2 | Register flow, email verification, token issuance. |
| Auth | `/wp-json/wakilisha/v2/auth/reset` | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P2 | Reset password flow, token-based. |
| Preferences | `/wp-json/wakilisha/v2/preferences` | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P2 | Display, audible, notifications consolidated. |
| Corrections | `/wp-json/wakilisha/v2/corrections` | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING | ADD | P2 | Correction submission and status. |
| Analytics | `/wp-json/wakilisha/v2/analytics/events` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P3 | Capture share/search/site/internal events. |
| GSC | `/wp-json/wakilisha/v2/gsc/import` | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING | DEFER | P3 | Keep import/matching only; no content studio. |

## Next Steps

1. Implement missing API endpoints (`ADD`/`COMPLETE`).
2. Verify all endpoints against registry data (no prebuilt buckets).
3. Standardize request/response formats, pagination, error handling.
4. Preserve v2 chart API enhancements.
5. Integrate all endpoints with Phase 5 React routes/pages.
6. Prepare for Phase 7 — Registry-backed public pages.