# WordPress React Preview Smoke Report

This report verifies that a React preview origin can serve core cutover routes before any DNS/IP switch.

It does not apply redirects, change Cloudflare, or deploy anything.

## Summary

- Preview origin: http://127.0.0.1:4173
- Routes checked: 60
- Passed: 60
- Failed: 0
- All passed: yes

## Group counts

- chart_runtime_route: 3
- core_route: 7
- sample_safe_redirect_target: 25
- sample_tag_redirect_target: 25

## Results

| Group | Route | Status | Passed | Reason |
|---|---|---:|---|---|
| core_route | `/` | 200 | yes | ok |
| core_route | `/magazine` | 200 | yes | ok |
| core_route | `/charts` | 200 | yes | ok |
| core_route | `/artists` | 200 | yes | ok |
| core_route | `/releases` | 200 | yes | ok |
| core_route | `/tracks` | 200 | yes | ok |
| core_route | `/search` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/10-contemporary-kenyan-artists-you-should-know` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/10-kenyan-authors-you-should-read` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/10-places-in-nairobi-to-explore-art-music-and-design` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/15-fatoumata-diawara-songs` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/15-things-to-do-home-5-months` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/2021-visual-trends` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/2022-nyege-nyege-festival-officially-announced` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/2023-trends-to-take-note-of` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/4-tips-for-diversifying-your-diet-on-a-budget` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/5-cultural-destinations-worth-visiting-in-nairobi` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/5-golden-rules-of-traversing-downtown-nairobi-ft-melodica-music-store` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/5-ideas-to-make-christmas-2020-better` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/5-kenyan-artists-to-follow` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/5-kenyan-artists-to-look-out-for-in-2025` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/5-kenyan-music-events-you-should-attend-at-least-once` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/5-kenyan-music-podcasts-you-should-listen-to` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/5-reasons-why-you-should-wear-a-mask` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/8-kenyan-artists-making-waves-in-2021` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/a-bad-memory-recorder-practice-and-female-friendships` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/acumen-and-dominion-why-wakadinali-only-sit-in-the-cockpit-of-entertainment` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/affordable-art-show-2023` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/african-renaissance-through-music-part-ii` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/african-renaissance-through-music` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/africas-online-gossip-enterprise-and-its-place-in-the-entertainment-industry` | 200 | yes | ok |
| sample_safe_redirect_target | `/magazine/ai-could-take-my-job-and-maybe-thats-a-good-thing` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=2026` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=4mr%20frank%20white` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=60%20nozzles` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=8%204%204` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=8th%20street%20gang` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=a%20grain%20of%20wheat` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=a%20nurse%20toto` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=aahil` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=aaron%20rimbui` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=ababu%20namwamba` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=abubakar%20majid` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=accessibility` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=across%20the%20bridge` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=act%20of%20love` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=ado%20veli` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=adobe` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=afcfta` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=affordable%20art%20show` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=africa` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=african%20continental%20free%20trade%20area` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=african%20fiction` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=african%20music` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=afro%20house` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=afrobeat` | 200 | yes | ok |
| sample_tag_redirect_target | `/search?tag=afroelle%20magazine` | 200 | yes | ok |
| chart_runtime_route | `/charts/top-100/ke/2026-01-26` | 200 | yes | ok |
| chart_runtime_route | `/charts/top-gengetone/ke/2026-01-26` | 200 | yes | ok |
| chart_runtime_route | `/charts/top-rnb/ke/2026-01-26` | 200 | yes | ok |

## Cutover interpretation

- Passing this check means the preview origin returns the React HTML shell for the tested deep links.
- Chart pages still need browser QA because client-side data loading cannot be fully proven with curl-style HTML checks.
- Keep all cutover redirects as 302 until production behavior is stable.

## Deployment checklist

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Readdy Finish update needed: No
Frontend deploy needed: No
Cloudflare/DNS change needed: No
This is a smoke-test artifact only.
```
