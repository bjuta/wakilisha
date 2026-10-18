# WAKILISHA Workbook v4: page-fidelity release gate

**Date:** 18 October 2026  
**Source authority:** Owner-provided MIZIZI WAKILISHA Brand Workbook, P1–P3 and P6 (Following), P7 (Messages), P8 (Notifications), P9 (Music), P10 (Magazine), P11 (Single article), plus owner-provided actual Production captures at 390px and desktop.  
**Branch / PR:** `feat/workbook-v4-visual-fidelity-convergence-20261018` / #1255. Supersedes neither the workbook nor merged source PR #1253.

## Nonnegotiable design
- WAKILISHA uses editorial Figtree/Plex typography. The workbook has TWO authored theme palettes, not a generic inversion: light canvas #FCFCFB, white surface, ink text, brand #4E7425; dark canvas #0B0B0B, charcoal surfaces, soft-white text, brand #85C441. The live app theme switch must apply the respective workbook palette to every redesigned route, element, field, card and state. Dark photographic hero overlays are allowed in either theme to preserve text contrast. **Owner's post-Production correction (PR #1256):** Article now uses the standard WAKILISHA light canvas #FCFCFB (not warm paper) and standard dark canvas #0B0B0B. Don't invent content, awards, or endorsement states.
- Full release/playlist covers are square and **uncropped**. Standard editorial photographs are 3:2; Magazine inline video retains its own ratio; artist portraits are 4:5. Single-article hero is 3:2 desktop and 4:5 phone, with a genuine aspect-ratio container in loaded and loading states. Never let a global object-fit rule override artwork's contained fit.
- Magazine order: cover, Editor's Picks, Latest, artists, published-content sections, guide, one newsletter CTA. Sections are content-backed filters of the initial 24-story set, never dummy tabs or an expensive full-archive fetch. Editorial card: image, category ink, readable title, visible excerpt where supplied, byline. Newsletter never appears in the admin-reorderable region.
- Article body: standard WAKILISHA light and dark canvases as directed in the post-Production review; 680px inner measure, desktop 19px/1.7 body, readable lede and heading levels, theme-contrasted pull-quote rule, unboxed inline media, source-backed release/artist/track embeds, author/credit and community, one existing share action per routed viewport, related story imagery 3:2, one balanced stacked newsletter after related stories.
- Music: release-first hero with uncropped cover and real Play/Share/Release actions, published releases, ranked chart entries, published genre tiles, usable discovery links. No inert carousel arrows, generic repeated 'go deeper' tiles, or invented genre names.
- Following: readable one-column feed, user composer and interactions, media framing by type, genuine All / Artists Only filter based on followed artist matching, not fabricated posts.
- Messages: conversation list left, messages right on desktop; own messages green, incoming grey, live request/spam/archive, sender approval controls, reporting, message/reference rendering and composer. Do not shortcut messaging authority or drop existing functional actions.
- Notifications: list filters and New/Earlier groupings remain; the right-hand desktop "Tell me about" panel exposes real artist-drop, reply, mention and contribution toggles through the existing scoped preference RPCs. It also links to full settings. Live-party and separate credit-specific alert toggles are **not** claimed without backend support. No profile-wide save.
- Every data-empty or auth-absent CI screenshot represents only route chrome, not article/image fidelity or authenticated workflow acceptance.

## Source changes
| Page | Contract |
| --- | --- |
| Magazine desktop/mobile | 3:2 image frames, rounded editorial photography, readable headline/excerpt, category ink, bounded mobile initial article set, one plain final newsletter form |
| Article desktop/mobile | Real 3:2 and 4:5 hero frames, standard WAKILISHA themed reading canvas, 19px desktop editorial body, flat inline images, related 3:2 imagery and one final stacked CTA |
| Music | Workbook-authored night and paper themes, contained 1:1 featured cover, real releases, charts and genres, source-backed navigation, no inert arrival arrows |
| Notifications | Content list, grouped timeline and real desktop preference toggles for supported settings; full settings link |
| Messages | Larger correspondence type and clear message colour hierarchy, all existing folder/action and security behavior kept |
| Following | Native image geometry, quieter labels, functional followed-artist view and existing social interactions |

## Mandatory exit gates (not yet satisfied)
1. **Source:** modified tests, legacy tests and full critical control plane green at exact head; no changes to database or Edge; no secret or provider parity assumptions.
2. **Responsive:** real 390px / 768px / 1440px browser screenshots, no overflow; Music cover **uncropped**; Magazine P10 structure in the owner workbook; Article P11 body and photo layout; Notifications side pane desktop and list mobile; Messages dual-pane and phone thread; Following media geometry.
3. **Data-filled:** published articles with actual cover images and category/lede; recorded release art with accurate square frames; published genre and chart entries. CI without these entities is not complete visual acceptance.
4. **Authenticated:** a real user can open notifications, filter/mark read, open Messages Inbox/Requests/Spam/Archive, send a message, open attachment/approval controls, and exercise the Following composer/Artists Only filter. No synthetic approval or moderation effect.
5. **Release:** protected review and merge, the canonical exact-merged-main Production frontend runner with the existing Lightsail key, rollback snapshot and smoke, then Production visual/data/user acceptance. Source merge does not deploy Lightsail.
6. **Separate security:** unresolved MIZIZI JIT Production temporary-access-at-rest condition must be independently verified by its owning slice; don't report it as passed through frontend CI.

**Deployment classification:** SQL no. Edge no. Frontend yes, pending protected merge and actual Lightsail activation. Production Finish Update no separate action. PR #1255 source only until gates pass.

This document records requirements and current implementation, **not** Production acceptance.


## Owner's post-Production correction, PR #1256

The owner-provided live captures of 18 October supersede this release's former warm-paper article canvas and compact in-line newsletter layout. Magazine mobile navigation must include genuinely swipeable source-backed story shelves rather than a category-by-category long wall. See `docs/engineering/workbook-v4-live-fidelity-refinement-20261018.md` for the later detailed visual requirements and acceptance record. The original PR #1255 historical outcomes remain unchanged.
