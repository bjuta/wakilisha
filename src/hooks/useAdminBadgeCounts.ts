import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface BadgeCounts {
  missingImages: number;
  brokenLinks: number;
  reviewQueue: number;
  failedImports: number;
  pendingReports: number;
  loading: boolean;
}

export function useAdminBadgeCounts(): BadgeCounts {
  const [counts, setCounts] = useState<BadgeCounts>({
    missingImages: 0,
    brokenLinks: 0,
    reviewQueue: 0,
    failedImports: 0,
    pendingReports: 0,
    loading: true,
  });

  const fetchCounts = useCallback(async () => {
    try {
      // Missing Images: artists without public_image_url + articles without hero_image_url
      const [{ count: missingArtists }, { count: missingArticles }, { count: mediaAssets }, { count: reviewItems }, { count: failedRecords }, { count: pendingReports }] = await Promise.all([
        supabase
          .from("registry_artists")
          .select("*", { count: "exact", head: true })
          .is("public_image_url", null),
        supabase
          .from("wk_articles")
          .select("*", { count: "exact", head: true })
          .or("hero_image_url.is.null,wp_status.neq.publish"),
        supabase
          .from("registry_media_assets")
          .select("*", { count: "exact", head: true })
          .eq("media_kind", "image"),
        supabase
          .from("entity_resolution_decisions")
          .select("*", { count: "exact", head: true })
          .eq("review_required", true),
        supabase
          .from("wk_ingestion_runs")
          .select("*", { count: "exact", head: true })
          .not("errors", "is", null),
        supabase
          .from("community_reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      setCounts({
        missingImages: (missingArtists ?? 0) + (missingArticles ?? 0),
        brokenLinks: mediaAssets ?? 0,
        reviewQueue: reviewItems ?? 0,
        failedImports: failedRecords ?? 0,
        pendingReports: pendingReports ?? 0,
        loading: false,
      });
    } catch {
      setCounts((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    // Refresh every 60 seconds
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return counts;
}