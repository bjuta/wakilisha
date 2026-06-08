import pg from "pg";

export type Row = Record<string, unknown>;

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

export function createRegistryPool(): pg.Pool {
  const explicitHost = process.env.PGHOST;
  const explicitUser = process.env.PGUSER;
  const explicitPassword = process.env.PGPASSWORD;
  const explicitDatabase = process.env.PGDATABASE;
  const explicitPort = Number(process.env.PGPORT || 5432);
  const url = process.env.DATABASE_URL;

  if (explicitHost && explicitUser && explicitPassword && explicitDatabase) {
    return new pg.Pool({
      host: explicitHost,
      port: explicitPort,
      user: explicitUser,
      password: explicitPassword,
      database: explicitDatabase,
      ssl: { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
      statement_timeout: 30000,
    });
  }

  if (!url) {
    throw new Error("DATABASE_URL or explicit PG* env vars are required.");
  }

  return new pg.Pool({
    connectionString: normalizeDatabaseUrl(url),
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
    statement_timeout: 30000,
  });
}

export async function hasTable(pool: pg.Pool, tableName: string): Promise<boolean> {
  const result = await pool.query("select to_regclass($1) as table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}
