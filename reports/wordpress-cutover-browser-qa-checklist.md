# WordPress Cutover Browser QA Checklist

This checklist is for browser verification before any DNS/IP cutover.

It does not approve Cloudflare changes, DNS changes, Supabase deploys, frontend deploys, or production redirects.

## Summary

- Total QA rows: 56
- Critical rows: 18
- High rows: 29
- Medium rows: 9
- Chart runtime browser QA rows: 3
- Hold/do-not-redirect rows: 17

## Input reports

| Input | Present |
|---|---|
| reports/wordpress-react-preview-smoke-report.json | yes |
| reports/wordpress-cutover-decision-resolution-plan.json | yes |
| reports/wordpress-temporary-redirect-bundle.json | yes |
| reports/wordpress-cutover-rehearsal-checklist.json | yes |

## How to use

Replace `<REACT_PREVIEW_OR_CUTOVER_ORIGIN>` in the URL file with the actual React preview or cutover origin.

For each page, open it in a browser and check visible UI, console-breaking errors, client-side data rendering, media loading, and obvious mobile layout breakage.

## Critical checklist

- [ ] Core routes load without blank screen.
- [ ] Chart runtime routes load data in browser, not just the React shell.
- [ ] Magazine/article redirect targets render content shell correctly.
- [ ] Tag-search URLs preserve query and do not crash search UI.
- [ ] Media still loads from `media.wakilisha.africa` or approved provider CDNs.
- [ ] No new `/wp-json/` dependency appears in browser network calls.
- [ ] No old `/wp-content/uploads/` image URL appears as a final image URL.
- [ ] Hold routes are not accidentally treated as approved redirects.

## QA rows

