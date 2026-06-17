import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ArtistSuggestion {
  display_name: string;
  slug: string;
}

export function useArtistSearchSuggestions(limit = 20) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetchSuggestions = async () => {
      setLoading(true);
      try {
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
    return () => { alive = false; };
  }, [limit]);

  return { suggestions, loading };
}