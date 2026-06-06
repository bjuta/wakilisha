/**
 * stage-wordpress-database-records.ts
 *
 * Reads WordPress MySQL tables (wp_posts + wp_wkcharts_* plugin tables) and
 * writes structured staging records into Supabase (wk_import_staging_records).
 *
 * USAGE (on the WordPress server):
 *   DATABASE_URL="postgresql://..." \
 *   WP_DB_HOST=127.0.0.1 WP_DB_PORT=3306 WP_DB_USER=bn_wordpress \
 *   WP_DB_PASSWORD=... WP_DB_NAME=bitnami_wordpress WP_DB_PREFIX=wp_ \
 *   npx tsx scripts/imports/stage-wordpress-database-records.ts --job <RUN_ID>
 */

import mysql from "mysql2/promise";
import pg from "pg";
import {
  canonicalKindForWordPressPostType,
  isAllowedPostType,
  shouldReadyPostType,
  targetEntityForWordPressPostType,
  wakilishaCptEntry,
  WAKILISHA_PLUGIN_RELATIONSHIP_TABLES,
  WAKILISHA_PLUGIN_TABLE_MAP,
  WAKILISHA_PLUGIN_TAXONOMIES,
} from "./wakilisha-cpt-map";

type PgPool = InstanceType<typeof pg.Pool>;

type StageRecord = {
  ingestion_run_id: string;
  source_kind: string;
  source_file: string;
  source_entity: string;
  source_record_id: string | null;
  source_slug: string | null;
  target_entity: string;
  target_status: "ready" | "needs_review" | "blocked";
  target_slug: string | null;
  title: string | null;
  body: string | null;
  excerpt: string | null;
  published_at: string | null;
  author_name: string | null;
  source_url: string | null;
  raw_record: Record<string, unknown>;
  mapped_record: Record<string, unknown>;
  mapping_candidate_ids: string[];
  warnings: string[];
  errors: string[];
};

const BATCH_SIZE = Number(process.env.WAKILISHA_IMPORT_STAGE_BATCH_SIZE ?? 500);

// ── CLI helpers ─────────────────────────────────────────────────────────────

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function required(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}
function normalizeDatabaseUrl(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}
function pgPool(): PgPool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  return new pg.Pool({
    connectionString: normalizeDatabaseUrl(databaseUrl),
    ssl: { rejectUnauthorized: false },
    max: 4,
  });
}
function wpConfig() {
  return {
    host: required(arg("--host") ?? process.env.WP_DB_HOST, "WP_DB_HOST or --host"),
    port: Number(arg("--port") ?? process.env.WP_DB_PORT ?? 3306),
    user: required(arg("--user") ?? process.env.WP_DB_USER, "WP_DB_USER or --user"),
    password: required(arg("--password") ?? process.env.WP_DB_PASSWORD, "WP_DB_PASSWORD or --password"),
    database: required(arg("--database") ?? process.env.WP_DB_NAME, "WP_DB_NAME or --database"),
    prefix: arg("--prefix") ?? process.env.WP_DB_PREFIX ?? "wp_",
  };
}

// ── String helpers ──────────────────────────────────────────────────────────

function table(prefix: string, name: string) {
  return `\`${prefix}${name}\``;
}
function clean(value: unknown) {
  return String(value ?? "").trim();
}
function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}
function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ── Supabase helpers ────────────────────────────────────────────────────────

async function clearPrior(pool: PgPool, id: string) {
  await pool.query("delete from wk_import_staging_records where ingestion_run_id=$1", [id]);
  await pool.query("delete from wk_import_staging_failures where ingestion_run_id=$1", [id]);
}

