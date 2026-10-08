import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildChartEntrySearchSnippet } from "@/services/cultureContext/searchAdapters";

export interface ChartSearchItem {
  canonicalTrackId: string | null;
  artistSlug: string | null;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  rank: number;
  artworkUrl: string;
  movement: string;
  movementAmount: number;
  contextText: string;
}

export function useChartSearchData() {
  const [data, setData] = useState<ChartSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Get the latest published edition
        const { data: editions, error: edErr } = await supabase
          .from("wk_chart_editions_v2")
          .select("id")
          .eq("status", "published")
          .order("edition_date", { ascending: false })
          .limit(1);

        if (!alive) return;
        if (edErr) {
          console.error("Failed to fetch chart editions:", edErr.message);
          setError(edErr.message);
          return;
        }

        if (!editions || editions.length === 0) {
          setData([]);
          return;
        }

        const editionId = editions[0].id;

        const { data: entries, error: entErr } = await supabase
          .from("wk_chart_entries_v2")
          .select("canonical_track_id, track_slug, track_title, artist_name, artwork_url, rank, movement, previous_rank")
          .eq("edition_id", editionId)
          .order("rank");

        if (!alive) return;
        if (entErr) {
          console.error("Failed to fetch chart entries:", entErr.message);
          setError(entErr.message);
          return;
        }

        // Chart display strings are never route authority. Bind actual Track UUIDs
        // to active canonical Artist credits before exposing a Recording link.
        const trackIds = [...new Set((entries || [])
          .map((entry) => String(entry.canonical_track_id || ""))
          .filter(Boolean))];
        const mainArtistSlugByTrack = new Map<string, string>();
        for (let offset = 0; offset < trackIds.length; offset += 100) {
          const { data: credits, error: creditError } = await supabase
            .from("registry_track_artists")
            .select("track_id, artist_id, is_primary, credit_order, status")
            .in("track_id", trackIds.slice(offset, offset + 100))
            .eq("is_primary", true)
            .eq("status", "active")
            .order("credit_order", { ascending: true });
          if (creditError) throw creditError;
          const artistIds = [...new Set((credits || [])
            .map((credit) => String(credit.artist_id || ""))
            .filter(Boolean))];
          const { data: artists, error: artistError } = artistIds.length
            ? await supabase.from("registry_artists")
                .select("id, slug").in("id", artistIds).eq("status", "active")
            : { data: [], error: null };
          if (artistError) throw artistError;
          const canonicalById = new Map((artists || []).map((artist) => [artist.id, artist.slug]));
          for (const credit of credits || []) {
            const canonicalSlug = canonicalById.get(String(credit.artist_id || ""));
            if (canonicalSlug && !mainArtistSlugByTrack.has(String(credit.track_id))) {
              mainArtistSlugByTrack.set(String(credit.track_id), canonicalSlug);
            }
          }
        }
        if (!alive) return;

        const mapped: ChartSearchItem[] = (entries || []).map((e) => {
          let movementAmount = 0;
          if (e.previous_rank !== null && e.previous_rank !== undefined && e.previous_rank > 0) {
            movementAmount = Math.abs(e.previous_rank - e.rank);
          }

          const item = {
            canonicalTrackId: e.canonical_track_id || null,
            artistSlug: mainArtistSlugByTrack.get(String(e.canonical_track_id || "")) || null,
            slug: e.track_slug,
            title: e.track_title,
            artist: e.artist_name || "",
            genre: "",
            rank: e.rank,
            artworkUrl: e.artwork_url || "",
            movement: e.movement || "same",
            movementAmount,
          };

          return {
            ...item,
            contextText: buildChartEntrySearchSnippet(item),
          };
        });

        setData(mapped);
      } catch (e) {
        console.error("Failed to fetch chart entries for search:", e);
        if (alive) setError("Failed to load charts");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    return () => { alive = false; };
  }, []);

  return { data, loading, error };
}
