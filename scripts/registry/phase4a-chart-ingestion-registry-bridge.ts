import { createRegistryPool, hasTable } from "./phase1-db";

type TableCheck = {
  table: string;
  exists: boolean;
  rows: number | null;
  role: string;
};

type BridgePolicyRow = {
  source: string;
  observed_entity: string;
  bridge_action: string;
  registry_write_policy: string;
  blocks_chart_ingestion: boolean;
};

const canonicalTables = [
  "registry_artists",
  "registry_tracks",
  "registry_releases",
  "registry_release_shells",
  "registry_labels",
  "registry_release_artists",
  "registry_release_tracks",
  "registry_review_items",
];

const chartSourceTables: Array<{ table: string; role: string }> = [
  { table: "chart_entries", role: "Primary chart entry landing table" },
  { table: "wk_chart_entries_v2", role: "V2 chart entry source table" },
  { table: "wkcharts_track_chart_entry_resolution_preview", role: "Track ↔ chart entry resolution candidates" },
  { table: "wkcharts_track_release_resolution_preview", role: "Track ↔ release resolution candidates" },
  { table: "wkcharts_track_release_missing_reference_queue", role: "Track release references needing registry action" },
  { table: "wkcharts_track_label_resolution_preview", role: "Track ↔ label resolution candidates" },
  { table: "wkcharts_track_label_missing_reference_queue", role: "Track label references needing registry action" },
  { table: "wkcharts_release_chart_entry_resolution_preview", role: "Release ↔ chart entry resolution candidates" },
  { table: "wkcharts_release_label_missing_reference_queue", role: "Release label references needing registry action" },
  { table: "wkcharts_artist_genre_resolution_preview", role: "Artist ↔ genre resolution candidates" },
  { table: "wkcharts_artist_genre_manual_resolution_preview", role: "Manual artist ↔ genre resolution candidates" },
  { table: "wkcharts_entity_relationships_promotion_preview", role: "Entity relationship promotion candidates" },
  { table: "chart_entry_links_missing_reference_queue", role: "Chart entry links needing canonical references" },
  { table: "chart_entry_links_promotion_preview", role: "Chart entry links promotion candidates" },
  { table: "chart_missing_canonical_track_repair_preview", role: "Missing canonical track repair candidates" },
  { table: "chart_entry_artwork_media_resolution_preview", role: "Chart artwork/media resolution candidates" },
];

const bridgePolicy: BridgePolicyRow[] = [
  {
    source: "chart_entries / wk_chart_entries_v2",
    observed_entity: "chart entry",
    bridge_action: "Always land the chart row first, then attempt canonical linking.",
    registry_write_policy: "No blocking write required. Store raw title/artist/source evidence when registry confidence is low.",
    blocks_chart_ingestion: false,
  },
  {
    source: "track resolution previews",
    observed_entity: "track",
    bridge_action: "Match existing registry_tracks by canonical id, slug, normalized title + artist, or ISRC where available.",
    registry_write_policy: "If no confident match exists, create provisional registry_tracks row and open a review item.",
    blocks_chart_ingestion: false,
  },
  {
    source: "release resolution previews / missing reference queues",
    observed_entity: "release",
    bridge_action: "Match existing registry_releases and registry_release_shells; otherwise create a provisional release shell from chart evidence.",
    registry_write_policy: "Create/update registry_releases and registry_release_shells with status=provisional or needs_review.",
    blocks_chart_ingestion: false,
  },
  {
    source: "artist metadata in chart rows and previews",
    observed_entity: "artist",
    bridge_action: "Match registry_artists by slug, normalized name, aliases, and source hints.",
    registry_write_policy: "Create provisional registry_artists row when chart row needs it; review resolves identity later.",
    blocks_chart_ingestion: false,
  },
  {
    source: "label previews / missing reference queues",
    observed_entity: "label",
    bridge_action: "Match registry_labels by slug/name; create provisional labels only when needed for release/track evidence.",
    registry_write_policy: "Create provisional registry_labels row or queue manual review for ambiguous labels.",
    blocks_chart_ingestion: false,
  },
  {
    source: "review queues",
    observed_entity: "uncertain match",
    bridge_action: "Send uncertainty to registry_review_items while preserving chart usability.",
    registry_write_policy: "Review changes confidence/status later; it must not reject the chart row itself.",
    blocks_chart_ingestion: false,
  },
];

function qIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function countRows(pool: ReturnType<typeof createRegistryPool>, table: string): Promise<number | null> {
  if (!(await hasTable(pool, `public.${table}`))) return null;
  const result = await pool.query(`select count(*)::int as count from public.${qIdent(table)}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function listChartTables(pool: ReturnType<typeof createRegistryPool>): Promise<string[]> {
  const result = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and (table_name like '%chart%' or table_name like 'wkcharts%')
    order by table_name asc
  `);
  return result.rows.map((row: { table_name: string }) => row.table_name);
}

async function buildChecks(pool: ReturnType<typeof createRegistryPool>): Promise<TableCheck[]> {
  const checks: TableCheck[] = [];

  for (const table of canonicalTables) {
    const exists = await hasTable(pool, `public.${table}`);
    checks.push({ table, exists, rows: exists ? await countRows(pool, table) : null, role: "Canonical registry dependency" });
  }

  for (const source of chartSourceTables) {
    const exists = await hasTable(pool, `public.${source.table}`);
    checks.push({ table: source.table, exists, rows: exists ? await countRows(pool, source.table) : null, role: source.role });
  }

  return checks;
}

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    console.log("\nWAKILISHA Phase 4A.5 — Chart Ingestion Registry Bridge Policy");
    console.log("=".repeat(80));
    console.log("Mode: DRY RUN ONLY. No chart rows, registry rows, or shell rows will be modified.");

    const checks = await buildChecks(pool);
    const missingCanonical = checks.filter((item) => item.role === "Canonical registry dependency" && !item.exists);
    const chartTables = await listChartTables(pool);

    console.log("\nDiscovered chart-related tables");
    console.log("-".repeat(80));
    console.table(chartTables.map((table) => ({ table })));

    console.log("\nBridge dependency table check");
    console.log("-".repeat(80));
    console.table(checks);

    if (missingCanonical.length) {
      throw new Error(`Missing canonical dependencies: ${missingCanonical.map((item) => item.table).join(", ")}`);
    }

    const availableSources = checks.filter((item) => item.role !== "Canonical registry dependency" && item.exists);
    const missingSources = checks.filter((item) => item.role !== "Canonical registry dependency" && !item.exists);
    const missingReferenceRows = availableSources
      .filter((item) => item.table.includes("missing_reference_queue") || item.table.includes("missing_canonical"))
      .reduce((sum, item) => sum + Number(item.rows ?? 0), 0);
    const previewRows = availableSources
      .filter((item) => item.table.includes("resolution_preview") || item.table.includes("promotion_preview") || item.table.includes("repair_preview"))
      .reduce((sum, item) => sum + Number(item.rows ?? 0), 0);

    console.log("\nNon-blocking bridge policy");
    console.log("-".repeat(80));
    console.table(bridgePolicy);

    console.log("\nBridge dry-run summary");
    console.log("-".repeat(80));
    console.table([
      {
        canonical_dependencies_ready: true,
        chart_source_tables_available: availableSources.length,
        chart_source_tables_missing_or_not_used: missingSources.length,
        preview_candidate_rows: previewRows,
        missing_reference_rows: missingReferenceRows,
        ingestion_blocks_on_review: false,
      },
    ]);

    console.log("\nImplementation rule");
    console.log("-".repeat(80));
    console.log("Chart ingestion must land chart facts first, then match or create provisional registry entities.");
    console.log("Review queues improve canonical confidence later; they must not prevent chart rows from existing.");

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([
      {
        provisional_registry_creates: 0,
        review_items_created: 0,
        chart_rows_modified: 0,
        canonical_tables_modified: false,
        shell_rows_modified: false,
        public_rendering_changed: false,
        write_mode_supported: false,
      },
    ]);

    console.log("\nPhase 4A.5 dry-run complete. Policy validated against actual chart ingestion tables.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 4A.5 registry bridge failed.");
  console.error(error);
  process.exitCode = 1;
});
