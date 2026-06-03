import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { parse } from "csv-parse";
import pg from "pg";

const DEFAULT_IMPORT_DIR = path.join(process.cwd(), "data", "supabase-imports", "2026-05-30", "raw");
const importDir = process.env.WAKILISHA_IMPORT_DIR || DEFAULT_IMPORT_DIR;
const batchSize = Number(process.env.WAKILISHA_CONTENT_IMPORT_BATCH_SIZE || 500);

const RAW_CONTENT_FILES = [
  "wk_articles.csv",
  "wk_guides.csv",
  "wk_page_surfaces.csv",
  "wk_media_assets.csv",
  "wk_wordpress_items.csv",
  "wk_old_primary_slugs.csv",
  "wk_old_registry_rows.csv",
];

type PgPool = InstanceType<typeof pg.Pool>;

type ImportSummary = {
  tableName: string;
  filepath: string;
  columns: string[];
  rows: number;
  skipped: boolean;
  reason?: string;
};

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

function createPool(): PgPool {
  const explicitHost = process.env.PGHOST;
  const explicitUser = process.env.PGUSER;
  const explicitPassword = process.env.PGPASSWORD;
  const explicitDatabase = process.env.PGDATABASE;
  const explicitPort = Number(process.env.PGPORT || 5432);
  const databaseUrl = process.env.DATABASE_URL;

  if (explicitHost && explicitUser && explicitPassword && explicitDatabase) {
    return new pg.Pool({
      host: explicitHost,
      port: explicitPort,
      user: explicitUser,
      password: explicitPassword,
      database: explicitDatabase,
      ssl: { rejectUnauthorized: false },
      max: 4,
      connectionTimeoutMillis: 15000,
      query_timeout: 120000,
      statement_timeout: 120000,
    });
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL or explicit PG* env vars are required for raw content import.");
  }

  return new pg.Pool({
    connectionString: normalizeDatabaseUrl(databaseUrl),
    ssl: { rejectUnauthorized: false },
    max: 4,
    connectionTimeoutMillis: 15000,
    query_timeout: 120000,
    statement_timeout: 120000,
  });
}

function tableNameForFile(filename: string): string {
  return filename.replace(/\.csv$/i, "");
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function sanitizeColumnName(raw: string, index: number, seen: Set<string>): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || `column_${index + 1}`;

  let candidate = base;
  let suffix = 2;
  while (seen.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  seen.add(candidate);
  return candidate;
}

async function readHeader(filepath: string): Promise<string[]> {
  const stream = fs.createReadStream(filepath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      const records = await new Promise<string[][]>((resolve, reject) => {
        parse(line, { relax_quotes: true }, (err, rows: string[][]) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      return records[0] ?? [];
    }
  } finally {
    rl.close();
    stream.destroy();
  }
  return [];
}

async function createRawTable(pool: PgPool, tableName: string, columns: string[]): Promise<void> {
  if (!columns.length) throw new Error(`Cannot create wakilisha_raw.${tableName}: no CSV columns found.`);
  const columnSql = columns.map((column) => `${quoteIdent(column)} text`).join(",\n  ");
  await pool.query("create schema if not exists wakilisha_raw");
  await pool.query(`drop table if exists wakilisha_raw.${quoteIdent(tableName)}`);
  await pool.query(`create table wakilisha_raw.${quoteIdent(tableName)} (\n  ${columnSql}\n)`);
}

async function insertBatch(pool: PgPool, tableName: string, columns: string[], rows: Record<string, string>[]): Promise<void> {
  if (!rows.length) return;

  const values: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  for (const row of rows) {
    const placeholders: string[] = [];
    for (const column of columns) {
      placeholders.push(`$${paramIndex}`);
      params.push(row[column] ?? null);
      paramIndex += 1;
    }
    values.push(`(${placeholders.join(", ")})`);
  }

  await pool.query(
    `insert into wakilisha_raw.${quoteIdent(tableName)} (${columns.map(quoteIdent).join(", ")}) values ${values.join(", ")}`,
    params
  );
}

async function importCsv(pool: PgPool, filename: string): Promise<ImportSummary> {
  const filepath = path.join(importDir, filename);
  const tableName = tableNameForFile(filename);

  if (!fs.existsSync(filepath)) {
    return { tableName, filepath, columns: [], rows: 0, skipped: true, reason: "file_not_found" };
  }

  const rawHeader = await readHeader(filepath);
  const seen = new Set<string>();
  const columns = rawHeader.map((header, index) => sanitizeColumnName(header, index, seen));
  await createRawTable(pool, tableName, columns);

  const parser = fs.createReadStream(filepath).pipe(parse({
    columns,
    from_line: 2,
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
  }));

  let importedRows = 0;
  let batch: Record<string, string>[] = [];

  for await (const record of parser) {
    batch.push(record as Record<string, string>);
    if (batch.length >= batchSize) {
      await insertBatch(pool, tableName, columns, batch);
      importedRows += batch.length;
      batch = [];
      if (importedRows % 5000 === 0) {
        console.log(`[raw-content-import] ${tableName}: ${importedRows.toLocaleString()} rows`);
      }
    }
  }

  if (batch.length) {
    await insertBatch(pool, tableName, columns, batch);
    importedRows += batch.length;
  }

  await pool.query(`analyze wakilisha_raw.${quoteIdent(tableName)}`);
  return { tableName, filepath, columns, rows: importedRows, skipped: false };
}

async function main(): Promise<void> {
  console.log(`[raw-content-import] import dir: ${importDir}`);
  const pool = createPool();

  try {
    const ok = await pool.query("select current_database() as database, current_user as user, now() as now");
    console.log("[raw-content-import] database:", ok.rows[0]);

    const summaries: ImportSummary[] = [];
    for (const filename of RAW_CONTENT_FILES) {
      console.log(`[raw-content-import] importing ${filename}`);
      const summary = await importCsv(pool, filename);
      summaries.push(summary);
      if (summary.skipped) {
        console.warn(`[raw-content-import] skipped ${summary.tableName}: ${summary.reason}`);
      } else {
        console.log(`[raw-content-import] ${summary.tableName}: ${summary.rows.toLocaleString()} rows, ${summary.columns.length} columns`);
      }
    }

    console.table(summaries.map((summary) => ({
      table: `wakilisha_raw.${summary.tableName}`,
      rows: summary.rows,
      columns: summary.columns.length,
      skipped: summary.skipped,
      reason: summary.reason ?? "",
    })));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[raw-content-import] failed:", err);
  process.exit(1);
});
