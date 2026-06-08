import { createRegistryPool, hasTable } from "./phase1-db";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const writeMode = hasFlag("write");
const dryRunMode = hasFlag("dry-run") || !writeMode;

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    console.log("\nWAKILISHA Phase 4A.3 Release Shell Schema");
    console.log("=".repeat(80));
    console.log(`Mode: ${writeMode ? "WRITE" : "DRY RUN ONLY"}`);

    const requiredTables = ["registry_releases", "registry_audit_log"];
    for (const table of requiredTables) {
      if (!(await hasTable(pool, `public.${table}`))) {
        throw new Error(`Required table missing: public.${table}`);
      }
    }

    const schemaSql = `
      create table if not exists public.registry_release_shells (
        id uuid primary key default gen_random_uuid(),
        release_id uuid not null references public.registry_releases(id) on delete cascade,
        slug text not null,
        title text not null,
        primary_artist_name text,
        primary_artist_slug text,
        release_date text,
        track_count integer not null default 0,
        has_artwork boolean not null default false,
        readiness text not null default 'draft',
        missing text[] not null default '{}',
        shell_route text,
        source_provenance jsonb not null default '{}'::jsonb,
        status text not null default 'draft',
        generated_by text not null default 'phase4a_release_shell_writer',
        last_generated_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint registry_release_shells_release_id_unique unique (release_id),
        constraint registry_release_shells_slug_unique unique (slug),
        constraint registry_release_shells_readiness_check check (readiness in ('complete', 'ready_missing_artwork', 'minimum_shell_ready', 'blocked', 'draft')),
        constraint registry_release_shells_status_check check (status in ('draft', 'ready', 'blocked', 'archived'))
      );

      create index if not exists registry_release_shells_readiness_idx on public.registry_release_shells (readiness);
      create index if not exists registry_release_shells_status_idx on public.registry_release_shells (status);
      create index if not exists registry_release_shells_primary_artist_slug_idx on public.registry_release_shells (primary_artist_slug);
      create index if not exists registry_release_shells_updated_at_idx on public.registry_release_shells (updated_at desc);

      create or replace function public.set_registry_release_shells_updated_at()
      returns trigger
      language plpgsql
      as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$;

      drop trigger if exists set_registry_release_shells_updated_at on public.registry_release_shells;
      create trigger set_registry_release_shells_updated_at
      before update on public.registry_release_shells
      for each row execute function public.set_registry_release_shells_updated_at();

      alter table public.registry_release_shells enable row level security;

      do $$
      begin
        if not exists (
          select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'registry_release_shells'
            and policyname = 'Authenticated users can read registry release shells'
        ) then
          create policy "Authenticated users can read registry release shells"
          on public.registry_release_shells
          for select
          to authenticated
          using (true);
        end if;
      end;
      $$;

      grant select on public.registry_release_shells to authenticated;
    `;

    if (dryRunMode) {
      console.log("\nPlanned schema changes");
      console.log("-".repeat(80));
      console.log("create table if not exists public.registry_release_shells");
      console.log("create unique constraints on release_id and slug");
      console.log("create readiness/status indexes");
      console.log("create updated_at trigger");
      console.log("enable RLS and authenticated read policy");
      console.log("\nSafety result");
      console.log("-".repeat(80));
      console.table([{ schema_modified: false, shell_records_written: 0, public_rendering_changed: false, write_mode_supported: true }]);
      console.log("\nDry run complete. To apply schema, rerun with: npm run registry:phase4a:release-shell-schema -- --write");
      return;
    }

    await pool.query(schemaSql);

    await pool.query(
      `
      insert into public.registry_audit_log (action, entity_type, entity_id, metadata, created_at)
      values (
        'phase4a_release_shell_schema_applied',
        'release_shell_schema',
        null,
        jsonb_build_object(
          'table', 'registry_release_shells',
          'canonicalEntitiesChanged', false,
          'shellRecordsWritten', 0,
          'publicRenderingChanged', false
        ),
        now()
      )
      `,
    );

    const tableExists = await hasTable(pool, "public.registry_release_shells");
    const columns = await pool.query(
      `
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'registry_release_shells'
      order by ordinal_position
      `,
    );

    console.log("\nSchema applied");
    console.log("-".repeat(80));
    console.table([{ table: "registry_release_shells", exists: tableExists, columns: columns.rowCount }]);

    console.log("\nColumn check");
    console.log("-".repeat(80));
    console.table(columns.rows);

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{ schema_modified: true, shell_records_written: 0, canonical_tables_modified: false, public_rendering_changed: false }]);

    console.log("\nPhase 4A.3 schema complete. No release shell rows were written.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 4A.3 schema failed.");
  console.error(error);
  process.exitCode = 1;
});
