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

function log(label: string, message: string): void {
  console.log(`${B}[${label}]${RESET} ${message}`);
}
function ok(label: string, message: string): void {
  console.log(`${G}[${label}]${RESET} ${message}`);
}
function fail(label: string, message: string): void {
  console.log(`${R}[${label}]${RESET} ${message}`);
}

async function healthCheck(retries = 30, delayMs = 500): Promise<boolean> {
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

async function main(): Promise<void> {
  loadDotEnvLocal();
  console.log("\n  WAKILISHA Chart V2 Dev\n");

  // [1/4] Check DATABASE_URL
  log("1/4", "Checking DATABASE_URL...");
  if (!process.env.DATABASE_URL) {
    fail("FAIL", "DATABASE_URL is not set.");
    console.log(`
   Create .env.local with:
   DATABASE_URL=postgresql://...
   WAKILISHA_V2_REPOSITORY_MODE=database
   WAKILISHA_V2_API_PORT=4176
 `);
    process.exit(1);
  }
  ok("OK", "DATABASE_URL present");

  // [2/4] Start API
  log("2/4", `Starting V2 API on ${API_PORT}...`);
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
    if (text.includes("listening")) {
      ok("API", text);
    }
  });
  apiProc.stderr?.on("data", (data: Buffer) => {
    console.error(`${R}[API stderr]${RESET} ${data.toString().trim()}`);
  });

  apiProc.on("error", (err: Error) => {
    fail("API", `Failed to start: ${err.message}`);
    process.exit(1);
  });

  apiProc.on("exit", (code: number | null) => {
    if (code !== null && code !== 0) {
      fail("API", `Exited with code ${code}`);
      process.exit(1);
    }
  });

  // [3/4] Health check
  log("3/4", "Waiting for API health check...");
  const healthy = await healthCheck();
  if (!healthy) {
    fail("FAIL", "API health check failed after 15s. The API may have crashed.");
    apiProc.kill();
    process.exit(1);
  }

  try {
    const res = await fetch(`${API_BASE}/wp-json/wakilisha/v2/charts/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json()) as {
      data?: {
        repository?: string;
        counts?: Record<string, number>;
      };
    };
    ok("OK", "Health check passed");
    const data = body.data ?? {};
    const counts = data.counts ?? {};
    console.log(`  repository: ${data.repository ?? "unknown"}`);
    console.log(`  programs: ${counts.programs ?? "?"}`);
    console.log(`  editions: ${counts.editions ?? "?"}`);
    console.log(`  entries: ${counts.entries ?? "?"}`);
  } catch {
    ok("OK", "Health check passed (basic)");
  }

  // [4/4] Start Vite
  log("4/4", `Starting Vite on ${VITE_PORT}...`);
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
  console.log(`\n  Frontend:    http://localhost:${VITE_PORT}/charts`);
  console.log(`  Proxy API:   http://localhost:${VITE_PORT}${PROXY_PATH}/charts/health`);
  console.log(`  Direct API:  ${API_BASE}/wp-json/wakilisha/v2/charts/health`);
  console.log(`\n  Press Ctrl+C to stop.\n`);

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    console.log(`\n${Y}[${signal}]${RESET} Shutting down...`);
    viteProc.kill();
    apiProc.kill();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("exit", () => {
    viteProc.kill();
    apiProc.kill();
  });
}

main().catch((err: Error) => {
  console.error(`${R}[FATAL]${RESET}`, err.message);
  process.exit(1);
});
