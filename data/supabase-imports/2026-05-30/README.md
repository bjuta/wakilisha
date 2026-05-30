# WAKILISHA Supabase Imports

This directory contains raw CSV exports from the Supabase database.

## Structure

data/
  supabase-imports/
    2026-05-30/
      README.md
      manifest.json
      raw/
        wk_tracks.csv
        wk_releases.csv
        wk_labels.csv
        wk_genres.csv
        wk_chart_series.csv
        wk_chart_editions.csv
        wk_chart_entries.csv
        wk_registry_entities.csv
        wk_media_assets.csv
        wk_articles.csv
        wk_guides.csv
        wk_page_surfaces.csv
        wk_old_primary_slugs.csv
        wk_old_registry_rows.csv
        wk_wordpress_items.csv

## How to populate

1. Download the CSV bundle from the Google Drive link in the project README.md.
2. Unzip it into `data/supabase-imports/2026-05-30/raw/`.
3. Run `npm run migration:audit` to verify all files are detected.
4. Run `npm run migration:repair` to build the full relationship graph.

## Important

- Raw CSVs are intentionally ignored by Git. They are source data files, not application code.
- All repair scripts should be repeatable and load from these raw files.
- Never modify the raw CSVs directly. All repair outputs go to `packages/migration/reports/`.