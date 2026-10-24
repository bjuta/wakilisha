# Workbook v4: live visual fidelity refinement

**Date:** 18 October 2026  
**Baseline:** Production successfully activated at merged `932936926add72f75a2aba8d38e41e91d932e2b7` (PR #1255). Exact-origin and public asset SHA parity, nginx, and HTTP smoke passed.  
**Evidence:** Owner's same-day Production desktop/mobile screen captures and original Workbook P6 (Following), P7 (Messages), P8 (Notifications), P9 (Music), P10 (Magazine), P11 (Article), plus Video/Podcasts.

## Observed frontend mismatches

1. Magazine's primary review/feature card clipped headline and summary with `line-clamp`. Compact right-hand tiles were overly compressed.
2. Mobile Magazine had category filters, but the **All** view stacked every section's stories vertically. The content needed swipeable browsing by real published category, not extra dummy links.
3. Magazine and Article newsletters used a compact two-column CTA in narrow wrappers, squeezing the heading beside the form.
4. Article light reading canvas incorrectly used warm paper `#F5F2EC`; the owner wants the normal WAKILISHA light background. Dark mode must remain fully legible.
5. Music's unavailable-art gradient tiles looked like placeholders; chart type was too small; genre discovery needed distinct source-backed links. Square Release/Playlist/Chart art must remain uncropped.
6. Following's avatar, media, copy and actions did not align as a unified actor-led timeline; Messages' selected conversation and Notifications' activity icon/actor hierarchy were visually weak.
7. The Video Watch pill lost its dark text through a generic hero text selector; a Podcast typography cover could show white title on a pale surface.

## Scope and implementation

- Mobile Magazine uses native horizontal scroll/snap shelves of real stories; selected category filtering still reveals the full available set. No fake content or duplicate data.
- Magazine featured cards retain their photo overlay but allow flexible text height. Other cards remain responsive 3:2 editorial images.
- The existing `NewsletterSubscribe` component keeps its subscription writer. Only Magazine and Article instances switch to the default stacked headline/form layout; the custom mobile Magazine form stays unchanged in submission authority.
- Article returns to `#FCFCFB` light and `#0B0B0B` dark through current WAKILISHA theme tokens. Photographic hero overlays continue to use intentional white-on-dark copy.
- Music keeps its existing published Registry/Chart/Genre/Playlist APIs and Play/Share/Add-to-Playlist actions. Missing artwork renders a plain neutral icon or a compact text-led browse card, never counterfeit covers. Release art uses `object-contain`.
- Following preserves real governed feed and social actions. Messages folders, approvals, moderation and composer, and Notification scoped preference RPCs are unchanged.
- Video/Shows correct foreground contrast with existing content, no data contract changes.

## Verification and release discipline

Extend the **existing** Workbook source test, browser theme and viewport acceptance; do not add a separate permanent workflow. Protected Core, Browser and aggregate must all pass at exact PR head.

Before merge, inspect rendered desktop/phone light-and-dark screenshots with genuine content, including Magazine P10, Article P11, Music P9, Following P6 and authenticated Messages/Notifications P7/P8. An empty-state or unauthenticated capture is only shell evidence.

**Deployment:** SQL: No. Supabase Edge: No. Registry/Data: No. Artist and Artist detail: Untouched. Frontend: Only after protected merge, through canonical exact-main Lightsail runner using correct Mac worktree ownership. Separate Production Finish Update: No. Record rollback path and post-deploy smoke evidence before claiming live acceptance.