async function insertBatch(pool: PgPool, rows: StageRecord[]) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values: unknown[] = [];
    const params = batch
      .map((r, idx) => {
        const base = idx * 20;
        values.push(
          r.ingestion_run_id,
          r.source_kind,
          r.source_file,
          r.source_entity,
          r.source_record_id,
          r.source_slug,
          r.target_entity,
          r.target_status,
          r.target_slug,
          r.title,
          r.body,
          r.excerpt,
          r.published_at,
          r.author_name,
          r.source_url,
          JSON.stringify(r.raw_record),
          JSON.stringify(r.mapped_record),
          r.mapping_candidate_ids,
          r.warnings,
          r.errors,
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15},$${base + 16}::jsonb,$${base + 17}::jsonb,$${base + 18},$${base + 19},$${base + 20})`;
      })
      .join(",");
    if (params) {
      await pool.query(
        `insert into wk_import_staging_records (ingestion_run_id, source_kind, source_file, source_entity, source_record_id, source_slug, target_entity, target_status, target_slug, title, body, excerpt, published_at, author_name, source_url, raw_record, mapped_record, mapping_candidate_ids, warnings, errors) values ${params}`,
        values,
      );
    }
  }
}

// ── wp_posts mapping ────────────────────────────────────────────────────────

function mapPost(runId: string, row: Record<string, unknown>): StageRecord {
  const type = clean(row.post_type) || "post";
  const title = clean(row.post_title);
  const slug = clean(row.post_name) || slugify(title || clean(row.ID) || "untitled");
  const status = clean(row.post_status);
  const isAttachment = type === "attachment";
  const entry = wakilishaCptEntry(type);
  const allowed = isAllowedPostType(type);
  const target = targetEntityForWordPressPostType(type);
  const ready = isAttachment ? false : shouldReadyPostType(type, status, title);
  const needsReview = title || entry || isAttachment;

  // Unknown post types → quarantined, not dumped as content_entities
  const blocked = !allowed && !entry;

  const warnings: string[] = [];
  if (blocked) {
    warnings.push(`Unknown post_type "${type}" quarantined as ignored_post_types. ${clean(row.ID)} rows; not mapping to content_entities.`);
  } else if (entry && !ready) {
    warnings.push(`WAKILISHA CPT ${type} mapped to ${target}; review metadata/relationships before finalization.`);
  } else if (!ready && isAttachment) {
    warnings.push("Attachment staged as media asset; file copy policy required before finalization.");
  } else if (!ready && title) {
    warnings.push(`Post type/status requires review before finalization: ${type}/${status}`);
  }

  return {
    ingestion_run_id: runId,
    source_kind: "wordpress_database",
    source_file: "mysql.wp_posts",
    source_entity: `mysql.${type}`,
    source_record_id: clean(row.ID) || null,
    source_slug: clean(row.post_name) || null,
    target_entity: target,
    target_status: blocked
      ? "blocked"
      : isAttachment
        ? clean(row.guid)
          ? "needs_review"
          : "blocked"
        : ready
          ? "ready"
          : needsReview
            ? "needs_review"
            : "blocked",
    target_slug: slug || null,
    title:
      title || clean(row.guid).split("/").pop() || null,
    body: clean(row.post_content) || null,
    excerpt: clean(row.post_excerpt) || null,
    published_at: parseDate(clean(row.post_date_gmt) || clean(row.post_date)),
    author_name: null,
    source_url: clean(row.guid) || null,
    raw_record: row,
    mapped_record: {
      post_type: type,
      canonical_kind: canonicalKindForWordPressPostType(type),
      wakilisha_cpt: Boolean(entry),
      allowed_post_type: allowed,
      status,
      slug,
      mime_type: clean(row.post_mime_type) || null,
    },
    mapping_candidate_ids: [
      blocked
        ? "quarantined-post-type"
        : entry
          ? `wakilisha-cpt-${type}`
          : isAttachment
            ? "mysql-attachments"
            : "mysql-posts",
    ],
    warnings,
    errors: title || isAttachment ? [] : ["Missing title"],
  };
}

// ── Plugin table mapping ────────────────────────────────────────────────────

function mapPluginTableRow(
  runId: string,
  row: Record<string, unknown>,
  config: typeof WAKILISHA_PLUGIN_TABLE_MAP[number],
): StageRecord {
  const id = clean(row[config.id_column]);
  const title = config.title_column ? clean(row[config.title_column]) || null : null;
  const slug = config.slug_column
    ? clean(row[config.slug_column]) || (title ? slugify(title) : slugify(id || "untitled"))
    : title
      ? slugify(title)
      : slugify(id || "untitled");
  const status = config.status_column ? clean(row[config.status_column]) || "publish" : "publish";
  const isPublished = ["publish", "published", "active", "1", "true"].includes(status.toLowerCase());

  let targetStatus: StageRecord["target_status"];
  switch (config.ready_policy) {
    case "always_ready":
      targetStatus = "ready";
      break;
    case "published_only":
      targetStatus = isPublished ? "ready" : "needs_review";
      break;
    case "needs_review":
      targetStatus = "needs_review";
      break;
    default:
      targetStatus = "needs_review";
  }

  return {
    ingestion_run_id: runId,
    source_kind: "wordpress_database",
    source_file: `mysql.wp_${config.table}`,
    source_entity: `mysql.${config.table}`,
    source_record_id: id || null,
    source_slug: slug,
    target_entity: config.target_entity,
    target_status: id ? targetStatus : "blocked",
    target_slug: slug,
    title:
      title ||
      (config.target_entity === "chart_entries"
        ? `Entry ${id}`
        : `${config.target_entity}-${id}`),
    body: config.body_column ? clean(row[config.body_column]) || null : null,
    excerpt: config.excerpt_column ? clean(row[config.excerpt_column]) || null : null,
    published_at: config.date_column ? parseDate(clean(row[config.date_column])) : null,
    author_name: config.author_column ? clean(row[config.author_column]) || null : null,
    source_url: config.url_column ? clean(row[config.url_column]) || null : null,
    raw_record: row,
    mapped_record: extraColumns(row, config.extra_columns),
    mapping_candidate_ids: [`wakilisha-plugin-${config.table}`],
    warnings: [],
    errors: id ? [] : [`Missing ${config.id_column} for ${config.table}`],
  };
}

function extraColumns(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (col in row) out[col] = row[col];
  }
  return out;
}

// ── Relationship mapping ────────────────────────────────────────────────────

function mapRelationshipRow(
  runId: string,
  row: Record<string, unknown>,
  rel: typeof WAKILISHA_PLUGIN_RELATIONSHIP_TABLES[number],
): StageRecord {
  const id = clean(row[rel.id_column]);
  const sourceId = clean(row[rel.source_column]);
  const targetId = clean(row[rel.target_column]);
  const title = `${rel.source_entity}-${sourceId}-${targetId}`;

  return {
    ingestion_run_id: runId,
    source_kind: "wordpress_database",
    source_file: `mysql.wp_${rel.table}`,
    source_entity: rel.source_entity,
    source_record_id: id || null,
    source_slug: null,
    target_entity: rel.target_entity,
    target_status: id && sourceId && targetId ? "ready" : "needs_review",
    target_slug: slugify(title),
    title,
    body: null,
    excerpt: null,
    published_at: null,
    author_name: null,
    source_url: null,
    raw_record: row,
    mapped_record: extraColumns(row, rel.extra_columns),
    mapping_candidate_ids: [`wakilisha-plugin-${rel.table}`],
    warnings: [],
    errors:
      !id || !sourceId || !targetId
        ? [`Missing required column(s) in ${rel.table}`]
        : [],
  };
}

// ── Users / Authors ─────────────────────────────────────────────────────────
// Authors must only be users who authored actual published editorial content,
// NOT every single row in wp_users.

async function mapEditorialAuthors(
  runId: string,
  wp: mysql.Connection,
  prefix: string,
): Promise<StageRecord[]> {
  const [rows] = await wp.query(`
    SELECT DISTINCT u.ID, u.user_login, u.user_nicename, u.user_email, u.user_url, u.display_name
    FROM \`${prefix}users\` u
    JOIN \`${prefix}posts\` p ON p.post_author = u.ID
    WHERE p.post_status = 'publish'
      AND p.post_type IN (
        'post','page','wk_field_guide','wk_methodology',
        'wk_chart_series','wk_chart_edition','wakilisha_artist'
      )
  `);

  return (rows as Record<string, unknown>[]).map((r) => mapEditorialUser(runId, r));
}

