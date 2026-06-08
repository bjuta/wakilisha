import { createRegistryPool, hasTable } from "./phase1-db";

type SourceDefinition = {
  table: string;
  entityType: "track" | "release" | "label" | "artist" | "chart_entry_link";
  reviewType: string;
  priority: "normal" | "high";
  summary: string;
};

type SourceRow = {
  source_hash: string;
  payload: Record<string, unknown>;
};

type PlannedReviewItem = {
  review_key: string;
  entity_type: string;
  review_type: string;
  priority: string;
  title: string;
  summary: string;
  source_table: string;
  source_id: string;
  source_payload: Record<string, unknown>;
  candidate_payload: Record<string, unknown>;
};

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const writeMode = hasFlag("write");
const limit = Math.max(1, Math.min(Number(argValue("limit", "100")) || 100, 5000));

const sources: SourceDefinition[] = [
  {
    table: "chart_missing_canonical_track_repair_preview",
    entityType: "track",
    reviewType: "chart_provisional_track_write",
    priority: "high",
    summary: "Chart row has no canonical track. Create or match a provisional registry track without blocking chart ingestion.",
  },
  {
    table: "wkcharts_track_release_missing_reference_queue",
    entityType: "release",
    reviewType: "chart_provisional_release_write",
    priority: "high",
    summary: "Chart-observed track references a missing release. Create or match a provisional registry release and shell.",
  },
  {
    table: "wkcharts_release_label_missing_reference_queue",
    entityType: "label",
    reviewType: "chart_provisional_label_write",
    priority: "normal",
    summary: "Chart-observed release references a missing label. Create or match a provisional registry label.",
  },
  {
    table: "wkcharts_track_label_missing_reference_queue",
    entityType: "label",
    reviewType: "chart_provisional_label_write",
    priority: "normal",
    summary: "Chart-observed track references a missing label. Create or match a provisional registry label.",
  },
  {
    table: "chart_entry_links_missing_reference_queue",
    entityType: "chart_entry_link",
    reviewType: "chart_entry_missing_canonical_link",
    priority: "high",
    summary: "Chart entry link is missing a canonical registry reference. Keep the chart row live and queue the missing canonical link.",
  },
];

function qIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return "";
  return String(value).trim();
}

function findValue(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const direct = scalar(payload[key]);
    if (direct) return direct;
  }

  for (const value of Object.values(payload)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const nested = findValue(value as Record<string, unknown>, keys);
    if (nested) return nested;
  }

  return "";
}

function titleFor(definition: SourceDefinition, payload: Record<string, unknown>): string {
  const title = findValue(payload, [
    "title",
    "track_title",
    "release_title",
    "label_name",
    "artist_name",
    "name",
    "canonical_title",
    "source_title",
  ]);
  const artist = findValue(payload, ["artist", "artist_name", "primary_artist", "track_artist", "source_artist"]);
  const suffix = [title, artist].filter(Boolean).join(" — ");
  return suffix ? `Chart provisional ${definition.entityType}: ${suffix}` : `Chart provisional ${definition.entityType} from ${definition.table}`;
}

function candidatePayload(definition: SourceDefinition, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    phase: "4A.6",
    provisionalEntityType: definition.entityType,
    suggestedAction: "match_or_create_provisional_registry_entity",
    blocksChartIngestion: false,
    status: "needs_review",
    evidence: {
      title: findValue(payload, ["title", "track_title", "release_title", "canonical_title", "source_title"]),
      artist: findValue(payload, ["artist", "artist_name", "primary_artist", "track_artist", "source_artist"]),
      label: findValue(payload, ["label", "label_name", "source_label"]),
      slug: findValue(payload, ["slug", "track_slug", "release_slug", "artist_slug", "label_slug"]),
      sourceId: findValue(payload, ["id", "entry_id", "chart_entry_id", "track_id", "release_id", "label_id"]),
    },
  };
}

async function fetchRows(pool: ReturnType<typeof createRegistryPool>, table: string): Promise<SourceRow[]> {
  const result = await pool.query(
    `
    select
      md5(row_to_json(src)::text) as source_hash,
      row_to_json(src)::jsonb as payload
    from public.${qIdent(table)} src
    order by 1
    limit $1
    `,
    [limit],
  );
  return result.rows as SourceRow[];
}

async function planItems(pool: ReturnType<typeof createRegistryPool>): Promise<PlannedReviewItem[]> {
  const planned: PlannedReviewItem[] = [];

  for (const definition of sources) {
    if (!(await hasTable(pool, `public.${definition.table}`))) continue;
    const rows = await fetchRows(pool, definition.table);

    for (const row of rows) {
      const reviewKey = `phase4a6:${definition.table}:${definition.entityType}:${row.source_hash}`;
      planned.push({
        review_key: reviewKey,
        entity_type: definition.entityType,
        review_type: definition.reviewType,
        priority: definition.priority,
        title: titleFor(definition, row.payload),
        summary: definition.summary,
        source_table: definition.table,
        source_id: row.source_hash,
        source_payload: row.payload,
        candidate_payload: candidatePayload(definition, row.payload),
      });
    }
  }

  return planned;
}

