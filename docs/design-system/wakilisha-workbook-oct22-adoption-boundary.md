# WAKILISHA brand workbook: 22 October 2026 adoption boundary

**Status:** owner design instruction and engineering interpretation. This document does not authorize Production deployment, replacement of domain authority, or acceptance of untested UI.

**Source:** `MIZIZI WAKILISHA Brand Workbook (2).html`, SHA-256 `97642ffa40c6815c152c64eea6daa963b67ef91200c201db0467641b4acec36e`, provided 22 October 2026. The unpacked source includes Sections 14 (Navigation), 17 (Media and playback), 21 (Pages), 22 (Accounts and onboarding), and 23 (Email). It is an editable design reference, not production code, canonical records, security policy, or a change authorization for Supabase.

## Conflict rule, explicitly accepted from product owner

**If a workbook element would alter an established product architecture, authority, security boundary, route contract, playback integration, data model, or production workflow, the current accepted product is right and the workbook over-extends.** Implement the presentation intent around current behavior or record the conflict for later product consideration. Never implement the conflicting mockup literally as a side effect of visual parity.

Source hierarchy: accepted deployed and security/runtime contracts; current accepted functional product; binding brand/language/cultural doctrines; the revised workbook for layouts, visual hierarchy, and presentation interactions. This instruction is narrower than and compatible with the 17 October [brand authority](./wakilisha-workbook-v4-replacement-authority-20261017.md).

## Adoption decisions by surface

| Surface | Adopt in the UI | Preserve from current product; do not silently change |
| --- | --- | --- |
| Navigation, phone/tablet/desktop | Short, ungrouped main menu; compact tablet rail; contextual You sheet; consistent logo, current-page state, keyboard and focus; remove redundant chrome only after browser proof | Keep canonical routes, deep links, role/access checks, Search and profile reachability. Do not orphan Releases, Playlists, Genres, Labels, Guides, Podcasts/Shows, legal pages, Messages or notifications by removing links before the promised in-page or account routes really exist and are tested. Counts must be genuine, never prototype numbers. |
| Music/video/audio/player | Responsive compact/expanded presentation; meaningful Preview and service labels; queue controls together; lyrics reading emphasis; label Moments as Comments where current comment operations already support it | Keep player context, backend/source selection, Apple identity versus Apple playback, queue semantics, spoken-audio restrictions, existing timed-text attribution, timestamps, moderation, thread IDs and storage. Do not invent whole-track comment persistence, unlock promises, playback switching, fake seek ticks or an audio-only provider mode. |
| Phone player position | Safe-area-aware bottom placement and real-device browser toolbar proof; do not obscure the last content row | No speculative CSS that pretends to control Safari chrome. Only adopt a visualViewport adjustment after real iOS/Android browser regression and reduced-motion acceptance. |
| Public sign-in/sign-up/recovery | Registry-sourced portraits, official wordmark, clear single action and readable forms; better placement of existing sign-in/sign-up, recovery and verification modes | No login-vs-signup email enumeration, no undocumented auto-user provisioning, changed MFA/token TTL, email security flow, unverified-user policy, auth routing or exposed existence checks just to satisfy the one-email-door mockup. Preserve current Supabase flows and `/auth` / reset links. |
| Staff Studio sign-in | Official WAKILISHA wordmark with neutral Studio endorsement, toned-down administrative styling and clear headings | Preserve `fetchUserRole`, `roleCanAccessAdmin`, signed-in redirects, denied/sign-out handling, Google/OAuth, OTP and password-reset behavior. No claim that device/time/role audit logging exists unless its deployed authority is independently verified. |
| Account email | WAKILISHA-branded light, table-safe shell, authentic logo, readable type, one clear action, truthful footer, 600px maximum width, mobile wrapping and reliable CTA fallback | No invented account-security event or password-change sender, no made-up IP/device/location/time, no altered Supabase ConfirmationURL semantics or expiry promise without deployment proof; no automatic newsletter opt-in. Review existing generated emails as potentially stale. |
| Culture Dispatch and other briefings | Shared shell, content hierarchy, image ratios and footer links following consent policy | Preserve per-catalogue generation, unsubscribe/consent, stored issue snapshots and existing distribution contracts. A prototype edition/date/chart ranking is not live data. |
| Public screens in Section 21 | Reuse existing page/data services and image assets while converging editorial layouts and device-specific controls | Do not publish sample artists, documentary chapters, verified credits, live audiences, stats, reviews, relationships or commerce states as if real. Do not replace Registry authority with the workbook. |

## Implementation and acceptance slices

1. **Navigation and device shells.** Inventory every currently reachable route and its alternate location. Converge the universal navigation source and phone/tablet/desktop presentation only after reachability proof, accessibility checks and responsive comparison at 390, 480, 768, 1024, 1280 and 1440 widths. A hidden menu item does not imply a hidden route.
2. **Player presentation.** Keep `PlayerCompactSurface`, `PlayerFullSurface`, `PlayerQueuePanel`, timed-text and existing community services. Reorder and restyle supported controls; preserve all functional contracts. Test preview, Apple Music, YouTube/SoundCloud, spoken audio, queue reorder/shuffle, lyrics, comments, accessibility and both mobile/desktop.
3. **Accounts and email.** Converge public auth visuals without changing current auth state transitions. Studio branding may land independently because it does not change sign-in behavior. Inspect the real email sender/template pipeline before changing Supabase/Auth/briefing templates. Verify email HTML in actual clients and real recovery/magic-link conditions.

**Do not batch these into one global stylesheet rewrite.** Reuse tokens, fonts, existing official logo files and current design-system primitives. Consolidate relevant regression coverage into the existing permanent suites, not one new suite per mockup. No migration or Edge Function is justified by a visual-only change.

## First bounded implementation on this branch

Only `src/pages/admin/login/page.tsx` changes, with an assertion in the existing workbook design-system test. The Studio form now uses the official self-hosted WAKILISHA dark-surface wordmark and a Studio label instead of a generic lock mark, and avoids the promotional green staff eyebrow. The existing role checks, redirects, password/OTP/Google actions and denied state remain unchanged.

**Verification still required:** exact-head CI/build, keyboard and form-state acceptance, signed-in allowed/denied behavior, responsive visual review, and the normal frontend release controls. The branch does not claim the other requested sections are adopted.

## Release classification

| Item | Requirement now |
| --- | --- |
| SQL migration | No for this Studio branding branch |
| Supabase Edge Function | No for this Studio branding branch |
| Frontend build and deploy | Yes, only after visual, auth and CI acceptance |
| Production Finish update | Yes if frontend deployment is approved; **not performed here** |
| PR | Draft for preview/CI; do not merge on static inspection alone |
| Rollback | Revert the Studio presentation commit and redeploy the exact accepted frontend, without modifying auth or data |
