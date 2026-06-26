# WordPress Author + Static Route Cutover Policy

This is a planning artifact only. Do not apply redirects until the final React/IP cutover rehearsal passes.

Use 302 temporary redirects first. Do not use 301 until the new React surface has been observed in production.

## Summary

- Total author/static blockers reviewed: 40
- Author archive rows: 28
- Static/account route rows: 12
- Redirect candidates: 0
- Manual review rows: 34
- Product decision rows: 6

## Decision counts

- manual_review_author_mapping: 28
- manual_review_static_route: 6
- product_decision_required: 6

## Author route policy

- `/author/<slug>/` can redirect to `/authors/<slug>` only when the React author route exists.
- `/author/<slug>/page/<n>/` should collapse to the canonical `/authors/<slug>` only when the target exists.
- If the React author route does not exist, the row must remain manual review because WordPress usernames may not match React author slugs.

## Static/account route policy

- Pure static pages can redirect to equivalent React routes only when the target exists.
- Account, profile, settings, and WooCommerce account/order routes need product confirmation before redirecting.

## Redirect candidates

| Source | Target | Confidence | Reason |
|---|---|---|---|

## Manual review

| Source | Proposed target | Confidence | Reason |
|---|---|---|---|
| `/author/admin/` | `/authors/admin` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/frank/` | `/authors/frank` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/frank/page/2/` | `/authors/frank` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/frank/page/3/` | `/authors/frank` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/gatwiri_c/` | `/authors/gatwiri_c` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/hafare/` | `/authors/hafare` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/hafare/page/2/` | `/authors/hafare` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/james/` | `/authors/james` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/james/page/2/` | `/authors/james` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/james/page/3/` | `/authors/james` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/k_matiri/` | `/authors/k_matiri` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/k_matiri/page/2/` | `/authors/k_matiri` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/kendi/` | `/authors/kendi` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/kendi/page/2/` | `/authors/kendi` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/kiuta/` | `/authors/kiuta` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/michael/` | `/authors/michael` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/swambi/` | `/authors/swambi` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/timo/` | `/authors/timo` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/vicmuia/` | `/authors/vicmuia` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/wakilishaji/` | `/authors/wakilishaji` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/author/wakilishaji/page/2/` | `/authors/wakilishaji` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/wakilishaji/page/3/` | `/authors/wakilishaji` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/wakilishaji/page/4/` | `/authors/wakilishaji` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/wakilishaji/page/5/` | `/authors/wakilishaji` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/wakilishaji/page/6/` | `/authors/wakilishaji` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/wakilishaji/page/7/` | `/authors/wakilishaji` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/wakilishaji/page/8/` | `/authors/wakilishaji` | low | Paginated legacy author archive has no confirmed matching React author route. |
| `/author/wangari/` | `/authors/wangari` | low | Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire. |
| `/corrections/` | `/corrections` | low | Legacy corrections page can map to React corrections route if present. Target route was not found in current React prerender output. |
| `/events/` | `/events` | low | Legacy events page can map to React events route if present. Target route was not found in current React prerender output. |
| `/faq/` | `/faq` | low | Legacy FAQ page can map to React FAQ route if present. Target route was not found in current React prerender output. |
| `/methodology/` | `/methodology` | low | Legacy methodology page can map to React methodology route if present. Target route was not found in current React prerender output. |
| `/news-resources/` | `/magazine` | low | Legacy news resources page can map to React magazine route if present. Target route was not found in current React prerender output. |
| `/venues/` | `/venues` | low | Legacy venues page can map to React venues route if present. Target route was not found in current React prerender output. |

## Product decision required

| Source | Proposed target | Confidence | Reason |
|---|---|---|---|
| `/account/` | `/account` | low | Legacy account route needs auth/product confirmation before cutover. Target route was not found in current React prerender output. |
| `/my-account/` | `/account` | low | Legacy WooCommerce account route needs auth/product confirmation before cutover. Target route was not found in current React prerender output. |
| `/my-library/` | `/library` | low | Legacy user library route needs auth/product confirmation before cutover. Target route was not found in current React prerender output. |
| `/my-top-10/` | `/my-top-10` | low | Legacy user top 10 route needs auth/product confirmation before cutover. Target route was not found in current React prerender output. |
| `/order-tracking/` | `/account` | low | Legacy WooCommerce order tracking route needs product decision before cutover. Target route was not found in current React prerender output. |
| `/settings/` | `/settings` | low | Legacy settings route needs auth/product confirmation before cutover. Target route was not found in current React prerender output. |

## Media import boundary

This plan is about URL routing only.

Do not import provider-hosted artist images such as Spotify CDN images by default.

Only old WordPress upload media under /wp-content/uploads/ belongs in the media mirror/rewrite workstream.
