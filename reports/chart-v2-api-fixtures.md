# Chart V2 Public API Fixtures

Generated: 2026-06-01T09:35:12.623Z

Mode: **public-api-fixtures-no-db-writes**

Source insert plan: `reports/chart-v2-insert-plan.json`

## Endpoint contract

| Name | Endpoint |
| --- | --- |
| listPrograms | `/wp-json/wakilisha/v2/charts` |
| getProgram | `/wp-json/wakilisha/v2/charts/{programSlug}` |
| getLatestEdition | `/wp-json/wakilisha/v2/charts/{programSlug}/latest` |
| getEdition | `/wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}` |
| getEditionEntries | `/wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}/entries` |
| resolveAlias | `/wp-json/wakilisha/v2/charts/resolve/{slug}` |

## Fixture counts

| Item | Count |
| --- | ---: |
| Programs | 4 |
| Editions | 78 |
| Entries | 6332 |
| Aliases | 10 |

## Programs

| Public slug | Label | Series | Market | Latest edition |
| --- | --- | --- | --- | --- |
| 2026-releases-kenya | 2026 Releases · Kenya | 2026-releases | kenya | 2026-2026-05-18 |
| gengetone-kenya | Gengetone Songs · Kenya | gengetone | kenya | gengetone-2026-05-18 |
| top-songs-kenya | Top 100 Songs · Kenya | top-songs | kenya | kenya-2026-05-18 |
| rnb-kenya | R&B Songs · Kenya | rnb | kenya | rnb-2026-05-18 |

## Latest endpoint examples

### /wp-json/wakilisha/v2/charts/2026-releases-kenya/latest

- Program: 2026 Releases · Kenya
- Latest edition: 2026-2026-05-18
- Sample entries: 10
- #1: Not Letting Go — Bensoul

### /wp-json/wakilisha/v2/charts/gengetone-kenya/latest

- Program: Gengetone Songs · Kenya
- Latest edition: gengetone-2026-05-18
- Sample entries: 10
- #1: Songa ka injili — Kushman, Shark Tank

### /wp-json/wakilisha/v2/charts/top-songs-kenya/latest

- Program: Top 100 Songs · Kenya
- Latest edition: kenya-2026-05-18
- Sample entries: 10
- #1: Hallelujah (Washwash) — Khaligraph Jones, Bensoul

### /wp-json/wakilisha/v2/charts/rnb-kenya/latest

- Program: R&B Songs · Kenya
- Latest edition: rnb-2026-05-18
- Sample entries: 10
- #1: NERVOUS — Bee Thee Artiste, Ywaya Tajiri, AUGUST IV

## Safety note

This fixture generator does not write to the database and does not change public chart JSON. It produces small API response examples for backend and frontend contract alignment before the V2 API is implemented.
