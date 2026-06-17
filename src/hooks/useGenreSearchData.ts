import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { buildGenreSearchSnippet } from "@/services/cultureContext/searchAdapters";

export interface GenreSearchItem {
  slug: string;
  name: string;
  accentVar: string;
  artistCount: number;
  trackCount: number;
  representativeArtists: string[];
  contextText: string;
}

const WARM_GENRE_ACCENTS = [
  "#D4A574", // warm tan
  "#C17E60", // terracotta
  "#E8B44F", // golden
  "#B8956A", // muted brass
  "#CD853F", // peru
  "#A0522D", // sienna
  "#D2691E", // chocolate
  "#8B6914", // dark goldenrod
  "#9B7653", // cafe
  "#C4A35A", // ochre
  "#6B4226", // burnt umber
  "#8D6E4C", // warm taupe
  "#E6A070", // sandy
  "#BC8F6F", // rosy brown warm
  "#A67C52", // caramel
  "#CB7A4D", // rust
  "#DEB887", // burlywood
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

function accentForGenre(slug: string): string {
  const idx = hashSlug(slug) % WARM_GENRE_ACCENTS.length;
  return WARM_GENRE_ACCENTS[idx];
}

export function useGenreSearchData() {
  const [data, setData] = useState<GenreSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch genres, only those with status active that are not merged redirects
        const { data: genres, error: err } = await supabase
          .from("registry_genres")
          .select("slug, name, metadata")
          .eq("status", "active");

        if (!alive) return;
        if (err) {
          console.error("Failed to fetch genres for search:", err.message);
          setError(err.message);
          return;
        }

        // Filter out merged/redirect genres
        const published = (genres || []).filter((g) => {
          const meta = (g.metadata as Record<string, unknown>) || {};
          return meta.status !== "merged";
        });

        // Fetch representative artists from popular_track relationships
        const genreSlugs = published.map((g) => g.slug);
        let artistsByGenre: Record<string, string[]> = {};

        if (genreSlugs.length > 0) {
          // Look for artist to track relationships where track metadata includes genre
          const { data: entityRels } = await supabase
            .from("registry_entity_relationships")
            .select("source_slug, target_slug")
            .eq("relationship_type", "popular_track")
            .eq("relationship_status", "active")
            .limit(100);

          if (entityRels && entityRels.length > 0) {
            // Fetch artist metadata for genre matching
            const artistSlugs = [...new Set(entityRels.map((r) => r.source_slug))];
            const { data: artistsMeta } = await supabase
              .from("registry_artists")
              .select("slug, display_name, metadata")
              .in("slug", artistSlugs)
              .eq("status", "active");

            published.forEach((g) => {
              const matchingArtists = (artistsMeta || [])
                .filter((a) => {
                  const ags = Array.isArray((a.metadata as Record<string, unknown>)?.genres)
                    ? ((a.metadata as Record<string, unknown>).genres as string[])
                    : [];
                  return ags.some((ag) => ag.toLowerCase() === g.name.toLowerCase());
                })
                .map((a) => a.display_name)
                .slice(0, 3);

              if (matchingArtists.length > 0) {
                artistsByGenre[g.slug] = matchingArtists;
              }
            });
          }
        }

        const mapped: GenreSearchItem[] = published.map((g) => {
          const meta = (g.metadata as Record<string, unknown>) || {};
          const artistCount = typeof meta.artist_count === "number" ? meta.artist_count : 0;
          const representativeArtists = artistsByGenre[g.slug] || [];
          const item = {
            slug: g.slug,
            name: g.name,
            accentVar: accentForGenre(g.slug),
            artistCount,
            trackCount: 0,
            representativeArtists,
          };

          return {
            ...item,
            contextText: buildGenreSearchSnippet(item),
          };
        });

        setData(mapped);
      } catch (e) {
        console.error("Failed to fetch genres for search:", e);
        if (alive) setError("Failed to load genres");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    return () => { alive = false; };
  }, []);

  return { data, loading, error };
}
