import { createRegistryPool, hasTable } from "./phase1-db";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const writeMode = hasFlag("write");

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    console.log("\nWAKILISHA Phase 4B Release Shell Public Read Policy");
    console.log("=".repeat(80));
    console.log(`Mode: ${writeMode ? "WRITE" : "DRY RUN ONLY"}`);

    if (!(await hasTable(pool, "public.registry_release_shells"))) {
      throw new Error("Required table missing: public.registry_release_shells");
    }

    if (!writeMode) {
      console.log("\nPlanned policy changes");
      console.log("-".repeat(80));
      console.log("Grant SELECT on public.registry_release_shells to anon.");
      console.log("Create anon RLS policy allowing public reads only where status = 'ready'.");
      console.log("Keep non-ready/provisional/blocked shells hidden from anonymous public pages.");
      console.log("\nSafety result");
      console.table([{ policy_modified: false, shell_rows_modified: 0, public_rendering_changed: false, write_mode_supported: true }]);
      console.log("\nDry run complete. To apply public read policy, rerun with --write.");
      return;
    }

    await pool.query(`
      grant select on public.registry_release_shells to anon;

      do $$
      begin
        if not exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'registry_release_shells'
            and policyname = 'Anon users can read ready registry release shells'
        ) then
          create policy "Anon users can read ready registry release shells"
          on public.registry_release_shells
          for select
          to anon
          using (status = 'ready');
        end if;
      end;
      $$;
    `);

    const policies = await pool.query(`
      select policyname, roles, cmd, qual
      from pg_policies
      where schemaname = 'public'
        and tablename = 'registry_release_shells'
      order by policyname
    `);

    console.log("\nApplied public release shell policies");
    console.log("-".repeat(80));
    console.table(policies.rows);

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{ policy_modified: true, shell_rows_modified: 0, public_rendering_changed: false }]);

    console.log("\nPhase 4B public policy complete.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 4B public policy failed.");
  console.error(error);
  process.exitCode = 1;
});
