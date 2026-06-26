# WordPress Cutover Decision Resolution Plan

This is a proposed resolution layer for the 64-row cutover decision register.

It does not approve DNS, Cloudflare, Supabase, frontend deploy, or production redirect changes.

## Summary

- Decision rows reviewed: 64
- Proposed extra redirect-shaped rows: 44
- Ready extra redirect rows: 29
- Approval-gated redirect rows: 15
- Intentional retire/404 rows: 15
- Manual decision rows remaining: 17
- Browser QA rows: 3
- High-risk rows: 8
- Medium-risk rows: 50
- Low-risk rows: 6

## Input reports

| Input | Present |
|---|---|
| reports/wordpress-cutover-decision-register.json | yes |
| reports/wordpress-temporary-redirect-bundle.json | yes |
| reports/wordpress-react-preview-smoke-report.json | yes |

## Resolution counts

- browser_qa_required: 3
- intentional_404: 2
- intentional_404_or_future_rebuild: 5
- intentional_404_or_legacy_store_hold: 2
- intentional_404_until_auth_route_confirmed: 6
- manual_content_decision_required: 1
- manual_product_decision_required: 1
- redirect_to_magazine: 29
- redirect_to_magazine_after_product_approval: 15

## Proposed extra redirects

These are not part of the validated 1,171-row redirect bundle. Some rows are ready proposals, while section-archive rows remain approval-gated. Apply only after explicit product/content approval.

| Source | Target | Status | Reason |
|---|---|---:|---|
| `/author/admin/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/frank/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/frank/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/frank/page/3/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/gatwiri_c/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/hafare/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/hafare/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/james/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/james/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/james/page/3/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/k_matiri/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/k_matiri/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/kendi/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/kendi/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/kiuta/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/michael/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/swambi/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/timo/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/vicmuia/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/3/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/4/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/5/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/6/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/7/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/8/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wangari/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/news-resources/` | `/magazine` | 302 | Magazine is the closest current React destination. |
| `/album-reviews/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/art-design/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/art/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/blog-newspaper/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/film/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/journal/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/lifestyle/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/literature/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/literature/short-stories/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/opinion/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/plan/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/plan/archive/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/science-and-technology/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/short-stories/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |
| `/sports/` | `/magazine` | 302 | Magazine is the closest broad React destination, but section-specific UX may be preferable later. |

## Rows to retire or leave unredirected

| Source | Resolution | Risk | Reason |
|---|---|---|---|
| `/tag/abas-k%eb%ab%bf/` | intentional_404 | low | Malformed encoded tag slugs are not worth preserving and should not be bulk-mapped blindly. |
| `/tag/abbas-k%eb%ab%bf/` | intentional_404 | low | Malformed encoded tag slugs are not worth preserving and should not be bulk-mapped blindly. |
| `/corrections/` | intentional_404_or_future_rebuild | medium | Target route does not exist in current React prerender output. |
| `/events/` | intentional_404_or_future_rebuild | medium | Target route does not exist in current React prerender output. |
| `/faq/` | intentional_404_or_future_rebuild | medium | Target route does not exist in current React prerender output. |
| `/methodology/` | intentional_404_or_future_rebuild | medium | Target route does not exist in current React prerender output. |
| `/venues/` | intentional_404_or_future_rebuild | medium | Target route does not exist in current React prerender output. |
| `/account/` | intentional_404_until_auth_route_confirmed | high | Account, library, top-10, order, and settings routes can affect user expectations and auth behavior. |
| `/my-account/` | intentional_404_until_auth_route_confirmed | high | Account, library, top-10, order, and settings routes can affect user expectations and auth behavior. |
| `/my-library/` | intentional_404_until_auth_route_confirmed | high | Account, library, top-10, order, and settings routes can affect user expectations and auth behavior. |
| `/my-top-10/` | intentional_404_until_auth_route_confirmed | high | Account, library, top-10, order, and settings routes can affect user expectations and auth behavior. |
| `/order-tracking/` | intentional_404_until_auth_route_confirmed | high | Account, library, top-10, order, and settings routes can affect user expectations and auth behavior. |
| `/settings/` | intentional_404_until_auth_route_confirmed | high | Account, library, top-10, order, and settings routes can affect user expectations and auth behavior. |
| `/claim-your-name/` | manual_content_decision_required | medium | This is a specific legacy page/article and should not be silently redirected without content decision. |
| `/music/` | manual_product_decision_required | medium | /music/ may be product-significant and should not be blindly redirected. |
| `/cart/` | intentional_404_or_legacy_store_hold | high | Cart/checkout behavior can create false commercial expectations. |
| `/checkout/` | intentional_404_or_legacy_store_hold | high | Cart/checkout behavior can create false commercial expectations. |

## Browser QA rows

| Source | Target | Reason |
|---|---|---|
| `/charts/top-100/ke/2026-01-26/` | `/charts/top-100/ke/2026-01-26` | HTML shell smoke passed, but client-side chart data rendering still needs browser verification. |
| `/charts/top-gengetone/ke/2026-01-26/` | `/charts/top-gengetone/ke/2026-01-26` | HTML shell smoke passed, but client-side chart data rendering still needs browser verification. |
| `/charts/top-rnb/ke/2026-01-26/` | `/charts/top-rnb/ke/2026-01-26` | HTML shell smoke passed, but client-side chart data rendering still needs browser verification. |

## Cutover interpretation

- The validated 1,171-row temporary redirect bundle remains the primary approved redirect artifact.
- This plan proposes extra handling for the 64 unresolved rows.
- Author archive URLs should not fake author profile matches. The safe fallback is `/magazine` if we choose to preserve them.
- WooCommerce and account routes should not be redirected until product/auth behavior is confirmed.
- Chart routes have passed HTML-shell smoke and need browser QA for client-side data.

## Deployment checklist

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Readdy Finish update needed: No
Frontend deploy needed: No
Cloudflare/DNS change needed: No
This is a decision-resolution planning artifact only.
```