| ID | Priority | Category | Route | Expected result | Status |
|---|---|---|---|---|---|
| CORE-001 | critical | core_route | `/` | React page loads, main UI renders, no blank screen, no console-blocking runtime error. | pending |
| CORE-002 | critical | core_route | `/magazine` | React page loads, main UI renders, no blank screen, no console-blocking runtime error. | pending |
| CORE-003 | critical | core_route | `/charts` | React page loads, main UI renders, no blank screen, no console-blocking runtime error. | pending |
| CORE-004 | critical | core_route | `/artists` | React page loads, main UI renders, no blank screen, no console-blocking runtime error. | pending |
| CORE-005 | critical | core_route | `/releases` | React page loads, main UI renders, no blank screen, no console-blocking runtime error. | pending |
| CORE-006 | critical | core_route | `/tracks` | React page loads, main UI renders, no blank screen, no console-blocking runtime error. | pending |
| CORE-007 | critical | core_route | `/search` | React page loads, main UI renders, no blank screen, no console-blocking runtime error. | pending |
| CHART-001 | critical | chart_runtime_route | `/charts/top-100/ke/2026-01-26` | Chart page loads in browser, chart title/date/country render, entries/data load, empty/error state is not shown unless expected. | pending |
| CHART-002 | critical | chart_runtime_route | `/charts/top-gengetone/ke/2026-01-26` | Chart page loads in browser, chart title/date/country render, entries/data load, empty/error state is not shown unless expected. | pending |
| CHART-003 | critical | chart_runtime_route | `/charts/top-rnb/ke/2026-01-26` | Chart page loads in browser, chart title/date/country render, entries/data load, empty/error state is not shown unless expected. | pending |
| ARTICLE-001 | high | sample_safe_redirect_target | `/magazine/10-contemporary-kenyan-artists-you-should-know` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-002 | high | sample_safe_redirect_target | `/magazine/10-kenyan-authors-you-should-read` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-003 | high | sample_safe_redirect_target | `/magazine/10-places-in-nairobi-to-explore-art-music-and-design` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-004 | high | sample_safe_redirect_target | `/magazine/15-fatoumata-diawara-songs` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-005 | high | sample_safe_redirect_target | `/magazine/15-things-to-do-home-5-months` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-006 | high | sample_safe_redirect_target | `/magazine/2021-visual-trends` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-007 | high | sample_safe_redirect_target | `/magazine/2022-nyege-nyege-festival-officially-announced` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-008 | high | sample_safe_redirect_target | `/magazine/2023-trends-to-take-note-of` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-009 | high | sample_safe_redirect_target | `/magazine/4-tips-for-diversifying-your-diet-on-a-budget` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-010 | high | sample_safe_redirect_target | `/magazine/5-cultural-destinations-worth-visiting-in-nairobi` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| TAG-001 | high | sample_tag_search_target | `/search?tag=2026` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-002 | high | sample_tag_search_target | `/search?tag=4mr%20frank%20white` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-003 | high | sample_tag_search_target | `/search?tag=60%20nozzles` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-004 | high | sample_tag_search_target | `/search?tag=8%204%204` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-005 | high | sample_tag_search_target | `/search?tag=8th%20street%20gang` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-006 | high | sample_tag_search_target | `/search?tag=a%20grain%20of%20wheat` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-007 | high | sample_tag_search_target | `/search?tag=a%20nurse%20toto` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-008 | high | sample_tag_search_target | `/search?tag=aahil` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-009 | high | sample_tag_search_target | `/search?tag=aaron%20rimbui` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-010 | high | sample_tag_search_target | `/search?tag=ababu%20namwamba` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| EXTRA-REDIRECT-001 | medium | ready_extra_redirect_target | `/magazine` | Magazine landing route loads correctly as the fallback destination. | pending |
| APPROVAL-GATED-001 | medium | approval_gated_redirect | `/album-reviews/` | Do not approve automatically. Confirm product/content accepts redirecting this old section archive to /magazine. | pending_product_approval |
| APPROVAL-GATED-002 | medium | approval_gated_redirect | `/art-design/` | Do not approve automatically. Confirm product/content accepts redirecting this old section archive to /magazine. | pending_product_approval |
| APPROVAL-GATED-003 | medium | approval_gated_redirect | `/art/` | Do not approve automatically. Confirm product/content accepts redirecting this old section archive to /magazine. | pending_product_approval |
| APPROVAL-GATED-004 | medium | approval_gated_redirect | `/blog-newspaper/` | Do not approve automatically. Confirm product/content accepts redirecting this old section archive to /magazine. | pending_product_approval |
| APPROVAL-GATED-005 | medium | approval_gated_redirect | `/film/` | Do not approve automatically. Confirm product/content accepts redirecting this old section archive to /magazine. | pending_product_approval |
| APPROVAL-GATED-006 | medium | approval_gated_redirect | `/journal/` | Do not approve automatically. Confirm product/content accepts redirecting this old section archive to /magazine. | pending_product_approval |
| APPROVAL-GATED-007 | medium | approval_gated_redirect | `/lifestyle/` | Do not approve automatically. Confirm product/content accepts redirecting this old section archive to /magazine. | pending_product_approval |
| APPROVAL-GATED-008 | medium | approval_gated_redirect | `/literature/` | Do not approve automatically. Confirm product/content accepts redirecting this old section archive to /magazine. | pending_product_approval |
| HOLD-001 | high | do_not_redirect_without_decision | `/tag/abas-k%eb%ab%bf/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-002 | high | do_not_redirect_without_decision | `/tag/abbas-k%eb%ab%bf/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-003 | high | do_not_redirect_without_decision | `/corrections/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-004 | high | do_not_redirect_without_decision | `/events/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-005 | high | do_not_redirect_without_decision | `/faq/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-006 | high | do_not_redirect_without_decision | `/methodology/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-007 | high | do_not_redirect_without_decision | `/venues/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-008 | critical | do_not_redirect_without_decision | `/account/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-009 | critical | do_not_redirect_without_decision | `/my-account/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-010 | critical | do_not_redirect_without_decision | `/my-library/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-011 | critical | do_not_redirect_without_decision | `/my-top-10/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-012 | critical | do_not_redirect_without_decision | `/order-tracking/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-013 | critical | do_not_redirect_without_decision | `/settings/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-014 | high | do_not_redirect_without_decision | `/claim-your-name/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-015 | high | do_not_redirect_without_decision | `/music/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-016 | critical | do_not_redirect_without_decision | `/cart/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |
| HOLD-017 | critical | do_not_redirect_without_decision | `/checkout/` | Do not add this route to redirect bundle unless a separate product/content decision approves it. | blocked_or_hold |

## Go/no-go rule

Cutover cannot be approved from this checklist unless all critical rows pass in browser and every hold/product/content route is intentionally accepted, rebuilt, retired, or left out of redirect rules.

## Deployment checklist

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Readdy Finish update needed: No
Frontend deploy needed: No
Cloudflare/DNS change needed: No
This is a browser QA planning artifact only.
```
