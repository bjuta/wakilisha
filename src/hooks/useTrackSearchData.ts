import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildTrackCardBlurb } from "@/services/cultureContext/trackAdapters";

export interface TrackSearchItem {
  slug: string;
  title: string;
  artist: string;
  genre: string;
  artworkUrl: string;
  isPlayable: boolean;
  source: string;
  label: string;
  contextText: string;
}

export function useTrackSearchData() {
  const [data, setData] = useState<TrackSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all active tracks
        const { data: tracks, error: err } = await supabase
          .from("registry_tracks")
          .select("id, slug, title, artwork_url, preview_url, metadata, release_id")
          .eq("status", "active")
          .order("title");

        if (!alive) return;
        if (err) {
          console.error("Failed to fetch tracks for search:", err.message);
          setError(err.message);
          return;
        }

        if (!tracks || tracks.length === 0) {
          setData([]);
          return;
        }

        const trackIds = tracks.map((t) => t.id);
        const releaseIds = [...new Set(tracks.map((t) => t.release_id).filter(Boolean))];

        // Fetch primary artists for all tracks
        const { data: trackArtists, error: taErr } = await supabase
          .from("registry_track_artists")
          .select("track_id, artist_name_text, artist_slug")
          .in("track_id", trackIds)
          .eq("is_primary", true)
          .eq("status", "active");

        if (!alive) return;
        if (taErr) console.error("Failed to fetch track artists:", taErr.message);

        const artistByTrackId: Record<string, { name: string; slug: string }> = {};
        (trackArtists || []).forEach((ta) => {
          if (!artistByTrackId[ta.track_id]) {
            artistByTrackId[ta.track_id] = { name: ta.artist_name_text || "Unknown", slug: ta.artist_slug || "" };
          }
        });

        // Fetch artist metadata for genre info
        const artistSlugs = [...new Set((trackArtists || []).map((ta) => ta.artist_slug).filter(Boolean))] as string[];
        let artistGenreMap: Record<string, string> = {};
        if (artistSlugs.length > 0) {
          const { data: artistsWithGenres } = await supabase
            .from("registry_artists")
            .select("slug, metadata")
            .in("slug", artistSlugs)
            .eq("status", "active");

          (artistsWithGenres || []).forEach((a) => {
            const meta = (a.metadata as Record<string, unknown>) || {};
            const genres = Array.isArray(meta.genres) ? (meta.genres as string[]) : [];
            if (genres.length > 0) artistGenreMap[a.slug] = genres[0];
          });
        }

        // Fetch release metadata for label info
        let releaseLabelMap: Record<string, string> = {};
        if (releaseIds.length > 0) {
          const { data: releases } = await supabase
            .from("registry_releases")
            .select("id, metadata")
            .in("id", releaseIds)
            .eq("status", "active");

          (releases || []).forEach((r) => {
            const meta = (r.metadata as Record<string, unknown>) || {};
            const label = typeof meta.record_label === "string" ? meta.record_label : "";
            if (label) releaseLabelMap[r.id] = label;
          });
        }

        const mapped: TrackSearchItem[] = tracks.map((t) => {
          const artistInfo = artistByTrackId[t.id];
          const artistSlug = artistInfo?.slug || "";
          const artist = artistInfo?.name || "Unknown";
          const genre = artistGenreMap[artistSlug] || "";
          const label = t.release_id ? (releaseLabelMap[t.release_id] || "") : "";
          return {
            slug: t.slug,
            title: t.title,
            artist,
            genre,
            artworkUrl: t.artwork_url || "",
            isPlayable: !!t.preview_url,
            source: "apple_music",
            label,
            contextText: buildTrackCardBlurb({ title: t.title, artist, genre, label, isPlayable: !!t.preview_url }),
          };
        });

        setData(mapped);
      } catch (e) {
        console.error("Failed to fetch tracks for search:", e);
        if (alive) setError("Failed to load tracks");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    return () => { alive = false; };
  }, []);

  return { data, loading, error };
}
