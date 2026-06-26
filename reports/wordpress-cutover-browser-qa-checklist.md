# WordPress Cutover Browser QA Checklist

This checklist is for browser verification before any DNS/IP cutover.

It does not approve Cloudflare changes, DNS changes, Supabase deploys, frontend deploys, or production redirects.

## Summary

- Total QA rows: 18
- Critical rows: 7
- High rows: 10
- Medium rows: 1
- Chart runtime browser QA rows: 0
- Hold/do-not-redirect rows: 0

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
- [ ] Magazine/article redirect targets render content shell correctly.
- [ ] Tag-search URLs preserve query and do not crash search UI.
- [ ] Media still loads from `media.wakilisha.africa` or approved provider CDNs.
- [ ] No new `/wp-json/` dependency appears in browser network calls.
- [ ] No old `/wp-content/uploads/` image URL appears as a final image URL.

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
| ARTICLE-001 | high | sample_safe_redirect_target | `/magazine/10-contemporary-kenyan-artists-you-should-know` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-002 | high | sample_safe_redirect_target | `/magazine/10-kenyan-authors-you-should-read` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-003 | high | sample_safe_redirect_target | `/magazine/10-places-in-nairobi-to-explore-art-music-and-design` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-004 | high | sample_safe_redirect_target | `/magazine/15-fatoumata-diawara-songs` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| ARTICLE-005 | high | sample_safe_redirect_target | `/magazine/15-things-to-do-home-5-months` | Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible. | pending |
| TAG-001 | high | sample_tag_search_target | `/search?tag=2026` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-002 | high | sample_tag_search_target | `/search?tag=4mr%20frank%20white` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-003 | high | sample_tag_search_target | `/search?tag=60%20nozzles` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-004 | high | sample_tag_search_target | `/search?tag=8%204%204` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| TAG-005 | high | sample_tag_search_target | `/search?tag=8th%20street%20gang` | Search page loads with tag query preserved; search UI does not crash or blank. | pending |
| EXTRA-REDIRECT-001 | medium | ready_extra_redirect_target | `/magazine` | Magazine landing route loads correctly as the fallback destination. | pending |

## Go/no-go rule

Cutover cannot be approved from this checklist unless all critical React routes pass in browser and smoke-sampled article/search/media behavior is acceptable.

## Deployment checklist

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Readdy Finish update needed: No
Frontend deploy needed: No
Cloudflare/DNS change needed: No
This is a browser QA planning artifact only.
```
