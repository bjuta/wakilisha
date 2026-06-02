import type { LegacyWordPressImportMapping } from "./types";

export const WORDPRESS_LEGACY_IMPORT_MAPPINGS: LegacyWordPressImportMapping[] = [
  { sourceKind: "chart_program", legacyField: "legacyId", targetTable: "chart_programs", targetField: "legacy_wordpress_id", required: true },
  { sourceKind: "chart_program", legacyField: "publicSlug", targetTable: "chart_programs", targetField: "public_slug", required: true },
  { sourceKind: "chart_program", legacyField: "seriesSlug", targetTable: "chart_series", targetField: "slug" },
  { sourceKind: "chart_program", legacyField: "marketSlug", targetTable: "chart_markets", targetField: "slug" },
  { sourceKind: "chart_program", legacyField: "chartKind", targetTable: "chart_programs", targetField: "chart_kind" },

  { sourceKind: "chart_edition", legacyField: "legacyId", targetTable: "chart_editions", targetField: "legacy_wordpress_id", required: true },
  { sourceKind: "chart_edition", legacyField: "publicSlug", targetTable: "chart_editions", targetField: "program_public_slug", required: true },
  { sourceKind: "chart_edition", legacyField: "editionSlug", targetTable: "chart_editions", targetField: "edition_slug", required: true },
  { sourceKind: "chart_edition", legacyField: "editionDate", targetTable: "chart_editions", targetField: "edition_date" },
  { sourceKind: "chart_edition", legacyField: "entryCount", targetTable: "chart_editions", targetField: "entry_count" },

  { sourceKind: "chart_entry", legacyField: "legacyId", targetTable: "chart_entries", targetField: "legacy_wordpress_id", required: true },
  { sourceKind: "chart_entry", legacyField: "editionLegacyId", targetTable: "chart_entries", targetField: "legacy_edition_id" },
  { sourceKind: "chart_entry", legacyField: "rank", targetTable: "chart_entries", targetField: "rank", required: true },
  { sourceKind: "chart_entry", legacyField: "title", targetTable: "registry_tracks", targetField: "title", required: true },
  { sourceKind: "chart_entry", legacyField: "artistNames", targetTable: "registry_artist_credits", targetField: "artist_names", required: true },
  { sourceKind: "chart_entry", legacyField: "artworkUrl", targetTable: "registry_media_assets", targetField: "source_url" },

  { sourceKind: "artist", legacyField: "legacyId", targetTable: "registry_artists", targetField: "legacy_wordpress_id", required: true },
  { sourceKind: "artist", legacyField: "name", targetTable: "registry_artists", targetField: "name", required: true },
  { sourceKind: "artist", legacyField: "slug", targetTable: "registry_artists", targetField: "slug" },
  { sourceKind: "artist", legacyField: "bio", targetTable: "registry_artists", targetField: "bio" },
  { sourceKind: "artist", legacyField: "originIso2", targetTable: "registry_artist_origin_claims", targetField: "origin_iso2" },

  { sourceKind: "track", legacyField: "legacyId", targetTable: "registry_tracks", targetField: "legacy_wordpress_id", required: true },
  { sourceKind: "track", legacyField: "title", targetTable: "registry_tracks", targetField: "title", required: true },
  { sourceKind: "track", legacyField: "artistNames", targetTable: "registry_artist_credits", targetField: "artist_names", required: true },
  { sourceKind: "track", legacyField: "isrc", targetTable: "registry_tracks", targetField: "isrc" },
  { sourceKind: "track", legacyField: "releaseDate", targetTable: "registry_tracks", targetField: "release_date" },

  { sourceKind: "label", legacyField: "legacyId", targetTable: "registry_labels", targetField: "legacy_wordpress_id", required: true },
  { sourceKind: "label", legacyField: "name", targetTable: "registry_labels", targetField: "name", required: true },
  { sourceKind: "label", legacyField: "slug", targetTable: "registry_labels", targetField: "slug" },

  { sourceKind: "genre", legacyField: "legacyId", targetTable: "registry_genres", targetField: "legacy_wordpress_id", required: true },
  { sourceKind: "genre", legacyField: "name", targetTable: "registry_genres", targetField: "name", required: true },
  { sourceKind: "genre", legacyField: "slug", targetTable: "registry_genres", targetField: "slug" },

  { sourceKind: "article", legacyField: "legacyId", targetTable: "editorial_posts", targetField: "legacy_wordpress_id", required: true },
  { sourceKind: "article", legacyField: "title", targetTable: "editorial_posts", targetField: "title", required: true },
  { sourceKind: "article", legacyField: "slug", targetTable: "editorial_posts", targetField: "slug" },

  { sourceKind: "media_asset", legacyField: "legacyId", targetTable: "media_assets", targetField: "legacy_wordpress_id", required: true },
  { sourceKind: "media_asset", legacyField: "url", targetTable: "media_assets", targetField: "source_url", required: true },
  { sourceKind: "media_asset", legacyField: "mimeType", targetTable: "media_assets", targetField: "mime_type" },
];

export function getWordPressLegacyMappingsForKind(sourceKind: LegacyWordPressImportMapping["sourceKind"]): LegacyWordPressImportMapping[] {
  return WORDPRESS_LEGACY_IMPORT_MAPPINGS.filter((mapping) => mapping.sourceKind === sourceKind);
}
