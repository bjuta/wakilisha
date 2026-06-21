# WAKILISHA context-aware email briefing templates

This implementation adds the catalog-level template profile layer for the 13 branded WAKILISHA email briefings. Culture Dispatch remains the baseline visual language: light-only shell, card-led articles, artwork-first chart treatment, image-first artist surfaces, and intentional archive routes. The remaining 12 catalogs now have distinct editorial intent, module order, accent behavior, and renderer slots.

## Files

- `src/services/emailBriefingTemplateProfiles.ts` — frontend/admin template registry.
- `supabase/functions/briefing-handler/briefing-template-profiles.ts` — Deno/Supabase-side mirror for the email renderer.
- `supabase/migrations/20260621_email_briefing_template_profiles.sql` — seeds `briefing_catalog.visual_config` with template variants and accent colors.

## How it fits the current app

The current admin Email & Briefings page already calls the Supabase briefing handler for catalog listing, issue previewing, issue generation, curated-content previewing, updates, and sends. The service contract already supports flexible curated sections and item fields such as `image_url`, `artwork_url`, `heroUrl`, `rank`, `movement`, `artist_name`, `country`, `label`, `published_at`, `readingTime`, `url`, and `link`.

The migration writes a durable `template_variant` into `briefing_catalog.visual_config`, alongside `accent_color`, `template_family`, and `editorial_intent`. The renderer can use these values to choose the correct module order and copy style without changing the existing public API.

## Catalog behavior

- `charts_digest` — artwork-first chart leader, compact ranked artwork tiles, movement board.
- `weekly_editorial` — lead essay card, story grid, pull-thread module, archive reads.
- `field_guides` — guide hero, numbered method cards, field notes, route cards.
- `artist_signals` — image-first artist wall, featured artist surface, signal tiles.
- `release_radar` — cover-led release cards, project grid, chart context, artist routes.
- `new_voices` — emerging artist wall, discovery framing, first-signal tiles.
- `registry_notes` — registry stats, entity-change cards, repair notes, admin routes.
- `label_industry_notes` — label cards, roster cues, release activity, industry routes.
- `language_memory` — memory lead, language cards, archive threads, listen/read routes.
- `east_africa_weekly` — regional lead, city board, cross-border artist context.
- `weekend_agenda` — Friday/Saturday/Sunday planner cards and saveable routes.
- `diaspora_signals` — distance/home/memory cards, diaspora artist routes.

## Production rules

- No dark mode templates.
- Email layouts must stay table-based.
- Images must use real story hero images, album artwork, release covers, or artist portraits when available.
- Missing images should fall back to typographic cards, not broken image boxes.
- Archive sections must explain why the item matters now.
- Artist surfaces should be image-first with minimal inline metadata.
