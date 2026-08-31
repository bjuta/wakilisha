import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildTrackSearchSnippet } from "@/services/cultureContext/trackAdapters";

export interface TrackSearchItem {
  id: string;
  slug: string;
  artistSlug: string;
  title: string;
  artist: string;
  genre: string;
  artworkUrl: string;
  isPlayable: boolean;
  source: string;
  label: string;
  contextText: string;
  previewUrl: string | null;
}

type TrackRow = {
  id: string;
  slug: string;
  title: string;
  artwork_url: string | null;
  preview_url: string | null;
  metadata: Record<string, unknown> | null;
};

type TrackArtistRow = {
  track_id: string;
  artist_name_text: string | null;
  artist_slug: string | null;
};

type ArtistGenreRow = {
  slug: string;
  metadata: Record<string, unknown> | null;
};

type ReleaseLabelRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

const QUERY_CHUNK_SIZE = 100;

function chunks<T>(items: T[], size = QUERY_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function useTrackSearchData(enabled = true) {
  const [data, setData] = useState<TrackSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (!enabled) {
      setLoading(false);
      setError(null);
      return () => {
        alive = false;
      };
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: tracksRaw, error: err } = await supabase
          .from("registry_tracks")
          .select("id, slug, title, artwork_url, preview_url, metadata")
          .eq("status", "active")
          .order("title");

        if (!alive) return;

        if (err) {
          console.error("Failed to fetch tracks for search:", err.message);
          setError(err.message);
          setData([]);
          return;
        }

        const tracks = (tracksRaw || []) as TrackRow[];

        if (tracks.length === 0) {
          setData([]);
          return;
        }

        const trackIds = tracks.map((t) => t.id).filter(Boolean);
        const releaseIdByTrackId = new Map<string, string>();

        for (const batchIds of chunks(trackIds)) {
          const { data: memberships, error: membershipErr } = await supabase
            .from("registry_release_tracks")
            .select("track_id, release_id")
            .in("track_id", batchIds)
            .eq("status", "active")
            .order("disc_number", { ascending: true })
            .order("track_number", { ascending: true });

          if (membershipErr) {
            console.error("Failed to fetch Track Release memberships:", membershipErr.message);
            continue;
          }

          for (const membership of memberships || []) {
            const trackId = String(membership.track_id || "");
            const releaseId = String(membership.release_id || "");

            if (
              !trackId ||
              !releaseId ||
              releaseIdByTrackId.has(trackId)
            ) {
              continue;
            }

            releaseIdByTrackId.set(trackId, releaseId);
          }
        }

        const releaseIds = [
          ...new Set(releaseIdByTrackId.values()),
        ];

        const trackArtists: TrackArtistRow[] = [];

        for (const batchIds of chunks(trackIds)) {
          const { data: batch, error: batchErr } = await supabase
            .from("registry_track_artists")
            .select("track_id, artist_name_text, artist_slug")
            .in("track_id", batchIds)
            .eq("is_primary", true)
            .eq("status", "active");

          if (batchErr) {
            console.error("Failed to fetch track artists batch:", batchErr.message);
            continue;
          }

          trackArtists.push(...((batch || []) as TrackArtistRow[]));
        }

        if (!alive) return;

        const artistByTrackId: Record<string, { name: string; slug: string }> = {};
        trackArtists.forEach((ta) => {
          if (!artistByTrackId[ta.track_id]) {
            artistByTrackId[ta.track_id] = {
              name: ta.artist_name_text || "Unknown",
              slug: ta.artist_slug || "",
            };
          }
        });

        const artistSlugs = [
          ...new Set(
            trackArtists
              .map((ta) => ta.artist_slug)
              .filter(Boolean),
          ),
        ] as string[];
        const artistGenreMap: Record<string, string> = {};

        const {
          data: artistsWithGenres,
          error: artistErr,
        } = await supabase.rpc(
          "get_public_registry_artists_for_search",
          {
            p_limit: 500,
          },
        );

        if (artistErr) {
          console.error(
            "Failed to fetch artist genres:",
            artistErr.message,
          );
        } else {
          const wantedSlugs =
            new Set(artistSlugs);

          (
            (artistsWithGenres || []) as
              ArtistGenreRow[]
          ).forEach((a) => {
            if (!wantedSlugs.has(a.slug)) {
              return;
            }

            const meta = a.metadata || {};
            const genres =
              Array.isArray(meta.genres)
                ? (meta.genres as string[])
                : [];

            if (genres.length > 0) {
              artistGenreMap[a.slug] =
                genres[0];
            }
          });
        }

        const releaseLabelMap: Record<string, string> = {};

        for (const releaseBatch of chunks(releaseIds)) {
          const { data: releases, error: releaseErr } = await supabase
            .from("registry_releases")
            .select("id, metadata")
            .in("id", releaseBatch)
            .eq("status", "active");

          if (releaseErr) {
            console.error("Failed to fetch release labels batch:", releaseErr.message);
            continue;
          }

          ((releases || []) as ReleaseLabelRow[]).forEach((r) => {
            const meta = r.metadata || {};
            const label = typeof meta.record_label === "string" ? meta.record_label : "";
            if (label) releaseLabelMap[r.id] = label;
          });
        }

        if (!alive) return;

        const mapped: TrackSearchItem[] = tracks.map((t) => {
          const artistInfo = artistByTrackId[t.id];
          const artistSlug = artistInfo?.slug || "";
          const artist = artistInfo?.name || "Unknown";
          const genre = artistGenreMap[artistSlug] || "";
          const releaseId =
            releaseIdByTrackId.get(t.id) || "";
          const label = releaseId
            ? releaseLabelMap[releaseId] || ""
            : "";
          const contextText = buildTrackSearchSnippet({
            title: t.title || "Untitled track",
            artist,
            genre,
            label,
            isPlayable: !!t.preview_url,
          });

          return {
            id: t.id,
            slug: t.slug,
            artistSlug,
            title: t.title || "Untitled track",
            artist,
            genre,
            artworkUrl: t.artwork_url || "",
            isPlayable: !!t.preview_url,
            source: "apple_music",
            label,
            contextText,
            previewUrl: t.preview_url,
          };
        });

        setData(mapped);
      } catch (e) {
        console.error("Failed to fetch tracks for search:", e);
        if (alive) {
          setError("Failed to load tracks");
          setData([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();

    return () => {
      alive = false;
    };
  }, [enabled]);

  return { data, loading, error };
}
