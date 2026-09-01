import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { releaseTypeLabelFromActiveTrackCount } from "../_shared/release-taxonomy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDuration(ms) {
  if (!ms || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min + ":" + String(sec).padStart(2, "0");
}

function slugify(s) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function extractYear(dateStr) {
  if (!dateStr) return "";
  return dateStr.split("-")[0] || "";
}

interface TrackOut {
  slug?: string;
  artistSlug?: string;
  title: string;
  duration: string;
  artists?: string;
  previewUrl?: string;
}

interface ReleaseOut {
  slug: string;
  title: string;
  releaseType: string;
  year: string;
  releaseDate: string;
  trackCount: number;
  artworkUrl: string;
  artist?: string;
  tracks: TrackOut[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Supabase config missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const db = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    let body = {};
    try { body = await req.json(); } catch { /* no body */ }

    const artistSlug = String(body.artistSlug ?? url.searchParams.get("slug") ?? "").trim();
    if (!artistSlug) {
      return new Response(JSON.stringify({ error: "Missing artistSlug" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: artist, error: artistErr } = await db
      .from("registry_artists")
      .select("id, slug, display_name")
      .eq("slug", artistSlug)
      .eq("status", "active")
      .maybeSingle();

    if (artistErr || !artist) {
      return new Response(JSON.stringify({ error: artistErr?.message || "Artist not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const artistId = artist.id;

    const { data: primaryLinks } = await db
      .from("registry_release_artists")
      .select("release_id")
      .eq("artist_id", artistId)
      .eq("is_primary", true)
      .eq("status", "active");

    const primaryReleaseIds = (primaryLinks ?? []).map((r) => r.release_id);

    let ownReleases = [];
    if (primaryReleaseIds.length > 0) {
      const { data: releases } = await db
        .from("registry_releases")
        .select("id, title, slug, release_type, release_date, artwork_url")
        .in("id", primaryReleaseIds)
        .in("status", ["active", "draft"])
        .order("release_date", { ascending: false });

      if (releases) {
        for (const rel of releases) {
          const { data: relTracks } = await db
            .from("registry_release_tracks")
            .select("track_id, track_number, disc_number")
            .eq("release_id", rel.id)
            .eq("status", "active")
            .order("disc_number")
            .order("track_number");

          const trackIds = (relTracks ?? []).map((rt) => rt.track_id);

          let tracks = [];
          if (trackIds.length > 0) {
            const { data: trackRows } = await db
              .from("registry_tracks")
              .select("id, title, slug, duration_ms, preview_url")
              .in("id", trackIds);

            const { data: trackArtists } = await db
              .from("registry_track_artists")
              .select("track_id, artist_slug, artist_name_text, is_primary, credit_order")
              .in("track_id", trackIds)
              .eq("status", "active")
              .order("credit_order");

            const artistsByTrack = new Map();
            const primaryArtistSlugByTrack = new Map();
            for (const ta of (trackArtists ?? [])) {
              const list = artistsByTrack.get(ta.track_id) || [];
              list.push(ta.artist_name_text);
              artistsByTrack.set(ta.track_id, list);
              if (ta.artist_slug && (ta.is_primary || !primaryArtistSlugByTrack.has(ta.track_id))) {
                primaryArtistSlugByTrack.set(ta.track_id, ta.artist_slug);
              }
            }

            const trackMetaMap = new Map();
            for (const tr of (trackRows ?? [])) {
              trackMetaMap.set(tr.id, {
                durationMs: tr.duration_ms ?? null,
                previewUrl: tr.preview_url ?? null,
              });
            }

            tracks = (relTracks ?? [])
              .map((rt) => {
                const t = (trackRows ?? []).find((tr) => tr.id === rt.track_id);
                if (!t) return null;
                const meta = trackMetaMap.get(t.id);
                const trackArtistsList = artistsByTrack.get(t.id) || [];
                const nonPageArtist = trackArtistsList.filter((a) => a !== artist.display_name);
                const artists = nonPageArtist.length > 0 ? nonPageArtist.join(", ") : undefined;
                return {
                  slug: t.slug || "",
                  artistSlug: primaryArtistSlugByTrack.get(t.id) || artistSlug,
                  title: t.title || "",
                  duration: formatDuration(meta?.durationMs ?? null),
                  artists,
                  previewUrl: meta?.previewUrl || undefined,
                };
              })
              .filter(Boolean);
          }

          ownReleases.push({
            slug: rel.slug,
            title: rel.title,
            releaseType: releaseTypeLabelFromActiveTrackCount(tracks.length) || "Release",
            year: extractYear(rel.release_date),
            releaseDate: rel.release_date || "",
            trackCount: tracks.length,
            artworkUrl: rel.artwork_url || "",
            tracks,
          });
        }
      }
    }

    const { data: featuredTrackArtists } = await db
      .from("registry_track_artists")
      .select("track_id")
      .eq("artist_slug", artistSlug)
      .eq("is_primary", false)
      .eq("status", "active");

    let appearsOn = [];
    if (featuredTrackArtists && featuredTrackArtists.length > 0) {
      const featuredTrackIds = featuredTrackArtists.map((t) => t.track_id);

      const { data: featuredReleaseTracks } = await db
        .from("registry_release_tracks")
        .select("release_id, track_id")
        .in("track_id", featuredTrackIds)
        .eq("status", "active");

      if (featuredReleaseTracks && featuredReleaseTracks.length > 0) {
        const featuredReleaseIds = [...new Set(featuredReleaseTracks.map((rt) => rt.release_id))]
          .filter((rid) => !primaryReleaseIds.includes(rid));

        if (featuredReleaseIds.length > 0) {
          const { data: featuredReleases } = await db
            .from("registry_releases")
            .select("id, title, slug, release_type, release_date, artwork_url")
            .in("id", featuredReleaseIds)
            .in("status", ["active", "draft"])
            .order("release_date", { ascending: false });

          if (featuredReleases) {
            const seenTitles = new Set();

            for (const rel of featuredReleases) {
              const titleKey = rel.title.toLowerCase().trim();
              if (seenTitles.has(titleKey)) continue;
              seenTitles.add(titleKey);

              const { data: primaryArtistLink } = await db
                .from("registry_release_artists")
                .select("artist_name_text, artist_slug")
                .eq("release_id", rel.id)
                .eq("is_primary", true)
                .eq("status", "active")
                .maybeSingle();

              const { data: releaseMemberships } = await db
                .from("registry_release_tracks")
                .select("track_id, track_number, disc_number")
                .eq("release_id", rel.id)
                .eq("status", "active")
                .order("disc_number")
                .order("track_number");

              const releaseTrackIds = (releaseMemberships ?? [])
                .map((rt) => rt.track_id);

              let tracks = [];
              if (releaseTrackIds.length > 0) {
                const { data: trackRows } = await db
                  .from("registry_tracks")
                  .select("id, title, slug, duration_ms, preview_url")
                  .in("id", releaseTrackIds);

                const { data: allTrackArtists } = await db
                  .from("registry_track_artists")
                  .select("track_id, artist_slug, artist_name_text, is_primary, credit_order")
                  .in("track_id", releaseTrackIds)
                  .eq("status", "active")
                  .order("credit_order");

                const artistsByTrack = new Map();
                const primaryArtistSlugByTrack = new Map();
                for (const ta of (allTrackArtists ?? [])) {
                  const list = artistsByTrack.get(ta.track_id) || [];
                  list.push(ta.artist_name_text);
                  artistsByTrack.set(ta.track_id, list);
                  if (ta.artist_slug && (ta.is_primary || !primaryArtistSlugByTrack.has(ta.track_id))) {
                    primaryArtistSlugByTrack.set(ta.track_id, ta.artist_slug);
                  }
                }

                const trackMetaMap = new Map();
                for (const tr of (trackRows ?? [])) {
                  trackMetaMap.set(tr.id, {
                    durationMs: tr.duration_ms ?? null,
                    previewUrl: tr.preview_url ?? null,
                  });
                }

                tracks = (trackRows ?? []).map((t) => {
                  const meta = trackMetaMap.get(t.id);
                  const trackArtistsList = artistsByTrack.get(t.id) || [];
                  const nonPageArtist = trackArtistsList.filter((a) => a !== artist.display_name);
                  const artistsStr = nonPageArtist.length > 0 ? nonPageArtist.join(", ") : undefined;
                  return {
                    slug: t.slug || "",
                    artistSlug: primaryArtistSlugByTrack.get(t.id) || primaryArtistLink?.artist_slug || "",
                    title: t.title || "",
                    duration: formatDuration(meta?.durationMs ?? null),
                    artists: artistsStr,
                    previewUrl: meta?.previewUrl || undefined,
                  };
                });
              }

              appearsOn.push({
                slug: rel.slug,
                title: rel.title,
                releaseType: releaseTypeLabelFromActiveTrackCount(tracks.length) || "Release",
                year: extractYear(rel.release_date),
                releaseDate: rel.release_date || "",
                trackCount: tracks.length,
                artworkUrl: rel.artwork_url || "",
                artist: primaryArtistLink?.artist_name_text || "Various Artists",
                tracks,
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      artist: { id: artistId, slug: artistSlug, name: artist.display_name },
      releases: ownReleases,
      appearsOn,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
