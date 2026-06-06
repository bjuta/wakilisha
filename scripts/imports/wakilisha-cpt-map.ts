// ---------------------------------------------------------------------------
// WAKILISHA WordPress → Import Staging Map
// ---------------------------------------------------------------------------
// Canonical WAKILISHA music/registry/chart entities MUST come from the
// WAKILISHA plugin tables (wp_wkcharts_*), NOT from wp_posts shell CPTs.
//
// Shell CPTs like wk_registry_track / wk_registry_release / wk_registry_label
// are administrative wrappers that contain almost zero records.  The real
// data lives in:
//
//   wp_wkcharts_tracks         → tracks           (5,549)
//   wp_wkcharts_releases       → releases         (701)
//   wp_wkcharts_labels         → labels           (232)
//   wp_wkcharts_artists        → artists          (1,712)
//   wp_wkcharts_genres         → genres
//   wp_wkcharts_charts         → chart_series
//   wp_wkcharts_editions       → chart_editions
//   wp_wkcharts_edition_items  → chart_entries
// ---------------------------------------------------------------------------

export type WakilishaCptMapEntry = {
  post_type: string;
  target_entity: string;
  canonical_kind: string;
  ready_policy: "published_only" | "needs_review";
};

export type WakilishaPluginTableConfig = {
  /** The wp_wkcharts_* table name (WITHOUT prefix — prefix is injected at runtime). */
  table: string;
  /** Target entity in the staging records. */
  target_entity: string;
  /** Canonical kind label. */
  canonical_kind: string;
  /** Which column holds the primary ID. */
  id_column: string;
  /** Which column holds the title / display name. */
  title_column: string;
  /** Which column holds the slug. Falls back to slugified title. */
  slug_column: string | null;
  /** Which column holds a status (publish / draft etc.). */
  status_column: string | null;
  /** Which column holds a body / description. */
  body_column: string | null;
  /** Which column holds an excerpt. */
  excerpt_column: string | null;
  /** Which column holds a created / published date. */
  date_column: string | null;
  /** Which column holds an author / creator reference. */
  author_column: string | null;
  /** Which column holds a URL (source, guid, etc.). */
  url_column: string | null;
  /** Extra columns to copy into mapped_record besides the defaults. */
  extra_columns: string[];
  /** Ready policy. */
  ready_policy: "published_only" | "always_ready" | "needs_review";
};

// ---------------------------------------------------------------------------
// ALLOWED wp_posts post_types
// ---------------------------------------------------------------------------
// Anything NOT in this set is quarantined as `ignored_post_types` — it will
// NOT be staged as `content_entities`.  This prevents 31 000+ junk rows from
// polluting the import pipeline.
// ---------------------------------------------------------------------------

export const ALLOWED_WP_POST_TYPES = new Set([
  "post",
  "page",
  "attachment",
  "wakilisha_artist",
  "wk_genre_page",
  "wk_field_guide",
  "wk_chart_series",
  "wk_chart_edition",
  "wk_methodology",
]);

// ---------------------------------------------------------------------------
// wp_posts CPT map
// ---------------------------------------------------------------------------

export const WAKILISHA_CPT_MAP: Record<string, WakilishaCptMapEntry> = {
  post:               { post_type: "post",               target_entity: "articles",          canonical_kind: "article",          ready_policy: "published_only" },
  page:               { post_type: "page",               target_entity: "pages",             canonical_kind: "page",             ready_policy: "published_only" },
  wakilisha_artist:   { post_type: "wakilisha_artist",   target_entity: "artists",           canonical_kind: "artist",           ready_policy: "published_only" },
  wk_genre_page:      { post_type: "wk_genre_page",      target_entity: "genres",            canonical_kind: "genre",            ready_policy: "published_only" },
  wk_field_guide:     { post_type: "wk_field_guide",     target_entity: "guides",            canonical_kind: "guide",            ready_policy: "published_only" },
  wk_chart_series:    { post_type: "wk_chart_series",    target_entity: "chart_series",      canonical_kind: "chart_series",     ready_policy: "published_only" },
  wk_chart_edition:   { post_type: "wk_chart_edition",   target_entity: "chart_editions",    canonical_kind: "chart_edition",    ready_policy: "published_only" },
  wk_top10_surface:   { post_type: "wk_top10_surface",   target_entity: "chart_surfaces",    canonical_kind: "chart_surface",    ready_policy: "needs_review" },
  wk_magazine_surface:{ post_type: "wk_magazine_surface",target_entity: "magazine_surfaces", canonical_kind: "magazine_surface", ready_policy: "needs_review" },
  wk_methodology:     { post_type: "wk_methodology",     target_entity: "methodologies",     canonical_kind: "methodology",      ready_policy: "published_only" },
  wk_correction_page: { post_type: "wk_correction_page", target_entity: "corrections",       canonical_kind: "correction",       ready_policy: "needs_review" },
  wk_play_surface:    { post_type: "wk_play_surface",    target_entity: "play_surfaces",     canonical_kind: "play_surface",     ready_policy: "needs_review" },
  wk_labels_surface:  { post_type: "wk_labels_surface",  target_entity: "label_surfaces",    canonical_kind: "label_surface",    ready_policy: "needs_review" },
  wk_settings_surface:{ post_type: "wk_settings_surface",target_entity: "settings_surfaces", canonical_kind: "settings_surface", ready_policy: "needs_review" },
  wk_profile_surface: { post_type: "wk_profile_surface", target_entity: "profile_surfaces",  canonical_kind: "profile_surface",  ready_policy: "needs_review" },
};