function mapEditorialUser(runId: string, row: Record<string, unknown>): StageRecord {
  const name = clean(row.display_name) || clean(row.user_login);
  const slug = slugify(clean(row.user_nicename) || clean(row.user_login) || name || clean(row.ID));
  return {
    ingestion_run_id: runId,
    source_kind: "wordpress_database",
    source_file: "mysql.wp_users",
    source_entity: "mysql.users",
    source_record_id: clean(row.ID) || null,
    source_slug: slug,
    target_entity: "authors",
    target_status: name ? "ready" : "blocked",
    target_slug: slug,
    title: name || null,
    body: null,
    excerpt: null,
    published_at: null,
    author_name: name || null,
    source_url: clean(row.user_url) || null,
    raw_record: row,
    mapped_record: {
      email: clean(row.user_email) || null,
      url: clean(row.user_url) || null,
      editorial_author: true,
    },
    mapping_candidate_ids: ["mysql-users-editorial"],
    warnings: clean(row.user_email)
      ? ["Author email staged in mapped_record only; review privacy before public use."]
      : [],
    errors: name ? [] : ["Missing author name"],
  };
}

// ── Terms mapping ───────────────────────────────────────────────────────────

function mapTerm(runId: string, row: Record<string, unknown>): StageRecord {
  const name = clean(row.name);
  const taxonomy = clean(row.taxonomy) || "term";
  const slug = clean(row.slug) || slugify(name || clean(row.term_id));
  const isWakilishaTax = WAKILISHA_PLUGIN_TAXONOMIES.includes(taxonomy);
  return {
    ingestion_run_id: runId,
    source_kind: "wordpress_database",
    source_file: "mysql.wp_terms",
    source_entity: `mysql.${taxonomy}`,
    source_record_id: clean(row.term_id) || null,
    source_slug: slug,
    target_entity: isWakilishaTax ? "artist_taxonomy_terms" : "taxonomy_terms",
    target_status: name ? "ready" : "blocked",
    target_slug: slug,
    title: name || null,
    body: clean(row.description) || null,
    excerpt: null,
    published_at: null,
    author_name: null,
    source_url: null,
    raw_record: row,
    mapped_record: {
      taxonomy,
      slug,
      parent: row.parent ?? null,
      count: row.count ?? null,
      wakilisha_taxonomy: isWakilishaTax,
    },
    mapping_candidate_ids: [isWakilishaTax ? `wakilisha-tax-${taxonomy}` : "mysql-terms"],
    warnings: [],
    errors: name ? [] : ["Missing term name"],
  };
}

