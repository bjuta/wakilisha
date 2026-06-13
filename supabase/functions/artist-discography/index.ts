import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const artistSlug = url.searchParams.get("slug");
    if (!artistSlug) {
      return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Step 1: All tracks this artist is linked to
    const { data: artistTrackLinks } = await supabase
      .from("registry_track_artists")
      .select("track_id")
      .eq("artist_slug", artistSlug);

    if (!artistTrackLinks || artistTrackLinks.length === 0) {
      return new Response(JSON.stringify({ releases: [], standaloneTracks: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const artistTrackIds = [...new Set(artistTrackLinks.map((t: any) => t.track_id))];

    // Step 2: Find ALL releases containing these tracks
    const { data: releaseTrackLinks } = await supabase
      .from("registry_release_tracks")
      .select("release_id, track_id, track_number")
      .in("track_id", artistTrackIds);

    if (!releaseTrackLinks || releaseTrackLinks.length === 0) {
      const standalone = await buildStandaloneTracks(supabase, artistTrackIds, new Set());
      return new Response(JSON.stringify({ releases: [], standaloneTracks: standalone }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidateReleaseIds = [...new Set(releaseTrackLinks.map((rt: any) => rt.release_id))];

    // Step 3: Get release metadata
    const { data: releaseRows } = await supabase
      .from("registry_releases")
      .select("id, slug, title, release_type, release_date, artwork_url")
      .in("id", candidateReleaseIds);

    if (!releaseRows || releaseRows.length === 0) {
      const standalone = await buildStandaloneTracks(supabase, artistTrackIds, new Set());
      return new Response(JSON.stringify({ releases: [], standaloneTracks: standalone }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: Check which releases are explicitly linked to this artist
    const { data: releaseArtistLinks } = await supabase
      .from("registry_release_artists")
      .select("release_id, is_primary")
      .eq("artist_slug", artistSlug)
      .in("release_id", candidateReleaseIds);

    const artistLinkedReleaseIds = new Set(
      (releaseArtistLinks || []).map((ra: any) => ra.release_id)
    );

    // Step 5: Count tracks per release from the releaseTrackLinks we already have
    const trackCountPerRelease = new Map<string, number>();
    for (const rt of releaseTrackLinks) {
      trackCountPerRelease.set(rt.release_id, (trackCountPerRelease.get(rt.release_id) || 0) + 1);
    }

    // Step 6: Group releases by title (case-insensitive) and pick the best one.
    // For each title group, prefer the release that's explicitly linked AND has tracks.
    // If the linked release has 0 tracks, fall back to the one with the most tracks.
    const titleGroups = new Map<string, { releaseId: string; slug: string; title: string; releaseType: string; releaseDate: string; artworkUrl: string; isLinked: boolean; trackCount: number }[]>();

    for (const r of releaseRows) {
      const key = (r.title || "").toLowerCase().trim();
      if (!key) continue;
      if (!titleGroups.has(key)) titleGroups.set(key, []);

      const trackCount = trackCountPerRelease.get(r.id) || 0;

      titleGroups.get(key)!.push({
        releaseId: r.id,
        slug: r.slug,
        title: r.title,
        releaseType: r.release_type || "album",
        releaseDate: r.release_date || "",
        artworkUrl: r.artwork_url || "",
        isLinked: artistLinkedReleaseIds.has(r.id),
        trackCount,
      });
    }

    // Step 7: Pick the best release per title group
    // Prefer: linked with tracks > non-linked with tracks > linked with 0 tracks > non-linked with 0 tracks
    const bestReleases: { releaseId: string; slug: string; title: string; releaseType: string; releaseDate: string; artworkUrl: string }[] = [];

    for (const [titleKey, candidates] of titleGroups) {
      candidates.sort((a, b) => {
        // First: has tracks beats 0 tracks
        if ((a.trackCount > 0) !== (b.trackCount > 0)) return a.trackCount > 0 ? -1 : 1;
        // Second: linked beats non-linked
        if (a.isLinked !== b.isLinked) return a.isLinked ? -1 : 1;
        // Third: more tracks beats fewer tracks
        if (a.trackCount !== b.trackCount) return b.trackCount - a.trackCount;
        return (b.releaseDate || "").localeCompare(a.releaseDate || "");
      });

      const best = candidates[0];
      // Only include if the best has tracks (skip 0-track ghosts)
      if (best.trackCount === 0) continue;

      bestReleases.push({
        releaseId: best.releaseId,
        slug: best.slug,
        title: best.title,
        releaseType: best.releaseType,
        releaseDate: best.releaseDate,
        artworkUrl: best.artworkUrl,
      });
    }

    // Step 8: Track details for ALL releases in the best set
    const bestReleaseIds = new Set(bestReleases.map((br) => br.releaseId));
    const allTrackIdsForBest = new Set<string>();

    const trackIdsByRelease = new Map<string, { trackId: string; trackNumber: number }[]>();

    for (const rt of releaseTrackLinks) {
      if (!bestReleaseIds.has(rt.release_id)) continue;
      const rid = rt.release_id;
      if (!trackIdsByRelease.has(rid)) trackIdsByRelease.set(rid, []);
      trackIdsByRelease.get(rid)!.push({ trackId: rt.track_id, trackNumber: rt.track_number || 0 });
      allTrackIdsForBest.add(rt.track_id);
    }

    const allTrackIdsArr = [...allTrackIdsForBest];
    const trackById = new Map<string, any>();

    if (allTrackIdsArr.length > 0 && allTrackIdsArr.length <= 1000) {
      const { data: trackRows } = await supabase
        .from("registry_tracks")
        .select("id, title, duration_ms, artwork_url")
        .in("id", allTrackIdsArr);

      for (const t of (trackRows || [])) {
        trackById.set(t.id, t);
      }
    }

    // Step 9: Build release list
    const releases: any[] = [];
    for (const br of bestReleases) {
      const releaseDate = br.releaseDate;
      const year = releaseDate ? String(releaseDate).match(/\d{4}/)?.[0] || "" : "";
      const trackInfos = trackIdsByRelease.get(br.releaseId) || [];
      const count = trackInfos.length;

      const tracks = trackInfos
        .sort((a, b) => a.trackNumber - b.trackNumber)
        .map((ti) => {
          const t = trackById.get(ti.trackId);
          const durationMs = t?.duration_ms;
          const duration = durationMs
            ? `${Math.floor(durationMs / 60000)}:${String(Math.floor((durationMs % 60000) / 1000)).padStart(2, "0")}`
            : "";
          return {
            title: t?.title || `Track ${ti.trackNumber || "?"}`,
            duration,
          };
        });

      releases.push({
        slug: br.slug,
        title: br.title,
        releaseType: br.releaseType,
        year,
        releaseDate,
        trackCount: count,
        artworkUrl: br.artworkUrl,
        tracks: tracks.slice(0, 20),
      });
    }

    releases.sort((a: any, b: any) => {
      if (!a.releaseDate && !b.releaseDate) return 0;
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return b.releaseDate.localeCompare(a.releaseDate);
    });

    // Step 10: Standalone tracks
    const standaloneTracks = await buildStandaloneTracks(supabase, artistTrackIds, allTrackIdsForBest);

    return new Response(JSON.stringify({ releases, standaloneTracks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("artist-discography error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildStandaloneTracks(
  supabase: any,
  artistTrackIds: string[],
  trackIdsInReleases: Set<string>
): Promise<any[]> {
  const standaloneIds = artistTrackIds.filter((id) => !trackIdsInReleases.has(id));
  if (standaloneIds.length === 0) return [];

  const { data: rows } = await supabase
    .from("registry_tracks")
    .select("id, slug, title, duration_ms, artwork_url")
    .in("id", standaloneIds);

  const { data: artists } = await supabase
    .from("registry_track_artists")
    .select("track_id, artist_slug, artist_name_text, is_primary, credit_order")
    .in("track_id", standaloneIds)
    .order("credit_order", { ascending: true });

  const artistsByTrackId = new Map<string, string[]>();
  for (const ta of (artists || [])) {
    if (!artistsByTrackId.has(ta.track_id)) artistsByTrackId.set(ta.track_id, []);
    artistsByTrackId.get(ta.track_id)!.push(ta.artist_name_text || ta.artist_slug);
  }

  return (rows || []).map((t: any) => {
    const durationMs = t.duration_ms;
    const duration = durationMs
      ? `${Math.floor(durationMs / 60000)}:${String(Math.floor((durationMs % 60000) / 1000)).padStart(2, "0")}`
      : "";
    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      duration,
      image: t.artwork_url || "",
      artists: (artistsByTrackId.get(t.id) || []).join(", "),
      songUrl: "",
    };
  });
}
