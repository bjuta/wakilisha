import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildArtistSearchSnippet } from "@/services/cultureContext/artistAdapters";
import { normalizeCountry } from "@/services/cultureContext/formatters";

export interface ArtistSearchItem {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  country?: string;
  contextText: string;
}

export function useArtistSearchData() {
  const [data, setData] = useState<ArtistSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: artists, error: err } = await supabase
          .from("registry_artists")
          .select("id, slug, display_name, public_image_url, metadata")
          .eq("status", "active")
          .order("display_name");

        if (!alive) return;
        if (err) {
          console.error("Failed to fetch artists for search:", err.message);
          setError(err.message);
          return;
        }

        const mapped: ArtistSearchItem[] = (artists || []).map((a) => {
          const meta = (a.metadata as Record<string, unknown>) || {};
          const genres = Array.isArray(meta.genres) ? (meta.genres as string[]) : [];
          const country = typeof meta.country === "string" ? normalizeCountry(meta.country) : undefined;
          const item = {
            id: a.id,
            slug: a.slug,
            name: a.display_name,
            imageUrl: a.public_image_url || undefined,
            genres,
            country,
          };

          return {
            ...item,
            contextText: buildArtistSearchSnippet(item),
          };
        });

        setData(mapped);
      } catch (e) {
        console.error("Failed to fetch artists for search:", e);
        if (alive) setError("Failed to load artists");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    return () => { alive = false; };
  }, []);

  return { data, loading, error };
}
