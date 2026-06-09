import pg from "pg";
import { cleanText, createRegistryPool, hasTable, normalizeText } from "./phase1-db";

type EntityType = "artist" | "track" | "release";
type RunnerMode = "DRY_RUN" | "WRITE";

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
  mode: RunnerMode;
  limit: number;
  source_rows_read: number;
  provider_items_planned: number;
  match_candidates_planned: number;
  promotion_decisions_planned: number;
  provider_rows_written: number;
  match_candidates_written: number;
  promotion_decisions_written: number;
  registry_rows_written: 0;
  public_rendering_changed: false;
  run_key?: string;
};

type IntakePlan = { summary: RunSummary; items: PlannedProviderItem[] };

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function getArgNumber(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getArgString(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
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

async function buildProviderIntakePlan(pool: pg.Pool, options: { limit?: number } = {}): Promise<IntakePlan> {
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
      match_candidates_written: 0,
      promotion_decisions_written: 0,
      registry_rows_written: 0,
      public_rendering_changed: false,
    },
    items,
  };
}

export async function runProviderIntakeDryRun(pool: pg.Pool, options: { limit?: number } = {}): Promise<IntakePlan> {
  return buildProviderIntakePlan(pool, options);
}

async function upsertProviderSource(client: pg.PoolClient): Promise<string> {
  const result = await client.query(
    `
    insert into public.provider_sources (provider_kind, name, slug, description, config)
    values (
      'other',
      'WAKILISHA Registry Snapshot',
      'wakilisha-registry-snapshot',
      'Internal registry-backed source used to validate provider intake staging.',
      jsonb_build_object('phase', '5C', 'writesCanonicalRegistry', false)
    )
    on conflict (slug) do update
      set name = excluded.name,
          description = excluded.description,
          config = excluded.config,
          updated_at = now()
    returning id
    `,
  );
  return String(result.rows[0].id);
}

async function upsertProviderRun(client: pg.PoolClient, providerSourceId: string, runKey: string, limit: number): Promise<string> {
  const result = await client.query(
    `
    insert into public.provider_runs (provider_source_id, run_key, status, started_at, completed_at, stats)
    values ($1, $2, 'completed', now(), now(), jsonb_build_object('limit', $3, 'phase', '5C'))
    on conflict (provider_source_id, run_key) do update
      set status = 'completed',
          started_at = now(),
          completed_at = now(),
          stats = jsonb_build_object('limit', $3, 'phase', '5C'),
          errors = '[]'::jsonb,
          updated_at = now()
    returning id
    `,
    [providerSourceId, runKey, limit],
  );
  return String(result.rows[0].id);
}

async function clearExistingRunRows(client: pg.PoolClient, providerRunId: string): Promise<void> {
  await client.query(
    `
    delete from public.provider_promotion_decisions
    where provider_item_id in (
      select id from public.provider_items where provider_run_id = $1
    )
    `,
    [providerRunId],
  );

  await client.query(
    `
    delete from public.provider_match_candidates
    where provider_item_id in (
      select id from public.provider_items where provider_run_id = $1
    )
    `,
    [providerRunId],
  );

  await client.query("delete from public.provider_items where provider_run_id = $1", [providerRunId]);
}

async function writeProviderItem(client: pg.PoolClient, providerSourceId: string, providerRunId: string, item: PlannedProviderItem): Promise<string> {
  const result = await client.query(
    `
    insert into public.provider_items (
      provider_source_id,
      provider_run_id,
      provider_external_id,
      entity_type,
      status,
      normalized_slug,
      normalized_title,
      normalized_artist,
      normalized_payload,
      raw_payload,
      confidence_score
    )
    values (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      jsonb_build_object(
        'slug', $6,
        'title', $7,
        'artist', $8,
        'sourceTable', $9,
        'registryId', $10
      ),
      jsonb_build_object(
        'source_table', $9,
        'registry_id', $10,
        'match_rule', $11
      ),
      $12
    )
    returning id
    `,
    [
      providerSourceId,
      providerRunId,
      `${item.source_table}:${item.registry_id}`,
      item.entity_type,
      item.decision === "block" ? "blocked" : item.decision === "auto_match" ? "matched" : "review",
      item.normalized_slug,
      item.normalized_title,
      item.normalized_artist,
      item.source_table,
      item.registry_id,
      item.match_rule,
      item.confidence_score,
    ],
  );
  return String(result.rows[0].id);
}

async function writeMatchCandidate(client: pg.PoolClient, providerItemId: string, item: PlannedProviderItem): Promise<string> {
  const result = await client.query(
    `
    insert into public.provider_match_candidates (
      provider_item_id,
      registry_entity_type,
      registry_entity_id,
      match_status,
      match_rule,
      confidence_score,
      evidence
    )
    values (
      $1,
      $2,
      $3,
      'candidate',
      $4,
      $5,
      jsonb_build_object(
        'sourceTable', $6,
        'registryId', $3,
        'normalizedSlug', $7,
        'normalizedTitle', $8,
        'normalizedArtist', $9
      )
    )
    returning id
    `,
    [
      providerItemId,
      item.entity_type,
      item.registry_id,
      item.match_rule,
      item.confidence_score,
      item.source_table,
      item.normalized_slug,
      item.normalized_title,
      item.normalized_artist,
    ],
  );
  return String(result.rows[0].id);
}

