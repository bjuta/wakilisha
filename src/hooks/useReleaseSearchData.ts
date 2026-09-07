import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  releaseTypeLabelFromActiveTrackCount,
} from "@/utils/releaseUrl";

export interface ReleaseSearchItem {
  id: string;
  slug: string;
  title: string;
  artistName: string;
  artistSlug: string;
  artworkUrl: string;
  releaseType: "Single" | "EP" | "Album";
  releaseDate: string;
  trackCount: number;
}

export function useReleaseSearchData(enabled = true) {
  const [data, setData] = useState<ReleaseSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (!enabled) {
      setData([]);
      setLoading(false);
      setError(null);
      return () => {
        alive = false;
      };
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: releases, error: err } = await supabase
          .from("registry_releases")
          .select("id, slug, title, release_type, release_date, artwork_url")
          .eq("status", "active")
          .order("title")
          .limit(200);

        if (!alive) return;
        if (err) {
          console.error("Failed to fetch releases for search:", err.message);
          setError(err.message);
          return;
        }

        if (!releases || releases.length === 0) {
          setData([]);
          return;
        }

        const releaseIds = releases.map((r) => r.id);

        // Fetch primary artists
        const { data: releaseArtists, error: raErr } = await supabase
          .from("registry_release_artists")
          .select("release_id, artist_name_text, artist_slug")
          .in("release_id", releaseIds)
          .eq("is_primary", true)
          .eq("status", "active");

        if (!alive) return;
        if (raErr) console.error("Failed to fetch release artists:", raErr.message);

        const artistByReleaseId: Record<string, { name: string; slug: string }> = {};
        (releaseArtists || []).forEach((ra) => {
          if (!artistByReleaseId[ra.release_id]) {
            artistByReleaseId[ra.release_id] = {
              name: ra.artist_name_text || "Unknown",
              slug: ra.artist_slug || "",
            };
          }
        });

        // Fetch track counts
        const { data: trackCounts } = await supabase
          .from("registry_release_tracks")
          .select("release_id, track_id")
          .in("release_id", releaseIds)
          .eq("status", "active");

        const trackCountByRelease: Record<string, number> = {};
        (trackCounts || []).forEach((rt) => {
          trackCountByRelease[rt.release_id] = (trackCountByRelease[rt.release_id] || 0) + 1;
        });

        const mapped: ReleaseSearchItem[] = releases.flatMap((r) => {
          const artist = artistByReleaseId[r.id] || { name: "Unknown", slug: "" };
          const trackCount =
            trackCountByRelease[r.id] || 0;
          const releaseType =
            releaseTypeLabelFromActiveTrackCount(
              trackCount,
            );

          if (!releaseType) {
            return [];
          }

          return [{
            id: r.id,
            slug: r.slug,
            title: r.title,
            artistName: artist.name,
            artistSlug: artist.slug,
            artworkUrl: r.artwork_url || "",
            releaseType,
            releaseDate: r.release_date || "",
            trackCount,
          }];
        });

        if (alive) setData(mapped);
      } catch (e) {
        console.error("Failed to fetch releases for search:", e);
        if (alive) setError("Failed to load releases");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    return () => { alive = false; };
  }, [enabled]);

  return { data, loading, error };
}