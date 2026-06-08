import { createRegistryPool, hasTable } from "./phase1-db";

type TableColumn = {
  table_name: string;
  column_name: string;
};

type TableInfo = {
  name: string;
  exists: boolean;
  columns: Set<string>;
};

type ReleaseShellRow = {
  release_id: string;
  slug: string;
  title: string;
  primary_artist: string | null;
  primary_artist_slug: string | null;
  release_date: string | null;
  track_count: number;
  has_artwork: boolean;
  readiness: "complete" | "ready_missing_artwork" | "minimum_shell_ready" | "blocked";
  missing: string[];
  shell_route_preview: string | null;
  source_provenance: Record<string, unknown>;
  status: "ready" | "blocked";
};

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const writeMode = hasFlag("write");
const limit = Math.max(1, Math.min(Number(argValue("limit", "100")) || 100, 5000));
const readinessFilter = argValue("readiness", "usable");

function qIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function hasColumn(table: TableInfo, column: string): boolean {
  return table.columns.has(column);
}

function firstColumn(table: TableInfo, candidates: string[]): string | null {
  return candidates.find((column) => hasColumn(table, column)) ?? null;
}

function releaseTextExpr(releases: TableInfo, candidates: string[], fallback: string): string {
  const column = firstColumn(releases, candidates);
  return column ? `r.${qIdent(column)}::text` : fallback;
}

function releaseDateExpr(releases: TableInfo): string {
  const column = firstColumn(releases, ["release_date", "released_at", "date", "year", "release_year"]);
  return column ? `r.${qIdent(column)}::text` : "null::text";
}

function releaseArtworkExpr(releases: TableInfo): string {
  const direct = firstColumn(releases, ["artwork_url", "cover_image_url", "image_url", "thumbnail_url", "poster_url", "hero_image_url"]);
  if (direct) return `nullif(r.${qIdent(direct)}::text, '') is not null`;

  const metadata = firstColumn(releases, ["metadata", "source_payload", "payload", "raw_payload"]);
  if (metadata) {
    return `coalesce(
      nullif(r.${qIdent(metadata)}->>'artwork_url', ''),
      nullif(r.${qIdent(metadata)}->>'cover_image_url', ''),
      nullif(r.${qIdent(metadata)}->>'image_url', ''),
      nullif(r.${qIdent(metadata)}->>'thumbnail_url', ''),
      nullif(r.${qIdent(metadata)}->>'artwork', ''),
      nullif(r.${qIdent(metadata)}->>'cover', '')
    ) is not null`;
  }

  return "false";
}

function releaseIdColumn(table: TableInfo): string | null {
  return firstColumn(table, ["release_id", "registry_release_id"]);
}

function trackIdColumn(table: TableInfo): string | null {
  return firstColumn(table, ["track_id", "registry_track_id"]);
}

function artistIdColumn(table: TableInfo): string | null {
  return firstColumn(table, ["artist_id", "registry_artist_id"]);
}

async function loadTableInfo(pool: ReturnType<typeof createRegistryPool>, names: string[]): Promise<Record<string, TableInfo>> {
  const info: Record<string, TableInfo> = {};
  for (const name of names) {
    info[name] = { name, exists: await hasTable(pool, `public.${name}`), columns: new Set<string>() };
  }

  const existing = Object.values(info).filter((table) => table.exists).map((table) => table.name);
  if (!existing.length) return info;

  const result = await pool.query(
    `
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any($1::text[])
    order by table_name, ordinal_position
    `,
    [existing],
  );

  for (const row of result.rows as TableColumn[]) {
    info[row.table_name]?.columns.add(row.column_name);
  }

  return info;
}