// ---------------------------------------------------------------------------
// WAKILISHA plugin table → target entity mapping
// ---------------------------------------------------------------------------
// These are the wp_wkcharts_* custom tables that hold the canonical music
// registry data.  Column names are best-guess defaults; adjust after running
// DESCRIBE on each table.
// ---------------------------------------------------------------------------

export const WAKILISHA_PLUGIN_TABLE_MAP: WakilishaPluginTableConfig[] = [
  {
    table: "wkcharts_tracks",
    target_entity: "tracks",
    canonical_kind: "track",
    id_column: "id",
    title_column: "title",
    slug_column: "slug",
    status_column: "status",
    body_column: null,
    excerpt_column: null,
    date_column: "created_at",
    author_column: null,
    url_column: null,
    extra_columns: ["artist_id", "release_id", "duration", "genre_id", "spotify_id", "apple_music_id", "youtube_id", "isrc", "explicit", "track_number"],
    ready_policy: "published_only",
  },
  {
    table: "wkcharts_releases",
    target_entity: "releases",
    canonical_kind: "release",
    id_column: "id",
    title_column: "title",
    slug_column: "slug",
    status_column: "status",
    body_column: "description",
    excerpt_column: null,
    date_column: "release_date",
    author_column: null,
    url_column: null,
    extra_columns: ["label_id", "artist_id", "type", "cover_url", "upc", "catalog_number", "track_count"],
    ready_policy: "published_only",
  },
  {
    table: "wkcharts_labels",
    target_entity: "labels",
    canonical_kind: "label",
    id_column: "id",
    title_column: "name",
    slug_column: "slug",
    status_column: "status",
    body_column: "description",
    excerpt_column: null,
    date_column: "created_at",
    author_column: null,
    url_column: "website",
    extra_columns: ["logo_url", "country", "founded_year", "parent_label_id"],
    ready_policy: "published_only",
  },
  {
    table: "wkcharts_artists",
    target_entity: "artists",
    canonical_kind: "artist",
    id_column: "id",
    title_column: "name",
    slug_column: "slug",
    status_column: "status",
    body_column: "bio",
    excerpt_column: null,
    date_column: "created_at",
    author_column: null,
    url_column: "website",
    extra_columns: ["image_url", "origin", "artist_type", "spotify_id", "apple_music_id", "instagram_handle", "twitter_handle"],
    ready_policy: "published_only",
  },
  {
    table: "wkcharts_genres",
    target_entity: "genres",
    canonical_kind: "genre",
    id_column: "id",
    title_column: "name",
    slug_column: "slug",
    status_column: null,
    body_column: "description",
    excerpt_column: null,
    date_column: "created_at",
    author_column: null,
    url_column: null,
    extra_columns: ["parent_id", "color", "icon"],
    ready_policy: "always_ready",
  },
  {
    table: "wkcharts_charts",
    target_entity: "chart_series",
    canonical_kind: "chart_series",
    id_column: "id",
    title_column: "name",
    slug_column: "slug",
    status_column: "status",
    body_column: "description",
    excerpt_column: null,
    date_column: "created_at",
    author_column: null,
    url_column: null,
    extra_columns: ["chart_type", "frequency", "market_scope_id", "methodology_id"],
    ready_policy: "published_only",
  },
  {
    table: "wkcharts_editions",
    target_entity: "chart_editions",
    canonical_kind: "chart_edition",
    id_column: "id",
    title_column: "title",
    slug_column: "slug",
    status_column: "status",
    body_column: null,
    excerpt_column: null,
    date_column: "edition_date",
    author_column: null,
    url_column: null,
    extra_columns: ["chart_id", "week_number", "year", "entry_count"],
    ready_policy: "published_only",
  },
  {
    table: "wkcharts_edition_items",
    target_entity: "chart_entries",
    canonical_kind: "chart_entry",
    id_column: "id",
    title_column: null,
    slug_column: null,
    status_column: null,
    body_column: null,
    excerpt_column: null,
    date_column: "created_at",
    author_column: null,
    url_column: null,
    extra_columns: ["edition_id", "track_id", "rank", "previous_rank", "weeks_on_chart", "peak_position", "is_new_entry", "is_re_entry"],
    ready_policy: "always_ready",
  },
];

