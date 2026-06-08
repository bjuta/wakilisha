import { cleanText, createRegistryPool, hasTable, normalizeText } from "./phase1-db";

type ArtistRow = {
  id: string;
  slug: string;
  name: string;
};

type DiffRow = {
  artist: string;
  slug: string;
  currentReleases: number;
  shadowReleases: number;
  missingInShadow: number;
  extraInShadow: number;
  currentOnlySample: string;
  shadowOnlySample: string;
};

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function slugify(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function normalizeTitle(value: string): string {
  return slugify(value);
}

function lower(value: string): string {
  return normalizeText(value);
}

function sqlArtistNeedleMatches(columnName: string): string {
  return `
    lower(${columnName}) = $1
    or lower(${columnName}) like $1 || ',%'
    or lower(${columnName}) like '%, ' || $1 || ',%'
    or lower(${columnName}) like '%, ' || $1
    or lower(${columnName}) like $1 || ' &%'
    or lower(${columnName}) like '%& ' || $1
    or lower(${columnName}) like '% & ' || $1 || ' & %'
    or lower(${columnName}) like $1 || ' feat.%'
    or lower(${columnName}) like $1 || ' ft.%'
  `;
}

async function assertRequiredTables(pool: ReturnType<typeof createRegistryPool>): Promise<void> {
  const required = ["registry_artists", "registry_releases", "registry_release_artists"];

  for (const table of required) {
    if (!(await hasTable(pool, `public.${table}`))) {
      throw new Error(`Required table missing: public.${table}. Run npm run registry:phase1:schema first.`);
    }
  }
}

async function currentReleaseTitlesForArtist(pool: ReturnType<typeof createRegistryPool>, artist: ArtistRow): Promise<string[]> {
  const needle = lower(artist.name || artist.slug);

  const result = await pool.query(`
    with release_rows as (
      select
        rr.title,
        coalesce(
          nullif(rr.metadata->>'artist_name', ''),
          nullif(rr.metadata->>'artist_display', ''),
          nullif(rr.metadata->>'artists', ''),
          ''
        ) as release_artist_line
      from public.registry_releases rr
      where rr.status in ('active', 'needs_review', 'draft')
    )
    select distinct title
    from release_rows
    where ${sqlArtistNeedleMatches("release_artist_line")}
    order by title asc
  `, [needle]);

  return result.rows.map((row) => normalizeTitle(cleanText(row.title))).filter(Boolean);
}

async function shadowReleaseTitlesForArtist(pool: ReturnType<typeof createRegistryPool>, artist: ArtistRow): Promise<string[]> {
  const result = await pool.query(`
    select distinct rr.title
    from public.registry_release_artists rra
    join public.registry_releases rr on rr.id = rra.release_id
    where rr.status in ('active', 'needs_review', 'draft')
      and coalesce(rra.status, 'shadow') in ('shadow', 'active', 'needs_review')
      and (
        rra.artist_id = $1::uuid
        or rra.artist_slug = $2
      )
    order by rr.title asc
  `, [artist.id, artist.slug]);

  return result.rows.map((row) => normalizeTitle(cleanText(row.title))).filter(Boolean);
}

async function releaseTrackParity(pool: ReturnType<typeof createRegistryPool>): Promise<void> {
  if (!(await hasTable(pool, "public.registry_tracks")) || !(await hasTable(pool, "public.registry_release_tracks"))) return;

  console.log("\nRelease-track shadow parity");
  console.log("-".repeat(80));

  const result = await pool.query(`
    with current_links as (
      select release_id, count(*)::int as count
      from public.registry_tracks
      where release_id is not null
        and coalesce(status, 'active') not in ('archived', 'deleted', 'trash')
      group by release_id
    ),
    shadow_links as (
      select release_id, count(distinct track_id)::int as count
      from public.registry_release_tracks
      where release_id is not null and track_id is not null
        and coalesce(status, 'shadow') in ('shadow', 'active', 'needs_review')
      group by release_id
    )
    select
      count(*)::int as releases_with_current_track_links,
      count(*) filter (where coalesce(sl.count, 0) = cl.count)::int as parity_match,
      count(*) filter (where coalesce(sl.count, 0) <> cl.count)::int as parity_gap,
      sum(cl.count)::int as current_track_links,
      sum(coalesce(sl.count, 0))::int as shadow_track_links
    from current_links cl
    left join shadow_links sl on sl.release_id = cl.release_id
  `);

  console.table(result.rows);
}

async function trackArtistCoverage(pool: ReturnType<typeof createRegistryPool>): Promise<void> {
  if (!(await hasTable(pool, "public.registry_tracks")) || !(await hasTable(pool, "public.registry_track_artists"))) return;

  console.log("\nTrack-artist shadow coverage");
  console.log("-".repeat(80));

  const result = await pool.query(`
    select
      count(*)::int as tracks,
      count(*) filter (where exists (
        select 1
        from public.registry_track_artists rta
        where rta.track_id = rt.id
          and coalesce(rta.status, 'shadow') in ('shadow', 'active', 'needs_review')
      ))::int as tracks_with_shadow_artist,
      count(*) filter (where not exists (
        select 1
        from public.registry_track_artists rta
        where rta.track_id = rt.id
          and coalesce(rta.status, 'shadow') in ('shadow', 'active', 'needs_review')
      ))::int as tracks_without_shadow_artist
    from public.registry_tracks rt
    where coalesce(rt.status, 'active') not in ('archived', 'deleted', 'trash')
  `);

  console.table(result.rows);
}

async function main() {
  const pool = createRegistryPool();
  const limit = Math.max(1, Math.min(Number(argValue("limit", "80")) || 80, 500));
  const strict = process.argv.includes("--strict");

  try {
    await pool.query("select 1");
    await assertRequiredTables(pool);

    console.log("\nWAKILISHA Registry Phase 1 Public Parity Guard");
    console.log("=".repeat(80));
    console.log("Mode: read-only comparison. No data will be written.");
    console.log(`Artist sample limit: ${limit}`);
    console.log(strict ? "Strict mode: exits non-zero if parity gaps exist.\n" : "Strict mode: off. Reports gaps without failing.\n");

    const artistResult = await pool.query(`
      select
        ra.id::text,
        ra.slug,
        coalesce(ra.display_name, ra.normalized_name, ra.slug) as name
      from public.registry_artists ra
      where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
      order by coalesce(ra.display_name, ra.normalized_name, ra.slug) asc
      limit $1
    `, [limit]);

    const artists: ArtistRow[] = artistResult.rows.map((row) => ({
      id: cleanText(row.id),
      slug: cleanText(row.slug),
      name: cleanText(row.name),
    }));

    const diffs: DiffRow[] = [];

    for (const artist of artists) {
      const current = new Set(await currentReleaseTitlesForArtist(pool, artist));
      const shadow = new Set(await shadowReleaseTitlesForArtist(pool, artist));

      const currentOnly = [...current].filter((title) => !shadow.has(title));
      const shadowOnly = [...shadow].filter((title) => !current.has(title));

      if (currentOnly.length || shadowOnly.length || current.size !== shadow.size) {
        diffs.push({
          artist: artist.name,
          slug: artist.slug,
          currentReleases: current.size,
          shadowReleases: shadow.size,
          missingInShadow: currentOnly.length,
          extraInShadow: shadowOnly.length,
          currentOnlySample: currentOnly.slice(0, 5).join(", "),
          shadowOnlySample: shadowOnly.slice(0, 5).join(", "),
        });
      }
    }

    console.log("Artist discography parity summary");
    console.log("-".repeat(80));
    console.table([{
      artists_checked: artists.length,
      artists_with_parity_gap: diffs.length,
      artists_matching: artists.length - diffs.length,
    }]);

    if (diffs.length) {
      console.log("\nArtist discography parity gaps — sample");
      console.table(diffs.slice(0, 25));
    } else {
      console.log("\nNo artist discography parity gaps found in sampled artists.");
    }

    await releaseTrackParity(pool);
    await trackArtistCoverage(pool);

    console.log("\nParity guard complete. No writes performed.\n");

    if (strict && diffs.length) {
      console.error(`[phase1-public-parity] Strict mode failed: ${diffs.length} artist parity gap(s) found.`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("[phase1-public-parity] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