function artistRollupSql(tables: Record<string, TableInfo>): string {
  const releaseArtists = tables.registry_release_artists;
  const artists = tables.registry_artists;
  const relReleaseId = releaseIdColumn(releaseArtists);
  const relArtistId = artistIdColumn(releaseArtists);
  const artistTableId = firstColumn(artists, ["id"]);

  if (!releaseArtists.exists || !artists.exists || !relReleaseId || !relArtistId || !artistTableId) {
    return "release_artist_rollup as (select null::uuid as release_id, null::text as primary_artist, null::text as primary_artist_slug, 0::int as artist_count where false)";
  }

  const artistName = firstColumn(artists, ["display_name", "normalized_name", "name", "title", "slug"]) ?? artistTableId;
  const artistSlug = firstColumn(artists, ["slug", "normalized_slug"]) ?? artistTableId;
  const roleColumn = firstColumn(releaseArtists, ["role", "artist_role", "credit_role"]);
  const isPrimaryColumn = firstColumn(releaseArtists, ["is_primary", "primary_artist"]);
  const creditOrderColumn = firstColumn(releaseArtists, ["credit_order", "position", "sort_order", "display_order"]);

  const primaryCondition = [
    roleColumn ? `ra.${qIdent(roleColumn)}::text in ('primary_artist', 'primary', 'main_artist')` : null,
    isPrimaryColumn ? `coalesce(ra.${qIdent(isPrimaryColumn)}::boolean, false)` : null,
    creditOrderColumn ? `coalesce(ra.${qIdent(creditOrderColumn)}, 999999) = 1` : null,
  ].filter(Boolean).join(" or ") || "false";

  const orderExpr = creditOrderColumn ? `coalesce(ra.${qIdent(creditOrderColumn)}, 999999),` : "";

  return `release_artist_rollup as (
    select
      ra.${qIdent(relReleaseId)} as release_id,
      (array_agg(coalesce(a.${qIdent(artistName)}::text, a.${qIdent(artistTableId)}::text) order by case when ${primaryCondition} then 0 else 1 end, ${orderExpr} a.${qIdent(artistTableId)}::text))[1] as primary_artist,
      (array_agg(coalesce(a.${qIdent(artistSlug)}::text, a.${qIdent(artistTableId)}::text) order by case when ${primaryCondition} then 0 else 1 end, ${orderExpr} a.${qIdent(artistTableId)}::text))[1] as primary_artist_slug,
      count(*)::int as artist_count
    from public.registry_release_artists ra
    left join public.registry_artists a on a.${qIdent(artistTableId)} = ra.${qIdent(relArtistId)}
    group by ra.${qIdent(relReleaseId)}
  )`;
}

function trackRollupSql(tables: Record<string, TableInfo>): string {
  const releaseTracks = tables.registry_release_tracks;
  const relReleaseId = releaseIdColumn(releaseTracks);
  const relTrackId = trackIdColumn(releaseTracks);

  if (!releaseTracks.exists || !relReleaseId) {
    return "release_track_rollup as (select null::uuid as release_id, 0::int as track_count where false)";
  }

  return `release_track_rollup as (
    select
      rt.${qIdent(relReleaseId)} as release_id,
      count(${relTrackId ? `rt.${qIdent(relTrackId)}` : "*"})::int as track_count
    from public.registry_release_tracks rt
    group by rt.${qIdent(relReleaseId)}
  )`;
}

function readinessWhereClause(): string {
  if (readinessFilter === "complete") return "where readiness = 'complete'";
  if (readinessFilter === "ready_missing_artwork") return "where readiness = 'ready_missing_artwork'";
  if (readinessFilter === "minimum_shell_ready") return "where readiness = 'minimum_shell_ready'";
  if (readinessFilter === "blocked") return "where readiness = 'blocked'";
  if (readinessFilter === "all") return "";
  return "where readiness in ('complete', 'ready_missing_artwork', 'minimum_shell_ready')";
}