async function existingCount(pool: ReturnType<typeof createRegistryPool>, reviewKeys: string[]): Promise<number> {
  if (!reviewKeys.length) return 0;
  const result = await pool.query(
    "select count(*)::int as count from public.registry_review_items where review_key = any($1::text[])",
    [reviewKeys],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function writeItems(pool: ReturnType<typeof createRegistryPool>, items: PlannedReviewItem[]): Promise<number> {
  let written = 0;

  for (const item of items) {
    const result = await pool.query(
      `
      insert into public.registry_review_items (
        review_key,
        entity_type,
        review_type,
        priority,
        status,
        title,
        summary,
        source_table,
        source_id,
        source_payload,
        candidate_payload,
        resolution_payload
      ) values (
        $1, $2, $3, $4, 'open', $5, $6, $7, $8, $9::jsonb, $10::jsonb, '{}'::jsonb
      )
      on conflict (review_key) do update set
        priority = excluded.priority,
        title = excluded.title,
        summary = excluded.summary,
        source_payload = excluded.source_payload,
        candidate_payload = excluded.candidate_payload,
        updated_at = now()
      returning id
      `,
      [
        item.review_key,
        item.entity_type,
        item.review_type,
        item.priority,
        item.title,
        item.summary,
        item.source_table,
        item.source_id,
        JSON.stringify(item.source_payload),
        JSON.stringify(item.candidate_payload),
      ],
    );
    written += result.rowCount ?? 0;
  }

  return written;
}

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    console.log("\nWAKILISHA Phase 4A.6 — Chart Provisional Registry Writes");
    console.log("=".repeat(80));
    console.log(`Mode: ${writeMode ? "WRITE" : "DRY RUN ONLY"}`);
    console.log(`Limit per source table: ${limit}`);

    for (const table of ["registry_review_items", "registry_artists", "registry_tracks", "registry_releases", "registry_release_shells", "registry_labels"]) {
      if (!(await hasTable(pool, `public.${table}`))) {
        throw new Error(`Required table missing: public.${table}`);
      }
    }

    const sourceStatus = [];
    for (const source of sources) {
      const exists = await hasTable(pool, `public.${source.table}`);
      const count = exists ? Number((await pool.query(`select count(*)::int as count from public.${qIdent(source.table)}`)).rows[0]?.count ?? 0) : null;
      sourceStatus.push({ table: source.table, entity_type: source.entityType, exists, rows: count });
    }

    console.log("\nChart provisional source queues");
    console.log("-".repeat(80));
    console.table(sourceStatus);

    const planned = await planItems(pool);
    const keys = planned.map((item) => item.review_key);
    const existingBefore = await existingCount(pool, keys);
    const wouldInsert = Math.max(0, planned.length - existingBefore);
    const wouldUpdate = existingBefore;

    console.log("\nPlanned provisional review writes");
    console.log("-".repeat(80));
    console.table(planned.slice(0, 25).map((item) => ({
      entity_type: item.entity_type,
      review_type: item.review_type,
      priority: item.priority,
      source_table: item.source_table,
      title: item.title,
    })));

    console.log("\nWrite plan summary");
    console.log("-".repeat(80));
    console.table([{ rows_planned: planned.length, rows_would_insert: wouldInsert, rows_would_update: wouldUpdate, write_mode: writeMode }]);

    if (!writeMode) {
      console.log("\nSafety result");
      console.log("-".repeat(80));
      console.table([{ review_items_written: 0, canonical_tables_modified: false, shell_rows_modified: false, chart_rows_modified: false, public_rendering_changed: false, write_mode_supported: true }]);
      console.log("\nPhase 4A.6 dry-run complete. Rerun with --write to upsert review-backed provisional registry work items.");
      return;
    }

    const written = await writeItems(pool, planned);

    const totals = await pool.query(
      `
      select review_type, status, count(*)::int as count
      from public.registry_review_items
      where review_key like 'phase4a6:%'
      group by review_type, status
      order by review_type, status
      `,
    );

    console.log("\nWrite results");
    console.log("-".repeat(80));
    console.table([{ rows_planned: planned.length, review_items_written: written, rows_inserted_estimate: wouldInsert, rows_updated_estimate: wouldUpdate }]);

    console.log("\nPhase 4A.6 review item totals");
    console.log("-".repeat(80));
    console.table(totals.rows);

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{ review_items_written: written, canonical_tables_modified: false, shell_rows_modified: false, chart_rows_modified: false, public_rendering_changed: false }]);

    console.log("\nPhase 4A.6 write complete. Chart ingestion remains non-blocking; provisional registry work is queued for review/canonicalization.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 4A.6 provisional registry write failed.");
  console.error(error);
  process.exitCode = 1;
});
