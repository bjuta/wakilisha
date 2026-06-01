# WAKILISHA Chart V2 REST API Implementation Brief

This brief defines the backend REST API scaffold for serving the Chart V2 ontology from WordPress or another backend without changing the current public React chart behavior.

The current public chart system is working from JSON-backed data and has verified:

- 4 chart programs
- 78 editions
- 6,332 entries
- 10 aliases
- 0 migration blockers
- 2 content QA warnings

The V2 API must be implemented as an additive backend layer. Do not remove the JSON fallback, do not mutate existing chart content, and do not replace public routes until API parity is proven.

## Current artifacts to use

The backend implementation should align to these existing artifacts:

- `docs/chart-infrastructure-v2-plan.md`
- `docs/chart-v2-content-qa-decisions.md`
- `packages/db/migrations/004_chart_ontology_v2.sql`
- `reports/chart-v2-migration-preview.json`
- `reports/chart-v2-insert-plan.json`
- `reports/chart-v2-api-fixtures.json`
- `reports/chart-v2-execution-readiness.json`

## API namespace

Use a V2 namespace to avoid conflicting with the existing V1 public chart client.

Recommended namespace:

```txt
/wp-json/wakilisha/v2
```

## Endpoint list

### Health

```txt
GET /wp-json/wakilisha/v2/charts/health
```

Returns API status, schema version, and known counts.

### List chart programs

```txt
GET /wp-json/wakilisha/v2/charts
```

Returns all public chart programs, including latest edition summaries and archive summary data.

### Get one chart program

```txt
GET /wp-json/wakilisha/v2/charts/{programSlug}
```

Returns one program by canonical public slug or legacy alias.

### Get latest chart edition

```txt
GET /wp-json/wakilisha/v2/charts/{programSlug}/latest
```

Returns the latest edition for a program with entries.

### Get one chart edition

```txt
GET /wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}
```

Returns one edition with program metadata and entries.

### Get edition entries only

```txt
GET /wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}/entries
```

Returns entries only. Useful for lazy-loading chart rows.

### Resolve legacy alias

```txt
GET /wp-json/wakilisha/v2/charts/resolve/{slug}
```

Returns the canonical public slug for a legacy slug.

### Track chart history

```txt
GET /wp-json/wakilisha/v2/tracks/{trackSlug}/chart-history
```

Returns all V2 chart appearances for a track.

## Required response envelope

Every V2 endpoint should return a consistent envelope:

```json
{
  "data": {},
  "meta": {
    "apiVersion": "v2",
    "generatedAt": "2026-06-01T00:00:00.000Z",
    "source": "chart-v2-db",
    "canonicalSlug": "rnb-kenya",
    "legacySlug": "rnb",
    "warnings": []
  }
}
```

For lists, `data` may contain arrays:

```json
{
  "data": {
    "programs": []
  },
  "meta": {}
}
```

## Data model mapping

The API should read from V2 tables:

| API concept | V2 table |
| --- | --- |
| Series | `wk_chart_series_v2` |
| Market | `wk_chart_markets_v2` |
| Program | `wk_chart_programs_v2` |
| Edition | `wk_chart_editions_v2` |
| Entry | `wk_chart_entries_v2` |
| Methodology | `wk_chart_methodologies_v2` |
| Eligibility | `wk_chart_eligibility_rules_v2` |
| Source coverage | `wk_chart_source_coverage_v2` |
| Alias | `wk_chart_slug_aliases_v2` |

## Program response shape

```json
{
  "id": "program_rnb_kenya",
  "seriesSlug": "rnb",
  "seriesLabel": "R&B Songs",
  "marketSlug": "kenya",
  "marketLabel": "Kenya",
  "publicSlug": "rnb-kenya",
  "publicLabel": "R&B Songs · Kenya",
  "shortLabel": "Kenyan R&B",
  "sourceFamilySlug": "rnb",
  "periodType": "weekly",
  "methodologyVersion": "csv-registry-import-v1",
  "eligibilityRulesVersion": "rnb-kenya-v1",
  "latestEdition": {},
  "archive": []
}
```

