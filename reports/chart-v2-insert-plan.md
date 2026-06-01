# Chart V2 Dry-Run Insert Plan

Generated: 2026-06-01T09:05:18.878Z

Mode: **dry-run-no-db-writes**

Source preview: `reports/chart-v2-migration-preview.json`

Migration readiness: **ready_with_warnings**

## Planned insert counts

| Table | Rows |
| --- | ---: |
| wk_chart_series_v2 | 4 |
| wk_chart_markets_v2 | 1 |
| wk_chart_programs_v2 | 4 |
| wk_chart_methodologies_v2 | 1 |
| wk_chart_eligibility_rules_v2 | 4 |
| wk_chart_editions_v2 | 78 |
| wk_chart_entries_v2 | 6332 |
| wk_chart_source_coverage_v2 | 78 |
| wk_chart_slug_aliases_v2 | 10 |

## GitHub-safe artifact strategy

The JSON plan intentionally excludes the full 6,332 entry rows. It includes table counts, all low-volume rows, and 20 sample entry rows.

The SQL plan includes all rows, but entry `raw_payload` values are compact provenance references instead of full source entry objects. This keeps the review artifact small enough for GitHub while preserving the path back to the source JSON files.

## Programs

| Program ID | Public slug | Public label | Series | Market | Source family |
| --- | --- | --- | --- | --- | --- |
| program_2026_releases_kenya | 2026-releases-kenya | 2026 Releases · Kenya | 2026-releases | kenya | 2026 |
| program_gengetone_kenya | gengetone-kenya | Gengetone Songs · Kenya | gengetone | kenya | gengetone |
| program_top_songs_kenya | top-songs-kenya | Top 100 Songs · Kenya | top-songs | kenya | kenya |
| program_rnb_kenya | rnb-kenya | R&B Songs · Kenya | rnb | kenya | rnb |

## Methodology versions

- csv-registry-import-v1

## Eligibility rule versions

- 2026-releases-kenya-v1
- gengetone-kenya-v1
- top-songs-kenya-v1
- rnb-kenya-v1

## Warnings

No planner warnings.

## Generated artifacts

- `reports/chart-v2-insert-plan.json`
- `reports/chart-v2-insert-plan.md`
- `reports/chart-v2-inserts.sql`

## Safety note

This planner does not write to the database. The generated SQL is wrapped in `BEGIN; ... ROLLBACK;` and is intended for review only. Do not remove the rollback or execute inserts until the V2 preview has zero blockers and content QA has approved warnings.
