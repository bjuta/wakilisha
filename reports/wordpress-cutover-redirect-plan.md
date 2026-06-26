# WordPress Cutover Redirect Plan

This is a planning artifact only. Do not apply these redirects until the final React/IP cutover rehearsal passes.

Use 302 temporary redirects first. Do not switch these to 301 until the new React surface has been observed in production and analytics/search behavior is stable.

## Summary

- Total parity rows: 2118
- Native React routes: 6
- Safe 302 redirect rows: 325
- Candidate redirect rows needing confirmation: 2
- Manual/product blockers: 910
- Intentional 404 rows: 11
- Keep-blocked security rows: 4
- Ignored non-HTML/feed rows: 860

## Decision counts

- ignore_for_html_cutover: 860
- intentional_404: 11
- keep_blocked: 4
- manual_review: 908
- native_react_route: 6
- product_decision_required: 2
- redirect_candidate: 2
- redirect_to_react_route: 325

## Blocker buckets

- author_archive: 28
- chart_runtime_route: 3
- legacy_article_missing_react_route: 1
- legacy_section_archive: 16
- static_or_account_route: 12
- tag_archive: 848
- woocommerce_dynamic_route: 2

## Safe 302 redirects

| Source | Target | Confidence | Notes |
|---|---|---|---|
| `/10-contemporary-kenyan-artists-you-should-know/` | `/magazine/10-contemporary-kenyan-artists-you-should-know` | high | Legacy article/page slug has a matching React magazine route. |
| `/10-kenyan-authors-you-should-read/` | `/magazine/10-kenyan-authors-you-should-read` | high | Legacy article/page slug has a matching React magazine route. |
| `/10-places-in-nairobi-to-explore-art-music-and-design/` | `/magazine/10-places-in-nairobi-to-explore-art-music-and-design` | high | Legacy article/page slug has a matching React magazine route. |
| `/15-fatoumata-diawara-songs/` | `/magazine/15-fatoumata-diawara-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/15-things-to-do-home-5-months/` | `/magazine/15-things-to-do-home-5-months` | high | Legacy article/page slug has a matching React magazine route. |
| `/2021-visual-trends/` | `/magazine/2021-visual-trends` | high | Legacy article/page slug has a matching React magazine route. |
| `/2022-nyege-nyege-festival-officially-announced/` | `/magazine/2022-nyege-nyege-festival-officially-announced` | high | Legacy article/page slug has a matching React magazine route. |
| `/2023-trends-to-take-note-of/` | `/magazine/2023-trends-to-take-note-of` | high | Legacy article/page slug has a matching React magazine route. |
| `/4-tips-for-diversifying-your-diet-on-a-budget/` | `/magazine/4-tips-for-diversifying-your-diet-on-a-budget` | high | Legacy article/page slug has a matching React magazine route. |
| `/5-cultural-destinations-worth-visiting-in-nairobi/` | `/magazine/5-cultural-destinations-worth-visiting-in-nairobi` | high | Legacy article/page slug has a matching React magazine route. |
| `/5-golden-rules-of-traversing-downtown-nairobi-ft-melodica-music-store/` | `/magazine/5-golden-rules-of-traversing-downtown-nairobi-ft-melodica-music-store` | high | Legacy article/page slug has a matching React magazine route. |
| `/5-ideas-to-make-christmas-2020-better/` | `/magazine/5-ideas-to-make-christmas-2020-better` | high | Legacy article/page slug has a matching React magazine route. |
| `/5-kenyan-artists-to-follow/` | `/magazine/5-kenyan-artists-to-follow` | high | Legacy article/page slug has a matching React magazine route. |
| `/5-kenyan-artists-to-look-out-for-in-2025/` | `/magazine/5-kenyan-artists-to-look-out-for-in-2025` | high | Legacy article/page slug has a matching React magazine route. |
| `/5-kenyan-music-events-you-should-attend-at-least-once/` | `/magazine/5-kenyan-music-events-you-should-attend-at-least-once` | high | Legacy article/page slug has a matching React magazine route. |
| `/5-kenyan-music-podcasts-you-should-listen-to/` | `/magazine/5-kenyan-music-podcasts-you-should-listen-to` | high | Legacy article/page slug has a matching React magazine route. |
| `/5-reasons-why-you-should-wear-a-mask/` | `/magazine/5-reasons-why-you-should-wear-a-mask` | high | Legacy article/page slug has a matching React magazine route. |
| `/8-kenyan-artists-making-waves-in-2021/` | `/magazine/8-kenyan-artists-making-waves-in-2021` | high | Legacy article/page slug has a matching React magazine route. |
| `/a-bad-memory-recorder-practice-and-female-friendships/` | `/magazine/a-bad-memory-recorder-practice-and-female-friendships` | high | Legacy article/page slug has a matching React magazine route. |
| `/acumen-and-dominion-why-wakadinali-only-sit-in-the-cockpit-of-entertainment/` | `/magazine/acumen-and-dominion-why-wakadinali-only-sit-in-the-cockpit-of-entertainment` | high | Legacy article/page slug has a matching React magazine route. |
| `/affordable-art-show-2023/` | `/magazine/affordable-art-show-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/african-renaissance-through-music-part-ii/` | `/magazine/african-renaissance-through-music-part-ii` | high | Legacy article/page slug has a matching React magazine route. |
| `/african-renaissance-through-music/` | `/magazine/african-renaissance-through-music` | high | Legacy article/page slug has a matching React magazine route. |
| `/africas-online-gossip-enterprise-and-its-place-in-the-entertainment-industry/` | `/magazine/africas-online-gossip-enterprise-and-its-place-in-the-entertainment-industry` | high | Legacy article/page slug has a matching React magazine route. |
| `/ai-could-take-my-job-and-maybe-thats-a-good-thing/` | `/magazine/ai-could-take-my-job-and-maybe-thats-a-good-thing` | high | Legacy article/page slug has a matching React magazine route. |
| `/ai-for-all/` | `/magazine/ai-for-all` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-58-flava-by-buruklyn-boyz/` | `/magazine/album-review-58-flava-by-buruklyn-boyz` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-alusa-why-are-you-topless/` | `/magazine/album-review-alusa-why-are-you-topless` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-dusk-to-dawn-by-serro/` | `/magazine/album-review-dusk-to-dawn-by-serro` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-labor-of-love-zaituni-wambui/` | `/magazine/album-review-labor-of-love-zaituni-wambui` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-love-hate-pt-1/` | `/magazine/album-review-love-hate-pt-1` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-love-letters-3-by-caleb-awiti/` | `/magazine/album-review-love-letters-3-by-caleb-awiti` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-mauru-unit/` | `/magazine/album-review-mauru-unit` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-maybe-ii-by-xenia-manasseh-and-ukweli/` | `/magazine/album-review-maybe-ii-by-xenia-manasseh-and-ukweli` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-mtoto-wa-khadija-by-mejja/` | `/magazine/album-review-mtoto-wa-khadija-by-mejja` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-now-its-experience-talking-blinky-bill-muthoni-drummer-queen/` | `/magazine/album-review-now-its-experience-talking-blinky-bill-muthoni-drummer-queen` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-sumbua-by-lil-maina/` | `/magazine/album-review-sumbua-by-lil-maina` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-sweetest-time-by-maya-amolo/` | `/magazine/album-review-sweetest-time-by-maya-amolo` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-the-lion-of-sudah/` | `/magazine/album-review-the-lion-of-sudah` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-time2023-by-h_art-the-band/` | `/magazine/album-review-time2023-by-h_art-the-band` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-victims-of-madness-2-0/` | `/magazine/album-review-victims-of-madness-2-0` | high | Legacy article/page slug has a matching React magazine route. |
| `/album-review-we-dont-need-money-to-be-rich-by-mutoriah/` | `/magazine/album-review-we-dont-need-money-to-be-rich-by-mutoriah` | high | Legacy article/page slug has a matching React magazine route. |
| `/all-that-glitters/` | `/magazine/all-that-glitters` | high | Legacy article/page slug has a matching React magazine route. |
| `/anyango-mpinga-leading-the-way-for-kenyan-fashion-designers/` | `/magazine/anyango-mpinga-leading-the-way-for-kenyan-fashion-designers` | high | Legacy article/page slug has a matching React magazine route. |
| `/art-guide-mapping-nairobi-cultural-hotspots/` | `/magazine/art-guide-mapping-nairobi-cultural-hotspots` | high | Legacy article/page slug has a matching React magazine route. |
| `/artist/4mr-frank-white/` | `/artists/4mr-frank-white` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/ayrosh/` | `/artists/ayrosh` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/ayub-ogada/` | `/artists/ayub-ogada` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/bahati/` | `/artists/bahati` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/bensoul/` | `/artists/bensoul` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/bien/` | `/artists/bien` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/big-nyagz/` | `/artists/big-nyagz` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/blinky-bill/` | `/artists/blinky-bill` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/boutross/` | `/artists/boutross` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/brandy-maina/` | `/artists/brandy-maina` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/breeder-lw/` | `/artists/breeder-lw` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/bridget-blue/` | `/artists/bridget-blue` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/buruklyn-boyz/` | `/artists/buruklyn-boyz` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/caleb-awiti/` | `/artists/caleb-awiti` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/charisma/` | `/artists/charisma` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/chimano/` | `/artists/chimano` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/chris-kaiga/` | `/artists/chris-kaiga` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/ciano-maimba/` | `/artists/ciano-maimba` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/coster-ojwang/` | `/artists/coster-ojwang` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/dyana-cods/` | `/artists/dyana-cods` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/e-sir/` | `/artists/e-sir` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/elani/` | `/artists/elani` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/elsy-wameyo/` | `/artists/elsy-wameyo` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/eric-wainaina/` | `/artists/eric-wainaina` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/ethic/` | `/artists/ethic` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/exray-taniua/` | `/artists/exray-taniua` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/fancy-fingers/` | `/artists/fancy-fingers` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/fathermoh/` | `/artists/fathermoh` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/fena-gitu/` | `/artists/fena-gitu` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/flier/` | `/artists/flier` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/genes1s/` | `/artists/genes1s` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/h_art-the-band/` | `/artists/h_art-the-band` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/israel-onyach/` | `/artists/israel-onyach` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/iyanii/` | `/artists/iyanii` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/joefes/` | `/artists/joefes` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/jua-cali/` | `/artists/jua-cali` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/juliani/` | `/artists/juliani` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/june-gachui/` | `/artists/june-gachui` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/just-a-band/` | `/artists/just-a-band` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/kaa-la-moto/` | `/artists/kaa-la-moto` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/kagwe-mungai/` | `/artists/kagwe-mungai` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/kahush/` | `/artists/kahush` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/kalamashaka/` | `/artists/kalamashaka` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/karura-voices/` | `/artists/karura-voices` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/katapilla/` | `/artists/katapilla` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/kethan/` | `/artists/kethan` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/khaligraph-jones/` | `/artists/khaligraph-jones` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/king-kaka/` | `/artists/king-kaka` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/kitu-sewer/` | `/artists/kitu-sewer` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/kleptomaniax/` | `/artists/kleptomaniax` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/krg-the-don/` | `/artists/krg-the-don` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/kushman/` | `/artists/kushman` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/lil-maina/` | `/artists/lil-maina` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/maandy/` | `/artists/maandy` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/maovete/` | `/artists/maovete` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/masauti/` | `/artists/masauti` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/mastar-vk/` | `/artists/mastar-vk` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/matata/` | `/artists/matata` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/matt-ngesa/` | `/artists/matt-ngesa` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/mau-from-nowhere/` | `/artists/mau-from-nowhere` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/maya-amolo/` | `/artists/maya-amolo` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/mayonde/` | `/artists/mayonde` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/mbuzi-gang/` | `/artists/mbuzi-gang` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/mejja/` | `/artists/mejja` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/mordecai-dex/` | `/artists/mordecai-dex` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/muthaka/` | `/artists/muthaka` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/mutoriah/` | `/artists/mutoriah` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/nadia-mukami/` | `/artists/nadia-mukami` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/ndovu-kuu/` | `/artists/ndovu-kuu` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/njerae/` | `/artists/njerae` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/njoki-karu/` | `/artists/njoki-karu` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/nyashinski/` | `/artists/nyashinski` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/ochungulo-family/` | `/artists/ochungulo-family` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/octopizzo/` | `/artists/octopizzo` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/okello-max/` | `/artists/okello-max` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/otile-brown/` | `/artists/otile-brown` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/polaris-pauline/` | `/artists/polaris-pauline` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/rekles/` | `/artists/rekles` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/sabi-wu/` | `/artists/sabi-wu` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/sauti-sol/` | `/artists/sauti-sol` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/savara/` | `/artists/savara` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/savinnah/` | `/artists/savinnah` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/scar-mkadinali/` | `/artists/scar-mkadinali` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/serro/` | `/artists/serro` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/sewersydaa/` | `/artists/sewersydaa` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/shekinah-karen/` | `/artists/shekinah-karen` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/sofiya-nzau/` | `/artists/sofiya-nzau` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/ssaru/` | `/artists/ssaru` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/stacy-kamatu/` | `/artists/stacy-kamatu` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/swat-matire/` | `/artists/swat-matire` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/teslah/` | `/artists/teslah` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/tina-ardor/` | `/artists/tina-ardor` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/tipsy-gee/` | `/artists/tipsy-gee` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/toxic-lyrikali/` | `/artists/toxic-lyrikali` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/trio-mio/` | `/artists/trio-mio` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/ukweli/` | `/artists/ukweli` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/uncojingjong/` | `/artists/uncojingjong` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/unspoken-salaton/` | `/artists/unspoken-salaton` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/v-be/` | `/artists/v-be` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/vic-west/` | `/artists/vic-west` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/wakadinali/` | `/artists/wakadinali` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/wanavokali/` | `/artists/wanavokali` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/wangechi/` | `/artists/wangechi` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/wanja-wohoro/` | `/artists/wanja-wohoro` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/watendawili/` | `/artists/watendawili` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/we-are-nubia/` | `/artists/we-are-nubia` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/willy-paul/` | `/artists/willy-paul` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/winyo/` | `/artists/winyo` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/wyre/` | `/artists/wyre` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/xenia-manasseh/` | `/artists/xenia-manasseh` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/yaba/` | `/artists/yaba` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/ywaya-tajiri/` | `/artists/ywaya-tajiri` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/zaituni/` | `/artists/zaituni` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/zowie-kengocha/` | `/artists/zowie-kengocha` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/artist/zzero-sufuri/` | `/artists/zzero-sufuri` | high | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/atemi-brings-the-joy-of-christmas-alive-in-tis-the-season-album/` | `/magazine/atemi-brings-the-joy-of-christmas-alive-in-tis-the-season-album` | high | Legacy article/page slug has a matching React magazine route. |
| `/beef-the-rivalries-that-shaped-kenyan-music/` | `/magazine/beef-the-rivalries-that-shaped-kenyan-music` | high | Legacy article/page slug has a matching React magazine route. |
| `/best-apple-music-playlists-to-discover-new-kenyan-music/` | `/magazine/best-apple-music-playlists-to-discover-new-kenyan-music` | high | Legacy article/page slug has a matching React magazine route. |
| `/best-new-kenyan-music-2022/` | `/magazine/best-new-kenyan-music-2022` | high | Legacy article/page slug has a matching React magazine route. |
| `/bigpin-is-back-with-new-ep-pino/` | `/magazine/bigpin-is-back-with-new-ep-pino` | high | Legacy article/page slug has a matching React magazine route. |
| `/birth-of-gengetone/` | `/magazine/birth-of-gengetone` | high | Legacy article/page slug has a matching React magazine route. |
| `/building-a-sustainable-music-industry-in-kenya/` | `/magazine/building-a-sustainable-music-industry-in-kenya` | high | Legacy article/page slug has a matching React magazine route. |
| `/buruklyn-boyz-inspiring-a-new-generation-of-young-artists/` | `/magazine/buruklyn-boyz-inspiring-a-new-generation-of-young-artists` | high | Legacy article/page slug has a matching React magazine route. |
| `/calling-african-creatives-your-comprehensive-guide-to-2024s-end-of-year-noteworthy-prizes-residencies-masterclasses-and-more/` | `/magazine/calling-african-creatives-your-comprehensive-guide-to-2024s-end-of-year-noteworthy-prizes-residencies-masterclasses-and-more` | high | Legacy article/page slug has a matching React magazine route. |
| `/capture-the-beauty-of-nature-through-photography/` | `/magazine/capture-the-beauty-of-nature-through-photography` | high | Legacy article/page slug has a matching React magazine route. |
| `/case-to-rename-landmarks-of-africa/` | `/magazine/case-to-rename-landmarks-of-africa` | high | Legacy article/page slug has a matching React magazine route. |
| `/cave-bureau-indigenous-communities-2023-venice-architecture-biennale/` | `/magazine/cave-bureau-indigenous-communities-2023-venice-architecture-biennale` | high | Legacy article/page slug has a matching React magazine route. |
| `/chapter-5-a-good-citizen/` | `/magazine/chapter-5-a-good-citizen` | high | Legacy article/page slug has a matching React magazine route. |
| `/christmas-in-2020/` | `/magazine/christmas-in-2020` | high | Legacy article/page slug has a matching React magazine route. |
| `/chronicles-of-gedi-the-heart-of-a-jackal/` | `/magazine/chronicles-of-gedi-the-heart-of-a-jackal` | high | Legacy article/page slug has a matching React magazine route. |
| `/chronicles-of-gedi-the-hunter-and-the-roving-pt-1/` | `/magazine/chronicles-of-gedi-the-hunter-and-the-roving-pt-1` | high | Legacy article/page slug has a matching React magazine route. |
| `/circle-art-to-showcase-dickens-otienos-new-works-at-art-dubai-2023/` | `/magazine/circle-art-to-showcase-dickens-otienos-new-works-at-art-dubai-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/collaboration-in-kenyan-music-industry/` | `/magazine/collaboration-in-kenyan-music-industry` | high | Legacy article/page slug has a matching React magazine route. |
| `/contacts/` | `/contact` | high | Known legacy static/account route has a matching React destination. |
| `/cultivating-new-cultural-identity/` | `/magazine/cultivating-new-cultural-identity` | high | Legacy article/page slug has a matching React magazine route. |
| `/cultural-destinations-outside-nairobi-worth-visiting/` | `/magazine/cultural-destinations-outside-nairobi-worth-visiting` | high | Legacy article/page slug has a matching React magazine route. |
| `/dear-baba-from-the-africa-you-dreamt-of/` | `/magazine/dear-baba-from-the-africa-you-dreamt-of` | high | Legacy article/page slug has a matching React magazine route. |
| `/debunking-5-top-conspiracy-theories-in-kenya/` | `/magazine/debunking-5-top-conspiracy-theories-in-kenya` | high | Legacy article/page slug has a matching React magazine route. |
| `/delightful-start-to-season-2-of-bare-sessions/` | `/magazine/delightful-start-to-season-2-of-bare-sessions` | high | Legacy article/page slug has a matching React magazine route. |
| `/designing-for-accessibility-best-practices-for-inclusive-design-in-digital-and-built-environments/` | `/magazine/designing-for-accessibility-best-practices-for-inclusive-design-in-digital-and-built-environments` | high | Legacy article/page slug has a matching React magazine route. |
| `/disko-album-review-kodongklan/` | `/magazine/disko-album-review-kodongklan` | high | Legacy article/page slug has a matching React magazine route. |
| `/does-culture-shape-education-or-does-education-shape-culture/` | `/magazine/does-culture-shape-education-or-does-education-shape-culture` | high | Legacy article/page slug has a matching React magazine route. |
| `/duka/` | `/` | high | Known legacy static/account route has a matching React destination. |
| `/eliud-kipchoge-pursues-marathon-grand-slam/` | `/magazine/eliud-kipchoge-pursues-marathon-grand-slam` | high | Legacy article/page slug has a matching React magazine route. |
| `/embracing-linguistic-diversity-in-a-globalized-world/` | `/magazine/embracing-linguistic-diversity-in-a-globalized-world` | high | Legacy article/page slug has a matching React magazine route. |
| `/en-route-watendawili-album-review/` | `/magazine/en-route-watendawili-album-review` | high | Legacy article/page slug has a matching React magazine route. |
| `/enabling-the-adoption-of-afcfta-through-digitalization/` | `/magazine/enabling-the-adoption-of-afcfta-through-digitalization` | high | Legacy article/page slug has a matching React magazine route. |
| `/ep-review-wameyo-by-elsy-wameyo/` | `/magazine/ep-review-wameyo-by-elsy-wameyo` | high | Legacy article/page slug has a matching React magazine route. |
| `/eric-rugara-chapter-in-the-story-of-surrealism-writing-in-kenya/` | `/magazine/eric-rugara-chapter-in-the-story-of-surrealism-writing-in-kenya` | high | Legacy article/page slug has a matching React magazine route. |
| `/evolution-of-drill-music-in-kenya/` | `/magazine/evolution-of-drill-music-in-kenya` | high | Legacy article/page slug has a matching React magazine route. |
| `/evolution-of-ideas/` | `/magazine/evolution-of-ideas` | high | Legacy article/page slug has a matching React magazine route. |
| `/expand-your-worldview-resources-to-broaden-your-perspective/` | `/magazine/expand-your-worldview-resources-to-broaden-your-perspective` | high | Legacy article/page slug has a matching React magazine route. |
| `/faith-kipyegon-cementing-the-reign-of-a-running-royal/` | `/magazine/faith-kipyegon-cementing-the-reign-of-a-running-royal` | high | Legacy article/page slug has a matching React magazine route. |
| `/femi-one-speaks-to-the-hearts-of-kenyan-youth-everywhere/` | `/magazine/femi-one-speaks-to-the-hearts-of-kenyan-youth-everywhere` | high | Legacy article/page slug has a matching React magazine route. |
| `/fiction-books-by-kenyan-authors-to-read-at-least-once/` | `/magazine/fiction-books-by-kenyan-authors-to-read-at-least-once` | high | Legacy article/page slug has a matching React magazine route. |
| `/flier-is-for-lovers-in-endless-revolutions/` | `/magazine/flier-is-for-lovers-in-endless-revolutions` | high | Legacy article/page slug has a matching React magazine route. |
| `/found-in-translation-the-rise-of-kenyan-vernacular-pop-music/` | `/magazine/found-in-translation-the-rise-of-kenyan-vernacular-pop-music` | high | Legacy article/page slug has a matching React magazine route. |
| `/from-benga-to-gengetone-a-history-of-kenyan-music/` | `/magazine/from-benga-to-gengetone-a-history-of-kenyan-music` | high | Legacy article/page slug has a matching React magazine route. |
| `/from-cairo-to-cape-town-100-relaxing-african-songs-part-1/` | `/magazine/from-cairo-to-cape-town-100-relaxing-african-songs-part-1` | high | Legacy article/page slug has a matching React magazine route. |
| `/from-cairo-to-cape-town-100-relaxing-african-songs-part-2/` | `/magazine/from-cairo-to-cape-town-100-relaxing-african-songs-part-2` | high | Legacy article/page slug has a matching React magazine route. |
| `/from-cairo-to-cape-town-100-relaxing-african-songs-part-5/` | `/magazine/from-cairo-to-cape-town-100-relaxing-african-songs-part-5` | high | Legacy article/page slug has a matching React magazine route. |
| `/from-cairo-to-cape-town-african-music-playlist-part-3/` | `/magazine/from-cairo-to-cape-town-african-music-playlist-part-3` | high | Legacy article/page slug has a matching React magazine route. |
| `/from-cairo-to-cape-town-relaxing-african-music-part-4/` | `/magazine/from-cairo-to-cape-town-relaxing-african-music-part-4` | high | Legacy article/page slug has a matching React magazine route. |
| `/gen-z-account-of-2022-general-elections-in-kenya/` | `/magazine/gen-z-account-of-2022-general-elections-in-kenya` | high | Legacy article/page slug has a matching React magazine route. |
| `/gods-justice-and-mercy/` | `/magazine/gods-justice-and-mercy` | high | Legacy article/page slug has a matching React magazine route. |
| `/growing-pains-blankets-wine/` | `/magazine/growing-pains-blankets-wine` | high | Legacy article/page slug has a matching React magazine route. |
| `/guide-to-nfts-everything-you-need-to-know-about-non-fungible-tokens/` | `/magazine/guide-to-nfts-everything-you-need-to-know-about-non-fungible-tokens` | high | Legacy article/page slug has a matching React magazine route. |
| `/history-of-nairobi-street-art-movement/` | `/magazine/history-of-nairobi-street-art-movement` | high | Legacy article/page slug has a matching React magazine route. |
| `/how-afrohouse-found-a-second-home-in-nairobi/` | `/magazine/how-afrohouse-found-a-second-home-in-nairobi` | high | Legacy article/page slug has a matching React magazine route. |
| `/how-kenyan-arbantone-could-take-root-as-a-genre/` | `/magazine/how-kenyan-arbantone-could-take-root-as-a-genre` | high | Legacy article/page slug has a matching React magazine route. |
| `/how-to-design-for-the-blind/` | `/magazine/how-to-design-for-the-blind` | high | Legacy article/page slug has a matching React magazine route. |
| `/how-to-hire-creatives/` | `/magazine/how-to-hire-creatives` | high | Legacy article/page slug has a matching React magazine route. |
| `/how-to-make-digital-art/` | `/magazine/how-to-make-digital-art` | high | Legacy article/page slug has a matching React magazine route. |
| `/how-to-make-new-friends/` | `/magazine/how-to-make-new-friends` | high | Legacy article/page slug has a matching React magazine route. |
| `/how-to-transfer-music-playlists-from-spotify-to-apple-music/` | `/magazine/how-to-transfer-music-playlists-from-spotify-to-apple-music` | high | Legacy article/page slug has a matching React magazine route. |
| `/how-working-from-home-is-changing-the-creative-industry/` | `/magazine/how-working-from-home-is-changing-the-creative-industry` | high | Legacy article/page slug has a matching React magazine route. |
| `/importance-of-art-in-engaging-the-community/` | `/magazine/importance-of-art-in-engaging-the-community` | high | Legacy article/page slug has a matching React magazine route. |
| `/interview-maina-murumba-future-comedy-in-kenya/` | `/magazine/interview-maina-murumba-future-comedy-in-kenya` | high | Legacy article/page slug has a matching React magazine route. |
| `/january-2024-noteworthy-fellowships-residencies-and-grants-for-kenyan-creatives/` | `/magazine/january-2024-noteworthy-fellowships-residencies-and-grants-for-kenyan-creatives` | high | Legacy article/page slug has a matching React magazine route. |
| `/joseph-mbatia-bertiers-sarakasi-za-siasa-art-exhibition/` | `/magazine/joseph-mbatia-bertiers-sarakasi-za-siasa-art-exhibition` | high | Legacy article/page slug has a matching React magazine route. |
| `/journal-of-a-new-plant-mom/` | `/magazine/journal-of-a-new-plant-mom` | high | Legacy article/page slug has a matching React magazine route. |
| `/just-a-band-articulating-the-world-on-own-terms/` | `/magazine/just-a-band-articulating-the-world-on-own-terms` | high | Legacy article/page slug has a matching React magazine route. |
| `/kenya-youtube-specials/` | `/magazine/kenya-youtube-specials` | high | Legacy article/page slug has a matching React magazine route. |
| `/kenyan-art-exploring-the-rich-culture-of-the-maasai/` | `/magazine/kenyan-art-exploring-the-rich-culture-of-the-maasai` | high | Legacy article/page slug has a matching React magazine route. |
| `/kenyan-female-artists-2022/` | `/magazine/kenyan-female-artists-2022` | high | Legacy article/page slug has a matching React magazine route. |
| `/kenyan-music-to-the-world/` | `/magazine/kenyan-music-to-the-world` | high | Legacy article/page slug has a matching React magazine route. |
| `/kenyan-short-stories-published-in-2023/` | `/magazine/kenyan-short-stories-published-in-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/kenyan-shows-on-showmax-adapted-from-other-african-shows/` | `/magazine/kenyan-shows-on-showmax-adapted-from-other-african-shows` | high | Legacy article/page slug has a matching React magazine route. |
| `/kenyan-visual-artists-propelling-industry-forward/` | `/magazine/kenyan-visual-artists-propelling-industry-forward` | high | Legacy article/page slug has a matching React magazine route. |
| `/kenyas-top-10-one-hit-wonder-songs/` | `/magazine/kenyas-top-10-one-hit-wonder-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/kenyas-top-female-artists-of-2025/` | `/magazine/kenyas-top-female-artists-of-2025` | high | Legacy article/page slug has a matching React magazine route. |
| `/likizo-dj-mura-big-nyagz-album-review/` | `/magazine/likizo-dj-mura-big-nyagz-album-review` | high | Legacy article/page slug has a matching React magazine route. |
| `/login/` | `/auth` | high | Known legacy static/account route has a matching React destination. |
| `/magdalene-odundo-exhibition-at-the-hayward-gallery-art-exhibition/` | `/magazine/magdalene-odundo-exhibition-at-the-hayward-gallery-art-exhibition` | high | Legacy article/page slug has a matching React magazine route. |
| `/maisha-ya-stunna-album-review/` | `/magazine/maisha-ya-stunna-album-review` | high | Legacy article/page slug has a matching React magazine route. |
| `/making-art-accessible-to-everyone/` | `/magazine/making-art-accessible-to-everyone` | high | Legacy article/page slug has a matching React magazine route. |
| `/michael-soi-and-thom-ogongas-sex-and-the-city-5-art-exhibition-opens-at-alliance-francaise/` | `/magazine/michael-soi-and-thom-ogongas-sex-and-the-city-5-art-exhibition-opens-at-alliance-francaise` | high | Legacy article/page slug has a matching React magazine route. |
| `/nairobi-festival-a-spark-to-rekindle-the-fire-of-community/` | `/magazine/nairobi-festival-a-spark-to-rekindle-the-fire-of-community` | high | Legacy article/page slug has a matching React magazine route. |
| `/nairobi-national-park/` | `/magazine/nairobi-national-park` | high | Legacy article/page slug has a matching React magazine route. |
| `/njerae-and-the-changing-face-of-kenyan-rnb/` | `/magazine/njerae-and-the-changing-face-of-kenyan-rnb` | high | Legacy article/page slug has a matching React magazine route. |
| `/njoki-karu-mwihoko-utheri-wa-ngoro-album-review/` | `/magazine/njoki-karu-mwihoko-utheri-wa-ngoro-album-review` | high | Legacy article/page slug has a matching React magazine route. |
| `/no-dead-heroes-no-good-soldiers/` | `/magazine/no-dead-heroes-no-good-soldiers` | high | Legacy article/page slug has a matching React magazine route. |
| `/nyege-nyege-festival-2023-november/` | `/magazine/nyege-nyege-festival-2023-november` | high | Legacy article/page slug has a matching React magazine route. |
| `/of-shrubbing-or-when-the-tongue-slips/` | `/magazine/of-shrubbing-or-when-the-tongue-slips` | high | Legacy article/page slug has a matching React magazine route. |
| `/open-letter-cabinet-secretary-youth-affairs-sports-arts/` | `/magazine/open-letter-cabinet-secretary-youth-affairs-sports-arts` | high | Legacy article/page slug has a matching React magazine route. |
| `/overthinkers-assemble/` | `/magazine/overthinkers-assemble` | high | Legacy article/page slug has a matching React magazine route. |
| `/pepeta-stoking-the-flames-of-acceptance/` | `/magazine/pepeta-stoking-the-flames-of-acceptance` | high | Legacy article/page slug has a matching React magazine route. |
| `/poetry-slam-africa-festival-returns-to-nairobi-this-january/` | `/magazine/poetry-slam-africa-festival-returns-to-nairobi-this-january` | high | Legacy article/page slug has a matching React magazine route. |
| `/promoting-music-on-tiktok-and-social-media/` | `/magazine/promoting-music-on-tiktok-and-social-media` | high | Legacy article/page slug has a matching React magazine route. |
| `/public-profile/` | `/profile` | high | Known legacy static/account route has a matching React destination. |
| `/registry/` | `/charts` | high | Known legacy static/account route has a matching React destination. |
| `/review-of-kizazi-moto-by-kizazi-moto/` | `/magazine/review-of-kizazi-moto-by-kizazi-moto` | high | Legacy article/page slug has a matching React magazine route. |
| `/short-walk-through-maasai-market/` | `/magazine/short-walk-through-maasai-market` | high | Legacy article/page slug has a matching React magazine route. |
| `/should-you-read-african-fiction/` | `/magazine/should-you-read-african-fiction` | high | Legacy article/page slug has a matching React magazine route. |
| `/so-you-are-crying-in-a-matatu/` | `/magazine/so-you-are-crying-in-a-matatu` | high | Legacy article/page slug has a matching React magazine route. |
| `/spotlight-on-kenyan-literature-in-2023/` | `/magazine/spotlight-on-kenyan-literature-in-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/stomach-infrastructure-2-0-how-digital-politics-feeds-hunger/` | `/magazine/stomach-infrastructure-2-0-how-digital-politics-feeds-hunger` | high | Legacy article/page slug has a matching React magazine route. |
| `/taifa-1-kenya-launches-first-earth-observation-satellite-into-orbit/` | `/magazine/taifa-1-kenya-launches-first-earth-observation-satellite-into-orbit` | high | Legacy article/page slug has a matching React magazine route. |
| `/thais-diarra-noumoucounda-alliance-francaise-nairobi/` | `/magazine/thais-diarra-noumoucounda-alliance-francaise-nairobi` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-african-climate-story-they-do-not-want-us-to-tell/` | `/magazine/the-african-climate-story-they-do-not-want-us-to-tell` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-artists-who-defined-kenyan-music-in-2025/` | `/magazine/the-artists-who-defined-kenyan-music-in-2025` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-birth-of-the-visualizer/` | `/magazine/the-birth-of-the-visualizer` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-curious-case-of-the-young-contemporary-african/` | `/magazine/the-curious-case-of-the-young-contemporary-african` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-day-kenyans-got-angry-enough-rejectfinancebill2024/` | `/magazine/the-day-kenyans-got-angry-enough-rejectfinancebill2024` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-era-of-digital-music-spotify-launches-in-kenya/` | `/magazine/the-era-of-digital-music-spotify-launches-in-kenya` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-evolution-of-kikuyu-music/` | `/magazine/the-evolution-of-kikuyu-music` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-ghost-in-the-algorithm-how-digital-africa-lost-its-moral-compass/` | `/magazine/the-ghost-in-the-algorithm-how-digital-africa-lost-its-moral-compass` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-hound-of-heaven-comes-to-succession/` | `/magazine/the-hound-of-heaven-comes-to-succession` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-kenya-pavilion-at-la-biennale-di-venezia-2022/` | `/magazine/the-kenya-pavilion-at-la-biennale-di-venezia-2022` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-latest-exhibition-by-syowia-kyambi-explores-the-bold-truth/` | `/magazine/the-latest-exhibition-by-syowia-kyambi-explores-the-bold-truth` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-power-of-film/` | `/magazine/the-power-of-film` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-rise-of-music-playlists/` | `/magazine/the-rise-of-music-playlists` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-rising-popularity-of-afro-centric-childrens-entertainment/` | `/magazine/the-rising-popularity-of-afro-centric-childrens-entertainment` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-songs-that-marched-with-us/` | `/magazine/the-songs-that-marched-with-us` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-three-phases-of-gengetone/` | `/magazine/the-three-phases-of-gengetone` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-truth-still-counts/` | `/magazine/the-truth-still-counts` | high | Legacy article/page slug has a matching React magazine route. |
| `/the-water-we-drink-the-food-we-eat-why-we-need-to-trace-the-source/` | `/magazine/the-water-we-drink-the-food-we-eat-why-we-need-to-trace-the-source` | high | Legacy article/page slug has a matching React magazine route. |
| `/theatre-in-a-vacuum/` | `/magazine/theatre-in-a-vacuum` | high | Legacy article/page slug has a matching React magazine route. |
| `/this-year/` | `/magazine/this-year` | high | Legacy article/page slug has a matching React magazine route. |
| `/too-early-for-birds-rewriting-annals-kenya-history/` | `/magazine/too-early-for-birds-rewriting-annals-kenya-history` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-10-femi-one-songs/` | `/magazine/top-10-femi-one-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-10-karun-songs/` | `/magazine/top-10-karun-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-10-kenyan-albums-2025/` | `/magazine/top-10-kenyan-albums-2025` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-10-kenyan-albums-of-2022/` | `/magazine/top-10-kenyan-albums-of-2022` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-10-otile-brown-songs/` | `/magazine/top-10-otile-brown-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-10-songs-by-buruklyn-boyz/` | `/magazine/top-10-songs-by-buruklyn-boyz` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-10-songs-by-kenyan-female-artists-released-in-january-2023/` | `/magazine/top-10-songs-by-kenyan-female-artists-released-in-january-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-10-ssaru-songs/` | `/magazine/top-10-ssaru-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-10-trio-mio-songs/` | `/magazine/top-10-trio-mio-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-15-sauti-sol-songs/` | `/magazine/top-15-sauti-sol-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-15-wakadinali-songs/` | `/magazine/top-15-wakadinali-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-20-kenyan-songs-released-in-february-2023/` | `/magazine/top-20-kenyan-songs-released-in-february-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-20-kenyan-songs-released-in-january-2023/` | `/magazine/top-20-kenyan-songs-released-in-january-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-20-nyashinski-songs/` | `/magazine/top-20-nyashinski-songs` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-25-kenyan-songs-released-in-march-2023/` | `/magazine/top-25-kenyan-songs-released-in-march-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-5-kenyan-films-on-netflix-writers-pick/` | `/magazine/top-5-kenyan-films-on-netflix-writers-pick` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-5-kenyan-films-released-in-2023/` | `/magazine/top-5-kenyan-films-released-in-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-gengetone-songs-of-2022/` | `/magazine/top-gengetone-songs-of-2022` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-gengetone-songs-released-in-2023/` | `/magazine/top-gengetone-songs-released-in-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-gengetone-songs-released-in-2025/` | `/magazine/top-gengetone-songs-released-in-2025` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-gengetone-songs-to-include-in-your-party-playlist/` | `/magazine/top-gengetone-songs-to-include-in-your-party-playlist` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-kenyan-albums-released-in-2023/` | `/magazine/top-kenyan-albums-released-in-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-kenyan-drill-songs-released-in-2023/` | `/magazine/top-kenyan-drill-songs-released-in-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-kenyan-songs-of-2025/` | `/magazine/top-kenyan-songs-of-2025` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-kenyan-songs-released-in-april-2023/` | `/magazine/top-kenyan-songs-released-in-april-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-kenyan-songs-released-in-august-2023/` | `/magazine/top-kenyan-songs-released-in-august-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-kenyan-songs-released-in-july-2023/` | `/magazine/top-kenyan-songs-released-in-july-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/top-kenyan-songs-released-in-november-2023/` | `/magazine/top-kenyan-songs-released-in-november-2023` | high | Legacy article/page slug has a matching React magazine route. |
| `/toxic-lyrikali-amplifying-the-voice-of-the-streets/` | `/magazine/toxic-lyrikali-amplifying-the-voice-of-the-streets` | high | Legacy article/page slug has a matching React magazine route. |
| `/trio-mio-a-new-hope-for-kenyan-music/` | `/magazine/trio-mio-a-new-hope-for-kenyan-music` | high | Legacy article/page slug has a matching React magazine route. |
| `/volume-latest-kenyan-offering-on-netflix-asks-a-question/` | `/magazine/volume-latest-kenyan-offering-on-netflix-asks-a-question` | high | Legacy article/page slug has a matching React magazine route. |
| `/wakilisha-humanistic-approach-covid-19-public-awareness/` | `/magazine/wakilisha-humanistic-approach-covid-19-public-awareness` | high | Legacy article/page slug has a matching React magazine route. |
| `/want-to-get-out-more-start-a-book-club/` | `/magazine/want-to-get-out-more-start-a-book-club` | high | Legacy article/page slug has a matching React magazine route. |
| `/what-about-selfishness/` | `/magazine/what-about-selfishness` | high | Legacy article/page slug has a matching React magazine route. |
| `/what-is-amapiano/` | `/magazine/what-is-amapiano` | high | Legacy article/page slug has a matching React magazine route. |
| `/what-is-it-about-kenyan-events/` | `/magazine/what-is-it-about-kenyan-events` | high | Legacy article/page slug has a matching React magazine route. |
| `/what-is-the-importance-of-music/` | `/magazine/what-is-the-importance-of-music` | high | Legacy article/page slug has a matching React magazine route. |
| `/what-to-know-about-the-proposed-copyright-bill/` | `/magazine/what-to-know-about-the-proposed-copyright-bill` | high | Legacy article/page slug has a matching React magazine route. |
| `/why-love-can-be-so-unsexy/` | `/magazine/why-love-can-be-so-unsexy` | high | Legacy article/page slug has a matching React magazine route. |
| `/why-you-need-design-thinking/` | `/magazine/why-you-need-design-thinking` | high | Legacy article/page slug has a matching React magazine route. |

## Candidate redirects needing confirmation

| Source | Target | Confidence | Notes |
|---|---|---|---|
| `/artist/dj-mura/` | `/artists/dj-mura` | medium | Legacy singular /artist/ route should map to React plural /artists/ route. |
| `/category/music/` | `/music` | medium | Legacy WordPress category archive should map to equivalent top-level React section where available. |

## Cutover blockers

| Blocker type | Legacy path | Proposed target | Decision | Notes |
|---|---|---|---|---|
| author_archive | `/author/admin/` | /authors/admin | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/frank/` | /authors/frank | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/frank/page/2/` | /authors/frank?page=2 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/frank/page/3/` | /authors/frank?page=3 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/gatwiri_c/` | /authors/gatwiri_c | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/hafare/` | /authors/hafare | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/hafare/page/2/` | /authors/hafare?page=2 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/james/` | /authors/james | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/james/page/2/` | /authors/james?page=2 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/james/page/3/` | /authors/james?page=3 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/k_matiri/` | /authors/k_matiri | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/k_matiri/page/2/` | /authors/k_matiri?page=2 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/kendi/` | /authors/kendi | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/kendi/page/2/` | /authors/kendi?page=2 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/kiuta/` | /authors/kiuta | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/michael/` | /authors/michael | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/swambi/` | /authors/swambi | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/timo/` | /authors/timo | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/vicmuia/` | /authors/vicmuia | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/wakilishaji/` | /authors/wakilishaji | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| author_archive | `/author/wakilishaji/page/2/` | /authors/wakilishaji?page=2 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/wakilishaji/page/3/` | /authors/wakilishaji?page=3 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/wakilishaji/page/4/` | /authors/wakilishaji?page=4 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/wakilishaji/page/5/` | /authors/wakilishaji?page=5 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/wakilishaji/page/6/` | /authors/wakilishaji?page=6 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/wakilishaji/page/7/` | /authors/wakilishaji?page=7 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/wakilishaji/page/8/` | /authors/wakilishaji?page=8 | manual_review | Legacy paginated author archive needs React author pagination decision. |
| author_archive | `/author/wangari/` | /authors/wangari | manual_review | Legacy author archive should map to React author profile/archive if supported. |
| chart_runtime_route | `/charts/top-100/ke/2026-01-26/` | /charts/top-100/ke/2026-01-26 | manual_review | Chart route should be tested against React runtime routing, not only prerender output. |
| chart_runtime_route | `/charts/top-gengetone/ke/2026-01-26/` | /charts/top-gengetone/ke/2026-01-26 | manual_review | Chart route should be tested against React runtime routing, not only prerender output. |
| chart_runtime_route | `/charts/top-rnb/ke/2026-01-26/` | /charts/top-rnb/ke/2026-01-26 | manual_review | Chart route should be tested against React runtime routing, not only prerender output. |
| legacy_article_missing_react_route | `/claim-your-name/` | /magazine/claim-your-name | manual_review | Likely legacy article/page slug. Decide whether to import as magazine article, redirect to new article URL, preserve static HTML, or intentional 404. |
| legacy_section_archive | `/album-reviews/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/art-design/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/art/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/blog-newspaper/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/film/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/journal/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/lifestyle/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/literature/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/literature/short-stories/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/music/` | /music | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/opinion/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/plan/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/plan/archive/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/science-and-technology/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/short-stories/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| legacy_section_archive | `/sports/` | /magazine | manual_review | Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it. |
| static_or_account_route | `/account/` | /account | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/corrections/` | /corrections | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/events/` | /events | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/faq/` | /faq | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/methodology/` | /methodology | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/my-account/` | /account | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/my-library/` | /library | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/my-top-10/` | /my-top-10 | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/news-resources/` | /magazine | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/order-tracking/` | /account | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/settings/` | /settings | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| static_or_account_route | `/venues/` | /venues | manual_review | Known legacy static/account route needs explicit React route or redirect decision. |
| tag_archive | `/tag/2026/` | /search?tag=2026 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/4mr-frank-white/` | /search?tag=4mr-frank-white | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/60-nozzles/` | /search?tag=60-nozzles | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/8-4-4/` | /search?tag=8-4-4 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/8th-street-gang/` | /search?tag=8th-street-gang | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/a-grain-of-wheat/` | /search?tag=a-grain-of-wheat | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/a-nurse-toto/` | /search?tag=a-nurse-toto | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/aahil/` | /search?tag=aahil | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/aaron-rimbui/` | /search?tag=aaron-rimbui | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ababu-namwamba/` | /search?tag=ababu-namwamba | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/abas-k%eb%ab%bf/` | /search?tag=abas-k%25eb%25ab%25bf | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/abbas-k%eb%ab%bf/` | /search?tag=abbas-k%25eb%25ab%25bf | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/abubakar-majid/` | /search?tag=abubakar-majid | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/accessibility/` | /search?tag=accessibility | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/across-the-bridge/` | /search?tag=across-the-bridge | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/act-of-love/` | /search?tag=act-of-love | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ado-veli/` | /search?tag=ado-veli | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/adobe/` | /search?tag=adobe | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/afcfta/` | /search?tag=afcfta | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/affordable-art-show/` | /search?tag=affordable-art-show | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/africa/` | /search?tag=africa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/african-continental-free-trade-area/` | /search?tag=african-continental-free-trade-area | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/african-fiction/` | /search?tag=african-fiction | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/african-music/` | /search?tag=african-music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/afro-house/` | /search?tag=afro-house | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/afrobeat/` | /search?tag=afrobeat | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/afroelle-magazine/` | /search?tag=afroelle-magazine | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/afrofuturism/` | /search?tag=afrofuturism | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/afrohouse/` | /search?tag=afrohouse | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/afronautiq/` | /search?tag=afronautiq | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/agent-mgumbe/` | /search?tag=agent-mgumbe | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ajay/` | /search?tag=ajay | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/akan-drum/` | /search?tag=akan-drum | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/akoth-jumadi/` | /search?tag=akoth-jumadi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/al-jean/` | /search?tag=al-jean | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/alantra-official/` | /search?tag=alantra-official | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/album-review/` | /search?tag=album-review | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/album-review/page/2/` | /search?tag=album-review | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/alex-mawimbi/` | /search?tag=alex-mawimbi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/alfred-international/` | /search?tag=alfred-international | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/algorithms/` | /search?tag=algorithms | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/alliance-francaise-de-nairobi/` | /search?tag=alliance-francaise-de-nairobi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/allianz-direct/` | /search?tag=allianz-direct | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ally-fresh/` | /search?tag=ally-fresh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/amapiano/` | /search?tag=amapiano | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/aminata/` | /search?tag=aminata | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/angry-panda-clan/` | /search?tag=angry-panda-clan | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/animation/` | /search?tag=animation | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/anrey/` | /search?tag=anrey | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/anyango-mpinga/` | /search?tag=anyango-mpinga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/apesi/` | /search?tag=apesi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/apple-music/` | /search?tag=apple-music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/arbantone/` | /search?tag=arbantone | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/architecture/` | /search?tag=architecture | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/aress-66/` | /search?tag=aress-66 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/arlen-dilsizian/` | /search?tag=arlen-dilsizian | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/arlene-wandera/` | /search?tag=arlene-wandera | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/arrow-boy/` | /search?tag=arrow-boy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/artificial-intelligence/` | /search?tag=artificial-intelligence | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/assistive-technology/` | /search?tag=assistive-technology | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/atemi-oyungu/` | /search?tag=atemi-oyungu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/athens/` | /search?tag=athens | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/athletics/` | /search?tag=athletics | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/atmos-blaq/` | /search?tag=atmos-blaq | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ato-malinda/` | /search?tag=ato-malinda | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/axel-lussiez/` | /search?tag=axel-lussiez | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ayra-starr/` | /search?tag=ayra-starr | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ayrosh/` | /search?tag=ayrosh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ayub-ogada/` | /search?tag=ayub-ogada | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/azziad-nasenya/` | /search?tag=azziad-nasenya | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bahati/` | /search?tag=bahati | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bakone/` | /search?tag=bakone | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bali/` | /search?tag=bali | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bankslave/` | /search?tag=bankslave | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bantu/` | /search?tag=bantu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/baraza/` | /search?tag=baraza | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bare-sessions/` | /search?tag=bare-sessions | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bayanni/` | /search?tag=bayanni | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/beef/` | /search?tag=beef | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ben-cyco/` | /search?tag=ben-cyco | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/beneath-the-baobabs-festival/` | /search?tag=beneath-the-baobabs-festival | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/benga/` | /search?tag=benga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bensoul/` | /search?tag=bensoul | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bey-t/` | /search?tag=bey-t | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bien-aime-baraza/` | /search?tag=bien-aime-baraza | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bien/` | /search?tag=bien | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/big-nyagz/` | /search?tag=big-nyagz | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bigpin/` | /search?tag=bigpin | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bigpins-radius/` | /search?tag=bigpins-radius | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/billy-black/` | /search?tag=billy-black | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/binyavanga-wainaina/` | /search?tag=binyavanga-wainaina | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bitcoin/` | /search?tag=bitcoin | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/blankets-and-wine/` | /search?tag=blankets-and-wine | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/blankets-wine/` | /search?tag=blankets-wine | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/blessing-lungaho/` | /search?tag=blessing-lungaho | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/blind/` | /search?tag=blind | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/blinky-bill/` | /search?tag=blinky-bill | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bmg/` | /search?tag=bmg | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bobs-burgers/` | /search?tag=bobs-burgers | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bomb-squad-crew/` | /search?tag=bomb-squad-crew | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/book-clubs/` | /search?tag=book-clubs | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/boondocks-gang/` | /search?tag=boondocks-gang | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/boutross/` | /search?tag=boutross | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/brandy-maina/` | /search?tag=brandy-maina | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/breeder-lw/` | /search?tag=breeder-lw | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/brian-kabugi/` | /search?tag=brian-kabugi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/brown/` | /search?tag=brown | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bryan-ngatia/` | /search?tag=bryan-ngatia | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bsq/` | /search?tag=bsq | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/buke-abduba/` | /search?tag=buke-abduba | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/burna-boy/` | /search?tag=burna-boy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/buruburu/` | /search?tag=buruburu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/burudani-express/` | /search?tag=burudani-express | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/buruklyn-boyz/` | /search?tag=buruklyn-boyz | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/burundi/` | /search?tag=burundi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bussa-j/` | /search?tag=bussa-j | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/bussaj/` | /search?tag=bussaj | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/butere-girls/` | /search?tag=butere-girls | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/c-i-r-u/` | /search?tag=c-i-r-u | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cabinet-secretary-for-youth-affairs-sports-and-the-arts/` | /search?tag=cabinet-secretary-for-youth-affairs-sports-and-the-arts | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/caine-prize/` | /search?tag=caine-prize | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/caleb-awiti/` | /search?tag=caleb-awiti | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/calif-records/` | /search?tag=calif-records | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/casettes/` | /search?tag=casettes | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cassettes/` | /search?tag=cassettes | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cave-bureau/` | /search?tag=cave-bureau | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cedo/` | /search?tag=cedo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/chantelle/` | /search?tag=chantelle | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/charisma/` | /search?tag=charisma | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/charles-mangua/` | /search?tag=charles-mangua | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cheche-book-store/` | /search?tag=cheche-book-store | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/chelwek/` | /search?tag=chelwek | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/chemutai-sage/` | /search?tag=chemutai-sage | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cheque-mate/` | /search?tag=cheque-mate | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/child/` | /search?tag=child | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/chimano/` | /search?tag=chimano | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/chinua-achebe/` | /search?tag=chinua-achebe | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/chiwawa/` | /search?tag=chiwawa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/chris-kaiga/` | /search?tag=chris-kaiga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/christmas/` | /search?tag=christmas | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/chronicles-of-gedi/` | /search?tag=chronicles-of-gedi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ciano-maimba/` | /search?tag=ciano-maimba | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/circle-art-gallery/` | /search?tag=circle-art-gallery | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/civic-education/` | /search?tag=civic-education | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/claire-gor/` | /search?tag=claire-gor | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/clamer/` | /search?tag=clamer | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/classicism/` | /search?tag=classicism | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cleophas-malala/` | /search?tag=cleophas-malala | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/climate-change/` | /search?tag=climate-change | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cockfights/` | /search?tag=cockfights | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/coflo/` | /search?tag=coflo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/collaboration/` | /search?tag=collaboration | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/collective-management-organizations-cmos/` | /search?tag=collective-management-organizations-cmos | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/colonialism/` | /search?tag=colonialism | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/comedy/` | /search?tag=comedy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/coming-to-birth/` | /search?tag=coming-to-birth | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/community/` | /search?tag=community | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/computer-misuse-and-cybercrimes-act/` | /search?tag=computer-misuse-and-cybercrimes-act | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/congo-man/` | /search?tag=congo-man | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/conspiracy-theories/` | /search?tag=conspiracy-theories | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/convention-on-the-rights-of-persons-with-disabilities/` | /search?tag=convention-on-the-rights-of-persons-with-disabilities | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/convergent-evolution/` | /search?tag=convergent-evolution | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cordoban/` | /search?tag=cordoban | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/coster-ojwang/` | /search?tag=coster-ojwang | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/covid-19/` | /search?tag=covid-19 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/creative-industry/` | /search?tag=creative-industry | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/creativity/` | /search?tag=creativity | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/crime-and-justice/` | /search?tag=crime-and-justice | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/crpd/` | /search?tag=crpd | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cryptocurrencies/` | /search?tag=cryptocurrencies | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cultural-identity/` | /search?tag=cultural-identity | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/culture/` | /search?tag=culture | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/customer/` | /search?tag=customer | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/cyrus-kabiru/` | /search?tag=cyrus-kabiru | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/czars/` | /search?tag=czars | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/daddo/` | /search?tag=daddo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dakar-biennale/` | /search?tag=dakar-biennale | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dance/` | /search?tag=dance | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/daniel-muli/` | /search?tag=daniel-muli | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/davaji/` | /search?tag=davaji | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/david-tosh-gitonga/` | /search?tag=david-tosh-gitonga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dela/` | /search?tag=dela | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/della/` | /search?tag=della | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/democracy/` | /search?tag=democracy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dennis-kooker/` | /search?tag=dennis-kooker | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dennis-mugaa/` | /search?tag=dennis-mugaa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dennis-ombachi/` | /search?tag=dennis-ombachi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/derek-debru/` | /search?tag=derek-debru | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/derkman-ftg/` | /search?tag=derkman-ftg | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/design-thinking/` | /search?tag=design-thinking | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/design/` | /search?tag=design | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dickens-otieno/` | /search?tag=dickens-otieno | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/diet/` | /search?tag=diet | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/digital-art/` | /search?tag=digital-art | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/digital-transformation/` | /search?tag=digital-transformation | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dillie/` | /search?tag=dillie | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dinga-ya-wife/` | /search?tag=dinga-ya-wife | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/disabled/` | /search?tag=disabled | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/disco-matanga/` | /search?tag=disco-matanga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/disney/` | /search?tag=disney | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dj-fredy-muks/` | /search?tag=dj-fredy-muks | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dj-joe-mfalme/` | /search?tag=dj-joe-mfalme | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dj-katta/` | /search?tag=dj-katta | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dj-mura/` | /search?tag=dj-mura | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dj-nephas/` | /search?tag=dj-nephas | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dj-skyrock/` | /search?tag=dj-skyrock | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/doek-literary-magazine/` | /search?tag=doek-literary-magazine | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/domani-munga/` | /search?tag=domani-munga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dorphan/` | /search?tag=dorphan | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dorphanage/` | /search?tag=dorphanage | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/drama-festivals/` | /search?tag=drama-festivals | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/drc/` | /search?tag=drc | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/drill-music/` | /search?tag=drill-music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dust/` | /search?tag=dust | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dyana-cods/` | /search?tag=dyana-cods | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/dylan-s/` | /search?tag=dylan-s | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/east-african-community/` | /search?tag=east-african-community | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/echo254/` | /search?tag=echo254 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/echoes-of-war/` | /search?tag=echoes-of-war | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/eddie-butita/` | /search?tag=eddie-butita | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/edi-gathegi/` | /search?tag=edi-gathegi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/education/` | /search?tag=education | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/egeme/` | /search?tag=egeme | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/el-chi/` | /search?tag=el-chi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/elections/` | /search?tag=elections | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/electronic-dance-music/` | /search?tag=electronic-dance-music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/elias-mutani/` | /search?tag=elias-mutani | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/eliud-kipchoge/` | /search?tag=eliud-kipchoge | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/elsa/` | /search?tag=elsa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/elsaphan-njora/` | /search?tag=elsaphan-njora | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/elsy-wameyo/` | /search?tag=elsy-wameyo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/elvis-ounyo/` | /search?tag=elvis-ounyo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/emma-cheruto/` | /search?tag=emma-cheruto | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/emmie-muthiga/` | /search?tag=emmie-muthiga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/emmy-kosgei/` | /search?tag=emmy-kosgei | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/employment/` | /search?tag=employment | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/empowerment/` | /search?tag=empowerment | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/enjoy/` | /search?tag=enjoy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/entertainment/` | /search?tag=entertainment | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/eric-rugara/` | /search?tag=eric-rugara | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/eric-wainaina/` | /search?tag=eric-wainaina | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/esen/` | /search?tag=esen | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ethan-muziki/` | /search?tag=ethan-muziki | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ethereum/` | /search?tag=ethereum | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ethic/` | /search?tag=ethic | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/euggy/` | /search?tag=euggy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/evolution/` | /search?tag=evolution | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/exray-taniua/` | /search?tag=exray-taniua | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/exray/` | /search?tag=exray | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/fadhilee-itulya/` | /search?tag=fadhilee-itulya | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/faith-kipyegon/` | /search?tag=faith-kipyegon | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/faiz-francis-ouma/` | /search?tag=faiz-francis-ouma | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/fancy-fingers/` | /search?tag=fancy-fingers | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/fathermoh-and-ssaru/` | /search?tag=fathermoh-and-ssaru | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/fathermoh/` | /search?tag=fathermoh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/fatoumata-diawara/` | /search?tag=fatoumata-diawara | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/femi-one/` | /search?tag=femi-one | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/fena-gitu/` | /search?tag=fena-gitu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/film-production/` | /search?tag=film-production | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/film/` | /search?tag=film | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/flea-market/` | /search?tag=flea-market | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/flexfab/` | /search?tag=flexfab | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/flier/` | /search?tag=flier | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/flossin-mauwano/` | /search?tag=flossin-mauwano | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/folk-music/` | /search?tag=folk-music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/food/` | /search?tag=food | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/fort-jesus/` | /search?tag=fort-jesus | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/francis-d-imbuga/` | /search?tag=francis-d-imbuga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/francis-thompson/` | /search?tag=francis-thompson | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/fred-hirschy/` | /search?tag=fred-hirschy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/freddie-gibbs/` | /search?tag=freddie-gibbs | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/freddie-wangombe/` | /search?tag=freddie-wangombe | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/friendship/` | /search?tag=friendship | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/fundamental-attribution-error/` | /search?tag=fundamental-attribution-error | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/geco-tribe-cafe/` | /search?tag=geco-tribe-cafe | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/gen-z/` | /search?tag=gen-z | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/genes1s/` | /search?tag=genes1s | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/gengetone/` | /search?tag=gengetone | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/george-luchiri-wajackoyah/` | /search?tag=george-luchiri-wajackoyah | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ghetto-pimps-crew/` | /search?tag=ghetto-pimps-crew | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/gidi-gidi/` | /search?tag=gidi-gidi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/goethe-institut-nairobi/` | /search?tag=goethe-institut-nairobi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/gondwana/` | /search?tag=gondwana | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/goodluck-gozbert/` | /search?tag=goodluck-gozbert | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/gordon-moore/` | /search?tag=gordon-moore | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/grace-ogot/` | /search?tag=grace-ogot | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/graffiti-girls-kenya/` | /search?tag=graffiti-girls-kenya | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/graffiti/` | /search?tag=graffiti | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/gray/` | /search?tag=gray | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/green-living/` | /search?tag=green-living | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/green/` | /search?tag=green | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/grief/` | /search?tag=grief | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/gta/` | /search?tag=gta | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/guapanessse/` | /search?tag=guapanessse | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/gufy/` | /search?tag=gufy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/gwaash/` | /search?tag=gwaash | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/h_art-the-band/` | /search?tag=h_art-the-band | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/habits/` | /search?tag=habits | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/harmonize/` | /search?tag=harmonize | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/harry-craze/` | /search?tag=harry-craze | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/health/` | /search?tag=health | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/heavy-cane/` | /search?tag=heavy-cane | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/hells-gate-national-park/` | /search?tag=hells-gate-national-park | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/hendrick-sam/` | /search?tag=hendrick-sam | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/hihi/` | /search?tag=hihi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/hip-hop/` | /search?tag=hip-hop | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/history/` | /search?tag=history | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/hornsphere/` | /search?tag=hornsphere | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/humanism/` | /search?tag=humanism | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/humanities/` | /search?tag=humanities | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/hyrax-hill-museum/` | /search?tag=hyrax-hill-museum | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/idd-aziz/` | /search?tag=idd-aziz | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ideas/` | /search?tag=ideas | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/idza-luhumyo/` | /search?tag=idza-luhumyo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ignyte-awards/` | /search?tag=ignyte-awards | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/inclusive-design/` | /search?tag=inclusive-design | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/influencers/` | /search?tag=influencers | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/internet/` | /search?tag=internet | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/iphoolish/` | /search?tag=iphoolish | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/israel-onyach/` | /search?tag=israel-onyach | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/issa-juma/` | /search?tag=issa-juma | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/itanda-falls/` | /search?tag=itanda-falls | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/itanda/` | /search?tag=itanda | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/itsyaba/` | /search?tag=itsyaba | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ivy-lygue/` | /search?tag=ivy-lygue | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/iyanah-kiragu/` | /search?tag=iyanah-kiragu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/iyanah/` | /search?tag=iyanah | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/iyanii/` | /search?tag=iyanii | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jack-brown/` | /search?tag=jack-brown | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jacky-vike/` | /search?tag=jacky-vike | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jaguar/` | /search?tag=jaguar | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/james-jozee/` | /search?tag=james-jozee | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/james-murumbi-gallery/` | /search?tag=james-murumbi-gallery | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jameson-connects-kenya/` | /search?tag=jameson-connects-kenya | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jgip-events/` | /search?tag=jgip-events | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jim-chuchu/` | /search?tag=jim-chuchu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jimmy-ogonga/` | /search?tag=jimmy-ogonga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jimwat/` | /search?tag=jimwat | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jinja/` | /search?tag=jinja | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/joefes/` | /search?tag=joefes | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/john-demathew/` | /search?tag=john-demathew | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/john-michuki-park/` | /search?tag=john-michuki-park | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/john-ndichu/` | /search?tag=john-ndichu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/joseph-kamaru/` | /search?tag=joseph-kamaru | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/joseph-mbatia-bertiers/` | /search?tag=joseph-mbatia-bertiers | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/joshua-baraka/` | /search?tag=joshua-baraka | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jovial/` | /search?tag=jovial | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/joy-ocholla/` | /search?tag=joy-ocholla | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jua-cali/` | /search?tag=jua-cali | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/juliani/` | /search?tag=juliani | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/june-gachui/` | /search?tag=june-gachui | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/just-a-band/` | /search?tag=just-a-band | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/justice-gully/` | /search?tag=justice-gully | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/justice/` | /search?tag=justice | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/jux/` | /search?tag=jux | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/k4kanali/` | /search?tag=k4kanali | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kaa-la-moto/` | /search?tag=kaa-la-moto | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kabage-karanja/` | /search?tag=kabage-karanja | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kagwe-mungai/` | /search?tag=kagwe-mungai | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kalamashaka/` | /search?tag=kalamashaka | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kaloki-nyamai/` | /search?tag=kaloki-nyamai | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kamaa-kalamashaka/` | /search?tag=kamaa-kalamashaka | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kamande-wa-kioi/` | /search?tag=kamande-wa-kioi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kambua/` | /search?tag=kambua | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kanairo/` | /search?tag=kanairo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/karen-blixen-museum/` | /search?tag=karen-blixen-museum | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/karen-village/` | /search?tag=karen-village | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/karun/` | /search?tag=karun | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/karura-forest/` | /search?tag=karura-forest | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kasarani-laureate-gardens/` | /search?tag=kasarani-laureate-gardens | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kasha/` | /search?tag=kasha | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/katapilla/` | /search?tag=katapilla | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kc-kangiri/` | /search?tag=kc-kangiri | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/keemlyf/` | /search?tag=keemlyf | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kemboste/` | /search?tag=kemboste | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kendrick-lamar/` | /search?tag=kendrick-lamar | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenrazy/` | /search?tag=kenrazy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenya-african-national-union-kanu/` | /search?tag=kenya-african-national-union-kanu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenya-copyright-act/` | /search?tag=kenya-copyright-act | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenya-copyright-board-kecobo/` | /search?tag=kenya-copyright-board-kecobo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenya-cultural-centre/` | /search?tag=kenya-cultural-centre | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenya-museum-society/` | /search?tag=kenya-museum-society | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenya-national-theatre/` | /search?tag=kenya-national-theatre | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenya-space-agency/` | /search?tag=kenya-space-agency | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenya-wildlife-service/` | /search?tag=kenya-wildlife-service | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kenya/` | /search?tag=kenya | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kerosh/` | /search?tag=kerosh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kethan/` | /search?tag=kethan | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/khaddija-abdalla-bajaber/` | /search?tag=khaddija-abdalla-bajaber | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/khadija-abdalla-bajaber/` | /search?tag=khadija-abdalla-bajaber | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/khadija-abdalla-bjaber/` | /search?tag=khadija-abdalla-bjaber | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/khali-cartel/` | /search?tag=khali-cartel | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/khaligraph-jones/` | /search?tag=khaligraph-jones | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/khaligraph-jones/page/2/` | /search?tag=khaligraph-jones | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kibera/` | /search?tag=kibera | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kid-kora/` | /search?tag=kid-kora | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kigooco/` | /search?tag=kigooco | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kikuyu-music/` | /search?tag=kikuyu-music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kina/` | /search?tag=kina | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/king-david/` | /search?tag=king-david | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/king-kaka/` | /search?tag=king-kaka | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/king-kerby/` | /search?tag=king-kerby | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kingpheezle/` | /search?tag=kingpheezle | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kinoti/` | /search?tag=kinoti | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kitu-sewer/` | /search?tag=kitu-sewer | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kizazi-moto/` | /search?tag=kizazi-moto | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kleptomaniax/` | /search?tag=kleptomaniax | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/koda/` | /search?tag=koda | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kodongklan/` | /search?tag=kodongklan | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/krg-the-don/` | /search?tag=krg-the-don | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kristoff/` | /search?tag=kristoff | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kuky/` | /search?tag=kuky | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kunye/` | /search?tag=kunye | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/kushman/` | /search?tag=kushman | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/l-a-rochelle/` | /search?tag=l-a-rochelle | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/l3gs/` | /search?tag=l3gs | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/la-biennale-di-venezia/` | /search?tag=la-biennale-di-venezia | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/labor-of-love/` | /search?tag=labor-of-love | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/landmarks/` | /search?tag=landmarks | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/language/` | /search?tag=language | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/laroz/` | /search?tag=laroz | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/lavosti/` | /search?tag=lavosti | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/le-guin-prize/` | /search?tag=le-guin-prize | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/leilah-babirye/` | /search?tag=leilah-babirye | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/leo-tolstoy/` | /search?tag=leo-tolstoy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/let-me-you/` | /search?tag=let-me-you | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/lil-maina/` | /search?tag=lil-maina | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/lilmaina/` | /search?tag=lilmaina | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/linda-musita/` | /search?tag=linda-musita | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/linsanity/` | /search?tag=linsanity | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/lisa-oduor-noah/` | /search?tag=lisa-oduor-noah | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/live-nation/` | /search?tag=live-nation | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/logan-roy/` | /search?tag=logan-roy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/love-letters-3/` | /search?tag=love-letters-3 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/love/` | /search?tag=love | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/lufasa/` | /search?tag=lufasa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/lupita-nyongo/` | /search?tag=lupita-nyongo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/lyvid-and-sofiya-nzau/` | /search?tag=lyvid-and-sofiya-nzau | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/lyvid-remix-by-misumena/` | /search?tag=lyvid-remix-by-misumena | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/maandy/` | /search?tag=maandy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/maasai-market/` | /search?tag=maasai-market | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/maasai/` | /search?tag=maasai | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/machine-learning/` | /search?tag=machine-learning | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/macondo-lit-festival/` | /search?tag=macondo-lit-festival | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mad-g/` | /search?tag=mad-g | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/magdalene-odundo/` | /search?tag=magdalene-odundo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mahalia/` | /search?tag=mahalia | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/maina-murumba/` | /search?tag=maina-murumba | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/maji-maji/` | /search?tag=maji-maji | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/makena-onjerika/` | /search?tag=makena-onjerika | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mali/` | /search?tag=mali | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/manzi-wa-kibera/` | /search?tag=manzi-wa-kibera | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/maovete/` | /search?tag=maovete | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mapenzi-baby/` | /search?tag=mapenzi-baby | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/marijuana/` | /search?tag=marijuana | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/marjorie-oludhe-macgoye/` | /search?tag=marjorie-oludhe-macgoye | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/marketing/` | /search?tag=marketing | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/marriage/` | /search?tag=marriage | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/masauti/` | /search?tag=masauti | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mass-media/` | /search?tag=mass-media | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mastar-vk/` | /search?tag=mastar-vk | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/masterpiece-king/` | /search?tag=masterpiece-king | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/matara/` | /search?tag=matara | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/matata/` | /search?tag=matata | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/matatu-culture/` | /search?tag=matatu-culture | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/matt-ngesa/` | /search?tag=matt-ngesa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mau-from-nowhere/` | /search?tag=mau-from-nowhere | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mau-mau/` | /search?tag=mau-mau | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mauru-unit/` | /search?tag=mauru-unit | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mavultures/` | /search?tag=mavultures | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/maya-amolo/` | /search?tag=maya-amolo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/maybe-ii/` | /search?tag=maybe-ii | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mayonde/` | /search?tag=mayonde | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mbai-caves/` | /search?tag=mbai-caves | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mbira/` | /search?tag=mbira | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mbithi-masya/` | /search?tag=mbithi-masya | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mbithi/` | /search?tag=mbithi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mbogi-genje/` | /search?tag=mbogi-genje | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mbuzi-gang/` | /search?tag=mbuzi-gang | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mc-sharon/` | /search?tag=mc-sharon | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mcmillan-memorial-library/` | /search?tag=mcmillan-memorial-library | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mdundo/` | /search?tag=mdundo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/meja-mwangi/` | /search?tag=meja-mwangi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mejja/` | /search?tag=mejja | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/melodica-music-store/` | /search?tag=melodica-music-store | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mental-health/` | /search?tag=mental-health | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mercy-munyanya/` | /search?tag=mercy-munyanya | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mex-cortez/` | /search?tag=mex-cortez | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mic-cheque/` | /search?tag=mic-cheque | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/michael-armitage/` | /search?tag=michael-armitage | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/michael-soi/` | /search?tag=michael-soi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mike-winkelmann/` | /search?tag=mike-winkelmann | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mikel-the-energy/` | /search?tag=mikel-the-energy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/millenials/` | /search?tag=millenials | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mimi-mars/` | /search?tag=mimi-mars | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/miriam-syowia-kyambi/` | /search?tag=miriam-syowia-kyambi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/moeazy/` | /search?tag=moeazy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/monrovia-street/` | /search?tag=monrovia-street | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/monski/` | /search?tag=monski | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mookh/` | /search?tag=mookh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/moores-law/` | /search?tag=moores-law | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mordecai-dex/` | /search?tag=mordecai-dex | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/morris-kiruga/` | /search?tag=morris-kiruga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/movaz-warombosaji-nation/` | /search?tag=movaz-warombosaji-nation | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mpizy-tycoon/` | /search?tag=mpizy-tycoon | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mr-lu/` | /search?tag=mr-lu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mr-seed/` | /search?tag=mr-seed | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mr-tee/` | /search?tag=mr-tee | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/msale/` | /search?tag=msale | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/msito/` | /search?tag=msito | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mtaa-yangu/` | /search?tag=mtaa-yangu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mtap3li/` | /search?tag=mtap3li | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mudra-d-viral/` | /search?tag=mudra-d-viral | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/muki-rai/` | /search?tag=muki-rai | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mukoma-wa-ngugi/` | /search?tag=mukoma-wa-ngugi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/muranga-county/` | /search?tag=muranga-county | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/muringi/` | /search?tag=muringi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/museum-hill-road/` | /search?tag=museum-hill-road | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/music-festivals/` | /search?tag=music-festivals | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/music-industry/` | /search?tag=music-industry | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/music-videos/` | /search?tag=music-videos | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/music/` | /search?tag=music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/muthaka/` | /search?tag=muthaka | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/muthoni-drummer-queen/` | /search?tag=muthoni-drummer-queen | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/muthoni-garland/` | /search?tag=muthoni-garland | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/muthoni-likimani/` | /search?tag=muthoni-likimani | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mutoriah/` | /search?tag=mutoriah | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mutua-matheka/` | /search?tag=mutua-matheka | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/muze-club/` | /search?tag=muze-club | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mvera/` | /search?tag=mvera | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mwangi-gicheru/` | /search?tag=mwangi-gicheru | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mwangi-hutter/` | /search?tag=mwangi-hutter | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mwihoko-utheri-wa-ngoro/` | /search?tag=mwihoko-utheri-wa-ngoro | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/mwikali-and-the-forbidden-mask/` | /search?tag=mwikali-and-the-forbidden-mask | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/naiboi/` | /search?tag=naiboi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-city/` | /search?tag=nairobi-city | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-contemporary-art-institute/` | /search?tag=nairobi-contemporary-art-institute | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-festival/` | /search?tag=nairobi-festival | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-gallery/` | /search?tag=nairobi-gallery | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-gossip-club/` | /search?tag=nairobi-gossip-club | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-international-jazz-festival/` | /search?tag=nairobi-international-jazz-festival | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-literature-festival/` | /search?tag=nairobi-literature-festival | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-litfest/` | /search?tag=nairobi-litfest | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-national-museum/` | /search?tag=nairobi-national-museum | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi-national-park/` | /search?tag=nairobi-national-park | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nairobi/` | /search?tag=nairobi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nakili-sessions/` | /search?tag=nakili-sessions | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/naomi-wanjiku-gakunga/` | /search?tag=naomi-wanjiku-gakunga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nasha-travis/` | /search?tag=nasha-travis | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nastie-nastie/` | /search?tag=nastie-nastie | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/natasha-sinayobye/` | /search?tag=natasha-sinayobye | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nate-speaks/` | /search?tag=nate-speaks | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/national-cohesion-and-integration-commission/` | /search?tag=national-cohesion-and-integration-commission | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/national-museum-of-kenya/` | /search?tag=national-museum-of-kenya | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/natty/` | /search?tag=natty | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nature/` | /search?tag=nature | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ndarlin-p/` | /search?tag=ndarlin-p | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ndovu-kuu/` | /search?tag=ndovu-kuu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nebulazz/` | /search?tag=nebulazz | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nes-mburu/` | /search?tag=nes-mburu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nestle/` | /search?tag=nestle | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/netflix/` | /search?tag=netflix | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nfts/` | /search?tag=nfts | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ngara/` | /search?tag=ngara | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ngorongoro-conservation-area/` | /search?tag=ngorongoro-conservation-area | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ngugi-wa-thiongo/` | /search?tag=ngugi-wa-thiongo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nick-mutuma/` | /search?tag=nick-mutuma | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nikita-kering/` | /search?tag=nikita-kering | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/njerae/` | /search?tag=njerae | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/njiru/` | /search?tag=njiru | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/njoki-karu/` | /search?tag=njoki-karu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/njoro-wa-uba/` | /search?tag=njoro-wa-uba | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/njugush/` | /search?tag=njugush | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/noname-book-club/` | /search?tag=noname-book-club | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nonini/` | /search?tag=nonini | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/noumoucounda-cissoko/` | /search?tag=noumoucounda-cissoko | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nviiri-the-storyteller/` | /search?tag=nviiri-the-storyteller | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nviiri/` | /search?tag=nviiri | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nyashinski/` | /search?tag=nyashinski | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nyawira-alison/` | /search?tag=nyawira-alison | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nyege-nyege-festival/` | /search?tag=nyege-nyege-festival | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/nyrobi-book-fest/` | /search?tag=nyrobi-book-fest | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ochungulo-family/` | /search?tag=ochungulo-family | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/octopizzo/` | /search?tag=octopizzo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/odi-wa-muranga/` | /search?tag=odi-wa-muranga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ogopa-deejays/` | /search?tag=ogopa-deejays | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ogopa-djs/` | /search?tag=ogopa-djs | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/okello-max/` | /search?tag=okello-max | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/okwiri-oduor/` | /search?tag=okwiri-oduor | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/olorgesailie/` | /search?tag=olorgesailie | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/omega-mighty/` | /search?tag=omega-mighty | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/online-gossip/` | /search?tag=online-gossip | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/osborne-macharia/` | /search?tag=osborne-macharia | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/otile-brown/` | /search?tag=otile-brown | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ousmane-sembene/` | /search?tag=ousmane-sembene | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/out-with-the-old/` | /search?tag=out-with-the-old | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/overthinking/` | /search?tag=overthinking | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/paa-born-to-fly/` | /search?tag=paa-born-to-fly | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/papa-nyosto/` | /search?tag=papa-nyosto | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/pasibo-maru/` | /search?tag=pasibo-maru | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/patonee/` | /search?tag=patonee | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/paul-onditi/` | /search?tag=paul-onditi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/pawa254/` | /search?tag=pawa254 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/pepeta/` | /search?tag=pepeta | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/peter-ngila-njeri/` | /search?tag=peter-ngila-njeri | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/peterson-kamwathi/` | /search?tag=peterson-kamwathi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/photoshop/` | /search?tag=photoshop | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/phy/` | /search?tag=phy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/pino/` | /search?tag=pino | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/plan-b/` | /search?tag=plan-b | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/plato/` | /search?tag=plato | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/playlists/` | /search?tag=playlists | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/poetry-slam-africa-festival/` | /search?tag=poetry-slam-africa-festival | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/polaris-pauline/` | /search?tag=polaris-pauline | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/polaris/` | /search?tag=polaris | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/polio/` | /search?tag=polio | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/politics/` | /search?tag=politics | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/polycarp-otieno/` | /search?tag=polycarp-otieno | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/prayer-for-the-departed/` | /search?tag=prayer-for-the-departed | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/prezzo/` | /search?tag=prezzo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/procreate/` | /search?tag=procreate | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/productivity/` | /search?tag=productivity | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/promoting-music/` | /search?tag=promoting-music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/propaganda/` | /search?tag=propaganda | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/protest-movements/` | /search?tag=protest-movements | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/q-family/` | /search?tag=q-family | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/q-ta-c/` | /search?tag=q-ta-c | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/queen-jane/` | /search?tag=queen-jane | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/radio-254/` | /search?tag=radio-254 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rahmu/` | /search?tag=rahmu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/raila-amolo-odinga/` | /search?tag=raila-amolo-odinga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ranzscooby/` | /search?tag=ranzscooby | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rapdokta/` | /search?tag=rapdokta | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rb/` | /search?tag=rb | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rejectfinancebill2024/` | /search?tag=rejectfinancebill2024 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rekles/` | /search?tag=rekles | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rema/` | /search?tag=rema | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/remote-working/` | /search?tag=remote-working | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/remy-ngamije/` | /search?tag=remy-ngamije | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rico-gang/` | /search?tag=rico-gang | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rpg-bazu/` | /search?tag=rpg-bazu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rush-arts-gallery/` | /search?tag=rush-arts-gallery | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ruto-must-go/` | /search?tag=ruto-must-go | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ruyonga/` | /search?tag=ruyonga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/rwanda/` | /search?tag=rwanda | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sabi-wu/` | /search?tag=sabi-wu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sailors-gang/` | /search?tag=sailors-gang | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/saint-evo/` | /search?tag=saint-evo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/salem/` | /search?tag=salem | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/samidoh/` | /search?tag=samidoh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sanaipei-tande/` | /search?tag=sanaipei-tande | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/santuri-east-africa/` | /search?tag=santuri-east-africa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sarabi-band/` | /search?tag=sarabi-band | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sarah-hassan/` | /search?tag=sarah-hassan | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sarakasi-dome/` | /search?tag=sarakasi-dome | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sarakasi-za-siasa/` | /search?tag=sarakasi-za-siasa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sauti-sol/` | /search?tag=sauti-sol | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sauti-za-busara-festival/` | /search?tag=sauti-za-busara-festival | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/savara/` | /search?tag=savara | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/savinnah/` | /search?tag=savinnah | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/scar-mkadinali/` | /search?tag=scar-mkadinali | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/serro/` | /search?tag=serro | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/seska/` | /search?tag=seska | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sewersydaa/` | /search?tag=sewersydaa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shaevy-and-slice/` | /search?tag=shaevy-and-slice | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shan/` | /search?tag=shan | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shanariha-evans/` | /search?tag=shanariha-evans | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shanty-bobo/` | /search?tag=shanty-bobo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shanty-flames/` | /search?tag=shanty-flames | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shappaman/` | /search?tag=shappaman | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shekina-karen/` | /search?tag=shekina-karen | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shekinah-karen/` | /search?tag=shekinah-karen | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shingai-njeri/` | /search?tag=shingai-njeri | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shourtie/` | /search?tag=shourtie | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/showmax/` | /search?tag=showmax | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shrubbing/` | /search?tag=shrubbing | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/shugha-rhee/` | /search?tag=shugha-rhee | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/silas-jay/` | /search?tag=silas-jay | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/silverstone-bars/` | /search?tag=silverstone-bars | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/simiyu-barasa/` | /search?tag=simiyu-barasa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/single-kiasi/` | /search?tag=single-kiasi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sir-bwoy/` | /search?tag=sir-bwoy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/skillo/` | /search?tag=skillo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/slavery/` | /search?tag=slavery | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/slimflows/` | /search?tag=slimflows | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/smady-tings/` | /search?tag=smady-tings | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/smart-speakers/` | /search?tag=smart-speakers | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/smokilah/` | /search?tag=smokilah | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/snap/` | /search?tag=snap | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/snapchat/` | /search?tag=snapchat | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/social-media/` | /search?tag=social-media | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sofiya-nzau/` | /search?tag=sofiya-nzau | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/soma-nami-pan-african-book-fair/` | /search?tag=soma-nami-pan-african-book-fair | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/some-fine-day-pix/` | /search?tag=some-fine-day-pix | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/son-of-a-woman/` | /search?tag=son-of-a-woman | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sony-music-entertainment/` | /search?tag=sony-music-entertainment | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sosa-the-prodigy/` | /search?tag=sosa-the-prodigy | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/soundiiz/` | /search?tag=soundiiz | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/soundkraft/` | /search?tag=soundkraft | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/south-african-music/` | /search?tag=south-african-music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/south-sudan/` | /search?tag=south-sudan | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/spacex/` | /search?tag=spacex | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/spider-clan/` | /search?tag=spider-clan | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/spoiler/` | /search?tag=spoiler | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/spotify/` | /search?tag=spotify | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/spray-uzi/` | /search?tag=spray-uzi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ssaru/` | /search?tag=ssaru | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/stacy-kamatu/` | /search?tag=stacy-kamatu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/stella-mutegi/` | /search?tag=stella-mutegi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/stephanie-muchiri/` | /search?tag=stephanie-muchiri | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/stephen-mule/` | /search?tag=stephen-mule | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/steve-biko/` | /search?tag=steve-biko | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/streaming/` | /search?tag=streaming | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/street-art/` | /search?tag=street-art | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/su-dough-boss/` | /search?tag=su-dough-boss | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/succession/` | /search?tag=succession | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/sudough-boss/` | /search?tag=sudough-boss | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/supremacy-sounds/` | /search?tag=supremacy-sounds | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/suraj/` | /search?tag=suraj | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/surrealism/` | /search?tag=surrealism | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/suzanna-owiyo/` | /search?tag=suzanna-owiyo | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/swat-matire/` | /search?tag=swat-matire | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/swat/` | /search?tag=swat | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/swift9/` | /search?tag=swift9 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/syllent-killah/` | /search?tag=syllent-killah | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/taabu/` | /search?tag=taabu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/taarab/` | /search?tag=taarab | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/taifa-1/` | /search?tag=taifa-1 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/talking-walls/` | /search?tag=talking-walls | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tanzania/` | /search?tag=tanzania | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/technology/` | /search?tag=technology | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/teferah/` | /search?tag=teferah | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tems/` | /search?tag=tems | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/thabo-mbeki/` | /search?tag=thabo-mbeki | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/thais-diarra/` | /search?tag=thais-diarra | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/thandiwe-muriu/` | /search?tag=thandiwe-muriu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/thayu-mwas/` | /search?tag=thayu-mwas | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/the-house-of-rust/` | /search?tag=the-house-of-rust | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/the-kansoul/` | /search?tag=the-kansoul | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/the-lion-of-sudah/` | /search?tag=the-lion-of-sudah | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/the-other-woman/` | /search?tag=the-other-woman | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/the-real-housewives-of-nairobi/` | /search?tag=the-real-housewives-of-nairobi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/the-river-between/` | /search?tag=the-river-between | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/the-selfish-gene/` | /search?tag=the-selfish-gene | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/the-simpsons/` | /search?tag=the-simpsons | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/thee-exit-band/` | /search?tag=thee-exit-band | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/thimlich-ohinga/` | /search?tag=thimlich-ohinga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/things-fall-apart/` | /search?tag=things-fall-apart | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/third-eye-simba/` | /search?tag=third-eye-simba | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/thom-ogonga/` | /search?tag=thom-ogonga | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ticketsasa/` | /search?tag=ticketsasa | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tiktok/` | /search?tag=tiktok | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tina-ardor/` | /search?tag=tina-ardor | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tipsy-gee/` | /search?tag=tipsy-gee | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tokyonite/` | /search?tag=tokyonite | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tom-misch/` | /search?tag=tom-misch | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tony-njuguna/` | /search?tag=tony-njuguna | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/too-early-for-birds/` | /search?tag=too-early-for-birds | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/toxic-lyrikali/` | /search?tag=toxic-lyrikali | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/trends/` | /search?tag=trends | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tricks-hr/` | /search?tag=tricks-hr | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/trio-mio/` | /search?tag=trio-mio | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/trio-mio/page/2/` | /search?tag=trio-mio | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/trip/` | /search?tag=trip | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/troy-onyango/` | /search?tag=troy-onyango | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/truth/` | /search?tag=truth | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tuku-kantu/` | /search?tag=tuku-kantu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tunedem-band/` | /search?tag=tunedem-band | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tunemymusic/` | /search?tag=tunemymusic | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/tyso/` | /search?tag=tyso | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/udelele/` | /search?tag=udelele | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/uganda/` | /search?tag=uganda | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/uhuru-b/` | /search?tag=uhuru-b | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/uhuru-gardens-national-monument/` | /search?tag=uhuru-gardens-national-monument | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ukweli/` | /search?tag=ukweli | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/umoja-sounds/` | /search?tag=umoja-sounds | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/unco-jingjong/` | /search?tag=unco-jingjong | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/uncojingjong/` | /search?tag=uncojingjong | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/unintentional/` | /search?tag=unintentional | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/united-nations/` | /search?tag=united-nations | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/universal-music-group/` | /search?tag=universal-music-group | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/unseen-nairobi/` | /search?tag=unseen-nairobi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/unspoken-salaton/` | /search?tag=unspoken-salaton | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/usain-bolt/` | /search?tag=usain-bolt | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/utalii-lane/` | /search?tag=utalii-lane | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/vdj-jones/` | /search?tag=vdj-jones | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/venice-biennale/` | /search?tag=venice-biennale | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/vernacular-pop/` | /search?tag=vernacular-pop | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/viberate/` | /search?tag=viberate | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/victoria-kimani/` | /search?tag=victoria-kimani | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/vinc-on-the-beat/` | /search?tag=vinc-on-the-beat | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/vinyl-records/` | /search?tag=vinyl-records | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/virtual-reality/` | /search?tag=virtual-reality | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/vision-2030/` | /search?tag=vision-2030 | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/visual-trends/` | /search?tag=visual-trends | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/visualizer/` | /search?tag=visualizer | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/volume/` | /search?tag=volume | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wadagliz/` | /search?tag=wadagliz | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wajesus-family/` | /search?tag=wajesus-family | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wakadinali-cinematic-universe/` | /search?tag=wakadinali-cinematic-universe | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wakadinali/` | /search?tag=wakadinali | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wakadinali/page/2/` | /search?tag=wakadinali | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/walker-town/` | /search?tag=walker-town | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wanavokali/` | /search?tag=wanavokali | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wangechi-mutu/` | /search?tag=wangechi-mutu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wangechi/` | /search?tag=wangechi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wanja-kimani/` | /search?tag=wanja-kimani | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wanja-wohoro/` | /search?tag=wanja-wohoro | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wanjine/` | /search?tag=wanjine | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wanuri-kahiu/` | /search?tag=wanuri-kahiu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wapi/` | /search?tag=wapi | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/warner-music-group/` | /search?tag=warner-music-group | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/watendawili/` | /search?tag=watendawili | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/water/` | /search?tag=water | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/watu-fresh/` | /search?tag=watu-fresh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wcu/` | /search?tag=wcu | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/we-are-nubia/` | /search?tag=we-are-nubia | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/weep-not/` | /search?tag=weep-not | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wellness/` | /search?tag=wellness | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wendy-kay/` | /search?tag=wendy-kay | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/where-the-river-divides/` | /search?tag=where-the-river-divides | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/whizbi-music/` | /search?tag=whizbi-music | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wicky-mosh/` | /search?tag=wicky-mosh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/william-ruto/` | /search?tag=william-ruto | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/willy-paul/` | /search?tag=willy-paul | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wise-two/` | /search?tag=wise-two | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wizkid/` | /search?tag=wizkid | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/work-life/` | /search?tag=work-life | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/workplaces/` | /search?tag=workplaces | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/wyre/` | /search?tag=wyre | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/xenia-manasseh/` | /search?tag=xenia-manasseh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/xenia-manasseh/page/2/` | /search?tag=xenia-manasseh | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ybw-smith/` | /search?tag=ybw-smith | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/you-again/` | /search?tag=you-again | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/youtube/` | /search?tag=youtube | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/yussef-dayes/` | /search?tag=yussef-dayes | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/yvonne-adhiambo-owuor/` | /search?tag=yvonne-adhiambo-owuor | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ywaya-tajiri/` | /search?tag=ywaya-tajiri | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/yy-comedian/` | /search?tag=yy-comedian | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/zaituni-wambui/` | /search?tag=zaituni-wambui | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/zaituni/` | /search?tag=zaituni | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/zerb/` | /search?tag=zerb | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/zikki/` | /search?tag=zikki | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/zilla/` | /search?tag=zilla | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/ziller-bas/` | /search?tag=ziller-bas | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/zowie-kengocha/` | /search?tag=zowie-kengocha | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/zukiswa-wanner/` | /search?tag=zukiswa-wanner | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| tag_archive | `/tag/zzero-sufuri/` | /search?tag=zzero-sufuri | manual_review | Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404. |
| woocommerce_dynamic_route | `/cart/` |  | product_decision_required | Dynamic WooCommerce route. Decide whether to retire, rebuild, redirect, or preserve behind a legacy store path. |
| woocommerce_dynamic_route | `/checkout/` |  | product_decision_required | Dynamic WooCommerce route. Decide whether to retire, rebuild, redirect, or preserve behind a legacy store path. |

## Security endpoints

These must remain blocked after cutover.

| Path | Decision | Notes |
|---|---|---|
| `/wp-admin/` | keep_blocked | Security-sensitive WordPress endpoint should remain blocked after cutover. |
| `/wp-json/` | keep_blocked | Security-sensitive WordPress endpoint should remain blocked after cutover. |
| `/wp-login.php` | keep_blocked | Security-sensitive WordPress endpoint should remain blocked after cutover. |
| `/xmlrpc.php` | keep_blocked | Security-sensitive WordPress endpoint should remain blocked after cutover. |

## Media import boundary

This plan is about URL routing only.

Do not import provider-hosted artist images such as Spotify CDN images by default.

Only old WordPress upload media under /wp-content/uploads/ belongs in the media mirror/rewrite workstream.
