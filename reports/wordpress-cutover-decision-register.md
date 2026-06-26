# WordPress Cutover Decision Register

This register collects every unresolved cutover decision that is not part of the already validated temporary redirect bundle.

This file does not approve DNS, Cloudflare, Supabase, frontend deploy, or production redirect changes.

## Summary

- Total decision rows: 64
- Needs decision: 36
- Needs product decision: 24
- Needs content decision: 1
- Preview smoke passed, browser QA needed: 3
- High-risk rows: 8
- Medium-risk rows: 51
- Low-risk rows: 5

## Input reports

| Input | Present |
|---|---|
| reports/wordpress-tag-archive-cutover-policy.json | yes |
| reports/wordpress-author-static-cutover-policy.json | yes |
| reports/wordpress-remaining-blocker-cutover-policy.json | yes |
| reports/wordpress-react-preview-smoke-report.json | yes |
| reports/wordpress-temporary-redirect-bundle.json | yes |

## Owner bucket counts

- Content/SEO: 29
- Product: 6
- Product/auth: 6
- Product/business: 2
- Product/content: 16
- QA/product: 3
- SEO/content: 2

## Source group counts

- account_or_user_route: 6
- author_archive: 28
- chart_runtime_route: 3
- legacy_article_missing_react_route: 1
- legacy_section_archive: 16
- malformed_tag_route: 2
- static_route: 6
- woocommerce_route: 2

## Decision rows