// ── Generic fallback mapping (relationships, postmeta) ──────────────────────

function mapGeneric(
  runId: string,
  file: string,
  entity: string,
  target: string,
  row: Record<string, unknown>,
  ids: string[],
): StageRecord {
  const id =
    clean(row.meta_id) ||
    clean(row.object_id) ||
    clean(row.term_taxonomy_id) ||
    clean(row.ID) ||
    clean(row.id);
  const title = clean(row.meta_key) || clean(row.relationship_type) || `${entity}-${id}`;
  return {
    ingestion_run_id: runId,
    source_kind: "wordpress_database",
    source_file: file,
    source_entity: entity,
    source_record_id: id || null,
    source_slug: null,
    target_entity: target,
    target_status: "needs_review",
    target_slug: id ? slugify(`${entity}-${id}`) : null,
    title,
    body: clean(row.meta_value) || null,
    excerpt: null,
    published_at: null,
    author_name: null,
    source_url: null,
    raw_record: row,
    mapped_record: row,
    mapping_candidate_ids: ids,
    warnings: ["Staged for review; requires resolver before finalization."],
    errors: [],
  };
}

// ── Main staging pipeline ───────────────────────────────────────────────────

async function stage(
  pool: PgPool,
  wp: mysql.Connection,
  config: ReturnType<typeof wpConfig>,
  runId: string,
) {
  await pool.query(
    "update wk_ingestion_runs set status='staging', errors='' where id=$1",
    [runId],
  );
  await clearPrior(pool, runId);

  const records: StageRecord[] = [];
  const ignoredPostTypeCounts: Record<string, number> = {};

  // ── 1. wp_posts (allow-listed types only) ─────────────────────────────────
  {
    const [postRows] = await wp.query(
      `select ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, post_name, post_type, post_mime_type, guid from ${table(config.prefix, "posts")} where post_type not in ('revision','nav_menu_item')`,
    );

    for (const r of postRows as Record<string, unknown>[]) {
      const row = r as Record<string, unknown>;
      const type = clean(row.post_type);
      // Track ignored post types for reporting
      if (!isAllowedPostType(type) && !wakilishaCptEntry(type)) {
        ignoredPostTypeCounts[type] = (ignoredPostTypeCounts[type] ?? 0) + 1;
      }
      records.push(mapPost(runId, r as Record<string, unknown>));
    }
  }

  // ── 2. Editorial authors (not all wp_users) ───────────────────────────────
  {
    const authors = await mapEditorialAuthors(runId, wp, config.prefix);
    records.push(...authors);
  }

  // ── 3. Terms ──────────────────────────────────────────────────────────────
  {
    const [termRows] = await wp.query(
      `select t.term_id, t.name, t.slug, tt.term_taxonomy_id, tt.taxonomy, tt.description, tt.parent, tt.count from ${table(config.prefix, "terms")} t join ${table(config.prefix, "term_taxonomy")} tt on t.term_id = tt.term_id`,
    );
    records.push(
      ...(termRows as Record<string, unknown>[]).map((r) => mapTerm(runId, r)),
    );
  }

  // ── 4. Term relationships ─────────────────────────────────────────────────
  {
    const [relRows] = await wp.query(
      `select object_id, term_taxonomy_id, term_order from ${table(config.prefix, "term_relationships")}`,
    );
    records.push(
      ...(relRows as Record<string, unknown>[]).map((r) =>
        mapGeneric(runId, "mysql.wp_term_relationships", "mysql.relationships", "entity_relationships", r, ["mysql-relationships"]),
      ),
    );
  }

  // ── 5. Postmeta (sample) ──────────────────────────────────────────────────
  {
    const [metaRows] = await wp.query(
      `select meta_id, post_id, meta_key, meta_value from ${table(config.prefix, "postmeta")} limit ${Number(process.env.WAKILISHA_DB_POSTMETA_LIMIT ?? 20000)}`,
    );
    records.push(
      ...(metaRows as Record<string, unknown>[]).map((r) =>
        mapGeneric(runId, "mysql.wp_postmeta", "mysql.postmeta", "custom_fields", r, ["mysql-postmeta"]),
      ),
    );
  }

  // ── 6. WAKILISHA plugin tables (wp_wkcharts_*) ────────────────────────────
  for (const pt of WAKILISHA_PLUGIN_TABLE_MAP) {
    const fullTable = table(config.prefix, pt.table);
    try {
      const [rows] = await wp.query(`select * from ${fullTable}`);
      const mapped = (rows as Record<string, unknown>[]).map((r) =>
        mapPluginTableRow(runId, r, pt),
      );
      records.push(...mapped);
      console.log(
        `[wp-db-stage] plugin table ${pt.table} → ${pt.target_entity}: ${mapped.length} records`,
      );
    } catch (err) {
      console.warn(
        `[wp-db-stage] plugin table ${pt.table} skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // ── 7. WAKILISHA plugin relationship tables ──────────────────────────────
  for (const rel of WAKILISHA_PLUGIN_RELATIONSHIP_TABLES) {
    const fullTable = table(config.prefix, rel.table);
    try {
      const [rows] = await wp.query(`select * from ${fullTable}`);
      const mapped = (rows as Record<string, unknown>[]).map((r) =>
        mapRelationshipRow(runId, r, rel),
      );
      records.push(...mapped);
      console.log(
        `[wp-db-stage] relationship table ${rel.table} → ${rel.target_entity}: ${mapped.length} records`,
      );
    } catch (err) {
      console.warn(
        `[wp-db-stage] relationship table ${rel.table} skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // ── 8. Insert all records into Supabase ──────────────────────────────────
  await insertBatch(pool, records);

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.target_entity] = (acc[r.target_entity] ?? 0) + 1;
    return acc;
  }, {});

  const statusCounts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.target_status] = (acc[r.target_status] ?? 0) + 1;
    return acc;
  }, {});

  // Count ready records per target entity for clean reporting
  const readyCounts = records.reduce<Record<string, number>>((acc, r) => {
    if (r.target_status === "ready") {
      acc[r.target_entity] = (acc[r.target_entity] ?? 0) + 1;
    }
    return acc;
  }, {});

  const summary = {
    staged_at: new Date().toISOString(),
    processor: "stage-wordpress-database-records",
    version: "1.0.0",
    records: records.length,
    counts_by_target_entity: readyCounts,
    counts_by_status: statusCounts,
    postmeta_limit: Number(process.env.WAKILISHA_DB_POSTMETA_LIMIT ?? 20000),
    wakilisha_plugin_tables_staged: WAKILISHA_PLUGIN_TABLE_MAP.map((t) => t.table),
    relationship_tables_staged: WAKILISHA_PLUGIN_RELATIONSHIP_TABLES.map((t) => t.table),
    ignored_post_type_counts: ignoredPostTypeCounts,
  };

  await pool.query(
    "update wk_ingestion_runs set status='staged', source_manifest=jsonb_set(coalesce(source_manifest,''::jsonb), '{staging}', $2::jsonb, true), imported_counts=$3::jsonb, warnings=array_append(coalesce(warnings,''::text[]), 'Plugin tables (wp_wkcharts_*) staged alongside wp_posts. Unknown post types quarantined as ignored_post_types.') where id=$1",
    [runId, JSON.stringify(summary), JSON.stringify(readyCounts)],
  );

  console.log(`[wp-db-stage] ${runId}: ${records.length} total records staged`);
  console.log(`[wp-db-stage] Ready counts by entity:`, JSON.stringify(readyCounts, null, 2));
  if (Object.keys(ignoredPostTypeCounts).length > 0) {
    console.log(
      `[wp-db-stage] Ignored post types:`,
      JSON.stringify(ignoredPostTypeCounts, null, 2),
    );
  }
}

// ── Entry ───────────────────────────────────────────────────────────────────

async function main() {
  const runId = required(arg("--job"), "--job");
  const wpConf = wpConfig();
  const wp = await mysql.createConnection({
    host: wpConf.host,
    port: wpConf.port,
    user: wpConf.user,
    password: wpConf.password,
    database: wpConf.database,
    connectTimeout: 15000,
  });
  const pool = pgPool();
  try {
    await wp.ping();
    await stage(pool, wp, wpConf, runId);
  } finally {
    await wp.end();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[wp-db-stage] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});