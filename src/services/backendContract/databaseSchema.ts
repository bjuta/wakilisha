export const WAKILISHA_RUNTIME_TABLES = {
  chartOntology: [
    "wk_chart_series_v2",
    "wk_chart_markets_v2",
    "wk_chart_programs_v2",
    "chart_eligibility_profiles",
    "chart_market_scopes",
    "wk_chart_slug_aliases_v2",
  ],
  registry: [
    "registry_artists",
    "registry_artist_aliases",
    "registry_artist_provider_links",
    "registry_labels",
    "registry_genres",
    "registry_releases",
    "registry_tracks",
    "registry_track_artist_credits",
    "registry_track_provider_links",
  ],
  ingestion: [
    "chart_ingest_runs",
    "chart_ingest_run_sources",
    "chart_ingest_raw_rows",
    "chart_ingest_normalized_rows",
    "chart_ingest_candidates",
    "chart_ingest_candidate_scores",
    "chart_ingest_matches",
    "chart_ingest_exclusions",
    "chart_ingest_review_issues",
    "chart_ingest_stage_events",
    "chart_ingest_audit_events",
  ],
  publishing: [
    "wk_chart_editions_v2",
    "wk_chart_entries_v2",
    "chart_snapshots",
    "wk_chart_source_coverage_v2",
    "chart_audit_events",
  ],
  admin: [
    "admin_settings",
    "provider_credentials",
  ],
  legacyImport: [
    "legacy_import_jobs",
    "legacy_import_mappings",
    "legacy_import_records",
  ],
} as const;

export const WAKILISHA_DEPRECATED_TABLES = [
  "wk_chart_series",
  "wk_chart_markets",
  "wk_chart_programs",
  "wk_chart_editions",
  "chart_entries",
  "chart_source_coverage",
  "chart_slug_aliases",
] as const;

export type WakilishaRuntimeTableGroup = keyof typeof WAKILISHA_RUNTIME_TABLES;
export type WakilishaRuntimeTable = (typeof WAKILISHA_RUNTIME_TABLES)[WakilishaRuntimeTableGroup][number];
export type WakilishaDeprecatedTable = (typeof WAKILISHA_DEPRECATED_TABLES)[number];

export function listRuntimeTables(): string[] {
  return Object.values(WAKILISHA_RUNTIME_TABLES).flat();
}

export function listRuntimeSchemaObjects(): string[] {
  return [...listRuntimeTables()];
}
