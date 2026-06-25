import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ArtistSuggestion {
  display_name: string;
  slug: string;
}

interface ArtistTrendSuggestion {
  artist_name: string;
  artist_slug: string;
  trend_score: number;
  status: "approved" | "published";
}

export function useArtistSearchSuggestions(limit = 20) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const fetchSuggestions = async () => {
      setLoading(true);

      try {
        const { data: trendSignals, error: trendError } = await supabase
          .from("seo_artist_trend_signals")
          .select("artist_name, artist_slug, trend_score, status")
          .in("status", ["approved", "published"])
          .order("trend_score", { ascending: false })
          .limit(limit);

        if (!alive) return;

        if (!trendError && trendSignals && trendSignals.length > 0) {
          const names = (trendSignals as ArtistTrendSuggestion[])
            .map((row) => row.artist_name)
            .filter(Boolean)
            .slice(0, limit);

          setSuggestions(names);
          return;
        }

        const { data, error } = await supabase
          .from("registry_artists")
          .select("display_name, slug")
          .eq("status", "active")
          .order("display_name")
          .limit(limit);

        if (!alive) return;

        if (error) {
          console.error("Failed to fetch artist suggestions:", error.message);
          return;
        }

        const names = (data || [])
          .map((row: ArtistSuggestion) => row.display_name)
          .filter(Boolean)
          .slice(0, limit);

        setSuggestions(names);
      } catch (err) {
        console.error("Failed to fetch artist suggestions:", err);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchSuggestions();

    return () => {
      alive = false;
    };
  }, [limit]);

  return { suggestions, loading };
}
