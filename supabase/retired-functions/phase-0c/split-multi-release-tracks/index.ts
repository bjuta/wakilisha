import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };

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

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const dryRun = body.dryRun === true;

    // 1. Get all release_tracks
    const { data: releaseTrackPairs, error: rtErr } = await supabase
      .from("registry_release_tracks")
      .select("track_id, release_id, track_number")
      .eq("status", "active");

    if (rtErr) return respond({ error: rtErr.message }, 500);
    if (!releaseTrackPairs || releaseTrackPairs.length === 0) {
      return respond({ error: "No release_tracks found" }, 500);
    }

    // Group by track_id
    const trackReleases = new Map<string, Array<{ release_id: string; track_number: number | null }>>();
    for (const rt of releaseTrackPairs) {
      if (!trackReleases.has(rt.track_id)) trackReleases.set(rt.track_id, []);
      trackReleases.get(rt.track_id)!.push({ release_id: rt.release_id, track_number: rt.track_number });
    }

    // Find tracks with >1 release
    const multiTrackIds = [...trackReleases.entries()]
      .filter(([, releases]) => releases.length > 1)
      .map(([tid]) => tid);

    if (multiTrackIds.length === 0) {
      return respond({ message: "No multi-release tracks found. All clean!", dryRun });
    }

    // 2. Get full track data
    const { data: tracks, error: tracksErr } = await supabase
      .from("registry_tracks")
      .select("id, slug, title, normalized_title, isrc, release_id, duration_ms, track_number, disc_number, artwork_url, status, metadata")
      .in("id", multiTrackIds);

    if (tracksErr) return respond({ error: tracksErr.message }, 500);
    if (!tracks || tracks.length === 0) return respond({ error: "No tracks found" }, 500);

    const trackMap = new Map(tracks.map((t: any) => [t.id, t]));

    // 3. Get track_artists
    const { data: trackArtists, error: taErr } = await supabase
      .from("registry_track_artists")
      .select("track_id, artist_slug, artist_name_text, artist_id, role, is_primary, is_featured, credit_order, confidence")
      .in("track_id", multiTrackIds)
      .eq("status", "active");

    if (taErr) return respond({ error: taErr.message }, 500);

    const trackArtistsMap = new Map<string, any[]>();
    for (const ta of trackArtists || []) {
      if (!trackArtistsMap.has(ta.track_id)) trackArtistsMap.set(ta.track_id, []);
      trackArtistsMap.get(ta.track_id)!.push(ta);
    }

    // 4. Get release slugs for naming
    const allReleaseIds = new Set<string>();
    for (const [, releases] of trackReleases) {
      for (const r of releases) allReleaseIds.add(r.release_id);
    }

    const { data: releases, error: relErr } = await supabase
      .from("registry_releases")
      .select("id, slug, title")
      .in("id", [...allReleaseIds]);

    if (relErr) return respond({ error: relErr.message }, 500);

    const releaseMap = new Map((releases || []).map((r: any) => [r.id, r]));

    // 5. Process each multi-release track
    const results: any[] = [];
    let totalNewTracks = 0;
    let totalArtistCopies = 0;

    for (const trackId of multiTrackIds) {
      const track = trackMap.get(trackId);
      if (!track) continue;

      const linkedReleases = trackReleases.get(trackId) || [];
      if (linkedReleases.length <= 1) continue;

      const keeperReleaseId = track.release_id && linkedReleases.some((r: any) => r.release_id === track.release_id)
        ? track.release_id
        : linkedReleases.sort((a: any, b: any) => {
            const nameA = releaseMap.get(a.release_id)?.title || "";
            const nameB = releaseMap.get(b.release_id)?.title || "";
            return nameA.localeCompare(nameB);
          })[0].release_id;

      const extraReleases = linkedReleases.filter((r: any) => r.release_id !== keeperReleaseId);

      const trackResult: any = {
        track_id: trackId,
        track_title: track.title,
        keeper_release: releaseMap.get(keeperReleaseId)?.title || keeperReleaseId,
        extra_releases: extraReleases.map((r: any) => releaseMap.get(r.release_id)?.title || r.release_id),
        new_track_ids: [] as string[],
      };

      for (const extra of extraReleases) {
        const extraRelease = releaseMap.get(extra.release_id);
        const releaseSlug = extraRelease?.slug || extra.release_id.slice(0, 12);
        const newSlug = `${track.slug}-${releaseSlug}`.slice(0, 160);
        const newId = crypto.randomUUID();
        trackResult.new_track_ids.push(newId);

        if (!dryRun) {
          const { error: insertErr } = await supabase.from("registry_tracks").insert({
            id: newId,
            slug: newSlug,
            title: track.title,
            normalized_title: track.normalized_title || "",
            isrc: track.isrc || null,
            release_id: extra.release_id,
            duration_ms: track.duration_ms,
            track_number: extra.track_number || track.track_number,
            disc_number: track.disc_number || 1,
            artwork_url: track.artwork_url || null,
            status: "active",
            metadata: {
              source: "multi_release_split_repair",
              split_from_track_id: trackId,
              split_at: new Date().toISOString(),
            },
          });

          if (insertErr) {
            trackResult.errors = trackResult.errors || [];
            trackResult.errors.push(`Insert failed for ${extraRelease?.title}: ${insertErr.message}`);
            continue;
          }

          const { error: updateErr } = await supabase
            .from("registry_release_tracks")
            .update({
              track_id: newId,
              metadata: {
                source: "multi_release_split_repair",
                original_track_id: trackId,
                split_at: new Date().toISOString(),
              },
            })
            .eq("release_id", extra.release_id)
            .eq("track_id", trackId)
            .eq("status", "active");

          if (updateErr) {
            trackResult.errors = trackResult.errors || [];
            trackResult.errors.push(`Release-track update failed: ${updateErr.message}`);
          }

          const artists = trackArtistsMap.get(trackId) || [];
          if (artists.length > 0) {
            const taRows = artists.map((ta: any) => ({
              track_id: newId,
              artist_slug: ta.artist_slug,
              artist_name_text: ta.artist_name_text,
              artist_id: ta.artist_id || null,
              role: ta.role || "primary_artist",
              is_primary: ta.is_primary ?? true,
              is_featured: ta.is_featured ?? false,
              credit_order: ta.credit_order || 1,
              source: "multi_release_split_repair",
              confidence: ta.confidence || 70,
              status: "active",
              metadata: {
                split_from_track_id: trackId,
                split_at: new Date().toISOString(),
              },
            }));

            const { error: taInsertErr } = await supabase
              .from("registry_track_artists")
              .insert(taRows);

            if (taInsertErr) {
              trackResult.errors = trackResult.errors || [];
              trackResult.errors.push(`Track artists copy failed: ${taInsertErr.message}`);
            } else {
              totalArtistCopies += taRows.length;
            }
          }

          totalNewTracks++;
        }
      }

      results.push(trackResult);
    }

    return respond({
      success: true,
      dryRun,
      multi_track_count: multiTrackIds.length,
      new_tracks_created: totalNewTracks,
      artist_copies: totalArtistCopies,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return respond({ error: "Internal error", detail: msg }, 500);
  }
});
