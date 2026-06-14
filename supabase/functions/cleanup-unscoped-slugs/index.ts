import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CHUNK_SIZE = 300;
const FETCH_PAGE_SIZE = 2000;

async function fetchAllUnscopedTracks() {
  const ids: string[] = [];
  const slugs: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("registry_tracks")
      .select("id, slug")
      .not("slug", "ilike", "%-%-%")
      .eq("status", "active")
      .range(from, from + FETCH_PAGE_SIZE - 1)
      .order("id");

    if (error) throw new Error(`Failed fetching tracks: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const t of data) {
      ids.push(t.id);
      slugs.push(t.slug);
    }
    from += FETCH_PAGE_SIZE;
  }

  return { ids, slugs };
}

async function fetchAllUnscopedReleases() {
  const ids: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("registry_releases")
      .select("id")
      .not("slug", "ilike", "%-%-%")
      .eq("status", "active")
      .range(from, from + FETCH_PAGE_SIZE - 1)
      .order("id");

    if (error) throw new Error(`Failed fetching releases: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const r of data) ids.push(r.id);
    from += FETCH_PAGE_SIZE;
  }

  return ids;
}

async function deleteChunked(
  table: string,
  column: string,
  values: string[],
  steps: string[],
  errors: string[],
  stats: Record<string, number>,
  statKey: string
) {
  let total = 0;
  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    const chunk = values.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) {
      errors.push(`${table} chunk error: ${error.message}`);
    }
    total += chunk.length;
  }
  stats[statKey] = total;
  steps.push(`Deleted ${total} rows from ${table}`);
}

Deno.serve(async (_req: Request) => {
  const steps: string[] = [];
  const errors: string[] = [];
  const stats: Record<string, number> = {};

  try {
    // ===== STEP 1: Collect all unscoped track IDs and slugs =====
    steps.push("Fetching all unscoped tracks (paginated)...");
    const { ids: oldIds, slugs: oldSlugs } = await fetchAllUnscopedTracks();
    steps.push(`Found ${oldIds.length} unscoped tracks`);

    if (oldIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No unscoped tracks found", steps }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ===== STEP 2: Collect old-style releases =====
    steps.push("Fetching all old-style releases (paginated)...");
    const oldReleaseIds = await fetchAllUnscopedReleases();
    steps.push(`Found ${oldReleaseIds.length} old-style releases`);

    // ===== STEP 3: Delete release_tracks first (so FK on tracks doesn't block) =====
    await deleteChunked("registry_release_tracks", "track_id", oldIds, steps, errors, stats, "release_tracks_deleted");

    // ===== STEP 4: Delete track_artists =====
    await deleteChunked("registry_track_artists", "track_id", oldIds, steps, errors, stats, "track_artists_deleted");

    // ===== STEP 5: Delete chart entries =====
    await deleteChunked("wk_chart_entries_v2", "track_slug", oldSlugs, steps, errors, stats, "chart_entries_deleted");

    // ===== STEP 6: Delete entity relationships (source slugs) =====
    await deleteChunked("registry_entity_relationships", "source_slug", oldSlugs, steps, errors, stats, "entity_rel_source_deleted");

    // ===== STEP 7: Delete entity relationships (target slugs) =====
    await deleteChunked("registry_entity_relationships", "target_slug", oldSlugs, steps, errors, stats, "entity_rel_target_deleted");

    // ===== STEP 8: Delete the tracks THEMSELVES NOW (before releases due to FK) =====
    await deleteChunked("registry_tracks", "id", oldIds, steps, errors, stats, "tracks_deleted");

    // ===== STEP 9: Delete release_artists for old releases =====
    await deleteChunked("registry_release_artists", "release_id", oldReleaseIds, steps, errors, stats, "release_artists_deleted");

    // ===== STEP 10: Delete old releases =====
    await deleteChunked("registry_releases", "id", oldReleaseIds, steps, errors, stats, "releases_deleted");

    // ===== Final verification =====
    const { count: remainingUnscoped } = await supabase
      .from("registry_tracks")
      .select("*", { count: "exact", head: true })
      .not("slug", "ilike", "%-%-%")
      .eq("status", "active");

    const { count: remainingTracks } = await supabase
      .from("registry_tracks")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    const { count: remainingReleases } = await supabase
      .from("registry_releases")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    stats.remaining_tracks = remainingTracks ?? 0;
    stats.remaining_releases = remainingReleases ?? 0;
    stats.remaining_unscoped = remainingUnscoped ?? 0;

    return new Response(
      JSON.stringify({
        success: true,
        steps,
        errors: errors.slice(0, 20),
        stats,
        message: `Cleanup complete. ${stats.remaining_unscoped} unscoped tracks remain.`,
      }, null, 2),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: message, steps, errors }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