| ID | Group | Owner | Risk | Status | Source | Proposed target | Recommended action |
|---|---|---|---|---|---|---|---|
| TAG-MANUAL-001 | malformed_tag_route | SEO/content | low | needs_decision | `/tag/abas-k%eb%ab%bf/` | `/search?tag=abas%20k%EB%AB%BF` | Retire, fix the encoded slug, or manually map to a clean /search?tag=... target. Do not bulk-redirect malformed encoded slugs blindly. |
| TAG-MANUAL-002 | malformed_tag_route | SEO/content | low | needs_decision | `/tag/abbas-k%eb%ab%bf/` | `/search?tag=abbas%20k%EB%AB%BF` | Retire, fix the encoded slug, or manually map to a clean /search?tag=... target. Do not bulk-redirect malformed encoded slugs blindly. |
| AUTHOR-001 | author_archive | Content/SEO | medium | needs_decision | `/author/admin/` | `/authors/admin` | Retire or redirect to /magazine after confirming this is not a real public author profile. |
| AUTHOR-002 | author_archive | Content/SEO | medium | needs_decision | `/author/frank/` | `/authors/frank` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-003 | author_archive | Content/SEO | medium | needs_decision | `/author/frank/page/2/` | `/authors/frank` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-004 | author_archive | Content/SEO | medium | needs_decision | `/author/frank/page/3/` | `/authors/frank` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-005 | author_archive | Content/SEO | medium | needs_decision | `/author/gatwiri_c/` | `/authors/gatwiri_c` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-006 | author_archive | Content/SEO | medium | needs_decision | `/author/hafare/` | `/authors/hafare` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-007 | author_archive | Content/SEO | medium | needs_decision | `/author/hafare/page/2/` | `/authors/hafare` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-008 | author_archive | Content/SEO | medium | needs_decision | `/author/james/` | `/authors/james` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-009 | author_archive | Content/SEO | medium | needs_decision | `/author/james/page/2/` | `/authors/james` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-010 | author_archive | Content/SEO | medium | needs_decision | `/author/james/page/3/` | `/authors/james` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-011 | author_archive | Content/SEO | medium | needs_decision | `/author/k_matiri/` | `/authors/k_matiri` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-012 | author_archive | Content/SEO | medium | needs_decision | `/author/k_matiri/page/2/` | `/authors/k_matiri` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-013 | author_archive | Content/SEO | medium | needs_decision | `/author/kendi/` | `/authors/kendi` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-014 | author_archive | Content/SEO | medium | needs_decision | `/author/kendi/page/2/` | `/authors/kendi` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-015 | author_archive | Content/SEO | medium | needs_decision | `/author/kiuta/` | `/authors/kiuta` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-016 | author_archive | Content/SEO | medium | needs_decision | `/author/michael/` | `/authors/michael` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-017 | author_archive | Content/SEO | medium | needs_decision | `/author/swambi/` | `/authors/swambi` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-018 | author_archive | Content/SEO | medium | needs_decision | `/author/timo/` | `/authors/timo` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-019 | author_archive | Content/SEO | medium | needs_decision | `/author/vicmuia/` | `/authors/vicmuia` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-020 | author_archive | Content/SEO | medium | needs_decision | `/author/wakilishaji/` | `/authors/wakilishaji` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| AUTHOR-021 | author_archive | Content/SEO | medium | needs_decision | `/author/wakilishaji/page/2/` | `/authors/wakilishaji` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-022 | author_archive | Content/SEO | medium | needs_decision | `/author/wakilishaji/page/3/` | `/authors/wakilishaji` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-023 | author_archive | Content/SEO | medium | needs_decision | `/author/wakilishaji/page/4/` | `/authors/wakilishaji` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-024 | author_archive | Content/SEO | medium | needs_decision | `/author/wakilishaji/page/5/` | `/authors/wakilishaji` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-025 | author_archive | Content/SEO | medium | needs_decision | `/author/wakilishaji/page/6/` | `/authors/wakilishaji` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-026 | author_archive | Content/SEO | medium | needs_decision | `/author/wakilishaji/page/7/` | `/authors/wakilishaji` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-027 | author_archive | Content/SEO | medium | needs_decision | `/author/wakilishaji/page/8/` | `/authors/wakilishaji` | After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive. |
| AUTHOR-028 | author_archive | Content/SEO | medium | needs_decision | `/author/wangari/` | `/authors/wangari` | Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists. |
| STATIC-MANUAL-029 | static_route | Product | medium | needs_decision | `/corrections/` | `/corrections` | Confirm whether this static route should be rebuilt, redirected to the closest React destination, or intentionally retired. |
| STATIC-MANUAL-030 | static_route | Product | medium | needs_decision | `/events/` | `/events` | Confirm whether this static route should be rebuilt, redirected to the closest React destination, or intentionally retired. |
| STATIC-MANUAL-031 | static_route | Product | medium | needs_decision | `/faq/` | `/faq` | Confirm whether this static route should be rebuilt, redirected to the closest React destination, or intentionally retired. |
| STATIC-MANUAL-032 | static_route | Product | medium | needs_decision | `/methodology/` | `/methodology` | Confirm whether this static route should be rebuilt, redirected to the closest React destination, or intentionally retired. |
| STATIC-MANUAL-033 | static_route | Product | medium | needs_decision | `/news-resources/` | `/magazine` | Confirm whether this static route should be rebuilt, redirected to the closest React destination, or intentionally retired. |
| STATIC-MANUAL-034 | static_route | Product | medium | needs_decision | `/venues/` | `/venues` | Confirm whether this static route should be rebuilt, redirected to the closest React destination, or intentionally retired. |
| AUTH-PRODUCT-001 | account_or_user_route | Product/auth | high | needs_product_decision | `/account/` | `/account` | Decide whether React account/auth replaces this route. If not ready, retire or redirect to the current sign-in/account destination after product approval. |
| AUTH-PRODUCT-002 | account_or_user_route | Product/auth | high | needs_product_decision | `/my-account/` | `/account` | Decide whether React account/auth replaces this route. If not ready, retire or redirect to the current sign-in/account destination after product approval. |
| AUTH-PRODUCT-003 | account_or_user_route | Product/auth | high | needs_product_decision | `/my-library/` | `/library` | Decide whether user library exists in React. If not ready for cutover, retire or route to signed-in account area only after auth QA. |
| AUTH-PRODUCT-004 | account_or_user_route | Product/auth | high | needs_product_decision | `/my-top-10/` | `/my-top-10` | Decide whether this user feature exists in React. If not, retire or preserve as intentional 404. |
| AUTH-PRODUCT-005 | account_or_user_route | Product/auth | high | needs_product_decision | `/order-tracking/` | `/account` | Retire WooCommerce order tracking unless a replacement commerce/order feature exists. |
| AUTH-PRODUCT-006 | account_or_user_route | Product/auth | high | needs_product_decision | `/settings/` | `/settings` | Decide whether React user settings replaces this route. If not ready, keep blocked or route to account after auth QA. |
| MISSING-ARTICLE-001 | legacy_article_missing_react_route | Content/SEO | medium | needs_content_decision | `/claim-your-name/` | `/magazine/claim-your-name` | Import the missing page/article, redirect it to the closest relevant React destination, preserve static HTML, or intentionally 404 it. |
| SECTION-002 | legacy_section_archive | Product/content | medium | needs_product_decision | `/album-reviews/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-003 | legacy_section_archive | Product/content | medium | needs_product_decision | `/art-design/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-004 | legacy_section_archive | Product/content | medium | needs_product_decision | `/art/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-005 | legacy_section_archive | Product/content | medium | needs_product_decision | `/blog-newspaper/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-006 | legacy_section_archive | Product/content | medium | needs_product_decision | `/film/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-007 | legacy_section_archive | Product/content | medium | needs_product_decision | `/journal/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-008 | legacy_section_archive | Product/content | medium | needs_product_decision | `/lifestyle/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-009 | legacy_section_archive | Product/content | medium | needs_product_decision | `/literature/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-010 | legacy_section_archive | Product/content | medium | needs_product_decision | `/literature/short-stories/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-011 | legacy_section_archive | Product/content | medium | needs_product_decision | `/music/` | `/music` | Decide whether to rebuild a public music archive or redirect to the closest React culture/music surface. |
| SECTION-012 | legacy_section_archive | Product/content | medium | needs_product_decision | `/opinion/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-013 | legacy_section_archive | Product/content | medium | needs_product_decision | `/plan/` | `/magazine` | Decide whether this old product/editorial route should be rebuilt, redirected to magazine, or intentionally retired. |
| SECTION-014 | legacy_section_archive | Product/content | medium | needs_product_decision | `/plan/archive/` | `/magazine` | Decide whether this old product/editorial route should be rebuilt, redirected to magazine, or intentionally retired. |
| SECTION-015 | legacy_section_archive | Product/content | medium | needs_product_decision | `/science-and-technology/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-016 | legacy_section_archive | Product/content | medium | needs_product_decision | `/short-stories/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| SECTION-017 | legacy_section_archive | Product/content | medium | needs_product_decision | `/sports/` | `/magazine` | Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it. |
| WOO-001 | woocommerce_route | Product/business | high | needs_product_decision | `/cart/` | `/cart` | Decide whether to retire WooCommerce, rebuild commerce, redirect to a non-commerce destination, or preserve a legacy store path. Do not redirect blindly. |
| WOO-002 | woocommerce_route | Product/business | high | needs_product_decision | `/checkout/` | `/checkout` | Decide whether to retire WooCommerce, rebuild commerce, redirect to a non-commerce destination, or preserve a legacy store path. Do not redirect blindly. |
| CHART-RUNTIME-001 | chart_runtime_route | QA/product | low | preview_smoke_passed_browser_qa_needed | `/charts/top-100/ke/2026-01-26/` | `/charts/top-100/ke/2026-01-26` | Run browser QA for chart data rendering on preview/cutover origin. HTML shell smoke has passed. |
| CHART-RUNTIME-002 | chart_runtime_route | QA/product | low | preview_smoke_passed_browser_qa_needed | `/charts/top-gengetone/ke/2026-01-26/` | `/charts/top-gengetone/ke/2026-01-26` | Run browser QA for chart data rendering on preview/cutover origin. HTML shell smoke has passed. |
| CHART-RUNTIME-003 | chart_runtime_route | QA/product | low | preview_smoke_passed_browser_qa_needed | `/charts/top-rnb/ke/2026-01-26/` | `/charts/top-rnb/ke/2026-01-26` | Run browser QA for chart data rendering on preview/cutover origin. HTML shell smoke has passed. |

## Cutover interpretation

- The 1,171-row temporary redirect bundle is validated separately.
- These rows are excluded from automatic redirects until product/content/QA decisions are made.
- Chart runtime routes have passed HTML-shell preview smoke but still need browser QA for data rendering.
- Author routes must not be bulk-redirected until WordPress username slugs are mapped to React author slugs.
- WooCommerce/account routes are high risk because they can affect user expectations and auth/commercial behavior.

## Deployment checklist

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Readdy Finish update needed: No
Frontend deploy needed: No
Cloudflare/DNS change needed: No
This is a decision-planning artifact only.
```
