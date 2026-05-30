import path from 'node:path';

export const DEFAULT_IMPORT_DIR = path.join(
  process.cwd(),
  'data',
  'supabase-imports',
  '2026-05-30',
  'raw'
);

export const DEFAULT_REPORT_DIR = path.join(
  process.cwd(),
  'packages',
  'migration',
  'reports'
);

export const EXPECTED_TABLES = [
  'wk_tracks',
  'wk_releases',
  'wk_labels',
  'wk_genres',
  'wk_chart_series',
  'wk_chart_editions',
  'wk_chart_entries',
  'wk_registry_entities',
  'wk_media_assets',
  'wk_articles',
  'wk_guides',
  'wk_page_surfaces',
  'wk_old_primary_slugs',
  'wk_old_registry_rows',
  'wk_wordpress_items'
] as const;

export type ExpectedTable = (typeof EXPECTED_TABLES)[number];
