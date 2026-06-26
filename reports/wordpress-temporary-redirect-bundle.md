# WordPress Temporary Redirect Bundle

This is a planning artifact only. Do not apply these redirects until final cutover go/no-go approval.

All redirects in this bundle are temporary `302` redirects. Do not switch to `301` until the React surface has been observed in production and analytics/search behavior is stable.

## Summary

- Total redirect rows: 1171
- Base article/artist redirects: 325
- Tag archive redirects: 846
- Status code: 302
- Preserve query string: yes, where supported
- Validation passed: yes

## Input reports

| Input | Present |
|---|---|
| reports/wordpress-cutover-redirect-plan.json | yes |
| reports/wordpress-tag-archive-cutover-policy.json | yes |
| reports/wordpress-cutover-rehearsal-checklist.json | yes |
| reports/wordpress-react-preview-smoke-report.json | yes |

## Validation

- Duplicate sources: 0
- Self redirects: 0
- Unsafe sources: 0
- Unsafe targets: 0
- Non-internal targets: 0
- Non-302 rows: 0

## Bundle preview

| Source | Target | Group |
|---|---|---|
| `/10-contemporary-kenyan-artists-you-should-know/` | `/magazine/10-contemporary-kenyan-artists-you-should-know` | base_article_artist_redirect |
| `/10-kenyan-authors-you-should-read/` | `/magazine/10-kenyan-authors-you-should-read` | base_article_artist_redirect |
| `/10-places-in-nairobi-to-explore-art-music-and-design/` | `/magazine/10-places-in-nairobi-to-explore-art-music-and-design` | base_article_artist_redirect |
| `/15-fatoumata-diawara-songs/` | `/magazine/15-fatoumata-diawara-songs` | base_article_artist_redirect |
| `/15-things-to-do-home-5-months/` | `/magazine/15-things-to-do-home-5-months` | base_article_artist_redirect |
| `/2021-visual-trends/` | `/magazine/2021-visual-trends` | base_article_artist_redirect |
| `/2022-nyege-nyege-festival-officially-announced/` | `/magazine/2022-nyege-nyege-festival-officially-announced` | base_article_artist_redirect |
| `/2023-trends-to-take-note-of/` | `/magazine/2023-trends-to-take-note-of` | base_article_artist_redirect |
| `/4-tips-for-diversifying-your-diet-on-a-budget/` | `/magazine/4-tips-for-diversifying-your-diet-on-a-budget` | base_article_artist_redirect |
| `/5-cultural-destinations-worth-visiting-in-nairobi/` | `/magazine/5-cultural-destinations-worth-visiting-in-nairobi` | base_article_artist_redirect |
| `/5-golden-rules-of-traversing-downtown-nairobi-ft-melodica-music-store/` | `/magazine/5-golden-rules-of-traversing-downtown-nairobi-ft-melodica-music-store` | base_article_artist_redirect |
| `/5-ideas-to-make-christmas-2020-better/` | `/magazine/5-ideas-to-make-christmas-2020-better` | base_article_artist_redirect |
| `/5-kenyan-artists-to-follow/` | `/magazine/5-kenyan-artists-to-follow` | base_article_artist_redirect |
| `/5-kenyan-artists-to-look-out-for-in-2025/` | `/magazine/5-kenyan-artists-to-look-out-for-in-2025` | base_article_artist_redirect |
| `/5-kenyan-music-events-you-should-attend-at-least-once/` | `/magazine/5-kenyan-music-events-you-should-attend-at-least-once` | base_article_artist_redirect |
| `/5-kenyan-music-podcasts-you-should-listen-to/` | `/magazine/5-kenyan-music-podcasts-you-should-listen-to` | base_article_artist_redirect |
| `/5-reasons-why-you-should-wear-a-mask/` | `/magazine/5-reasons-why-you-should-wear-a-mask` | base_article_artist_redirect |
| `/8-kenyan-artists-making-waves-in-2021/` | `/magazine/8-kenyan-artists-making-waves-in-2021` | base_article_artist_redirect |
| `/a-bad-memory-recorder-practice-and-female-friendships/` | `/magazine/a-bad-memory-recorder-practice-and-female-friendships` | base_article_artist_redirect |
| `/acumen-and-dominion-why-wakadinali-only-sit-in-the-cockpit-of-entertainment/` | `/magazine/acumen-and-dominion-why-wakadinali-only-sit-in-the-cockpit-of-entertainment` | base_article_artist_redirect |
| `/affordable-art-show-2023/` | `/magazine/affordable-art-show-2023` | base_article_artist_redirect |
| `/african-renaissance-through-music-part-ii/` | `/magazine/african-renaissance-through-music-part-ii` | base_article_artist_redirect |
| `/african-renaissance-through-music/` | `/magazine/african-renaissance-through-music` | base_article_artist_redirect |
| `/africas-online-gossip-enterprise-and-its-place-in-the-entertainment-industry/` | `/magazine/africas-online-gossip-enterprise-and-its-place-in-the-entertainment-industry` | base_article_artist_redirect |
| `/ai-could-take-my-job-and-maybe-thats-a-good-thing/` | `/magazine/ai-could-take-my-job-and-maybe-thats-a-good-thing` | base_article_artist_redirect |
| `/ai-for-all/` | `/magazine/ai-for-all` | base_article_artist_redirect |
| `/album-review-58-flava-by-buruklyn-boyz/` | `/magazine/album-review-58-flava-by-buruklyn-boyz` | base_article_artist_redirect |
| `/album-review-alusa-why-are-you-topless/` | `/magazine/album-review-alusa-why-are-you-topless` | base_article_artist_redirect |
| `/album-review-dusk-to-dawn-by-serro/` | `/magazine/album-review-dusk-to-dawn-by-serro` | base_article_artist_redirect |
| `/album-review-labor-of-love-zaituni-wambui/` | `/magazine/album-review-labor-of-love-zaituni-wambui` | base_article_artist_redirect |
| `/album-review-love-hate-pt-1/` | `/magazine/album-review-love-hate-pt-1` | base_article_artist_redirect |
| `/album-review-love-letters-3-by-caleb-awiti/` | `/magazine/album-review-love-letters-3-by-caleb-awiti` | base_article_artist_redirect |
| `/album-review-mauru-unit/` | `/magazine/album-review-mauru-unit` | base_article_artist_redirect |
| `/album-review-maybe-ii-by-xenia-manasseh-and-ukweli/` | `/magazine/album-review-maybe-ii-by-xenia-manasseh-and-ukweli` | base_article_artist_redirect |
| `/album-review-mtoto-wa-khadija-by-mejja/` | `/magazine/album-review-mtoto-wa-khadija-by-mejja` | base_article_artist_redirect |
| `/album-review-now-its-experience-talking-blinky-bill-muthoni-drummer-queen/` | `/magazine/album-review-now-its-experience-talking-blinky-bill-muthoni-drummer-queen` | base_article_artist_redirect |
| `/album-review-sumbua-by-lil-maina/` | `/magazine/album-review-sumbua-by-lil-maina` | base_article_artist_redirect |
| `/album-review-sweetest-time-by-maya-amolo/` | `/magazine/album-review-sweetest-time-by-maya-amolo` | base_article_artist_redirect |
| `/album-review-the-lion-of-sudah/` | `/magazine/album-review-the-lion-of-sudah` | base_article_artist_redirect |
| `/album-review-time2023-by-h_art-the-band/` | `/magazine/album-review-time2023-by-h_art-the-band` | base_article_artist_redirect |
| `/album-review-victims-of-madness-2-0/` | `/magazine/album-review-victims-of-madness-2-0` | base_article_artist_redirect |
| `/album-review-we-dont-need-money-to-be-rich-by-mutoriah/` | `/magazine/album-review-we-dont-need-money-to-be-rich-by-mutoriah` | base_article_artist_redirect |
| `/all-that-glitters/` | `/magazine/all-that-glitters` | base_article_artist_redirect |
| `/anyango-mpinga-leading-the-way-for-kenyan-fashion-designers/` | `/magazine/anyango-mpinga-leading-the-way-for-kenyan-fashion-designers` | base_article_artist_redirect |
| `/art-guide-mapping-nairobi-cultural-hotspots/` | `/magazine/art-guide-mapping-nairobi-cultural-hotspots` | base_article_artist_redirect |
| `/artist/4mr-frank-white/` | `/artists/4mr-frank-white` | base_article_artist_redirect |
| `/artist/ayrosh/` | `/artists/ayrosh` | base_article_artist_redirect |
| `/artist/ayub-ogada/` | `/artists/ayub-ogada` | base_article_artist_redirect |
| `/artist/bahati/` | `/artists/bahati` | base_article_artist_redirect |
| `/artist/bensoul/` | `/artists/bensoul` | base_article_artist_redirect |
| `/artist/bien/` | `/artists/bien` | base_article_artist_redirect |
| `/artist/big-nyagz/` | `/artists/big-nyagz` | base_article_artist_redirect |
| `/artist/blinky-bill/` | `/artists/blinky-bill` | base_article_artist_redirect |
| `/artist/boutross/` | `/artists/boutross` | base_article_artist_redirect |
| `/artist/brandy-maina/` | `/artists/brandy-maina` | base_article_artist_redirect |
| `/artist/breeder-lw/` | `/artists/breeder-lw` | base_article_artist_redirect |
| `/artist/bridget-blue/` | `/artists/bridget-blue` | base_article_artist_redirect |
| `/artist/buruklyn-boyz/` | `/artists/buruklyn-boyz` | base_article_artist_redirect |
| `/artist/caleb-awiti/` | `/artists/caleb-awiti` | base_article_artist_redirect |
| `/artist/charisma/` | `/artists/charisma` | base_article_artist_redirect |
| `/artist/chimano/` | `/artists/chimano` | base_article_artist_redirect |
| `/artist/chris-kaiga/` | `/artists/chris-kaiga` | base_article_artist_redirect |
| `/artist/ciano-maimba/` | `/artists/ciano-maimba` | base_article_artist_redirect |
| `/artist/coster-ojwang/` | `/artists/coster-ojwang` | base_article_artist_redirect |
| `/artist/dyana-cods/` | `/artists/dyana-cods` | base_article_artist_redirect |
| `/artist/e-sir/` | `/artists/e-sir` | base_article_artist_redirect |
| `/artist/elani/` | `/artists/elani` | base_article_artist_redirect |
| `/artist/elsy-wameyo/` | `/artists/elsy-wameyo` | base_article_artist_redirect |
| `/artist/eric-wainaina/` | `/artists/eric-wainaina` | base_article_artist_redirect |
| `/artist/ethic/` | `/artists/ethic` | base_article_artist_redirect |
| `/artist/exray-taniua/` | `/artists/exray-taniua` | base_article_artist_redirect |
| `/artist/fancy-fingers/` | `/artists/fancy-fingers` | base_article_artist_redirect |
| `/artist/fathermoh/` | `/artists/fathermoh` | base_article_artist_redirect |
| `/artist/fena-gitu/` | `/artists/fena-gitu` | base_article_artist_redirect |
| `/artist/flier/` | `/artists/flier` | base_article_artist_redirect |
| `/artist/genes1s/` | `/artists/genes1s` | base_article_artist_redirect |
| `/artist/h_art-the-band/` | `/artists/h_art-the-band` | base_article_artist_redirect |
| `/artist/israel-onyach/` | `/artists/israel-onyach` | base_article_artist_redirect |
| `/artist/iyanii/` | `/artists/iyanii` | base_article_artist_redirect |
| `/artist/joefes/` | `/artists/joefes` | base_article_artist_redirect |
| ... | ... | 1091 more rows in CSV/JSON/TXT |

## Application rule

- Do not apply this bundle before the final cutover rehearsal passes.
- Apply as 302 only.
- Keep media redirects separate from app route redirects.
- Keep WordPress security endpoint blocks separate from app route redirects.
- Roll back by disabling this bundle first, not by touching media/security rules.

## Deployment checklist

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Readdy Finish update needed: No
Frontend deploy needed: No
Cloudflare/DNS change needed: No
This is a redirect planning artifact only.
```
