# WordPress Tag Archive Cutover Policy

This is a planning artifact only. Do not apply redirects until the final React/IP cutover rehearsal passes.

Use 302 temporary redirects first. Do not use 301 until the new React surface has been observed in production.

## Summary

- Total tag archive blockers: 848
- Redirect candidates: 846
- Manual review rows: 2
- Canonical tag archive rows: 843
- Paginated tag archive rows: 5
- Encoded/suspicious slug rows: 2

## Policy

- `/tag/<slug>/` should redirect to `/search?tag=<slug label>` if the slug is clean.
- `/tag/<slug>/page/<n>/` should collapse to the same canonical tag search URL.
- Encoded or malformed slugs need manual review before redirecting.
- Tag feeds are already ignored in the cutover plan and should not be treated as HTML route blockers.

## Decision counts

- manual_review: 2
- redirect_to_canonical_tag_search: 5
- redirect_to_tag_search: 841

## Redirect candidates preview

| Source | Target | Confidence | Reason |
|---|---|---|---|
| `/tag/2026/` | `/search?tag=2026` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/4mr-frank-white/` | `/search?tag=4mr%20frank%20white` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/60-nozzles/` | `/search?tag=60%20nozzles` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/8-4-4/` | `/search?tag=8%204%204` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/8th-street-gang/` | `/search?tag=8th%20street%20gang` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/a-grain-of-wheat/` | `/search?tag=a%20grain%20of%20wheat` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/a-nurse-toto/` | `/search?tag=a%20nurse%20toto` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/aahil/` | `/search?tag=aahil` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/aaron-rimbui/` | `/search?tag=aaron%20rimbui` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/ababu-namwamba/` | `/search?tag=ababu%20namwamba` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/abubakar-majid/` | `/search?tag=abubakar%20majid` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/accessibility/` | `/search?tag=accessibility` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/across-the-bridge/` | `/search?tag=across%20the%20bridge` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/act-of-love/` | `/search?tag=act%20of%20love` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/ado-veli/` | `/search?tag=ado%20veli` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/adobe/` | `/search?tag=adobe` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/afcfta/` | `/search?tag=afcfta` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/affordable-art-show/` | `/search?tag=affordable%20art%20show` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/africa/` | `/search?tag=africa` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/african-continental-free-trade-area/` | `/search?tag=african%20continental%20free%20trade%20area` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/african-fiction/` | `/search?tag=african%20fiction` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/african-music/` | `/search?tag=african%20music` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/afro-house/` | `/search?tag=afro%20house` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/afrobeat/` | `/search?tag=afrobeat` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/afroelle-magazine/` | `/search?tag=afroelle%20magazine` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/afrofuturism/` | `/search?tag=afrofuturism` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/afrohouse/` | `/search?tag=afrohouse` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/afronautiq/` | `/search?tag=afronautiq` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/agent-mgumbe/` | `/search?tag=agent%20mgumbe` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/ajay/` | `/search?tag=ajay` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/akan-drum/` | `/search?tag=akan%20drum` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/akoth-jumadi/` | `/search?tag=akoth%20jumadi` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/al-jean/` | `/search?tag=al%20jean` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/alantra-official/` | `/search?tag=alantra%20official` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/album-review/` | `/search?tag=album%20review` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/album-review/page/2/` | `/search?tag=album%20review` | medium | Paginated WordPress tag archive should collapse to canonical tag search during cutover. |
| `/tag/alex-mawimbi/` | `/search?tag=alex%20mawimbi` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/alfred-international/` | `/search?tag=alfred%20international` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/algorithms/` | `/search?tag=algorithms` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/alliance-francaise-de-nairobi/` | `/search?tag=alliance%20francaise%20de%20nairobi` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/allianz-direct/` | `/search?tag=allianz%20direct` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/ally-fresh/` | `/search?tag=ally%20fresh` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/amapiano/` | `/search?tag=amapiano` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/aminata/` | `/search?tag=aminata` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/angry-panda-clan/` | `/search?tag=angry%20panda%20clan` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/animation/` | `/search?tag=animation` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/anrey/` | `/search?tag=anrey` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/anyango-mpinga/` | `/search?tag=anyango%20mpinga` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/apesi/` | `/search?tag=apesi` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/apple-music/` | `/search?tag=apple%20music` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/arbantone/` | `/search?tag=arbantone` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/architecture/` | `/search?tag=architecture` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/aress-66/` | `/search?tag=aress%2066` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/arlen-dilsizian/` | `/search?tag=arlen%20dilsizian` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/arlene-wandera/` | `/search?tag=arlene%20wandera` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/arrow-boy/` | `/search?tag=arrow%20boy` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/artificial-intelligence/` | `/search?tag=artificial%20intelligence` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/assistive-technology/` | `/search?tag=assistive%20technology` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/atemi-oyungu/` | `/search?tag=atemi%20oyungu` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/athens/` | `/search?tag=athens` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/athletics/` | `/search?tag=athletics` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/atmos-blaq/` | `/search?tag=atmos%20blaq` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/ato-malinda/` | `/search?tag=ato%20malinda` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/axel-lussiez/` | `/search?tag=axel%20lussiez` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/ayra-starr/` | `/search?tag=ayra%20starr` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/ayrosh/` | `/search?tag=ayrosh` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/ayub-ogada/` | `/search?tag=ayub%20ogada` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/azziad-nasenya/` | `/search?tag=azziad%20nasenya` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/bahati/` | `/search?tag=bahati` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/bakone/` | `/search?tag=bakone` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/bali/` | `/search?tag=bali` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/bankslave/` | `/search?tag=bankslave` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/bantu/` | `/search?tag=bantu` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/baraza/` | `/search?tag=baraza` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/bare-sessions/` | `/search?tag=bare%20sessions` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/bayanni/` | `/search?tag=bayanni` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/beef/` | `/search?tag=beef` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/ben-cyco/` | `/search?tag=ben%20cyco` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/beneath-the-baobabs-festival/` | `/search?tag=beneath%20the%20baobabs%20festival` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| `/tag/benga/` | `/search?tag=benga` | medium | Legacy WordPress tag archive can redirect to React search filtered by tag. |
| ... | ... | ... | 766 more redirect candidates in CSV/JSON |

## Manual review

| Source | Proposed target | Confidence | Reason |
|---|---|---|---|
| `/tag/abas-k%eb%ab%bf/` | `/search?tag=abas%20k%EB%AB%BF` | low | Encoded tag slug needs manual review before redirecting. |
| `/tag/abbas-k%eb%ab%bf/` | `/search?tag=abbas%20k%EB%AB%BF` | low | Encoded tag slug needs manual review before redirecting. |

## Media import boundary

This plan is about URL routing only.

Do not import provider-hosted artist images such as Spotify CDN images by default.

Only old WordPress upload media under /wp-content/uploads/ belongs in the media mirror/rewrite workstream.
