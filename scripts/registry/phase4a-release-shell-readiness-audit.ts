import { createRegistryPool, hasTable } from "./phase1-db";

type TableColumn = {
  table_name: string;
  column_name: string;
  data_type: string;
};

type TableInfo = {
  name: string;
  exists: boolean;
  columns: Set<string>;
};

type ReleaseCandidateRow = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  release_date: string | null;
  primary_artist: string | null;
  primary_artist_slug: string | null;
  artist_count: number;
  track_count: number;
  has_artwork: boolean;
  missing: string[];
  readiness: string;
};

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const limit = Math.max(1, Math.min(Number(argValue("limit", "25")) || 25, 100));

function hasColumn(table: TableInfo, column: string): boolean {
  return table.columns.has(column);
}

function firstColumn(table: TableInfo, candidates: string[]): string | null {
  return candidates.find((column) => hasColumn(table, column)) ?? null;
}

function qIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function releaseTextExpr(releases: TableInfo, candidates: string[], fallback: string): string {
  const column = firstColumn(releases, candidates);
  return column ? `r.${qIdent(column)}::text` : fallback;
}

function releaseDateExpr(releases: TableInfo): string {
  const column = firstColumn(releases, ["release_date", "released_at", "date", "year", "release_year"]);
  return column ? `r.${qIdent(column)}::text` : "null::text";
}

function releaseStatusExpr(releases: TableInfo): string {
  const column = firstColumn(releases, ["status", "state", "publication_status"]);
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

  const existingNames = Object.values(info).filter((table) => table.exists).map((table) => table.name);
  if (!existingNames.length) return info;

  const result = await pool.query(
    `
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any($1::text[])
    order by table_name, ordinal_position
    `,
    [existingNames],
  );

  for (const row of result.rows as TableColumn[]) {
    info[row.table_name]?.columns.add(row.column_name);
  }

  return info;
}

async function count(pool: ReturnType<typeof createRegistryPool>, sql: string): Promise<number> {
  const result = await pool.query(sql);
  return Number(result.rows[0]?.count ?? 0);
}

function artistJoinSql(tables: Record<string, TableInfo>): { cte: string; available: boolean } {
  const releaseArtists = tables.registry_release_artists;
  const artists = tables.registry_artists;
  const relReleaseId = releaseIdColumn(releaseArtists);
  const relArtistId = artistIdColumn(releaseArtists);

  if (!releaseArtists.exists || !artists.exists || !relReleaseId || !relArtistId) {
    return {
      available: false,
      cte: "release_artist_rollup as (select null::uuid as release_id, null::text as primary_artist, null::text as primary_artist_slug, 0::int as artist_count where false)",
    };
  }

  const artistName = firstColumn(artists, ["display_name", "normalized_name", "name", "title", "slug"]);
  const artistSlug = firstColumn(artists, ["slug", "normalized_slug"]);
  const artistsId = firstColumn(artists, ["id"]);
  const roleColumn = firstColumn(releaseArtists, ["role", "artist_role", "credit_role"]);
  const isPrimaryColumn = firstColumn(releaseArtists, ["is_primary", "primary_artist"]);
  const creditOrderColumn = firstColumn(releaseArtists, ["credit_order", "position", "sort_order", "display_order"]);

  const primaryCondition = [
    roleColumn ? `ra.${qIdent(roleColumn)}::text in ('primary_artist', 'primary', 'main_artist')` : null,
    isPrimaryColumn ? `coalesce(ra.${qIdent(isPrimaryColumn)}::boolean, false)` : null,
    creditOrderColumn ? `coalesce(ra.${qIdent(creditOrderColumn)}, 999999) = 1` : null,
  ].filter(Boolean).join(" or ") || "false";

  const orderExpr = creditOrderColumn ? `coalesce(ra.${qIdent(creditOrderColumn)}, 999999),` : "";

  return {
    available: true,
    cte: `release_artist_rollup as (
      select
        ra.${qIdent(relReleaseId)} as release_id,
        (array_agg(coalesce(a.${qIdent(artistName || "id")}::text, a.${qIdent(artistsId || "id")}::text) order by case when ${primaryCondition} then 0 else 1 end, ${orderExpr} a.${qIdent(artistsId || "id")}::text))[1] as primary_artist,
        (array_agg(${artistSlug ? `a.${qIdent(artistSlug)}::text` : `a.${qIdent(artistsId || "id")}::text`} order by case when ${primaryCondition} then 0 else 1 end, ${orderExpr} a.${qIdent(artistsId || "id")}::text))[1] as primary_artist_slug,
        count(*)::int as artist_count
      from public.registry_release_artists ra
      left join public.registry_artists a on a.${qIdent(artistsId || "id")} = ra.${qIdent(relArtistId)}
      group by ra.${qIdent(relReleaseId)}
    )`,
  };
}

