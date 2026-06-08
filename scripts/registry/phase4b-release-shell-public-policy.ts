import { createRegistryPool, hasTable } from "./phase1-db";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const writeMode = hasFlag("write");

async function requireTable(pool: ReturnType<typeof createRegistryPool>, table: string): Promise<void> {
  if (!(await hasTable(pool, `public.${table}`))) {
    throw new Error(`Required table missing: public.${table}`);
  }
}

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    console.log("\nWAKILISHA Phase 4B/4B.2 Public Release Registry Read Policy");
    console.log("=".repeat(80));
    console.log(`Mode: ${writeMode ? "WRITE" : "DRY RUN ONLY"}`);

    await requireTable(pool, "registry_release_shells");
    await requireTable(pool, "registry_release_tracks");
    await requireTable(pool, "registry_tracks");
    await requireTable(pool, "registry_media_assets");

    if (!writeMode) {
      console.log("\nPlanned policy changes");
      console.log("-".repeat(80));
      console.log("Grant SELECT on public.registry_release_shells to anon.");
      console.log("Grant SELECT on public.registry_release_tracks to anon.");
      console.log("Grant SELECT on public.registry_tracks to anon.");
      console.log("Grant SELECT on public.registry_media_assets to anon.");
      console.log("Create anon RLS policy allowing public shell reads only where status = 'ready'.");
      console.log("Create anon RLS policy allowing release-track reads only for releases with ready public shells.");
      console.log("Create anon RLS policy allowing track reads only when linked to a release with a ready public shell.");
      console.log("Create anon RLS policy allowing active image media assets.");
      console.log("Keep non-ready/provisional/blocked shells and their tracklists hidden from anonymous public pages.");
      console.log("\nSafety result");
      console.table([{ policy_modified: false, shell_rows_modified: 0, track_rows_modified: 0, media_rows_modified: 0, public_rendering_changed: false, write_mode_supported: true }]);
      console.log("\nDry run complete. To apply public read policies, rerun with --write.");
      return;
    }

    await pool.query(`
      grant select on public.registry_release_shells to anon;
      grant select on public.registry_release_tracks to anon;
      grant select on public.registry_tracks to anon;
      grant select on public.registry_media_assets to anon;

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

        if not exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'registry_release_tracks'
            and policyname = 'Anon users can read tracks for ready registry release shells'
        ) then
          create policy "Anon users can read tracks for ready registry release shells"
          on public.registry_release_tracks
          for select
          to anon
          using (
            exists (
              select 1
              from public.registry_release_shells shells
              where shells.release_id = registry_release_tracks.release_id
                and shells.status = 'ready'
            )
          );
        end if;

        if not exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'registry_tracks'
            and policyname = 'Anon users can read tracks linked to ready registry release shells'
        ) then
          create policy "Anon users can read tracks linked to ready registry release shells"
          on public.registry_tracks
          for select
          to anon
          using (
            exists (
              select 1
              from public.registry_release_tracks rt
              join public.registry_release_shells shells on shells.release_id = rt.release_id
              where rt.track_id = registry_tracks.id
                and shells.status = 'ready'
            )
          );
        end if;

        if not exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'registry_media_assets'
            and policyname = 'Anon users can read active registry image media assets'
        ) then
          create policy "Anon users can read active registry image media assets"
          on public.registry_media_assets
          for select
          to anon
          using (status = 'active' and media_kind = 'image');
        end if;
      end;
      $$;
    `);

    const policies = await pool.query(`
      select tablename, policyname, roles, cmd, qual
      from pg_policies
      where schemaname = 'public'
        and tablename in ('registry_release_shells', 'registry_release_tracks', 'registry_tracks', 'registry_media_assets')
      order by tablename, policyname
    `);

    console.log("\nApplied public release registry policies");
    console.log("-".repeat(80));
    console.table(policies.rows);

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{ policy_modified: true, shell_rows_modified: 0, track_rows_modified: 0, media_rows_modified: 0, public_rendering_changed: false }]);

    console.log("\nPhase 4B/4B.2 public registry read policy complete.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 4B/4B.2 public registry read policy failed.");
  console.error(error);
  process.exitCode = 1;
});
