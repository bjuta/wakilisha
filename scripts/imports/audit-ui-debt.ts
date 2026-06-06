import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;
type SurfaceStatus = "covered" | "partial" | "missing" | "unknown";
type DebtSeverity = "critical" | "high" | "medium" | "low" | "covered";
type TableAuditConfig = {
  tableName: string;
  domain: string;
  label: string;
  strategicValue: string;
  expectedPublicSurface?: string;
  expectedAdminSurface?: string;
  expectedApiSurface?: string;
  currentPublicStatus: SurfaceStatus;
  currentAdminStatus: SurfaceStatus;
  currentApiStatus: SurfaceStatus;
  sprintRecommendation: string;
};

type AuditItem = TableAuditConfig & {
  rowCount: number;
  severity: DebtSeverity;
  priorityScore: number;
  gapSummary: string;
};

const TABLES: TableAuditConfig[] = [
  {
    tableName: "registry_artist_relationships",
    domain: "registry_graph",
    label: "Artist relationship graph",
    strategicValue: "Rich artist-to-artist collaborator graph with shared tracks, features, scores, and discovery edges.",
    expectedPublicSurface: "Artist detail related-artists module, graph/infinite canvas, search discovery.",
    expectedAdminSurface: "Artist relationship inspector, merge/split tools, graph QA.",
    expectedApiSurface: "/repaired/artists/:slug relatedArtists plus graph endpoints.",
    currentPublicStatus: "partial",
    currentAdminStatus: "partial",
    currentApiStatus: "partial",
    sprintRecommendation: "Turn related artist data into a first-class discovery surface: relationship cards, edge reasons, graph filters, and admin QA views.",
  },
  {
    tableName: "registry_artist_genres",
    domain: "taxonomy",
    label: "Artist genre links",
    strategicValue: "Resolved artist-to-genre links powering genre pages, artist filtering, and registry clusters.",
    expectedPublicSurface: "Genre detail pages, artist cards, browse filters, infinite canvas clusters.",
    expectedAdminSurface: "Genre assignment QA and bulk correction.",
    expectedApiSurface: "/repaired/genres/:slug and artist detail genres.",
    currentPublicStatus: "partial",
    currentAdminStatus: "missing",
    currentApiStatus: "partial",
    sprintRecommendation: "Upgrade genre pages from directories into scene pages with artists, chart evidence, representative tracks, and editorial context.",
  },
  {
    tableName: "registry_entity_terms",
    domain: "taxonomy",
    label: "Registry/entity terms",
    strategicValue: "Generic taxonomy/origin/tag links across artists, tracks, labels, releases, and other entities.",
    expectedPublicSurface: "Tag/origin/collection pages and entity metadata modules.",
    expectedAdminSurface: "Entity term inspector and taxonomy normalization workbench.",
    expectedApiSurface: "Entity detail metadata and browse/filter endpoints.",
    currentPublicStatus: "missing",
    currentAdminStatus: "missing",
    currentApiStatus: "missing",
    sprintRecommendation: "Create a taxonomy-driven browse layer: origin pages, tag pages, term clouds, and admin normalization queues.",
  },
  {
    tableName: "content_item_terms",
    domain: "content_taxonomy",
    label: "Content terms",
    strategicValue: "Article/page category/tag/section links migrated from WordPress.",
    expectedPublicSurface: "Magazine categories, tags, issue/section pages, article metadata.",
    expectedAdminSurface: "Content taxonomy editor and content archive filters.",
    expectedApiSurface: "/repaired/magazine/:slug tags/categories and magazine filters.",
    currentPublicStatus: "partial",
    currentAdminStatus: "missing",
    currentApiStatus: "partial",
    sprintRecommendation: "Rebuild magazine taxonomy UX: category landing pages, tag archives, article metadata chips, and admin filters.",
  },
  {
    tableName: "wp_postmeta_field_dictionary",
    domain: "field_dictionary",
    label: "Postmeta field dictionary",
    strategicValue: "Classified custom-field keys that reveal hidden editorial, SEO, media, and registry metadata.",
    expectedPublicSurface: "Only approved fields surfaced through entity/content detail components.",
    expectedAdminSurface: "Field dictionary approval/reclassification screen.",
    expectedApiSurface: "Resolver/admin API for field policy decisions.",
    currentPublicStatus: "missing",
    currentAdminStatus: "partial",
    currentApiStatus: "missing",
    sprintRecommendation: "Build a field-policy UI to approve keys, preview affected records, and safely apply metadata to public surfaces.",
  },
  {
    tableName: "wp_postmeta_field_instances",
    domain: "field_dictionary",
    label: "Postmeta field instances",
    strategicValue: "Row-level custom-field classifications tied back to staged WordPress objects.",
    expectedPublicSurface: "No direct public surface; values flow into approved metadata modules.",
    expectedAdminSurface: "Per-key sample browser and affected-record preview.",
    expectedApiSurface: "Admin field instance query endpoints.",
    currentPublicStatus: "covered",
    currentAdminStatus: "missing",
    currentApiStatus: "missing",
    sprintRecommendation: "Add instance browser under the field dictionary so admins can inspect values before approving policies.",
  },
  {
    tableName: "wk_media_assets",
    domain: "media",
    label: "Operational media assets",
    strategicValue: "WordPress image URLs linked to entities/content with roles like hero, artist photo, artwork, logo.",
    expectedPublicSurface: "Artist photos, release artwork, label logos, article hero images, fallback reduction.",
    expectedAdminSurface: "Media library, missing image review, role assignment QA.",
    expectedApiSurface: "Detail endpoints should use role-based image lookup.",
    currentPublicStatus: "partial",
    currentAdminStatus: "covered",
    currentApiStatus: "partial",
    sprintRecommendation: "Make media role lookup canonical across all public detail/list endpoints and expose unresolved media review actions.",
  },
  {
    tableName: "entity_resolution_decisions",
    domain: "review_ops",
    label: "Resolution decisions",
    strategicValue: "Human-in-the-loop queue for artist merges, media attachments, term links, custom fields, and relationship resolution.",
    expectedPublicSurface: "No direct public surface.",
    expectedAdminSurface: "Review command center with approve/reject/merge/attach actions.",
    expectedApiSurface: "Admin mutation endpoints with audit trail.",
    currentPublicStatus: "covered",
    currentAdminStatus: "partial",
    currentApiStatus: "missing",
    sprintRecommendation: "Add guarded write endpoints and action drawers for approving, rejecting, merging, attaching, and reclassifying records.",
  },
  {
    tableName: "wk_import_review_artifacts",
    domain: "import_ops",
    label: "Import review artifacts",
    strategicValue: "Preserved migration evidence from unresolved relationships, postmeta, and source records.",
    expectedPublicSurface: "No direct public surface.",
    expectedAdminSurface: "Artifact browser with filter/search and resolver links.",
    expectedApiSurface: "Admin artifact search endpoint.",
    currentPublicStatus: "covered",
    currentAdminStatus: "partial",
    currentApiStatus: "missing",
    sprintRecommendation: "Add deep filtering, search, and one-click routing from artifact classes into specific resolver tools.",
  },
  {
    tableName: "wk_wakilisha_entities",
    domain: "legacy_registry_bridge",
    label: "Generic WAKILISHA entities",
    strategicValue: "Preservation table for imported entities not yet harmonized with canonical registry tables.",
    expectedPublicSurface: "None long-term; should be resolved into registry/content tables.",
    expectedAdminSurface: "Legacy entity bridge and unresolved entity migration view.",
    expectedApiSurface: "Admin-only bridge/resolution endpoint.",
    currentPublicStatus: "missing",
    currentAdminStatus: "missing",
    currentApiStatus: "missing",
    sprintRecommendation: "Build a legacy-entity bridge that shows which generic entities still need migration into canonical registry tables.",
  },
  {
    tableName: "wk_import_promotion_events",
    domain: "audit",
    label: "Promotion audit events",
    strategicValue: "Audit trail showing what phases promoted, resolved, or operationalized data.",
    expectedPublicSurface: "No direct public surface.",
    expectedAdminSurface: "Promotion timeline and per-run audit drilldown.",
    expectedApiSurface: "Admin audit endpoints.",
    currentPublicStatus: "covered",
    currentAdminStatus: "partial",
    currentApiStatus: "missing",
    sprintRecommendation: "Add promotion timeline filters by phase, target table, run, and affected record.",
  },
];

function normalizeDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function createPool(): Pool {
  const explicitHost = process.env.PGHOST;
  const explicitUser = process.env.PGUSER;
  const explicitPassword = process.env.PGPASSWORD;
  const explicitDatabase = process.env.PGDATABASE;
  const explicitPort = Number(process.env.PGPORT || 5432);
  if (explicitHost && explicitUser && explicitPassword && explicitDatabase) {
    return new pg.Pool({ host: explicitHost, port: explicitPort, user: explicitUser, password: explicitPassword, database: explicitDatabase, ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 15000, query_timeout: 120000, statement_timeout: 120000 });
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL or explicit PG* env vars are required.");
  return new pg.Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 15000, query_timeout: 120000, statement_timeout: 120000 });
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query("select to_regclass($1) as table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

async function tableCount(pool: Pool, tableName: string): Promise<number> {
  if (!(await tableExists(pool, tableName))) return 0;
  const result = await pool.query(`select count(*)::int as count from ${tableName}`);
  return Number(result.rows[0]?.count ?? 0);
}

function statusPenalty(status: SurfaceStatus): number {
  if (status === "missing") return 35;
  if (status === "partial") return 18;
  if (status === "unknown") return 12;
  return 0;
}

function countWeight(rowCount: number): number {
  if (rowCount >= 10000) return 30;
  if (rowCount >= 1000) return 24;
  if (rowCount >= 100) return 16;
  if (rowCount > 0) return 8;
  return 0;
}

function severityFor(score: number, rowCount: number): DebtSeverity {
  if (rowCount === 0) return "covered";
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  if (score > 0) return "low";
  return "covered";
}

function gapSummary(item: TableAuditConfig): string {
  const gaps = [
    item.currentPublicStatus !== "covered" ? `public=${item.currentPublicStatus}` : "",
    item.currentAdminStatus !== "covered" ? `admin=${item.currentAdminStatus}` : "",
    item.currentApiStatus !== "covered" ? `api=${item.currentApiStatus}` : "",
  ].filter(Boolean);
  return gaps.length ? gaps.join(" · ") : "covered";
}

function auditItem(config: TableAuditConfig, rowCount: number): AuditItem {
  const priorityScore = Math.min(100, countWeight(rowCount) + statusPenalty(config.currentPublicStatus) + statusPenalty(config.currentAdminStatus) + statusPenalty(config.currentApiStatus));
  return {
    ...config,
    rowCount,
    priorityScore,
    severity: severityFor(priorityScore, rowCount),
    gapSummary: gapSummary(config),
  };
}

async function ensureTables(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists ui_debt_audit_snapshots (
      id uuid primary key default gen_random_uuid(),
      label text not null,
      total_tables integer not null default 0,
      total_rows bigint not null default 0,
      critical_count integer not null default 0,
      high_count integer not null default 0,
      medium_count integer not null default 0,
      low_count integer not null default 0,
      covered_count integer not null default 0,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists ui_debt_audit_items (
      id uuid primary key default gen_random_uuid(),
      snapshot_id uuid references ui_debt_audit_snapshots(id) on delete cascade,
      table_name text not null,
      domain text not null,
      label text not null,
      row_count bigint not null default 0,
      severity text not null,
      priority_score integer not null default 0,
      current_public_status text not null,
      current_admin_status text not null,
      current_api_status text not null,
      expected_public_surface text,
      expected_admin_surface text,
      expected_api_surface text,
      strategic_value text,
      gap_summary text,
      sprint_recommendation text,
      status text not null default 'open',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`create index if not exists ui_debt_audit_items_snapshot_score_idx on ui_debt_audit_items(snapshot_id, priority_score desc)`);
  await pool.query(`create index if not exists ui_debt_audit_items_status_idx on ui_debt_audit_items(status, severity, priority_score desc)`);
}

async function writeSnapshot(pool: Pool, items: AuditItem[]): Promise<string> {
  const totalRows = items.reduce((sum, item) => sum + item.rowCount, 0);
  const severityCount = (severity: DebtSeverity) => items.filter((item) => item.severity === severity).length;
  const snapshot = await pool.query(`
    insert into ui_debt_audit_snapshots (label, total_tables, total_rows, critical_count, high_count, medium_count, low_count, covered_count, metadata)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    returning id::text
  `, [
    `UI debt audit ${new Date().toISOString()}`,
    items.length,
    totalRows,
    severityCount("critical"),
    severityCount("high"),
    severityCount("medium"),
    severityCount("low"),
    severityCount("covered"),
    JSON.stringify({ processor: "audit-ui-debt", version: "0.1.0" }),
  ]);
  const snapshotId = String(snapshot.rows[0].id);

  for (const item of items) {
    await pool.query(`
      insert into ui_debt_audit_items (
        snapshot_id, table_name, domain, label, row_count, severity, priority_score,
        current_public_status, current_admin_status, current_api_status,
        expected_public_surface, expected_admin_surface, expected_api_surface,
        strategic_value, gap_summary, sprint_recommendation
      ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `, [
      snapshotId,
      item.tableName,
      item.domain,
      item.label,
      item.rowCount,
      item.severity,
      item.priorityScore,
      item.currentPublicStatus,
      item.currentAdminStatus,
      item.currentApiStatus,
      item.expectedPublicSurface ?? null,
      item.expectedAdminSurface ?? null,
      item.expectedApiSurface ?? null,
      item.strategicValue,
      item.gapSummary,
      item.sprintRecommendation,
    ]);
  }

  return snapshotId;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const items: AuditItem[] = [];
    for (const config of TABLES) {
      const rowCount = await tableCount(pool, config.tableName);
      const item = auditItem(config, rowCount);
      items.push(item);
      console.log(`[ui-debt] ${item.tableName}: rows=${item.rowCount} severity=${item.severity} score=${item.priorityScore} gaps=${item.gapSummary}`);
    }
    items.sort((a, b) => b.priorityScore - a.priorityScore || b.rowCount - a.rowCount);
    if (hasFlag("--dry-run")) {
      console.log(`[ui-debt] dry-run complete: ${items.length} tables audited`);
      return;
    }
    const snapshotId = await writeSnapshot(pool, items);
    console.log(`[ui-debt] snapshot written: ${snapshotId}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[ui-debt] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
