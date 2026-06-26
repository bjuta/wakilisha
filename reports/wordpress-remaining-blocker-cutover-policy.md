# WordPress Remaining Blocker Cutover Policy

This is a planning artifact only. Do not apply redirects until the final React/IP cutover rehearsal passes.

Use 302 temporary redirects first. Do not use 301 until the new React surface has been observed in production.

## Summary

- Total remaining blockers reviewed: 22
- Redirect candidates: 0
- Manual review rows: 17
- Product decision rows: 2
- Runtime verification rows: 3

## Blocker type counts

- chart_runtime_route: 3
- legacy_article_missing_react_route: 1
- legacy_section_archive: 16
- woocommerce_dynamic_route: 2

## Decision counts

- manual_review_missing_article: 1
- manual_review_section_archive: 16
- product_decision_required: 2
- runtime_verification_required: 3

## Redirect candidates

| Source | Target | Confidence | Reason |
|---|---|---|---|

## Runtime verification required

| Source | Target | Confidence | Reason |
|---|---|---|---|
| `/charts/top-100/ke/2026-01-26/` | `/charts/top-100/ke/2026-01-26` | medium | Chart route is likely handled by React runtime routing, but needs deployment-preview smoke testing before cutover. |
| `/charts/top-gengetone/ke/2026-01-26/` | `/charts/top-gengetone/ke/2026-01-26` | medium | Chart route is likely handled by React runtime routing, but needs deployment-preview smoke testing before cutover. |
| `/charts/top-rnb/ke/2026-01-26/` | `/charts/top-rnb/ke/2026-01-26` | medium | Chart route is likely handled by React runtime routing, but needs deployment-preview smoke testing before cutover. |

## Manual review

| Blocker type | Source | Proposed target | Confidence | Reason |
|---|---|---|---|---|
| legacy_article_missing_react_route | `/claim-your-name/` | `/magazine/claim-your-name` | low | Legacy article/page slug has no matching React route. Decide whether to import, redirect elsewhere, preserve static HTML, or intentionally 404. |
| legacy_section_archive | `/album-reviews/` | `/magazine` | low | Legacy album reviews archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/art-design/` | `/magazine` | low | Legacy art/design archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/art/` | `/magazine` | low | Legacy art archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/blog-newspaper/` | `/magazine` | low | Legacy blog/newspaper archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/film/` | `/magazine` | low | Legacy film archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/journal/` | `/magazine` | low | Legacy journal archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/lifestyle/` | `/magazine` | low | Legacy lifestyle archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/literature/` | `/magazine` | low | Legacy literature archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/literature/short-stories/` | `/magazine` | low | Legacy nested short stories archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/music/` | `/music` | low | Legacy music archive needs a React music/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/opinion/` | `/magazine` | low | Legacy opinion archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/plan/` | `/magazine` | low | Legacy plan route needs product decision: rebuild, redirect, or retire. Target route was not found in current React prerender output. |
| legacy_section_archive | `/plan/archive/` | `/magazine` | low | Legacy plan archive needs product decision: rebuild, redirect, or retire. Target route was not found in current React prerender output. |
| legacy_section_archive | `/science-and-technology/` | `/magazine` | low | Legacy science and technology archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/short-stories/` | `/magazine` | low | Legacy short stories archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |
| legacy_section_archive | `/sports/` | `/magazine` | low | Legacy sports archive needs a React section/archive destination or retirement decision. Target route was not found in current React prerender output. |

## Product decision required

| Source | Proposed target | Confidence | Reason |
|---|---|---|---|
| `/cart/` | `/cart` | high | Legacy WooCommerce route. Decide whether to retire, rebuild, redirect to a non-commerce page, or preserve a legacy store path. |
| `/checkout/` | `/checkout` | high | Legacy WooCommerce route. Decide whether to retire, rebuild, redirect to a non-commerce page, or preserve a legacy store path. |

## Media import boundary

This plan is about URL routing only.

Do not import provider-hosted artist images such as Spotify CDN images by default.

Only old WordPress upload media under /wp-content/uploads/ belongs in the media mirror/rewrite workstream.
