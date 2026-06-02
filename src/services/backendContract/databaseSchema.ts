export const WAKILISHA_RUNTIME_TABLES = {
  chartOntology: [
    "chart_series",
    "chart_markets",
    "chart_programs",
    "chart_eligibility_profiles",
    "chart_market_scopes",
    "chart_slug_aliases",
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
    "chart_ingest_sources",
    "chart_ingest_rows",
    "chart_ingest_excluded_rows",
  ],
  publishing: [
    "chart_editions",
    "chart_entries",
    "chart_snapshots",
    "chart_source_coverage",
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

export const WAKILISHA_V2_COMPATIBILITY_VIEWS = [
  "wk_chart_series_v2",
  "wk_chart_markets_v2",
  "wk_chart_programs_v2",
  "wk_chart_editions_v2",
  "wk_chart_entries_v2",
  "wk_chart_source_coverage_v2",
  "wk_chart_slug_aliases_v2",
  "wk_chart_methodologies_v2",
  "wk_chart_eligibility_rules_v2",
] as const;

export type WakilishaRuntimeTableGroup = keyof typeof WAKILISHA_RUNTIME_TABLES;
export type WakilishaRuntimeTable = (typeof WAKILISHA_RUNTIME_TABLES)[WakilishaRuntimeTableGroup][number];
export type WakilishaV2CompatibilityView = (typeof WAKILISHA_V2_COMPATIBILITY_VIEWS)[number];

export function listRuntimeTables(): string[] {
  return Object.values(WAKILISHA_RUNTIME_TABLES).flat();
}

export function listRuntimeSchemaObjects(): string[] {
  return [...listRuntimeTables(), ...WAKILISHA_V2_COMPATIBILITY_VIEWS];
}