async function writePromotionDecision(client: pg.PoolClient, providerItemId: string, matchCandidateId: string, item: PlannedProviderItem): Promise<string> {
  const result = await client.query(
    `
    insert into public.provider_promotion_decisions (
      provider_item_id,
      match_candidate_id,
      decision,
      decision_status,
      registry_entity_type,
      registry_entity_id,
      notes,
      metadata
    )
    values (
      $1,
      $2,
      $3,
      'draft',
      $4,
      $5,
      $6,
      jsonb_build_object(
        'phase', '5C',
        'writesCanonicalRegistry', false,
        'sourceTable', $7,
        'matchRule', $8,
        'confidenceScore', $9
      )
    )
    returning id
    `,
    [
      providerItemId,
      matchCandidateId,
      item.decision,
      item.entity_type,
      item.registry_id,
      item.decision === "auto_match"
        ? "High-confidence staging candidate. Canonical registry write remains disabled."
        : item.decision === "review_required"
          ? "Needs review before promotion. Canonical registry write remains disabled."
          : "Blocked by low-confidence staging rules.",
      item.source_table,
      item.match_rule,
      item.confidence_score,
    ],
  );
  return String(result.rows[0].id);
}

export async function runProviderIntakeWrite(pool: pg.Pool, options: { limit?: number; runKey?: string } = {}): Promise<IntakePlan> {
  const plan = await buildProviderIntakePlan(pool, options);
  const runKey = options.runKey || `phase5c_registry_snapshot_limit_${plan.summary.limit}`;
  const client = await pool.connect();

  try {
    await client.query("begin");

    const providerSourceId = await upsertProviderSource(client);
    const providerRunId = await upsertProviderRun(client, providerSourceId, runKey, plan.summary.limit);
    await clearExistingRunRows(client, providerRunId);

    let providerRowsWritten = 0;
    let matchCandidatesWritten = 0;
    let promotionDecisionsWritten = 0;

    for (const item of plan.items) {
      const providerItemId = await writeProviderItem(client, providerSourceId, providerRunId, item);
      providerRowsWritten += 1;

      const matchCandidateId = await writeMatchCandidate(client, providerItemId, item);
      matchCandidatesWritten += 1;

      await writePromotionDecision(client, providerItemId, matchCandidateId, item);
      promotionDecisionsWritten += 1;
    }

    await client.query(
      `
      update public.provider_runs
      set stats = jsonb_build_object(
            'limit', $2,
            'phase', '5C',
            'providerItemsWritten', $3,
            'matchCandidatesWritten', $4,
            'promotionDecisionsWritten', $5,
            'registryRowsWritten', 0
          ),
          updated_at = now()
      where id = $1
      `,
      [providerRunId, plan.summary.limit, providerRowsWritten, matchCandidatesWritten, promotionDecisionsWritten],
    );

    await client.query("commit");

    return {
      summary: {
        ...plan.summary,
        mode: "WRITE",
        run_key: runKey,
        provider_rows_written: providerRowsWritten,
        match_candidates_written: matchCandidatesWritten,
        promotion_decisions_written: promotionDecisionsWritten,
        registry_rows_written: 0,
        public_rendering_changed: false,
      },
      items: plan.items,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function run(): Promise<void> {
  const writeMode = hasFlag("write");
  const dryRunMode = hasFlag("dry-run") || !writeMode;
  const limit = getArgNumber("limit", 50);
  const runKey = getArgString("run-key", `phase5c_registry_snapshot_limit_${limit}`);

  console.log("\nWAKILISHA Phase 5B/5C Provider Item Staging Runner");
  console.log("=".repeat(80));
  console.log(`Mode: ${dryRunMode ? "DRY RUN ONLY" : "WRITE"}`);
  console.log(`Limit: ${limit}`);
  if (writeMode) console.log(`Run key: ${runKey}`);

  const pool = createRegistryPool();
  try {
    const result = writeMode
      ? await runProviderIntakeWrite(pool, { limit, runKey })
      : await runProviderIntakeDryRun(pool, { limit });

    console.log("\nSummary");
    console.log("-".repeat(80));
    console.table([result.summary]);

    console.log("\nPlanned provider items");
    console.log("-".repeat(80));
    console.table(result.items.slice(0, Math.min(result.items.length, 25)));

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{
      provider_rows_written: result.summary.provider_rows_written,
      match_candidates_written: result.summary.match_candidates_written,
      promotion_decisions_written: result.summary.promotion_decisions_written,
      registry_rows_written: 0,
      public_rendering_changed: false,
      write_mode_supported: true,
    }]);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 5B/5C provider item staging failed.");
  console.error(error);
  process.exitCode = 1;
});
