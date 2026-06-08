import { createRegistryPool, hasTable } from "./phase1-db";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const writeMode = hasFlag("write");
const baseTables = ["registry_release_shells", "registry_release_tracks", "registry_tracks", "registry_media_assets"];
const optionalTables = ["registry_release_labels", "registry_labels"];

async function requireTable(pool: ReturnType<typeof createRegistryPool>, table: string): Promise<void> {
  if (!(await hasTable(pool, `public.${table}`))) {
    throw new Error(`Required table missing: public.${table}`);
  }
}

async function existingOptionalTables(pool: ReturnType<typeof createRegistryPool>): Promise<string[]> {
  const found: string[] = [];
  for (const table of optionalTables) {
    if (await hasTable(pool, `public.${table}`)) found.push(table);
  }
  return found;
}

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    console.log("\nWAKILISHA Phase 4B/4B.3 Public Release Registry Read Policy");
    console.log("=".repeat(80));
    console.log(`Mode: ${writeMode ? "WRITE" : "DRY RUN ONLY"}`);

    for (const table of baseTables) await requireTable(pool, table);
    const labelTables = await existingOptionalTables(pool);
    const allTables = [...baseTables, ...labelTables];

    if (!writeMode) {
      console.log("\nPlanned policy changes");
      console.log("-".repeat(80));
      console.log("Grant SELECT on release-page registry tables to anon and authenticated.");
      console.log("Create public RLS policies for ready release shells, their track joins, linked tracks, active image media, and optional label data.");
      console.log(`Optional label tables detected: ${labelTables.length ? labelTables.join(", ") : "none"}`);
      console.log("Keep non-ready/provisional/blocked shells and their derived release page data hidden from public page reads.");
      console.log("\nSafety result");
      console.table([{ policy_modified: false, shell_rows_modified: 0, track_rows_modified: 0, media_rows_modified: 0, label_rows_modified: 0, public_rendering_changed: false, write_mode_supported: true }]);
      console.log("\nDry run complete. To apply public read policies, rerun with --write.");
      return;
    }

    await pool.query(`
      grant usage on schema public to anon;
      grant usage on schema public to authenticated;

      grant select on public.registry_release_shells to anon, authenticated;
      grant select on public.registry_release_tracks to anon, authenticated;
      grant select on public.registry_tracks to anon, authenticated;
      grant select on public.registry_media_assets to anon, authenticated;

      do $$
      begin
        drop policy if exists "Anon users can read ready registry release shells" on public.registry_release_shells;
        drop policy if exists "Public users can read ready registry release shells" on public.registry_release_shells;
        create policy "Public users can read ready registry release shells"
        on public.registry_release_shells
        for select
        to anon, authenticated
        using (status = 'ready');

        drop policy if exists "Anon users can read tracks for ready registry release shells" on public.registry_release_tracks;
        drop policy if exists "Public users can read tracks for ready registry release shells" on public.registry_release_tracks;
        create policy "Public users can read tracks for ready registry release shells"
        on public.registry_release_tracks
        for select
        to anon, authenticated
        using (
          exists (
            select 1
            from public.registry_release_shells shells
            where shells.release_id = registry_release_tracks.release_id
              and shells.status = 'ready'
          )
        );

        drop policy if exists "Anon users can read tracks linked to ready registry release shells" on public.registry_tracks;
        drop policy if exists "Public users can read tracks linked to ready registry release shells" on public.registry_tracks;
        create policy "Public users can read tracks linked to ready registry release shells"
        on public.registry_tracks
        for select
        to anon, authenticated
        using (
          exists (
            select 1
            from public.registry_release_tracks rt
            join public.registry_release_shells shells on shells.release_id = rt.release_id
            where rt.track_id = registry_tracks.id
              and shells.status = 'ready'
          )
        );

        drop policy if exists "Anon users can read active registry image media assets" on public.registry_media_assets;
        drop policy if exists "Public users can read active registry image media assets" on public.registry_media_assets;
        create policy "Public users can read active registry image media assets"
        on public.registry_media_assets
        for select
        to anon, authenticated
        using (status = 'active' and media_kind = 'image');
      end;
      $$;
    `);

    if (labelTables.includes("registry_release_labels")) {
      await pool.query(`
        grant select on public.registry_release_labels to anon, authenticated;
        do $$
        begin
          drop policy if exists "Public users can read labels for ready registry release shells" on public.registry_release_labels;
          create policy "Public users can read labels for ready registry release shells"
          on public.registry_release_labels
          for select
          to anon, authenticated
          using (
            exists (
              select 1
              from public.registry_release_shells shells
              where shells.release_id = registry_release_labels.release_id
                and shells.status = 'ready'
            )
          );
        end;
        $$;
      `);
    }

    if (labelTables.includes("registry_labels")) {
      await pool.query(`
        grant select on public.registry_labels to anon, authenticated;
        do $$
        begin
          drop policy if exists "Public users can read active registry labels" on public.registry_labels;
          create policy "Public users can read active registry labels"
          on public.registry_labels
          for select
          to anon, authenticated
          using (coalesce(status, 'active') in ('active', 'ready', 'published'));
        end;
        $$;
      `);
    }

    const policies = await pool.query(`
      select tablename, policyname, roles, cmd, qual
      from pg_policies
      where schemaname = 'public'
        and tablename = any($1::text[])
      order by tablename, policyname
    `, [allTables]);

    const grants = await pool.query(`
      select table_name, grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = any($1::text[])
        and grantee in ('anon', 'authenticated')
        and privilege_type = 'SELECT'
      order by table_name, grantee
    `, [allTables]);

    console.log("\nApplied public release registry policies");
    console.log("-".repeat(80));
    console.table(policies.rows);

    console.log("\nRelease-page SELECT grants");
    console.log("-".repeat(80));
    console.table(grants.rows);

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{ policy_modified: true, shell_rows_modified: 0, track_rows_modified: 0, media_rows_modified: 0, label_rows_modified: 0, public_rendering_changed: false }]);

    console.log("\nPhase 4B/4B.3 public registry read policy complete.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 4B/4B.3 public registry read policy failed.");
  console.error(error);
  process.exitCode = 1;
});
