import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildChartEntrySearchSnippet } from "@/services/cultureContext/searchAdapters";

export interface ChartSearchItem {
  canonicalTrackId: string | null;
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

        const mapped: ChartSearchItem[] = (entries || []).map((e) => {
          let movementAmount = 0;
          if (e.previous_rank !== null && e.previous_rank !== undefined && e.previous_rank > 0) {
            movementAmount = Math.abs(e.previous_rank - e.rank);
          }

          const item = {
            canonicalTrackId: e.canonical_track_id || null,
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
