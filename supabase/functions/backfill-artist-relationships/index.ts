// Backfill Artist Relationships — derives artist-to-artist connections from chart co-appearances, track collaborations, and shared releases.
// Writes into registry_entity_relationships with source_kind = 'derived:*' markers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const results: Record<string, { deleted: number; inserted: number; errors: string[] }> = {};

  try {
    // ── Step 0: Purge all previously derived artist→artist relationships ──
    const { error: deleteErr, count: deletedCount } = await supabase
      .from("registry_entity_relationships")
      .delete({ count: "exact" })
      .eq("source_entity_type", "artist")
      .eq("target_entity_type", "artist")
      .like("source_kind", "derived:%");

    if (deleteErr) {
      return new Response(JSON.stringify({ ok: false, error: `Delete failed: ${deleteErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const deleted = deletedCount ?? 0;

    const iso = () => new Date().toISOString();
    const now = iso();

    // ── Phase 1: Shared chart entries ──
    const phase1 = { deleted: 0, inserted: 0, errors: [] as string[] };
    try {
      const { data: chartPairs, error: cErr } = await supabase.rpc("derive_chart_artist_pairs");
      // Fallback to raw SQL if RPC doesn't exist — we'll build pairs client-side
      if (cErr || !chartPairs) {
        // Query all chart entries and build pairs in JS
        const { data: allEntries } = await supabase
          .from("wk_chart_entries_v2")
          .select("artist_slug, edition_id, track_title")
          .not("artist_slug", "is", null);

        if (allEntries && allEntries.length > 0) {
          const editionMap = new Map<string, Array<{ slug: string; title: string }>>();
          for (const e of allEntries as any[]) {
            const ed = String(e.edition_id);
            if (!editionMap.has(ed)) editionMap.set(ed, []);
            editionMap.get(ed)!.push({ slug: String(e.artist_slug), title: String(e.track_title || "") });
          }

          const pairMap = new Map<string, { sharedCount: number; sharedTitles: string[] }>();
          for (const [, artists] of editionMap) {
            for (let i = 0; i < artists.length; i++) {
              for (let j = i + 1; j < artists.length; j++) {
                const a = artists[i];
                const b = artists[j];
                if (a.slug === b.slug) continue;
                const key = [a.slug, b.slug].sort().join("|||");
                if (!pairMap.has(key)) pairMap.set(key, { sharedCount: 0, sharedTitles: [] });
                const entry = pairMap.get(key)!;
                entry.sharedCount++;
                if (a.title && !entry.sharedTitles.includes(a.title)) entry.sharedTitles.push(a.title);
                if (b.title && !entry.sharedTitles.includes(b.title)) entry.sharedTitles.push(b.title);
              }
            }
          }

          const rows: any[] = [];
          for (const [key, data] of pairMap) {
            const [slugA, slugB] = key.split("|||");
            const confidence = Math.min(data.sharedCount / 10, 1.0);
            rows.push({
              source_entity_type: "artist",
              source_slug: slugA,
              target_entity_type: "artist",
              target_slug: slugB,
              relationship_type: "shared_chart",
              relationship_status: "active",
              source_kind: "derived:chart_shared",
              confidence,
              metadata: {
                shared_chart_count: data.sharedCount,
                shared_chart_titles: data.sharedTitles.slice(0, 20),
              },
              created_at: now,
              updated_at: now,
            });
          }

          if (rows.length > 0) {
            // Insert in batches of 100
            for (let i = 0; i < rows.length; i += 100) {
              const batch = rows.slice(i, i + 100);
              const { error: insErr } = await supabase.from("registry_entity_relationships").insert(batch);
              if (insErr) phase1.errors.push(insErr.message);
              else phase1.inserted += batch.length;
            }
          }
        }
      }
    } catch (e: any) {
      phase1.errors.push(e.message);
    }
    results["phase1_chart_shared"] = phase1;

    // ── Phase 2: Track collaborations (primary ↔ featured, co-primary, co-featured) ──
    const phase2 = { deleted: 0, inserted: 0, errors: [] as string[] };
    try {
      const { data: trackArtists } = await supabase
        .from("registry_track_artists")
        .select("track_id, artist_slug, is_primary, is_featured")
        .eq("status", "active");

      if (trackArtists && trackArtists.length > 0) {
        // Group by track
        const trackMap = new Map<string, Array<{ slug: string; isPrimary: boolean; isFeatured: boolean }>>();
        for (const ta of trackArtists as any[]) {
          const tid = String(ta.track_id);
          if (!trackMap.has(tid)) trackMap.set(tid, []);
          trackMap.get(tid)!.push({
            slug: String(ta.artist_slug),
            isPrimary: Boolean(ta.is_primary),
            isFeatured: Boolean(ta.is_featured),
          });
        }

        // Get track titles for metadata
        const allTrackIds = [...trackMap.keys()];
        const { data: trackRows } = allTrackIds.length > 0
          ? await supabase.from("registry_tracks").select("id, title").in("id", allTrackIds.slice(0, 500))
          : { data: [] };
        const titleById = new Map((trackRows ?? []).map((t: any) => [String(t.id), String(t.title || "")]));

        // Build pairs per track
        const pairMap = new Map<string, {
          sharedCount: number;
          sharedTitles: string[];
          primaryToFeatured: boolean; // artist_a is primary, artist_b is featured
          featuredToPrimary: boolean; // artist_a is featured, artist_b is primary
          bothPrimary: boolean;
          bothFeatured: boolean;
        }>();

        for (const [trackId, artists] of trackMap) {
          for (let i = 0; i < artists.length; i++) {
            for (let j = i + 1; j < artists.length; j++) {
              const a = artists[i];
              const b = artists[j];
              if (a.slug === b.slug || !a.slug || !b.slug) continue;
              const key = [a.slug, b.slug].sort().join("|||");
              const aIsFirst = a.slug === key.split("|||")[0];

              if (!pairMap.has(key)) {
                pairMap.set(key, { sharedCount: 0, sharedTitles: [], primaryToFeatured: false, featuredToPrimary: false, bothPrimary: false, bothFeatured: false });
              }
              const entry = pairMap.get(key)!;
              entry.sharedCount++;
              const title = titleById.get(trackId) || "";
              if (title && !entry.sharedTitles.includes(title)) entry.sharedTitles.push(title);

              // Determine relationship direction
              if (aIsFirst) {
                if (a.isPrimary && b.isFeatured) entry.primaryToFeatured = true;
                else if (a.isFeatured && b.isPrimary) entry.featuredToPrimary = true;
                else if (a.isPrimary && b.isPrimary) entry.bothPrimary = true;
                else if (a.isFeatured && b.isFeatured) entry.bothFeatured = true;
                else entry.bothPrimary = true; // fallback
              } else {
                if (b.isPrimary && a.isFeatured) entry.primaryToFeatured = true;
                else if (b.isFeatured && a.isPrimary) entry.featuredToPrimary = true;
                else if (a.isPrimary && b.isPrimary) entry.bothPrimary = true;
                else if (a.isFeatured && b.isFeatured) entry.bothFeatured = true;
                else entry.bothPrimary = true; // fallback
              }
            }
          }
        }

        const rows: any[] = [];
        for (const [key, data] of pairMap) {
          const [slugA, slugB] = key.split("|||");
          const confidence = Math.min(0.4 + data.sharedCount * 0.15, 1.0);

          // Create rows for each direction as needed
          if (data.primaryToFeatured) {
            rows.push({
              source_entity_type: "artist", source_slug: slugA,
              target_entity_type: "artist", target_slug: slugB,
              relationship_type: "features",
              relationship_status: "active",
              source_kind: "derived:track_collab",
              confidence,
              metadata: { shared_track_count: data.sharedCount, shared_titles: data.sharedTitles.slice(0, 20) },
              created_at: now, updated_at: now,
            });
          }
          if (data.featuredToPrimary) {
            rows.push({
              source_entity_type: "artist", source_slug: slugA,
              target_entity_type: "artist", target_slug: slugB,
              relationship_type: "featured_on",
              relationship_status: "active",
              source_kind: "derived:track_collab",
              confidence,
              metadata: { shared_track_count: data.sharedCount, shared_titles: data.sharedTitles.slice(0, 20) },
              created_at: now, updated_at: now,
            });
          }
          if (data.bothPrimary || data.bothFeatured) {
            rows.push({
              source_entity_type: "artist", source_slug: slugA,
              target_entity_type: "artist", target_slug: slugB,
              relationship_type: "collaboration",
              relationship_status: "active",
              source_kind: "derived:track_collab",
              confidence,
              metadata: { shared_track_count: data.sharedCount, shared_titles: data.sharedTitles.slice(0, 20) },
              created_at: now, updated_at: now,
            });
          }
        }

        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            const { error: insErr } = await supabase.from("registry_entity_relationships").insert(batch);
            if (insErr) phase2.errors.push(insErr.message);
            else phase2.inserted += batch.length;
          }
        }
      }
    } catch (e: any) {
      phase2.errors.push(e.message);
    }
    results["phase2_track_collab"] = phase2;

    // ── Phase 3: Shared releases ──
    const phase3 = { deleted: 0, inserted: 0, errors: [] as string[] };
    try {
      const { data: releaseArtists } = await supabase
        .from("registry_release_artists")
        .select("release_id, artist_slug")
        .eq("status", "active");

      if (releaseArtists && releaseArtists.length > 0) {
        const releaseMap = new Map<string, string[]>();
        for (const ra of releaseArtists as any[]) {
          const rid = String(ra.release_id);
          const slug = String(ra.artist_slug);
          if (!slug) continue;
          if (!releaseMap.has(rid)) releaseMap.set(rid, []);
          const list = releaseMap.get(rid)!;
          if (!list.includes(slug)) list.push(slug);
        }

        const pairMap = new Map<string, number>();
        for (const [, slugs] of releaseMap) {
          for (let i = 0; i < slugs.length; i++) {
            for (let j = i + 1; j < slugs.length; j++) {
              if (slugs[i] === slugs[j]) continue;
              const key = [slugs[i], slugs[j]].sort().join("|||");
              pairMap.set(key, (pairMap.get(key) || 0) + 1);
            }
          }
        }

        const rows: any[] = [];
        for (const [key, sharedCount] of pairMap) {
          const [slugA, slugB] = key.split("|||");
          const confidence = Math.min(sharedCount * 0.2, 0.8);
          rows.push({
            source_entity_type: "artist", source_slug: slugA,
            target_entity_type: "artist", target_slug: slugB,
            relationship_type: "shared_release",
            relationship_status: "active",
            source_kind: "derived:release_shared",
            confidence,
            metadata: { shared_release_count: sharedCount },
            created_at: now, updated_at: now,
          });
        }

        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            const { error: insErr } = await supabase.from("registry_entity_relationships").insert(batch);
            if (insErr) phase3.errors.push(insErr.message);
            else phase3.inserted += batch.length;
          }
        }
      }
    } catch (e: any) {
      phase3.errors.push(e.message);
    }
    results["phase3_release_shared"] = phase3;

    const totalInserted = Object.values(results).reduce((sum, r: any) => sum + (r.inserted || 0), 0);

    return new Response(JSON.stringify({
      ok: true,
      deleted,
      totalInserted,
      phases: results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});