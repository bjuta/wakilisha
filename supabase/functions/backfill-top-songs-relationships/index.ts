import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Backfill Top Songs → Registry Relationships v3
 *
 * One-time migration that processes all artists with metadata.top_songs
 * and creates registry_entity_relationships entries linking each top song
 * to its matching registry_track (found through the artist's releases).
 *
 * Idempotent: pre-checks existing relationships before insert.
 * Uses plain INSERT (not upsert) to avoid onConflict issues with
 * expression-based unique indexes.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function normalizeTitleForDedup(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) return respond({ error: "Supabase config missing" }, 500);

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    let dryRun = false;
    let limit = 0;
    try {
      const body = await req.json();
      dryRun = body.dryRun === true;
      limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : 0;
    } catch {
      // no body — use defaults
    }

    // 1. Fetch all artists with metadata.top_songs
    const { data: artists, error: artistsErr } = await supabase
      .from("registry_artists")
      .select("slug, display_name, metadata")
      .eq("status", "active")
      .not("metadata->top_songs", "is", null);

    if (artistsErr) {
      return respond({ error: `Failed to fetch artists: ${artistsErr.message}` }, 500);
    }

    const candidates = (artists ?? []).filter((a: any) => {
      const songs = (a.metadata?.top_songs || []) as any[];
      return Array.isArray(songs) && songs.length > 0;
    });

    const stats = {
      total_artists: candidates.length,
      processed: 0,
      skipped_no_releases: 0,
      skipped_existing_relationships: 0,
      top_songs_total: 0,
      top_songs_matched: 0,
      top_songs_unmatched: 0,
      relationships_created: 0,
      errors: 0,
    };

    const results: Array<{
      artist_slug: string;
      display_name: string;
      top_songs_count: number;
      matched: number;
      unmatched: number;
      relationships_created: number;
      error?: string;
    }> = [];

    const artistsToProcess = limit > 0 ? candidates.slice(0, limit) : candidates;

    for (const artist of artistsToProcess) {
      const artistSlug = String(artist.slug);
      const displayName = String(artist.display_name);
      const meta = (artist.metadata || {}) as Record<string, unknown>;
      const topSongs: Array<{ title: string; artists: string; image: string; duration: string; songUrl?: string }> =
        Array.isArray(meta.top_songs) ? (meta.top_songs as any[]) : [];

      if (topSongs.length === 0) continue;

      const resultEntry = {
        artist_slug: artistSlug,
        display_name: displayName,
        top_songs_count: topSongs.length,
        matched: 0,
        unmatched: 0,
        relationships_created: 0,
      };

      try {
        // 2. Get all tracks for this artist through their releases
        const { data: releaseArtistRows } = await supabase
          .from("registry_release_artists")
          .select("release_id")
          .eq("artist_slug", artistSlug)
          .eq("status", "active");

        if (!releaseArtistRows || releaseArtistRows.length === 0) {
          stats.skipped_no_releases++;
          resultEntry.unmatched = topSongs.length;
          results.push(resultEntry);
          continue;
        }

        const releaseIds = [...new Set(releaseArtistRows.map((r: any) => String(r.release_id)))];

        const { data: releaseTrackRows } = await supabase
          .from("registry_release_tracks")
          .select("track_id")
          .in("release_id", releaseIds);

        if (!releaseTrackRows || releaseTrackRows.length === 0) {
          stats.skipped_no_releases++;
          resultEntry.unmatched = topSongs.length;
          results.push(resultEntry);
          continue;
        }

        const trackIds = [...new Set(releaseTrackRows.map((rt: any) => String(rt.track_id)))];

        const { data: trackRows } = await supabase
          .from("registry_tracks")
          .select("slug, title")
          .in("id", trackIds)
          .eq("status", "active");

        if (!trackRows || trackRows.length === 0) {
          stats.skipped_no_releases++;
          resultEntry.unmatched = topSongs.length;
          results.push(resultEntry);
          continue;
        }

        // Build normalized-title → slug lookup
        const normTitleToSlug = new Map<string, string>();
        for (const t of trackRows as any[]) {
          const key = normalizeTitleForDedup(String(t.title || ""));
          if (key) normTitleToSlug.set(key, String(t.slug));
        }

        // 3. Check which relationships already exist for this artist
        const { data: existingRels } = await supabase
          .from("registry_entity_relationships")
          .select("target_slug")
          .eq("source_entity_type", "artist")
          .eq("source_slug", artistSlug)
          .eq("target_entity_type", "track")
          .eq("relationship_type", "popular_track")
          .eq("relationship_role", "top_song")
          .eq("relationship_status", "active");

        const existingTargetSlugs = new Set(
          (existingRels ?? []).map((r: any) => String(r.target_slug))
        );

        // 4. Match and create relationships using plain INSERT
        const now = new Date().toISOString();
        let nextRank = existingTargetSlugs.size + 1;

        for (const ts of topSongs) {
          stats.top_songs_total++;
          const normKey = normalizeTitleForDedup(String(ts.title || ""));
          if (!normKey) { stats.top_songs_unmatched++; resultEntry.unmatched++; continue; }

          const matchedSlug = normTitleToSlug.get(normKey);
          if (!matchedSlug) { stats.top_songs_unmatched++; resultEntry.unmatched++; continue; }

          // Skip if relationship already exists for this track
          if (existingTargetSlugs.has(matchedSlug)) {
            stats.top_songs_matched++;
            resultEntry.matched++;
            continue;
          }

          stats.top_songs_matched++;
          resultEntry.matched++;

          if (!dryRun) {
            const { error: insErr } = await supabase
              .from("registry_entity_relationships")
              .insert({
                source_entity_type: "artist",
                source_slug: artistSlug,
                target_entity_type: "track",
                target_slug: matchedSlug,
                relationship_type: "popular_track",
                relationship_role: "top_song",
                relationship_status: "active",
                source_kind: "backfill_top_songs_v1",
                source_record_id: `rank_${nextRank}`,
                sort_order: nextRank,
                confidence: 75,
                metadata: {
                  backfilled_at: now,
                  rank: nextRank,
                  matched_by: "normalized_title",
                  top_song_title: ts.title,
                },
              });

            if (insErr) {
              // If duplicate key violation (race condition), just skip it
              if (insErr.code === "23505") {
                // Already exists, treat as success
                existingTargetSlugs.add(matchedSlug);
                nextRank++;
              } else {
                stats.errors++;
                resultEntry.error = insErr.message;
              }
            } else {
              stats.relationships_created++;
              resultEntry.relationships_created++;
              existingTargetSlugs.add(matchedSlug);
              nextRank++;
            }
          } else {
            stats.relationships_created++;
            resultEntry.relationships_created++;
            existingTargetSlugs.add(matchedSlug);
            nextRank++;
          }
        }

        stats.processed++;
      } catch (err) {
        stats.errors++;
        resultEntry.error = err instanceof Error ? err.message : String(err);
      }

      results.push(resultEntry);
    }

    return respond({
      dry_run: dryRun,
      stats,
      results: results.slice(0, 100),
      result_count: results.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return respond({ error: "Internal error", detail: msg }, 500);
  }
});
