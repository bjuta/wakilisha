import { createRegistryPool, hasTable, normalizeText, parseJsonObject } from "./phase1-db";

type JsonObject = Record<string, unknown>;

type DecisionRow = {
  decision_id: string;
  decision_type: string;
  decision_status: string;
  decision_notes: string | null;
  decision_created_at: string;
  review_item_id: string | null;
  review_status: string | null;
  review_type: string | null;
  review_key: string | null;
  item_entity_type: string | null;
  item_entity_id: string | null;
  source_table: string | null;
  source_id: string | null;
  source_payload: JsonObject | null;
  candidate_payload: JsonObject | null;
  resolution_payload: JsonObject | null;
  after_payload: JsonObject | null;
};

type ArtistMatch = {
  id: string;
  slug: string;
  name: string;
};

type PlanRow = {
  decision_id: string;
  decision_type: string;
  review_item_id: string | null;
  entity_type: string;
  entity_id: string | null;
  review_type: string | null;
  status: string;
  reason: string;
  intended_table: string | null;
  artist_id: string | null;
  artist_slug: string | null;
  artist_name: string | null;
  artist_text: string;
  artist_slug_candidate: string;
  role: string | null;
  is_primary: boolean | null;
  is_featured: boolean | null;
};

const allowedDecisionTypes = new Set([
  "approve_primary_artist",
  "approve_featured_artist_split",
  "needs_more_research",
  "reject_bad_metadata",
  "duplicate_or_bad_source",
]);

const nonActionableDecisionTypes = new Set([
  "needs_more_research",
  "reject_bad_metadata",
  "duplicate_or_bad_source",
]);

const multiArtistPattern = /(,| & | and | feat\.?| ft\.?| featuring | with | x )/i;

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const limit = Math.max(1, Math.min(Number(argValue("limit", "100")) || 100, 1000));