// ---------------------------------------------------------------------------
// WAKILISHA plugin relationship tables
// ---------------------------------------------------------------------------

export const WAKILISHA_PLUGIN_RELATIONSHIP_TABLES: { table: string; source_entity: string; target_entity: string; id_column: string; source_column: string; target_column: string; extra_columns: string[] }[] = [
  { table: "wkcharts_track_artists",       source_entity: "mysql.wkcharts_track_artists",       target_entity: "track_artists",       id_column: "id", source_column: "track_id",  target_column: "artist_id",         extra_columns: ["role", "is_primary", "sort_order"] },
  { table: "wkcharts_release_tracks",      source_entity: "mysql.wkcharts_release_tracks",      target_entity: "release_tracks",      id_column: "id", source_column: "release_id", target_column: "track_id",          extra_columns: ["track_number", "disc_number"] },
  { table: "wkcharts_release_labels",      source_entity: "mysql.wkcharts_release_labels",      target_entity: "release_labels",      id_column: "id", source_column: "release_id", target_column: "label_id",          extra_columns: ["label_role"] },
  { table: "wkcharts_artist_genres",       source_entity: "mysql.wkcharts_artist_genres",       target_entity: "artist_genres",       id_column: "id", source_column: "artist_id",  target_column: "genre_id",          extra_columns: [] },
  { table: "wkcharts_artist_relations",    source_entity: "mysql.wkcharts_artist_relations",    target_entity: "artist_relationships",id_column: "id", source_column: "artist_id",  target_column: "related_artist_id", extra_columns: ["relationship_type"] },
  { table: "wkcharts_entity_relationships",source_entity: "mysql.wkcharts_entity_relationships",target_entity:"entity_relationships", id_column: "id", source_column: "source_id",   target_column: "target_id",         extra_columns: ["source_type", "target_type", "relationship_type", "metadata"] },
  { table: "wkcharts_chart_entry_links",   source_entity: "mysql.wkcharts_chart_entry_links",   target_entity: "chart_entry_links",   id_column: "id", source_column: "entry_id",    target_column: "entity_id",         extra_columns: ["entity_type"] },
];

// ---------------------------------------------------------------------------
// WAKILISHA plugin taxonomies (terms table)
// ---------------------------------------------------------------------------

export const WAKILISHA_PLUGIN_TAXONOMIES = ["wk_artist_genre", "wk_artist_origin"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function wakilishaCptEntry(postType: string): WakilishaCptMapEntry | null {
  return WAKILISHA_CPT_MAP[postType] ?? null;
}

export function isAllowedPostType(postType: string): boolean {
  return ALLOWED_WP_POST_TYPES.has(postType);
}

export function targetEntityForWordPressPostType(postType: string): string {
  if (postType === "attachment") return "media_assets";
  const entry = wakilishaCptEntry(postType);
  if (entry) return entry.target_entity;
  if (isAllowedPostType(postType)) return postType === "post" ? "articles" : postType === "page" ? "pages" : postType;
  // Unknown post types are quarantined, NOT dumped into content_entities
  return "ignored_post_types";
}

export function canonicalKindForWordPressPostType(postType: string): string {
  return wakilishaCptEntry(postType)?.canonical_kind ?? postType;
}

export function shouldReadyPostType(postType: string, status: string, title: string): boolean {
  const entry = wakilishaCptEntry(postType);
  if (!title || !["publish", "published"].includes(status.toLowerCase())) return false;
  if (!entry) return postType === "post" || postType === "page";
  return entry.ready_policy === "published_only";
}