function trackJoinSql(tables: Record<string, TableInfo>): { cte: string; available: boolean } {
  const releaseTracks = tables.registry_release_tracks;
  const relReleaseId = releaseIdColumn(releaseTracks);
  const relTrackId = trackIdColumn(releaseTracks);

  if (!releaseTracks.exists || !relReleaseId) {
    return {
      available: false,
      cte: "release_track_rollup as (select null::uuid as release_id, 0::int as track_count where false)",
    };
  }

  return {
    available: true,
    cte: `release_track_rollup as (
      select
        rt.${qIdent(relReleaseId)} as release_id,
        count(${relTrackId ? `rt.${qIdent(relTrackId)}` : "*"})::int as track_count
      from public.registry_release_tracks rt
      group by rt.${qIdent(relReleaseId)}
    )`,
  };
}

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    const tables = await loadTableInfo(pool, [
      "registry_releases",
      "registry_release_artists",
      "registry_release_tracks",
      "registry_artists",
      "registry_tracks",
      "wk_media_assets",
      "registry_audit_log",
    ]);

    console.log("\nWAKILISHA Phase 4A.1 Release Shell Readiness Audit");
    console.log("=".repeat(80));
    console.log("Mode: DRY RUN ONLY. No canonical tables will be modified.");
    console.log(`Sample limit: ${limit}`);

    const tableSummary = Object.values(tables).map((table) => ({
      table: table.name,
      exists: table.exists,
      columns: table.columns.size,
    }));
    console.log("\nRequired/related table availability");
    console.log("-".repeat(80));
    console.table(tableSummary);

    const releases = tables.registry_releases;
    if (!releases.exists) {
      throw new Error("Required table missing: public.registry_releases");
    }

    const releaseId = firstColumn(releases, ["id"]);
    if (!releaseId) throw new Error("public.registry_releases is missing id column.");

    const titleExpr = releaseTextExpr(releases, ["title", "name", "display_title", "normalized_title"], "null::text");
    const slugExpr = releaseTextExpr(releases, ["slug", "normalized_slug"], "null::text");
    const statusExpr = releaseStatusExpr(releases);
    const dateExpr = releaseDateExpr(releases);
    const artworkExpr = releaseArtworkExpr(releases);
    const artistRollup = artistJoinSql(tables);
    const trackRollup = trackJoinSql(tables);

    const baseCtes = `
      with
      ${artistRollup.cte},
      ${trackRollup.cte},
      release_readiness as (
        select
          r.${qIdent(releaseId)}::text as id,
          ${titleExpr} as title,
          ${slugExpr} as slug,
          ${statusExpr} as status,
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
      )
    `;

    const totalsSql = `
      ${baseCtes}
      select
        count(*)::int as total_releases,
        count(*) filter (where nullif(title, '') is not null)::int as with_title,
        count(*) filter (where nullif(slug, '') is not null)::int as with_slug,
        count(*) filter (where artist_count > 0)::int as with_any_release_artist,
        count(*) filter (where primary_artist is not null)::int as with_primary_artist,
        count(*) filter (where track_count > 0)::int as with_tracks,
        count(*) filter (where has_artwork)::int as with_artwork,
        count(*) filter (where nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null)::int as shell_ready_minimum,
        count(*) filter (where nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null and track_count > 0)::int as shell_ready_with_tracks,
        count(*) filter (where nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null and track_count > 0 and has_artwork)::int as shell_complete
      from release_readiness
    `;

    const totals = await pool.query(totalsSql);
    console.log("\nRelease shell readiness totals");
    console.log("-".repeat(80));
    console.table(totals.rows);

    const blockers = await pool.query(`
      ${baseCtes}
      select missing_item, count(*)::int as count
      from release_readiness, unnest(missing) as missing_item
      group by missing_item
      order by count desc, missing_item asc
    `);
    console.log("\nTop release shell blockers");
    console.log("-".repeat(80));
    console.table(blockers.rows);

    const samples = await pool.query(`
      ${baseCtes}
      select
        id,
        title,
        slug,
        status,
        release_date,
        primary_artist,
        primary_artist_slug,
        artist_count,
        track_count,
        has_artwork,
        missing,
        case
          when array_length(missing, 1) is null then 'complete'
          when nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null and track_count > 0 then 'ready_missing_artwork'
          when nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null then 'minimum_shell_ready'
          else 'blocked'
        end as readiness
      from release_readiness
      order by
        case
          when array_length(missing, 1) is null then 0
          when nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null and track_count > 0 then 1
          when nullif(title, '') is not null and nullif(slug, '') is not null and primary_artist is not null then 2
          else 3
        end,
        array_length(missing, 1) asc nulls first,
        title asc nulls last
      limit $1
    `, [limit]);

    console.log("\nClosest release shell candidates");
    console.log("-".repeat(80));
    console.table((samples.rows as ReleaseCandidateRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      primary_artist: row.primary_artist,
      artist_count: row.artist_count,
      track_count: row.track_count,
      has_artwork: row.has_artwork,
      readiness: row.readiness,
      missing: row.missing?.join(", ") || "none",
    })));

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{ canonical_tables_modified: false, public_rendering_changed: false, write_mode_supported: false }]);

    console.log("\nPhase 4A.1 audit complete. No writes performed.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 4A.1 audit failed.");
  console.error(error);
  process.exitCode = 1;
});
