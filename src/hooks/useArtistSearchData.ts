import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface ArtistSearchItem {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  country?: string;
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
          .select("slug, display_name, public_image_url, metadata")
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
          return {
            slug: a.slug,
            name: a.display_name,
            imageUrl: a.public_image_url || undefined,
            genres: Array.isArray(meta.genres) ? (meta.genres as string[]) : [],
            country: typeof meta.country === "string" ? meta.country : undefined,
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