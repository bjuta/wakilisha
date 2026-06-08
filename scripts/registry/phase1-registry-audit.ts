import { createRegistryPool, hasTable } from "./phase1-db";

async function count(pool: ReturnType<typeof createRegistryPool>, table: string, where = "true"): Promise<number | null> {
  if (!(await hasTable(pool, `public.${table}`))) return null;
  const result = await pool.query(`select count(*)::int as count from public.${table} where ${where}`);
  return Number(result.rows[0]?.count ?? 0);
}

function printMetric(label: string, value: unknown): void {
  console.log(`${label.padEnd(48)} ${value === null ? "MISSING TABLE" : value}`);
}

async function main() {
  const pool = createRegistryPool();

  try {
    await pool.query("select 1");

    console.log("\nWAKILISHA Registry Phase 1 Audit");
    console.log("=".repeat(80));
    console.log("Mode: read-only audit. No data will be written.\n");

    const tables = [
      "registry_artists",
      "registry_releases",
      "registry_tracks",
      "registry_labels",
      "registry_genres",
      "wk_chart_entries_v2",
      "wk_media_assets",
      "registry_release_artists",
      "registry_track_artists",
      "registry_release_tracks",
      "registry_provider_sources",
      "registry_field_provenance",
      "registry_audit_log",
      "registry_countries",
      "registry_imprints",
    ];

    console.log("Table coverage");
    console.log("-".repeat(80));
    for (const table of tables) {
      printMetric(table, await count(pool, table));
    }

    console.log("\nRegistry data quality");
    console.log("-".repeat(80));

    if (await hasTable(pool, "public.registry_artists")) {
      const result = await pool.query(`
        select
          count(*)::int as total,
          count(*) filter (where nullif(slug, '') is null)::int as missing_slug,
          count(*) filter (where nullif(coalesce(display_name, normalized_name, ''), '') is null)::int as missing_name,
          count(*) filter (where nullif(to_jsonb(registry_artists)->>'country', '') is not null)::int as has_country,
          count(*) filter (where nullif(to_jsonb(registry_artists)->>'origin_country', '') is not null)::int as has_origin_country,
          count(*) filter (where nullif(to_jsonb(registry_artists)->>'origin_iso2', '') is not null)::int as has_origin_iso2,
          count(*) filter (
            where nullif(to_jsonb(registry_artists)->>'image_url', '') is not null
               or nullif(to_jsonb(registry_artists)->>'profile_image_url', '') is not null
          )::int as has_image
        from public.registry_artists
      `);
      console.table(result.rows);
    }

    if (await hasTable(pool, "public.registry_releases")) {
      const result = await pool.query(`
        select
          count(*)::int as total,
          count(*) filter (where nullif(slug, '') is null)::int as missing_slug,
          count(*) filter (where nullif(title, '') is null)::int as missing_title,
          count(*) filter (where release_date is not null)::int as has_release_date,
          count(*) filter (where nullif(release_type, '') is not null)::int as has_release_type,
          count(*) filter (where nullif(upc, '') is not null)::int as has_upc,
          count(*) filter (where nullif(artwork_url, '') is not null)::int as has_artwork,
          count(*) filter (where label_id is not null)::int as has_label_id,
          count(*) filter (
            where nullif(metadata->>'artist_name', '') is not null
               or nullif(metadata->>'artist_display', '') is not null
               or nullif(metadata->>'artists', '') is not null
          )::int as has_artist_text_metadata
        from public.registry_releases
      `);
      console.table(result.rows);
    }

    if (await hasTable(pool, "public.registry_tracks")) {
      const result = await pool.query(`
        select
          count(*)::int as total,
          count(*) filter (where nullif(slug, '') is null)::int as missing_slug,
          count(*) filter (where nullif(title, '') is null)::int as missing_title,
          count(*) filter (where release_id is not null)::int as has_release_id,
          count(*) filter (where nullif(isrc, '') is not null)::int as has_isrc,
          count(*) filter (where coalesce(duration_ms, 0) > 0)::int as has_duration_ms,
          count(*) filter (where nullif(artwork_url, '') is not null)::int as has_artwork,
          count(*) filter (where nullif(preview_url, '') is not null)::int as has_preview_url
        from public.registry_tracks
      `);
      console.table(result.rows);
    }

    console.log("\nPotential structural gaps");
    console.log("-".repeat(80));

    if ((await hasTable(pool, "public.registry_releases")) && (await hasTable(pool, "public.registry_tracks"))) {
      const result = await pool.query(`
        select
          (select count(*)::int from public.registry_releases rr where not exists (
            select 1 from public.registry_tracks rt where rt.release_id = rr.id
          )) as releases_without_tracks,
          (select count(*)::int from public.registry_tracks rt where rt.release_id is null) as tracks_without_release
      `);
      console.table(result.rows);
    }

    if ((await hasTable(pool, "public.wk_chart_entries_v2")) && (await hasTable(pool, "public.registry_tracks"))) {
      const result = await pool.query(`
        select
          count(*)::int as chart_entries,
          count(*) filter (where nullif(track_slug, '') is null)::int as chart_entries_missing_track_slug,
          count(*) filter (where nullif(artist_slug, '') is null)::int as chart_entries_missing_artist_slug,
          count(*) filter (where not exists (
            select 1 from public.registry_tracks rt where rt.slug = wk_chart_entries_v2.track_slug
          ))::int as chart_entries_without_registry_track_by_slug
        from public.wk_chart_entries_v2
      `);
      console.table(result.rows);
    }

    console.log("\nShadow layer status");
    console.log("-".repeat(80));

    if (await hasTable(pool, "public.registry_release_artists")) {
      const result = await pool.query(`
        select status, source, count(*)::int
        from public.registry_release_artists
        group by status, source
        order by count desc
      `);
      console.table(result.rows);
    }

    if (await hasTable(pool, "public.registry_track_artists")) {
      const result = await pool.query(`
        select status, source, count(*)::int
        from public.registry_track_artists
        group by status, source
        order by count desc
      `);
      console.table(result.rows);
    }

    if (await hasTable(pool, "public.registry_release_tracks")) {
      const result = await pool.query(`
        select status, source, count(*)::int
        from public.registry_release_tracks
        group by status, source
        order by count desc
      `);
      console.table(result.rows);
    }

    console.log("\nAudit complete. No writes performed.\n");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[phase1-registry-audit] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
