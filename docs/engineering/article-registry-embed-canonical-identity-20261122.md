# Article Registry embeds: canonical ID acceptance

**Status:** scoped code repair candidate, not deployed.  
**Repository baseline:** `8a80ed16da657953396a21237b3e94ed6c0f592b` (22 November 2026).

## Root cause

Article Track and Release editor pickers correctly enumerate separate Registry rows with canonical UUIDs but previously stored only title-derived `slug` in saved shortcodes. Reader resolvers fetched by slug and overwrote rows with identical slugs in a JavaScript Map, so a selected Track/Release could silently render a different record. Independent read-only Production SQL found **105** duplicate active Track slug groups (248 tracks) and **6** duplicate active Release slug groups (12 releases). The concrete `how-can-i-forget` slug was unique at this snapshot; it was not proof that the contract is safe.

## Corrected reference authority

- Article editor writes `[wk-track id="<canonical-track-uuid>"]` and `[wk-release id="<canonical-release-uuid>"]`; the editor does not invent or alter IDs. Playlist Description links remain a distinct route-based flow.
- Shared shortcode transformers accept exact UUIDs into `WK_REGISTRY_TRACK_ID` or `WK_REGISTRY_RELEASE_ID` markers. Invalid explicit IDs do not fall back to the slug.
- Both the admin Article preview and desktop/mobile published Article use the same transformers and resolvers. New markers query active Registry records **by id**; never by title or another candidate.
- Existing `slug` shortcodes continue working **only if exactly one active record** matches. Duplicate slugs, missing records and inactive exact IDs render a consistent visible `data-wk-registry-embed-unresolved` editorial correction notice. No arbitrary candidate, no silent retarget, no automatic irreversible content rewrite.
- Registry UUIDs also anchor article Track playback state; Release preview tracks obtained from canonical memberships use Track UUIDs where available. Artist-scoped public URLs and Registry schema are unchanged.
- No migration, RLS, Production SQL, Edge, Charts, or route rewrite required. Only the frontend Finish is needed **after** merge and protected proof.

## Regression scope

Existing editorial Vitest suite now tests both new transforms, unique legacy fallback, collision fail-closed and invalid-ID no-fallback. Existing isolated real-Chromium authoring fixture inserts two distinct same-slug Tracks and Releases, selects the second, and asserts the saved inline shortcode is the **selected UUID**. Protected CI and build are release gates. Post-deployment public Article and admin preview runtime acceptance must verify real, authorized selected references before closure.

Do not bulk-rewrite historic Articles to guessed UUIDs. Inventory ambiguous legacy embeds and review each original intended identity with editorial authority before converting that Article version.
