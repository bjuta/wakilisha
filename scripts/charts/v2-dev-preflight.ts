import { spawn } from "node:child_process";

const API_PORT = 4176;
const VITE_PORT = 5173;

const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const RESET = "\x1b[0m";

function pass(label: string): void {
  console.log(`  ${G}PASS${RESET} ${label}`);
}
function fail(label: string, reason: string, fix: string): boolean {
  console.log(`  ${R}FAIL${RESET} ${label}`);
  console.log(`       Reason: ${reason}`);
  console.log(`       Fix: ${fix}`);
  return false;
}

async function check(
  label: string,
  fn: () => Promise<boolean>,
  reason: string,
  fix: string
): Promise<boolean> {
  try {
    const ok = await fn();
    if (ok) {
      pass(label);
      return true;
    }
    return fail(label, reason, fix);
  } catch (err) {
    return fail(label, err instanceof Error ? err.message : reason, fix);
  }
}

async function main(): Promise<void> {
  console.log("\n  WAKILISHA Chart V2 Dev Preflight\n");
  let allPass = true;

  // 1. DATABASE_URL
  allPass =
    (await check(
      "DATABASE_URL present",
      async () => !!process.env.DATABASE_URL,
      "DATABASE_URL is not set",
      "Create .env.local with DATABASE_URL=postgresql://..."
    )) && allPass;

  if (!process.env.DATABASE_URL) {
    console.log(
      `\n  ${R}Preflight failed. Create .env.local with:${RESET}\n  DATABASE_URL=postgresql://...\n  WAKILISHA_V2_REPOSITORY_MODE=database\n  WAKILISHA_V2_API_PORT=4176\n`
    );
    process.exit(1);
  }

  // 2. Supabase connection
  allPass =
    (await check(
      "Supabase connection",
      async () => {
        const proc = spawn("psql", [process.env.DATABASE_URL!, "-c", "SELECT 1;"], {
          stdio: "pipe",
        });
        return new Promise((resolve) => {
          proc.on("close", (code: number | null) => resolve(code === 0));
          setTimeout(() => {
            proc.kill();
            resolve(false);
          }, 5000);
        });
      },
      "Cannot connect to database with psql",
      "Check DATABASE_URL and network access"
    )) && allPass;

  // 3. API direct health
  allPass =
    (await check(
      "API health direct",
      async () => {
        const res = await fetch(
          `http://127.0.0.1:${API_PORT}/wp-json/wakilisha/v2/charts/health`,
          { signal: AbortSignal.timeout(5000) }
        );
        return res.ok;
      },
      "API server not responding on port 4176",
      "Run npm run dev:v2 or start the API manually"
    )) && allPass;

  // 4. Vite proxy health
  allPass =
    (await check(
      "Vite proxy health",
      async () => {
        const res = await fetch(
          `http://localhost:${VITE_PORT}/__wakilisha-v2-api/wp-json/wakilisha/v2/charts/health`,
          { signal: AbortSignal.timeout(5000) }
        );
        return res.ok;
      },
      "Vite proxy not responding",
      "Start Vite dev server (npm run dev or npm run dev:v2)"
    )) && allPass;

  // 5. Chart programs endpoint
  allPass =
    (await check(
      "Chart programs endpoint",
      async () => {
        const res = await fetch(
          `http://localhost:${VITE_PORT}/__wakilisha-v2-api/wp-json/wakilisha/v2/charts`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return false;
        const body = (await res.json()) as {
          data?: { programs?: unknown[] };
        };
        const data = body.data ?? {};
        const programs = data.programs ?? [];
        return programs.length > 0;
      },
      "Chart programs endpoint returned empty or error",
      "Check API data and database state"
    )) && allPass;

  console.log("");
  if (allPass) {
    console.log(`  ${G}All checks passed. Dev mode is ready.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`  ${R}Some checks failed. Fix the issues above and re-run.${RESET}\n`);
    process.exit(1);
  }
}

main();