## Edition response shape

```json
{
  "id": "edition_rnb_kenya_rnb_2026_05_18",
  "slug": "rnb-2026-05-18",
  "label": "R&B Songs · Kenya — 2026-05-18",
  "date": "2026-05-18",
  "periodStart": "2026-05-18",
  "periodEnd": "2026-05-18",
  "entryCount": 100,
  "program": {},
  "methodology": {},
  "eligibilityRules": {},
  "sourceCoverage": []
}
```

## Entry response shape

```json
{
  "id": "entry_rnb_kenya_rnb_2026_05_18_001_...",
  "rank": 1,
  "previousRank": null,
  "movement": "same",
  "trackSlug": "nervous",
  "trackTitle": "NERVOUS",
  "artistNames": ["Bee Thee Artiste", "Ywaya Tajiri", "AUGUST IV"],
  "artistSlugs": [],
  "artworkUrl": "https://...",
  "score": null,
  "sourceEntryId": "..."
}
```

## Alias behavior

If a request uses a legacy slug like `rnb`, the backend should resolve it to the canonical program slug `rnb-kenya`.

The response should include both values in meta:

```json
{
  "meta": {
    "canonicalSlug": "rnb-kenya",
    "legacySlug": "rnb",
    "canonicalized": true
  }
}
```

The frontend can decide whether to redirect or simply render.

## Empty edition policy

The known empty edition is:

```txt
gengetone-2026-03-28
```

Backend behavior:

- Keep it queryable by direct edition slug.
- Do not return it as the latest edition.
- Do not prioritize it in archive summaries.
- Return `entries: []` and a warning in meta if requested directly.

## Repeated top-10 policy

Repeated top-10 signatures are not API errors.

Backend behavior:

- Serve affected editions normally.
- Keep warning internal unless a future correction event is approved.
- Do not deduplicate editions.

## Pagination and limits

For `/entries`, support:

```txt
?limit=100
?offset=0
```

Default limit should be 100.

Hard max should be 200 for now.

For program archive summaries, return latest 6 by default unless `?limit=` is provided.

## Caching

Recommended headers:

```txt
Cache-Control: public, max-age=300, stale-while-revalidate=3600
ETag: based on edition/program updated_at or snapshot hash
```

V2 chart history is mostly static after publication, so caching can be aggressive once correction handling is mature.

## Error behavior

Use consistent errors:

```json
{
  "code": "chart_program_not_found",
  "message": "Chart program not found.",
  "status": 404,
  "meta": {
    "requestedSlug": "unknown"
  }
}
```

Suggested codes:

- `chart_program_not_found`
- `chart_edition_not_found`
- `chart_alias_not_found`
- `chart_v2_schema_unavailable`
- `chart_v2_database_error`

## Acceptance criteria

The backend implementation is acceptable when:

1. All V2 endpoints return JSON matching `reports/chart-v2-api-fixtures.json`.
2. Legacy slugs resolve to canonical slugs.
3. Latest endpoints never choose the known empty edition.
4. Entry counts match V2 plan counts.
5. `/charts/{programSlug}/{editionSlug}/entries` returns exactly the edition rows.
6. The React public client can be switched to V2 mode without changing public pages.
7. JSON fallback remains available.
8. No source chart content is mutated.
9. No published chart history is silently corrected.

## Implementation order

1. Implement read-only V2 API service class.
2. Implement alias resolver.
3. Implement program list and program detail endpoints.
4. Implement latest edition endpoint.
5. Implement edition detail and entries endpoints.
6. Implement track chart history endpoint.
7. Add fixture comparison/smoke test.
8. Point React V2 adapter to the new namespace behind an environment flag.

## Safety rule

Do not connect the public frontend to V2 by default until API parity against the JSON fallback has been verified.
