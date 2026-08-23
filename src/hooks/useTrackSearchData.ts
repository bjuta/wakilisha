import { useEffect, useState } from "react";
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
  previewUrl: string | null;
  source: string;
  label: string;
  contextText: string;
}

type TrackRow = {
  id: string;
  slug: string;
  title: string;
  artwork_url: string | null;
  preview_url: string | null;
  metadata: Record<string, unknown> | null;
  release_id: string | null;
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
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

export function useTrackSearchData() {
  const [data, setData] = useState<TrackSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: tracksRaw, error: trackError } = await supabase
          .from("registry_tracks")
          .select("id, slug, title, artwork_url, preview_url, metadata, release_id")
          .eq("status", "active")
          .order("title");

        if (!alive) return;
        if (trackError) {
          console.error("Failed to fetch tracks for search:", trackError.message);
          setError(trackError.message);
          setData([]);
          return;
        }

        const tracks = (tracksRaw || []) as TrackRow[];
        if (!tracks.length) {
          setData([]);
          return;
        }

        const trackIds = tracks.map((track) => track.id).filter(Boolean);
        const releaseIds = [
          ...new Set(tracks.map((track) => track.release_id).filter(Boolean)),
        ] as string[];
        const trackArtists: TrackArtistRow[] = [];

        for (const batchIds of chunks(trackIds)) {
          const { data: batch, error: batchError } = await supabase
            .from("registry_track_artists")
            .select("track_id, artist_name_text, artist_slug")
            .in("track_id", batchIds)
            .eq("is_primary", true)
            .eq("status", "active");
          if (batchError) {
            console.error("Failed to fetch track artists batch:", batchError.message);
            continue;
          }
          trackArtists.push(...((batch || []) as TrackArtistRow[]));
        }

        if (!alive) return;

        const artistByTrackId: Record<string, { name: string; slug: string }> = {};
        trackArtists.forEach((trackArtist) => {
          if (!artistByTrackId[trackArtist.track_id]) {
            artistByTrackId[trackArtist.track_id] = {
              name: trackArtist.artist_name_text || "Unknown",
              slug: trackArtist.artist_slug || "",
            };
          }
        });

        const artistSlugs = [
          ...new Set(trackArtists.map((trackArtist) => trackArtist.artist_slug).filter(Boolean)),
        ] as string[];
        const artistGenreMap: Record<string, string> = {};

        for (const slugBatch of chunks(artistSlugs)) {
          const { data: artistsWithGenres, error: artistError } = await supabase
            .from("registry_artists")
            .select("slug, metadata")
            .in("slug", slugBatch)
            .eq("status", "active");
          if (artistError) {
            console.error("Failed to fetch artist genres batch:", artistError.message);
            continue;
          }
          ((artistsWithGenres || []) as ArtistGenreRow[]).forEach((artist) => {
            const metadata = artist.metadata || {};
            const genres = Array.isArray(metadata.genres)
              ? (metadata.genres as string[])
              : [];
            if (genres.length) artistGenreMap[artist.slug] = genres[0];
          });
        }

        const releaseLabelMap: Record<string, string> = {};
        for (const releaseBatch of chunks(releaseIds)) {
          const { data: releases, error: releaseError } = await supabase
            .from("registry_releases")
            .select("id, metadata")
            .in("id", releaseBatch)
            .eq("status", "active");
          if (releaseError) {
            console.error("Failed to fetch release labels batch:", releaseError.message);
            continue;
          }
          ((releases || []) as ReleaseLabelRow[]).forEach((release) => {
            const metadata = release.metadata || {};
            const label =
              typeof metadata.record_label === "string"
                ? metadata.record_label
                : "";
            if (label) releaseLabelMap[release.id] = label;
          });
        }

        if (!alive) return;

        setData(
          tracks.map((track) => {
            const artistInfo = artistByTrackId[track.id];
            const artistSlug = artistInfo?.slug || "";
            const artist = artistInfo?.name || "Unknown";
            const genre = artistGenreMap[artistSlug] || "";
            const label = track.release_id
              ? releaseLabelMap[track.release_id] || ""
              : "";
            const previewUrl = track.preview_url || null;
            return {
              id: track.id,
              slug: track.slug,
              artistSlug,
              title: track.title || "Untitled track",
              artist,
              genre,
              artworkUrl: track.artwork_url || "",
              isPlayable: Boolean(previewUrl),
              previewUrl,
              source: "WAKILISHA Registry",
              label,
              contextText: buildTrackSearchSnippet({
                title: track.title || "Untitled track",
                artist,
                genre,
                label,
                isPlayable: Boolean(previewUrl),
              }),
            };
          }),
        );
      } catch (reason) {
        console.error("Failed to fetch tracks for search:", reason);
        if (alive) {
          setError("Failed to load tracks");
          setData([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    void fetchData();
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading, error };
}
