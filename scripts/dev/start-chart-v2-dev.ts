import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const API_PORT = 4176;
const API_HOST = "127.0.0.1";
const API_BASE = `http://${API_HOST}:${API_PORT}`;
const PROXY_PATH = "/__wakilisha-v2-api/wp-json/wakilisha/v2";
const VITE_PORT = 5173;

const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const B = "\x1b[36m";
const RESET = "\x1b[0m";

function loadDotEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    const value = rawValue
      .trim()
      .replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

function normalizeDatabaseUrlForPg(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function log(label: string, message: string): void {
  console.log(`${B}[${label}]${RESET} ${message}`);
}
function ok(label: string, message: string): void {
  console.log(`${G}[${label}]${RESET} ${message}`);
}
function fail(label: string, message: string): void {
  console.log(`${R}[${label}]${RESET} ${message}`);
}

async function checkDbConnection(): Promise<boolean> {
  const pg = await import("pg");
  const pool = new pg.default.Pool({
    connectionString: normalizeDatabaseUrlForPg(process.env.DATABASE_URL ?? ""),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    statement_timeout: 5000,
  });
  try {
    const result = await pool.query("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

async function healthCheck(retries = 40, delayMs = 500): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API_BASE}/wp-json/wakilisha/v2/charts/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return true;
    } catch {
      // ignore while the API boots
    }
    await setTimeout(delayMs);
  }
  return false;
}

async function healthCheckWithData(retries = 10, delayMs = 500): Promise<{ ok: boolean; data: { repository?: string; counts?: Record<string, number> } }> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API_BASE}/wp-json/wakilisha/v2/charts/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: { repository?: string; counts?: Record<string, number> } };
        const data = body.data ?? {};
        const counts = data.counts ?? {};
        if (counts.programs !== undefined && counts.programs > 0) {
          return { ok: true, data };
        }
        if (data.repository === "json-local") {
          return { ok: true, data };
        }
      }
    } catch {
      // ignore
    }
    await setTimeout(delayMs);
  }
  return { ok: false, data: {} };
}

async function main(): Promise<void> {
  loadDotEnvLocal();
  console.log("\n  WAKILISHA Chart V2 Dev Environment\n");
  console.log("  " + "=".repeat(50) + "\n");

  // [1/5] Check DATABASE_URL
  log("1/5", "Checking DATABASE_URL...");
  if (!process.env.DATABASE_URL) {
    fail("FAIL", "DATABASE_URL is not set.");
    console.log(`
   Create .env.local with:
   DATABASE_URL=postgresql://...
   WAKILISHA_V2_REPOSITORY_MODE=database
   WAKILISHA_V2_API_PORT=4176

   Or run without database:
   WAKILISHA_V2_REPOSITORY_MODE=json npm run dev:v2
 `);
    process.exit(1);
  }
  ok("OK", "DATABASE_URL present");

  // [2/5] Check database connection
  log("2/5", "Testing database connection...");
  const dbConnected = await checkDbConnection();
  if (!dbConnected) {
    fail("FAIL", "Cannot connect to database.");
    console.log(`
   Check your DATABASE_URL and network access.
   Supabase connection requires SSL (rejectUnauthorized: false).
   If using a local Postgres, remove the ssl parameter from the connection.
 `);
    process.exit(1);
  }
  ok("OK", "Database connection established");

  // [3/5] Start API
  log("3/5", `Starting V2 API on port ${API_PORT}...`);
  const apiEnv = {
    ...process.env,
    WAKILISHA_V2_REPOSITORY_MODE: "database",
    WAKILISHA_V2_API_PORT: String(API_PORT),
    NODE_ENV: "development",
  };

  const apiProc = spawn("tsx", ["scripts/charts/serve-v2-api.ts"], {
    env: apiEnv,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  apiProc.stdout?.on("data", (data: Buffer) => {
    const text = data.toString().trim();
    if (text.includes("listening") || text.includes("Listening")) {
      ok("API", text);
    } else {
      console.log(`${Y}[API]${RESET} ${text}`);
    }
  });
  apiProc.stderr?.on("data", (data: Buffer) => {
    const text = data.toString().trim();
    if (text.includes("SSL") || text.includes("certificate")) {
      console.error(`${Y}[API SSL]${RESET} ${text}`);
      console.error(`${Y}[NOTE]${RESET} This is a non-blocking warning for Supabase SSL. The API should still work.`);
    } else {
      console.error(`${R}[API stderr]${RESET} ${text}`);
    }
  });

  apiProc.on("error", (err: Error) => {
    fail("API", `Failed to start: ${err.message}`);
    process.exit(1);
  });

  apiProc.on("exit", (code: number | null) => {
    if (code !== null && code !== 0 && code !== 143) {
      fail("API", `Exited with code ${code}`);
      process.exit(1);
    }
  });

  // [4/5] Health check with data validation
  log("4/5", "Waiting for API health check...");
  const { ok: healthy, data } = await healthCheckWithData();
  if (!healthy) {
    fail("FAIL", "API health check failed or returned empty data. The API may have crashed.");
    apiProc.kill();
    process.exit(1);
  }

  ok("OK", "Health check passed with data");
  const counts = data.counts ?? {};
  console.log(`  repository: ${data.repository ?? "unknown"}`);
  console.log(`  programs: ${counts.programs ?? "?"}`);
  console.log(`  editions: ${counts.editions ?? "?"}`);
  console.log(`  entries: ${counts.entries ?? "?"}`);

  // [5/5] Start Vite
  log("5/5", `Starting Vite dev server on port ${VITE_PORT}...`);
  const viteEnv = {
    ...process.env,
    VITE_CHARTS_PUBLIC_MODE: "wordpress",
    VITE_CHARTS_PUBLIC_API_VERSION: "v2",
    VITE_WAKILISHA_WP_V2_API_BASE: PROXY_PATH,
    NODE_ENV: "development",
  };

  const viteProc = spawn("vite", ["--host", "0.0.0.0", "--port", String(VITE_PORT)], {
    env: viteEnv,
    stdio: "inherit",
    detached: false,
  });

  viteProc.on("error", (err: Error) => {
    fail("Vite", `Failed to start: ${err.message}`);
    apiProc.kill();
    process.exit(1);
  });

  console.log("\n");
  ok("READY", "Chart V2 dev mode is running");
  console.log(`\n  ${"=".repeat(50)}\n`);
  console.log(`  Frontend:      http://localhost:${VITE_PORT}/`);
  console.log(`  Charts:        http://localhost:${VITE_PORT}/charts`);
  console.log(`  Proxy API:     http://localhost:${VITE_PORT}${PROXY_PATH}/charts/health`);
  console.log(`  Direct API:    ${API_BASE}/wp-json/wakilisha/v2/charts/health`);
  console.log(`\n  Quick test:    curl -i http://localhost:${VITE_PORT}${PROXY_PATH}/charts/health`);
  console.log(`\n  Press Ctrl+C to stop.\n`);

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    console.log(`\n${Y}[${signal}]${RESET} Shutting down...`);
    try {
      viteProc.kill("SIGTERM");
      apiProc.kill("SIGTERM");
    } catch {
      viteProc.kill();
      apiProc.kill();
    }
    setTimeout(2000).then(() => {
      try {
        viteProc.kill("SIGKILL");
        apiProc.kill("SIGKILL");
      } catch {
        // ignore
      }
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("exit", () => {
    try {
      viteProc.kill();
      apiProc.kill();
    } catch {
      // ignore
    }
  });
}

main().catch((err: Error) => {
  console.error(`${R}[FATAL]${RESET}`, err.message);
  process.exit(1);
});
