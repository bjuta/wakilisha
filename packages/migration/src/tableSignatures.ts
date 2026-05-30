import type { ExpectedTable } from './config.js';

type Signature = {
  table: ExpectedTable;
  required: string[];
  helpful?: string[];
};

export const TABLE_SIGNATURES: Signature[] = [
  {
    table: 'wk_tracks',
    required: ['slug', 'title', 'artist_name', 'artist_slug'],
    helpful: ['isrc', 'artwork_url', 'platform_links', 'immutable_payload']
  },
  {
    table: 'wk_releases',
    required: ['slug', 'title', 'artist_display', 'artist_slug', 'tracklist'],
    helpful: ['release_type', 'label_name', 'artwork_url', 'immutable_payload']
  },
  {
    table: 'wk_labels',
    required: ['slug', 'name'],
    helpful: ['country', 'city', 'logo_url', 'website']
  },
  {
    table: 'wk_genres',
    required: ['slug', 'name', 'description'],
    helpful: ['raw_meta']
  },
  {
    table: 'wk_chart_series',
    required: ['slug', 'title', 'raw_meta'],
    helpful: ['source_wp_post_id']
  },
  {
    table: 'wk_chart_editions',
    required: ['edition_id', 'chart_slug', 'title', 'chart_date'],
    helpful: ['cover_items', 'raw_meta']
  },
  {
    table: 'wk_chart_entries',
    required: ['edition_id', 'chart_slug', 'position', 'title', 'artist_name', 'track_slug'],
    helpful: ['source_payload', 'is_resolved', 'preview_url']
  },
  {
    table: 'wk_registry_entities',
    required: ['entity_type', 'id', 'slug', 'title', 'href'],
    helpful: ['image_url', 'hero_image_url', 'raw_meta']
  },
  {
    table: 'wk_media_assets',
    required: ['entity_type', 'entity_slug', 'role', 'url'],
    helpful: ['alt_text', 'source']
  },
  {
    table: 'wk_articles',
    required: ['id', 'slug', 'title'],
    helpful: ['content_html', 'excerpt_html', 'wp_status']
  },
  {
    table: 'wk_guides',
    required: ['id', 'slug', 'title'],
    helpful: ['content_html', 'excerpt_html', 'wp_status']
  },
  {
    table: 'wk_page_surfaces',
    required: ['id', 'slug', 'title'],
    helpful: ['content_html', 'wp_status']
  },
  {
    table: 'wk_old_primary_slugs',
    required: ['entity_type', 'entity_id', 'slug'],
    helpful: ['full_path', 'is_primary']
  },
  {
    table: 'wk_old_registry_rows',
    required: ['source_table', 'source_pk', 'row_data'],
    helpful: ['import_run_id']
  },
  {
    table: 'wk_wordpress_items',
    required: ['id', 'post_type', 'post_name', 'post_title'],
    helpful: ['post_status', 'guid']
  }
];

export function detectTable(headers: string[]): ExpectedTable | null {
  const headerSet = new Set(headers.map((header) => header.trim()));
  let best: { table: ExpectedTable; score: number } | null = null;

  for (const signature of TABLE_SIGNATURES) {
    const requiredMatches = signature.required.filter((column) => headerSet.has(column)).length;
    if (requiredMatches !== signature.required.length) continue;

    const helpfulMatches = (signature.helpful ?? []).filter((column) => headerSet.has(column)).length;
    const score = requiredMatches * 10 + helpfulMatches;

    if (!best || score > best.score) {
      best = { table: signature.table, score };
    }
  }

  return best?.table ?? null;
}
