import pg from "pg";
import { cleanText, createRegistryPool, hasTable, normalizeText } from "./phase1-db";

type EntityType = "artist" | "track" | "release";

type RegistrySource = {
  entityType: EntityType;
  tableName: string;
  id: string;
  title: string;
  slug: string;
  artist?: string;
  sourcePayload: Record<string, unknown>;
};

type PlannedProviderItem = {
  entity_type: EntityType;
  normalized_slug: string;
  normalized_title: string;
  normalized_artist: string | null;
  confidence_score: number;
  source_table: string;
  registry_id: string;
  decision: "auto_match" | "review_required" | "block";
  match_rule: string;
};

type RunSummary = {
  mode: "DRY_RUN";
  limit: number;
  source_rows_read: number;
  provider_items_planned: number;
  match_candidates_planned: number;
  promotion_decisions_planned: number;
  provider_rows_written: 0;
  registry_rows_written: 0;
  public_rendering_changed: false;
};

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function getArgNumber(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sqlIdentifier(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function firstAvailable(columns: Set<string>, candidates: string[]): string | null {
  return candidates.find((candidate) => columns.has(candidate)) ?? null;
}

async function getColumns(pool: pg.Pool, tableName: string): Promise<Set<string>> {
  const result = await pool.query(
    `
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = $1
    `,
    [tableName],
  );
  return new Set(result.rows.map((row) => String(row.column_name)));
}

function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickPayload(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  return Object.fromEntries(columns.map((column) => [column, row[column]]));
}

async function loadRegistryRows(pool: pg.Pool, tableName: string, entityType: EntityType, limit: number): Promise<RegistrySource[]> {
  if (!(await hasTable(pool, `public.${tableName}`))) return [];

  const columns = await getColumns(pool, tableName);
  const idColumn = firstAvailable(columns, ["id", "registry_id", "release_id", "track_id", "artist_id"]);
  const titleColumn = firstAvailable(columns, ["name", "title", "track_title", "release_title"]);
  const slugColumn = firstAvailable(columns, ["slug", "artist_slug", "track_slug", "release_slug", "primary_artist_slug"]);
  const artistColumn = firstAvailable(columns, ["primary_artist_name", "artist_name", "display_artist", "artist"]);

  if (!idColumn || !titleColumn) return [];

  const selectColumns = Array.from(new Set([idColumn, titleColumn, slugColumn, artistColumn].filter(Boolean))) as string[];
  const result = await pool.query(
    `
    select ${selectColumns.map(sqlIdentifier).join(", ")}
    from public.${sqlIdentifier(tableName)}
    where ${sqlIdentifier(titleColumn)} is not null
    order by ${sqlIdentifier(titleColumn)} asc
    limit $1
    `,
    [limit],
  );

  return result.rows.map((row) => {
    const title = cleanText(row[titleColumn]);
    const artist = artistColumn ? cleanText(row[artistColumn]) : "";
    const slug = slugColumn ? cleanText(row[slugColumn]) : slugify([artist, title].filter(Boolean).join(" "));

    return {
      entityType,
      tableName,
      id: cleanText(row[idColumn]),
      title,
      slug: slug || slugify(title),
      artist: artist || undefined,
      sourcePayload: pickPayload(row, selectColumns),
    };
  });
}

function planProviderItem(row: RegistrySource): PlannedProviderItem {
  const normalizedTitle = normalizeText(row.title);
  const normalizedArtist = row.artist ? normalizeText(row.artist) : null;
  const normalizedSlug = row.slug || slugify([row.artist, row.title].filter(Boolean).join(" "));
  const hasStrongSlug = normalizedSlug.length > 0;
  const hasTitle = normalizedTitle.length > 0;
  const hasArtistContext = row.entityType === "artist" || Boolean(normalizedArtist);
  const confidenceScore = hasStrongSlug && hasTitle && hasArtistContext ? 0.98 : hasTitle ? 0.74 : 0.2;

  return {
    entity_type: row.entityType,
    normalized_slug: normalizedSlug,
    normalized_title: normalizedTitle,
    normalized_artist: normalizedArtist,
    confidence_score: Number(confidenceScore.toFixed(4)),
    source_table: row.tableName,
    registry_id: row.id,
    decision: confidenceScore >= 0.95 ? "auto_match" : confidenceScore >= 0.7 ? "review_required" : "block",
    match_rule: confidenceScore >= 0.95 ? "registry_id_and_normalized_slug" : "normalized_title_review",
  };
}

export async function runProviderIntakeDryRun(pool: pg.Pool, options: { limit?: number } = {}): Promise<{ summary: RunSummary; items: PlannedProviderItem[] }> {
  const limit = options.limit ?? 50;
  const perSourceLimit = Math.max(1, Math.ceil(limit / 3));
  const sources = [
    ...(await loadRegistryRows(pool, "registry_artists", "artist", perSourceLimit)),
    ...(await loadRegistryRows(pool, "registry_tracks", "track", perSourceLimit)),
    ...(await loadRegistryRows(pool, "registry_release_shells", "release", perSourceLimit)),
  ].slice(0, limit);

  const items = sources.map(planProviderItem);

  return {
    summary: {
      mode: "DRY_RUN",
      limit,
      source_rows_read: sources.length,
      provider_items_planned: items.length,
      match_candidates_planned: items.length,
      promotion_decisions_planned: items.length,
      provider_rows_written: 0,
      registry_rows_written: 0,
      public_rendering_changed: false,
    },
    items,
  };
}

async function run(): Promise<void> {
  const writeMode = hasFlag("write");
  const dryRunMode = hasFlag("dry-run") || !writeMode;
  const limit = getArgNumber("limit", 50);

  console.log("\nWAKILISHA Phase 5B Provider Item Staging Runner");
  console.log("=".repeat(80));
  console.log(`Mode: ${dryRunMode ? "DRY RUN ONLY" : "WRITE REQUESTED"}`);
  console.log(`Limit: ${limit}`);

  if (writeMode) {
    throw new Error("Phase 5B currently supports dry-run only. Write mode belongs in the next PR after staging output is reviewed.");
  }

  const pool = createRegistryPool();
  try {
    const result = await runProviderIntakeDryRun(pool, { limit });

    console.log("\nSummary");
    console.log("-".repeat(80));
    console.table([result.summary]);

    console.log("\nPlanned provider items");
    console.log("-".repeat(80));
    console.table(result.items.slice(0, Math.min(result.items.length, 25)));

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{ provider_rows_written: 0, registry_rows_written: 0, public_rendering_changed: false, write_mode_supported: false }]);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 5B provider item staging failed.");
  console.error(error);
  process.exitCode = 1;
});