function buildShellPreviewSql(tables: Record<string, TableInfo>): string {
  const releases = tables.registry_releases;
  const releaseId = firstColumn(releases, ["id"]);
  if (!releaseId) throw new Error("public.registry_releases is missing id column.");

  const titleExpr = releaseTextExpr(releases, ["title", "name", "display_title", "normalized_title"], "null::text");
  const slugExpr = releaseTextExpr(releases, ["slug", "normalized_slug"], "null::text");
  const dateExpr = releaseDateExpr(releases);
  const artworkExpr = releaseArtworkExpr(releases);

  return `
    with
    ${artistRollupSql(tables)},
    ${trackRollupSql(tables)},
    release_readiness as (
      select
        r.${qIdent(releaseId)}::text as release_id,
        ${titleExpr} as title,
        ${slugExpr} as slug,
        ${dateExpr} as release_date,
        ar.primary_artist,
        ar.primary_artist_slug,
        coalesce(ar.artist_count, 0)::int as artist_count,
        coalesce(tr.track_count, 0)::int as track_count,
        (${artworkExpr}) as has_artwork,
        array_remove(array[
          case when nullif(${titleExpr}, '') is null then 'missing_title' end,
          case when nullif(${slugExpr}, '') is null then 'missing_slug' end,
          case when coalesce(ar.artist_count, 0) = 0 then 'missing_release_artist' end,
          case when ar.primary_artist is null then 'missing_primary_artist' end,
          case when coalesce(tr.track_count, 0) = 0 then 'missing_tracks' end,
          case when not (${artworkExpr}) then 'missing_artwork' end
        ], null) as missing
      from public.registry_releases r
      left join release_artist_rollup ar on ar.release_id = r.${qIdent(releaseId)}
      left join release_track_rollup tr on tr.release_id = r.${qIdent(releaseId)}
    ),
    shell_preview as (
      select
        release_id,
        slug,
        title,
        primary_artist,
        primary_artist_slug,
        release_date,
        track_count,
        has_artwork,
        missing,
        case
          when array_length(missing, 1) is null then 'complete'
          when nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null and track_count > 0 then 'ready_missing_artwork'
          when nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null then 'minimum_shell_ready'
          else 'blocked'
        end as readiness,
        case
          when nullif(slug, '') is not null and nullif(primary_artist_slug, '') is not null then '/releases/' || primary_artist_slug || '/' || slug
          when nullif(slug, '') is not null then '/releases/' || slug
          else null
        end as shell_route_preview,
        jsonb_build_object(
          'releaseTable', 'registry_releases',
          'releaseArtistTable', 'registry_release_artists',
          'releaseTrackTable', 'registry_release_tracks',
          'generatedBy', 'phase4a_release_shell_writer',
          'canonicalEntitiesChanged', false,
          'publicRenderingChanged', false
        ) as source_provenance,
        case
          when array_length(missing, 1) is null then 'ready'
          when nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null then 'ready'
          else 'blocked'
        end as status
      from release_readiness
      where nullif(title, '') is not null
        and nullif(slug, '') is not null
    )
  `;
}

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    const tables = await loadTableInfo(pool, [
      "registry_release_shells",
      "registry_releases",
      "registry_release_artists",
      "registry_release_tracks",
      "registry_artists",
      "registry_tracks",
      "registry_audit_log",
    ]);

    console.log("\nWAKILISHA Phase 4A.4.1 Real Idempotent Release Shell Writer");
    console.log("=".repeat(80));
    console.log(`Mode: ${writeMode ? "WRITE" : "DRY RUN ONLY"}`);
    console.log(`Readiness filter: ${readinessFilter}`);
    console.log(`Limit: ${limit}`);

    for (const table of ["registry_release_shells", "registry_releases", "registry_release_artists", "registry_release_tracks", "registry_artists", "registry_audit_log"]) {
      if (!tables[table]?.exists) throw new Error(`Required table missing: public.${table}`);
    }

    const baseSql = buildShellPreviewSql(tables);

    const distribution = await pool.query(`
      ${baseSql}
      select readiness, status, count(*)::int as count
      from shell_preview
      group by readiness, status
      order by case readiness
        when 'complete' then 0
        when 'ready_missing_artwork' then 1
        when 'minimum_shell_ready' then 2
        else 3
      end
    `);

    console.log("\nAvailable release shell distribution");
    console.log("-".repeat(80));
    console.table(distribution.rows);

    const planned = await pool.query(`
      ${baseSql}
      select *
      from shell_preview
      ${readinessWhereClause()}
      order by
        case readiness
          when 'complete' then 0
          when 'ready_missing_artwork' then 1
          when 'minimum_shell_ready' then 2
          else 3
        end,
        track_count desc,
        title asc nulls last
      limit $1
    `, [limit]);

    const rows = planned.rows as ReleaseShellRow[];
    const releaseIds = rows.map((row) => row.release_id);

    const existingResult = releaseIds.length
      ? await pool.query("select count(*)::int as count from public.registry_release_shells where release_id = any($1::uuid[])", [releaseIds])
      : { rows: [{ count: 0 }] };
    const alreadyExisting = Number(existingResult.rows[0]?.count ?? 0);
    const wouldInsert = Math.max(0, rows.length - alreadyExisting);
    const wouldUpdate = alreadyExisting;

    console.log("\nPlanned release shell writes");
    console.log("-".repeat(80));
    console.table(rows.slice(0, 25).map((row) => ({
      release_id: row.release_id,
      title: row.title,
      slug: row.slug,
      primary_artist: row.primary_artist,
      track_count: row.track_count,
      readiness: row.readiness,
      status: row.status,
      route: row.shell_route_preview,
      missing: row.missing?.join(", ") || "none",
    })));

    console.log("\nWrite plan summary");
    console.log("-".repeat(80));
    console.table([{ rows_planned: rows.length, rows_would_insert: wouldInsert, rows_would_update: wouldUpdate, write_mode: writeMode }]);

    if (!writeMode) {
      console.log("\nSafety result");
      console.log("-".repeat(80));
      console.table([{ rows_inserted_or_updated: 0, canonical_tables_modified: false, shell_rows_modified: false, public_rendering_changed: false, write_mode_supported: true }]);
      console.log("\nDry run complete. To write rows, rerun with: npm run registry:phase4a:release-shell-write -- --write --readiness=usable --limit=100");
      return;
    }

    const writeResult = await pool.query(`
      ${baseSql},
      selected_shells as (
        select *
        from shell_preview
        ${readinessWhereClause()}
        order by
          case readiness
            when 'complete' then 0
            when 'ready_missing_artwork' then 1
            when 'minimum_shell_ready' then 2
            else 3
          end,
          track_count desc,
          title asc nulls last
        limit $1
      ),
      upserted as (
        insert into public.registry_release_shells (
          release_id,
          slug,
          title,
          primary_artist_name,
          primary_artist_slug,
          release_date,
          track_count,
          has_artwork,
          readiness,
          missing,
          shell_route,
          source_provenance,
          status,
          generated_by,
          last_generated_at
        )
        select
          release_id::uuid,
          slug,
          title,
          primary_artist,
          primary_artist_slug,
          release_date,
          track_count,
          has_artwork,
          readiness,
          missing,
          shell_route_preview,
          source_provenance,
          status,
          'phase4a_release_shell_writer',
          now()
        from selected_shells
        on conflict (release_id) do update set
          slug = excluded.slug,
          title = excluded.title,
          primary_artist_name = excluded.primary_artist_name,
          primary_artist_slug = excluded.primary_artist_slug,
          release_date = excluded.release_date,
          track_count = excluded.track_count,
          has_artwork = excluded.has_artwork,
          readiness = excluded.readiness,
          missing = excluded.missing,
          shell_route = excluded.shell_route,
          source_provenance = excluded.source_provenance,
          status = excluded.status,
          generated_by = excluded.generated_by,
          last_generated_at = excluded.last_generated_at,
          updated_at = now()
        returning id, release_id, slug, title, readiness, status
      )
      select count(*)::int as rows_written from upserted
    `, [limit]);

    const rowsWritten = Number(writeResult.rows[0]?.rows_written ?? 0);

    await pool.query(
      `
      insert into public.registry_audit_log (action, entity_type, entity_id, metadata, created_at)
      values (
        'phase4a_release_shell_rows_upserted',
        'release_shell',
        null,
        jsonb_build_object(
          'rowsPlanned', $1::int,
          'rowsWritten', $2::int,
          'rowsAlreadyExistingBeforeWrite', $3::int,
          'readinessFilter', $4::text,
          'limit', $5::int,
          'canonicalEntitiesChanged', false,
          'publicRenderingChanged', false,
          'generatedBy', 'phase4a_release_shell_writer'
        ),
        now()
      )
      `,
      [rows.length, rowsWritten, alreadyExisting, readinessFilter, limit],
    );

    const shellTotals = await pool.query(`
      select readiness, status, count(*)::int as count
      from public.registry_release_shells
      group by readiness, status
      order by readiness, status
    `);

    console.log("\nWrite results");
    console.log("-".repeat(80));
    console.table([{ rows_planned: rows.length, rows_written: rowsWritten, rows_inserted_estimate: wouldInsert, rows_updated_estimate: wouldUpdate }]);

    console.log("\nregistry_release_shells totals after write");
    console.log("-".repeat(80));
    console.table(shellTotals.rows);

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{ rows_inserted_or_updated: rowsWritten, canonical_tables_modified: false, shell_rows_modified: true, public_rendering_changed: false }]);

    console.log("\nPhase 4A.4.1 write complete. Release shell rows were upserted idempotently.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 4A.4.1 release shell write failed.");
  console.error(error);
  process.exitCode = 1;
});
