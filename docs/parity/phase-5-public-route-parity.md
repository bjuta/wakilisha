# Phase 5 — Public Route Parity

## Purpose

Implement public route parity according to the master parity matrix. All React routes must align with the HTML canon and WP verification, while preserving existing React enhancements.

**Note:** The `/magazine` page must be **kept** in this phase and not removed.

## Tasks

| Route | Canon Disposition | React Status | Action | Priority | Notes |
|---|---|---|---|---|---|
| `/charts` | CARRY_OVER | REACT_PRESENT | PROTECT | P0 | Preserve chart families, taxonomical ordering, discover hub. |
| `/charts/:series` | CARRY_OVER | REACT_PRESENT | PROTECT | P0 | Latest edition, preserve movement, rankings, entries. |
| `/charts/:series/:edition` | CARRY_OVER | REACT_PRESENT | PROTECT | P0 | Dated edition, maintain v2 API integration. |
| `/charts/:series/:date` | CARRY_OVER | REACT_PARTIAL | COMPLETE | P1 | Add date-based routing to v2 edition model. |
| `/charts/:series/:cc` | CARRY_OVER | REACT_MISSING | ADD | P1 | Country-specific chart routing. |
| `/charts/:series/:cc/:date` | CARRY_OVER | REACT_MISSING | ADD | P1 | Country + date chart edition route. |
| `/charts/discover` | CARRY_OVER | REACT_MISSING | ADD | P1 | Chart discovery hub. |
| `/charts/discover/:x` | CARRY_OVER | REACT_MISSING | ADD | P2 | Subroute discovery. |
| `/artists` | CARRY_OVER | REACT_PRESENT | KEEP | P1 | Registry-backed artist directory with filters. |
| `/artists/:slug` | CARRY_OVER | REACT_PRESENT | KEEP | P1 | Preserve canonical artist relationships, releases, tracks. |
| `/tracks/:slug` | CARRY_OVER | REACT_PRESENT | KEEP | P1 | Chart history, player integration, artist links. |
| `/releases` | CARRY_OVER | REACT_PRESENT | KEEP | P1 | Enhanced React releases directory. |
| `/releases/:slug` | CARRY_OVER | REACT_PRESENT | KEEP | P1 | Release tracks, artists, labels, artwork. |
| `/genres` | CARRY_OVER | REACT_PRESENT | PROTECT | P1 | Preserve taxonomical ordering, filters. |
| `/genres/:slug` | CARRY_OVER | REACT_MISSING | ADD | P1 | Canonical genre detail route. |
| `/labels` | CARRY_OVER | REACT_PRESENT | KEEP | P1 | Enhanced label archive. |
| `/labels/:slug` | CARRY_OVER | REACT_MISSING | ADD | P1 | Label detail page. |
| `/collections` | CARRY_OVER | REACT_MISSING | ADD | P1 | Collection directory. |
| `/collections/:slug` | CARRY_OVER | REACT_MISSING | ADD | P1 | Collection detail page. |
| `/@:username` | CARRY_OVER | REACT_MISSING | ADD | P2 | Public profile route over user graph. |
| `/profile` | CARRY_OVER | REACT_PRESENT | COMPLETE | P2 | Tokenized profile with preferences/follows. |
| `/settings` | CONSOLIDATE | REACT_PARTIAL | CONSOLIDATE | P2 | Unified settings domain. |
| `/my-top-10` | CONSOLIDATE | REACT_MISSING | ADD | P2 | Native Top 10 feature. |
| `/my-top-10/:token` | CONSOLIDATE | REACT_MISSING | ADD | P2 | Shareable token route. |
| `/corrections` | CONSOLIDATE | REACT_MISSING | ADD | P2 | Governance-backed correction workflow. |
| `/corrections/submitted` | CONSOLIDATE | REACT_MISSING | ADD | P2 | Correction confirmation. |
| `/corrections/:type/:id` | CONSOLIDATE | REACT_MISSING | ADD | P2 | Entity-specific correction form. |
| `/magazine` | DROP | REACT_PRESENT | KEEP | P4 | Must remain per instructions; do not remove. |
| `/magazine/:slug` | DROP | REACT_PRESENT | KEEP | P4 | Must remain per instructions; do not remove. |
| `/search` | CARRY_OVER | REACT_PRESENT | KEEP | P1 | Registry-wide search. |
| `/player` | CARRY_OVER | REACT_PRESENT | PROTECT | P1 | Maintain desktop/mobile player. |
| `/auth` | CONSOLIDATE | REACT_PARTIAL | COMPLETE | P2 | Token/session flows, Apple sign-in, reset/verify/register. |

## Next Steps

1. Implement missing routes (`ADD`) and complete partial implementations (`COMPLETE`).
2. QA existing routes for data fidelity, layout, light/dark mode, and mobile/desktop.
3. Verify registry API integration for all newly added routes.
4. Preserve all `/magazine` pages without modification.
5. Prepare for Phase 6 — API parity foundation.