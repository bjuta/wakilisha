import { Pool } from "pg";

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

  // 2. Supabase connection via pg.Pool
  allPass =
    (await check(
      "Supabase connection via pg",
      async () => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000,
        });
        try {
          const result = await pool.query("SELECT 1 AS ok");
          return result.rows[0]?.ok === 1;
        } catch {
          return false;
        } finally {
          await pool.end();
        }
      },
      "Cannot connect to database with pg.Pool",
      "Check DATABASE_URL, network access, and SSL settings. Supabase requires ssl: { rejectUnauthorized: false }"
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
      "Run npm run dev:v2 or start the API manually: WAKILISHA_V2_REPOSITORY_MODE=database tsx scripts/charts/serve-v2-api.ts"
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
      "Start Vite dev server: npm run dev or npm run dev:v2"
    )) && allPass;

  // 5. Chart programs endpoint with real data
  allPass =
    (await check(
      "Chart programs endpoint with real data",
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
      "Check API data and database state. If json mode, ensure public/charts-data/families.json exists."
    )) && allPass;

  // 6. Chart entries endpoint with real data
  allPass =
    (await check(
      "Chart entries endpoint with real data",
      async () => {
        // First get the programs list to find a valid program
        const programsRes = await fetch(
          `http://localhost:${VITE_PORT}/__wakilisha-v2-api/wp-json/wakilisha/v2/charts`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!programsRes.ok) return false;
        const programsBody = (await programsRes.json()) as {
          data?: { programs?: { publicSlug?: string; archive?: { slug?: string }[] }[] };
        };
        const programs = programsBody.data?.programs ?? [];
        if (programs.length === 0) return false;

        const program = programs[0];
        const programSlug = program.publicSlug ?? "";
        const archive = program.archive ?? [];
        if (archive.length === 0 || !programSlug) return false;

        const editionSlug = archive[0].slug ?? "";
        if (!editionSlug) return false;

        const entriesRes = await fetch(
          `http://localhost:${VITE_PORT}/__wakilisha-v2-api/wp-json/wakilisha/v2/charts/${programSlug}/${editionSlug}/entries`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!entriesRes.ok) return false;
        const entriesBody = (await entriesRes.json()) as {
          data?: { entries?: unknown[] };
        };
        const entries = entriesBody.data?.entries ?? [];
        return entries.length > 0;
      },
      "Chart entries endpoint returned empty or error",
      "Check that chart entries exist in the database or JSON files."
    )) && allPass;

  console.log("");
  if (allPass) {
    console.log(`  ${G}All checks passed. Dev mode is ready.${RESET}\n`);
    console.log(`  Quick test command:`);
    console.log(`    curl -i http://localhost:${VITE_PORT}/__wakilisha-v2-api/wp-json/wakilisha/v2/charts/health\n`);
    process.exit(0);
  } else {
    console.log(`  ${R}Some checks failed. Fix the issues above and re-run.${RESET}\n`);
    process.exit(1);
  }
}

main();