function textField(payload: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getArtistText(row: DecisionRow): string {
  const candidate = parseJsonObject(row.candidate_payload);
  const after = parseJsonObject(row.after_payload);
  const resolution = parseJsonObject(row.resolution_payload);

  return textField(resolution, ["artistText", "artistName", "primaryArtist", "primaryArtistName"])
    || textField(after, ["artistText", "artistName", "primaryArtist", "primaryArtistName"])
    || textField(candidate, ["artistText", "artistName", "primaryArtist", "primaryArtistName"]);
}

function getArtistSlug(row: DecisionRow): string {
  const candidate = parseJsonObject(row.candidate_payload);
  const after = parseJsonObject(row.after_payload);
  const resolution = parseJsonObject(row.resolution_payload);

  return textField(resolution, ["artistSlug", "primaryArtistSlug"])
    || textField(after, ["artistSlug", "primaryArtistSlug"])
    || textField(candidate, ["artistSlug", "primaryArtistSlug"]);
}

async function assertRequiredTables(pool: ReturnType<typeof createRegistryPool>): Promise<void> {
  const required = [
    "registry_review_items",
    "registry_canonicalization_decisions",
    "registry_artists",
    "registry_release_artists",
    "registry_track_artists",
  ];

  for (const table of required) {
    if (!(await hasTable(pool, `public.${table}`))) {
      throw new Error(`Required table missing: public.${table}`);
    }
  }
}

async function loadDecisions(pool: ReturnType<typeof createRegistryPool>): Promise<DecisionRow[]> {
  const result = await pool.query(
    `
    select
      d.id::text as decision_id,
      d.decision_type,
      d.status as decision_status,
      d.decision_notes,
      d.created_at::text as decision_created_at,
      d.review_item_id::text,
      ri.status as review_status,
      ri.review_type,
      ri.review_key,
      ri.entity_type as item_entity_type,
      ri.entity_id::text as item_entity_id,
      ri.source_table,
      ri.source_id,
      ri.source_payload,
      ri.candidate_payload,
      ri.resolution_payload,
      d.after_payload
    from public.registry_canonicalization_decisions d
    left join public.registry_review_items ri on ri.id = d.review_item_id
    order by d.created_at desc
    limit $1
    `,
    [limit],
  );

  return result.rows as DecisionRow[];
}

async function findArtist(pool: ReturnType<typeof createRegistryPool>, artistSlug: string, artistText: string): Promise<{ match: ArtistMatch | null; count: number; reason: string }> {
  if (artistSlug) {
    const bySlug = await pool.query(
      `
      select id::text, slug, coalesce(display_name, normalized_name, slug) as name
      from public.registry_artists
      where coalesce(status, 'active') not in ('archived', 'deleted', 'trash')
        and (slug = $1 or slug = regexp_replace(lower($1), '[^a-z0-9]+', '-', 'g'))
      order by updated_at desc nulls last
      limit 5
      `,
      [artistSlug],
    );

    if (bySlug.rowCount === 1) return { match: bySlug.rows[0] as ArtistMatch, count: 1, reason: "artist_slug_unique_match" };
    if (bySlug.rowCount && bySlug.rowCount > 1) return { match: null, count: bySlug.rowCount, reason: "artist_slug_multiple_matches" };
  }

  if (!artistText) return { match: null, count: 0, reason: "missing_artist_candidate" };
  if (multiArtistPattern.test(artistText)) return { match: null, count: 0, reason: "artist_text_contains_multiple_credits" };

  const normalized = normalizeText(artistText);
  const byName = await pool.query(
    `
    select id::text, slug, coalesce(display_name, normalized_name, slug) as name
    from public.registry_artists
    where coalesce(status, 'active') not in ('archived', 'deleted', 'trash')
      and lower(coalesce(display_name, normalized_name, slug)) = lower($1)
    order by updated_at desc nulls last
    limit 5
    `,
    [artistText],
  );

  if (byName.rowCount === 1) return { match: byName.rows[0] as ArtistMatch, count: 1, reason: "artist_name_unique_exact_match" };
  if (byName.rowCount && byName.rowCount > 1) return { match: null, count: byName.rowCount, reason: "artist_name_multiple_exact_matches" };

  const byNormalized = await pool.query(
    `
    select id::text, slug, coalesce(display_name, normalized_name, slug) as name
    from public.registry_artists
    where coalesce(status, 'active') not in ('archived', 'deleted', 'trash')
      and regexp_replace(lower(coalesce(display_name, normalized_name, slug)), '[^a-z0-9]+', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]+', '', 'g')
    order by updated_at desc nulls last
    limit 5
    `,
    [normalized],
  );

  if (byNormalized.rowCount === 1) return { match: byNormalized.rows[0] as ArtistMatch, count: 1, reason: "artist_name_unique_normalized_match" };
  if (byNormalized.rowCount && byNormalized.rowCount > 1) return { match: null, count: byNormalized.rowCount, reason: "artist_name_multiple_normalized_matches" };

  return { match: null, count: 0, reason: "no_artist_match" };
}

async function relationshipAlreadyExists(pool: ReturnType<typeof createRegistryPool>, row: PlanRow): Promise<boolean> {
  if (!row.artist_id || !row.entity_id || !row.intended_table) return false;

  if (row.intended_table === "registry_release_artists") {
    const exists = await pool.query(
      `select 1 from public.registry_release_artists where release_id = $1 and artist_id = $2 limit 1`,
      [row.entity_id, row.artist_id],
    );
    return Boolean(exists.rowCount);
  }

  if (row.intended_table === "registry_track_artists") {
    const exists = await pool.query(
      `select 1 from public.registry_track_artists where track_id = $1 and artist_id = $2 limit 1`,
      [row.entity_id, row.artist_id],
    );
    return Boolean(exists.rowCount);
  }

  return false;
}

async function buildPlan(pool: ReturnType<typeof createRegistryPool>, decisions: DecisionRow[]): Promise<PlanRow[]> {
  const plan: PlanRow[] = [];

  for (const decision of decisions) {
    const entityType = decision.item_entity_type || "unknown";
    const artistText = getArtistText(decision);
    const artistSlug = getArtistSlug(decision);

    const base = {
      decision_id: decision.decision_id,
      decision_type: decision.decision_type,
      review_item_id: decision.review_item_id,
      entity_type: entityType,
      entity_id: decision.item_entity_id,
      review_type: decision.review_type,
      intended_table: null,
      artist_id: null,
      artist_slug: null,
      artist_name: null,
      artist_text: artistText,
      artist_slug_candidate: artistSlug,
      role: null,
      is_primary: null,
      is_featured: null,
    } satisfies Omit<PlanRow, "status" | "reason">;

    if (!allowedDecisionTypes.has(decision.decision_type)) {
      plan.push({ ...base, status: "blocked", reason: "unknown_decision_type" });
      continue;
    }

    if (!decision.review_item_id) {
      plan.push({ ...base, status: "blocked", reason: "missing_review_item_link" });
      continue;
    }

    if (decision.review_status !== "resolved") {
      plan.push({ ...base, status: "blocked", reason: "review_item_not_resolved" });
      continue;
    }

    if (decision.decision_status !== "recorded") {
      plan.push({ ...base, status: "blocked", reason: "decision_not_recorded" });
      continue;
    }

    if (nonActionableDecisionTypes.has(decision.decision_type)) {
      plan.push({ ...base, status: "non_actionable", reason: decision.decision_type });
      continue;
    }

    if (decision.decision_type === "approve_featured_artist_split") {
      plan.push({ ...base, status: "blocked", reason: "featured_artist_split_requires_structured_resolution_payload" });
      continue;
    }

    if (decision.decision_type !== "approve_primary_artist") {
      plan.push({ ...base, status: "blocked", reason: "decision_type_not_supported_by_phase3a" });
      continue;
    }

    const intendedTable = entityType === "release"
      ? "registry_release_artists"
      : entityType === "track"
        ? "registry_track_artists"
        : null;

    if (!intendedTable) {
      plan.push({ ...base, status: "blocked", reason: "unsupported_entity_type_for_artist_relationship" });
      continue;
    }

    if (!decision.item_entity_id) {
      plan.push({ ...base, intended_table: intendedTable, status: "blocked", reason: "missing_entity_id" });
      continue;
    }

    const artist = await findArtist(pool, artistSlug, artistText);
    if (!artist.match) {
      plan.push({ ...base, intended_table: intendedTable, status: "blocked", reason: artist.reason });
      continue;
    }

    const row: PlanRow = {
      ...base,
      intended_table: intendedTable,
      artist_id: artist.match.id,
      artist_slug: artist.match.slug,
      artist_name: artist.match.name,
      role: "primary_artist",
      is_primary: true,
      is_featured: false,
      status: "actionable",
      reason: artist.reason,
    };

    if (await relationshipAlreadyExists(pool, row)) {
      plan.push({ ...row, status: "already_exists", reason: "canonical_relationship_already_exists" });
      continue;
    }

    plan.push(row);
  }

  return plan;
}

function printSection(title: string): void {
  console.log(`\n${title}`);
  console.log("-".repeat(80));
}

function groupPlan(plan: PlanRow[]): Array<Record<string, unknown>> {
  const counts = new Map<string, number>();
  for (const row of plan) {
    const key = `${row.status}::${row.reason}::${row.intended_table || "none"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].map(([key, count]) => {
    const [status, reason, table] = key.split("::");
    return { status, reason, intended_table: table, count };
  }).sort((a, b) => Number(b.count) - Number(a.count));
}

async function main(): Promise<void> {
  if (process.argv.includes("--write")) {
    throw new Error("Phase 3A is audit-only. --write is intentionally not supported.");
  }

  const pool = createRegistryPool();

  try {
    await pool.query("select 1");
    await assertRequiredTables(pool);

    console.log("\nWAKILISHA Phase 3A Canonicalization Audit Runner");
    console.log("=".repeat(80));
    console.log("Mode: DRY RUN ONLY. No canonical tables will be modified.");
    console.log(`Decision sample limit: ${limit}`);

    const decisions = await loadDecisions(pool);
    const plan = await buildPlan(pool, decisions);

    printSection("Decision coverage");
    console.table(groupPlan(plan));

    printSection("Actionable canonical write preview");
    const actionable = plan.filter((row) => row.status === "actionable");
    console.table(actionable.slice(0, 25).map((row) => ({
      decision_id: row.decision_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      intended_table: row.intended_table,
      artist: row.artist_name,
      artist_slug: row.artist_slug,
      role: row.role,
    })));

    printSection("Blocked/non-actionable samples");
    console.table(plan.filter((row) => row.status !== "actionable").slice(0, 25).map((row) => ({
      decision_id: row.decision_id,
      decision_type: row.decision_type,
      entity_type: row.entity_type,
      review_type: row.review_type,
      status: row.status,
      reason: row.reason,
      artist_text: row.artist_text,
      artist_slug: row.artist_slug_candidate,
    })));

    printSection("Safety result");
    console.table([{ 
      decisions_scanned: decisions.length,
      actionable_writes_previewed: actionable.length,
      canonical_tables_modified: false,
      write_mode_supported: false,
    }]);

    console.log("\nPhase 3A audit complete. No writes performed.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[phase3-canonicalization-audit] Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
