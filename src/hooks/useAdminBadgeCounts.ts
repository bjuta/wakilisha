import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "@/hooks/useAdminUser";
import { roleCanAccessAdmin, type Capability } from "@/services/userRoles";

interface BadgeCounts {
  missingImages: number;
  brokenLinks: number;
  reviewQueue: number;
  failedImports: number;
  pendingReports: number;
  loading: boolean;
}

type CountQueryResult = {
  count: number | null;
  error: { message: string } | null;
};

const emptyCounts: BadgeCounts = {
  missingImages: 0,
  brokenLinks: 0,
  reviewQueue: 0,
  failedImports: 0,
  pendingReports: 0,
  loading: false,
};

function hasAnyCapability(userCapabilities: Capability[], required: Capability[]): boolean {
  return required.some((capability) => userCapabilities.includes(capability));
}

async function safeCount(
  shouldFetch: boolean,
  queryFactory: () => PromiseLike<CountQueryResult>
): Promise<number> {
  if (!shouldFetch) return 0;
  const { count, error } = await queryFactory();
  if (error) return 0;
  return count ?? 0;
}

export function useAdminBadgeCounts(): BadgeCounts {
  const user = useAdminUser();
  const [counts, setCounts] = useState<BadgeCounts>(emptyCounts);

  const fetchCounts = useCallback(async () => {
    const canFetchBadges = !user.loading && Boolean(user.id) && roleCanAccessAdmin(user.role);

    if (!canFetchBadges) {
      setCounts(emptyCounts);
      return;
    }

    setCounts((prev) => ({ ...prev, loading: true }));

    const capabilities = user.capabilities;
    const canViewMissingImages = hasAnyCapability(capabilities, ["view_missing_images", "manage_media_library"]);
    const canViewBrokenLinks = hasAnyCapability(capabilities, ["view_broken_links", "manage_media_library"]);
    const canViewReviewQueue = hasAnyCapability(capabilities, ["view_review_queue", "manage_review_queue"]);

    const [missingArtists, missingArticles, mediaAssets, reviewItems] = await Promise.all([
      safeCount(
        canViewMissingImages,
        () => supabase
          .from("registry_artists")
          .select("*", { count: "exact", head: true })
          .is("public_image_url", null)
      ),
      safeCount(
        canViewMissingImages,
        () => supabase
          .from("wk_articles")
          .select("*", { count: "exact", head: true })
          .or("hero_image_url.is.null,wp_status.neq.publish")
      ),
      safeCount(
        canViewBrokenLinks,
        () => supabase
          .from("registry_media_assets")
          .select("*", { count: "exact", head: true })
          .eq("media_kind", "image")
      ),
      safeCount(
        canViewReviewQueue,
        () => supabase
          .from("registry_review_items")
          .select("*", { count: "exact", head: true })
          .eq("status", "open")
      ),
    ]);

    setCounts({
      missingImages: missingArtists + missingArticles,
      brokenLinks: mediaAssets,
      reviewQueue: reviewItems,
      failedImports: 0,
      pendingReports: 0,
      loading: false,
    });
  }, [user.loading, user.id, user.role, user.capabilities]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return counts;
}
