import mysql from "mysql2/promise";
import pg from "pg";

type PgPool = InstanceType<typeof pg.Pool>;

type WordPressConnection = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  prefix: string;
};

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireValue(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

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

function createPgPool(): PgPool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to write the ingestion run.");
  return new pg.Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), ssl: { rejectUnauthorized: false }, max: 4 });
}

function getWordPressConnection(): WordPressConnection {
  return {
    host: requireValue(arg("--host") ?? process.env.WP_DB_HOST, "WP_DB_HOST or --host"),
    port: Number(arg("--port") ?? process.env.WP_DB_PORT ?? 3306),
    user: requireValue(arg("--user") ?? process.env.WP_DB_USER, "WP_DB_USER or --user"),
    password: requireValue(arg("--password") ?? process.env.WP_DB_PASSWORD, "WP_DB_PASSWORD or --password"),
    database: requireValue(arg("--database") ?? process.env.WP_DB_NAME, "WP_DB_NAME or --database"),
    prefix: arg("--prefix") ?? process.env.WP_DB_PREFIX ?? "wp_",
  };
}

function table(prefix: string, name: string) {
  return `\`${prefix}${name}\``;
}

function safeConnectionManifest(config: WordPressConnection) {
  return {
    connector: "wordpress_mysql_database",
    host: config.host,
    port: config.port,
    database: config.database,
    prefix: config.prefix,
    credential_storage: "env_or_cli_only",
    password_persisted: false,
  };
}

async function countTable(db: mysql.Connection, prefix: string, name: string) {
  const [rows] = await db.query(`select count(*) as count from ${table(prefix, name)}`);
  return Number((rows as Array<{ count: number }>)[0]?.count ?? 0);
}

async function getColumns(db: mysql.Connection, prefix: string, name: string) {
  const [rows] = await db.query(`show columns from ${table(prefix, name)}`);
  return (rows as Array<{ Field: string }>).map((row) => row.Field);
}

async function getPostTypes(db: mysql.Connection, prefix: string) {
  const [rows] = await db.query(`select post_type, post_status, count(*) as count from ${table(prefix, "posts")} group by post_type, post_status order by count desc`);
  const grouped: Record<string, number> = {};
  const statuses: Record<string, Record<string, number>> = {};
  for (const row of rows as Array<{ post_type: string; post_status: string; count: number }>) {
    grouped[row.post_type] = (grouped[row.post_type] ?? 0) + Number(row.count ?? 0);
    statuses[row.post_type] = statuses[row.post_type] ?? {};
    statuses[row.post_type][row.post_status] = Number(row.count ?? 0);
  }
  return { grouped, statuses };
}

async function scanWordPressDatabase(db: mysql.Connection, config: WordPressConnection) {
  const tables = ["posts", "postmeta", "users", "terms", "term_taxonomy", "term_relationships", "options", "comments"];
  const counts: Record<string, number> = {};
  const columns: Array<{ table: string; columns: string[] }> = [];

  for (const name of tables) {
    try {
      counts[`wp_${name}`] = await countTable(db, config.prefix, name);
      columns.push({ table: `${config.prefix}${name}`, columns: await getColumns(db, config.prefix, name) });
    } catch (error) {
      counts[`wp_${name}`] = 0;
      columns.push({ table: `${config.prefix}${name}`, columns: [], error: error instanceof Error ? error.message : String(error) } as never);
    }
  }

  const postTypes = await getPostTypes(db, config.prefix);
  return {
    scanned_at: new Date().toISOString(),
    source: "wordpress_mysql_database",
    archive: { file_count: 0, total_uncompressed_bytes: 0 },
    counts: {
      ...counts,
      post_types: Object.values(postTypes.grouped).reduce((sum, count) => sum + count, 0),
    },
    detected: ["wordpress_database", "mysql", "wp_posts", "wp_postmeta", "wp_users", "wp_terms", "wp_term_taxonomy", "wp_term_relationships"],
    files: [],
    evidence: {
      db_tables: tables.map((name) => `${config.prefix}${name}`),
      db_columns: columns,
      wxr_post_types: postTypes.grouped,
      post_type_statuses: postTypes.statuses,
      csv_headers: [],
      json_keys: [],
      sql_tables: tables.map((name) => `${config.prefix}${name}`),
    },
    warnings: ["Direct database scan completed. Credentials were not stored in the ingestion manifest."],
  };
}

async function writeRun(pool: PgPool, config: WordPressConnection, scan: Awaited<ReturnType<typeof scanWordPressDatabase>>) {
  const existingJob = arg("--job");
  const sourceManifest = {
    connection: safeConnectionManifest(config),
    scan,
    processor: {
      name: "connect-wordpress-database",
      version: "0.1.0",
      mode: "scan_only",
      updated_at: new Date().toISOString(),
    },
  };

  if (existingJob) {
    await pool.query(
      `update wk_ingestion_runs
       set source_name = $2, source_kind = 'wordpress_database', source_manifest = $3::jsonb, status = 'scanned', started_at = coalesce(started_at, now()), finished_at = now(), warnings = $4, errors = '{}'
       where id = $1`,
      [existingJob, `${config.host}/${config.database}`, JSON.stringify(sourceManifest), scan.warnings]
    );
    console.log(`[wp-db] updated ingestion run ${existingJob}`);
    return existingJob;
  }

  const result = await pool.query(
    `insert into wk_ingestion_runs (source_name, source_kind, source_manifest, status, started_at, finished_at, imported_counts, warnings, errors)
     values ($1, 'wordpress_database', $2::jsonb, 'scanned', now(), now(), null, $3, '{}')
     returning id::text`,
    [`${config.host}/${config.database}`, JSON.stringify(sourceManifest), scan.warnings]
  );
  const id = result.rows[0].id;
  console.log(`[wp-db] created scanned ingestion run ${id}`);
  return id;
}

async function main() {
  const config = getWordPressConnection();
  const wp = await mysql.createConnection({ host: config.host, port: config.port, user: config.user, password: config.password, database: config.database, connectTimeout: 15000 });
  const pool = createPgPool();
  try {
    await wp.ping();
    console.log(`[wp-db] connected to ${config.host}/${config.database}`);
    const scan = await scanWordPressDatabase(wp, config);
    await writeRun(pool, config, scan);
  } finally {
    await wp.end();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[wp-db] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
