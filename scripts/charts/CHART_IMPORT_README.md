# WAKILISHA — WordPress Chart Import Guide

## Overview

This tool imports all 87 chart editions from the old WordPress website into the new Supabase v2 chart schema.

The old WordPress URL format (`/charts/2026/ke/2026-05-18/`) does not carry over to the new site. The importer normalizes all edition slugs and creates slug aliases for redirects.

---

## What Gets Imported

From WordPress MySQL (`[removed]`), the importer reads:

| WordPress Table | Maps To | Contents |
|---|---|---|
| `wp_wkcharts_charts` | `wk_chart_programs_v2` + `wk_chart_series_v2` + `wk_chart_markets_v2` | Chart programs — one per chart type |
| `wp_wkcharts_editions` | `wk_chart_editions_v2` | All 87 editions with dates, metadata |
| `wp_wkcharts_edition_items` | `wk_chart_entries_v2` | All ranked track entries per edition |
| `wp_wkcharts_tracks` | `wk_chart_entries_v2.source_payload` | Track metadata (ISRC, Spotify ID, Apple Music ID, etc.) |
| `wp_wkcharts_artists` | `wk_chart_entries_v2.artist_name/slug` | Artist names and slugs |
| `wp_wkcharts_track_artists` | `wk_chart_entries_v2.artist_slug` | Primary artist per track |
| `wp_wkcharts_track_sources` | `wk_chart_entries_v2.source_urls_seen` | Source provider URLs (Spotify, Apple Music, etc.) |
| `wp_wkcharts_ingest_runs` | `wk_chart_editions_v2.rule_set_snapshot` | Old ingest settings preserved in snapshot |

---

## URL Normalization

Old URLs like `/charts/2026/ke/2026-05-18/` are normalized to:

```
/charts/top-songs/kenya/weekly-2026-05-18
```

The importer creates slug aliases in `wk_chart_slug_aliases_v2` so old links continue to work.

---

## Legacy Import Status

WordPress is retired. The legacy import tooling is retained only as historical implementation reference. No WordPress database or server credentials are retained or documented in this repository, and the old importer should not be run against production.

---

## What Happens After Import

Once the import runs, the chart admin in the new website will show:

1. **Programs** — All chart programs discovered in WordPress (Kenya Top 100, R&B, Gengetone, etc.)
2. **Editions** — All 87 editions with their edition dates
3. **Entries** — All ranked positions per edition with full source metadata

The old WordPress settings (source URLs, scoring policies, methodology) are preserved in `rule_set_snapshot` on each edition, so you can see exactly what settings were used historically.

### Continuing with new editions

After the legacy import, new editions can be created using the Chart Ingestion Studio just as normal. The new editions will have the benefit of the improved scoring framework.

---

## Slug Alias Table

The importer creates entries in `wk_chart_slug_aliases_v2` for every old edition slug so that old URLs redirect to the new canonical slug format.

---

## Reports

After running, check:

- `reports/chart-v2-wordpress-import.json` — Full import report
- `reports/chart-v2-wordpress-import.sql` — The SQL that was (or would be) executed